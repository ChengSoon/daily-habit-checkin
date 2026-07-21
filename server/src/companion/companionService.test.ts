import { afterEach, describe, expect, it, vi } from "vitest";
import type { CompanionContext } from "./companionContext.js";
import type { MemberDeliveryState } from "./companionPolicy.js";
import type { CompanionEvent, CompanionReply } from "./companionSchemas.js";
import { createCompanionService } from "./companionService.js";

afterEach(() => vi.restoreAllMocks());

type Reservation =
  | { allowed: false; reason: "daily_cap" | "cooldown" | "duplicate" | "disabled" }
  | { allowed: true; reason: "allowed"; next: MemberDeliveryState };

const context: CompanionContext = {
  currentMemberName: "小程",
  partnerNames: ["小夏"],
  today: { dateKey: "2026-07-19", due: 1, completed: 1 },
  lastSevenDays: { due: 7, completed: 5, completionRate: 71 },
  activeHabits: [{ id: "habit-1", name: "散步" }],
  recentMessages: [],
  memories: [],
  bond: { points: 20, stage: "getting_familiar" }
};

function event(overrides: Partial<CompanionEvent> = {}): CompanionEvent {
  return {
    id: "event-1",
    type: "app_returned",
    occurredAt: "2026-07-19T12:00:00.000Z",
    timezoneOffsetMinutes: -480,
    payload: {},
    ...overrides
  } as CompanionEvent;
}

function dependencies() {
  const repository = {
    claimEvent: vi.fn(
      async (): Promise<{ claimed: boolean; cachedReply: CompanionReply | null }> => ({
        claimed: true,
        cachedReply: null
      })
    ),
    completeEvent: vi.fn(async () => undefined),
    appendAssistantMessage: vi.fn(async () => undefined),
    listRecentMessages: vi.fn(async () => []),
    listMessagePage: vi.fn(async () => ({ items: [], nextCursor: null })),
    listMemories: vi.fn(async () => []),
    saveMemory: vi.fn(),
    deleteMemory: vi.fn(),
    clearMessages: vi.fn(),
    pruneExpiredMessages: vi.fn(),
    appendExchange: vi.fn()
  };
  const stateRepository = {
    reserveDelivery: vi.fn(
      async (): Promise<Reservation> => ({
        allowed: true,
        reason: "allowed",
        next: {
          deliveryDate: "2026-07-19",
          ordinaryCount: 1,
          lastOrdinaryAt: "2026-07-19T12:00:00.000Z",
          recentFingerprints: { return: "2026-07-19T12:00:00.000Z" }
        }
      })
    ),
    awardBond: vi.fn(async () => ({
      awarded: true,
      points: 25,
      stage: "getting_familiar" as const
    })),
    getMemberState: vi.fn(),
    updateMemberPreferences: vi.fn(),
    clearConversationSummary: vi.fn(async () => undefined),
    getBondState: vi.fn(async () => context.bond)
  };
  const model = {
    respond: vi.fn(async (): Promise<CompanionReply> => ({
      version: 1,
      eventId: "event-1",
      decision: "speak",
      message: "欢迎回来，今天也可以从很小的一步开始。",
      mood: "wave",
      intent: "encourage",
      riskLevel: "normal"
    })),
    planAction: vi.fn(),
    streamChat: vi.fn()
  };
  const buildContext = vi.fn(async () => context);
  return { repository, stateRepository, model, buildContext };
}

