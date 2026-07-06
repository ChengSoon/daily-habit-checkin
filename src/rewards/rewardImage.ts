import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

/**
 * 奖励图片选择与压缩。图片以 base64 存入数据库（image_data + image_mime），
 * 不再落本地文件。为避免 base64 过大撞服务端请求体上限，上传前统一：
 * - 缩到最长边不超过 MAX_EDGE 像素
 * - 以 JPEG 质量 0.7 压缩
 *
 * 1600px JPEG 通常 300-800KB，base64 后约 500-900KB，远低于服务端 8MB 上限，
 * 同时覆盖商城主图显示尺寸并留有放大余量。
 */

/** 缩放后最长边的像素上限。 */
const MAX_EDGE = 1600;
/** JPEG 压缩质量。 */
const COMPRESS_QUALITY = 0.7;

export type PickedImage = {
  /** 纯 base64（不含 data: 前缀） */
  data: string;
  /** MIME 类型，压缩后统一为 image/jpeg */
  mime: string;
};

export type PickResult =
  | { status: "picked"; image: PickedImage }
  | { status: "cancelled" }
  | { status: "denied" };

/** 把 base64 与 mime 拼成可直接用于 <Image source={{ uri }}> 的 data URI。 */
export function toDataUri(data: string | null, mime: string | null): string | null {
  if (!data) {
    return null;
  }
  return `data:${mime ?? "image/jpeg"};base64,${data}`;
}

/**
 * 缩放 + 压缩到合理尺寸，并返回 base64。
 * 只在原图超过 MAX_EDGE 时缩放，避免把小图放大。
 */
async function compressToBase64(uri: string): Promise<PickedImage> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_EDGE } }],
    { compress: COMPRESS_QUALITY, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );

  if (!result.base64) {
    throw new Error("图片处理失败");
  }

  return { data: result.base64, mime: "image/jpeg" };
}

async function handlePicked(result: ImagePicker.ImagePickerResult): Promise<PickResult> {
  if (result.canceled || result.assets.length === 0) {
    return { status: "cancelled" };
  }
  const image = await compressToBase64(result.assets[0].uri);
  return { status: "picked", image };
}

/** 从相册选择一张图片并压缩为 base64。 */
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

/** 拍照并压缩为 base64。 */
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
