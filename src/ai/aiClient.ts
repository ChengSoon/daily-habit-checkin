import { generateHabitPlanWithLlm } from "./llmClient";
import { assertLlmReady, resolveAiConfig } from "./llmConfig";
import { AIPlanPreview, AIPlanRequest } from "./types";
import { postCommand } from "../sync/commandClient";

/** 通过用户配置的真实模型（OpenAI 兼容）或习惯后端代理生成计划。 */
export async function requestAIHabitPlan(input: AIPlanRequest): Promise<AIPlanPreview> {
  const config = await resolveAiConfig();
  assertLlmReady(config);

  if (config.mode === "openai_compatible") {
    return generateHabitPlanWithLlm(input);
  }

  // 习惯后端代理：服务端使用 OPENAI_*，客户端可覆盖 model
  return postCommand<AIPlanPreview>(
    "/api/ai/habit-plan",
    config.model ? { ...input, model: config.model } : input
  );
}
