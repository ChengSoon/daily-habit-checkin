import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompanionContext } from "./companionContext.js";
import {
  createCompanionModel,
  type CompanionOpenAiClient
} from "./companionModel.js";

const context: CompanionContext = {
  currentMemberName: "小程",
  partnerNames: ["小夏"],
  today: { dateKey: "2026-07-19", due: 1, completed: 0 },
  lastSevenDays: { due: 7, completed: 4, completionRate: 57 },
  activeHabits: [{ id: "habit-1", name: "散步" }],
  recentMessages: [
    { role: "user", content: "昨天有点累", senderName: "小程" },
    { role: "assistant", content: "那就早点休息。", senderName: null }
  ],
  memories: [{ category: "encouragement_style", content: "低落时先听我说" }],
  bond: { points: 20, stage: "getting_familiar" }
};

const event = {
  id: "event-1",
  type: "app_returned" as const,
  occurredAt: "2026-07-19T12:00:00.000Z",
  timezoneOffsetMinutes: -480,
  payload: {}
};

function clientWith(create: CompanionOpenAiClient["chat"]["completions"]["create"]): CompanionOpenAiClient {
  return { chat: { completions: { create } } };
}

afterEach(() => vi.unstubAllEnvs());

describe("companion model", () => {
  it("defers missing model configuration until a model call", async () => {
    const model = createCompanionModel({
      client: clientWith(async () => ({ choices: [] })),
      model: ""
    });

    await expect(model.respond({ event, context })).rejects.toThrow("OPENAI_MODEL");
  });

  it("defers missing OpenAI credentials until a model call", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_MODEL", "test-model");

    const model = createCompanionModel();

    await expect(model.respond({ event, context })).rejects.toThrow("OPENAI_API_KEY");
  });

  it("uses explicit provider credentials for a space model", async () => {
    const client = clientWith(async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify({
              version: 1,
              eventId: "event-1",
              decision: "speak",
              message: "收到啦。",
              mood: "wave",
              intent: "encourage",
              riskLevel: "normal"
            })
          }
        }
      ]
    }));
    const createClient = vi.fn(() => client);
    const model = createCompanionModel({
      apiKey: "space-key",
      baseUrl: "https://relay.example.com/v1",
      model: "space-model",
      createClient
    });

    await expect(model.respond({ event, context })).resolves.toMatchObject({ eventId: "event-1" });
    expect(createClient).toHaveBeenCalledWith("space-key", "https://relay.example.com/v1");
  });

  it("requests structured JSON and validates the reply", async () => {
    const calls: Record<string, unknown>[] = [];
    const client = clientWith(async (body) => {
      calls.push(body);
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                version: 1,
                eventId: "event-1",
                decision: "speak",
                message: "回来啦，今天想先做一点什么？",
                mood: "wave",
                intent: "encourage",
                riskLevel: "normal"
              })
            }
          }
        ]
      };
    });
    const model = createCompanionModel({ client, model: "test-model", timeoutMs: 1000 });

    await expect(model.respond({ event, context })).resolves.toMatchObject({ eventId: "event-1" });
    expect(calls[0]).toMatchObject({
      model: "test-model",
      response_format: { type: "json_object" },
      stream: false
    });
  });

  it("rejects invalid JSON and mismatched event identity", async () => {
    const invalid = createCompanionModel({
      client: clientWith(async () => ({ choices: [{ message: { content: "not-json" } }] })),
      model: "test-model"
    });
    await expect(invalid.respond({ event, context })).rejects.toThrow("合法 JSON");

    const mismatched = createCompanionModel({
      client: clientWith(async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                version: 1,
                eventId: "another-event",
                decision: "silent",
                mood: "idle",
                intent: "listen",
                riskLevel: "normal"
              })
            }
          }
        ]
      })),
      model: "test-model"
    });
    await expect(mismatched.respond({ event, context })).rejects.toThrow("eventId");
  });

  it("streams chat deltas and includes the current message once", async () => {
    const calls: Record<string, unknown>[] = [];
    const client = clientWith(async (body) => {
      calls.push(body);
      async function* chunks() {
        yield { choices: [{ delta: { content: "我在" } }] };
        yield { choices: [{ delta: { content: "这里。" } }] };
      }
      return chunks();
    });
    const model = createCompanionModel({ client, model: "test-model" });
    const deltas: string[] = [];

    await expect(
      model.streamChat({ context, userText: "陪我聊聊" }, (chunk) => deltas.push(chunk))
    ).resolves.toBe("我在这里。");
    expect(deltas).toEqual(["我在", "这里。"]);
    const messages = calls[0].messages as Array<{ role: string; content: string }>;
    expect(messages.filter((message) => message.content === "陪我聊聊")).toHaveLength(1);
  });

  it("plans a validated app action without exposing arbitrary tools", async () => {
    const calls: Record<string, unknown>[] = [];
    const client = clientWith(async (body) => {
      calls.push(body);
      return {
        choices: [
          {
            message: {
              content: JSON.stringify({
                decision: "propose_action",
                message: "要为散步完成今天的打卡吗？",
                action: {
                  type: "complete_checkin",
                  arguments: { habitId: "habit-1", value: null }
                }
              })
            }
          }
        ]
      };
    });
    const model = createCompanionModel({ client, model: "test-model" });

    await expect(model.planAction?.({ context, userText: "帮我完成散步打卡" })).resolves.toMatchObject({
      decision: "propose_action"
    });
    expect(calls[0]).toMatchObject({
      model: "test-model",
      response_format: { type: "json_object" },
      stream: false
    });
  });
});
