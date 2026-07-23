import { createId } from "../utils/id";
import { listResource, upsertResource } from "../sync/dataClient";
import { CreateRewardInput, RedemptionStatus, Reward, RewardRedemption } from "./types";

/**
 * 奖励与兑换记录仓储，走云端同步（/api/data/rewards、/api/data/reward_redemptions）。
 * 服务端返回 camelCase 字段，这里做一次规范化映射，保证类型稳定。
 *
 * 服务端 upsert 要求携带全部非空字段（含 createdAt），因此更新类操作
 * 会先取回原记录再合并，避免丢失 createdAt 等不可为空字段。
 */

type RewardDto = {
  id: string;
  title: string;
  description: string | null;
  type: Reward["type"];
  priceXp: number;
  status: Reward["status"];
  virtualKind: Reward["virtualKind"];
  inventoryLimit: number | null;
  imageKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RedemptionDto = {
  id: string;
  rewardId: string;
  priceXp: number;
  status: RedemptionStatus;
  createdAt: string;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  note: string | null;
};

function mapReward(dto: RewardDto): Reward {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    type: dto.type,
    priceXp: Number(dto.priceXp),
    status: dto.status,
    virtualKind: dto.virtualKind,
    inventoryLimit: dto.inventoryLimit === null ? null : Number(dto.inventoryLimit),
    imageKey: dto.imageKey,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt
  };
}

export function mapRedemption(dto: RedemptionDto): RewardRedemption {
  return {
    id: dto.id,
    rewardId: dto.rewardId,
    priceXp: Number(dto.priceXp),
    status: dto.status,
    createdAt: dto.createdAt,
    fulfilledAt: dto.fulfilledAt,
    cancelledAt: dto.cancelledAt,
    note: dto.note
  };
}

function rewardFields(reward: Reward): Record<string, unknown> {
  return {
    title: reward.title,
    description: reward.description,
    type: reward.type,
    priceXp: reward.priceXp,
    status: reward.status,
    virtualKind: reward.virtualKind,
    inventoryLimit: reward.inventoryLimit,
    imageKey: reward.imageKey,
    createdAt: reward.createdAt,
    updatedAt: reward.updatedAt
  };
}

function redemptionFields(redemption: RewardRedemption): Record<string, unknown> {
  return {
    rewardId: redemption.rewardId,
    priceXp: redemption.priceXp,
    status: redemption.status,
    createdAt: redemption.createdAt,
    fulfilledAt: redemption.fulfilledAt,
    cancelledAt: redemption.cancelledAt,
    note: redemption.note
  };
}

export async function createReward(input: CreateRewardInput): Promise<Reward> {
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
    imageKey: input.imageKey,
    createdAt: now,
    updatedAt: now
  };

  const saved = await upsertResource<RewardDto>("rewards", reward.id, rewardFields(reward));
  return mapReward(saved);
}

export async function updateReward(id: string, input: CreateRewardInput): Promise<void> {
  const existing = await getRewardById(id);
  const createdAt = existing?.createdAt ?? new Date().toISOString();

  const reward: Reward = {
    id,
    title: input.title,
    description: input.description,
    type: input.type,
    priceXp: input.priceXp,
    status: input.status,
    virtualKind: input.virtualKind,
    inventoryLimit: input.inventoryLimit,
    imageKey: input.imageKey,
    createdAt,
    updatedAt: new Date().toISOString()
  };

  await upsertResource<RewardDto>("rewards", id, rewardFields(reward));
}

export async function listRewards(input: { includeArchived: boolean }): Promise<Reward[]> {
  const rows = await listResource<RewardDto>("rewards");
  const rewards = rows
    .map(mapReward)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

  return input.includeArchived ? rewards : rewards.filter((reward) => reward.status === "active");
}

export async function getRewardById(id: string): Promise<Reward | null> {
  const rows = await listResource<RewardDto>("rewards");
  const row = rows.find((reward) => reward.id === id);

  return row ? mapReward(row) : null;
}

export async function createRedemption(input: {
  rewardId: string;
  priceXp: number;
  status: RedemptionStatus;
  note: string | null;
}): Promise<RewardRedemption> {
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

  const saved = await upsertResource<RedemptionDto>(
    "reward_redemptions",
    redemption.id,
    redemptionFields(redemption)
  );
  return mapRedemption(saved);
}

export async function updateRedemptionStatus(
  id: string,
  status: RedemptionStatus
): Promise<RewardRedemption | null> {
  const existing = await getRedemptionById(id);
  if (!existing) {
    return null;
  }

  const now = new Date().toISOString();
  const updated: RewardRedemption = {
    ...existing,
    status,
    fulfilledAt: status === "fulfilled" ? now : null,
    cancelledAt: status === "cancelled" ? now : null
  };

  const saved = await upsertResource<RedemptionDto>(
    "reward_redemptions",
    id,
    redemptionFields(updated)
  );
  return mapRedemption(saved);
}

export async function getRedemptionById(id: string): Promise<RewardRedemption | null> {
  const rows = await listResource<RedemptionDto>("reward_redemptions");
  const row = rows.find((redemption) => redemption.id === id);

  return row ? mapRedemption(row) : null;
}

export async function listRedemptions(): Promise<RewardRedemption[]> {
  const rows = await listResource<RedemptionDto>("reward_redemptions");
  return rows
    .map(mapRedemption)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
