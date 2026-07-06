import "express";

declare global {
  namespace Express {
    interface Request {
      /** 由 requireAuth 中间件解析出的当前账号 ID。 */
      accountId?: string;
      /** 由 requireAuth 中间件解析出的当前空间 ID。 */
      spaceId?: string;
    }
  }
}
