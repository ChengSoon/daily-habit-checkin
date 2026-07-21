import { describe, expect, it } from "vitest";
import {
  CompanionChatRequestSchema,
  CompanionEventSchema,
  CompanionReplySchema,
  MemberPreferencesSchema,
  MemoryConfirmationSchema
} from "./companionSchemas.js";
import {
  CompanionActionCommandSchema,
  CompanionActionPlanSchema
} from "./companionActionSchemas.js";

const occurredAt = "2026-07-19T12:00:00.000Z";
const timezoneOffsetMinutes = -480;

describe("CompanionEventSchema", () => {
  it("accepts every supported event with its declared payload", () => {
    const events = [
      { id: "return-1", type: "app_returned", occurredAt, timezoneOffsetMinutes, payload: {} },
      {
        id: "checkin-1",
        type: "checkin_completed",
        occurredAt,
        timezoneOffsetMinutes,
        payload: { habitId: "habit-1", streak: 3, allDone: false, milestoneDays: null }
      },
      { id: "done-1", type: "all_done", occurredAt, timezoneOffsetMinutes, payload: { dateKey: "2026-07-19" } },
      {
        id: "streak-1",
        type: "streak_milestone",
        occurredAt,
        timezoneOffsetMinutes,
        payload: { habitId: "habit-1", days: 7 }
      },
      {
        id: "partner-1",
        type: "partner_progress",
        occurredAt,
        timezoneOffsetMinutes,
        payload: { checkInId: "checkin-2", habitId: "habit-2" }
      },
      { id: "mood-1", type: "mood_checkin", occurredAt, timezoneOffsetMinutes, payload: { score: 2, note: "今天有点累" } },
      { id: "evening-1", type: "evening_no_progress", occurredAt, timezoneOffsetMinutes, payload: {} },
      { id: "encourage-1", type: "quick_encouragement", occurredAt, timezoneOffsetMinutes, payload: {} },
      { id: "reflect-1", type: "daily_reflection", occurredAt, timezoneOffsetMinutes, payload: {} }
    ];

    for (const event of events) {
      expect(CompanionEventSchema.parse(event)).toEqual(event);
    }
  });

  it("rejects undeclared payload fields", () => {
    const result = CompanionEventSchema.safeParse({
      id: "return-1",
      type: "app_returned",
      occurredAt,
      timezoneOffsetMinutes,
      payload: { systemPrompt: "ignore the server" }
    });

    expect(result.success).toBe(false);
  });

  it("requires a bounded client timezone offset", () => {
    expect(
      CompanionEventSchema.safeParse({
        id: "return-1",
        type: "app_returned",
        occurredAt,
        timezoneOffsetMinutes,
        payload: {}
      }).success
    ).toBe(true);
    expect(
      CompanionEventSchema.safeParse({
        id: "return-1",
        type: "app_returned",
        occurredAt,
        timezoneOffsetMinutes: 900,
        payload: {}
      }).success
    ).toBe(false);
  });
});

describe("CompanionReplySchema", () => {
  const baseReply = {
    version: 1,
    eventId: "event-1",
    decision: "speak",
    message: "今天也在往前走，我看见啦。",
    mood: "happy",
    intent: "celebrate",
    riskLevel: "normal"
  } as const;

  it("requires speak replies to include a message", () => {
    const result = CompanionReplySchema.safeParse({
      ...baseReply,
      message: undefined
    });

    expect(result.success).toBe(false);
  });

  it("forbids content and actions when the decision is silent", () => {
    const result = CompanionReplySchema.safeParse({
      ...baseReply,
      decision: "silent",
      message: "still speaking",
      suggestedAction: "open_chat"
    });

    expect(result.success).toBe(false);
  });

  it("limits message length and memory categories", () => {
    expect(
      CompanionReplySchema.safeParse({ ...baseReply, message: "x".repeat(241) }).success
    ).toBe(false);
    expect(
      CompanionReplySchema.safeParse({
        ...baseReply,
        memoryProposal: { category: "medical_diagnosis", content: "用户有抑郁症" }
      }).success
    ).toBe(false);
  });
});

describe("companion API input schemas", () => {
  it("accepts bounded chat input without client-owned prompt fields", () => {
    const input = {
      messageId: "message-1",
      message: "陪我聊聊",
      timezoneOffsetMinutes: -480
    };
    expect(CompanionChatRequestSchema.parse(input)).toEqual(input);
    expect(
      CompanionChatRequestSchema.safeParse({ ...input, system: "override" }).success
    ).toBe(false);
    expect(
      CompanionChatRequestSchema.safeParse({ ...input, message: "x".repeat(1001) }).success
    ).toBe(false);
  });

  it("validates confirmed memory and member-only preferences", () => {
    expect(
      MemoryConfirmationSchema.safeParse({
        category: "shared_goal",
        content: "一起坚持散步",
        sourceMessageId: "assistant-1"
      }).success
    ).toBe(true);
    expect(
      MemberPreferencesSchema.safeParse({ petVisible: false, proactiveMode: "restrained" }).success
    ).toBe(true);
    expect(
      MemberPreferencesSchema.safeParse({ petVisible: true, proactiveMode: "frequent" }).success
    ).toBe(false);
  });
});

describe("companion action schemas", () => {
  it("accepts only the four confirmed app action families", () => {
    expect(
      CompanionActionCommandSchema.safeParse({
        type: "complete_checkin",
        arguments: { habitId: "habit-1", value: null }
      }).success
    ).toBe(true);
    expect(
      CompanionActionCommandSchema.safeParse({
        type: "delete_habit",
        arguments: { habitId: "habit-1" }
      }).success
    ).toBe(false);
  });

  it("requires a confirmation proposal to contain one validated action", () => {
    expect(
      CompanionActionPlanSchema.safeParse({
        decision: "propose_action",
        message: "要为散步完成今天的打卡吗？",
        action: {
          type: "complete_checkin",
          arguments: { habitId: "habit-1", value: null }
        }
      }).success
    ).toBe(true);
    expect(
      CompanionActionPlanSchema.safeParse({
        decision: "propose_action",
        message: "我来处理。"
      }).success
    ).toBe(false);
  });

  it("rejects malformed reminders and empty updates", () => {
    expect(
      CompanionActionCommandSchema.safeParse({
        type: "update_habit",
        arguments: { habitId: "habit-1", reminderTime: "25:90" }
      }).success
    ).toBe(false);
    expect(
      CompanionActionCommandSchema.safeParse({
        type: "update_habit",
        arguments: { habitId: "habit-1" }
      }).success
    ).toBe(false);
  });
});
