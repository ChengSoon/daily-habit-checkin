import {
  AdventureProgressSnapshot,
  claimStationReward,
  insertPointTransactions,
  readAdventurePointState,
  readTotalAdventurePoints,
  reverseStationReward,
  upsertAdventureProgress,
  type AdventureStationReward
} from "./adventureRepository.js";
import { ensureAdventureCampaign } from "./adventureCampaignRepository.js";
import {
  calculateAdventurePointAwardMutations,
  calculateAdventurePointRevocations,
  calculateAdventureProgress,
  getCrossedStations,
  type AdventureCampaign
} from "./adventureRules.js";
import { applyAdventureXpTransaction, type AdventureXpTransaction } from "./adventureWalletRepository.js";

type QueryClient = {
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
};

type AdventureActionInput = {
  habitId: string;
  dateKey: string;
  checkInId: string;
};

type HabitFrequency =
  | { type: "daily" }
  | { type: "weekdays" }
  | { type: "weekly"; daysOfWeek: number[] };

type HabitRow = { id: string; frequencyJson: string };

export class AdventureActionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "AdventureActionError";
  }
}

function parseFrequency(value: string): HabitFrequency | null {
  try {
    const parsed = JSON.parse(value) as Partial<HabitFrequency>;
    if (parsed.type === "daily" || parsed.type === "weekdays") return { type: parsed.type };
    if (parsed.type === "weekly" && Array.isArray(parsed.daysOfWeek)) {
      return { type: "weekly", daysOfWeek: parsed.daysOfWeek.filter((day): day is number => typeof day === "number") };
    }
  } catch {
    return null;
  }
  return null;
}

function shouldRunOnDate(frequency: HabitFrequency, dateKey: string): boolean {
  const day = new Date(`${dateKey}T00:00:00`).getDay();
  if (frequency.type === "daily") return true;
  if (frequency.type === "weekdays") return day >= 1 && day <= 5;
  return frequency.daysOfWeek.includes(day);
}

async function shouldAwardAllDone(client: QueryClient, spaceId: string, dateKey: string): Promise<boolean> {
  const habitsResult = await client.query(
    `SELECT id, frequency_json AS "frequencyJson"
     FROM habits
     WHERE space_id = $1 AND is_paused = false`,
    [spaceId]
  );
  const scheduled = (habitsResult.rows as HabitRow[])
    .filter((habit) => {
      const frequency = parseFrequency(habit.frequencyJson);
      return frequency ? shouldRunOnDate(frequency, dateKey) : false;
    })
    .map((habit) => habit.id);
  if (scheduled.length === 0) return false;

  const completedResult = await client.query(
    `SELECT habit_id AS "habitId"
     FROM check_ins
     WHERE space_id = $1 AND date = $2 AND status = 'completed'`,
    [spaceId, dateKey]
  );
  const completed = new Set(completedResult.rows.map((row) => row.habitId as string));
  return scheduled.every((habitId) => completed.has(habitId));
}

async function assertCompletedCheckIn(
  client: QueryClient,
  spaceId: string,
  input: AdventureActionInput
): Promise<void> {
  const result = await client.query(
    `SELECT id
     FROM check_ins
     WHERE space_id = $1 AND id = $2 AND habit_id = $3
       AND date = $4 AND status = 'completed'`,
    [spaceId, input.checkInId, input.habitId, input.dateKey]
  );
  if (result.rows.length === 0) {
    throw new AdventureActionError("打卡记录不存在或已撤销", 409);
  }
}

function progressInput(campaign: AdventureCampaign, totalPoints: number) {
  const progress = calculateAdventureProgress(campaign, totalPoints);
  return {
    campaignId: progress.campaignId,
    chapterId: progress.chapterId,
    totalPoints: progress.totalPoints,
    currentStationId: progress.currentStationId,
    nextStationId: progress.nextStationId,
    segmentPoints: progress.segmentPoints
  };
}

