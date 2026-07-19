import Constants from "expo-constants";
import { getAppSettings } from "../settings/settingsRepository";
import {
  detectLlmMode,
  normalizeOpenAiCompatibleBase,
  trimTrailingSlash,
  type LlmMode
} from "./llmConfigCore";

export type { LlmMode };
export { detectLlmMode, normalizeOpenAiCompatibleBase, trimTrailingSlash };

const fallbackHabitServer =
  process.env.EXPO_PUBLIC_API_BASE_URL ??
  Constants.expoConfig?.extra?.apiBaseUrl ??
  "http://localhost:8787";

const fallbackApiKey =
  process.env.EXPO_PUBLIC_API_KEY ?? Constants.expoConfig?.extra?.apiKey ?? null;

export type ResolvedAiConfig = {
  mode: LlmMode;
  /** OpenAI 兼容根地址（通常以 /v1 结尾）或习惯后端根地址 */
  baseUrl: string;
  apiKey: string | null;
  model: string;
};

export async function resolveAiConfig(): Promise<ResolvedAiConfig> {
  const settings = await getAppSettings();
  const rawBase = settings.aiBaseUrl.trim() || fallbackHabitServer;
  const mode = detectLlmMode(rawBase);
  const apiKey = settings.aiApiKey.trim() || fallbackApiKey;
  const model = settings.aiModel.trim();

  if (mode === "openai_compatible") {
    return {
      mode,
      baseUrl: normalizeOpenAiCompatibleBase(rawBase),
      apiKey,
      model
    };
  }

  return {
    mode: "habit_server",
    baseUrl: trimTrailingSlash(rawBase),
    apiKey,
    model
  };
}

export function assertLlmReady(config: ResolvedAiConfig): void {
  if (config.mode === "openai_compatible") {
    if (!config.baseUrl) {
      throw new Error("尚未配置 AI 服务地址，请到「我的 → AI 服务配置」填写 OpenAI 兼容地址。");
    }
    if (!config.apiKey) {
      throw new Error("尚未配置 API Key，请到「我的 → AI 服务配置」填写。");
    }
    if (!config.model) {
      throw new Error("尚未配置模型名，请到「我的 → AI 服务配置」填写，例如 gpt-4o-mini。");
    }
    return;
  }
  if (!config.baseUrl) {
    throw new Error("尚未配置 AI 服务地址，请到「我的 → AI 服务配置」中填写。");
  }
}
