import * as Notifications from "expo-notifications";
import { apiRequest } from "../sync/apiClient";
import { getGetuiClientId } from "./getuiClient";

/**
 * Android 客户端个推 CID 上报。
 * 个推是原生模块，Expo Go 不包含该模块，需使用 dev/production 安装包。
 */

function isWebRuntime(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  );
}

function getPlatform(): "android" | "ios" | "web" {
  try {
    // 动态 require，避免 vitest 加载 RN
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Platform } = require("react-native") as typeof import("react-native");
    if (Platform.OS === "ios") {
      return "ios";
    }
    if (Platform.OS === "android") {
      return "android";
    }
    return "web";
  } catch {
    return "web";
  }
}

export async function registerDevicePushToken(): Promise<{ ok: boolean; reason?: string }> {
  if (isWebRuntime()) {
    return { ok: false, reason: "web" };
  }

  const platform = getPlatform();
  if (platform !== "android") {
    return { ok: false, reason: "unsupported-platform" };
  }

  try {
    const permission = await Notifications.getPermissionsAsync();
    let granted = permission.granted;
    if (!granted && permission.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      granted = requested.granted;
    }
    if (!granted) {
      return { ok: false, reason: "permission" };
    }

    const token = await getGetuiClientId();

    await apiRequest<{ ok: boolean }>("/api/push/token", {
      method: "PUT",
      body: { token, platform, provider: "getui" }
    });
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "register-failed";
    console.warn("registerDevicePushToken failed", message);
    return { ok: false, reason: message };
  }
}

export async function requestServerPushTest(input?: {
  title?: string;
  body?: string;
}): Promise<{ ok: boolean; successCount?: number; failureCount?: number; error?: string }> {
  try {
    const result = await apiRequest<{
      ok: boolean;
      successCount: number;
      failureCount: number;
    }>("/api/push/test", {
      method: "POST",
      body: input ?? {}
    });
    return {
      ok: true,
      successCount: result.successCount,
      failureCount: result.failureCount
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "测试推送失败"
    };
  }
}
