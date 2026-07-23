import { getPool } from "../db/pool.js";
import {
  createCompanionRepository,
  type CompanionDb,
  type CompanionMemory,
  type CompanionMessage,
  type CompanionRepository
} from "./companionRepository.js";
import {
  createCompanionStateRepository,
  type BondState,
  type CompanionStateRepository
} from "./companionStateRepository.js";

type HabitFrequency =
  | { type: "daily" }
  | { type: "weekdays" }
  | { type: "weekly"; daysOfWeek: number[] };

type SourceMember = { id: string; displayName: string; [key: string]: unknown };
type SourceHabit = {
  id: string;
  name: string;
  frequency: HabitFrequency;
  createdAt: string;
  [key: string]: unknown;
};
type ManageableHabit = SourceHabit & {
  isPaused: boolean;
  reminderTime: string | null;
  trackType: "check" | "numeric";
  numericUnit: string | null;
};
type SourceCheckIn = {
  habitId: string;
  date: string;
  status: string;
  createdBy: string | null;
  [key: string]: unknown;
};

export type CompanionContextSource = {
  listMembers(spaceId: string): Promise<SourceMember[]>;
  listActiveHabits(spaceId: string): Promise<SourceHabit[]>;
  listManageableHabits?(spaceId: string): Promise<ManageableHabit[]>;
  listCheckIns(spaceId: string, fromDate: string, toDate: string): Promise<SourceCheckIn[]>;
  listRecentMessages(spaceId: string, limit: number): Promise<CompanionMessage[]>;
  listMemories(spaceId: string): Promise<CompanionMemory[]>;
  getBondState(spaceId: string): Promise<BondState>;
};

export type CompanionContext = {
  currentMemberName: string;
  partnerNames: string[];
  today: { dateKey: string; due: number; completed: number };
  lastSevenDays: { due: number; completed: number; completionRate: number };
  activeHabits: Array<{ id: string; name: string }>;
  manageableHabits?: Array<{
    id: string;
    name: string;
    isPaused: boolean;
    frequency: HabitFrequency;
    reminderTime: string | null;
    trackType: "check" | "numeric";
    numericUnit: string | null;
    completedToday: boolean;
  }>;
  recentMessages: Array<{ role: "user" | "assistant"; content: string; senderName: string | null }>;
  memories: Array<{ category: CompanionMemory["category"]; content: string }>;
  bond: BondState;
};

function localDateKey(value: Date, timezoneOffsetMinutes: number): string {
  return new Date(value.getTime() - timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
}

function shiftDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function habitRunsOn(habit: SourceHabit, dateKey: string): boolean {
  if (dateKey < habit.createdAt.slice(0, 10)) return false;
  const day = new Date(`${dateKey}T00:00:00.000Z`).getUTCDay();
  if (habit.frequency.type === "daily") return true;
  if (habit.frequency.type === "weekdays") return day >= 1 && day <= 5;
  return habit.frequency.daysOfWeek.includes(day);
}

type ContextData = {
  members: SourceMember[];
  habits: SourceHabit[];
  checkIns: SourceCheckIn[];
  messages: CompanionMessage[];
  memories: CompanionMemory[];
  bond: BondState;
  manageableHabits: ManageableHabit[];
};

async function loadContextData(input: {
  source: CompanionContextSource;
  spaceId: string;
  dateKeys: string[];
  today: string;
}): Promise<ContextData> {
  const { source, spaceId, dateKeys, today } = input;
  const [members, habits, checkIns, messages, memories, bond, manageableHabits] = await Promise.all([
    source.listMembers(spaceId), source.listActiveHabits(spaceId), source.listCheckIns(spaceId, dateKeys[0], today),
    source.listRecentMessages(spaceId, 12), source.listMemories(spaceId), source.getBondState(spaceId),
    source.listManageableHabits?.(spaceId) ?? Promise.resolve([])
  ]);
  return { members, habits, checkIns, messages, memories, bond, manageableHabits };
}

function completionSet(checkIns: SourceCheckIn[]) {
  return new Set(checkIns.filter((checkIn) => checkIn.status === "completed")
    .map((checkIn) => `${checkIn.habitId}:${checkIn.date}`));
}

function buildContextSummary(input: {
  accountId: string;
  today: string;
  dateKeys: string[];
  data: ContextData;
}): CompanionContext {
  const { accountId, today, dateKeys, data } = input;
  const completed = completionSet(data.checkIns);
  const counts = dateKeys.reduce((total, dateKey) => {
    for (const habit of data.habits) {
      if (!habitRunsOn(habit, dateKey)) continue;
      total.due += 1;
      if (completed.has(`${habit.id}:${dateKey}`)) total.completed += 1;
    }
    return total;
  }, { due: 0, completed: 0 });
  const dueToday = data.habits.filter((habit) => habitRunsOn(habit, today));
  const current = data.members.find((member) => member.id === accountId);
  return {
    currentMemberName: current?.displayName ?? "你",
    partnerNames: data.members.filter((member) => member.id !== accountId).map((member) => member.displayName),
    today: { dateKey: today, due: dueToday.length,
      completed: dueToday.filter((habit) => completed.has(`${habit.id}:${today}`)).length },
    lastSevenDays: { ...counts, completionRate: counts.due === 0 ? 0 : Math.round((counts.completed / counts.due) * 100) },
    activeHabits: data.habits.slice(0, 12).map((habit) => ({ id: habit.id, name: habit.name })),
    manageableHabits: data.manageableHabits.slice(0, 24).map((habit) => ({ ...habit,
      completedToday: completed.has(`${habit.id}:${today}`) })),
    recentMessages: data.messages.slice(-12).map((message) => ({
      role: message.role, content: message.content, senderName: message.senderName
    })),
    memories: data.memories.map((memory) => ({ category: memory.category, content: memory.content })),
    bond: data.bond
  };
}

export async function buildCompanionContext(input: {
  source: CompanionContextSource;
  spaceId: string;
  accountId: string;
  now: Date;
  timezoneOffsetMinutes: number;
}): Promise<CompanionContext> {
  const today = localDateKey(input.now, input.timezoneOffsetMinutes);
  const dateKeys = Array.from({ length: 7 }, (_, index) => shiftDateKey(today, index - 6));
  const data = await loadContextData({ source: input.source, spaceId: input.spaceId, dateKeys, today });
  return buildContextSummary({ accountId: input.accountId, today, dateKeys, data });
}

function parseFrequency(raw: unknown): HabitFrequency {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (value && typeof value === "object" && "type" in value) return value as HabitFrequency;
  } catch {
    // Invalid legacy rows are treated as daily rather than exposing raw data to the model.
  }
  return { type: "daily" };
}

