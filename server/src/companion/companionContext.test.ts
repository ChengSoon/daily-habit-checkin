import { describe, expect, it } from "vitest";
import {
  buildCompanionContext,
  type CompanionContextSource
} from "./companionContext.js";

const source: CompanionContextSource = {
  async listMembers() {
    return [
      { id: "account-1", displayName: "小程", email: "private@example.com" },
      { id: "account-2", displayName: "小夏", email: "partner@example.com" }
    ];
  },
  async listActiveHabits() {
    return [
      {
        id: "habit-1",
        name: "晚饭后散步",
        frequency: { type: "daily" },
        createdAt: "2026-07-01T00:00:00.000Z",
        privateDescription: "do not send"
      }
    ];
  },
  async listCheckIns() {
    return [
      {
        habitId: "habit-1",
        date: "2026-07-18",
        status: "completed",
        createdBy: "account-2",
        note: "private check-in note"
      },
      {
        habitId: "habit-1",
        date: "2026-07-19",
        status: "completed",
        createdBy: "account-1",
        note: "another private note"
      }
    ];
  },
  async listRecentMessages() {
    return Array.from({ length: 13 }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      content: index === 0 ? "oldest message must be trimmed" : `message ${index}`,
      senderAccountId: index % 2 === 0 ? "account-1" : null,
      senderName: index % 2 === 0 ? "小程" : null,
      riskLevel: "normal" as const,
      memoryProposal: null,
      memoryConfirmed: false,
      createdAt: `2026-07-19T${String(index).padStart(2, "0")}:00:00.000Z`
    }));
  },
  async listMemories() {
    return [
      {
        id: "memory-1",
        category: "encouragement_style" as const,
        content: "低落时先听我说",
        createdBy: "account-1",
        creatorName: "小程",
        sourceMessageId: null,
        createdAt: "2026-07-18T12:00:00.000Z"
      }
    ];
  },
  async getBondState() {
    return { points: 64, stage: "in_sync" as const };
  }
};

describe("buildCompanionContext", () => {
  it("builds a minimal authoritative seven-day snapshot", async () => {
    const context = await buildCompanionContext({
      source,
      spaceId: "space-1",
      accountId: "account-1",
      now: new Date("2026-07-19T12:00:00.000Z"),
      timezoneOffsetMinutes: -480
    });

    expect(context.currentMemberName).toBe("小程");
    expect(context.partnerNames).toEqual(["小夏"]);
    expect(context.today).toEqual({ dateKey: "2026-07-19", due: 1, completed: 1 });
    expect(context.lastSevenDays.completed).toBe(2);
    expect(context.activeHabits).toEqual([{ id: "habit-1", name: "晚饭后散步" }]);
    expect(context.recentMessages).toHaveLength(12);
    expect(context.recentMessages[0].content).toBe("message 1");
    expect(context.memories[0].content).toBe("低落时先听我说");
    expect(context.bond).toEqual({ points: 64, stage: "in_sync" });
  });

  it("excludes private and unbounded source data", async () => {
    const context = await buildCompanionContext({
      source,
      spaceId: "space-1",
      accountId: "account-1",
      now: new Date("2026-07-19T12:00:00.000Z"),
      timezoneOffsetMinutes: -480
    });
    const serialized = JSON.stringify(context);

    expect(serialized).not.toContain("private@example.com");
    expect(serialized).not.toContain("private check-in note");
    expect(serialized).not.toContain("do not send");
    expect(serialized).not.toContain("oldest message must be trimmed");
    expect(serialized).not.toMatch(/api.?key/i);
  });
});
