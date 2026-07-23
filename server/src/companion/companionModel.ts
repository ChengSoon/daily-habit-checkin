import OpenAI from "openai";
import type { CompanionContext } from "./companionContext.js";
import {
  buildCompanionActionPrompt,
  buildCompanionChatPrompt,
  buildCompanionPrompt
} from "./companionPrompt.js";
import {
  CompanionActionPlanSchema,
  type CompanionActionPlan
} from "./companionActionSchemas.js";
import {
  CompanionReplySchema,
  type CompanionEvent,
  type CompanionReply
} from "./companionSchemas.js";

export type CompanionOpenAiClient = {
  chat: {
    completions: {
      create(
        body: Record<string, unknown>,
        options?: { signal?: AbortSignal }
      ): Promise<unknown>;
    };
  };
};

export type ModelCompanionInput = { event: CompanionEvent; context: CompanionContext };
export type ModelChatInput = { context: CompanionContext; userText: string };
export type ModelActionInput = { context: CompanionContext; userText: string };
export interface CompanionModel {
  respond(input: ModelCompanionInput): Promise<CompanionReply>;
  planAction?(input: ModelActionInput): Promise<CompanionActionPlan>;
  streamChat(input: ModelChatInput, onDelta: (text: string) => void): Promise<string>;
}

export type CompanionModelOptions = {
  client?: CompanionOpenAiClient;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeoutMs?: number;
  createClient?: (apiKey: string, baseUrl?: string) => CompanionOpenAiClient;
};

function createSdkClient(apiKey: string, baseUrl?: string): CompanionOpenAiClient {
  const sdk = new OpenAI({
    apiKey,
    baseURL: baseUrl || undefined
  });
  return sdk as unknown as CompanionOpenAiClient;
}

async function withTimeout<T>(
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error("模型请求超时"));
    }, timeoutMs);
  });
  try {
    return await Promise.race([operation(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function messageContent(raw: unknown): string {
  const response = raw as { choices?: Array<{ message?: { content?: string | null } }> };
  const content = response.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("模型返回为空");
  return content;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        // Fall through to a stable internal error.
      }
    }
    throw new Error("模型未返回合法 JSON");
  }
}

function streamFrom(raw: unknown): AsyncIterable<unknown> {
  if (!raw || typeof (raw as AsyncIterable<unknown>)[Symbol.asyncIterator] !== "function") {
    throw new Error("模型未返回流式内容");
  }
  return raw as AsyncIterable<unknown>;
}

type ModelRuntime = {
  client: () => CompanionOpenAiClient;
  model: () => string;
  timeoutMs: number;
};

function createModelRuntime(options: CompanionModelOptions): ModelRuntime {
  let currentClient = options.client;
  const modelName = options.model ?? process.env.OPENAI_MODEL;
  const createClient = options.createClient ?? createSdkClient;
  return {
    timeoutMs: options.timeoutMs ?? Number(process.env.COMPANION_TIMEOUT_MS ?? 15_000),
    client() {
      if (currentClient) return currentClient;
      const apiKey = options.apiKey === undefined ? process.env.OPENAI_API_KEY?.trim() : options.apiKey.trim();
      if (!apiKey) throw new Error("OPENAI_API_KEY is required");
      const baseUrl = options.baseUrl === undefined ? process.env.OPENAI_BASE_URL?.trim() : options.baseUrl.trim();
      currentClient = createClient(apiKey, baseUrl || undefined);
      return currentClient;
    },
    model() {
      if (!modelName) throw new Error("OPENAI_MODEL is required");
      return modelName;
    }
  };
}

async function requestJson(runtime: ModelRuntime, options: { messages: unknown; temperature: number }) {
  return withTimeout(runtime.timeoutMs, (signal) => runtime.client().chat.completions.create({
    model: runtime.model(),
    temperature: options.temperature,
    stream: false,
    response_format: { type: "json_object" },
    messages: options.messages
  }, { signal }));
}

async function respond(runtime: ModelRuntime, input: ModelCompanionInput): Promise<CompanionReply> {
  const raw = await requestJson(runtime, { messages: buildCompanionPrompt(input), temperature: 0.7 });
  const reply = CompanionReplySchema.parse(parseJson(messageContent(raw)));
  if (reply.eventId !== input.event.id) throw new Error("模型返回的 eventId 与请求不一致");
  return reply;
}

async function planAction(runtime: ModelRuntime, input: ModelActionInput): Promise<CompanionActionPlan> {
  const raw = await requestJson(runtime, { messages: buildCompanionActionPrompt(input), temperature: 0.1 });
  return CompanionActionPlanSchema.parse(parseJson(messageContent(raw)));
}

async function streamChat(runtime: ModelRuntime, input: ModelChatInput, onDelta: (text: string) => void) {
  return withTimeout(runtime.timeoutMs, async (signal) => {
    const raw = await runtime.client().chat.completions.create({
      model: runtime.model(), temperature: 0.7, stream: true, messages: buildCompanionChatPrompt(input)
    }, { signal });
    let full = "";
    for await (const item of streamFrom(raw)) {
      const chunk = item as { choices?: Array<{ delta?: { content?: string | null } }> };
      const content = chunk.choices?.[0]?.delta?.content;
      if (!content) continue;
      full += content;
      onDelta(content);
    }
    if (!full.trim()) throw new Error("模型返回为空");
    return full;
  });
}

export function createCompanionModel(options: CompanionModelOptions = {}): CompanionModel {
  const runtime = createModelRuntime(options);
  return {
    respond: (input) => respond(runtime, input),
    planAction: (input) => planAction(runtime, input),
    streamChat: (input, onDelta) => streamChat(runtime, input, onDelta)
  };
}
