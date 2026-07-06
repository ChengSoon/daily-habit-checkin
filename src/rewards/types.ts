export type RewardType = "virtual" | "real_world";
export type RewardStatus = "active" | "archived";
export type VirtualRewardKind = "theme" | "celebration" | "title" | "badge" | "card_skin" | "none";
export type RedemptionStatus = "pending_fulfillment" | "fulfilled" | "cancelled";

export type Reward = {
  id: string;
  title: string;
  description: string | null;
  type: RewardType;
  priceXp: number;
  status: RewardStatus;
  virtualKind: VirtualRewardKind;
  inventoryLimit: number | null;
  createdAt: string;
  updatedAt: string;
};

export type RewardRedemption = {
  id: string;
  rewardId: string;
  priceXp: number;
  status: RedemptionStatus;
  createdAt: string;
  fulfilledAt: string | null;
  cancelledAt: string | null;
  note: string | null;
};

export type CreateRewardInput = {
  title: string;
  description: string | null;
  type: RewardType;
  priceXp: number;
  status: RewardStatus;
  virtualKind: VirtualRewardKind;
  inventoryLimit: number | null;
};
