import cors from "cors";
import "./env.js";
import express from "express";
import { createAdventureRouter } from "./adventure/adventureRoutes.js";
import { createAppUpdateRouter } from "./appUpdate/appUpdateRoutes.js";
import { requireAuth } from "./auth/authMiddleware.js";
import { authRouter } from "./auth/authRoutes.js";
import { createCompanionRouter } from "./companion/companionRoutes.js";
import { createDataRouter, createWalletRouter } from "./data/dataRoutes.js";
import { createSettingsRouter } from "./data/settingsRoutes.js";
import { runSchema } from "./db/schema.js";
import { createRateLimiter, requireApiKey } from "./middleware.js";
import { chatWithModel, streamChatWithModel } from "./openaiChat.js";
import { generateHabitPlan } from "./openaiHabitPlanner.js";
import { syncChangeHub } from "./sync/changeHub.js";
import { attachSyncWebSocketServer } from "./sync/syncWebSocketServer.js";
import { createUploadRouter } from "./uploads/uploadRoutes.js";
import { createPushRouter } from "./push/pushRoutes.js";
import { startHabitReminderPushScheduler } from "./push/reminderPushJob.js";

const app = express();
const port = Number(process.env.PORT ?? 8787);

app.use(cors());
// 图片以 base64 存入数据库，放宽请求体上限以容纳压缩后的图片
app.use(express.json({ limit: "8mb" }));

// 每个来源默认 1 分钟 10 次，防止刷爆 OpenAI 额度
const rateLimit = createRateLimiter({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  max: Number(process.env.RATE_LIMIT_MAX ?? 10)
});

app.get("/health", (_request, response) => {
  response.json({ ok: true });
});

app.post("/api/ai/habit-plan", requireApiKey, rateLimit, async (request, response) => {
  try {
    const plan = await generateHabitPlan(request.body);
    response.json(plan);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    response.status(400).json({ error: message });
  }
});

app.post("/api/ai/chat", requireApiKey, rateLimit, async (request, response) => {
  try {
    if (request.body?.stream) {
      await streamChatWithModel(request.body, response);
      return;
    }
    const result = await chatWithModel(request.body);
    response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (!response.headersSent) {
      response.status(400).json({ error: message });
      return;
    }
    response.end();
  }
});

// App 更新 manifest 代理。匿名可访问，避免客户端直接依赖 GitHub/R2 细节。
app.use("/api/app-update", createAppUpdateRouter());

// 账号与空间：注册、登录、加入空间、当前账号信息
app.use("/api/auth", authRouter);

// 业务数据同步（全部需登录，按 space_id 隔离）
const notifySyncChange = (spaceId: string, resource: string) => {
  syncChangeHub.notifyChange(spaceId, resource);
};
app.use("/api/uploads", createUploadRouter());
app.use(
  "/api/companion",
  requireAuth,
  rateLimit,
  createCompanionRouter({ onChange: notifySyncChange })
);
app.use("/api/adventure", requireAuth, createAdventureRouter({ onChange: notifySyncChange }));
app.use("/api/data", requireAuth, createDataRouter({ onChange: notifySyncChange }));
app.use("/api/wallet", requireAuth, createWalletRouter({ onChange: notifySyncChange }));
app.use("/api/settings", requireAuth, createSettingsRouter({ onChange: notifySyncChange }));
app.use("/api/push", requireAuth, createPushRouter());

async function start(): Promise<void> {
  if (process.env.DATABASE_URL) {
    try {
      await runSchema();
      console.log("数据库表已就绪");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("启动失败：无法连接数据库");
      console.error(`  DATABASE_URL host 解析结果应可访问（当前: ${maskDatabaseUrl(process.env.DATABASE_URL)}）`);
      console.error("  常见原因：Postgres 未启动、端口未映射到宿主机、端口不是 5432");
      console.error("  本机 Docker 可先执行：");
      console.error("    cd server && docker compose -f docker-compose.local.yml --env-file .env up -d db");
      console.error("  然后检查：");
      console.error("    docker compose -f docker-compose.local.yml ps");
      console.error("    lsof -nP -iTCP:5432 -sTCP:LISTEN");
      console.error("原始错误:", message);
      process.exit(1);
    }
  } else {
    console.warn("DATABASE_URL 未设置，账号与同步相关接口将不可用。");
  }
  const server = app.listen(port, () => {
    console.log(`Habit server listening on http://localhost:${port}`);
  });
  attachSyncWebSocketServer(server);
  startHabitReminderPushScheduler();
}

function maskDatabaseUrl(url: string): string {
  return url.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
}

start().catch((error) => {
  console.error("启动失败", error);
  process.exit(1);
});
