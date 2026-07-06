import { getDatabase } from "../db/database";
import { createId } from "../utils/id";
import { XpReason, XpTransaction, XpTransactionType, XpWallet } from "./types";

const DEFAULT_WALLET_ID = "default";

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

type XpWalletRow = {
  id: "default";
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  updated_at: string;
};

type XpTransactionRow = {
  id: string;
  unique_key: string;
  amount: number;
  type: XpTransactionType;
  reason: XpReason;
  habit_id: string | null;
  check_in_id: string | null;
  reward_id: string | null;
  redemption_id: string | null;
  date_key: string | null;
  created_at: string;
};

function mapWallet(row: XpWalletRow): XpWallet {
  return {
    id: row.id,
    balance: row.balance,
    lifetimeEarned: row.lifetime_earned,
    lifetimeSpent: row.lifetime_spent,
    updatedAt: row.updated_at
  };
}

function mapTransaction(row: XpTransactionRow): XpTransaction {
  return {
    id: row.id,
    uniqueKey: row.unique_key,
    amount: row.amount,
    type: row.type,
    reason: row.reason,
    habitId: row.habit_id,
    checkInId: row.check_in_id,
    rewardId: row.reward_id,
    redemptionId: row.redemption_id,
    dateKey: row.date_key,
    createdAt: row.created_at
  };
}

async function ensureWallet(): Promise<void> {
  const db = getDatabase();
  const existing = await db.getFirstAsync<XpWalletRow>("SELECT * FROM xp_wallet WHERE id = ?", [DEFAULT_WALLET_ID]);

  if (existing) {
    return;
  }

  await db.runAsync(
    `INSERT INTO xp_wallet (id, balance, lifetime_earned, lifetime_spent, updated_at)
     VALUES (?, ?, ?, ?, ?)`,
    [DEFAULT_WALLET_ID, 0, 0, 0, new Date().toISOString()]
  );
}

function walletDeltas(input: XpTransactionInput): { earned: number; spent: number } {
  if (input.type === "earn") {
    return { earned: input.amount, spent: 0 };
  }
  if (input.type === "spend") {
    return { earned: 0, spent: Math.abs(input.amount) };
  }
  if (input.type === "refund") {
    return { earned: 0, spent: -Math.abs(input.amount) };
  }
  return { earned: Math.max(input.amount, 0), spent: Math.max(-input.amount, 0) };
}

export async function getWallet(): Promise<XpWallet> {
  const db = getDatabase();
  await ensureWallet();
  const row = await db.getFirstAsync<XpWalletRow>("SELECT * FROM xp_wallet WHERE id = ?", [DEFAULT_WALLET_ID]);

  if (!row) {
    throw new Error("XP 钱包初始化失败");
  }

  return mapWallet(row);
}

export async function listXpTransactions(): Promise<XpTransaction[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<XpTransactionRow>("SELECT * FROM xp_transactions ORDER BY created_at ASC");

  return rows.map(mapTransaction);
}

export async function applyXpTransactions(inputs: XpTransactionInput[]): Promise<XpTransaction[]> {
  const db = getDatabase();
  await ensureWallet();
  const inserted: XpTransaction[] = [];

  for (const input of inputs) {
    const existing = await db.getFirstAsync<XpTransactionRow>(
      "SELECT * FROM xp_transactions WHERE unique_key = ?",
      [input.uniqueKey]
    );

    if (existing) {
      continue;
    }

    const now = new Date().toISOString();
    const id = createId("xp");

    await db.runAsync(
      `INSERT INTO xp_transactions (
        id, unique_key, amount, type, reason, habit_id, check_in_id,
        reward_id, redemption_id, date_key, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        input.uniqueKey,
        input.amount,
        input.type,
        input.reason,
        input.habitId,
        input.checkInId,
        input.rewardId,
        input.redemptionId,
        input.dateKey,
        now
      ]
    );

    const deltas = walletDeltas(input);
    await db.runAsync(
      `UPDATE xp_wallet SET
        balance = balance + ?,
        lifetime_earned = lifetime_earned + ?,
        lifetime_spent = lifetime_spent + ?,
        updated_at = ?
      WHERE id = ?`,
      [input.amount, deltas.earned, deltas.spent, now, DEFAULT_WALLET_ID]
    );

    inserted.push({
      id,
      uniqueKey: input.uniqueKey,
      amount: input.amount,
      type: input.type,
      reason: input.reason,
      habitId: input.habitId,
      checkInId: input.checkInId,
      rewardId: input.rewardId,
      redemptionId: input.redemptionId,
      dateKey: input.dateKey,
      createdAt: now
    });
  }

  return inserted;
}
