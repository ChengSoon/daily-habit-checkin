import { randomUUID } from "node:crypto";
import type { CommandDb } from "../db/commandDb.js";

type RewardRow = { id: string; price_xp: number; status: string; inventory_limit: number | null };
type WalletRow = {
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  updated_at: string | Date;
};
type RedemptionRow = {
  id: string;
  reward_id: string;
  price_xp: number;
  status: string;
  created_at: string | Date;
  fulfilled_at: string | Date | null;
  cancelled_at: string | Date | null;
  note: string | null;
};

function iso(value: string | Date | null): string | null {
  if (value === null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function mapWallet(row: WalletRow) {
  return {
    balance: Number(row.balance),
    lifetimeEarned: Number(row.lifetime_earned),
    lifetimeSpent: Number(row.lifetime_spent),
    updatedAt: iso(row.updated_at)!
  };
}

function mapRedemption(row: RedemptionRow) {
  return {
    id: row.id,
    rewardId: row.reward_id,
    priceXp: Number(row.price_xp),
    status: row.status,
    createdAt: iso(row.created_at)!,
    fulfilledAt: iso(row.fulfilled_at),
    cancelledAt: iso(row.cancelled_at),
    note: row.note
  };
}

async function lockWallet(db: CommandDb, spaceId: string): Promise<WalletRow> {
  await db.query(
    `INSERT INTO xp_wallet (space_id, balance, lifetime_earned, lifetime_spent, updated_at)
     VALUES ($1, 0, 0, 0, now()) ON CONFLICT (space_id) DO NOTHING`,
    [spaceId]
  );
  const wallet = await db.query<WalletRow>(
    `SELECT balance, lifetime_earned, lifetime_spent, updated_at
     FROM xp_wallet WHERE space_id = $1 FOR UPDATE`,
    [spaceId]
  );
  if (!wallet.rows[0]) throw new Error("XP 钱包不存在");
  return wallet.rows[0];
}

async function updateWallet(
  db: CommandDb,
  options: { spaceId: string; balanceDelta: number; spentDelta: number }
): Promise<WalletRow> {
  const { spaceId, balanceDelta, spentDelta } = options;
  const updated = await db.query<WalletRow>(
    `UPDATE xp_wallet SET balance = balance + $2, lifetime_spent = lifetime_spent + $3,
       updated_at = now() WHERE space_id = $1
     RETURNING balance, lifetime_earned, lifetime_spent, updated_at`,
    [spaceId, balanceDelta, spentDelta]
  );
  if (!updated.rows[0]) throw new Error("XP 钱包不存在");
  return updated.rows[0];
}

export async function redeemRewardInTransaction(db: CommandDb, spaceId: string, rewardId: string) {
  const rewardResult = await db.query<RewardRow>(
    `SELECT id, price_xp, status, inventory_limit FROM rewards
     WHERE id = $1 AND space_id = $2 FOR UPDATE`,
    [rewardId, spaceId]
  );
  const reward = rewardResult.rows[0];
  if (!reward || reward.status !== "active") {
    throw Object.assign(new Error("奖励不可兑换"), { status: 404 });
  }
  if (!Number.isInteger(reward.price_xp) || reward.price_xp <= 0) {
    throw Object.assign(new Error("奖励价格配置不正确"), { status: 409 });
  }

  const wallet = await lockWallet(db, spaceId);
  if (wallet.balance < reward.price_xp) {
    throw Object.assign(new Error(`积分不足，还差 ${reward.price_xp - wallet.balance} 积分`), { status: 409 });
  }
  if (reward.inventory_limit !== null) {
    const used = await db.query<{ count: string }>(
      `SELECT COUNT(*) FROM reward_redemptions
       WHERE space_id = $1 AND reward_id = $2 AND status <> 'cancelled'`,
      [spaceId, reward.id]
    );
    if (Number(used.rows[0]?.count ?? 0) >= reward.inventory_limit) {
      throw Object.assign(new Error("奖励库存不足"), { status: 409 });
    }
  }

  const redemptionId = randomUUID();
  const redemption = await db.query<RedemptionRow>(
    `INSERT INTO reward_redemptions
       (id, space_id, reward_id, price_xp, status, created_at, fulfilled_at, cancelled_at, note)
     VALUES ($1, $2, $3, $4, 'pending_fulfillment', now(), NULL, NULL, NULL)
     RETURNING id, reward_id, price_xp, status, created_at, fulfilled_at, cancelled_at, note`,
    [redemptionId, spaceId, reward.id, reward.price_xp]
  );
  await db.query(
    `INSERT INTO xp_transactions
       (id, space_id, unique_key, amount, type, reason, reward_id, redemption_id, created_at)
     VALUES ($1, $2, $3, $4, 'spend', 'reward_redeem', $5, $6, now())`,
    [randomUUID(), spaceId, `reward_redeem:${redemptionId}`, -reward.price_xp, reward.id, redemptionId]
  );
  const updatedWallet = await updateWallet(db, {
    spaceId, balanceDelta: -reward.price_xp, spentDelta: reward.price_xp
  });
  return { redemption: mapRedemption(redemption.rows[0]), wallet: mapWallet(updatedWallet) };
}

export async function fulfillRedemptionInTransaction(db: CommandDb, spaceId: string, redemptionId: string) {
  const updated = await db.query<RedemptionRow>(
    `UPDATE reward_redemptions SET status = 'fulfilled', fulfilled_at = now(), cancelled_at = NULL
     WHERE id = $1 AND space_id = $2 AND status = 'pending_fulfillment'
     RETURNING id, reward_id, price_xp, status, created_at, fulfilled_at, cancelled_at, note`,
    [redemptionId, spaceId]
  );
  if (!updated.rows[0]) throw Object.assign(new Error("待兑现记录不存在"), { status: 409 });
  return mapRedemption(updated.rows[0]);
}

export async function cancelRedemptionInTransaction(db: CommandDb, spaceId: string, redemptionId: string) {
  const locked = await db.query<RedemptionRow>(
    `SELECT id, reward_id, price_xp, status, created_at, fulfilled_at, cancelled_at, note
     FROM reward_redemptions WHERE id = $1 AND space_id = $2 FOR UPDATE`,
    [redemptionId, spaceId]
  );
  const current = locked.rows[0];
  if (!current) throw Object.assign(new Error("兑换记录不存在"), { status: 404 });
  if (current.status === "fulfilled") throw Object.assign(new Error("已兑现的奖励不能取消"), { status: 409 });
  if (current.status === "cancelled") return { redemption: mapRedemption(current), wallet: mapWallet(await lockWallet(db, spaceId)) };

  const updated = await db.query<RedemptionRow>(
    `UPDATE reward_redemptions SET status = 'cancelled', cancelled_at = now(), fulfilled_at = NULL
     WHERE id = $1 AND space_id = $2
     RETURNING id, reward_id, price_xp, status, created_at, fulfilled_at, cancelled_at, note`,
    [redemptionId, spaceId]
  );
  const lockedWallet = await lockWallet(db, spaceId);
  const refund = await db.query<{ id: string }>(
    `INSERT INTO xp_transactions
       (id, space_id, unique_key, amount, type, reason, reward_id, redemption_id, created_at)
     VALUES ($1, $2, $3, $4, 'refund', 'redemption_cancel', $5, $6, now())
     ON CONFLICT (space_id, unique_key) DO NOTHING RETURNING id`,
    [randomUUID(), spaceId, `redemption_cancel:${redemptionId}`, current.price_xp, current.reward_id, redemptionId]
  );
  const wallet = refund.rows[0]
    ? await updateWallet(db, { spaceId, balanceDelta: current.price_xp, spentDelta: -current.price_xp })
    : lockedWallet;
  return { redemption: mapRedemption(updated.rows[0]), wallet: mapWallet(wallet) };
}
