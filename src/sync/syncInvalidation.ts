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

type SyncSocketFactory = (url: string) => SyncSocketLike;
type SyncInvalidationListener = (event: SyncInvalidationEvent) => void;

type SyncInvalidationClientOptions = {
  getApiBaseUrl: () => string | null;
  getAuthToken: () => Promise<string | null>;
  socketFactory?: SyncSocketFactory;
  reconnectDelayMs?: number;
};

export function createSyncInvalidationClient(options: SyncInvalidationClientOptions) {
  const listeners = new Set<SyncInvalidationListener>();
  const reconnectDelayMs = options.reconnectDelayMs ?? 3000;
  let socket: SyncSocketLike | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let connectPromise: Promise<void> | null = null;

  function clearReconnectTimer() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  }

  function notify(message: string) {
    const event = parseSyncInvalidationEvent(message);
    if (!event) {
      return;
    }
    for (const listener of listeners) {
      listener(event);
    }
  }

  function scheduleReconnect() {
    if (listeners.size === 0 || reconnectTimer) {
      return;
    }
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, reconnectDelayMs);
  }

  async function connect() {
    if (connectPromise || socket) {
      return connectPromise ?? Promise.resolve();
    }

    connectPromise = (async () => {
      const url = await buildSyncSocketUrl(options.getApiBaseUrl, options.getAuthToken);
      if (!url || listeners.size === 0) {
        return;
      }

      const factory = options.socketFactory ?? defaultSocketFactory;
      let nextSocket: SyncSocketLike;
      try {
        nextSocket = factory(url);
      } catch {
        scheduleReconnect();
        return;
      }
      socket = nextSocket;
      nextSocket.onmessage = (event) => notify(event.data);
      nextSocket.onerror = () => undefined;
      nextSocket.onclose = () => {
        if (socket === nextSocket) {
          socket = null;
        }
        scheduleReconnect();
      };
    })().finally(() => {
      connectPromise = null;
    });

    return connectPromise;
  }

  function close() {
    clearReconnectTimer();
    const current = socket;
    socket = null;
    current?.close();
  }

  return {
    subscribe(listener: SyncInvalidationListener): () => void {
      listeners.add(listener);
      clearReconnectTimer();
      void connect();

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          close();
        }
      };
    }
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

  const url = new URL("/api/sync/events", baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("token", token);
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

function defaultSocketFactory(url: string): SyncSocketLike {
  const SocketConstructor = globalThis.WebSocket as unknown as { new (url: string): SyncSocketLike } | undefined;
  if (!SocketConstructor) {
    throw new Error("当前运行环境不支持 WebSocket");
  }
  return new SocketConstructor(url);
}

const syncInvalidationClient = createSyncInvalidationClient({
  getApiBaseUrl,
  getAuthToken
});

export function subscribeSyncInvalidations(listener: SyncInvalidationListener): () => void {
  return syncInvalidationClient.subscribe(listener);
}
