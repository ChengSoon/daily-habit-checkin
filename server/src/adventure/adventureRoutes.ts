import { Router } from "express";
import type { AdventureChapterStatus } from "./adventureRules.js";
import {
  cancelAdventureClaim,
  claimAdventureChapter,
  createAdminChapter,
  fulfillAdventureClaim,
  getAdventureState,
  listAdminAdventureClaims,
  listAdminChapters,
  reorderAdminChapters,
  setAdminChapterStatus,
  updateAdminChapter,
  type ChapterAdminInput
} from "./adventureService.js";

type ChangeNotifier = (spaceId: string, resource: string) => void;

type AdventureRouterOptions = {
  onChange?: ChangeNotifier;
};

function requireOwner(
  request: { role?: string },
  response: { status: (code: number) => { json: (body: unknown) => void } }
): boolean {
  if (request.role !== "owner") {
    response.status(403).json({ error: "仅空间创建者可管理章节" });
    return false;
  }
  return true;
}

function serviceErrorStatus(error: unknown): number {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") {
      return status;
    }
  }
  return 500;
}

function serviceErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function parseAdminInput(body: unknown): ChapterAdminInput {
  const record = (body ?? {}) as Record<string, unknown>;
  const title = record.title;
  const storyText = record.storyText;
  const badgeName = record.badgeName;
  const thresholdLifetimeXp = record.thresholdLifetimeXp;

  if (typeof title !== "string" || typeof storyText !== "string" || typeof badgeName !== "string") {
    throw Object.assign(new Error("标题、叙事、徽章名称必填"), { status: 400 });
  }
  if (typeof thresholdLifetimeXp !== "number" || !Number.isFinite(thresholdLifetimeXp)) {
    throw Object.assign(new Error("门槛 XP 必须是数字"), { status: 400 });
  }

  const optionalText = (value: unknown): string | null | undefined => {
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value === "string") return value;
    throw Object.assign(new Error("字段类型不正确"), { status: 400 });
  };

  return {
    title,
    storyText,
    badgeName,
    thresholdLifetimeXp,
    subtitle: optionalText(record.subtitle),
    badgeDescription: optionalText(record.badgeDescription),
    badgeEmoji: optionalText(record.badgeEmoji),
    badgeImageKey: optionalText(record.badgeImageKey),
    nodeImageKey: optionalText(record.nodeImageKey),
    mapThemeKey: optionalText(record.mapThemeKey),
    rewardType: typeof record.rewardType === "string" ? record.rewardType : undefined,
    status: typeof record.status === "string" ? (record.status as AdventureChapterStatus) : undefined,
    sortOrder: typeof record.sortOrder === "number" ? record.sortOrder : undefined
  };
}

