import { Router, type Response } from "express";
import { z, ZodError } from "zod";
import {
  CompanionChatRequestSchema,
  CompanionEventSchema,
  MemberPreferencesSchema,
  MemoryConfirmationSchema
} from "./companionSchemas.js";
import {
  CompanionEventInProgressError,
  createCompanionService,
  type CompanionService
} from "./companionService.js";

type CompanionRouterOptions = {
  service?: CompanionService;
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
  console.warn("companion request failed", error);
  response.status(503).json({ error: "卡卡暂时没接上话，请稍后再试" });
}

export function createCompanionRouter(options: CompanionRouterOptions = {}): Router {
  const router = Router();
  const service = options.service ?? createCompanionService();
  const notify = (spaceId: string) => options.onChange?.(spaceId, "companion");

  router.post("/respond", async (request, response) => {
    try {
      const { event } = RespondRequestSchema.parse(request.body);
      const reply = await service.respond({
        spaceId: request.spaceId!,
        accountId: request.accountId!,
        event
      });
      if (reply.decision === "speak") notify(request.spaceId!);
      response.json(reply);
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post("/chat", async (request, response) => {
    let started = false;
    try {
      const input = CompanionChatRequestSchema.parse(request.body);
      response.status(200);
      response.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      response.setHeader("Cache-Control", "no-cache, no-transform");
      response.setHeader("Connection", "keep-alive");
      response.flushHeaders?.();
      started = true;
      await service.chat(
        { spaceId: request.spaceId!, accountId: request.accountId!, input },
        (delta) => response.write(`data: ${JSON.stringify({ delta })}\n\n`)
      );
      response.write("data: [DONE]\n\n");
      response.end();
      notify(request.spaceId!);
    } catch (error) {
      if (!started) {
        sendError(response, error);
        return;
      }
      console.warn("companion stream failed", error);
      response.write(`event: error\ndata: ${JSON.stringify({ error: "回复中断，请重试" })}\n\n`);
      response.end();
    }
  });

  router.get("/messages", async (request, response) => {
    try {
      const query = MessagePageSchema.parse(request.query);
      response.json(await service.listMessages(request.spaceId!, query.limit, query.cursor ?? null));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.delete("/messages", async (request, response) => {
    try {
      await service.clearMessages(request.spaceId!);
      notify(request.spaceId!);
      response.status(204).end();
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get("/memories", async (request, response) => {
    try {
      response.json({ memories: await service.listMemories(request.spaceId!) });
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post("/memories", async (request, response) => {
    try {
      const proposal = MemoryConfirmationSchema.parse(request.body);
      const memory = await service.saveMemory(request.spaceId!, request.accountId!, proposal);
      notify(request.spaceId!);
      response.status(201).json({ memory });
    } catch (error) {
      sendError(response, error);
    }
  });

  router.delete("/memories/:id", async (request, response) => {
    try {
      const deleted = await service.deleteMemory(request.spaceId!, request.params.id);
      if (!deleted) {
        response.status(404).json({ error: "共同记忆不存在" });
        return;
      }
      notify(request.spaceId!);
      response.status(204).end();
    } catch (error) {
      sendError(response, error);
    }
  });

  router.get("/state", async (request, response) => {
    try {
      response.json(await service.getState(request.spaceId!, request.accountId!));
    } catch (error) {
      sendError(response, error);
    }
  });

  router.put("/state", async (request, response) => {
    try {
      const preferences = MemberPreferencesSchema.parse(request.body);
      const state = await service.updateState(request.spaceId!, request.accountId!, preferences);
      notify(request.spaceId!);
      response.json(state);
    } catch (error) {
      sendError(response, error);
    }
  });

  return router;
}
