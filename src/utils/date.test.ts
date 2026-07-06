import { describe, expect, it } from "vitest";
import { addDays, eachDateKey, startOfMonthKey, toDateKey, todayKey } from "./date";

describe("date utils", () => {
  it("uses local calendar date, not UTC", () => {
    // 本地时间 2026-07-05 01:30，UTC+8 下 UTC 仍是 07-04。
    // toDateKey 必须返回本地日期 07-05，否则凌晨打卡会记到前一天。
    const localEarlyMorning = new Date(2026, 6, 5, 1, 30, 0);
    expect(toDateKey(localEarlyMorning)).toBe("2026-07-05");
  });

  it("todayKey matches toDateKey of now", () => {
    expect(todayKey()).toBe(toDateKey(new Date()));
  });

  it("adds days within a month", () => {
    expect(addDays("2026-07-05", 3)).toBe("2026-07-08");
  });

  it("adds days across a month boundary", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
  });

  it("adds days across a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("subtracts days", () => {
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
  });

  it("builds an inclusive date range", () => {
    expect(eachDateKey("2026-07-05", "2026-07-08")).toEqual([
      "2026-07-05",
      "2026-07-06",
      "2026-07-07",
      "2026-07-08"
    ]);
  });

  it("builds a range that spans a month boundary", () => {
    expect(eachDateKey("2026-07-30", "2026-08-02")).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02"
    ]);
  });

  it("returns start of month", () => {
    expect(startOfMonthKey("2026-07-05")).toBe("2026-07-01");
  });
});
