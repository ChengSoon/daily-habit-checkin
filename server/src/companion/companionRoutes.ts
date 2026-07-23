import { Router, type Response } from "express";
import { z, ZodError } from "zod";
import {
  CompanionChatRequestSchema,
  CompanionEventSchema,
  MemberPreferencesSchema,
  MemoryConfirmationSchema,
  CompanionTtsRequestSchema,
  CompanionAsrRequestSchema
} from "./companionSchemas.js";
import { createMimoTtsService, type MimoTtsService } from "./mimoTts.js";
import { createCompanionAsrService, type CompanionAsrService } from "./companionAsr.js";
import {
  CompanionEventInProgressError,
  createCompanionService,
  type CompanionService
} from "./companionService.js";
import {
  CompanionActionForbiddenError,
  CompanionActionNotFoundError
} from "./companionActionRepository.js";

type CompanionRouterOptions = {
  service?: CompanionService;
  tts?: MimoTtsService;
  asr?: CompanionAsrService;
  onChange?: (spaceId: string, resource: string) => void;
};

const RespondRequestSchema = z.object({ event: CompanionEventSchema }).strict();
const MessagePageSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(50).default(30),
    cursor: z.iso.datetime().optional()
  })
  .strict();

function sendError(response: Response, error: unknown): void {
  if (error instanceof ZodError) {
    response.status(400).json({ error: "请求内容格式不正确" });
    return;
  }
  if (error instanceof CompanionEventInProgressError) {
    response.status(409).json({ error: "这次互动正在处理，请稍候" });
    return;
  }
  if (error instanceof CompanionActionNotFoundError) {
    response.status(404).json({ error: error instanceof Error ? error.message : "动作不存在" });
    return;
  }
  if (error instanceof CompanionActionForbiddenError) {
    response.status(403).json({ error: error instanceof Error ? error.message : "无权确认这个动作" });
    return;
  }
  console.warn("companion request failed", error);
  response.status(503).json({ error: "卡卡暂时没接上话，请稍后再试" });
}

type RouteRuntime = {
  router: Router;
  service: CompanionService;
  tts: MimoTtsService;
  asr: CompanionAsrService;
  notify: (spaceId: string) => void;
  notifyResource: (spaceId: string, resource: string) => void;
};

function registerRespond(runtime: RouteRuntime) {
  runtime.router.post("/respond", async (request, response) => {
    try {
      const { event } = RespondRequestSchema.parse(request.body);
      const reply = await runtime.service.respond({ spaceId: request.spaceId!, accountId: request.accountId!, event });
      if (reply.decision === "speak") runtime.notify(request.spaceId!);
      response.json(reply);
    } catch (error) {
      sendError(response, error);
    }
  });
}

function registerChat(runtime: RouteRuntime) {
  runtime.router.post("/chat", async (request, response) => {
    let started = false;
    try {
      const input = CompanionChatRequestSchema.parse(request.body);
      response.status(200);
      response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      response.setHeader("Cache-Control", "no-cache, no-transform");
      response.setHeader("Connection", "keep-alive");
      response.flushHeaders?.();
      started = true;
      await runtime.service.chat({ spaceId: request.spaceId!, accountId: request.accountId!, input },
        (delta) => response.write(`data: ${JSON.stringify({ delta })}\n\n`),
        (action) => response.write(`event: action\ndata: ${JSON.stringify({ action })}\n\n`));
      response.write("data: [DONE]\n\n");
      response.end();
      runtime.notify(request.spaceId!);
    } catch (error) {
      if (!started) return sendError(response, error);
      console.warn("companion stream failed", error);
      response.write(`event: error\ndata: ${JSON.stringify({ error: "回复中断，请重试" })}\n\n`);
      response.end();
    }
  });
}

function registerActions(runtime: RouteRuntime) {
  runtime.router.post("/actions/:id/confirm", async (request, response) => {
    try {
      const result = await runtime.service.confirmAction(request.spaceId!, request.accountId!, request.params.id);
      for (const resource of result.resources) runtime.notifyResource(request.spaceId!, resource);
      runtime.notify(request.spaceId!);
      response.json(result);
    } catch (error) {
      sendError(response, error);
    }
  });
  runtime.router.post("/actions/:id/cancel", async (request, response) => {
    try {
      const result = await runtime.service.cancelAction(request.spaceId!, request.accountId!, request.params.id);
      runtime.notify(request.spaceId!);
      response.json(result);
    } catch (error) {
      sendError(response, error);
    }
  });
}

