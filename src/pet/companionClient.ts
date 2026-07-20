import { apiRequest, getApiBaseUrl, SyncError, UnauthorizedError } from "../sync/apiClient";
import { clearAuthToken, getAuthToken } from "../sync/localSettings";
import {
  CompanionMemorySchema,
  CompanionMessageSchema,
  CompanionStateSchema,
  parseCompanionReply,
  type CompanionChatInput,
  type CompanionEvent,
  type CompanionMemory,
  type CompanionState,
  type MemberPreferences,
  type MemoryProposal
} from "./companionTypes";

type RequestOptions = { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: unknown };
type RequestFn = (path: string, options?: RequestOptions) => Promise<unknown>;
type StreamFn = (
  body: CompanionChatInput,
  onDelta: (value: string) => void,
  signal?: AbortSignal
) => Promise<string>;

export function parseCompanionSse(input: string): {
  deltas: string[];
  done: boolean;
  rest: string;
} {
  const normalized = input.replace(/\r\n/g, "\n");
  const blocks = normalized.split("\n\n");
  const rest = blocks.pop() ?? "";
  const deltas: string[] = [];
  let done = false;
  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim())
      .join("\n");
    if (data === "[DONE]") {
      done = true;
      continue;
    }
    if (!data) continue;
    try {
      const delta = (JSON.parse(data) as { delta?: unknown }).delta;
      if (typeof delta === "string") deltas.push(delta);
    } catch {
      throw new SyncError("卡卡的回复格式不正确");
    }
  }
  return { deltas, done, rest };
}

async function streamCompanionChat(
  body: CompanionChatInput,
  onDelta: (value: string) => void,
  signal?: AbortSignal
): Promise<string> {
  const baseUrl = getApiBaseUrl();
  const token = await getAuthToken();
  if (!baseUrl) throw new SyncError("应用未正确配置后端地址");
  if (!token) throw new UnauthorizedError("尚未登录");

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let consumed = 0;
    let pending = "";
    let full = "";
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
      const parsed = parseCompanionSse(pending);
      pending = parsed.rest;
      for (const delta of parsed.deltas) {
        full += delta;
        onDelta(delta);
      }
    };
    xhr.open("POST", `${baseUrl}/api/companion/chat`);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.responseType = "text";
    xhr.onprogress = consume;
    xhr.onerror = () => fail(new SyncError("无法连接卡卡，请检查网络"));
    xhr.onload = () => {
      consume();
      if (xhr.status === 401) {
        void clearAuthToken();
        fail(new UnauthorizedError());
        return;
      }
      if (xhr.status < 200 || xhr.status >= 300) {
        fail(new SyncError("卡卡暂时没接上话"));
        return;
      }
      if (!full.trim()) {
        fail(new SyncError("卡卡暂时没有回复"));
        return;
      }
      settled = true;
      resolve(full);
    };
    signal?.addEventListener(
      "abort",
      () => {
        xhr.abort();
        fail(new SyncError("请求已取消"));
      },
      { once: true }
    );
    xhr.send(JSON.stringify(body));
  });
}

export function createCompanionClient(options: {
  request?: RequestFn;
  stream?: StreamFn;
} = {}) {
  const request = options.request ?? ((path, config) => apiRequest<unknown>(path, config));
  const stream = options.stream ?? streamCompanionChat;
  return {
    async respond(event: CompanionEvent) {
      return parseCompanionReply(
        await request("/api/companion/respond", { method: "POST", body: { event } })
      );
    },
    chat: (input: CompanionChatInput, onDelta: (value: string) => void, signal?: AbortSignal) =>
      stream(input, onDelta, signal),
    async listMessages(cursor?: string | null) {
      const suffix = cursor ? `?limit=30&cursor=${encodeURIComponent(cursor)}` : "?limit=30";
      const value = (await request(`/api/companion/messages${suffix}`)) as {
        items?: unknown;
        nextCursor?: unknown;
      };
      return {
        items: CompanionMessageSchema.array().parse(value.items),
        nextCursor: typeof value.nextCursor === "string" ? value.nextCursor : null
      };
    },
    async listMemories(): Promise<CompanionMemory[]> {
      const value = (await request("/api/companion/memories")) as { memories?: unknown };
      return CompanionMemorySchema.array().parse(value.memories);
    },
    async saveMemory(
      proposal: MemoryProposal,
      sourceMessageId?: string
    ): Promise<CompanionMemory> {
      const value = (await request("/api/companion/memories", {
        method: "POST",
        body: { ...proposal, ...(sourceMessageId ? { sourceMessageId } : {}) }
      })) as { memory?: unknown };
      return CompanionMemorySchema.parse(value.memory);
    },
    deleteMemory: (id: string) =>
      request(`/api/companion/memories/${encodeURIComponent(id)}`, { method: "DELETE" }),
    clearMessages: () => request("/api/companion/messages", { method: "DELETE" }),
    async getState(): Promise<CompanionState> {
      return CompanionStateSchema.parse(await request("/api/companion/state"));
    },
    async updateState(preferences: MemberPreferences): Promise<CompanionState> {
      return CompanionStateSchema.parse(
        await request("/api/companion/state", { method: "PUT", body: preferences })
      );
    }
  };
}

export const companionClient = createCompanionClient();
