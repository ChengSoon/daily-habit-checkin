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
  kind: z.enum(["avatar", "reward", "adventure"]),
  contentType: z.string().min(1).max(64)
});

export function createUploadRouter(): Router {
  const router = Router();

  router.post("/presign", requireAuth, async (request, response) => {
    try {
      const input = PresignSchema.parse(request.body);
      if (!isAllowedImageMime(input.contentType)) {
        response.status(400).json({ error: "不支持的图片类型（仅 jpeg/png/webp）" });
        return;
      }

      const kind = input.kind as UploadKind;
      // 头像归账号目录；奖励/闯关图归空间目录。
      const scope = kind === "avatar" ? request.accountId! : request.spaceId!;
      const result = await createPresignedUpload(kind, scope, input.contentType);
      response.json(result);
    } catch (error) {
      response.status(400).json({ error: error instanceof Error ? error.message : "获取上传地址失败" });
    }
  });

  return router;
}
