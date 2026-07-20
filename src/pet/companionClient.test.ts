import { describe, expect, it, vi } from "vitest";
import { createCompanionClient, parseCompanionSse } from "./companionClient";
import { createCompanionEvent } from "./companionTypes";

vi.mock("../sync/apiClient", () => {
  class SyncError extends Error {}
  class UnauthorizedError extends SyncError {}
  return {
    apiRequest: vi.fn(),
    getApiBaseUrl: () => "http://test.local",
    SyncError,
    UnauthorizedError
  };
});

vi.mock("../sync/localSettings", () => ({
  clearAuthToken: vi.fn(),
  getAuthToken: vi.fn(async () => "test-token")
}));

describe("parseCompanionSse", () => {
  it("parses complete deltas, done, and preserves an incomplete tail", () => {
    const parsed = parseCompanionSse(
      'data: {"delta":"我在"}\n\ndata: {"delta":"这里"}\n\ndata: [DONE]\n\ndata: {"del'
    );

    expect(parsed).toEqual({ deltas: ["我在", "这里"], done: true, rest: 'data: {"del' });
  });
});

describe("companion client", () => {
  it("uses authenticated companion paths and validates replies", async () => {
    const request = vi.fn(async (path: string) => {
      if (path === "/api/companion/respond") {
        return {
          version: 1,
          eventId: "event-1",
          decision: "silent",
          mood: "idle",
          intent: "listen",
          riskLevel: "normal"
        };
      }
      return { memories: [] };
    });
    const stream = vi.fn(async () => "流式回复");
    const client = createCompanionClient({ request, stream });
    const event = createCompanionEvent("event-1", "app_returned", {});

    await expect(client.respond(event)).resolves.toMatchObject({ eventId: "event-1" });
    await expect(client.listMemories()).resolves.toEqual([]);
    expect(request).toHaveBeenCalledWith("/api/companion/respond", {
      method: "POST",
      body: { event }
    });
  });

  it("delegates chat streaming without duplicating the message", async () => {
    const request = vi.fn();
    const stream = vi.fn(async (_body, onDelta: (value: string) => void) => {
      onDelta("回复");
      return "回复";
    });
    const client = createCompanionClient({ request, stream });
    const deltas: string[] = [];

    await client.chat(
      { messageId: "message-1", message: "陪我聊聊", timezoneOffsetMinutes: -480 },
      (delta) => deltas.push(delta)
    );

    expect(stream).toHaveBeenCalledWith(
      { messageId: "message-1", message: "陪我聊聊", timezoneOffsetMinutes: -480 },
      expect.any(Function),
      undefined
    );
    expect(deltas).toEqual(["回复"]);
  });

  it("confirms a proposal with its source assistant message", async () => {
    const request = vi.fn(async () => ({
      memory: {
        id: "memory-1",
        category: "shared_goal",
        content: "一起坚持散步",
        createdBy: "account-1",
        creatorName: "小程",
        sourceMessageId: "assistant-1",
        createdAt: "2026-07-19T12:00:00.000Z"
      }
    }));
    const client = createCompanionClient({ request, stream: vi.fn() });

    await client.saveMemory(
      { category: "shared_goal", content: "一起坚持散步" },
      "assistant-1"
    );

    expect(request).toHaveBeenCalledWith("/api/companion/memories", {
      method: "POST",
      body: {
        category: "shared_goal",
        content: "一起坚持散步",
        sourceMessageId: "assistant-1"
      }
    });
  });
});
