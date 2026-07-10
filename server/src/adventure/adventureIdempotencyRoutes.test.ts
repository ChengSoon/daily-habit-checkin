import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({ withTransaction: vi.fn() }));

vi.mock("../db/pool.js", () => ({ getPool: vi.fn(), withTransaction: dbMock.withTransaction }));

import { createAdventureRouter } from "./adventureRoutes.js";

let server: Server | null = null;

afterEach(() => {
  server?.close();
  server = null;
  dbMock.withTransaction.mockReset();
});

function appWithAuth() {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.spaceId = "space-1";
    request.accountId = "account-1";
    next();
  });
  app.use("/api/adventure", createAdventureRouter());
  return app;
}

async function post(path: string, client: { query: ReturnType<typeof vi.fn> }) {
  dbMock.withTransaction.mockImplementationOnce(async (fn) => fn(client));
  const app = appWithAuth();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server!.address();
  if (!address || typeof address === "string") throw new Error("测试服务监听失败");
  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ habitId: "habit-1", dateKey: "2026-07-10", checkInId: "checkin-1" })
  });
}

function progress(totalPoints: number) {
  return {
    campaignId: "star-coast",
    chapterId: "star-coast",
    totalPoints,
    currentStationId: "start",
    nextStationId: "moonlight-tower",
    segmentPoints: totalPoints,
    updatedAt: "2026-07-10T00:00:00.000Z"
  };
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

describe("adventure action idempotency", () => {
  it("does not insert another award while logical points are active", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO adventure_campaigns")) return { rows: [] };
        if (sql.includes("FROM adventure_campaigns c")) return { rows: campaignRows() };
        if (sql.includes("FROM habits")) return { rows: [{ id: "habit-1", frequencyJson: JSON.stringify({ type: "daily" }) }] };
        if (sql.includes("FROM check_ins")) return { rows: [{ habitId: "habit-1" }] };
        if (sql.includes("FILTER")) return { rows: [{ checkInBalance: "1", allDoneBalance: "1", checkInCount: "1", allDoneCount: "1" }] };
        if (sql.includes("COALESCE(SUM(amount)")) return { rows: [{ total: "2" }] };
        if (sql.includes("INSERT INTO adventure_progress")) return { rows: [progress(2)] };
        return { rows: [] };
      })
    };

    const response = await post("/api/adventure/checkin-awards", client);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ insertedPoints: [], progress: { totalPoints: 2 } });
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO adventure_point_transactions"))).toBe(false);
  });

  it("does not insert another revoke while logical points are inactive", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO adventure_campaigns")) return { rows: [] };
        if (sql.includes("FROM adventure_campaigns c")) return { rows: campaignRows() };
        if (sql.includes("FILTER")) return { rows: [{ checkInBalance: "0", allDoneBalance: "0", checkInCount: "2", allDoneCount: "2" }] };
        if (sql.includes("COALESCE(SUM(amount)")) return { rows: [{ total: "0" }] };
        if (sql.includes("INSERT INTO adventure_progress")) return { rows: [progress(0)] };
        return { rows: [] };
      })
    };

    const response = await post("/api/adventure/checkin-awards/revoke", client);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ insertedPoints: [], progress: { totalPoints: 0 } });
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes("INSERT INTO adventure_point_transactions"))).toBe(false);
  });
});
