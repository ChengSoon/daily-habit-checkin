import Constants from "expo-constants";
import { getAppSettings } from "../settings/settingsRepository";
import { AIPlanPreview, AIPlanRequest } from "./types";

// 兜底：打包时的环境变量仍可作为默认值，但用户在「我的 → AI 服务配置」里填写的值优先。
const fallbackBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  Constants.expoConfig?.extra?.apiBaseUrl ??
  "http://localhost:8787";

const fallbackApiKey =
  process.env.EXPO_PUBLIC_API_KEY ?? Constants.expoConfig?.extra?.apiKey ?? null;

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export async function requestAIHabitPlan(input: AIPlanRequest): Promise<AIPlanPreview> {
  const settings = await getAppSettings();
  const baseUrl = trimTrailingSlash(settings.aiBaseUrl.trim() || fallbackBaseUrl);
  const apiKey = settings.aiApiKey.trim() || fallbackApiKey;
  const model = settings.aiModel.trim();

  if (!baseUrl) {
    throw new Error("尚未配置 AI 服务地址，请到「我的 → AI 服务配置」中填写。");
  }

  const response = await fetch(`${baseUrl}/api/ai/habit-plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {})
    },
    // model 为空时不传，后端使用其默认模型
    body: JSON.stringify(model ? { ...input, model } : input)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "AI 计划生成失败");
  }

  return response.json();
}
