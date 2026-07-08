import { describe, expect, it } from "vitest";
import { CheckIn } from "./types";
import { canUndoCheckIn } from "./undoWindow";

function completedAt(createdAt: string): CheckIn {
  return {
    id: "checkin_1",
    habitId: "habit_1",
    date: "2026-07-08",
    status: "completed",
    value: null,
    note: null,
    createdAt,
    createdBy: null
  };
}

describe("check-in undo window", () => {
  it("allows undo within one minute including the boundary", () => {
    const checkIn = completedAt("2026-07-08T10:00:00.000Z");

    expect(canUndoCheckIn(checkIn, new Date("2026-07-08T10:00:59.999Z"))).toBe(true);
    expect(canUndoCheckIn(checkIn, new Date("2026-07-08T10:01:00.000Z"))).toBe(true);
  });

  it("disallows undo after one minute", () => {
    const checkIn = completedAt("2026-07-08T10:00:00.000Z");

    expect(canUndoCheckIn(checkIn, new Date("2026-07-08T10:01:00.001Z"))).toBe(false);
  });
});
