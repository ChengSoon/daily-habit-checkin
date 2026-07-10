import { File, UploadType } from "expo-file-system";
import { apiRequest } from "./apiClient";
import type { PickedImage } from "../rewards/rewardImage";
export { publicUrl } from "./publicUrl";

/**
 * 图片上传客户端。走「先要签名、再直传 R2」：
 *   1. POST /api/uploads/presign 拿 { key, uploadUrl }
 *   2. 把压缩后的图片字节 PUT 到 uploadUrl（直传 R2，不经本服务）
 *   3. 落库只存返回的 key；显示时用 publicUrl(key) 拼 R2 公开域名直读。
 *
 * 图片字节完全不经过后端与 Postgres，这是把接口从「拖着几百 KB base64」
 * 彻底解放出来的关键。
 */

export type UploadKind = "avatar" | "reward" | "adventure_badge";

type PresignResponse = { key: string; uploadUrl: string };

/**
 * 上传一张已选好的本地图片到 R2，返回落库用的对象 key。
 * picked.uri 是本地文件 URI（相册/相机选完并压缩后的产物）。
 */
export async function uploadImage(
  kind: UploadKind,
  picked: PickedImage & { sizeBytes?: number }
): Promise<string> {
  const { key, uploadUrl } = await apiRequest<PresignResponse>("/api/uploads/presign", {
    method: "POST",
    body: {
      kind,
      contentType: picked.mime,
      ...(picked.sizeBytes === undefined ? {} : { sizeBytes: picked.sizeBytes })
    }
  });

  // 走 expo-file-system 的原生文件上传，避开 RN Blob 对 ArrayBuffer 的限制。
  const file = new File(picked.uri);
  const putResponse = await file.upload(uploadUrl, {
    httpMethod: "PUT",
    uploadType: UploadType.BINARY_CONTENT,
    mimeType: picked.mime,
    headers: { "Content-Type": picked.mime }
  });

  if (putResponse.status < 200 || putResponse.status >= 300) {
    throw new Error(`图片上传失败（${putResponse.status}）`);
  }

  return key;
}
