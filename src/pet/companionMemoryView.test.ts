import { describe, expect, it } from "vitest";
import { memoryActionForMessage } from "./companionMemoryView";
import type { CompanionMessage } from "./companionTypes";

function assistant(overrides: Partial<CompanionMessage> = {}): CompanionMessage {
  return {
    id: "assistant-1",
    role: "assistant",
    content: "我先整理成一条共同记忆。",
    senderAccountId: null,
    senderName: null,
    riskLevel: "normal",
    memoryProposal: { category: "shared_goal", content: "一起坚持散步" },
    memoryConfirmed: false,
    createdAt: "2026-07-19T12:00:00.000Z",
    ...overrides
  };
}

describe("memoryActionForMessage", () => {
  it("distinguishes pending, confirmed, and absent proposals", () => {
    expect(memoryActionForMessage(assistant())).toBe("confirm");
    expect(memoryActionForMessage(assistant({ memoryConfirmed: true }))).toBe("confirmed");
    expect(memoryActionForMessage(assistant({ memoryProposal: null }))).toBeNull();
  });
});
