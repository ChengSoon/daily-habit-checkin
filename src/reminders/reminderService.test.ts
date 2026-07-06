import { describe, expect, it } from "vitest";
import { isWithinQuietHours, parseReminderTime, scheduleEveningSummary } from "./reminderService";

describe("parseReminderTime", () => {
  it("parses HH:mm time", () => {
    expect(parseReminderTime("21:30")).toEqual({ hour: 21, minute: 30 });
  });

  it("rejects invalid time", () => {
    expect(() => parseReminderTime("25:99")).toThrow("Invalid reminder time");
  });
});

describe("isWithinQuietHours", () => {
  it("matches times inside a same-day range", () => {
    expect(isWithinQuietHours("13:00", "12:00", "14:00")).toBe(true);
    expect(isWithinQuietHours("11:59", "12:00", "14:00")).toBe(false);
  });

  it("treats start as inclusive and end as exclusive", () => {
    expect(isWithinQuietHours("12:00", "12:00", "14:00")).toBe(true);
    expect(isWithinQuietHours("14:00", "12:00", "14:00")).toBe(false);
  });

  it("handles ranges that cross midnight", () => {
    expect(isWithinQuietHours("23:00", "22:00", "08:00")).toBe(true);
    expect(isWithinQuietHours("02:30", "22:00", "08:00")).toBe(true);
    expect(isWithinQuietHours("08:00", "22:00", "08:00")).toBe(false);
    expect(isWithinQuietHours("12:00", "22:00", "08:00")).toBe(false);
  });

  it("returns false when start equals end", () => {
    expect(isWithinQuietHours("09:00", "08:00", "08:00")).toBe(false);
  });
});

describe("scheduleEveningSummary", () => {
  it("skips invalid reminder times instead of rejecting", async () => {
    await expect(
      scheduleEveningSummary({
        incompleteCount: 1,
        incompleteNames: ["读书"],
        time: "21:3"
      })
    ).resolves.toBeNull();
  });
});
