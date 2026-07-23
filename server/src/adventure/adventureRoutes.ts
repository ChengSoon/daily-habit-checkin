import { Router, type Request, type Response } from "express";
import type { AdventureChapterStatus } from "./adventureRules.js";
import { getPool } from "../db/pool.js";
import { isObjectKeyForScope } from "../r2/r2Client.js";
import { cleanupReplacedAdventureImages } from "./adventureImageCleanup.js";
import { getChapterById } from "./adventureRepository.js";
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

function routeParam(request: Request, name: string): string {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
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
    backgroundImageKey: optionalText(record.backgroundImageKey),
    mapThemeKey: optionalText(record.mapThemeKey),
    rewardType: typeof record.rewardType === "string" ? record.rewardType : undefined,
    status: typeof record.status === "string" ? (record.status as AdventureChapterStatus) : undefined,
    sortOrder: typeof record.sortOrder === "number" ? record.sortOrder : undefined
  };
}

function validateImageKeys(input: ChapterAdminInput, spaceId: string): void {
  for (const key of [input.badgeImageKey, input.nodeImageKey, input.backgroundImageKey]) {
    if (key && !isObjectKeyForScope("adventure", spaceId, key)) {
      throw Object.assign(new Error("闯关图片对象不属于当前空间"), { status: 400 });
    }
  }
}

export function createAdventureRouter(options: AdventureRouterOptions = {}): Router {
  const router = Router();
  router.get("/state", (request, response) => void readState(request, response));
  router.post("/claim", (request, response) => void claimChapter(request, response, options));
  router.get("/admin/chapters", (request, response) => void readAdminChapters(request, response));
  router.post("/admin/chapters", (request, response) => void createChapter(request, response, options));
  router.put("/admin/chapters/:id", (request, response) => void updateChapter(request, response, options));
  router.post("/admin/chapters/:id/status", (request, response) => void updateChapterStatus(request, response, options));
  router.post("/admin/chapters/reorder", (request, response) => void reorderChapters(request, response, options));
  router.get("/admin/claims", (request, response) => void readAdminClaims(request, response));
  router.post("/admin/claims/:id/fulfill", (request, response) => void fulfillClaim(request, response, options));
  router.post("/admin/claims/:id/cancel", (request, response) => void cancelClaim(request, response, options));
  return router;
}

async function readState(request: Request, response: Response): Promise<void> {
  try {
    response.json(await getAdventureState(request.spaceId!));
  } catch (error) {
    console.error("adventure state failed", error);
    response.status(500).json({ error: "读取闯关进度失败" });
  }
}

async function claimChapter(request: Request, response: Response, options: AdventureRouterOptions): Promise<void> {
  const chapterId = (request.body as { chapterId?: unknown })?.chapterId;
  if (typeof chapterId !== "string" || !chapterId) {
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
}

async function readAdminChapters(request: Request, response: Response): Promise<void> {
  if (!requireOwner(request, response)) return;
  try {
    response.json({ chapters: await listAdminChapters(request.spaceId!) });
  } catch (error) {
    sendServiceError(response, error, "读取章节列表失败");
  }
}

async function createChapter(request: Request, response: Response, options: AdventureRouterOptions): Promise<void> {
  if (!requireOwner(request, response)) return;
  try {
    const input = parseAdminInput(request.body);
    validateImageKeys(input, request.spaceId!);
    const chapter = await createAdminChapter(request.spaceId!, input);
    options.onChange?.(request.spaceId!, "adventure");
    response.status(201).json(chapter);
  } catch (error) {
    sendServiceError(response, error, "创建章节失败");
  }
}

async function updateChapter(request: Request, response: Response, options: AdventureRouterOptions): Promise<void> {
  if (!requireOwner(request, response)) return;
  try {
    const input = parseAdminInput(request.body);
    validateImageKeys(input, request.spaceId!);
    const chapterId = routeParam(request, "id");
    const previous = await getChapterById(getPool(), request.spaceId!, chapterId);
    const chapter = await updateAdminChapter(request.spaceId!, chapterId, input);
    if (previous) await cleanupReplacedAdventureImages(request.spaceId!, previous, chapter);
    options.onChange?.(request.spaceId!, "adventure");
    response.json(chapter);
  } catch (error) {
    sendServiceError(response, error, "更新章节失败");
  }
}

async function updateChapterStatus(request: Request, response: Response, options: AdventureRouterOptions): Promise<void> {
  if (!requireOwner(request, response)) return;
  const status = (request.body as { status?: unknown })?.status;
  if (typeof status !== "string") {
    response.status(400).json({ error: "缺少 status" });
    return;
  }
  try {
    const chapter = await setAdminChapterStatus(request.spaceId!, routeParam(request, "id"), status as AdventureChapterStatus);
    options.onChange?.(request.spaceId!, "adventure");
    response.json(chapter);
  } catch (error) {
    sendServiceError(response, error, "更新章节状态失败");
  }
}

async function reorderChapters(request: Request, response: Response, options: AdventureRouterOptions): Promise<void> {
  if (!requireOwner(request, response)) return;
  const ids = (request.body as { orderedIds?: unknown })?.orderedIds;
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
    response.status(400).json({ error: "orderedIds 必须是字符串数组" });
    return;
  }
  try {
    const chapters = await reorderAdminChapters(request.spaceId!, ids);
    options.onChange?.(request.spaceId!, "adventure");
    response.json({ chapters });
  } catch (error) {
    sendServiceError(response, error, "章节排序失败");
  }
}

async function readAdminClaims(request: Request, response: Response): Promise<void> {
  if (!requireOwner(request, response)) return;
  try {
    response.json({ claims: await listAdminAdventureClaims(request.spaceId!) });
  } catch (error) {
    sendServiceError(response, error, "读取领取记录失败");
  }
}

async function fulfillClaim(request: Request, response: Response, options: AdventureRouterOptions): Promise<void> {
  await updateClaim({ request, response, options, action: "fulfill" });
}

async function cancelClaim(request: Request, response: Response, options: AdventureRouterOptions): Promise<void> {
  await updateClaim({ request, response, options, action: "cancel" });
}

async function updateClaim(input: {
  request: Request;
  response: Response;
  options: AdventureRouterOptions;
  action: "fulfill" | "cancel";
}): Promise<void> {
  const { request, response, options, action } = input;
  if (!requireOwner(request, response)) return;
  const note = (request.body as { note?: unknown })?.note;
  try {
    const fn = action === "fulfill" ? fulfillAdventureClaim : cancelAdventureClaim;
    const claim = await fn(request.spaceId!, routeParam(request, "id"), typeof note === "string" ? note : null);
    options.onChange?.(request.spaceId!, "adventure");
    response.json(claim);
  } catch (error) {
    sendServiceError(response, error, action === "fulfill" ? "确认兑现失败" : "取消兑现失败");
  }
}

function sendServiceError(response: Response, error: unknown, fallback: string): void {
  response.status(serviceErrorStatus(error)).json({ error: serviceErrorMessage(error, fallback) });
}
