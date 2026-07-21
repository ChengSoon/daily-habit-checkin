import { describe, expect, it } from "vitest";
import {
  CompanionReplySchema,
  CompanionMessageSchema,
  createCompanionEvent,
  parseCompanionReply
} from "./companionTypes";
import { CompanionActionSchema } from "./companionActionTypes";

describe("client companion contracts", () => {
  it("parses a valid shared companion reply", () => {
    const reply = {
      version: 1,
      eventId: "event-1",
      decision: "speak",
      message: "欢迎回来。",
      mood: "wave",
      intent: "encourage",
      riskLevel: "normal",
      suggestedAction: "open_chat"
    };

    expect(parseCompanionReply(reply)).toEqual(reply);
  });

  it("rejects unknown actions and silent replies with content", () => {
    expect(
      CompanionReplySchema.safeParse({
        version: 1,
        eventId: "event-1",
        decision: "speak",
        message: "越权动作",
        mood: "wave",
        intent: "encourage",
        riskLevel: "normal",
        suggestedAction: "delete_habit"
      }).success
    ).toBe(false);
    expect(
      CompanionReplySchema.safeParse({
        version: 1,
        eventId: "event-1",
        decision: "silent",
        message: "仍然说话",
        mood: "idle",
        intent: "listen",
        riskLevel: "normal"
      }).success
    ).toBe(false);
  });

  it("stamps events with timezone and stable caller identity", () => {
    expect(
      createCompanionEvent("event-1", "quick_encouragement", {}, new Date("2026-07-19T12:00:00.000Z"), -480)
    ).toEqual({
      id: "event-1",
      type: "quick_encouragement",
      occurredAt: "2026-07-19T12:00:00.000Z",
      timezoneOffsetMinutes: -480,
      payload: {}
    });
  });

  it("tracks pending and confirmed memory proposals on shared messages", () => {
    const parsed = CompanionMessageSchema.parse({
      id: "assistant-1",
      role: "assistant",
      content: "我先整理成一条共同记忆。",
      senderAccountId: null,
      senderName: null,
      riskLevel: "normal",
      memoryProposal: { category: "shared_goal", content: "一起坚持散步" },
      memoryConfirmed: false,
      createdAt: "2026-07-19T12:00:00.000Z"
    });

    expect(parsed.memoryProposal?.category).toBe("shared_goal");
    expect(parsed.memoryConfirmed).toBe(false);
  });

  it("accepts a pending whitelisted action and rejects arbitrary tools", () => {
    const action = {
      id: "action-1",
      command: {
        type: "complete_checkin",
        arguments: { habitId: "habit-1", value: null }
      },
      summary: "为「散步」完成今天打卡",
      status: "pending",
      requestedBy: "account-1",
      timezoneOffsetMinutes: -480,
      expiresAt: "2026-07-19T12:15:00.000Z",
      resultMessage: null
    };

    expect(CompanionActionSchema.parse(action)).toEqual(action);
    expect(
      CompanionActionSchema.safeParse({
        ...action,
        command: { type: "run_shell", arguments: { command: "rm -rf /" } }
      }).success
    ).toBe(false);
  });
});
