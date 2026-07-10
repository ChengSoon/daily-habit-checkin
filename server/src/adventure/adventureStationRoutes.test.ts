import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({ withTransaction: vi.fn() }));

vi.mock("../db/pool.js", () => ({
  getPool: vi.fn(),
  withTransaction: dbMock.withTransaction
}));

import { createAdventureRouter } from "./adventureRoutes.js";

let server: Server | null = null;

afterEach(() => {
  server?.close();
  server = null;
  dbMock.withTransaction.mockReset();
});

function authedApp(onChange = vi.fn()) {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.spaceId = "space-1";
    request.accountId = "account-1";
    next();
  });
  app.use("/api/adventure", createAdventureRouter({ onChange }));
  return { app, onChange };
}

async function post(app: express.Express, path: string): Promise<Response> {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server!.address();
  if (!address || typeof address === "string") {
    throw new Error("测试服务监听失败");
  }
  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ habitId: "habit-1", dateKey: "2026-07-10", checkInId: "checkin-1" })
  });
}

function progressRow(totalPoints: number) {
  return {
    campaignId: "star-coast",
    chapterId: "star-coast",
    totalPoints,
    currentStationId: totalPoints >= 6 ? "moonlight-tower" : "start",
    nextStationId: totalPoints >= 6 ? "crystal-bridge" : "moonlight-tower",
    segmentPoints: 0,
    updatedAt: "2026-07-10T00:00:00.000Z"
  };
}

function campaignRows(thresholds: Array<{ id: string; unlockAt: number; xp: number }>) {
  return thresholds.map((station, index) => ({
    campaignId: "star-coast",
    campaignTitle: "星河海岸",
    campaignSubtitle: "去月光灯塔",
    campaignVersion: 1,
    stationId: station.id,
    stationTitle: station.id,
    sortOrder: index,
    unlockAt: station.unlockAt,
    stationVersion: 1,
    xpEnabled: true,
    xp: station.xp,
    badgeEnabled: true,
    badgeTitle: `${station.id}-badge`,
    badgeImageKey: null,
    badgeIcon: "ribbon",
    badgeColor: "#E9507A",
    storyEnabled: false,
    storyTitle: null,
    storyBody: null,
    everUnlocked: false
  }));
}

