import { randomUUID } from "node:crypto";
import type { CommandDb } from "../db/commandDb.js";
import {
  AWARD_LABELS,
  awardDefinitions,
  isScheduled,
  mapCheckIn,
  mapTransaction,
  mapWallet,
  parseFrequency,
  streakFor,
  type CheckInRow,
  type HabitRow,
  type TransactionRow,
  type WalletRow
} from "./checkinCommandSupport.js";

export type CheckInCommandInput = {
  habitId: string;
  date: string;
  value: number | null;
  note: string | null;
  timezoneOffsetMinutes: number;
};


async function ensureWallet(db: CommandDb, spaceId: string): Promise<void> {
  await db.query(
    `INSERT INTO xp_wallet (space_id, balance, lifetime_earned, lifetime_spent, updated_at)
     VALUES ($1, 0, 0, 0, now()) ON CONFLICT (space_id) DO NOTHING`,
    [spaceId]
  );
}

const TX_RETURNING = `id, unique_key, amount, type, reason, habit_id, check_in_id,
  reward_id, redemption_id, date_key, created_at`;

async function insertAward(
  options: {
    db: CommandDb;
    spaceId: string;
    checkInId: string;
    habitId: string;
    date: string;
    award: { uniqueKey: string; amount: number; reason: string };
  }
): Promise<TransactionRow | null> {
  const { db, spaceId, checkInId, habitId, date, award } = options;
  const inserted = await db.query<TransactionRow>(
    `INSERT INTO xp_transactions
       (id, space_id, unique_key, amount, type, reason, habit_id, check_in_id, date_key, created_at)
     VALUES ($1, $2, $3, $4, 'earn', $5, $6, $7, $8, now())
     ON CONFLICT (space_id, unique_key) DO NOTHING RETURNING ${TX_RETURNING}`,
    [randomUUID(), spaceId, award.uniqueKey, award.amount, award.reason, habitId, checkInId, date]
  );
  if (inserted.rows[0]) return inserted.rows[0];

  const undone = await db.query(
    `SELECT 1 FROM xp_transactions WHERE space_id = $1 AND unique_key LIKE $2 LIMIT 1`,
    [spaceId, `checkin_undo:${award.uniqueKey}:%`]
  );
  if (!undone.rowCount) return null;
  const redoKey = `checkin_redo:${award.uniqueKey}:${checkInId}`;
  const redo = await db.query<TransactionRow>(
    `INSERT INTO xp_transactions
       (id, space_id, unique_key, amount, type, reason, habit_id, check_in_id, date_key, created_at)
     VALUES ($1, $2, $3, $4, 'earn', $5, $6, $7, $8, now())
     ON CONFLICT (space_id, unique_key) DO NOTHING RETURNING ${TX_RETURNING}`,
    [randomUUID(), spaceId, redoKey, award.amount, award.reason, habitId, checkInId, date]
  );
  return redo.rows[0] ?? null;
}

async function updateWalletForAwards(db: CommandDb, spaceId: string, amount: number): Promise<WalletRow> {
  const result = await db.query<WalletRow>(
    `UPDATE xp_wallet SET balance = balance + $2, lifetime_earned = lifetime_earned + $2,
       updated_at = now() WHERE space_id = $1
     RETURNING balance, lifetime_earned, lifetime_spent, updated_at`,
    [spaceId, amount]
  );
  if (!result.rows[0]) throw new Error("XP 钱包不存在");
  return result.rows[0];
}

function commandError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

async function loadCompletableHabit(
  db: CommandDb,
  spaceId: string,
  input: CheckInCommandInput
): Promise<HabitRow> {
  const result = await db.query<HabitRow>(
    `SELECT id, name, frequency_json, created_at, is_paused, track_type
     FROM habits WHERE id = $1 AND space_id = $2`,
    [input.habitId, spaceId]
  );
  const habit = result.rows[0];
  if (!habit) throw commandError("习惯不存在", 404);
  if (habit.is_paused) throw commandError("习惯已暂停", 409);
  if (!isScheduled(parseFrequency(habit.frequency_json), input.date)) {
    throw commandError("当天不是该习惯的计划日", 409);
  }
  if (habit.track_type === "numeric" && (input.value === null || input.value <= 0)) {
    throw commandError("数值习惯需要大于 0 的完成值", 400);
  }
  if (habit.track_type !== "numeric" && input.value !== null) {
    throw commandError("完成型习惯不接受数值", 400);
  }
  return habit;
}

