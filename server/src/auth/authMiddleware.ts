import type { NextFunction, Request, Response } from "express";
import { getAccountById } from "./accountRepository.js";
import { verifyToken } from "./tokens.js";

/**
 * 校验 Authorization: Bearer <token>。
 * 通过后把 accountId 与 spaceId 挂到 request 上，供后续按空间隔离数据使用。
 */
export async function requireAuth(request: Request, response: Response, next: NextFunction): Promise<void> {
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

  // token 合法，但账号可能已被删除（如清理数据后旧 token 仍在客户端）。
  // 此时统一返回 401，让客户端清掉失效 token 并引导重新登录，
  // 避免下游拿着已失效的 spaceId 去写库撞外键约束（500）。
  try {
    const account = await getAccountById(payload.accountId);
    if (!account) {
      response.status(401).json({ error: "登录已失效，请重新登录" });
      return;
    }

    // 以库中最新的 spaceId / role 为准（token 里的可能因加入/退出空间而过期）。
    request.accountId = account.id;
    request.spaceId = account.spaceId;
    request.role = account.role;
    next();
  } catch (error) {
    response.status(500).json({ error: error instanceof Error ? error.message : "校验登录状态失败" });
  }
}
