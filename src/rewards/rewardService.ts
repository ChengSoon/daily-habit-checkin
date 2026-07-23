import { postCommand } from "../sync/commandClient";
import {
  createReward,
  listRewards,
  mapRedemption,
  type RedemptionDto
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
    inventoryLimit: null,
    imageKey: null
  },
  {
    title: "专属称号",
    description: "解锁一个阶段称号",
    type: "virtual",
    priceXp: 200,
    status: "active",
    virtualKind: "title",
    inventoryLimit: null,
    imageKey: null
  },
  {
    title: "奶茶一杯",
    description: "兑换后等待兑现",
    type: "real_world",
    priceXp: 300,
    status: "active",
    virtualKind: "none",
    inventoryLimit: null,
    imageKey: null
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
  const result = await postCommand<{ redemption: RedemptionDto }>(`/api/rewards/${rewardId}/redeem`);
  return mapRedemption(result.redemption);
}

export async function fulfillRedemption(id: string): Promise<RewardRedemption> {
  const result = await postCommand<{ redemption: RedemptionDto }>(`/api/rewards/redemptions/${id}/fulfill`);
  return mapRedemption(result.redemption);
}

export async function cancelRedemption(id: string): Promise<RewardRedemption> {
  const result = await postCommand<{ redemption: RedemptionDto }>(`/api/rewards/redemptions/${id}/cancel`);
  return mapRedemption(result.redemption);
}
