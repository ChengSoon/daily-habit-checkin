import { Router } from "express";
import { z } from "zod";
import {
  deleteTokenForAccount,
  deleteTokens,
  listTokensForAccount,
  upsertDevicePushToken
} from "./pushTokenRepository.js";
import { getGetuiConfigError, isGetuiConfigured, sendGetuiToCids } from "./getuiClient.js";
import { runHabitReminderPushTick } from "./reminderPushJob.js";

const RegisterSchema = z.object({
  token: z.string().min(10).max(4096),
  platform: z.literal("android"),
  provider: z.literal("getui")
});

const TestSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  body: z.string().min(1).max(200).optional()
});

export function createPushRouter(): Router {
  const router = Router();

  router.get("/status", (_request, response) => {
    response.json({
      provider: "getui",
      configured: isGetuiConfigured(),
      error: getGetuiConfigError()
    });
  });

  /** Android 客户端上报个推 CID。 */
  router.put("/token", async (request, response) => {
    try {
      const body = RegisterSchema.parse(request.body);
      const saved = await upsertDevicePushToken({
        accountId: request.accountId!,
        spaceId: request.spaceId!,
        token: body.token,
        platform: body.platform,
        provider: body.provider
      });
      response.json({
        ok: true,
        token: {
          id: saved.id,
          platform: saved.platform,
          provider: saved.provider,
          updatedAt: saved.updatedAt
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "注册推送令牌失败";
      response.status(400).json({ error: message });
    }
  });

  router.delete("/token", async (request, response) => {
    try {
      const token = z.string().min(10).parse(request.body?.token ?? request.query.token);
      await deleteTokenForAccount(request.accountId!, token);
      response.status(204).end();
    } catch (error) {
      const message = error instanceof Error ? error.message : "删除失败";
      response.status(400).json({ error: message });
    }
  });

  /** 给当前账号所有设备发一条测试推送 */
  router.post("/test", async (request, response) => {
    try {
      if (!isGetuiConfigured()) {
        response.status(503).json({ error: getGetuiConfigError() ?? "个推未配置" });
        return;
      }

      const body = TestSchema.parse(request.body ?? {});
      const devices = await listTokensForAccount(request.accountId!);
      if (devices.length === 0) {
        response.status(400).json({ error: "尚未登记推送令牌，请先打开 App 并允许通知" });
        return;
      }

      const result = await sendGetuiToCids(
        devices.map((d) => d.token),
        {
          title: body.title ?? "推送测试",
          body: body.body ?? "若看到这条，说明个推服务端推送已打通。",
          data: { kind: "test" }
        }
      );

      if (result.invalidTokens.length > 0) {
        await deleteTokens(result.invalidTokens);
      }

      response.json({
        ok: true,
        deviceCount: devices.length,
        successCount: result.successCount,
        failureCount: result.failureCount
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "测试推送失败";
      response.status(400).json({ error: message });
    }
  });

  /** 手动触发一次到点扫描（调试用） */
  router.post("/run-tick", async (_request, response) => {
    try {
      const summary = await runHabitReminderPushTick();
      response.json({ ok: true, ...summary });
    } catch (error) {
      const message = error instanceof Error ? error.message : "执行失败";
      response.status(500).json({ error: message });
    }
  });

  return router;
}
