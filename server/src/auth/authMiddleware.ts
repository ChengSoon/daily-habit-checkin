import type { NextFunction, Request, Response } from "express";
import { verifyToken } from "./tokens.js";

/**
 * 校验 Authorization: Bearer <token>。
 * 通过后把 accountId 与 spaceId 挂到 request 上，供后续按空间隔离数据使用。
 */
export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  const header = request.header("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);

  if (!match) {
    response.status(401).json({ error: "未登录：缺少访问令牌" });
    return;
  }

  const payload = verifyToken(match[1]);

  if (!payload) {
    response.status(401).json({ error: "登录已失效，请重新登录" });
    return;
  }

  request.accountId = payload.accountId;
  request.spaceId = payload.spaceId;
  next();
}
