import type { QueryResult, QueryResultRow } from "pg";
import { getPool, withTransaction } from "../db/pool.js";
import {
  evaluateDeliveryPolicy,
  deliveryDateKey,
  nextBondState,
  type BondStage,
  type DeliveryCategory,
  type MemberDeliveryState
} from "./companionPolicy.js";

export type ProactiveMode = "off" | "restrained" | "balanced";
export type CompanionStateDb = {
  query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<T>>;
};

type TransactionRunner = <T>(run: (client: CompanionStateDb) => Promise<T>) => Promise<T>;
type StateRepositoryOptions = { db?: CompanionStateDb; transact?: TransactionRunner };

type MemberStateRow = {
  pet_visible: boolean;
  proactive_mode: ProactiveMode;
  delivery_date: string | null;
  ordinary_count: number;
  last_ordinary_at: string | Date | null;
  recent_fingerprints: Record<string, string> | string;
  last_active_at: string | Date | null;
};

export type MemberCompanionState = MemberDeliveryState & {
  petVisible: boolean;
  proactiveMode: ProactiveMode;
  lastActiveAt: string | null;
};

export type BondState = { points: number; stage: BondStage };

function defaultTransaction<T>(run: (client: CompanionStateDb) => Promise<T>): Promise<T> {
  return withTransaction((client) => run(client as CompanionStateDb));
}

function iso(value: string | Date | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function fingerprints(value: MemberStateRow["recent_fingerprints"]): Record<string, string> {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value) as Record<string, string>;
  } catch {
    return {};
  }
}

function mapMemberState(row: MemberStateRow): MemberCompanionState {
  return {
    petVisible: row.pet_visible,
    proactiveMode: row.proactive_mode,
    deliveryDate: row.delivery_date ?? "",
    ordinaryCount: row.ordinary_count,
    lastOrdinaryAt: iso(row.last_ordinary_at),
    recentFingerprints: fingerprints(row.recent_fingerprints),
    lastActiveAt: iso(row.last_active_at)
  };
}

async function ensureMemberState(db: CompanionStateDb, spaceId: string, accountId: string) {
  await db.query(
    `INSERT INTO companion_member_state (space_id, account_id)
     VALUES ($1, $2) ON CONFLICT (space_id, account_id) DO NOTHING`,
    [spaceId, accountId]
  );
}

type ReserveInput = {
  spaceId: string;
  accountId: string;
  category: DeliveryCategory;
  fingerprint: string;
  now: Date;
  timezoneOffsetMinutes?: number;
};

async function reserveLocked(client: CompanionStateDb, input: ReserveInput) {
  await ensureMemberState(client, input.spaceId, input.accountId);
  const selected = await client.query<MemberStateRow>(
    `SELECT pet_visible, proactive_mode, delivery_date, ordinary_count,
            last_ordinary_at, recent_fingerprints, last_active_at
     FROM companion_member_state WHERE space_id = $1 AND account_id = $2 FOR UPDATE`,
    [input.spaceId, input.accountId]
  );
  const current = mapMemberState(selected.rows[0]);
  const dayKey = deliveryDateKey(input.now, input.timezoneOffsetMinutes);
  const currentCount = current.deliveryDate === dayKey ? current.ordinaryCount : 0;
  if (input.category !== "requested" && current.proactiveMode === "off") {
    return { allowed: false as const, reason: "disabled" as const };
  }
  if (input.category === "ordinary" && current.proactiveMode === "restrained" && currentCount >= 1) {
    return { allowed: false as const, reason: "daily_cap" as const };
  }
  const result = evaluateDeliveryPolicy({
    category: input.category, fingerprint: input.fingerprint, current, now: input.now
  });
  if (!result.allowed || result.next === current) return result;
  await client.query(
    `UPDATE companion_member_state SET delivery_date = $3, ordinary_count = $4,
       last_ordinary_at = $5, recent_fingerprints = $6::jsonb, updated_at = now()
     WHERE space_id = $1 AND account_id = $2`,
    [input.spaceId, input.accountId, result.next.deliveryDate, result.next.ordinaryCount,
      result.next.lastOrdinaryAt, JSON.stringify(result.next.recentFingerprints)]
  );
  return result;
}

