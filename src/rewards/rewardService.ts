import { applyXpTransactions, getWallet } from "../xp/xpRepository";
import {
  createRedemption,
  createReward,
  getRedemptionById,
  getRewardById,
  listRewards,
  updateRedemptionStatus
} from "./rewardRepository";
import { CreateRewardInput, RewardRedemption } from "./types";

export const DEFAULT_REWARDS: CreateRewardInput[] = [
  {
    title: "粉色主题",
    description: "解锁一套更甜一点的界面主题",
    type: "virtual",
    priceXp: 100,
    status: "active",
    virtualKind: "theme",
    inventoryLimit: null
  },
  {
    title: "专属称号",
    description: "解锁一个阶段称号",
    type: "virtual",
    priceXp: 200,
    status: "active",
    virtualKind: "title",
    inventoryLimit: null
  },
  {
    title: "奶茶一杯",
    description: "兑换后等待兑现",
    type: "real_world",
    priceXp: 300,
    status: "active",
    virtualKind: "none",
    inventoryLimit: null
  }
];

export async function ensureDefaultRewards(): Promise<void> {
  const existing = await listRewards({ includeArchived: true });

  if (existing.length > 0) {
    return;
  }

  for (const reward of DEFAULT_REWARDS) {
    await createReward(reward);
  }
}

export async function redeemReward(rewardId: string): Promise<RewardRedemption> {
  const reward = await getRewardById(rewardId);

  if (!reward || reward.status !== "active") {
    throw new Error("奖励不可兑换");
  }

  const wallet = await getWallet();
  const missing = reward.priceXp - wallet.balance;

  if (missing > 0) {
    throw new Error(`XP 不足，还差 ${missing} XP`);
  }

  const redemption = await createRedemption({
    rewardId: reward.id,
    priceXp: reward.priceXp,
    status: reward.type === "virtual" ? "fulfilled" : "pending_fulfillment",
    note: null
  });

  await applyXpTransactions([
    {
      uniqueKey: `reward_redeem:${redemption.id}`,
      amount: -reward.priceXp,
      type: "spend",
      reason: "reward_redeem",
      habitId: null,
      checkInId: null,
      rewardId: reward.id,
      redemptionId: redemption.id,
      dateKey: null
    }
  ]);

  return redemption;
}

export async function fulfillRedemption(id: string): Promise<RewardRedemption> {
  const redemption = await getRedemptionById(id);

  if (!redemption) {
    throw new Error("兑换记录不存在");
  }
  if (redemption.status === "cancelled") {
    throw new Error("已取消的奖励不能兑现");
  }

  const updated = await updateRedemptionStatus(id, "fulfilled");
  if (!updated) {
    throw new Error("兑现失败");
  }
  return updated;
}

export async function cancelRedemption(id: string): Promise<RewardRedemption> {
  const redemption = await getRedemptionById(id);

  if (!redemption) {
    throw new Error("兑换记录不存在");
  }
  if (redemption.status === "fulfilled") {
    throw new Error("已兑现的奖励不能取消");
  }
  if (redemption.status === "cancelled") {
    return redemption;
  }

  const updated = await updateRedemptionStatus(id, "cancelled");
  if (!updated) {
    throw new Error("取消失败");
  }

  await applyXpTransactions([
    {
      uniqueKey: `redemption_cancel:${redemption.id}`,
      amount: redemption.priceXp,
      type: "refund",
      reason: "redemption_cancel",
      habitId: null,
      checkInId: null,
      rewardId: redemption.rewardId,
      redemptionId: redemption.id,
      dateKey: null
    }
  ]);

  return updated;
}
