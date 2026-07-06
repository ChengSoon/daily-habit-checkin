import cors from "cors";
import "dotenv/config";
import express from "express";
import { requireAuth } from "./auth/authMiddleware.js";
import { authRouter } from "./auth/authRoutes.js";
import { createDataRouter, createWalletRouter } from "./data/dataRoutes.js";
import { runSchema } from "./db/schema.js";
import { createRateLimiter, requireApiKey } from "./middleware.js";
import { generateHabitPlan } from "./openaiHabitPlanner.js";

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

// 账号与空间：注册、登录、加入空间、当前账号信息
app.use("/api/auth", authRouter);

// 业务数据同步（全部需登录，按 space_id 隔离）
app.use("/api/data", requireAuth, createDataRouter());
app.use("/api/wallet", requireAuth, createWalletRouter());

async function start(): Promise<void> {
  if (process.env.DATABASE_URL) {
    await runSchema();
    console.log("数据库表已就绪");
  }
  app.listen(port, () => {
    console.log(`Habit server listening on http://localhost:${port}`);
  });
}

start().catch((error) => {
  console.error("启动失败", error);
  process.exit(1);
});
