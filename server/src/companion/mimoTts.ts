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

const DEFAULT_STYLE = "温柔、轻快、亲近，像一只陪伴用户的小海豹。";

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

export function createMimoTtsService(options: MimoTtsOptions = {}): MimoTtsService {
  const request = options.fetch ?? fetch;
  const apiKey = options.apiKey ?? process.env.MIMO_API_KEY?.trim();
  const baseUrl = trimBaseUrl(options.baseUrl ?? process.env.MIMO_TTS_BASE_URL ?? "https://api.xiaomimimo.com/v1");
  const model = options.model ?? process.env.MIMO_TTS_MODEL ?? "mimo-v2.5-tts";
  const voice = resolveVoice(options.voice ?? process.env.MIMO_TTS_VOICE);
  const timeoutMs = options.timeoutMs ?? Number(process.env.MIMO_TTS_TIMEOUT_MS ?? 15_000);

  return {
    async stream(input, onAudio, signal) {
      if (!apiKey) throw new Error("MIMO_API_KEY is required");
      const timeout = new AbortController();
      const timer = setTimeout(() => timeout.abort(), timeoutMs);
      const abort = () => timeout.abort();
      signal?.addEventListener("abort", abort, { once: true });
      try {
        const response = await request(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": apiKey
          },
          body: JSON.stringify({
            model,
            messages: [
              { role: "user", content: DEFAULT_STYLE },
              { role: "assistant", content: input.text }
            ],
            audio: { format: MIMO_TTS_FORMAT, voice },
            stream: true
          }),
          signal: timeout.signal
        });
        if (!response.ok || !response.body) {
          throw new Error(`MiMo TTS 请求失败（HTTP ${response.status}）`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let pending = "";
        let done = false;
        while (!done) {
          const next = await reader.read();
          if (next.done) break;
          pending += decoder.decode(next.value, { stream: true });
          const parsed = consumeSse(pending, (data) =>
            onAudio({
              data,
              sampleRate: MIMO_TTS_SAMPLE_RATE,
              channels: MIMO_TTS_CHANNELS,
              encoding: "pcm_s16le"
            })
          );
          pending = parsed.rest;
          done = parsed.done;
        }
        pending += decoder.decode();
        consumeSse(pending.endsWith("\n\n") ? pending : `${pending}\n\n`, (data) =>
          onAudio({
            data,
            sampleRate: MIMO_TTS_SAMPLE_RATE,
            channels: MIMO_TTS_CHANNELS,
            encoding: "pcm_s16le"
          })
        );
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener("abort", abort);
      }
    }
  };
}