describe("companion service respond", () => {
  it("reuses a completed event without calling policy or model", async () => {
    const deps = dependencies();
    const cached: CompanionReply = {
      version: 1,
      eventId: "event-1",
      decision: "silent",
      mood: "idle",
      intent: "listen",
      riskLevel: "normal"
    };
    deps.repository.claimEvent.mockResolvedValue({ claimed: false, cachedReply: cached });
    const service = createCompanionService({ ...deps, createId: () => "assistant-1" });
    await expect(
      service.respond({ spaceId: "space-1", accountId: "account-1", event: event() })
    ).resolves.toEqual(cached);
    expect(deps.stateRepository.reserveDelivery).not.toHaveBeenCalled();
    expect(deps.model.respond).not.toHaveBeenCalled();
  });
  it("returns silent when server policy blocks and never calls the model", async () => {
    const deps = dependencies();
    deps.stateRepository.reserveDelivery.mockResolvedValue({
      allowed: false as const,
      reason: "daily_cap" as const
    });
    const service = createCompanionService({ ...deps, createId: () => "assistant-1" });
    const reply = await service.respond({
      spaceId: "space-1",
      accountId: "account-1",
      event: event()
    });
    expect(reply.decision).toBe("silent");
    expect(deps.model.respond).not.toHaveBeenCalled();
    expect(deps.repository.completeEvent).toHaveBeenCalledWith("space-1", "event-1", reply);
  });
  it("uses direct crisis support without calling the model", async () => {
    const deps = dependencies();
    const service = createCompanionService({ ...deps, createId: () => "assistant-1" });
    const moodEvent = event({
      type: "mood_checkin",
      payload: { score: 1, note: "我想自杀，不想活了" }
    });
    const reply = await service.respond({
      spaceId: "space-1",
      accountId: "account-1",
      event: moodEvent
    });
    expect(reply.riskLevel).toBe("crisis");
    expect(reply.message).toContain("紧急");
    expect(deps.model.respond).not.toHaveBeenCalled();
    expect(deps.repository.appendAssistantMessage).toHaveBeenCalled();
  });
  it("falls back naturally when the model fails without awarding bond", async () => {
    const deps = dependencies();
    deps.model.respond.mockRejectedValue(new Error("upstream secret error"));
    const service = createCompanionService({ ...deps, createId: () => "assistant-1" });
    const reply = await service.respond({
      spaceId: "space-1",
      accountId: "account-1",
      event: event()
    });
    expect(reply.message).not.toContain("upstream");
    expect(deps.stateRepository.awardBond).not.toHaveBeenCalled();
    expect(deps.repository.saveMemory).not.toHaveBeenCalled();
  });
  it("resolves a space model and logs only redacted provider failure metadata", async () => {
    const deps = dependencies();
    const error = Object.assign(new Error("upstream secret error"), {
      status: 429,
      code: "insufficient_quota"
    });
    deps.model.respond.mockRejectedValue(error);
    const resolveModel = vi.fn(async () => ({ model: deps.model, source: "space" as const }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const service = createCompanionService({
      ...deps,
      resolveModel,
      createId: () => "assistant-1"
    });

    await service.respond({ spaceId: "space-1", accountId: "account-1", event: event() });

    expect(resolveModel).toHaveBeenCalledWith("space-1");
    expect(warn).toHaveBeenCalledWith(
      "companion model failed",
      expect.objectContaining({
        operation: "respond",
        source: "space",
        name: "Error",
        status: 429,
        code: "insufficient_quota"
      })
    );
    expect(JSON.stringify(warn.mock.calls)).not.toContain("upstream secret error");
  });
  it("keeps the fallback when a provider rejects with a non-Error value", async () => {
    const deps = dependencies();
    deps.model.respond.mockRejectedValue(null);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const service = createCompanionService({ ...deps, createId: () => "assistant-1" });

    const reply = await service.respond({
      spaceId: "space-1",
      accountId: "account-1",
      event: event()
    });

    expect(reply.message).toBe("回来啦，今天也可以慢慢来。");
    expect(warn).toHaveBeenCalledWith(
      "companion model failed",
      expect.objectContaining({ name: "UnknownError", source: "server" })
    );
  });
  it("persists a validated success and awards deterministic bond points", async () => {
    const deps = dependencies();
    const service = createCompanionService({ ...deps, createId: () => "assistant-1" });
    const doneEvent = event({ type: "all_done", payload: { dateKey: "2026-07-19" } });
    const reply = await service.respond({
      spaceId: "space-1",
      accountId: "account-1",
      event: doneEvent
    });
    expect(deps.repository.completeEvent).toHaveBeenCalledWith("space-1", "event-1", reply);
    expect(deps.repository.appendAssistantMessage).toHaveBeenCalledWith(
      "space-1",
      expect.objectContaining({ id: "assistant-1", eventId: "event-1" })
    );
    expect(deps.stateRepository.awardBond).toHaveBeenCalledWith(
      "space-1",
      "all_done:2026-07-19",
      5
    );
  });

  it("awards milestone bond points when the check-in event carries the milestone fact", async () => {
    const deps = dependencies();
    const service = createCompanionService({ ...deps, createId: () => "assistant-1" });
    const milestoneEvent = event({
      type: "checkin_completed",
      payload: { habitId: "habit-1", streak: 7, allDone: false, milestoneDays: 7 }
    });

    await service.respond({ spaceId: "space-1", accountId: "account-1", event: milestoneEvent });
    expect(deps.stateRepository.awardBond).toHaveBeenCalledWith("space-1", "streak:habit-1:7", 5);
  });
});
describe("companion service chat and shared state", () => {
  it("streams and persists one user/assistant exchange", async () => {
    const deps = dependencies();
    deps.model.streamChat.mockImplementation(async (_input, onDelta) => {
      onDelta("我在");
      onDelta("这里。");
      return "我在这里。";
    });
    const resolveModel = vi.fn(async () => ({ model: deps.model, source: "space" as const }));
    const service = createCompanionService({
      ...deps,
      resolveModel,
      createId: () => "assistant-1"
    });
    const deltas: string[] = [];
    await expect(
      service.chat(
        {
          spaceId: "space-1",
          accountId: "account-1",
          input: { messageId: "user-1", message: "陪我聊聊", timezoneOffsetMinutes: -480 }
        },
        (delta) => deltas.push(delta)
      )
    ).resolves.toBe("我在这里。");
    expect(resolveModel).toHaveBeenCalledWith("space-1");
    expect(deltas).toEqual(["我在", "这里。"]);
    expect(deps.repository.appendExchange).toHaveBeenCalledWith(
      "space-1",
      "account-1",
      expect.objectContaining({
        userMessageId: "user-1",
        assistantMessageId: "assistant-1",
        memoryProposal: null
      })
    );
  });

  it("persists an explicit action proposal and emits it without executing", async () => {
    const deps = dependencies();
    deps.model.planAction.mockResolvedValue({
      decision: "propose_action",
      message: "要为散步完成今天的打卡吗？",
      action: { type: "complete_checkin", arguments: { habitId: "habit-1", value: null } }
    });
    const service = createCompanionService({ ...deps, createId: (() => {
      let index = 0;
      return () => `generated-${++index}`;
    })() });
    const actions: unknown[] = [];
    const deltas: string[] = [];

    await expect(
      service.chat(
        {
          spaceId: "space-1",
          accountId: "account-1",
          input: { messageId: "user-1", message: "帮我完成散步打卡", timezoneOffsetMinutes: -480 }
        },
        (delta) => deltas.push(delta),
        (action) => actions.push(action)
      )
    ).resolves.toBe("要为散步完成今天的打卡吗？");
    expect(deltas).toEqual(["要为散步完成今天的打卡吗？"]);
    expect(actions).toHaveLength(1);
    expect(deps.model.streamChat).not.toHaveBeenCalled();
    expect(deps.repository.appendExchange).toHaveBeenCalledWith(
      "space-1",
      "account-1",
      expect.objectContaining({ action: expect.objectContaining({ command: expect.objectContaining({ type: "complete_checkin" }) }) })
    );
  });

  it("does not send action-like chat messages to a second model call", async () => {
    const deps = dependencies();
    deps.model.planAction.mockResolvedValue({ decision: "chat", message: "可以，我们先聊聊这个习惯。" });
    const service = createCompanionService({ ...deps, createId: () => "assistant-1" });

    await expect(
      service.chat(
        {
          spaceId: "space-1",
          accountId: "account-1",
          input: { messageId: "user-1", message: "我想聊聊我的习惯", timezoneOffsetMinutes: -480 }
        },
        () => undefined
      )
    ).resolves.toBe("可以，我们先聊聊这个习惯。");
    expect(deps.model.streamChat).not.toHaveBeenCalled();
  });
  it("persists a memory proposal for an explicit remember request", async () => {
    const deps = dependencies();
    deps.model.streamChat.mockResolvedValue("好，我先把它整理成共同记忆。");
    const service = createCompanionService({ ...deps, createId: () => "assistant-1" });
    await service.chat(
      {
        spaceId: "space-1",
        accountId: "account-1",
        input: {
          messageId: "user-1",
          message: "请记住，我们想每周一起散步三次",
          timezoneOffsetMinutes: -480
        }
      },
      () => undefined
    );
    expect(deps.repository.appendExchange).toHaveBeenCalledWith(
      "space-1",
      "account-1",
      expect.objectContaining({
        memoryProposal: { category: "shared_goal", content: "我们想每周一起散步三次" }
      })
    );
  });
  it("streams direct crisis support without calling the model", async () => {
    const deps = dependencies();
    const service = createCompanionService({ ...deps, createId: () => "assistant-1" });
    const deltas: string[] = [];
    const reply = await service.chat(
      {
        spaceId: "space-1",
        accountId: "account-1",
        input: { messageId: "user-1", message: "我想自杀", timezoneOffsetMinutes: -480 }
      },
      (delta) => deltas.push(delta)
    );
    expect(reply).toContain("紧急");
    expect(deltas).toEqual([reply]);
    expect(deps.model.streamChat).not.toHaveBeenCalled();
  });
  it("saves confirmed shared memory and awards bond once", async () => {
    const deps = dependencies();
    const memory = {
      id: "memory-1",
      category: "shared_goal" as const,
      content: "一起坚持散步",
      createdBy: "account-1",
      creatorName: "小程",
      sourceMessageId: null,
      createdAt: "2026-07-19T12:00:00.000Z"
    };
    deps.repository.saveMemory.mockResolvedValue(memory);
    const service = createCompanionService({ ...deps, createId: () => "assistant-1" });
    await expect(
      service.saveMemory("space-1", "account-1", {
        category: "shared_goal",
        content: "一起坚持散步"
      })
    ).resolves.toEqual(memory);
    expect(deps.stateRepository.awardBond).toHaveBeenCalledWith(
      "space-1",
      "memory:memory-1",
      3
    );
  });
  it("clears messages and their compressed summary together", async () => {
    const deps = dependencies();
    const clearConversationSummary = vi.fn(async () => undefined);
    const service = createCompanionService({
      ...deps,
      stateRepository: { ...deps.stateRepository, clearConversationSummary },
      createId: () => "assistant-1"
    });
    await service.clearMessages("space-1");
    expect(deps.repository.clearMessages).toHaveBeenCalledWith("space-1");
    expect(clearConversationSummary).toHaveBeenCalledWith("space-1");
  });
});
