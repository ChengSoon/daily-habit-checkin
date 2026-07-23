import { assertLlmReady, resolveAiConfig, type ResolvedAiConfig } from "./llmConfig";
import { AIPlanPreview, AIPlanRequest } from "./types";
import { commandAuthorizationHeaders } from "../sync/commandClient";
import { consumeSseResponse, streamViaXhr } from "./llmStreamTransport";

export type LlmChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type StreamHandlers = {
  onDelta: (chunk: string) => void;
};

type ChatCompletionResponse = {
  choices?: { message?: { content?: string | null } }[];
  error?: { message?: string };
};

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
    throw new Error("模型未返回合法 JSON");
  }
}

function parsePlanPreview(raw: unknown): AIPlanPreview {
  if (!raw || typeof raw !== "object") {
    throw new Error("计划内容格式错误");
  }
  const data = raw as Record<string, unknown>;
  const durationDays = data.durationDays === 21 ? 21 : 7;
  const dailyActions = normalizeDailyActions(data.dailyActions, durationDays);

  const track = data.recommendedTrackType === "numeric" ? "numeric" : "check";
  const reminder = validReminderTime(data.recommendedReminderTime);
  return {
    habitName: String(data.habitName ?? "新习惯").slice(0, 32),
    description: String(data.description ?? "温和可执行的小目标").slice(0, 120),
    durationDays,
    dailyActions,
    recommendedReminderTime: reminder,
    recommendedTrackType: track,
    numericUnit: track === "numeric" ? String(data.numericUnit ?? "次").slice(0, 12) : null,
    fallbackAdvice: String(data.fallbackAdvice ?? "如果某天状态不好，只做最小一步也算完成。").slice(0, 120),
    safetyNote: data.safetyNote == null || data.safetyNote === "" ? null : String(data.safetyNote).slice(0, 120)
  };
}

function normalizeDailyActions(raw: unknown, durationDays: 7 | 21) {
  const dailyActionsRaw = Array.isArray(raw) ? raw : [];
  const dailyActions = dailyActionsRaw
    .map((item, index) => {
      const row = item as Record<string, unknown>;
      return {
        day: typeof row.day === "number" ? row.day : index + 1,
        action: String(row.action ?? "").trim(),
        targetValue: typeof row.targetValue === "number" ? row.targetValue : null
      };
    })
    .filter((item) => item.action)
    .slice(0, durationDays);

  if (dailyActions.length < Math.min(7, durationDays)) {
    throw new Error("模型返回的每日行动过少，请重试");
  }

  while (dailyActions.length < durationDays) {
    const last = dailyActions[dailyActions.length - 1];
    dailyActions.push({
      day: dailyActions.length + 1,
      action: last?.action ?? "保持轻松完成今日小目标",
      targetValue: last?.targetValue ?? null
    });
  }

  return dailyActions.map((item, index) => ({ ...item, day: index + 1 }));
}

function validReminderTime(raw: unknown): string {
  return typeof raw === "string" && /^([01]\d|2[0-3]):([0-5]\d)$/.test(raw) ? raw : "21:30";
}

async function postChatCompletions(
  config: ResolvedAiConfig,
  body: Record<string, unknown>
): Promise<string> {
  assertLlmReady(config);
  const url = `${config.baseUrl}/chat/completions`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0.7,
      ...body
    })
  });

  const payload = (await response.json().catch(() => null)) as ChatCompletionResponse | null;
  if (!response.ok) {
    const message = payload?.error?.message;
    throw new Error(message ?? `模型请求失败（HTTP ${response.status}）`);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (!content?.trim()) {
    throw new Error("模型返回为空，请检查模型名或中转服务是否可用");
  }
  return content;
}

export async function llmChat(messages: LlmChatMessage[]): Promise<string> {
  return llmChatStream(messages, { onDelta: () => undefined });
}

/** 流式对话：优先 SSE，失败时回落非流式。 */
type StreamRequest = {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  onDelta: (chunk: string) => void;
  fallback: () => Promise<string>;
};