export async function awardAdventureAction(
  client: QueryClient,
  spaceId: string,
  accountId: string | null,
  input: AdventureActionInput
) {
  const campaign = await ensureAdventureCampaign(client, spaceId);
  await assertCompletedCheckIn(client, spaceId, input);
  const beforeTotal = await readTotalAdventurePoints(client, spaceId);
  const [allDone, pointState] = await Promise.all([
    shouldAwardAllDone(client, spaceId, input.dateKey),
    readAdventurePointState(client, spaceId, input.habitId, input.dateKey)
  ]);
  const insertedPoints = await insertPointTransactions(
    client,
    spaceId,
    accountId,
    calculateAdventurePointAwardMutations({ ...input, shouldAwardAllDone: allDone, ...pointState })
  );
  const afterTotal = insertedPoints.length > 0 ? await readTotalAdventurePoints(client, spaceId) : beforeTotal;
  const progress: AdventureProgressSnapshot = await upsertAdventureProgress(
    client,
    spaceId,
    progressInput(campaign, afterTotal)
  );
  const reachedStations = getCrossedStations(campaign, beforeTotal, afterTotal);
  const sourceKey = insertedPoints.at(-1)?.uniqueKey ?? null;
  const stationRewards: AdventureStationReward[] = [];
  const stationXp: AdventureXpTransaction[] = [];
  if (!sourceKey) return { insertedPoints, progress, stationRewards, stationXp };

  for (const station of reachedStations) {
    const xpKey = `adventure_station:${campaign.id}:${station.id}:${sourceKey}`;
    const claimed = await claimStationReward(client, spaceId, { stationId: station.id, xpTransactionKey: xpKey });
    if (!claimed) continue;
    stationRewards.push(claimed);
    if (!station.reward.xpEnabled || station.reward.xp <= 0) continue;
    const xp = await applyAdventureXpTransaction(client, spaceId, {
      uniqueKey: xpKey,
      amount: station.reward.xp,
      type: "earn",
      reason: "adventure_station",
      checkInId: input.checkInId,
      dateKey: input.dateKey
    });
    if (xp) stationXp.push(xp);
  }
  return { insertedPoints, progress, stationRewards, stationXp };
}

export async function revokeAdventureAction(
  client: QueryClient,
  spaceId: string,
  accountId: string | null,
  input: AdventureActionInput
) {
  const campaign = await ensureAdventureCampaign(client, spaceId);
  const beforeTotal = await readTotalAdventurePoints(client, spaceId);
  const pointState = await readAdventurePointState(client, spaceId, input.habitId, input.dateKey);
  const insertedPoints = await insertPointTransactions(
    client,
    spaceId,
    accountId,
    calculateAdventurePointRevocations({ ...input, checkInBalance: pointState.checkInBalance, allDoneBalance: pointState.allDoneBalance })
  );
  const afterTotal = insertedPoints.length > 0 ? await readTotalAdventurePoints(client, spaceId) : beforeTotal;
  const progress: AdventureProgressSnapshot = await upsertAdventureProgress(
    client,
    spaceId,
    progressInput(campaign, afterTotal)
  );
  const lostStations = getCrossedStations(campaign, beforeTotal, afterTotal);
  const sourceKey = insertedPoints.at(-1)?.uniqueKey ?? null;
  const stationRewards: AdventureStationReward[] = [];
  const stationXp: AdventureXpTransaction[] = [];
  if (!sourceKey) return { insertedPoints, progress, stationRewards, stationXp };

  for (const station of lostStations) {
    const reversed = await reverseStationReward(client, spaceId, station.id);
    if (!reversed) continue;
    stationRewards.push(reversed);
    if (!station.reward.xpEnabled || station.reward.xp <= 0) continue;
    const xp = await applyAdventureXpTransaction(client, spaceId, {
      uniqueKey: `adventure_station_undo:${campaign.id}:${station.id}:${sourceKey}`,
      amount: -station.reward.xp,
      type: "adjust",
      reason: "adventure_station_undo",
      checkInId: input.checkInId,
      dateKey: input.dateKey
    });
    if (xp) stationXp.push(xp);
  }
  return { insertedPoints, progress, stationRewards, stationXp };
}
