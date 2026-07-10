import { File } from "expo-file-system";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { validateBadgeImageMetadata, validateBadgeImageMime } from "./adventureBadgeValidation";

const BADGE_EDGE = 768;

export type PickedBadgeImage = {
  uri: string;
  mime: "image/webp";
  sizeBytes: number;
};

export type BadgePickResult =
  | { status: "picked"; image: PickedBadgeImage }
  | { status: "cancelled" }
  | { status: "denied" };

export async function pickAdventureBadgeFromLibrary(): Promise<BadgePickResult> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: "denied" };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1]
  });
  if (result.canceled || result.assets.length === 0) return { status: "cancelled" };

  const asset = result.assets[0];
  validateBadgeImageMime(asset.mimeType ?? "image/jpeg");
  const output = await ImageManipulator.manipulateAsync(
    asset.uri,
    [{ resize: { width: BADGE_EDGE } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.WEBP }
  );
  const file = new File(output.uri);
  const sizeBytes = file.size;
  validateBadgeImageMetadata("image/webp", sizeBytes);
  return { status: "picked", image: { uri: output.uri, mime: "image/webp", sizeBytes } };
}
