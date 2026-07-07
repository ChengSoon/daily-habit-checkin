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
  /** R2 对象 key；显示时用 publicUrl(imageKey) 拼公开域名直读。无图为 null。 */
  imageKey: string | null;
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
  /** R2 对象 key；无图为 null。上传由页面在保存前完成，这里只带 key。 */
  imageKey: string | null;
};
