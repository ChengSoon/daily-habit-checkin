import { getApiBaseUrl } from "./apiClient";
import { getAuthToken } from "./localSettings";

export type SyncInvalidationEvent = {
  type: "data_changed";
  resource: string;
  version: number;
  changedAt: string;
};

export type SyncSocketLike = {
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
  onopen: (() => void) | null;
  readyState: number;
  close(): void;
};

type SyncSocketFactory = (url: string, protocols: string[]) => SyncSocketLike;
type SyncInvalidationListener = (event: SyncInvalidationEvent) => void;

type SyncInvalidationClientOptions = {
  getApiBaseUrl: () => string | null;
  getAuthToken: () => Promise<string | null>;
  socketFactory?: SyncSocketFactory;
  reconnectDelayMs?: number;
};

type SyncInvalidationState = {
  listeners: Set<SyncInvalidationListener>;
  socket: SyncSocketLike | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
  connectPromise: Promise<void> | null;
};

function clearReconnectTimer(state: SyncInvalidationState) {
  if (!state.reconnectTimer) return;
  clearTimeout(state.reconnectTimer);
  state.reconnectTimer = null;
}

function notifyListeners(state: SyncInvalidationState, message: string) {
  const event = parseSyncInvalidationEvent(message);
  if (!event) return;
  for (const listener of state.listeners) listener(event);
}

function scheduleReconnect(state: SyncInvalidationState, options: SyncInvalidationClientOptions) {
  if (state.listeners.size === 0 || state.reconnectTimer) return;
  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
    void connect(state, options);
  }, options.reconnectDelayMs ?? 3000);
}

function attachSocket(
  state: SyncInvalidationState,
  options: SyncInvalidationClientOptions,
  nextSocket: SyncSocketLike
) {
  state.socket = nextSocket;
  nextSocket.onmessage = (event) => notifyListeners(state, event.data);
  nextSocket.onerror = () => undefined;
  nextSocket.onclose = () => {
    if (state.socket === nextSocket) state.socket = null;
    scheduleReconnect(state, options);
  };
}

async function openSocket(state: SyncInvalidationState, options: SyncInvalidationClientOptions) {
  const connection = await buildSyncSocketConnection(options.getApiBaseUrl, options.getAuthToken);
  if (!connection || state.listeners.size === 0) return;
  const factory = options.socketFactory ?? defaultSocketFactory;
  try {
    attachSocket(state, options, factory(connection.url, connection.protocols));
  } catch {
    scheduleReconnect(state, options);
  }
}

function connect(state: SyncInvalidationState, options: SyncInvalidationClientOptions): Promise<void> {
  if (state.connectPromise || state.socket) return state.connectPromise ?? Promise.resolve();
  state.connectPromise = openSocket(state, options).finally(() => {
    state.connectPromise = null;
  });
  return state.connectPromise;
}

function close(state: SyncInvalidationState) {
  clearReconnectTimer(state);
  const current = state.socket;
  state.socket = null;
  current?.close();
}

function subscribe(
  state: SyncInvalidationState,
  options: SyncInvalidationClientOptions,
  listener: SyncInvalidationListener
) {
  state.listeners.add(listener);
  clearReconnectTimer(state);
  void connect(state, options);
  return () => {
    state.listeners.delete(listener);
    if (state.listeners.size === 0) close(state);
  };
}

export function createSyncInvalidationClient(options: SyncInvalidationClientOptions) {
  const state: SyncInvalidationState = {
    listeners: new Set(),
    socket: null,
    reconnectTimer: null,
    connectPromise: null
  };
  return {
    subscribe: (listener: SyncInvalidationListener) => subscribe(state, options, listener)
  };
}

export async function buildSyncSocketUrl(
  getBaseUrl: () => string | null,
  getToken: () => Promise<string | null>
): Promise<string | null> {
  const baseUrl = getBaseUrl();
  const token = await getToken();
  if (!baseUrl || !token) {
    return null;
  }
  return toSocketUrl(baseUrl);
}

async function buildSyncSocketConnection(
  getBaseUrl: () => string | null,
  getToken: () => Promise<string | null>
): Promise<{ url: string; protocols: string[] } | null> {
  const token = await getToken();
  const baseUrl = getBaseUrl();
  if (!token || !baseUrl) return null;
  return { url: toSocketUrl(baseUrl), protocols: ["habit-sync", `auth.${token}`] };
}

function toSocketUrl(baseUrl: string): string {
  const url = new URL("/api/sync/events", baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url.toString();
}

export function parseSyncInvalidationEvent(message: string): SyncInvalidationEvent | null {
  try {
    const parsed = JSON.parse(message) as Partial<SyncInvalidationEvent>;
    if (
      parsed.type !== "data_changed" ||
      typeof parsed.resource !== "string" ||
      typeof parsed.version !== "number" ||
      typeof parsed.changedAt !== "string"
    ) {
      return null;
    }
    return {
      type: parsed.type,
      resource: parsed.resource,
      version: parsed.version,
      changedAt: parsed.changedAt
    };
  } catch {
    return null;
  }
}

function defaultSocketFactory(url: string, protocols: string[]): SyncSocketLike {
  const SocketConstructor = globalThis.WebSocket as unknown as {
    new (url: string, protocols?: string[]): SyncSocketLike;
  } | undefined;
  if (!SocketConstructor) {
    throw new Error("当前运行环境不支持 WebSocket");
  }
  return new SocketConstructor(url, protocols);
}

const syncInvalidationClient = createSyncInvalidationClient({
  getApiBaseUrl,
  getAuthToken
});

export function subscribeSyncInvalidations(listener: SyncInvalidationListener): () => void {
  return syncInvalidationClient.subscribe(listener);
}
