import * as Notifications from "expo-notifications";
import { apiRequest } from "../sync/apiClient";

/**
 * 客户端 FCM/APNs device token 上报。
 * 走 getDevicePushTokenAsync（原生 FCM/APNs），供服务端 firebase-admin 直推。
 * 注意：Expo Go 上 Android FCM 受限，需 dev/production 安装包。
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
  if (platform === "web") {
    return { ok: false, reason: "web" };
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

    const deviceToken = await Notifications.getDevicePushTokenAsync();
    const token = typeof deviceToken.data === "string" ? deviceToken.data : String(deviceToken.data ?? "");
    if (!token || token.length < 10) {
      return { ok: false, reason: "empty-token" };
    }

    await apiRequest<{ ok: boolean }>("/api/push/token", {
      method: "PUT",
      body: { token, platform }
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
