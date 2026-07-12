import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/authMiddleware.js";
import { createPresignedUpload, isAllowedImageMime, UploadKind } from "../r2/r2Client.js";

/**
 * 图片上传路由。客户端「先要签名、再直传 R2」：
 *   POST /api/uploads/presign  { kind, contentType, sizeBytes? } → { key, uploadUrl }
 * 客户端拿 uploadUrl 直接 PUT 图片到 R2，落库只存 key。图片字节不经过本服务。
 *
 * 全部需登录（requireAuth）。头像作用域用 accountId、奖励/闯关用 spaceId。
 * adventure 图仅 owner 可传，并限制 5MB。
 */

const MAX_ADVENTURE_BYTES = 5 * 1024 * 1024;

const PresignSchema = z.object({
  kind: z.enum(["avatar", "reward", "adventure"]),
  contentType: z.string().min(1).max(64),
  sizeBytes: z.number().int().positive().optional()
});

export function createUploadRouter(): Router {
  const router = Router();

  router.post("/presign", requireAuth, async (request, response) => {
    try {
      const input = PresignSchema.parse(request.body);
      if (input.kind === "adventure") {
        if (request.role !== "owner") {
          response.status(403).json({ error: "仅空间创建者可上传闯关图片" });
          return;
        }
        if (input.sizeBytes !== undefined && input.sizeBytes > MAX_ADVENTURE_BYTES) {
          response.status(400).json({ error: "闯关图片不能超过 5 MB" });
          return;
        }
      }
      if (!isAllowedImageMime(input.contentType)) {
        response.status(400).json({ error: "不支持的图片类型（仅 jpeg/png/webp）" });
        return;
      }

      const kind = input.kind as UploadKind;
      const scope = kind === "avatar" ? request.accountId! : request.spaceId!;
      const result = await createPresignedUpload(kind, scope, input.contentType);
      response.json(result);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "获取上传地址失败" });
    }
  });

  return router;
}
