import { Router } from "express";
import { z } from "zod";
import { advanceAdventureProgress } from "../adventure/adventureService.js";
import { withTransaction } from "../db/pool.js";
import { completeCheckInInTransaction, undoCheckInInTransaction } from "./checkinCommandService.js";

const CompleteSchema = z.object({
  habitId: z.string().min(1).max(128),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  value: z.number().finite().nullable(),
  note: z.string().max(1000).nullable(),
  timezoneOffsetMinutes: z.number().int().min(-840).max(840)
}).strict();

const UndoSchema = z.object({
  habitId: z.string().min(1).max(128),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/u),
  checkInId: z.string().min(1).max(128)
}).strict();

function statusOf(error: unknown): number {
  const status = error && typeof error === "object" ? (error as { status?: unknown }).status : null;
  return typeof status === "number" ? status : 400;
}

export function createCheckInRouter(options: { onChange?: (spaceId: string, resource: string) => void } = {}) {
  const router = Router();
  router.post("/complete", async (request, response) => {
    try {
      const input = CompleteSchema.parse(request.body);
      const result = await withTransaction((client) =>
        completeCheckInInTransaction({ db: client, spaceId: request.spaceId!, accountId: request.accountId!, input })
      );
      options.onChange?.(request.spaceId!, "check_ins");
      if (result.earnedDelta > 0) {
        options.onChange?.(request.spaceId!, "wallet");
        try {
          await advanceAdventureProgress(request.spaceId!);
          options.onChange?.(request.spaceId!, "adventure");
        } catch (error) {
          console.error("打卡成功后推进闯关进度失败", error);
        }
      }
      response.json(result);
    } catch (error) {
      response.status(statusOf(error)).json({ error: error instanceof Error ? error.message : "打卡失败" });
    }
  });
  router.post("/undo", async (request, response) => {
    try {
      const input = UndoSchema.parse(request.body);
      const result = await withTransaction((client) =>
        undoCheckInInTransaction({ db: client, spaceId: request.spaceId!, input })
      );
      options.onChange?.(request.spaceId!, "check_ins");
      options.onChange?.(request.spaceId!, "wallet");
      response.json(result);
    } catch (error) {
      response.status(statusOf(error)).json({ error: error instanceof Error ? error.message : "撤销失败" });
    }
  });
  return router;
}
