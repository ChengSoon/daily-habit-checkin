import { randomUUID } from "node:crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Cloudflare R2（S3 兼容）客户端。图片走「presigned PUT 直传 + 公开域名直读」：
 * - 服务端只签发上传用的临时 URL，不经手图片字节；
 * - 客户端拿 URL 直接 PUT 到 R2；显示时用公开域名拼 key 直连（走 CDN）。
 *
 * 需要的环境变量（缺任一则 R2 相关端点返回 500，其余接口不受影响）：
 *   R2_ACCOUNT_ID          Cloudflare 账号 ID，用于拼 endpoint
 *   R2_ACCESS_KEY_ID       R2 API Token 的 Access Key ID
 *   R2_SECRET_ACCESS_KEY   R2 API Token 的 Secret Access Key
 *   R2_BUCKET              目标存储桶名
 */

/** 允许上传的图片 MIME 白名单 → 落库对象的扩展名。 */
const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

/** presigned URL 有效期（秒）。够客户端压缩后上传，又不至于长期有效。 */
const UPLOAD_URL_TTL_SECONDS = 300;

export type UploadKind = "avatar" | "reward";

let client: S3Client | null = null;

function getConfig(): {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
} {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("R2 未配置：需要 R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET");
  }
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function getClient(): { s3: S3Client; bucket: string } {
  const config = getConfig();
  if (!client) {
    // R2 的 S3 endpoint 固定为 https://<accountId>.r2.cloudflarestorage.com，region 用 "auto"。
    client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey
      }
    });
  }
  return { s3: client, bucket: config.bucket };
}

/** MIME 是否在白名单内。 */
export function isAllowedImageMime(mime: string): boolean {
  return mime in EXT_BY_MIME;
}

/**
 * 为一次上传生成对象 key 与 presigned PUT URL。
 * key 按 kind + 作用域（账号/空间）+ 随机 UUID 组织，避免碰撞也便于人工排查。
 *
 * @param scope 作用域标识（头像用 accountId、奖励用 spaceId），仅用于组织路径。
 */
export async function createPresignedUpload(
  kind: UploadKind,
  scope: string,
  contentType: string
): Promise<{ key: string; uploadUrl: string }> {
  const ext = EXT_BY_MIME[contentType];
  if (!ext) {
    throw new Error("不支持的图片类型");
  }

  const prefix = kind === "avatar" ? "avatars" : "rewards";
  const key = `${prefix}/${scope}/${randomUUID()}.${ext}`;

  const { s3, bucket } = getClient();
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS }
  );

  return { key, uploadUrl };
}
