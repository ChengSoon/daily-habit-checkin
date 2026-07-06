import { fetchWallet, postTransactions, TransactionInput } from "../sync/walletClient";
import { listResource } from "../sync/dataClient";
import { XpReason, XpTransaction, XpTransactionType, XpWallet } from "./types";

/**
 * XP 钱包与交易仓储，走云端同步。
 *
 * 余额由服务端权威计算：客户端只上报交易，服务端在单事务里幂等插入交易
 * 并原子更新钱包（见 server walletMath / dataRoutes）。因此这里不再本地累加余额，
 * 只负责上报交易、读取钱包与交易流水。
 *
 * XpWallet.id 在类型上固定为 "default"（单空间单钱包），服务端钱包无 id，映射时补上。
 */

type XpTransactionInput = {
  uniqueKey: string;
  amount: number;
  type: XpTransactionType;
  reason: XpReason;
  habitId: string | null;
  checkInId: string | null;
  rewardId: string | null;
  redemptionId: string | null;
  dateKey: string | null;
};

type XpTransactionDto = {
  id: string;
  uniqueKey: string;
  amount: number;
  type: string;
  reason: string;
  habitId: string | null;
  checkInId: string | null;
  rewardId: string | null;
  redemptionId: string | null;
  dateKey: string | null;
  createdAt: string;
};

function mapTransaction(dto: XpTransactionDto): XpTransaction {
  return {
    id: dto.id,
    uniqueKey: dto.uniqueKey,
    amount: Number(dto.amount),
    type: dto.type as XpTransactionType,
    reason: dto.reason as XpReason,
    habitId: dto.habitId,
    checkInId: dto.checkInId,
    rewardId: dto.rewardId,
    redemptionId: dto.redemptionId,
    dateKey: dto.dateKey,
    createdAt: dto.createdAt
  };
}

function toTransactionInput(input: XpTransactionInput): TransactionInput {
  return {
    uniqueKey: input.uniqueKey,
    amount: input.amount,
    type: input.type,
    reason: input.reason,
    habitId: input.habitId,
    checkInId: input.checkInId,
    rewardId: input.rewardId,
    redemptionId: input.redemptionId,
    dateKey: input.dateKey
  };
}

export async function getWallet(): Promise<XpWallet> {
  const wallet = await fetchWallet();
  return {
    id: "default",
    balance: Number(wallet.balance),
    lifetimeEarned: Number(wallet.lifetimeEarned),
    lifetimeSpent: Number(wallet.lifetimeSpent),
    updatedAt: wallet.updatedAt
  };
}

export async function listXpTransactions(): Promise<XpTransaction[]> {
  const rows = await listResource<XpTransactionDto>("xp_transactions");
  return rows
    .map(mapTransaction)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

/**
 * 上报一批交易。服务端按 uniqueKey 幂等：已存在的不重复计入余额。
 * 返回本次实际新插入的交易（与旧本地实现语义一致）。
 */
export async function applyXpTransactions(inputs: XpTransactionInput[]): Promise<XpTransaction[]> {
  if (inputs.length === 0) {
    return [];
  }
  const { inserted } = await postTransactions(inputs.map(toTransactionInput));
  return inserted.map(mapTransaction);
}
