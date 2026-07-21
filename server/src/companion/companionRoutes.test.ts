import express from "express";
import type { Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompanionService } from "./companionService.js";
import { createCompanionRouter } from "./companionRoutes.js";

const reply = {
  version: 1 as const,
  eventId: "event-1",
  decision: "speak" as const,
  message: "欢迎回来。",
  mood: "wave" as const,
  intent: "encourage" as const,
  riskLevel: "normal" as const
};

function serviceMock(): CompanionService {
  return {
    respond: vi.fn(async () => reply),
    chat: vi.fn(async (_input, onDelta) => {
      onDelta("我在");
      onDelta("这里。");
      return "我在这里。";
    }),
    listMessages: vi.fn(async () => ({ items: [], nextCursor: null })),
    listMemories: vi.fn(async () => []),
    saveMemory: vi.fn(async (_spaceId, accountId, proposal) => ({
      id: "memory-1",
      ...proposal,
      createdBy: accountId,
      creatorName: "小程",
      createdAt: "2026-07-19T12:00:00.000Z"
    })),
    deleteMemory: vi.fn(async () => true),
    clearMessages: vi.fn(async () => undefined),
    getState: vi.fn(async () => ({
      member: {
        petVisible: true,
        proactiveMode: "balanced" as const,
        deliveryDate: "2026-07-19",
        ordinaryCount: 0,
        lastOrdinaryAt: null,
        recentFingerprints: {},
        lastActiveAt: null
      },
      bond: { points: 20, stage: "getting_familiar" as const }
    })),
    updateState: vi.fn(async () => ({
      member: {
        petVisible: false,
        proactiveMode: "restrained" as const,
        deliveryDate: "2026-07-19",
        ordinaryCount: 0,
        lastOrdinaryAt: null,
        recentFingerprints: {},
        lastActiveAt: null
      },
      bond: { points: 20, stage: "getting_familiar" as const }
    }))
  };
}

function ttsMock() {
  return {
    stream: vi.fn(async (_input, onAudio) => {
      onAudio({
        data: "AAE=",
        sampleRate: 24000,
        channels: 1,
        encoding: "pcm_s16le"
      });
    })
  };
}

let server: Server | null = null;

afterEach(() => {
  server?.close();
  server = null;
  vi.clearAllMocks();
});

async function start(service = serviceMock(), tts = ttsMock()) {
  const onChange = vi.fn();
  const app = express();
  app.use(express.json());
  app.use(
    "/api/companion",
    (request, response, next) => {
      if (request.header("authorization") !== "Bearer test-token") {
        response.status(401).json({ error: "未登录" });
        return;
      }
      request.spaceId = "space-1";
      request.accountId = "account-1";
      next();
    },
    createCompanionRouter({ service, tts, onChange })
  );
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server!.address();
  if (!address || typeof address === "string") throw new Error("测试服务监听失败");
  return { baseUrl: `http://127.0.0.1:${address.port}/api/companion`, service, tts, onChange };
}

const event = {
  id: "event-1",
  type: "app_returned",
  occurredAt: "2026-07-19T12:00:00.000Z",
  timezoneOffsetMinutes: -480,
  payload: {}
};

function headers() {
  return { authorization: "Bearer test-token", "content-type": "application/json" };
}

describe("companion routes", () => {
  it("rejects unauthenticated requests before invoking the service", async () => {
    const { baseUrl, service } = await start();
    const response = await fetch(`${baseUrl}/state`);

    expect(response.status).toBe(401);
    expect(service.getState).not.toHaveBeenCalled();
  });

  it("uses auth identity and rejects a client-provided spaceId", async () => {
    const { baseUrl, service } = await start();
    const invalid = await fetch(`${baseUrl}/respond`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ event, spaceId: "space-evil" })
    });
    expect(invalid.status).toBe(400);

    const response = await fetch(`${baseUrl}/respond`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ event })
    });
    expect(response.status).toBe(200);
    expect(service.respond).toHaveBeenCalledWith({
      spaceId: "space-1",
      accountId: "account-1",
      event
    });
  });

  it("streams chat deltas as SSE and notifies the shared space", async () => {
    const { baseUrl, onChange } = await start();
    const response = await fetch(`${baseUrl}/chat`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        messageId: "message-1",
        message: "陪我聊聊",
        timezoneOffsetMinutes: -480
      })
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain('data: {"delta":"我在"}');
    expect(body).toContain('data: {"delta":"这里。"}');
    expect(body).toContain("data: [DONE]");
    expect(onChange).toHaveBeenCalledWith("space-1", "companion");
  });

  it("streams normalized PCM audio events", async () => {
    const tts = ttsMock();
    const { baseUrl } = await start(serviceMock(), tts);
    const response = await fetch(`${baseUrl}/tts`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ text: "陪我说句话" })
    });
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(body).toContain('event: audio\ndata: {"data":"AAE=","sampleRate":24000,"channels":1,"encoding":"pcm_s16le"}');
    expect(body).toContain("event: done\ndata: {}");
    expect(tts.stream).toHaveBeenCalledWith(
      { text: "陪我说句话" },
      expect.any(Function),
      expect.any(AbortSignal)
    );
  });

  it("exposes space-scoped messages, memories, and member state", async () => {
    const { baseUrl, service, onChange } = await start();
    expect((await fetch(`${baseUrl}/messages?limit=20`, { headers: headers() })).status).toBe(200);
    expect((await fetch(`${baseUrl}/memories`, { headers: headers() })).status).toBe(200);
    expect((await fetch(`${baseUrl}/state`, { headers: headers() })).status).toBe(200);

    const saved = await fetch(`${baseUrl}/memories`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ category: "shared_goal", content: "一起坚持散步" })
    });
    expect(saved.status).toBe(201);
    expect(service.saveMemory).toHaveBeenCalledWith("space-1", "account-1", {
      category: "shared_goal",
      content: "一起坚持散步"
    });

    expect(
      (
        await fetch(`${baseUrl}/state`, {
          method: "PUT",
          headers: headers(),
          body: JSON.stringify({ petVisible: false, proactiveMode: "restrained" })
        })
      ).status
    ).toBe(200);
    expect(
      (await fetch(`${baseUrl}/memories/memory-1`, { method: "DELETE", headers: headers() })).status
    ).toBe(204);
    expect((await fetch(`${baseUrl}/messages`, { method: "DELETE", headers: headers() })).status).toBe(204);
    expect(onChange).toHaveBeenCalledWith("space-1", "companion");
  });

  it("does not expose internal service errors", async () => {
    const service = serviceMock();
    vi.mocked(service.respond).mockRejectedValue(new Error("OPENAI_API_KEY=secret"));
    const { baseUrl } = await start(service);
    const response = await fetch(`${baseUrl}/respond`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ event })
    });
    const body = await response.text();

    expect(response.status).toBe(503);
    expect(body).not.toContain("secret");
  });
});
