import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { createId } from "../utils/id";

const IMAGE_DIRECTORY = `${FileSystem.documentDirectory}reward-images/`;

async function ensureDirectory(): Promise<void> {
  const info = await FileSystem.getInfoAsync(IMAGE_DIRECTORY);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(IMAGE_DIRECTORY, { intermediates: true });
  }
}

function extensionFromUri(uri: string): string {
  const match = /\.(\w+)(?:\?.*)?$/.exec(uri);
  const ext = match?.[1]?.toLowerCase();
  return ext && ext.length <= 5 ? ext : "jpg";
}

/**
 * 把图片持久化到 App 文档目录，返回可长期使用的本地路径。
 * ImagePicker 返回的 URI 位于缓存目录，可能被系统清理，因此需要复制一份。
 */
async function persistImage(sourceUri: string): Promise<string> {
  await ensureDirectory();
  const target = `${IMAGE_DIRECTORY}${createId("reward-img")}.${extensionFromUri(sourceUri)}`;
  await FileSystem.copyAsync({ from: sourceUri, to: target });
  return target;
}

/**
 * 删除已持久化的奖励图片。只清理位于我们自己目录下的文件，避免误删外部路径。
 */
export async function deleteRewardImage(uri: string | null): Promise<void> {
  if (!uri || !uri.startsWith(IMAGE_DIRECTORY)) {
    return;
  }
  await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => undefined);
}

export type PickResult =
  | { status: "picked"; uri: string }
  | { status: "cancelled" }
  | { status: "denied" };

async function handlePicked(
  result: ImagePicker.ImagePickerResult
): Promise<PickResult> {
  if (result.canceled || result.assets.length === 0) {
    return { status: "cancelled" };
  }
  const persisted = await persistImage(result.assets[0].uri);
  return { status: "picked", uri: persisted };
}

/** 从相册选择一张图片并持久化。 */
export async function pickRewardImageFromLibrary(): Promise<PickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return { status: "denied" };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8
  });

  return handlePicked(result);
}

/** 拍照并持久化。 */
export async function captureRewardImage(): Promise<PickResult> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    return { status: "denied" };
  }

  const result = await ImagePicker.launchCameraAsync({
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.8
  });

  return handlePicked(result);
}
