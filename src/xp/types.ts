export type XpTransactionType = "earn" | "spend" | "refund" | "adjust";

export type XpReason =
  | "checkin"
  | "streak_3"
  | "streak_7"
  | "plan_complete"
  | "return_bonus"
  | "checkin_undo"
  | "reward_redeem"
  | "redemption_cancel";

export type XpWallet = {
  id: "default";
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string;
};

export type XpTransaction = {
  id: string;
  uniqueKey: string;
  amount: number;
  type: XpTransactionType;
  reason: XpReason;
  habitId: string | null;
  checkInId: string | null;
  rewardId: string | null;
  redemptionId: string | null;
  dateKey: string | null;
  createdAt: string;
};

export type XpAward = {
  reason: Extract<XpReason, "checkin" | "streak_3" | "streak_7" | "plan_complete" | "return_bonus">;
  amount: number;
  label: string;
  uniqueKey: string;
};

export type XpAwardResult = {
  awards: XpAward[];
  insertedTransactions: XpTransaction[];
  wallet: XpWallet;
};

export type XpRevokeResult = {
  reversedAmount: number;
  insertedTransactions: XpTransaction[];
  wallet: XpWallet;
};
