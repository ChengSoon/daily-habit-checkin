import { describe, expect, it, vi } from "vitest";
import { createCompanionClient, parseCompanionSse } from "./companionClient";
import { parseCompanionTtsSse } from "./ttsClient";
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

    expect(parsed).toEqual({ deltas: ["我在", "这里"], actions: [], done: true, rest: 'data: {"del' });
  });

  it("parses a validated action event alongside streamed text", () => {
    const parsed = parseCompanionSse(
      'data: {"delta":"要确认吗？"}\n\n' +
        'event: action\ndata: {"action":{"id":"action-1","command":{"type":"complete_checkin","arguments":{"habitId":"habit-1","value":null}},"summary":"完成散步打卡","status":"pending","requestedBy":"account-1","timezoneOffsetMinutes":-480,"expiresAt":"2026-07-19T12:15:00.000Z","resultMessage":null}}\n\n' +
        "data: [DONE]\n\n"
    );

    expect(parsed.deltas).toEqual(["要确认吗？"]);
    expect(parsed.actions[0]?.id).toBe("action-1");
    expect(parsed.done).toBe(true);
  });
});

describe("parseCompanionTtsSse", () => {
  it("parses PCM chunks and the done event", () => {
    expect(
      parseCompanionTtsSse(
        'event: audio\ndata: {"data":"AAE=","sampleRate":24000,"channels":1,"encoding":"pcm_s16le"}\n\n' +
          "event: done\ndata: {}\n\n"
      )
    ).toEqual({
      chunks: [{ data: "AAE=", sampleRate: 24000, channels: 1, encoding: "pcm_s16le" }],
      done: true,
      error: null,
      rest: ""
    });
  });

  it("rejects incompatible PCM metadata", () => {
    expect(() =>
      parseCompanionTtsSse(
        'event: audio\ndata: {"data":"AAE=","sampleRate":16000,"channels":1,"encoding":"pcm_s16le"}\n\n'
      )
    ).toThrow("语音格式");
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
      expect.any(Function)
    );
    expect(deltas).toEqual(["回复"]);
  });

  it("clears the shared conversation through the authenticated delete path", async () => {
    const request = vi.fn(async () => undefined);
    const client = createCompanionClient({ request, stream: vi.fn() });

    await client.clearMessages();

    expect(request).toHaveBeenCalledWith("/api/companion/messages", { method: "DELETE" });
  });

  it("confirms and cancels actions through scoped authenticated paths", async () => {
    const action = {
      id: "action-1",
      command: { type: "complete_checkin", arguments: { habitId: "habit-1", value: null } },
      summary: "完成散步打卡",
      status: "succeeded",
      requestedBy: "account-1",
      timezoneOffsetMinutes: -480,
      expiresAt: "2026-07-19T12:15:00.000Z",
      resultMessage: "已经完成。"
    };
    const request = vi.fn(async () => ({ action, message: "已经完成。", resources: ["check_ins"] }));
    const client = createCompanionClient({ request, stream: vi.fn() });

    await expect(client.confirmAction("action-1")).resolves.toMatchObject({ message: "已经完成。" });
    await expect(client.cancelAction("action-1")).resolves.toMatchObject({ message: "已经完成。" });
    expect(request).toHaveBeenNthCalledWith(1, "/api/companion/actions/action-1/confirm", { method: "POST" });
    expect(request).toHaveBeenNthCalledWith(2, "/api/companion/actions/action-1/cancel", { method: "POST" });
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
