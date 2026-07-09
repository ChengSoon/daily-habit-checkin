import { apiRequest } from "../sync/apiClient";
import { isRemoteNewer } from "./versionCompare";

export type UpdatePlatform = "android" | "ios" | "web" | "unknown";

export type CurrentAppVersion = {
  platform: UpdatePlatform;
  version: string;
  buildNumber?: number | null;
};

export type AppUpdateManifest = {
  platform: "android";
  version: string;
  buildNumber?: number;
  mandatory?: boolean;
  releaseDate?: string;
  notes?: string;
  downloadUrl: string;
  sha256: string;
  sizeBytes: number;
};

export type AppUpdateCheckResult =
  | { status: "available"; current: CurrentAppVersion; update: AppUpdateManifest }
  | { status: "current"; current: CurrentAppVersion; update: AppUpdateManifest }
  | { status: "unconfigured"; current: CurrentAppVersion }
  | { status: "unsupported"; current: CurrentAppVersion };

export async function checkForAppUpdate(current: CurrentAppVersion): Promise<AppUpdateCheckResult> {
  if (current.platform !== "android") {
    return { status: "unsupported", current };
  }

  const update = await apiRequest<AppUpdateManifest | undefined>("/api/app-update/latest?platform=android", {
    anonymous: true
  });

  if (!update) {
    return { status: "unconfigured", current };
  }

  if (isRemoteNewer(update, current)) {
    return { status: "available", current, update };
  }

  return { status: "current", current, update };
}
