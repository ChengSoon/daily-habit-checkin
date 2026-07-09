import Constants from "expo-constants";
import { Platform } from "react-native";
import { CurrentAppVersion, UpdatePlatform } from "./updateClient";

type NativeConstants = typeof Constants & {
  nativeAppVersion?: string | null;
  nativeBuildVersion?: string | null;
};

function currentPlatform(): UpdatePlatform {
  if (Platform.OS === "android" || Platform.OS === "ios" || Platform.OS === "web") {
    return Platform.OS;
  }
  return "unknown";
}

function parseBuildNumber(value: string | null | undefined): number | null {
  if (!value) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getCurrentAppVersion(): CurrentAppVersion {
  const nativeConstants = Constants as NativeConstants;
  const version = nativeConstants.nativeAppVersion ?? Constants.expoConfig?.version ?? "0.0.0";

  return {
    platform: currentPlatform(),
    version,
    buildNumber: parseBuildNumber(nativeConstants.nativeBuildVersion)
  };
}
