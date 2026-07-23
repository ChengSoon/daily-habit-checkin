import { getApiBaseUrl, SyncError, UnauthorizedError } from "../sync/apiClient";
import { clearAuthToken, getAuthToken } from "../sync/localSettings";

export type TtsAudioChunk = {
  data: string;
  sampleRate: 24000;
  channels: 1;
  encoding: "pcm_s16le";
};

export type TtsStreamOptions = {
  text: string;
  onAudio: (chunk: TtsAudioChunk) => void;
  signal?: AbortSignal;
};
export type TtsStreamFn = (options: TtsStreamOptions) => Promise<void>;

export type ParsedTtsSse = {
  chunks: TtsAudioChunk[];
  done: boolean;
  error: string | null;
  rest: string;
};

export function parseCompanionTtsSse(input: string): ParsedTtsSse {
  const blocks = input.replace(/\r\n/gu, "\n").split("\n\n");
  const rest = blocks.pop() ?? "";
  const chunks: TtsAudioChunk[] = [];
  let done = false;
  let error: string | null = null;
  for (const block of blocks) {
    const event = block.match(/^event:\s*(\S+)/mu)?.[1] ?? "message";
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (!data) continue;
    if (event === "done" || data === "[DONE]") {
      done = true;
      continue;
    }
    if (event === "error") {
      try {
        error = String((JSON.parse(data) as { message?: unknown }).message ?? "语音服务暂时不可用");
      } catch {
        error = "语音服务暂时不可用";
      }
      continue;
    }
    try {
      const value = JSON.parse(data) as Partial<TtsAudioChunk>;
      if (
        typeof value.data !== "string" ||
        value.sampleRate !== 24000 ||
        value.channels !== 1 ||
        value.encoding !== "pcm_s16le"
      ) {
        throw new Error("音频格式不受支持");
      }
      chunks.push(value as TtsAudioChunk);
    } catch {
      throw new SyncError("卡卡的语音格式不正确");
    }
  }
  return { chunks, done, error, rest };
}

type TtsStreamState = { consumed: number; pending: string; sawAudio: boolean; settled: boolean };

function consumeTtsResponse(xhr: XMLHttpRequest, state: TtsStreamState, onAudio: (chunk: TtsAudioChunk) => void) {
  if (typeof xhr.responseText !== "string" || xhr.responseText.length <= state.consumed) return null;
  state.pending += xhr.responseText.slice(state.consumed);
  state.consumed = xhr.responseText.length;
  const parsed = parseCompanionTtsSse(state.pending);
  state.pending = parsed.rest;
  parsed.chunks.forEach((chunk) => {
    state.sawAudio = true;
    onAudio(chunk);
  });
  return parsed.error;
}

function completeTtsResponse(xhr: XMLHttpRequest, state: TtsStreamState, onAudio: (chunk: TtsAudioChunk) => void) {
  const error = consumeTtsResponse(xhr, state, onAudio);
  if (error) throw new SyncError(error);
  const parsed = parseCompanionTtsSse(`${state.pending}\n\n`);
  parsed.chunks.forEach((chunk) => {
    state.sawAudio = true;
    onAudio(chunk);
  });
  if (parsed.error) throw new SyncError(parsed.error);
  if (!state.sawAudio) throw new SyncError("卡卡没有生成语音");
}

export const streamCompanionTts: TtsStreamFn = async (options) => {
  const baseUrl = getApiBaseUrl();
  const token = await getAuthToken();
  if (!baseUrl) throw new SyncError("应用未正确配置后端地址");
  if (!token) throw new UnauthorizedError("尚未登录");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const state: TtsStreamState = { consumed: 0, pending: "", sawAudio: false, settled: false };
    const fail = (error: Error) => {
      if (state.settled) return;
      state.settled = true;
      reject(error);
    };
    const consume = () => {
      try {
        const error = consumeTtsResponse(xhr, state, options.onAudio);
        if (error) fail(new SyncError(error));
      } catch (error) {
        fail(error instanceof Error ? error : new SyncError("语音流解析失败"));
      }
    };
    xhr.open("POST", `${baseUrl}/api/companion/tts`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.responseType = "text";
    xhr.onprogress = consume;
    xhr.onerror = () => fail(new SyncError("无法连接卡卡，请检查网络"));
    xhr.onabort = () => fail(new SyncError("请求已取消"));
    xhr.onload = () => {
      try {
        consume();
        if (xhr.status === 401) {
          void clearAuthToken();
          fail(new UnauthorizedError());
          return;
        }
        if (xhr.status < 200 || xhr.status >= 300) {
          fail(new SyncError("卡卡暂时没接上语音服务"));
          return;
        }
        completeTtsResponse(xhr, state, options.onAudio);
        state.settled = true;
        resolve();
      } catch (error) {
        fail(error instanceof Error ? error : new SyncError("语音流解析失败"));
      }
    };
    options.signal?.addEventListener(
      "abort",
      () => xhr.abort(),
      { once: true }
    );
    xhr.send(JSON.stringify({ text: options.text }));
  });
};