export function createAdventureRouter(options: AdventureRouterOptions = {}): Router {
  const router = Router();

  router.get("/state", async (request, response) => {
    try {
      const state = await getAdventureState(request.spaceId!);
      response.json(state);
    } catch (error) {
      console.error("adventure state failed", error);
      response.status(500).json({ error: "读取闯关进度失败" });
    }
  });

  router.post("/claim", async (request, response) => {
    const chapterId = (request.body as { chapterId?: unknown })?.chapterId;
    if (typeof chapterId !== "string" || chapterId.length === 0) {
      response.status(400).json({ error: "缺少 chapterId" });
      return;
    }

    try {
      const result = await claimAdventureChapter(request.spaceId!, chapterId, request.accountId!);
      if (!result.ok) {
        response.status(result.status).json({ error: result.error });
        return;
      }
      options.onChange?.(request.spaceId!, "adventure");
      response.json(result.state);
    } catch (error) {
      console.error("adventure claim failed", error);
      response.status(500).json({ error: "领取章节奖励失败" });
    }
  });

  router.get("/admin/chapters", async (request, response) => {
    if (!requireOwner(request, response)) return;
    try {
      response.json({ chapters: await listAdminChapters(request.spaceId!) });
    } catch (error) {
      response.status(serviceErrorStatus(error)).json({
        error: serviceErrorMessage(error, "读取章节列表失败")
      });
    }
  });

  router.post("/admin/chapters", async (request, response) => {
    if (!requireOwner(request, response)) return;
    try {
      const chapter = await createAdminChapter(request.spaceId!, parseAdminInput(request.body));
      options.onChange?.(request.spaceId!, "adventure");
      response.status(201).json(chapter);
    } catch (error) {
      response.status(serviceErrorStatus(error)).json({
        error: serviceErrorMessage(error, "创建章节失败")
      });
    }
  });

  router.put("/admin/chapters/:id", async (request, response) => {
    if (!requireOwner(request, response)) return;
    try {
      const chapter = await updateAdminChapter(
        request.spaceId!,
        request.params.id,
        parseAdminInput(request.body)
      );
      options.onChange?.(request.spaceId!, "adventure");
      response.json(chapter);
    } catch (error) {
      response.status(serviceErrorStatus(error)).json({
        error: serviceErrorMessage(error, "更新章节失败")
      });
    }
  });

  router.post("/admin/chapters/:id/status", async (request, response) => {
    if (!requireOwner(request, response)) return;
    const status = (request.body as { status?: unknown })?.status;
    if (typeof status !== "string") {
      response.status(400).json({ error: "缺少 status" });
      return;
    }
    try {
      const chapter = await setAdminChapterStatus(
        request.spaceId!,
        request.params.id,
        status as AdventureChapterStatus
      );
      options.onChange?.(request.spaceId!, "adventure");
      response.json(chapter);
    } catch (error) {
      response.status(serviceErrorStatus(error)).json({
        error: serviceErrorMessage(error, "更新章节状态失败")
      });
    }
  });

  router.post("/admin/chapters/reorder", async (request, response) => {
    if (!requireOwner(request, response)) return;
    const orderedIds = (request.body as { orderedIds?: unknown })?.orderedIds;
    if (!Array.isArray(orderedIds) || !orderedIds.every((id) => typeof id === "string")) {
      response.status(400).json({ error: "orderedIds 必须是字符串数组" });
      return;
    }
    try {
      const chapters = await reorderAdminChapters(request.spaceId!, orderedIds);
      options.onChange?.(request.spaceId!, "adventure");
      response.json({ chapters });
    } catch (error) {
      response.status(serviceErrorStatus(error)).json({
        error: serviceErrorMessage(error, "章节排序失败")
      });
    }
  });

  router.get("/admin/claims", async (request, response) => {
    if (!requireOwner(request, response)) return;
    try {
      response.json({ claims: await listAdminAdventureClaims(request.spaceId!) });
    } catch (error) {
      response.status(serviceErrorStatus(error)).json({
        error: serviceErrorMessage(error, "读取领取记录失败")
      });
    }
  });

  router.post("/admin/claims/:id/fulfill", async (request, response) => {
    if (!requireOwner(request, response)) return;
    const note = (request.body as { note?: unknown })?.note;
    try {
      const claim = await fulfillAdventureClaim(
        request.spaceId!,
        request.params.id,
        typeof note === "string" ? note : null
      );
      options.onChange?.(request.spaceId!, "adventure");
      response.json(claim);
    } catch (error) {
      response.status(serviceErrorStatus(error)).json({
        error: serviceErrorMessage(error, "确认兑现失败")
      });
    }
  });

  router.post("/admin/claims/:id/cancel", async (request, response) => {
    if (!requireOwner(request, response)) return;
    const note = (request.body as { note?: unknown })?.note;
    try {
      const claim = await cancelAdventureClaim(
        request.spaceId!,
        request.params.id,
        typeof note === "string" ? note : null
      );
      options.onChange?.(request.spaceId!, "adventure");
      response.json(claim);
    } catch (error) {
      response.status(serviceErrorStatus(error)).json({
        error: serviceErrorMessage(error, "取消兑现失败")
      });
    }
  });

  return router;
}