async function streamWithFallback(request: StreamRequest): Promise<string> {
  try {
    return await streamViaXhr(request);
  } catch {
    try {
      const response = await fetch(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.body)
      });
      return await consumeSseResponse(response, request.onDelta);
    } catch {
      const content = await request.fallback();
      request.onDelta(content);
      return content;
    }
  }
}

async function streamOpenAi(config: ResolvedAiConfig, messages: LlmChatMessage[], onDelta: StreamHandlers["onDelta"]) {
  const body = { model: config.model, temperature: 0.7, stream: true, messages };
  return streamWithFallback({
    url: `${config.baseUrl}/chat/completions`,
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
    body,
    onDelta,
    fallback: () => postChatCompletions(config, { messages })
  });
}

async function requestBackendChat(
  config: ResolvedAiConfig,
  messages: LlmChatMessage[],
  headers: Record<string, string>
): Promise<string> {
  const response = await fetch(`${config.baseUrl}/api/ai/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify(config.model ? { messages, model: config.model } : { messages })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error ?? `对话失败（HTTP ${response.status}）`);
  if (!payload?.content || typeof payload.content !== "string") throw new Error("后端未返回对话内容");
  return payload.content;
}

async function streamBackend(config: ResolvedAiConfig, messages: LlmChatMessage[], onDelta: StreamHandlers["onDelta"]) {
  const url = `${config.baseUrl}/api/ai/chat`;
  const body = config.model
    ? { messages, model: config.model, stream: true }
    : { messages, stream: true };
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(await commandAuthorizationHeaders())
  };

  return streamWithFallback({
    url,
    headers,
    body,
    onDelta,
    fallback: () => requestBackendChat(config, messages, headers)
  });
}

export async function llmChatStream(messages: LlmChatMessage[], handlers: StreamHandlers): Promise<string> {
  const config = await resolveAiConfig();
  assertLlmReady(config);
  return config.mode === "openai_compatible"
    ? streamOpenAi(config, messages, handlers.onDelta)
    : streamBackend(config, messages, handlers.onDelta);
}

const PLAN_SYSTEM = `你是习惯计划助手。只生成温和、可执行、低压力的习惯入门计划。
必须输出 JSON（不要 Markdown 代码块），字段：
habitName, description, durationDays, dailyActions[{day,action,targetValue}], recommendedReminderTime(HH:MM), recommendedTrackType(check|numeric), numericUnit, fallbackAdvice, safetyNote。
durationDays 必须等于用户输入的 durationDays；dailyActions 条数必须等于 durationDays。`;

export async function generateHabitPlanWithLlm(input: AIPlanRequest): Promise<AIPlanPreview> {
  const config = await resolveAiConfig();
  if (config.mode !== "openai_compatible") {
    throw new Error("当前未配置 OpenAI 兼容模型");
  }

  const messages = [
    { role: "system" as const, content: PLAN_SYSTEM },
    { role: "user" as const, content: JSON.stringify(input) }
  ];

  let content: string;
  try {
    content = await postChatCompletions(config, {
      messages,
      response_format: { type: "json_object" }
    });
  } catch {
    content = await postChatCompletions(config, { messages });
  }

  return parsePlanPreview(extractJsonObject(content));
}

export const HABIT_ASSISTANT_SYSTEM = `你是「每日打卡」App 的小岛 AI 助手，服务情侣/双人共同养成习惯。
能力：
1) 帮助用户用对话澄清目标，并生成温和可执行的分阶段习惯计划；
2) 根据完成情况给出降压/保持/进阶建议；
3) 回答与习惯、打卡、积分奖励相关的问题。
风格：简洁、鼓励、中文、低压力。不要编造用户没有提供的打卡数据。
若用户明确要生成计划，可先确认：目标、基础（新手/有基础/稳定）、周期（7或21天）、每日分钟、频率、提醒时段、记录方式（一键完成/数值）。
信息不足时一次只问 1-2 个关键问题。`;
