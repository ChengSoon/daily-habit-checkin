import type { NextFunction, Request, Response } from "express";

/**
 * 可选 API Key 校验。
 * 仅当环境变量 API_KEY 被设置时才启用；未设置时放行（方便本地开发）。
 * 客户端通过 `x-api-key` 请求头携带密钥。
 */
export function requireApiKey(request: Request, response: Response, next: NextFunction): void {
  const expected = process.env.API_KEY;

  if (!expected) {
    next();
    return;
  }

  const provided = request.header("x-api-key");

  if (provided !== expected) {
    response.status(401).json({ error: "未授权：缺少或错误的 API Key" });
    return;
  }

  next();
}

type WindowState = { count: number; resetAt: number };

/**
 * 简单的内存滑动窗口限流，按客户端 IP 计数。
 * 默认每个 IP 每分钟最多 RATE_LIMIT_MAX 次（默认 20）。
 * 单实例部署足够；多实例需换成 Redis 等共享存储。
 */
export function createRateLimiter(options?: { windowMs?: number; max?: number }) {
  const windowMs = options?.windowMs ?? 60_000;
  const max = options?.max ?? Number(process.env.RATE_LIMIT_MAX ?? 20);
  const buckets = new Map<string, WindowState>();

  return function rateLimit(request: Request, response: Response, next: NextFunction): void {
    const now = Date.now();
    const key = request.ip ?? request.socket.remoteAddress ?? "unknown";
    const state = buckets.get(key);

    if (!state || now >= state.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (state.count >= max) {
      const retryAfterSeconds = Math.ceil((state.resetAt - now) / 1000);
      response.setHeader("Retry-After", String(retryAfterSeconds));
      response.status(429).json({ error: "请求过于频繁，请稍后再试" });
      return;
    }

    state.count += 1;
    next();
  };
}