function listMembers(db: CompanionDb, spaceId: string) {
  return db.query<{ id: string; display_name: string }>(
    "SELECT id, display_name FROM accounts WHERE space_id = $1 ORDER BY created_at ASC", [spaceId]
  ).then((result) => result.rows.map((row) => ({ id: row.id, displayName: row.display_name })));
}

function listActiveHabits(db: CompanionDb, spaceId: string) {
  return db.query<{ id: string; name: string; frequency_json: string; created_at: string | Date }>(
    `SELECT id, name, frequency_json, created_at FROM habits
     WHERE space_id = $1 AND is_paused = false ORDER BY sort_order ASC`, [spaceId]
  ).then((result) => result.rows.map((row) => ({ id: row.id, name: row.name,
    frequency: parseFrequency(row.frequency_json), createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at) })));
}

function listManageableHabits(db: CompanionDb, spaceId: string): Promise<ManageableHabit[]> {
  return db.query<{
    id: string; name: string; frequency_json: string; created_at: string | Date; is_paused: boolean;
    reminder_time: string | null; track_type: string; numeric_unit: string | null;
  }>(`SELECT id, name, frequency_json, created_at, is_paused, reminder_time, track_type, numeric_unit
      FROM habits WHERE space_id = $1 ORDER BY sort_order ASC, created_at ASC`, [spaceId]).then((result) =>
    result.rows.map((row) => ({ id: row.id, name: row.name, frequency: parseFrequency(row.frequency_json),
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      isPaused: row.is_paused, reminderTime: row.reminder_time,
      trackType: row.track_type === "numeric" ? "numeric" : "check", numericUnit: row.numeric_unit }))
  );
}

function listCheckIns(db: CompanionDb, options: { spaceId: string; fromDate: string; toDate: string }) {
  const { spaceId, fromDate, toDate } = options;
  return db.query<{ habit_id: string; date: string; status: string; created_by: string | null }>(
    `SELECT habit_id, date, status, created_by FROM check_ins
     WHERE space_id = $1 AND date >= $2 AND date <= $3`, [spaceId, fromDate, toDate]
  ).then((result) => result.rows.map((row) => ({ habitId: row.habit_id, date: row.date,
    status: row.status, createdBy: row.created_by })));
}

export function createSqlCompanionContextSource(options: {
  db?: CompanionDb;
  repository?: Pick<CompanionRepository, "listRecentMessages" | "listMemories">;
  stateRepository?: CompanionStateRepository;
} = {}): CompanionContextSource {
  const db = options.db ?? (getPool() as CompanionDb);
  const repository = options.repository ?? createCompanionRepository({ db });
  const stateRepository = options.stateRepository ?? createCompanionStateRepository({ db });
  return {
    listMembers: (spaceId) => listMembers(db, spaceId),
    listActiveHabits: (spaceId) => listActiveHabits(db, spaceId),
    listManageableHabits: (spaceId) => listManageableHabits(db, spaceId),
    listCheckIns: (spaceId, fromDate, toDate) => listCheckIns(db, { spaceId, fromDate, toDate }),
    listRecentMessages: (spaceId, limit) => repository.listRecentMessages(spaceId, limit),
    listMemories: (spaceId) => repository.listMemories(spaceId),
    getBondState: (spaceId) => stateRepository.getBondState(spaceId)
  };
}
