import { Router } from "express";
import { z } from "zod";
import { withTransaction } from "../db/pool.js";
import { deleteObject } from "../r2/r2Client.js";
import { AdventureAdminError } from "./adventureAdminService.js";
import {
  createAdventureStation,
  deleteAdventureStation,
  reorderAdventureStations,
  updateAdventureStation
} from "./adventureCampaignAdminRepository.js";
import { ensureAdventureCampaign } from "./adventureCampaignRepository.js";
import {
  listActiveStationRewards,
  readTotalAdventurePoints,
  upsertAdventureProgress
} from "./adventureRepository.js";
import { AdventureActionError, awardAdventureAction, revokeAdventureAction } from "./adventureActionService.js";
import { calculateAdventureProgress, type AdventureCampaign } from "./adventureRules.js";

type ChangeNotifier = (spaceId: string, resource: string) => void;

type AdventureRouterOptions = {
  onChange?: ChangeNotifier;
};

type AwardRequest = {
  habitId: string;
  dateKey: string;
  checkInId: string;
};

const StationWriteSchema = z.object({
  title: z.string().min(1).max(40),
  unlockAt: z.number().int().positive(),
  xpEnabled: z.boolean(),
  xp: z.number().int().min(0).max(1_000_000),
  badgeEnabled: z.boolean(),
  badgeTitle: z.string().max(80).nullable(),
  badgeImageKey: z.string().max(512).nullable(),
  badgeIcon: z.string().max(80).nullable(),
  badgeColor: z.string().max(32).nullable(),
  storyEnabled: z.boolean(),
  storyTitle: z.string().max(120).nullable(),
  storyBody: z.string().max(4000).nullable(),
  campaignVersion: z.number().int().positive()
});

function requireOwner(request: { role?: string }, response: { status(code: number): { json(body: unknown): void } }): boolean {
  if (request.role === "owner") return true;
  response.status(403).json({ error: "仅空间创建者可编辑关卡" });
  return false;
}

function sendAdminError(error: unknown, response: { status(code: number): { json(body: unknown): void } }): boolean {
  if (error instanceof AdventureAdminError || error instanceof z.ZodError) {
    const status = error instanceof AdventureAdminError ? error.status : 400;
    response.status(status).json({ error: error instanceof Error ? error.message : "请求格式不正确" });
    return true;
  }
  return false;
}

function parseAwardRequest(raw: unknown): AwardRequest {
  const record = (raw ?? {}) as Record<string, unknown>;
  const habitId = typeof record.habitId === "string" ? record.habitId : "";
  const dateKey = typeof record.dateKey === "string" ? record.dateKey : "";
  const checkInId = typeof record.checkInId === "string" ? record.checkInId : "";

  if (!habitId) {
    throw new Error("缺少 habitId");
  }
  if (!dateKey) {
    throw new Error("缺少 dateKey");
  }
  if (!checkInId) {
    throw new Error("缺少 checkInId");
  }

  return { habitId, dateKey, checkInId };
}