function registerAsr(runtime: RouteRuntime) {
  runtime.router.post("/asr", async (request, response) => {
    try {
      const input = CompanionAsrRequestSchema.parse(request.body);
      response.json(await runtime.asr.transcribe(input));
    } catch (error) {
      const code = error instanceof Error ? error.message : "";
      if (code === "ASR_UNAVAILABLE") return response.status(503).json({ error: "语音识别服务未配置" });
      if (code === "ASR_EMPTY_AUDIO" || code === "ASR_NO_SPEECH") return response.status(400).json({ error: "没听清，请再说一次" });
      if (code === "ASR_TOO_LARGE") return response.status(400).json({ error: "录音太长了，请说短一点" });
      sendError(response, error);
    }
  });
}

function registerTts(runtime: RouteRuntime) {
  runtime.router.post("/tts", async (request, response) => {
    let started = false;
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.once("aborted", abort);
    response.once("close", () => { if (!response.writableEnded) controller.abort(); });
    try {
      const input = CompanionTtsRequestSchema.parse(request.body);
      response.status(200);
      response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      response.setHeader("Cache-Control", "no-cache, no-transform");
      response.setHeader("Connection", "keep-alive");
      response.flushHeaders?.();
      started = true;
      await runtime.tts.stream(input, (chunk) => response.write(`event: audio\ndata: ${JSON.stringify(chunk)}\n\n`), controller.signal);
      if (!response.writableEnded) {
        response.write("event: done\ndata: {}\n\n");
        response.end();
      }
    } catch (error) {
      if (controller.signal.aborted) { if (!response.writableEnded) response.end(); return; }
      if (!started) { sendError(response, error); return; }
      console.warn("companion tts stream failed", error instanceof Error ? error.message : "unknown");
      response.write("event: error\ndata: {\"code\":\"tts_unavailable\",\"message\":\"语音服务暂时不可用\"}\n\n");
      response.end();
    } finally {
      request.removeListener("aborted", abort);
    }
  });
}

function registerMessages(runtime: RouteRuntime) {
  runtime.router.get("/messages", async (request, response) => {
    try {
      const query = MessagePageSchema.parse(request.query);
      response.json(await runtime.service.listMessages(request.spaceId!, query.limit, query.cursor ?? null));
    } catch (error) { sendError(response, error); }
  });
  runtime.router.delete("/messages", async (request, response) => {
    try {
      await runtime.service.clearMessages(request.spaceId!);
      runtime.notify(request.spaceId!);
      response.status(204).end();
    } catch (error) { sendError(response, error); }
  });
}

function registerMemories(runtime: RouteRuntime) {
  runtime.router.get("/memories", async (request, response) => {
    try { response.json({ memories: await runtime.service.listMemories(request.spaceId!) }); }
    catch (error) { sendError(response, error); }
  });
  runtime.router.post("/memories", async (request, response) => {
    try {
      const proposal = MemoryConfirmationSchema.parse(request.body);
      const memory = await runtime.service.saveMemory(request.spaceId!, request.accountId!, proposal);
      runtime.notify(request.spaceId!);
      response.status(201).json({ memory });
    } catch (error) { sendError(response, error); }
  });
  runtime.router.delete("/memories/:id", async (request, response) => {
    try {
      const deleted = await runtime.service.deleteMemory(request.spaceId!, request.params.id);
      if (!deleted) return response.status(404).json({ error: "共同记忆不存在" });
      runtime.notify(request.spaceId!);
      response.status(204).end();
    } catch (error) { sendError(response, error); }
  });
}

function registerState(runtime: RouteRuntime) {
  runtime.router.get("/state", async (request, response) => {
    try { response.json(await runtime.service.getState(request.spaceId!, request.accountId!)); }
    catch (error) { sendError(response, error); }
  });
  runtime.router.put("/state", async (request, response) => {
    try {
      const preferences = MemberPreferencesSchema.parse(request.body);
      const state = await runtime.service.updateState(request.spaceId!, request.accountId!, preferences);
      runtime.notify(request.spaceId!);
      response.json(state);
    } catch (error) { sendError(response, error); }
  });
}

export function createCompanionRouter(options: CompanionRouterOptions = {}): Router {
  const router = Router();
  const service = options.service ?? createCompanionService();
  const tts = options.tts ?? createMimoTtsService();
  const asr = options.asr ?? createCompanionAsrService();
  const notify = (spaceId: string) => options.onChange?.(spaceId, "companion");
  const notifyResource = (spaceId: string, resource: string) => options.onChange?.(spaceId, resource);

  const runtime = { router, service, tts, asr, notify, notifyResource };
  registerRespond(runtime);
  registerChat(runtime);
  registerActions(runtime);
  registerAsr(runtime);
  registerTts(runtime);
  registerMessages(runtime);
  registerMemories(runtime);
  registerState(runtime);
  return router;
}
