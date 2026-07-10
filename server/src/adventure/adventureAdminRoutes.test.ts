import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdventureAdminError } from "./adventureAdminService.js";

const dbMock = vi.hoisted(() => ({ withTransaction: vi.fn() }));
const campaignMock = vi.hoisted(() => ({
  ensureAdventureCampaign: vi.fn(),
  createAdventureStation: vi.fn(),
  updateAdventureStation: vi.fn(),
  deleteAdventureStation: vi.fn(),
  reorderAdventureStations: vi.fn()
}));
const r2Mock = vi.hoisted(() => ({
  deleteObject: vi.fn(),
  isAdventureBadgeKeyForSpace: vi.fn(() => true)
}));

vi.mock("../db/pool.js", () => ({ getPool: vi.fn(), withTransaction: dbMock.withTransaction }));
vi.mock("./adventureCampaignAdminRepository.js", () => campaignMock);
vi.mock("./adventureCampaignRepository.js", () => ({
  ensureAdventureCampaign: campaignMock.ensureAdventureCampaign
}));
vi.mock("../r2/r2Client.js", () => r2Mock);

import { createAdventureRouter } from "./adventureRoutes.js";

let server: Server | null = null;

afterEach(() => {
  server?.close();
  server = null;
  vi.clearAllMocks();
});

const campaign = {
  id: "star-coast",
  title: "星河海岸",
  subtitle: "去月光灯塔",
  version: 2,
  stations: []
};

function appWithRole(role: "owner" | "member") {
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.spaceId = "space-1";
    request.accountId = "account-1";
    request.role = role;
    next();
  });
  app.use("/api/adventure", createAdventureRouter());
  return app;
}

async function request(app: express.Express, path: string, init?: RequestInit): Promise<Response> {
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server!.address();
  if (!address || typeof address === "string") throw new Error("测试服务监听失败");
  return fetch(`http://127.0.0.1:${address.port}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) }
  });
}

const stationInput = {
  title: "云端花园",
  unlockAt: 30,
  xpEnabled: false,
  xp: 0,
  badgeEnabled: true,
  badgeTitle: "花园守望者",
  badgeImageKey: null,
  badgeIcon: "flower",
  badgeColor: "#E9507A",
  storyEnabled: false,
  storyTitle: null,
  storyBody: null,
  campaignVersion: 1
};

describe("adventure admin routes", () => {
  it("returns the dynamic campaign to every space member", async () => {
    campaignMock.ensureAdventureCampaign.mockResolvedValue(campaign);
    dbMock.withTransaction.mockImplementation(async (fn) => fn({ query: vi.fn() }));

    const response = await request(appWithRole("member"), "/api/adventure/campaign");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(campaign);
  });

  it("allows the owner to add a station", async () => {
    campaignMock.createAdventureStation.mockResolvedValue({ ...campaign, version: 2 });
    dbMock.withTransaction.mockImplementation(async (fn) => fn({ query: vi.fn() }));

    const response = await request(appWithRole("owner"), "/api/adventure/stations", {
      method: "POST",
      body: JSON.stringify(stationInput)
    });

    expect(response.status).toBe(200);
    expect(campaignMock.createAdventureStation).toHaveBeenCalledWith(
      expect.anything(),
      "space-1",
      stationInput
    );
  });

  it("rejects station writes from a member", async () => {
    const response = await request(appWithRole("member"), "/api/adventure/stations", {
      method: "POST",
      body: JSON.stringify(stationInput)
    });

    expect(response.status).toBe(403);
    expect(campaignMock.createAdventureStation).not.toHaveBeenCalled();
  });

  it("returns 409 when an unlocked station field is changed", async () => {
    campaignMock.updateAdventureStation.mockRejectedValue(
      new AdventureAdminError("已解锁关卡不能修改行动力门槛", 409)
    );
    dbMock.withTransaction.mockImplementation(async (fn) => fn({ query: vi.fn() }));

    const response = await request(appWithRole("owner"), "/api/adventure/stations/cloud-garden", {
      method: "PUT",
      body: JSON.stringify(stationInput)
    });

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: "已解锁关卡不能修改行动力门槛" });
  });

  it("cleans up the replaced custom badge image after an update", async () => {
    campaignMock.updateAdventureStation.mockResolvedValue({
      campaign,
      replacedImageKey: "adventure_badges/space-1/old.png"
    });
    dbMock.withTransaction.mockImplementation(async (fn) => fn({ query: vi.fn() }));

    const response = await request(appWithRole("owner"), "/api/adventure/stations/cloud-garden", {
      method: "PUT",
      body: JSON.stringify({
        ...stationInput,
        badgeImageKey: "adventure_badges/space-1/new.png"
      })
    });

    expect(response.status).toBe(200);
    expect(r2Mock.deleteObject).toHaveBeenCalledWith("adventure_badges/space-1/old.png");
  });
});
