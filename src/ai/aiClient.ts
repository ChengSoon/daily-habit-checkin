import { generateHabitPlanWithLlm } from "./llmClient";
import { assertLlmReady, resolveAiConfig } from "./llmConfig";
import { AIPlanPreview, AIPlanRequest } from "./types";

/** 通过用户配置的真实模型（OpenAI 兼容）或习惯后端代理生成计划。 */
export async function requestAIHabitPlan(input: AIPlanRequest): Promise<AIPlanPreview> {
  const config = await resolveAiConfig();
  assertLlmReady(config);

  if (config.mode === "openai_compatible") {
    return generateHabitPlanWithLlm(input);
  }

  // 习惯后端代理：服务端使用 OPENAI_*，客户端可覆盖 model
  const response = await fetch(`${config.baseUrl}/api/ai/habit-plan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(config.apiKey ? { "x-api-key": config.apiKey } : {})
    },
    body: JSON.stringify(config.model ? { ...input, model: config.model } : input)
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.error ?? "AI 计划生成失败");
  }

  return response.json();
}
