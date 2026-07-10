import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  withTransaction: vi.fn()
}));

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

async function requestApp(app: express.Express, path: string, body?: unknown): Promise<Response> {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server!.address();
  if (!address || typeof address === "string") {
    throw new Error("测试服务监听失败");
  }
  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
}

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

function campaignRows() {
  return [{
    campaignId: "star-coast",
    campaignTitle: "星河海岸",
    campaignSubtitle: "去月光灯塔",
    campaignVersion: 1,
    stationId: "moonlight-tower",
    stationTitle: "月光灯塔",
    sortOrder: 0,
    unlockAt: 6,
    stationVersion: 1,
    xpEnabled: true,
    xp: 80,
    badgeEnabled: true,
    badgeTitle: "灯塔徽章",
    badgeImageKey: null,
    badgeIcon: "ribbon",
    badgeColor: "#E9507A",
    storyEnabled: true,
    storyTitle: "灯塔来信",
    storyBody: "正文",
    everUnlocked: false
  }];
}

describe("createAdventureRouter", () => {
  it("awards check-in and all-done action points, then returns updated progress", async () => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("INSERT INTO adventure_campaigns")) return { rows: [] };
        if (sql.includes("FROM adventure_campaigns c")) return { rows: campaignRows() };
        if (sql.includes("FROM habits")) {
          return {
            rows: [{ id: "habit-1", frequencyJson: JSON.stringify({ type: "daily" }) }],
            rowCount: 1
          };
        }
        if (sql.includes("FROM check_ins")) {
          return { rows: [{ habitId: "habit-1" }], rowCount: 1 };
        }
        if (sql.includes("INSERT INTO adventure_point_transactions")) {
          const uniqueKey = params?.[2];
          return {
            rows: [
              {
                id: `tx-${uniqueKey}`,
                uniqueKey,
                amount: params?.[3],
                reason: params?.[4],
                habitId: params?.[5],
                checkInId: params?.[6],
                dateKey: params?.[7],
                accountId: params?.[8],
                createdAt: "2026-07-10T00:00:00.000Z"
              }
            ],
            rowCount: 1
          };
        }
        if (sql.includes("COALESCE(SUM(amount)")) {
          return { rows: [{ total: "2" }], rowCount: 1 };
        }
        if (sql.includes("INSERT INTO adventure_progress")) {
          return {
            rows: [
              {
                campaignId: "star-coast",
                chapterId: "star-coast",
                totalPoints: 2,
                currentStationId: "start",
                nextStationId: "moonlight-tower",
                segmentPoints: 2,
                updatedAt: "2026-07-10T00:00:00.000Z"
              }
            ],
            rowCount: 1
          };
        }
        return { rows: [], rowCount: 0 };
      })
    };
    dbMock.withTransaction.mockImplementationOnce(async (fn) => fn(client));
    const { app, onChange } = authedApp();

    const response = await requestApp(app, "/api/adventure/checkin-awards", {
      habitId: "habit-1",
      dateKey: "2026-07-10",
      checkInId: "checkin-1"
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      progress: {
        totalPoints: 2,
        currentStationId: "start",
        nextStationId: "moonlight-tower",
        segmentPoints: 2
      },
      insertedPoints: [
        { uniqueKey: "adventure:checkin:habit-1:2026-07-10" },
        { uniqueKey: "adventure:all_done:2026-07-10" }
      ]
    });
    expect(onChange).toHaveBeenCalledWith("space-1", "adventure");
  });

  it("rejects malformed award requests", async () => {
    const { app } = authedApp();

    const response = await requestApp(app, "/api/adventure/checkin-awards", {
      habitId: "",
      dateKey: "2026-07-10",
      checkInId: "checkin-1"
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "缺少 habitId" });
  });

  it("rejects awards for a check-in that does not exist in the space", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO adventure_campaigns")) return { rows: [] };
        if (sql.includes("FROM adventure_campaigns c")) return { rows: campaignRows() };
        if (sql.includes("SELECT id") && sql.includes("FROM check_ins")) {
          return { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      })
    };
    dbMock.withTransaction.mockImplementationOnce(async (fn) => fn(client));
    const { app } = authedApp();

    const response = await requestApp(app, "/api/adventure/checkin-awards", {
      habitId: "habit-1",
      dateKey: "2026-07-10",
      checkInId: "missing-checkin"
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "打卡记录不存在或已撤销" });
  });

  it("revokes existing check-in and all-done action points", async () => {
    const client = {
      query: vi.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes("INSERT INTO adventure_campaigns")) return { rows: [] };
        if (sql.includes("FROM adventure_campaigns c")) return { rows: campaignRows() };
        if (sql.includes("FILTER")) {
          return {
            rows: [{ checkInBalance: "1", allDoneBalance: "1", checkInCount: "1", allDoneCount: "1" }],
            rowCount: 1
          };
        }
        if (sql.includes("unique_key = ANY($2)")) {
          return {
            rows: [
              {
                id: "original-checkin",
                uniqueKey: "adventure:checkin:habit-1:2026-07-10",
                amount: 1,
                reason: "checkin",
                habitId: "habit-1",
                checkInId: "checkin-1",
                dateKey: "2026-07-10",
                accountId: "account-1",
                createdAt: "2026-07-10T00:00:00.000Z"
              },
              {
                id: "original-all-done",
                uniqueKey: "adventure:all_done:2026-07-10",
                amount: 1,
                reason: "all_done",
                habitId: null,
                checkInId: "checkin-1",
                dateKey: "2026-07-10",
                accountId: "account-1",
                createdAt: "2026-07-10T00:00:00.000Z"
              }
            ],
            rowCount: 2
          };
        }
        if (sql.includes("INSERT INTO adventure_point_transactions")) {
          const uniqueKey = params?.[2];
          return {
            rows: [
              {
                id: `tx-${uniqueKey}`,
                uniqueKey,
                amount: params?.[3],
                reason: params?.[4],
                habitId: params?.[5],
                checkInId: params?.[6],
                dateKey: params?.[7],
                accountId: params?.[8],
                createdAt: "2026-07-10T00:00:00.000Z"
              }
            ],
            rowCount: 1
          };
        }
        if (sql.includes("COALESCE(SUM(amount)")) {
          return { rows: [{ total: "0" }], rowCount: 1 };
        }
        if (sql.includes("INSERT INTO adventure_progress")) {
          return {
            rows: [
              {
                campaignId: "star-coast",
                chapterId: "star-coast",
                totalPoints: 0,
                currentStationId: "start",
                nextStationId: "moonlight-tower",
                segmentPoints: 0,
                updatedAt: "2026-07-10T00:00:00.000Z"
              }
            ],
            rowCount: 1
          };
        }
        return { rows: [], rowCount: 0 };
      })
    };
    dbMock.withTransaction.mockImplementationOnce(async (fn) => fn(client));
    const { app, onChange } = authedApp();

    const response = await requestApp(app, "/api/adventure/checkin-awards/revoke", {
      habitId: "habit-1",
      dateKey: "2026-07-10",
      checkInId: "checkin-1"
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      progress: {
        totalPoints: 0,
        currentStationId: "start",
        nextStationId: "moonlight-tower",
        segmentPoints: 0
      },
      insertedPoints: [
        { uniqueKey: "adventure_undo:checkin:habit-1:2026-07-10:checkin-1", amount: -1 },
        { uniqueKey: "adventure_undo:all_done:2026-07-10:checkin-1", amount: -1 }
      ]
    });
    expect(onChange).toHaveBeenCalledWith("space-1", "adventure");
  });
});