function progressInputFromTotal(campaign: AdventureCampaign, totalPoints: number) {
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

export function createAdventureRouter(options: AdventureRouterOptions = {}): Router {
  const router = Router();

  router.get("/campaign", async (request, response) => {
    const campaign = await withTransaction((client) => ensureAdventureCampaign(client, request.spaceId!));
    response.json(campaign);
  });

  router.post("/stations", async (request, response) => {
    if (!requireOwner(request, response)) return;
    try {
      const input = StationWriteSchema.parse(request.body);
      const campaign = await withTransaction((client) => createAdventureStation(client, request.spaceId!, input));
      options.onChange?.(request.spaceId!, "adventure");
      response.json(campaign);
    } catch (error) {
      if (!sendAdminError(error, response)) throw error;
    }
  });

  router.put("/stations/:stationId", async (request, response) => {
    if (!requireOwner(request, response)) return;
    try {
      const input = StationWriteSchema.parse(request.body);
      const result = await withTransaction((client) =>
        updateAdventureStation(client, request.spaceId!, request.params.stationId, input)
      );
      await deleteObject(result.replacedImageKey);
      options.onChange?.(request.spaceId!, "adventure");
      response.json(result.campaign);
    } catch (error) {
      if (!sendAdminError(error, response)) throw error;
    }
  });

  router.delete("/stations/:stationId", async (request, response) => {
    if (!requireOwner(request, response)) return;
    try {
      const campaignVersion = z.coerce.number().int().positive().parse(request.query.campaignVersion);
      const imageKey = await withTransaction((client) =>
        deleteAdventureStation(client, request.spaceId!, request.params.stationId, campaignVersion)
      );
      await deleteObject(imageKey);
      options.onChange?.(request.spaceId!, "adventure");
      response.status(204).end();
    } catch (error) {
      if (!sendAdminError(error, response)) throw error;
    }
  });

  router.post("/stations/reorder", async (request, response) => {
    if (!requireOwner(request, response)) return;
    try {
      const input = z.object({
        orderedStationIds: z.array(z.string().min(1)),
        campaignVersion: z.number().int().positive()
      }).parse(request.body);
      const campaign = await withTransaction((client) =>
        reorderAdventureStations(client, request.spaceId!, input.orderedStationIds, input.campaignVersion)
      );
      options.onChange?.(request.spaceId!, "adventure");
      response.json(campaign);
    } catch (error) {
      if (!sendAdminError(error, response)) throw error;
    }
  });

  router.get("/progress", async (request, response) => {
    const spaceId = request.spaceId;
    if (!spaceId) {
      response.status(401).json({ error: "未登录" });
      return;
    }

    const progress = await withTransaction(async (client) => {
      const campaign = await ensureAdventureCampaign(client, spaceId);
      const totalPoints = await readTotalAdventurePoints(client, spaceId);
      return upsertAdventureProgress(client, spaceId, progressInputFromTotal(campaign, totalPoints));
    });

    response.json(progress);
  });

  router.get("/rewards", async (request, response) => {
    const spaceId = request.spaceId;
    if (!spaceId) {
      response.status(401).json({ error: "未登录" });
      return;
    }

    const rewards = await withTransaction((client) => listActiveStationRewards(client, spaceId));
    response.json(rewards);
  });

  router.post("/checkin-awards", async (request, response) => {
    let input: AwardRequest;
    try {
      input = parseAwardRequest(request.body);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "请求格式不正确" });
      return;
    }

    const spaceId = request.spaceId;
    if (!spaceId) {
      response.status(401).json({ error: "未登录：缺少空间信息" });
      return;
    }

    let result;
    try {
      result = await withTransaction(async (client) => {
        return awardAdventureAction(client, spaceId, request.accountId ?? null, input);
      });
    } catch (error) {
      if (error instanceof AdventureActionError) {
        response.status(error.status).json({ error: error.message });
        return;
      }
      throw error;
    }

    if (result.insertedPoints.length > 0) {
      options.onChange?.(spaceId, "adventure");
    }
    if (result.stationXp.length > 0) options.onChange?.(spaceId, "wallet");
    response.json(result);
  });

  router.post("/checkin-awards/revoke", async (request, response) => {
    let input: AwardRequest;
    try {
      input = parseAwardRequest(request.body);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "请求格式不正确" });
      return;
    }

    const spaceId = request.spaceId;
    if (!spaceId) {
      response.status(401).json({ error: "未登录：缺少空间信息" });
      return;
    }

    const result = await withTransaction(async (client) => {
      return revokeAdventureAction(client, spaceId, request.accountId ?? null, input);
    });

    if (result.insertedPoints.length > 0) {
      options.onChange?.(spaceId, "adventure");
    }
    if (result.stationXp.length > 0) options.onChange?.(spaceId, "wallet");
    response.json(result);
  });

  return router;
}
