import Constants from "expo-constants";
import { AIPlanPreview, AIPlanRequest } from "./types";

const apiBaseUrl =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  Constants.expoConfig?.extra?.apiBaseUrl ??
  "http://localhost:8787";

const apiKey =
  process.env.EXPO_PUBLIC_API_KEY ?? Constants.expoConfig?.extra?.apiKey ?? null;

export async function requestAIHabitPlan(input: AIPlanRequest): Promise<AIPlanPreview> {
  const response = await fetch(`${apiBaseUrl}/api/ai/habit-plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : {})
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "AI 计划生成失败");
  }

  return response.json();
}
