import { describe, expect, it } from "vitest";
import { fallbackForEvent } from "./companionFallback";
import { createCompanionEvent } from "./companionTypes";

describe("companion fallback", () => {
  it("returns natural event-specific copy without technical details", () => {
    const event = createCompanionEvent("event-1", "all_done", { dateKey: "2026-07-19" });
    const fallback = fallbackForEvent(event);

    expect(fallback.message).toContain("完成");
    expect(fallback.message).not.toMatch(/HTTP|API|OPENAI|error/i);
    expect(fallback.eventId).toBe("event-1");
  });
});
