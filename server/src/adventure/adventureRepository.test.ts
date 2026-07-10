import { describe, expect, it, vi } from "vitest";
import {
  claimStationReward,
  getAdventureProgress,
  insertPointTransactions,
  listActiveStationRewards,
  readAdventurePointState,
  readPointTransactionsByUniqueKeys,
  readTotalAdventurePoints,
  upsertAdventureProgress
} from "./adventureRepository.js";
import { applyAdventureXpTransaction } from "./adventureWalletRepository.js";

function mockClient(rowsByQuery: (sql: string, params?: unknown[]) => Record<string, unknown>[]) {
  return {
    query: vi.fn(async (sql: string, params?: unknown[]) => ({
      rows: rowsByQuery(sql, params),
      rowCount: rowsByQuery(sql, params).length
    }))
  };
}

describe("adventureRepository", () => {
  it("inserts point transactions idempotently and returns only newly inserted rows", async () => {
    const client = mockClient((sql) =>
      sql.includes("RETURNING")
        ? [
            {
              id: "tx-1",
              uniqueKey: "adventure:checkin:habit-1:2026-07-10",
              amount: 1,
              reason: "checkin",
              habitId: "habit-1",
              checkInId: "checkin-1",
              dateKey: "2026-07-10",
              accountId: "account-1",
              createdAt: "2026-07-10T00:00:00.000Z"
            }
          ]
        : []
    );

    const inserted = await insertPointTransactions(client, "space-1", "account-1", [
      {
        uniqueKey: "adventure:checkin:habit-1:2026-07-10",
        amount: 1,
        reason: "checkin",
        habitId: "habit-1",
        checkInId: "checkin-1",
        dateKey: "2026-07-10"
      }
    ]);

    expect(inserted).toHaveLength(1);
    expect(inserted[0].uniqueKey).toBe("adventure:checkin:habit-1:2026-07-10");
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT (space_id, unique_key) DO NOTHING"), [
      expect.any(String),
      "space-1",
      "adventure:checkin:habit-1:2026-07-10",
      1,
      "checkin",
      "habit-1",
      "checkin-1",
      "2026-07-10",
      "account-1"
    ]);
  });

  it("reads total adventure points from transaction amounts", async () => {
    const client = mockClient(() => [{ total: "7" }]);

    await expect(readTotalAdventurePoints(client, "space-1")).resolves.toBe(7);
  });

  it("reads point transactions by unique keys", async () => {
    const client = mockClient(() => [
      {
        uniqueKey: "adventure:checkin:habit-1:2026-07-10",
        amount: 1,
        reason: "checkin",
        habitId: "habit-1",
        checkInId: "checkin-1",
        dateKey: "2026-07-10"
      }
    ]);

    const rows = await readPointTransactionsByUniqueKeys(client, "space-1", [
      "adventure:checkin:habit-1:2026-07-10",
      "adventure:all_done:2026-07-10"
    ]);

    expect(rows.map((row) => row.uniqueKey)).toEqual(["adventure:checkin:habit-1:2026-07-10"]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("unique_key = ANY($2)"), [
      "space-1",
      ["adventure:checkin:habit-1:2026-07-10", "adventure:all_done:2026-07-10"]
    ]);
  });

  it("reads logical check-in and all-done balances for a date", async () => {
    const client = mockClient(() => [
      {
        checkInBalance: "0",
        allDoneBalance: "1",
        checkInCount: "2",
        allDoneCount: "1"
      }
    ]);

    await expect(
      readAdventurePointState(client, "space-1", "habit-1", "2026-07-10")
    ).resolves.toEqual({
      checkInBalance: 0,
      allDoneBalance: 1,
      hasCheckInHistory: true,
      hasAllDoneHistory: true
    });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("FILTER"), [
      "space-1",
      "2026-07-10",
      "habit-1"
    ]);
  });

  it("upserts and reads the adventure progress snapshot", async () => {
    const row = {
      campaignId: "star-coast",
      chapterId: "star-coast",
      totalPoints: 6,
      currentStationId: "moonlight-tower",
      nextStationId: "crystal-bridge",
      segmentPoints: 0,
      updatedAt: "2026-07-10T00:00:00.000Z"
    };
    const client = mockClient((sql) => (sql.includes("adventure_progress") ? [row] : []));

    await expect(
      upsertAdventureProgress(client, "space-1", {
        campaignId: "star-coast",
        chapterId: "star-coast",
        totalPoints: 6,
        currentStationId: "moonlight-tower",
        nextStationId: "crystal-bridge",
        segmentPoints: 0
      })
    ).resolves.toEqual(row);

    await expect(getAdventureProgress(client, "space-1")).resolves.toEqual(row);
  });

  it("claims station rewards idempotently", async () => {
    const client = mockClient((sql) =>
      sql.includes("RETURNING")
        ? [
            {
              id: "reward-1",
              stationId: "moonlight-tower",
              xpTransactionKey: "adventure_station:star-coast:moonlight-tower",
              claimedAt: "2026-07-10T00:00:00.000Z",
              reversedAt: null
            }
          ]
        : []
    );

    const reward = await claimStationReward(client, "space-1", {
      stationId: "moonlight-tower",
      xpTransactionKey: "adventure_station:star-coast:moonlight-tower"
    });

    expect(reward?.stationId).toBe("moonlight-tower");
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT (space_id, station_id) DO UPDATE"), [
      expect.any(String),
      "space-1",
      "moonlight-tower",
      "adventure_station:star-coast:moonlight-tower"
    ]);
  });

  it("lists only active station rewards in claim order", async () => {
    const client = mockClient(() => [
      {
        id: "reward-1",
        stationId: "moonlight-tower",
        xpTransactionKey: "adventure_station:moonlight-tower",
        claimedAt: "2026-07-10T00:00:00.000Z",
        reversedAt: null
      }
    ]);

    await expect(listActiveStationRewards(client, "space-1")).resolves.toEqual([
      expect.objectContaining({ stationId: "moonlight-tower", reversedAt: null })
    ]);
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("reversed_at IS NULL"), ["space-1"]);
  });

  it("applies an adventure XP transaction to the shared wallet once", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO xp_transactions")) {
          return {
            rows: [
              {
                id: "xp-1",
                uniqueKey: "adventure_station:star-coast:moonlight-tower:point-1",
                amount: 80,
                type: "earn",
                reason: "adventure_station"
              }
            ]
          };
        }
        return { rows: [] };
      })
    };

    await expect(
      applyAdventureXpTransaction(client, "space-1", {
        uniqueKey: "adventure_station:star-coast:moonlight-tower:point-1",
        amount: 80,
        type: "earn",
        reason: "adventure_station",
        checkInId: "checkin-1",
        dateKey: "2026-07-10"
      })
    ).resolves.toMatchObject({ amount: 80, reason: "adventure_station" });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE xp_wallet SET"), [
      "space-1",
      80,
      80,
      0
    ]);
  });
});
