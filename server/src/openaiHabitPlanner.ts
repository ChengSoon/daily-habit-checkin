import OpenAI from "openai";
import { HabitPlanRequestSchema, HabitPlanResponse, HabitPlanResponseSchema } from "./habitPlanSchema.js";

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      // 兼容官方与各类中转：如 https://api.openai.com/v1 、DeepSeek、硅基流动等
      baseURL: process.env.OPENAI_BASE_URL || undefined
    });
  }
  return client;
}

const SYSTEM_PROMPT =
  "你是习惯计划助手。只生成温和、可执行、低压力的习惯入门计划。输出的 durationDays 必须等于用户输入的 durationDays。必须输出 JSON，不要输出 Markdown。字段：habitName, description, durationDays, dailyActions[{day,action,targetValue}], recommendedReminderTime(HH:MM), recommendedTrackType(check|numeric), numericUnit, fallbackAdvice, safetyNote。dailyActions 条数必须等于 durationDays。";

function extractJsonObject(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("AI returned non-JSON content");
  }
}

export async function generateHabitPlan(rawInput: unknown): Promise<HabitPlanResponse> {
  const input = HabitPlanRequestSchema.parse(rawInput);

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const model = input.model ?? process.env.OPENAI_MODEL;
  if (!model) {
    throw new Error("OPENAI_MODEL is required");
  }

  const openai = getClient();
  const userPayload = JSON.stringify(input);

  // 优先 chat.completions：兼容面更广（官方 / 中转 / 国产模型）
  let content: string | null | undefined;
  try {
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPayload }
      ]
    });
    content = response.choices[0]?.message?.content;
  } catch {
    // 部分中转不支持 response_format，降级重试
    const response = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPayload }
      ]
    });
    content = response.choices[0]?.message?.content;
  }

  if (!content) {
    throw new Error("AI returned empty content");
  }

  return HabitPlanResponseSchema.parse(extractJsonObject(content));
}
