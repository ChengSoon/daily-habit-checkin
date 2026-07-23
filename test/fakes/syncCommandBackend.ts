import { randomUUID } from "node:crypto";
import { shouldRunOnDate } from "../../src/habits/habitRules";
import { eachDateKey } from "../../src/utils/date";
import { calculateCheckInXpAwards } from "../../src/xp/xpRules";

type Row = Record<string, unknown>;
type WalletState = {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string;
};

export type FakeCommandStore = {
  tables: Record<string, Map<string, Row>>;
  seenTxKeys: Set<string>;
  getWallet: () => WalletState;
  postTransactions: (transactions: Row[]) => { inserted: Row[]; wallet: WalletState };
};

export function completeCheckInCommand(store: FakeCommandStore, body: Row): Row {
  const habit = [...store.tables.habits.values()].find((row) => row.id === body.habitId);
  if (!habit) throw new Error("习惯不存在");
  const existing = [...store.tables.check_ins.values()].find(
    (row) => row.habitId === body.habitId && row.date === body.date
  );
  const checkIn = {
    id: existing?.id ?? randomUUID(),
    habitId: body.habitId,
    date: body.date,
    status: "completed",
    value: body.value ?? null,
    note: body.note ?? null,
    createdBy: existing?.createdBy ?? "account-1",
    createdAt: existing?.createdAt ?? new Date().toISOString()
  };
  store.tables.check_ins.set(String(checkIn.id), checkIn);

  const frequency = JSON.parse(String(habit.frequencyJson));
  const scheduledDates = eachDateKey(String(habit.createdAt).slice(0, 10), String(body.date)).filter((date) =>
    shouldRunOnDate(frequency, new Date(`${date}T00:00:00`))
  );
  const completedDates = [...store.tables.check_ins.values()]
    .filter((row) => row.habitId === body.habitId && row.status === "completed")
    .map((row) => String(row.date));
  const plan = [...store.tables.habit_plans.values()].find((row) => row.habitId === body.habitId);
  const awards = calculateCheckInXpAwards({
    habitId: String(body.habitId),
    dateKey: String(body.date),
    scheduledDates,
    completedDates,
    planCompleted: Boolean(plan && String(body.date) >= String(plan.endDate))
  });
  const inputs = awards.map((award) => {
    const canonical = award.reason === "plan_complete" && plan
      ? `plan_complete:${String(plan.id)}`
      : award.uniqueKey;
    const undone = [...store.tables.xp_transactions.values()].some((row) =>
      String(row.uniqueKey).startsWith(`checkin_undo:${canonical}:`)
    );
    return {
      uniqueKey: store.seenTxKeys.has(canonical) && undone
        ? `checkin_redo:${canonical}:${checkIn.id}`
        : canonical,
      amount: award.amount,
      type: "earn",
      reason: award.reason,
      habitId: body.habitId,
      checkInId: checkIn.id,
      rewardId: null,
      redemptionId: null,
      dateKey: body.date
    };
  });
  const xp = store.postTransactions(inputs);
  return {
    checkIn,
    awards,
    insertedTransactions: xp.inserted,
    wallet: xp.wallet,
    earnedDelta: xp.inserted.reduce((sum, row) => sum + Number(row.amount), 0),
    streak: 0
  };
}

export function undoCheckInCommand(store: FakeCommandStore, body: Row): Row {
  const existing = store.tables.check_ins.get(String(body.checkInId));
  if (!existing || existing.habitId !== body.habitId || existing.date !== body.date) {
    throw new Error("打卡记录不存在");
  }
  store.tables.check_ins.delete(String(body.checkInId));
  const targets = [...store.tables.xp_transactions.values()].filter(
    (row) => row.checkInId === body.checkInId && Number(row.amount) > 0
  );
  const reversed = store.postTransactions(targets.map((row) => ({
    uniqueKey: `checkin_undo:${String(row.uniqueKey)}:${String(body.checkInId)}`,
    amount: -Number(row.amount),
    type: "adjust",
    reason: "checkin_undo",
    habitId: body.habitId,
    checkInId: body.checkInId,
    rewardId: null,
    redemptionId: null,
    dateKey: body.date
  })));
  return {
    removed: existing,
    reversedAmount: reversed.inserted.reduce((sum, row) => sum + Math.abs(Number(row.amount)), 0),
    insertedTransactions: reversed.inserted,
    wallet: reversed.wallet
  };
}

export function redeemRewardCommand(store: FakeCommandStore, rewardId: string): Row {
  const reward = store.tables.rewards.get(rewardId);
  if (!reward || reward.status !== "active") throw new Error("奖励不可兑换");
  const price = Number(reward.priceXp);
  const wallet = store.getWallet();
  if (wallet.balance < price) throw new Error(`积分不足，还差 ${price - wallet.balance} 积分`);
  const redemption = {
    id: randomUUID(),
    rewardId,
    priceXp: price,
    status: "pending_fulfillment",
    createdAt: new Date().toISOString(),
    fulfilledAt: null,
    cancelledAt: null,
    note: null
  };
  store.tables.reward_redemptions.set(redemption.id, redemption);
  store.postTransactions([{
    uniqueKey: `reward_redeem:${redemption.id}`,
    amount: -price,
    type: "spend",
    reason: "reward_redeem",
    habitId: null,
    checkInId: null,
    rewardId,
    redemptionId: redemption.id,
    dateKey: null
  }]);
  return { redemption, wallet: store.getWallet() };
}

export function updateRedemptionCommand(
  store: FakeCommandStore,
  id: string,
  status: "fulfilled" | "cancelled"
): Row {
  const current = store.tables.reward_redemptions.get(id);
  if (!current) throw new Error("兑换记录不存在");
  if (status === "cancelled" && current.status === "fulfilled") throw new Error("已兑现的奖励不能取消");
  const now = new Date().toISOString();
  const updated = {
    ...current,
    status,
    fulfilledAt: status === "fulfilled" ? now : null,
    cancelledAt: status === "cancelled" ? now : null
  };
  store.tables.reward_redemptions.set(id, updated);
  if (status === "cancelled" && current.status !== "cancelled") {
    store.postTransactions([{
      uniqueKey: `redemption_cancel:${id}`,
      amount: Number(current.priceXp),
      type: "refund",
      reason: "redemption_cancel",
      habitId: null,
      checkInId: null,
      rewardId: current.rewardId,
      redemptionId: id,
      dateKey: null
    }]);
  }
  return { redemption: updated, wallet: store.getWallet() };
}
