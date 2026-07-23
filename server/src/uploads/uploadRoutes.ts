import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../auth/authMiddleware.js";
import { createPresignedUpload, isAllowedImageMime, UploadKind } from "../r2/r2Client.js";

/**
 * 图片上传路由。客户端「先要签名、再直传 R2」：
 *   POST /api/uploads/presign  { kind, contentType, sizeBytes } → { key, uploadUrl, fields }
 * 客户端按签名字段 multipart POST 图片到 R2，落库只存 key。图片字节不经过本服务。
 *
 * 全部需登录（requireAuth）。头像作用域用 accountId、奖励/闯关用 spaceId。
 * reward/adventure 图仅 owner 可传；adventure 单图限制 8 MB。
 */

const MAX_UPLOAD_BYTES: Record<UploadKind, number> = {
  avatar: 1024 * 1024,
  reward: 5 * 1024 * 1024,
  adventure: 8 * 1024 * 1024
};

const PresignSchema = z.object({
  kind: z.enum(["avatar", "reward", "adventure"]),
  contentType: z.string().min(1).max(64),
  sizeBytes: z.number().int().positive()
});

export function createUploadRouter(): Router {
  const router = Router();

  router.post("/presign", requireAuth, async (request, response) => {
    try {
      const input = PresignSchema.parse(request.body);
      if (input.kind !== "avatar" && request.role !== "owner") {
        response.status(403).json({ error: "仅空间创建者可上传共享资源图片" });
        return;
      }
      if (!isAllowedImageMime(input.contentType)) {
        response.status(400).json({ error: "不支持的图片类型（仅 jpeg/png/webp/gif）" });
        return;
      }

      const kind = input.kind as UploadKind;
      if (input.sizeBytes > MAX_UPLOAD_BYTES[kind]) {
        response.status(400).json({ error: "图片大小超过该类型的上传限制" });
        return;
      }
      const scope = kind === "avatar" ? request.accountId! : request.spaceId!;
      const result = await createPresignedUpload({ kind, scope, contentType: input.contentType, sizeBytes: input.sizeBytes });
      response.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        response.status(400).json({ error: "上传参数不合法" });
        return;
      }
      console.error("R2 上传签名生成失败", error);
      response.status(500).json({ error: "获取上传地址失败" });
    }
  });

  return router;
}
