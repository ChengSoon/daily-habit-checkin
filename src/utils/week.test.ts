import { afterEach, describe, expect, it, vi } from "vitest";
import { buildCurrentWeekDays } from "./week";

describe("buildCurrentWeekDays", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns 7 days starting from Monday for a Saturday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-18T12:00:00"));

    const days = buildCurrentWeekDays(new Date("2026-07-18T12:00:00"));
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.weekdayLabel)).toEqual(["一", "二", "三", "四", "五", "六", "日"]);
    expect(days[0].dateKey).toBe("2026-07-13");
    expect(days[5].dateKey).toBe("2026-07-18");
    expect(days[5].isToday).toBe(true);
    expect(days[5].status).toBe("today");
    expect(days[6].dateKey).toBe("2026-07-19");
    expect(days[6].status).toBe("future");
  });
});