async function getMemberState(db: CompanionStateDb, spaceId: string, accountId: string) {
  await ensureMemberState(db, spaceId, accountId);
  const selected = await db.query<MemberStateRow>(
    `SELECT pet_visible, proactive_mode, delivery_date, ordinary_count,
            last_ordinary_at, recent_fingerprints, last_active_at
     FROM companion_member_state WHERE space_id = $1 AND account_id = $2`, [spaceId, accountId]
  );
  return mapMemberState(selected.rows[0]);
}

async function updateMemberPreferences(db: CompanionStateDb, options: {
  spaceId: string; accountId: string; preferences: { petVisible: boolean; proactiveMode: ProactiveMode };
}) {
  const { spaceId, accountId, preferences } = options;
  await db.query(
    `INSERT INTO companion_member_state (space_id, account_id, pet_visible, proactive_mode)
     VALUES ($1, $2, $3, $4) ON CONFLICT (space_id, account_id) DO UPDATE SET
       pet_visible = excluded.pet_visible, proactive_mode = excluded.proactive_mode, updated_at = now()`,
    [spaceId, accountId, preferences.petVisible, preferences.proactiveMode]
  );
}

async function awardBondLocked(client: CompanionStateDb, options: {
  spaceId: string; sourceKey: string; points: number;
}) {
  const { spaceId, sourceKey, points } = options;
  const inserted = await client.query<{ source_key: string }>(
    `INSERT INTO companion_bond_events (space_id, source_key, points) VALUES ($1, $2, $3)
     ON CONFLICT (space_id, source_key) DO NOTHING RETURNING source_key`, [spaceId, sourceKey, points]
  );
  await client.query(
    "INSERT INTO companion_space_state (space_id) VALUES ($1) ON CONFLICT (space_id) DO NOTHING", [spaceId]
  );
  const selected = await client.query<{ bond_points: number; bond_stage: BondStage }>(
    "SELECT bond_points, bond_stage FROM companion_space_state WHERE space_id = $1 FOR UPDATE", [spaceId]
  );
  const current = selected.rows[0] ?? { bond_points: 0, bond_stage: "first_meeting" as const };
  const next = nextBondState({ points: current.bond_points, seenSource: inserted.rows.length === 0 }, points);
  if (!next.awarded) return next;
  await client.query(
    `UPDATE companion_space_state SET bond_points = $2, bond_stage = $3, updated_at = now() WHERE space_id = $1`,
    [spaceId, next.points, next.stage]
  );
  return next;
}

async function getBondState(db: CompanionStateDb, spaceId: string): Promise<BondState> {
  await db.query(
    "INSERT INTO companion_space_state (space_id) VALUES ($1) ON CONFLICT (space_id) DO NOTHING", [spaceId]
  );
  const result = await db.query<{ bond_points: number; bond_stage: BondStage }>(
    "SELECT bond_points, bond_stage FROM companion_space_state WHERE space_id = $1", [spaceId]
  );
  return { points: result.rows[0]?.bond_points ?? 0, stage: result.rows[0]?.bond_stage ?? "first_meeting" };
}

export function createCompanionStateRepository(options: StateRepositoryOptions = {}) {
  const db = options.db ?? (getPool() as CompanionStateDb);
  const transact = options.transact ?? defaultTransaction;

  return {
    reserveDelivery: (input: ReserveInput) => transact((client) => reserveLocked(client, input)),
    getMemberState: (spaceId: string, accountId: string) => getMemberState(db, spaceId, accountId),
    updateMemberPreferences: (spaceId: string, accountId: string,
      preferences: { petVisible: boolean; proactiveMode: ProactiveMode }) =>
      updateMemberPreferences(db, { spaceId, accountId, preferences }),
    awardBond: (spaceId: string, sourceKey: string, points: number) =>
      transact((client) => awardBondLocked(client, { spaceId, sourceKey, points })),
    getBondState: (spaceId: string) => getBondState(db, spaceId),
    async clearConversationSummary(spaceId: string): Promise<void> {
      await db.query(
        `UPDATE companion_space_state SET conversation_summary = NULL, updated_at = now()
         WHERE space_id = $1`,
        [spaceId]
      );
    }
  };
}

export type CompanionStateRepository = ReturnType<typeof createCompanionStateRepository>;
