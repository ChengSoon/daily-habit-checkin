import { getApiBaseUrl, SyncError, UnauthorizedError } from "../sync/apiClient";
import { clearAuthToken, getAuthToken } from "../sync/localSettings";

export type TtsAudioChunk = {
  data: string;
  sampleRate: 24000;
  channels: 1;
  encoding: "pcm_s16le";
};

export type TtsStreamFn = (
  text: string,
  onAudio: (chunk: TtsAudioChunk) => void,
  signal?: AbortSignal
) => Promise<void>;

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

export const streamCompanionTts: TtsStreamFn = async (text, onAudio, signal) => {
  const baseUrl = getApiBaseUrl();
  const token = await getAuthToken();
  if (!baseUrl) throw new SyncError("应用未正确配置后端地址");
  if (!token) throw new UnauthorizedError("尚未登录");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let consumed = 0;
    let pending = "";
    let sawAudio = false;
    let settled = false;
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const consume = () => {
      if (typeof xhr.responseText !== "string" || xhr.responseText.length <= consumed) return;
      pending += xhr.responseText.slice(consumed);
      consumed = xhr.responseText.length;
      const parsed = parseCompanionTtsSse(pending);
      pending = parsed.rest;
      for (const chunk of parsed.chunks) {
        sawAudio = true;
        onAudio(chunk);
      }
      if (parsed.error) fail(new SyncError(parsed.error));
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
        if (typeof xhr.responseText === "string") {
          pending += xhr.responseText.slice(consumed);
          const parsed = parseCompanionTtsSse(`${pending}\n\n`);
          for (const chunk of parsed.chunks) {
            sawAudio = true;
            onAudio(chunk);
          }
          if (parsed.error) {
            fail(new SyncError(parsed.error));
            return;
          }
        }
        if (!sawAudio) {
          fail(new SyncError("卡卡没有生成语音"));
          return;
        }
        settled = true;
        resolve();
      } catch (error) {
        fail(error instanceof Error ? error : new SyncError("语音流解析失败"));
      }
    };
    signal?.addEventListener(
      "abort",
      () => xhr.abort(),
      { once: true }
    );
    xhr.send(JSON.stringify({ text }));
  });
};
