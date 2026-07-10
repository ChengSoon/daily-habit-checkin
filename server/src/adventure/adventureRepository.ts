import { randomUUID } from "node:crypto";

type QueryClient = {
  query(sql: string, params?: unknown[]): Promise<{ rows: unknown[] }>;
};

export type AdventurePointInput = {
  uniqueKey: string;
  amount: number;
  reason: "checkin" | "all_done" | "checkin_undo" | "all_done_undo";
  habitId: string | null;
  checkInId: string | null;
  dateKey: string;
};

export type AdventurePointTransaction = AdventurePointInput & {
  id: string;
  accountId: string | null;
  createdAt: string;
};

export type AdventurePointState = {
  checkInBalance: number;
  allDoneBalance: number;
  hasCheckInHistory: boolean;
  hasAllDoneHistory: boolean;
};

export type AdventureProgressInput = {
  campaignId: string;
  chapterId: string;
  totalPoints: number;
  currentStationId: string;
  nextStationId: string | null;
  segmentPoints: number;
};

export type AdventureProgressSnapshot = AdventureProgressInput & {
  updatedAt: string;
};

export type AdventureStationRewardInput = {
  stationId: string;
  xpTransactionKey: string | null;
};

export type AdventureStationReward = AdventureStationRewardInput & {
  id: string;
  claimedAt: string;
  reversedAt: string | null;
};

export async function insertPointTransactions(
  client: QueryClient,
  spaceId: string,
  accountId: string | null,
  transactions: AdventurePointInput[]
): Promise<AdventurePointTransaction[]> {
  const inserted: AdventurePointTransaction[] = [];

  for (const transaction of transactions) {
    const { rows } = await client.query(
      `INSERT INTO adventure_point_transactions (
         id, space_id, unique_key, amount, reason,
         habit_id, check_in_id, date_key, account_id, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
       ON CONFLICT (space_id, unique_key) DO NOTHING
       RETURNING id, unique_key AS "uniqueKey", amount, reason,
                 habit_id AS "habitId", check_in_id AS "checkInId",
                 date_key AS "dateKey", account_id AS "accountId",
                 created_at AS "createdAt"`,
      [
        randomUUID(),
        spaceId,
        transaction.uniqueKey,
        transaction.amount,
        transaction.reason,
        transaction.habitId,
        transaction.checkInId,
        transaction.dateKey,
        accountId
      ]
    );

    if (rows[0]) {
      inserted.push(rows[0] as AdventurePointTransaction);
    }
  }

  return inserted;
}

export async function readTotalAdventurePoints(client: QueryClient, spaceId: string): Promise<number> {
  const { rows } = await client.query(
    `SELECT COALESCE(SUM(amount), 0) AS total
     FROM adventure_point_transactions
     WHERE space_id = $1`,
    [spaceId]
  );
  return Number((rows[0] as { total?: string | number } | undefined)?.total ?? 0);
}

export async function readAdventurePointState(
  client: QueryClient,
  spaceId: string,
  habitId: string,
  dateKey: string
): Promise<AdventurePointState> {
  const { rows } = await client.query(
    `SELECT
       COALESCE(SUM(amount) FILTER (
         WHERE habit_id = $3 AND reason IN ('checkin', 'checkin_undo')
       ), 0) AS "checkInBalance",
       COALESCE(SUM(amount) FILTER (
         WHERE reason IN ('all_done', 'all_done_undo')
       ), 0) AS "allDoneBalance",
       COUNT(*) FILTER (
         WHERE habit_id = $3 AND reason IN ('checkin', 'checkin_undo')
       ) AS "checkInCount",
       COUNT(*) FILTER (
         WHERE reason IN ('all_done', 'all_done_undo')
       ) AS "allDoneCount"
     FROM adventure_point_transactions
     WHERE space_id = $1 AND date_key = $2`,
    [spaceId, dateKey, habitId]
  );
  const row = (rows[0] ?? {}) as Record<string, string | number | undefined>;

  return {
    checkInBalance: Number(row.checkInBalance ?? 0),
    allDoneBalance: Number(row.allDoneBalance ?? 0),
    hasCheckInHistory: Number(row.checkInCount ?? 0) > 0,
    hasAllDoneHistory: Number(row.allDoneCount ?? 0) > 0
  };
}

