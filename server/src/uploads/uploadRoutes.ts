import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/authMiddleware.js";
import { createPresignedUpload, isAllowedImageMime, UploadKind } from "../r2/r2Client.js";

/**
 * 图片上传路由。客户端「先要签名、再直传 R2」：
 *   POST /api/uploads/presign  { kind, contentType } → { key, uploadUrl }
 * 客户端拿 uploadUrl 直接 PUT 图片到 R2，落库只存 key。图片字节不经过本服务。
 *
 * 全部需登录（requireAuth）。头像作用域用 accountId、奖励用 spaceId，
 * 仅用于组织对象路径，不做额外越权校验（key 含随机 UUID、桶按空间量级极小）。
 */

const PresignSchema = z.object({
  kind: z.enum(["avatar", "reward", "adventure_badge"]),
  contentType: z.string().min(1).max(64),
  sizeBytes: z.number().int().positive().optional()
});

const MAX_BADGE_BYTES = 5 * 1024 * 1024;

export function createUploadRouter(): Router {
  const router = Router();

  router.post("/presign", requireAuth, async (request, response) => {
    try {
      const input = PresignSchema.parse(request.body);
      if (input.kind === "adventure_badge") {
        if (request.role !== "owner") {
          response.status(403).json({ error: "仅空间创建者可上传关卡勋章" });
          return;
        }
        if (!input.sizeBytes || input.sizeBytes > MAX_BADGE_BYTES) {
          response.status(400).json({ error: "勋章图片不能超过 5 MB" });
          return;
        }
      }
      if (!isAllowedImageMime(input.contentType)) {
        response.status(400).json({ error: "不支持的图片类型（仅 jpeg/png/webp）" });
        return;
      }

      const kind = input.kind as UploadKind;
      // 头像归到本账号目录、奖励归到空间目录。
      const scope = kind === "avatar" ? request.accountId! : request.spaceId!;
      const result = await createPresignedUpload(kind, scope, input.contentType);
      response.json(result);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "获取上传地址失败" });
    }
  });

  return router;
}