describe("adventure station rewards", () => {
  it("claims station reward XP when progress crosses a station", async () => {
    let totalReads = 0;
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("INSERT INTO adventure_campaigns")) return { rows: [] };
        if (sql.includes("FROM adventure_campaigns c")) {
          return { rows: campaignRows([{ id: "moonlight-tower", unlockAt: 6, xp: 80 }]) };
        }
        if (sql.includes("FROM habits")) {
          return { rows: [
            { id: "habit-1", frequencyJson: JSON.stringify({ type: "daily" }) },
            { id: "habit-2", frequencyJson: JSON.stringify({ type: "daily" }) }
          ] };
        }
        if (sql.includes("FROM check_ins")) return { rows: [{ habitId: "habit-1" }] };
        if (sql.includes("FILTER")) return { rows: [{ checkInBalance: "0", allDoneBalance: "0", checkInCount: "0", allDoneCount: "0" }] };
        if (sql.includes("COALESCE(SUM(amount)")) return { rows: [{ total: String(totalReads++ === 0 ? 5 : 6) }] };
        if (sql.includes("INSERT INTO adventure_point_transactions")) {
          return { rows: [{ uniqueKey: params?.[2], amount: 1, reason: "checkin", habitId: "habit-1", checkInId: "checkin-1", dateKey: "2026-07-10" }] };
        }
        if (sql.includes("INSERT INTO adventure_station_rewards")) {
          return { rows: [{ id: "reward-1", stationId: "moonlight-tower", xpTransactionKey: params?.[3], claimedAt: "2026-07-10T00:00:00.000Z", reversedAt: null }] };
        }
        if (sql.includes("INSERT INTO xp_transactions")) {
          return { rows: [{ id: "xp-1", uniqueKey: params?.[2], amount: 80, type: "earn", reason: "adventure_station", checkInId: "checkin-1", dateKey: "2026-07-10" }] };
        }
        if (sql.includes("INSERT INTO adventure_progress")) return { rows: [progressRow(6)] };
        return { rows: [] };
      })
    };
    dbMock.withTransaction.mockImplementationOnce(async (fn) => fn(client));
    const { app, onChange } = authedApp();

    const response = await post(app, "/api/adventure/checkin-awards");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      stationRewards: [{ stationId: "moonlight-tower", reversedAt: null }],
      stationXp: [{ amount: 80, reason: "adventure_station" }]
    });
    expect(onChange).toHaveBeenCalledWith("space-1", "adventure");
    expect(onChange).toHaveBeenCalledWith("space-1", "wallet");
  });

  it("reverses station XP when progress falls below the station", async () => {
    let totalReads = 0;
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("INSERT INTO adventure_campaigns")) return { rows: [] };
        if (sql.includes("FROM adventure_campaigns c")) {
          return { rows: campaignRows([{ id: "moonlight-tower", unlockAt: 6, xp: 80 }]) };
        }
        if (sql.includes("FILTER")) return { rows: [{ checkInBalance: "1", allDoneBalance: "0", checkInCount: "1", allDoneCount: "0" }] };
        if (sql.includes("COALESCE(SUM(amount)")) return { rows: [{ total: String(totalReads++ === 0 ? 6 : 5) }] };
        if (sql.includes("INSERT INTO adventure_point_transactions")) {
          return { rows: [{ uniqueKey: params?.[2], amount: -1, reason: "checkin_undo", habitId: "habit-1", checkInId: "checkin-1", dateKey: "2026-07-10" }] };
        }
        if (sql.includes("UPDATE adventure_station_rewards")) {
          return { rows: [{ id: "reward-1", stationId: "moonlight-tower", xpTransactionKey: "adventure_station:source", claimedAt: "2026-07-10T00:00:00.000Z", reversedAt: "2026-07-10T00:01:00.000Z" }] };
        }
        if (sql.includes("INSERT INTO xp_transactions")) {
          return { rows: [{ id: "xp-undo", uniqueKey: params?.[2], amount: -80, type: "adjust", reason: "adventure_station_undo", checkInId: "checkin-1", dateKey: "2026-07-10" }] };
        }
        if (sql.includes("INSERT INTO adventure_progress")) return { rows: [progressRow(5)] };
        return { rows: [] };
      })
    };
    dbMock.withTransaction.mockImplementationOnce(async (fn) => fn(client));
    const { app, onChange } = authedApp();

    const response = await post(app, "/api/adventure/checkin-awards/revoke");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      stationRewards: [{ stationId: "moonlight-tower", reversedAt: "2026-07-10T00:01:00.000Z" }],
      stationXp: [{ amount: -80, reason: "adventure_station_undo" }]
    });
    expect(onChange).toHaveBeenCalledWith("space-1", "wallet");
  });

  it("claims every station crossed by a check-in plus all-done award", async () => {
    let totalReads = 0;
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("INSERT INTO adventure_campaigns")) return { rows: [] };
        if (sql.includes("FROM adventure_campaigns c")) {
          return {
            rows: campaignRows([
              { id: "first", unlockAt: 5, xp: 40 },
              { id: "second", unlockAt: 6, xp: 60 }
            ])
          };
        }
        if (sql.includes("FROM habits")) {
          return { rows: [{ id: "habit-1", frequencyJson: JSON.stringify({ type: "daily" }) }] };
        }
        if (sql.includes("FROM check_ins")) return { rows: [{ habitId: "habit-1" }] };
        if (sql.includes("FILTER")) {
          return { rows: [{ checkInBalance: "0", allDoneBalance: "0", checkInCount: "0", allDoneCount: "0" }] };
        }
        if (sql.includes("COALESCE(SUM(amount)")) {
          return { rows: [{ total: String(totalReads++ === 0 ? 4 : 6) }] };
        }
        if (sql.includes("INSERT INTO adventure_point_transactions")) {
          return {
            rows: [{
              uniqueKey: params?.[2],
              amount: 1,
              reason: String(params?.[2]).includes("all_done") ? "all_done" : "checkin",
              habitId: params?.[5],
              checkInId: "checkin-1",
              dateKey: "2026-07-10"
            }]
          };
        }
        if (sql.includes("INSERT INTO adventure_station_rewards")) {
          return {
            rows: [{
              id: `reward-${params?.[2]}`,
              stationId: params?.[2],
              xpTransactionKey: params?.[3],
              claimedAt: "2026-07-10T00:00:00.000Z",
              reversedAt: null
            }]
          };
        }
        if (sql.includes("INSERT INTO xp_transactions")) {
          return { rows: [{ id: `xp-${params?.[3]}`, uniqueKey: params?.[2], amount: params?.[3], type: "earn", reason: "adventure_station" }] };
        }
        if (sql.includes("INSERT INTO adventure_progress")) {
          return { rows: [{ ...progressRow(6), currentStationId: "second", nextStationId: null }] };
        }
        return { rows: [] };
      })
    };
    dbMock.withTransaction.mockImplementationOnce(async (fn) => fn(client));

    const response = await post(authedApp().app, "/api/adventure/checkin-awards");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      stationRewards: [{ stationId: "first" }, { stationId: "second" }],
      stationXp: [{ amount: 40 }, { amount: 60 }]
    });
  });
});
