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
  app.use((request, _response, next) => {
    request.spaceId = "space-1";
    request.accountId = "account-1";
    next();
  });
  app.use("/api/adventure", createAdventureRouter());
  return app;
}

async function getProgress(app: express.Express): Promise<Response> {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server!.address();
  if (!address || typeof address === "string") throw new Error("测试服务监听失败");
  return fetch(`http://127.0.0.1:${address.port}/api/adventure/progress`);
}

function row(totalPoints: number) {
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

describe("adventure progress route", () => {
  it("returns recalculated shared progress", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO adventure_campaigns")) return { rows: [] };
        if (sql.includes("FROM adventure_campaigns c")) return { rows: campaignRows() };
        if (sql.includes("COALESCE(SUM(amount)")) return { rows: [{ total: "4" }] };
        if (sql.includes("INSERT INTO adventure_progress")) return { rows: [row(4)] };
        return { rows: [] };
      })
    };
    dbMock.withTransaction.mockImplementationOnce(async (fn) => fn(client));

    const response = await getProgress(appWithAuth());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ totalPoints: 4, segmentPoints: 4 });
  });

  it("creates initial progress when the space has not started", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO adventure_campaigns")) return { rows: [{ id: "star-coast" }] };
        if (sql.includes("INSERT INTO adventure_stations")) return { rows: [] };
        if (sql.includes("FROM adventure_campaigns c")) return { rows: campaignRows() };
        if (sql.includes("FROM adventure_progress")) return { rows: [] };
        if (sql.includes("COALESCE(SUM(amount)")) return { rows: [{ total: "0" }] };
        if (sql.includes("INSERT INTO adventure_progress")) return { rows: [row(0)] };
        return { rows: [] };
      })
    };
    dbMock.withTransaction.mockImplementationOnce(async (fn) => fn(client));

    const response = await getProgress(appWithAuth());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ totalPoints: 0, currentStationId: "start" });
  });

  it("recalculates progress from the current dynamic campaign", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("INSERT INTO adventure_campaigns")) return { rows: [] };
        if (sql.includes("FROM adventure_campaigns c")) {
          return {
            rows: [
              {
                campaignId: "star-coast",
                campaignTitle: "星河海岸",
                campaignSubtitle: null,
                campaignVersion: 3,
                stationId: "custom-first",
                stationTitle: "自定义第一关",
                sortOrder: 0,
                unlockAt: 8,
                stationVersion: 1,
                xpEnabled: false,
                xp: 0,
                badgeEnabled: true,
                badgeTitle: "自定义徽章",
                badgeImageKey: null,
                badgeIcon: "ribbon",
                badgeColor: "#E9507A",
                storyEnabled: false,
                storyTitle: null,
                storyBody: null,
                everUnlocked: true
              }
            ]
          };
        }
        if (sql.includes("COALESCE(SUM(amount)")) return { rows: [{ total: "10" }] };
        if (sql.includes("FROM adventure_progress")) return { rows: [row(4)] };
        if (sql.includes("INSERT INTO adventure_progress")) {
          return {
            rows: [{
              ...row(10),
              currentStationId: "custom-first",
              nextStationId: null,
              segmentPoints: 0
            }]
          };
        }
        return { rows: [] };
      })
    };
    dbMock.withTransaction.mockImplementationOnce(async (fn) => fn(client));

    const response = await getProgress(appWithAuth());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      totalPoints: 10,
      currentStationId: "custom-first",
      nextStationId: null
    });
  });

  it("returns active unlocked station rewards", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FROM adventure_station_rewards")) {
          return {
            rows: [
              {
                id: "reward-1",
                stationId: "moonlight-tower",
                xpTransactionKey: "adventure_station:moonlight-tower",
                claimedAt: "2026-07-10T00:00:00.000Z",
                reversedAt: null
              }
            ]
          };
        }
        return { rows: [] };
      })
    };
    dbMock.withTransaction.mockImplementationOnce(async (fn) => fn(client));
    const app = appWithAuth();
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server!.address();
    if (!address || typeof address === "string") throw new Error("测试服务监听失败");

    const response = await fetch(`http://127.0.0.1:${address.port}/api/adventure/rewards`);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual([
      expect.objectContaining({ stationId: "moonlight-tower", reversedAt: null })
    ]);
  });
});
