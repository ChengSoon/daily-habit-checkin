import { describe, expect, it } from "vitest";
import { parseReminderTime } from "./reminderService";

describe("parseReminderTime", () => {
  it("parses HH:mm time", () => {
    expect(parseReminderTime("21:30")).toEqual({ hour: 21, minute: 30 });
  });

  it("rejects invalid time", () => {
    expect(() => parseReminderTime("25:99")).toThrow("Invalid reminder time");
  });
});
