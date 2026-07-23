import { describe, expect, it } from "vitest";
import { shouldAttemptEvent } from "./companionPolicy";
import { createCompanionEvent, type CompanionEvent } from "./companionTypes";

const now = new Date("2026-07-19T14:30:00.000Z");
const quietHours = { isEnabled: true, start: "22:00", end: "08:00" };

function input(type: "app_returned" | "mood_checkin" | "checkin_completed") {
  let event: CompanionEvent;
  if (type === "mood_checkin") {
    event = createCompanionEvent({ id: "event-1", type, payload: { score: 2, note: "有点累" }, occurredAt: now, timezoneOffsetMinutes: -480 });
  } else if (type === "checkin_completed") {
    event = createCompanionEvent({ id: "event-1", type, payload: { habitId: "habit-1", streak: 2,
      allDone: false, milestoneDays: null }, occurredAt: now, timezoneOffsetMinutes: -480 });
  } else {
    event = createCompanionEvent({ id: "event-1", type, payload: {}, occurredAt: now, timezoneOffsetMinutes: -480 });
  }
  return {
    event,
    appState: "active" as const,
    panelOpen: false,
    typing: false,
    bubbleDismissedAt: null,
    quietHours,
    now
  };
}

describe("shouldAttemptEvent", () => {
  it("blocks unsolicited events outside the foreground", () => {
    expect(shouldAttemptEvent({ ...input("app_returned"), appState: "background" })).toEqual({
      allowed: false,
      reason: "background"
    });
  });

  it("blocks unsolicited events during quiet hours in local time", () => {
    expect(shouldAttemptEvent(input("app_returned"))).toEqual({
      allowed: false,
      reason: "quiet_hours"
    });
  });

  it("allows requested mood support and direct check-in feedback during quiet hours", () => {
    expect(shouldAttemptEvent(input("mood_checkin"))).toEqual({ allowed: true, reason: "allowed" });
    expect(shouldAttemptEvent(input("checkin_completed"))).toEqual({
      allowed: true,
      reason: "allowed"
    });
  });

  it("does not interrupt typing or reopen immediately after dismissal", () => {
    expect(shouldAttemptEvent({ ...input("app_returned"), quietHours: undefined, typing: true })).toEqual({
      allowed: false,
      reason: "busy"
    });
    expect(
      shouldAttemptEvent({
        ...input("app_returned"),
        quietHours: undefined,
        bubbleDismissedAt: now.getTime() - 5 * 60_000
      })
    ).toEqual({ allowed: false, reason: "recently_dismissed" });
  });
});