async function upsertCheckIn(
  options: { db: CommandDb; spaceId: string; accountId: string; habitId: string; input: CheckInCommandInput }
): Promise<CheckInRow> {
  const { db, spaceId, accountId, habitId, input } = options;
  const result = await db.query<CheckInRow>(
    `INSERT INTO check_ins
       (id, space_id, habit_id, date, status, value, note, created_by, created_at)
     VALUES ($1, $2, $3, $4, 'completed', $5, $6, $7, now())
     ON CONFLICT (habit_id, date) DO UPDATE SET
       status = 'completed', value = excluded.value, note = excluded.note
     WHERE check_ins.space_id = excluded.space_id
     RETURNING id, habit_id, date, status, value, note, created_by, created_at`,
    [randomUUID(), spaceId, habitId, input.date, input.value, input.note, accountId]
  );
  if (!result.rows[0]) throw commandError("无权修改该打卡", 403);
  return result.rows[0];
}

async function definitionsForCheckIn(
  options: { db: CommandDb; spaceId: string; habit: HabitRow; date: string }
) {
  const { db, spaceId, habit, date } = options;
  const completedRows = await db.query<{ date: string }>(
    `SELECT date FROM check_ins WHERE space_id = $1 AND habit_id = $2 AND status = 'completed'`,
    [spaceId, habit.id]
  );
  const completed = new Set(completedRows.rows.map((row) => row.date));
  const streak = streakFor(habit, date, completed);
  const plan = await db.query<{ id: string }>(
    `SELECT id FROM habit_plans WHERE space_id = $1 AND habit_id = $2 AND end_date <= $3
     ORDER BY end_date DESC LIMIT 1`,
    [spaceId, habit.id, date]
  );
  return { definitions: awardDefinitions({ habit, date, streak, planId: plan.rows[0]?.id ?? null }), streak };
}

async function applyAwards(
  options: {
    db: CommandDb;
    spaceId: string;
    habitId: string;
    checkInId: string;
    date: string;
    definitions: ReturnType<typeof awardDefinitions>;
  }
) {
  const { db, spaceId, habitId, checkInId, date, definitions } = options;
  await ensureWallet(db, spaceId);
  const inserted: TransactionRow[] = [];
  for (const award of definitions) {
    const row = await insertAward({ db, spaceId, checkInId, habitId, date, award });
    if (row) inserted.push(row);
  }
  const earned = inserted.reduce((sum, row) => sum + row.amount, 0);
  const wallet = earned > 0
    ? await updateWalletForAwards(db, spaceId, earned)
    : (await db.query<WalletRow>(
      `SELECT balance, lifetime_earned, lifetime_spent, updated_at FROM xp_wallet WHERE space_id = $1`,
      [spaceId]
    )).rows[0];
  if (!wallet) throw new Error("XP 钱包不存在");
  return { earned, inserted, wallet };
}

export async function completeCheckInInTransaction(
  options: { db: CommandDb; spaceId: string; accountId: string; input: CheckInCommandInput; now?: Date }
) {
  const { db, spaceId, accountId, input, now = new Date() } = options;
  if (input.date !== localDateKey(now, input.timezoneOffsetMinutes)) {
    throw commandError("只能完成今天的打卡", 400);
  }
  const habit = await loadCompletableHabit(db, spaceId, input);
  const checkIn = await upsertCheckIn({ db, spaceId, accountId, habitId: habit.id, input });
  const { definitions, streak } = await definitionsForCheckIn({ db, spaceId, habit, date: input.date });
  const { earned, inserted, wallet } = await applyAwards({
    db, spaceId, habitId: habit.id, checkInId: checkIn.id, date: input.date, definitions
  });

  return {
    checkIn: mapCheckIn(checkIn),
    awards: definitions.map((award) => ({
      uniqueKey: award.uniqueKey,
      amount: award.amount,
      reason: award.reason,
      label: AWARD_LABELS[award.reason]
    })),
    insertedTransactions: inserted.map(mapTransaction),
    wallet: mapWallet(wallet),
    earnedDelta: earned,
    streak
  };
}

