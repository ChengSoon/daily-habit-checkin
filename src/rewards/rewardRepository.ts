import { getDatabase } from "../db/database";
import { createId } from "../utils/id";
import { CreateRewardInput, RedemptionStatus, Reward, RewardRedemption } from "./types";

type RewardRow = {
  id: string;
  title: string;
  description: string | null;
  type: Reward["type"];
  price_xp: number;
  status: Reward["status"];
  virtual_kind: Reward["virtualKind"];
  inventory_limit: number | null;
  created_at: string;
  updated_at: string;
};

type RewardRedemptionRow = {
  id: string;
  reward_id: string;
  price_xp: number;
  status: RedemptionStatus;
  created_at: string;
  fulfilled_at: string | null;
  cancelled_at: string | null;
  note: string | null;
};

function mapReward(row: RewardRow): Reward {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.type,
    priceXp: row.price_xp,
    status: row.status,
    virtualKind: row.virtual_kind,
    inventoryLimit: row.inventory_limit,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function mapRedemption(row: RewardRedemptionRow): RewardRedemption {
  return {
    id: row.id,
    rewardId: row.reward_id,
    priceXp: row.price_xp,
    status: row.status,
    createdAt: row.created_at,
    fulfilledAt: row.fulfilled_at,
    cancelledAt: row.cancelled_at,
    note: row.note
  };
}

export async function createReward(input: CreateRewardInput): Promise<Reward> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const reward: Reward = {
    id: createId("reward"),
    title: input.title,
    description: input.description,
    type: input.type,
    priceXp: input.priceXp,
    status: input.status,
    virtualKind: input.virtualKind,
    inventoryLimit: input.inventoryLimit,
    createdAt: now,
    updatedAt: now
  };

  await db.runAsync(
    `INSERT INTO rewards (
      id, title, description, type, price_xp, status, virtual_kind,
      inventory_limit, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      reward.id,
      reward.title,
      reward.description,
      reward.type,
      reward.priceXp,
      reward.status,
      reward.virtualKind,
      reward.inventoryLimit,
      reward.createdAt,
      reward.updatedAt
    ]
  );

  return reward;
}

export async function updateReward(id: string, input: CreateRewardInput): Promise<void> {
  const db = getDatabase();

  await db.runAsync(
    `UPDATE rewards SET
      title = ?,
      description = ?,
      type = ?,
      price_xp = ?,
      status = ?,
      virtual_kind = ?,
      inventory_limit = ?,
      updated_at = ?
    WHERE id = ?`,
    [
      input.title,
      input.description,
      input.type,
      input.priceXp,
      input.status,
      input.virtualKind,
      input.inventoryLimit,
      new Date().toISOString(),
      id
    ]
  );
}

export async function listRewards(input: { includeArchived: boolean }): Promise<Reward[]> {
  const db = getDatabase();
  const rows = input.includeArchived
    ? await db.getAllAsync<RewardRow>("SELECT * FROM rewards ORDER BY created_at ASC")
    : await db.getAllAsync<RewardRow>("SELECT * FROM rewards WHERE status = 'active' ORDER BY created_at ASC");

  return rows.map(mapReward);
}

export async function getRewardById(id: string): Promise<Reward | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<RewardRow>("SELECT * FROM rewards WHERE id = ?", [id]);

  return row ? mapReward(row) : null;
}

export async function createRedemption(input: {
  rewardId: string;
  priceXp: number;
  status: RedemptionStatus;
  note: string | null;
}): Promise<RewardRedemption> {
  const db = getDatabase();
  const now = new Date().toISOString();
  const redemption: RewardRedemption = {
    id: createId("redemption"),
    rewardId: input.rewardId,
    priceXp: input.priceXp,
    status: input.status,
    createdAt: now,
    fulfilledAt: input.status === "fulfilled" ? now : null,
    cancelledAt: null,
    note: input.note
  };

  await db.runAsync(
    `INSERT INTO reward_redemptions (
      id, reward_id, price_xp, status, created_at, fulfilled_at, cancelled_at, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      redemption.id,
      redemption.rewardId,
      redemption.priceXp,
      redemption.status,
      redemption.createdAt,
      redemption.fulfilledAt,
      redemption.cancelledAt,
      redemption.note
    ]
  );

  return redemption;
}

export async function updateRedemptionStatus(
  id: string,
  status: RedemptionStatus
): Promise<RewardRedemption | null> {
  const db = getDatabase();
  const now = new Date().toISOString();

  await db.runAsync(
    `UPDATE reward_redemptions SET status = ?, fulfilled_at = ?, cancelled_at = ? WHERE id = ?`,
    [status, status === "fulfilled" ? now : null, status === "cancelled" ? now : null, id]
  );

  return getRedemptionById(id);
}

export async function getRedemptionById(id: string): Promise<RewardRedemption | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<RewardRedemptionRow>("SELECT * FROM reward_redemptions WHERE id = ?", [id]);

  return row ? mapRedemption(row) : null;
}

export async function listRedemptions(): Promise<RewardRedemption[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<RewardRedemptionRow>(
    "SELECT * FROM reward_redemptions ORDER BY created_at DESC"
  );

  return rows.map(mapRedemption);
}