export async function readPointTransactionsByUniqueKeys(
  client: QueryClient,
  spaceId: string,
  uniqueKeys: string[]
): Promise<AdventurePointTransaction[]> {
  if (uniqueKeys.length === 0) {
    return [];
  }

  const { rows } = await client.query(
    `SELECT id, unique_key AS "uniqueKey", amount, reason,
            habit_id AS "habitId", check_in_id AS "checkInId",
            date_key AS "dateKey", account_id AS "accountId",
            created_at AS "createdAt"
     FROM adventure_point_transactions
     WHERE space_id = $1 AND unique_key = ANY($2)`,
    [spaceId, uniqueKeys]
  );
  return rows as AdventurePointTransaction[];
}

export async function upsertAdventureProgress(
  client: QueryClient,
  spaceId: string,
  progress: AdventureProgressInput
): Promise<AdventureProgressSnapshot> {
  const { rows } = await client.query(
    `INSERT INTO adventure_progress (
       space_id, campaign_id, chapter_id, total_points,
       current_station_id, next_station_id, segment_points, updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, now())
     ON CONFLICT (space_id) DO UPDATE SET
       campaign_id = excluded.campaign_id,
       chapter_id = excluded.chapter_id,
       total_points = excluded.total_points,
       current_station_id = excluded.current_station_id,
       next_station_id = excluded.next_station_id,
       segment_points = excluded.segment_points,
       updated_at = now()
     RETURNING campaign_id AS "campaignId", chapter_id AS "chapterId",
               total_points AS "totalPoints",
               current_station_id AS "currentStationId",
               next_station_id AS "nextStationId",
               segment_points AS "segmentPoints",
               updated_at AS "updatedAt"`,
    [
      spaceId,
      progress.campaignId,
      progress.chapterId,
      progress.totalPoints,
      progress.currentStationId,
      progress.nextStationId,
      progress.segmentPoints
    ]
  );

  return rows[0] as AdventureProgressSnapshot;
}

export async function getAdventureProgress(
  client: QueryClient,
  spaceId: string
): Promise<AdventureProgressSnapshot | null> {
  const { rows } = await client.query(
    `SELECT campaign_id AS "campaignId", chapter_id AS "chapterId",
            total_points AS "totalPoints",
            current_station_id AS "currentStationId",
            next_station_id AS "nextStationId",
            segment_points AS "segmentPoints",
            updated_at AS "updatedAt"
     FROM adventure_progress
     WHERE space_id = $1`,
    [spaceId]
  );
  return (rows[0] as AdventureProgressSnapshot | undefined) ?? null;
}

export async function claimStationReward(
  client: QueryClient,
  spaceId: string,
  reward: AdventureStationRewardInput
): Promise<AdventureStationReward | null> {
  const { rows } = await client.query(
    `INSERT INTO adventure_station_rewards (
       id, space_id, station_id, xp_transaction_key, claimed_at, reversed_at
     ) VALUES ($1, $2, $3, $4, now(), NULL)
     ON CONFLICT (space_id, station_id) DO UPDATE SET
       xp_transaction_key = excluded.xp_transaction_key,
       claimed_at = now(),
       reversed_at = NULL
     WHERE adventure_station_rewards.reversed_at IS NOT NULL
     RETURNING id, station_id AS "stationId",
               xp_transaction_key AS "xpTransactionKey",
               claimed_at AS "claimedAt",
               reversed_at AS "reversedAt"`,
    [randomUUID(), spaceId, reward.stationId, reward.xpTransactionKey]
  );
  return (rows[0] as AdventureStationReward | undefined) ?? null;
}

export async function listActiveStationRewards(
  client: QueryClient,
  spaceId: string
): Promise<AdventureStationReward[]> {
  const { rows } = await client.query(
    `SELECT id, station_id AS "stationId",
            xp_transaction_key AS "xpTransactionKey",
            claimed_at AS "claimedAt",
            reversed_at AS "reversedAt"
     FROM adventure_station_rewards
     WHERE space_id = $1 AND reversed_at IS NULL
     ORDER BY claimed_at ASC`,
    [spaceId]
  );
  return rows as AdventureStationReward[];
}

export async function reverseStationReward(
  client: QueryClient,
  spaceId: string,
  stationId: string
): Promise<AdventureStationReward | null> {
  const { rows } = await client.query(
    `UPDATE adventure_station_rewards
     SET reversed_at = now()
     WHERE space_id = $1 AND station_id = $2 AND reversed_at IS NULL
     RETURNING id, station_id AS "stationId",
               xp_transaction_key AS "xpTransactionKey",
               claimed_at AS "claimedAt",
               reversed_at AS "reversedAt"`,
    [spaceId, stationId]
  );
  return (rows[0] as AdventureStationReward | undefined) ?? null;
}
