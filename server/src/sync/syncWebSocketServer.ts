import type { Server as HttpServer, IncomingMessage } from "node:http";
import { createRequire } from "node:module";
import type { Duplex } from "node:stream";
import type { Server as WebSocketServerType } from "ws";
import { getAccountById } from "../auth/accountRepository.js";
import { verifyToken } from "../auth/tokens.js";
import { syncChangeHub, SyncChangeHub } from "./changeHub.js";

type SyncWebSocketOptions = {
  hub?: SyncChangeHub;
};

const OPEN_READY_STATE = 1;
const require = createRequire(import.meta.url);
const { Server: WebSocketServer } = require("ws") as typeof import("ws");

export function attachSyncWebSocketServer(server: HttpServer, options: SyncWebSocketOptions = {}): void {
  const hub = options.hub ?? syncChangeHub;
  const wss = new WebSocketServer({
    noServer: true,
    handleProtocols(protocols: Set<string>) {
      return protocols.has("habit-sync") ? "habit-sync" : false;
    }
  });

  server.on("upgrade", (request, socket, head) => {
    void handleUpgrade({ hub, request, socket, head, wss });
  });
}

async function handleUpgrade({
  hub,
  request,
  socket,
  head,
  wss
}: {
  hub: SyncChangeHub;
  request: IncomingMessage;
  socket: Duplex;
  head: Buffer;
  wss: WebSocketServerType;
}) {
  try {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (url.pathname !== "/api/sync/events") {
      rejectUpgrade(socket, 404, "Not Found");
      return;
    }
    const spaceId = await authenticateUpgrade(request);
    if (!spaceId) {
      rejectUpgrade(socket, 401, "Unauthorized");
      return;
    }
    acceptUpgrade({ head, hub, request, socket, spaceId, wss });
  } catch {
    rejectUpgrade(socket, 500, "Internal Server Error");
  }
}

async function authenticateUpgrade(request: IncomingMessage): Promise<string | null> {
  const token = readProtocolToken(request.headers["sec-websocket-protocol"]);
  const payload = token ? verifyToken(token) : null;
  if (!payload) return null;
  const account = await getAccountById(payload.accountId);
  if (!account || account.sessionVersion !== payload.sessionVersion) return null;
  return account.spaceId;
}

function acceptUpgrade({ head, hub, request, socket, spaceId, wss }: {
  head: Buffer;
  hub: SyncChangeHub;
  request: IncomingMessage;
  socket: Duplex;
  spaceId: string;
  wss: WebSocketServerType;
}): void {
  wss.handleUpgrade(request, socket, head, (websocket) => {
    const unsubscribe = hub.addConnection(spaceId, {
      send(message) {
        if (websocket.readyState === OPEN_READY_STATE) websocket.send(message);
      }
    });
    websocket.send(JSON.stringify({ type: "connected", version: hub.getVersion(spaceId) }));
    websocket.on("close", unsubscribe);
    websocket.on("error", unsubscribe);
  });
}

export function readProtocolToken(header: string | string[] | undefined): string | null {
  const value = Array.isArray(header) ? header.join(",") : header ?? "";
  const protocol = value.split(",").map((item) => item.trim()).find((item) => item.startsWith("auth."));
  const token = protocol?.slice("auth.".length);
  return token || null;
}

function rejectUpgrade(socket: Duplex, status: number, message: string): void {
  socket.write(`HTTP/1.1 ${status} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}
