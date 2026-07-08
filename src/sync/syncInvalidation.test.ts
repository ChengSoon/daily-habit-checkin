import { describe, expect, it } from "vitest";
import { createSyncInvalidationClient, SyncSocketLike } from "./syncInvalidation";

class FakeSocket implements SyncSocketLike {
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  readyState = 0;

  constructor(readonly url: string) {}

  close(): void {
    this.readyState = 3;
    this.onclose?.();
  }

  emitMessage(data: unknown): void {
    this.onmessage?.({ data: JSON.stringify(data) });
  }
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("sync invalidation client", () => {
  it("connects to the websocket endpoint with the auth token", async () => {
    const sockets: FakeSocket[] = [];
    const client = createSyncInvalidationClient({
      getApiBaseUrl: () => "https://api.example.com",
      getAuthToken: async () => "token_123",
      socketFactory: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket;
      }
    });

    const unsubscribe = client.subscribe(() => undefined);
    await flushPromises();

    expect(sockets[0].url).toBe("wss://api.example.com/api/sync/events?token=token_123");
    unsubscribe();
  });

  it("notifies listeners when a data_changed message arrives", async () => {
    const sockets: FakeSocket[] = [];
    const events: unknown[] = [];
    const client = createSyncInvalidationClient({
      getApiBaseUrl: () => "http://api.example.com",
      getAuthToken: async () => "token_123",
      socketFactory: (url) => {
        const socket = new FakeSocket(url);
        sockets.push(socket);
        return socket;
      }
    });

    const unsubscribe = client.subscribe((event) => events.push(event));
    await flushPromises();
    sockets[0].emitMessage({ type: "data_changed", resource: "habits", version: 2, changedAt: "2026-07-08T00:00:00.000Z" });

    expect(events).toEqual([
      { type: "data_changed", resource: "habits", version: 2, changedAt: "2026-07-08T00:00:00.000Z" }
    ]);
    unsubscribe();
  });
});
