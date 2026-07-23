import { extractDeltaContent, parseSseDataLines } from "./sse";

type ChatCompletionResponse = {
  choices?: { message?: { content?: string | null } }[];
  content?: string;
};

export type XhrStreamRequest = {
  url: string;
  headers: Record<string, string>;
  body: unknown;
  onDelta: (chunk: string) => void;
};

type XhrStreamState = {
  lastIndex: number;
  pending: string;
  full: string;
  settled: boolean;
};

type XhrCallbacks = {
  fail: (error: Error) => void;
  succeed: (text: string) => void;
};

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as { error?: string | { message?: string } };
    if (typeof payload.error === "string") return payload.error;
    if (payload.error && typeof payload.error === "object" && payload.error.message) {
      return payload.error.message;
    }
  } catch {
    // Response body is not JSON.
  }
  return `模型请求失败（HTTP ${response.status}）`;
}

export async function consumeSseResponse(
  response: Response,
  onDelta: (chunk: string) => void
): Promise<string> {
  if (!response.ok) throw new Error(await readErrorMessage(response));
  let full = "";
  let pending = "";
  const handleChunk = (text: string) => {
    pending += text;
    const { events, rest } = parseSseDataLines(pending);
    pending = rest;
    for (const event of events) {
      const delta = extractDeltaContent(event);
      if (delta) {
        full += delta;
        onDelta(delta);
      }
    }
  };
  const body = response.body as { getReader?: () => ReadableStreamDefaultReader<Uint8Array> } | null;
  if (body && typeof body.getReader === "function") {
    const reader = body.getReader();
    const decoder = new TextDecoder("utf-8");
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      handleChunk(decoder.decode(value, { stream: true }));
    }
    handleChunk(decoder.decode());
  } else {
    const text = await response.text();
    handleChunk(text.endsWith("\n\n") ? text : `${text}\n\n`);
  }
  if (pending.trim()) {
    const delta = extractDeltaContent(pending.replace(/^data:\s*/i, "").trim());
    if (delta) {
      full += delta;
      onDelta(delta);
    }
  }
  if (!full.trim()) throw new Error("模型返回为空，请检查模型名或中转服务是否可用");
  return full;
}

function consumeXhrText(options: {
  raw: string;
  state: XhrStreamState;
  onDelta: (chunk: string) => void;
  fail: (error: Error) => void;
}) {
  const { raw, state, onDelta, fail } = options;
  if (raw.length <= state.lastIndex) return;
  state.pending += raw.slice(state.lastIndex);
  state.lastIndex = raw.length;
  const { events, rest } = parseSseDataLines(state.pending);
  state.pending = rest;
  for (const event of events) {
    try {
      const delta = extractDeltaContent(event);
      if (delta) {
        state.full += delta;
        onDelta(delta);
      }
    } catch (error) {
      fail(error instanceof Error ? error : new Error("流式解析失败"));
    }
  }
}

function xhrErrorMessage(xhr: XMLHttpRequest): Error {
  try {
    const payload = JSON.parse(xhr.responseText) as { error?: string | { message?: string } };
    const message = typeof payload.error === "string"
      ? payload.error
      : payload.error?.message ?? `模型请求失败（HTTP ${xhr.status}）`;
    return new Error(message);
  } catch {
    return new Error(`模型请求失败（HTTP ${xhr.status}）`);
  }
}

function nonStreamingContent(xhr: XMLHttpRequest): string | null {
  try {
    const payload = JSON.parse(xhr.responseText) as ChatCompletionResponse;
    return payload.choices?.[0]?.message?.content ?? payload.content ?? null;
  } catch {
    return null;
  }
}

function handleXhrLoad(options: {
  xhr: XMLHttpRequest;
  request: XhrStreamRequest;
  state: XhrStreamState;
  callbacks: XhrCallbacks;
}) {
  const { xhr, request, state, callbacks } = options;
  const raw = xhr.responseText.endsWith("\n\n") ? xhr.responseText : `${xhr.responseText}\n\n`;
  consumeXhrText({ raw, state, onDelta: request.onDelta, fail: callbacks.fail });
  if (xhr.status < 200 || xhr.status >= 300) return callbacks.fail(xhrErrorMessage(xhr));
  if (state.full.trim()) return callbacks.succeed(state.full);
  const content = nonStreamingContent(xhr);
  if (content?.trim()) {
    request.onDelta(content);
    return callbacks.succeed(content);
  }
  callbacks.fail(new Error("模型返回为空，请检查模型名或中转服务是否可用"));
}

function createCallbacks(state: XhrStreamState, resolve: (text: string) => void, reject: (error: Error) => void) {
  return {
    fail(error: Error) {
      if (state.settled) return;
      state.settled = true;
      reject(error);
    },
    succeed(text: string) {
      if (state.settled) return;
      state.settled = true;
      resolve(text);
    }
  };
}

export function streamViaXhr(request: XhrStreamRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const state: XhrStreamState = { lastIndex: 0, pending: "", full: "", settled: false };
    const callbacks = createCallbacks(state, resolve, reject);
    const consume = (raw: string) => consumeXhrText({ raw, state, onDelta: request.onDelta, fail: callbacks.fail });
    xhr.open("POST", request.url);
    Object.entries(request.headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
    xhr.responseType = "text";
    xhr.onprogress = () => consume(xhr.responseText);
    xhr.onerror = () => callbacks.fail(new Error("网络错误，流式请求失败"));
    xhr.onload = () => handleXhrLoad({ xhr, request, state, callbacks });
    xhr.send(JSON.stringify(request.body));
  });
}