export function localDateKey(now: Date, offsetMinutes: number): string {
  return new Date(now.getTime() - offsetMinutes * 60_000).toISOString().slice(0, 10);
}

const UNDO_REASONS = ["checkin", "streak_3", "streak_7", "plan_complete", "return_bonus"];

async function loadUndoableCheckIn(
  options: { db: CommandDb; spaceId: string; input: { habitId: string; date: string; checkInId: string }; now: Date }
): Promise<CheckInRow> {
  const { db, spaceId, input, now } = options;
  const found = await db.query<CheckInRow>(
    `SELECT id, habit_id, date, status, value, note, created_by, created_at
     FROM check_ins WHERE id = $1 AND space_id = $2 AND habit_id = $3 AND date = $4 FOR UPDATE`,
    [input.checkInId, spaceId, input.habitId, input.date]
  );
  const checkIn = found.rows[0];
  if (!checkIn) throw commandError("打卡记录不存在", 404);
  const elapsed = now.getTime() - new Date(checkIn.created_at).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 60_000) {
    throw commandError("撤销时间已超过 60 秒", 409);
  }
  return checkIn;
}

async function insertUndoTransactions(
  options: {
    db: CommandDb;
    spaceId: string;
    input: { habitId: string; date: string; checkInId: string };
    targets: TransactionRow[];
  }
): Promise<TransactionRow[]> {
  const { db, spaceId, input, targets } = options;
  const inserted: TransactionRow[] = [];
  for (const target of targets) {
    const reversed = await db.query<TransactionRow>(
      `INSERT INTO xp_transactions
         (id, space_id, unique_key, amount, type, reason, habit_id, check_in_id, date_key, created_at)
       VALUES ($1, $2, $3, $4, 'adjust', 'checkin_undo', $5, $6, $7, now())
       ON CONFLICT (space_id, unique_key) DO NOTHING RETURNING ${TX_RETURNING}`,
      [randomUUID(), spaceId, `checkin_undo:${target.unique_key}:${input.checkInId}`,
        -target.amount, input.habitId, input.checkInId, input.date]
    );
    if (reversed.rows[0]) inserted.push(reversed.rows[0]);
  }
  return inserted;
}

export async function undoCheckInInTransaction(
  options: {
    db: CommandDb;
    spaceId: string;
    input: { habitId: string; date: string; checkInId: string };
    now?: Date;
  }
) {
  const { db, spaceId, input, now = new Date() } = options;
  const checkIn = await loadUndoableCheckIn({ db, spaceId, input, now });
  const targets = await db.query<TransactionRow>(
    `SELECT ${TX_RETURNING} FROM xp_transactions
     WHERE space_id = $1 AND habit_id = $2 AND date_key = $3 AND check_in_id = $4
       AND amount > 0 AND reason = ANY($5::text[])`,
    [spaceId, input.habitId, input.date, input.checkInId, UNDO_REASONS]
  );
  await db.query(`DELETE FROM check_ins WHERE id = $1 AND space_id = $2`, [input.checkInId, spaceId]);
  await ensureWallet(db, spaceId);
  const inserted = await insertUndoTransactions({ db, spaceId, input, targets: targets.rows });
  const reversedAmount = inserted.reduce((sum, row) => sum + Math.abs(row.amount), 0);
  const wallet = await db.query<WalletRow>(
    `UPDATE xp_wallet SET balance = balance - $2, lifetime_spent = lifetime_spent + $2,
       updated_at = now() WHERE space_id = $1 AND balance >= $2
     RETURNING balance, lifetime_earned, lifetime_spent, updated_at`,
    [spaceId, reversedAmount]
  );
  if (!wallet.rows[0]) throw commandError("本次获得的 XP 已使用，无法撤销", 409);
  return {
    removed: mapCheckIn(checkIn),
    reversedAmount,
    insertedTransactions: inserted.map(mapTransaction),
    wallet: mapWallet(wallet.rows[0])
  };
}
