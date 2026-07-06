import { apiRequest } from "./apiClient";

/**
 * XP 钱包同步客户端。余额由服务端权威计算：客户端只上报交易，
 * 服务端在单事务里幂等插入交易并原子更新钱包，返回最新余额。
 */

export type WalletDto = {
  balance: number;
  lifetimeEarned: number;
  lifetimeSpent: number;
  updatedAt: string;
};

export type TransactionInput = {
  uniqueKey: string;
  amount: number;
  type: "earn" | "spend" | "refund" | "adjust";
  reason: string;
  habitId: string | null;
  checkInId: string | null;
  rewardId: string | null;
  redemptionId: string | null;
  dateKey: string | null;
};

export type TransactionDto = TransactionInput & { id: string; createdAt: string };

/** 读取当前空间钱包。 */
export async function fetchWallet(): Promise<WalletDto> {
  return apiRequest<WalletDto>("/api/wallet");
}

/**
 * 批量提交交易。服务端按 uniqueKey 幂等：已存在的不重复计入，
 * 返回本次实际新插入的交易与最新钱包。
 */
export async function postTransactions(
  transactions: TransactionInput[]
): Promise<{ inserted: TransactionDto[]; wallet: WalletDto }> {
  return apiRequest<{ inserted: TransactionDto[]; wallet: WalletDto }>("/api/wallet/transactions", {
    method: "POST",
    body: { transactions }
  });
}
