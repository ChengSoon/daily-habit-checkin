import { Router, type Response } from "express";
import { withTransaction } from "../db/pool.js";
import {
  cancelRedemptionInTransaction,
  fulfillRedemptionInTransaction,
  redeemRewardInTransaction
} from "./rewardCommandService.js";

function statusOf(error: unknown): number {
  const status = error && typeof error === "object" ? (error as { status?: unknown }).status : null;
  return typeof status === "number" ? status : 400;
}

function sendError(response: Response, error: unknown): void {
  response.status(statusOf(error)).json({
    error: error instanceof Error ? error.message : "奖励操作失败"
  });
}

export function createRewardCommandRouter(options: { onChange?: (spaceId: string, resource: string) => void } = {}) {
  const router = Router();

  router.post("/:id/redeem", async (request, response) => {
    try {
      const result = await withTransaction((client) => redeemRewardInTransaction(client, request.spaceId!, request.params.id));
      options.onChange?.(request.spaceId!, "reward_redemptions");
      options.onChange?.(request.spaceId!, "wallet");
      response.status(201).json(result);
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post("/redemptions/:id/fulfill", async (request, response) => {
    if (request.role !== "owner") {
      response.status(403).json({ error: "仅空间创建者可兑现奖励" });
      return;
    }
    try {
      const redemption = await withTransaction((client) =>
        fulfillRedemptionInTransaction(client, request.spaceId!, request.params.id)
      );
      options.onChange?.(request.spaceId!, "reward_redemptions");
      response.json({ redemption });
    } catch (error) {
      sendError(response, error);
    }
  });

  router.post("/redemptions/:id/cancel", async (request, response) => {
    if (request.role !== "owner") {
      response.status(403).json({ error: "仅空间创建者可取消兑换" });
      return;
    }
    try {
      const result = await withTransaction((client) =>
        cancelRedemptionInTransaction(client, request.spaceId!, request.params.id)
      );
      options.onChange?.(request.spaceId!, "reward_redemptions");
      options.onChange?.(request.spaceId!, "wallet");
      response.json(result);
    } catch (error) {
      sendError(response, error);
    }
  });
  return router;
}
