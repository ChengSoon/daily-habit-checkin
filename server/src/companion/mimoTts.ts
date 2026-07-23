import { TextDecoder } from "node:util";
import type { CompanionTtsRequest } from "./companionSchemas.js";

export const MIMO_TTS_FORMAT = "pcm16" as const;
export const MIMO_TTS_SAMPLE_RATE = 24_000 as const;
export const MIMO_TTS_CHANNELS = 1 as const;
export const MIMO_TTS_VOICES = ["冰糖", "茉莉", "苏打", "白桦"] as const;

export type MimoTtsAudioChunk = {
  data: string;
  sampleRate: typeof MIMO_TTS_SAMPLE_RATE;
  channels: typeof MIMO_TTS_CHANNELS;
  encoding: "pcm_s16le";
};

export type MimoTtsService = {
  stream(
    input: CompanionTtsRequest,
    onAudio: (chunk: MimoTtsAudioChunk) => void,
    signal?: AbortSignal
  ): Promise<void>;
};

type MimoTtsOptions = {
  fetch?: typeof fetch;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  voice?: (typeof MIMO_TTS_VOICES)[number];
  timeoutMs?: number;
};

type MimoChunk = {
  choices?: Array<{ delta?: { audio?: { data?: unknown } } }>;
};

type MimoRuntime = {
  request: typeof fetch;
  apiKey: string | undefined;
  baseUrl: string;
  model: string;
  voice: (typeof MIMO_TTS_VOICES)[number];
  timeoutMs: number;
};

const DEFAULT_STYLE = [
  "角色：卡卡，一只亲近、温柔但不幼稚的小海豹伙伴。",
  "场景：和熟悉的用户面对面聊日常，正在自然接话，不是在播报或朗诵。",
  "指导：语速中等偏慢，发声松弛，停连和重音跟随句意变化；疑问句自然微微上扬，安慰时更柔和，开心时更明亮。不要客服腔、播音腔、字字等重、刻意卖萌或拖长尾音。"
].join("\n");
const DEFAULT_STYLE_TAG = "(自然聊天，松弛，温柔)";

function trimBaseUrl(value: string): string {
  return value.replace(/\/+$/u, "");
}

function resolveVoice(value: string | undefined): (typeof MIMO_TTS_VOICES)[number] {
  return MIMO_TTS_VOICES.includes(value as (typeof MIMO_TTS_VOICES)[number])
    ? (value as (typeof MIMO_TTS_VOICES)[number])
    : "冰糖";
}

function parseAudioData(raw: string): string | null {
  if (raw === "[DONE]") return null;
  const payload = JSON.parse(raw) as MimoChunk;
  const data = payload.choices?.[0]?.delta?.audio?.data;
  if (data == null) return "";
  if (typeof data !== "string" || !data || !/^[A-Za-z0-9+/]*={0,2}$/u.test(data)) {
    throw new Error("MiMo 返回了无效音频数据");
  }
  return data;
}

function consumeSse(
  pending: string,
  onAudio: (data: string) => void
): { rest: string; done: boolean } {
  const blocks = pending.replace(/\r\n/gu, "\n").split("\n\n");
  const rest = blocks.pop() ?? "";
  let done = false;
  for (const block of blocks) {
    const event = block.match(/^event:\s*(\S+)/mu)?.[1] ?? "message";
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data) continue;
    if (event === "error") throw new Error("MiMo TTS 上游流返回错误");
    const audio = parseAudioData(data);
    if (audio === null) {
      done = true;
      continue;
    }
    if (audio) onAudio(audio);
  }
  return { rest, done };
}

function emitAudio(onAudio: (chunk: MimoTtsAudioChunk) => void) {
  return (data: string) => onAudio({ data, sampleRate: MIMO_TTS_SAMPLE_RATE,
    channels: MIMO_TTS_CHANNELS, encoding: "pcm_s16le" });
}

async function requestAudio(runtime: MimoRuntime, input: CompanionTtsRequest, signal: AbortSignal) {
  const response = await runtime.request(`${runtime.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": runtime.apiKey! },
    body: JSON.stringify({
      model: runtime.model,
      messages: [
        { role: "user", content: DEFAULT_STYLE },
        { role: "assistant", content: `${DEFAULT_STYLE_TAG}${input.text}` }
      ],
      audio: { format: MIMO_TTS_FORMAT, voice: runtime.voice },
      stream: true
    }),
    signal
  });
  if (!response.ok || !response.body) throw new Error(`MiMo TTS 请求失败（HTTP ${response.status}）`);
  return response.body.getReader();
}

async function consumeAudioStream(reader: ReadableStreamDefaultReader<Uint8Array>, onAudio: (chunk: MimoTtsAudioChunk) => void) {
  const decoder = new TextDecoder("utf-8");
  const emit = emitAudio(onAudio);
  let pending = "";
  let done = false;
  while (!done) {
    const next = await reader.read();
    if (next.done) break;
    pending += decoder.decode(next.value, { stream: true });
    const parsed = consumeSse(pending, emit);
    pending = parsed.rest;
    done = parsed.done;
  }
  pending += decoder.decode();
  consumeSse(pending.endsWith("\n\n") ? pending : `${pending}\n\n`, emit);
}

async function streamAudio(options: {
  runtime: MimoRuntime;
  input: CompanionTtsRequest;
  onAudio: (chunk: MimoTtsAudioChunk) => void;
  signal?: AbortSignal;
}) {
  const { runtime, input, onAudio, signal } = options;
  if (!runtime.apiKey) throw new Error("MIMO_API_KEY is required");
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), runtime.timeoutMs);
  const abort = () => timeout.abort();
  signal?.addEventListener("abort", abort, { once: true });
  try {
    const reader = await requestAudio(runtime, input, timeout.signal);
    await consumeAudioStream(reader, onAudio);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}

export function createMimoTtsService(options: MimoTtsOptions = {}): MimoTtsService {
  const runtime: MimoRuntime = {
    request: options.fetch ?? fetch,
    apiKey: options.apiKey ?? process.env.MIMO_API_KEY?.trim(),
    baseUrl: trimBaseUrl(options.baseUrl ?? process.env.MIMO_TTS_BASE_URL ?? "https://api.xiaomimimo.com/v1"),
    model: options.model ?? process.env.MIMO_TTS_MODEL ?? "mimo-v2.5-tts",
    voice: resolveVoice(options.voice ?? process.env.MIMO_TTS_VOICE),
    timeoutMs: options.timeoutMs ?? Number(process.env.MIMO_TTS_TIMEOUT_MS ?? 15_000)
  };
  return {
    stream: (input, onAudio, signal) => streamAudio({ runtime, input, onAudio, signal })
  };
}
