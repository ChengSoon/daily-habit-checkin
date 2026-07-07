import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/**
 * 图片选择与压缩。图片改存 Cloudflare R2：选完先压缩到合理尺寸，产出「本地文件 URI」，
 * 再由 uploadClient 直传 R2（见 src/sync/uploadClient.ts）。base64 整条退场——
 * 图片字节不再进 JSON、不再进 Postgres。
 *
 * - 奖励图：缩到最长边 MAX_EDGE、JPEG 质量 COMPRESS_QUALITY（覆盖商城主图显示尺寸）。
 * - 头像：更小（AVATAR_MAX_EDGE / AVATAR_COMPRESS_QUALITY），展示尺寸本就很小。
 */

/** 奖励图片缩放后最长边的像素上限。 */
const MAX_EDGE = 1600;
/** 奖励图片 JPEG 压缩质量。 */
const COMPRESS_QUALITY = 0.7;

/**
 * 头像专用压缩参数。头像展示尺寸很小（最大 84px），256px 已绰绰有余，
 * 配 0.6 质量后文件通常只有 30-50KB，减少上传与首帧取图开销。
 */
const AVATAR_MAX_EDGE = 256;
const AVATAR_COMPRESS_QUALITY = 0.6;

export type PickedImage = {
  /** 本地文件 URI（压缩后的产物），用于预览与上传。 */
  uri: string;
  /** MIME 类型，压缩后统一为 image/jpeg。 */
  mime: string;
};

export type PickResult =
  | { status: "picked"; image: PickedImage }
  | { status: "cancelled" }
  | { status: "denied" };

/**
 * 缩放 + 压缩到合理尺寸，返回本地文件 URI。
 * 只在原图超过 maxEdge 时缩放，避免把小图放大。
 */
async function compressToFile(
  uri: string,
  maxEdge: number = MAX_EDGE,
  quality: number = COMPRESS_QUALITY
): Promise<PickedImage> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: maxEdge } }],
    { compress: quality, format: ImageManipulator.SaveFormat.JPEG }
  );

  return { uri: result.uri, mime: "image/jpeg" };
}

async function handlePicked(
  result: ImagePicker.ImagePickerResult,
  maxEdge: number = MAX_EDGE,
  quality: number = COMPRESS_QUALITY
): Promise<PickResult> {
  if (result.canceled || result.assets.length === 0) {
    return { status: "cancelled" };
  }
  const image = await compressToFile(result.assets[0].uri, maxEdge, quality);
  return { status: "picked", image };
}

/** 从相册选择一张图片并压缩。 */
export async function pickRewardImageFromLibrary(): Promise<PickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { status: "denied" };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [4, 3]
  });

  return handlePicked(result);
}

/** 拍照并压缩。 */
export async function captureRewardImage(): Promise<PickResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return { status: "denied" };
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3]
  });

  return handlePicked(result);
}

/**
 * 从相册选择一张头像并压缩（方形 1:1 裁剪 + 256px/0.6，产出更小）。
 */
export async function pickAvatarFromLibrary(): Promise<PickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { status: "denied" };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1]
  });

  return handlePicked(result, AVATAR_MAX_EDGE, AVATAR_COMPRESS_QUALITY);
}
