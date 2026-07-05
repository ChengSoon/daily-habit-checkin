import { beforeEach, describe, expect, it } from "vitest";
import { initializeDatabase, resetDatabaseForTests } from "../db/database";
import { createHabit, listActiveHabits } from "./habitRepository";

describe("habit repository", () => {
  beforeEach(async () => {
    await initializeDatabase();
    await resetDatabaseForTests();
  });

  it("creates and lists active habits", async () => {
    await createHabit({
      name: "每日阅读",
      description: "睡前阅读 10 分钟",
      frequency: { type: "daily" },
      reminderTime: "21:30",
      isReminderEnabled: true,
      trackType: "numeric",
      numericUnit: "分钟"
    });

    const habits = await listActiveHabits();

    expect(habits).toHaveLength(1);
    expect(habits[0]?.name).toBe("每日阅读");
    expect(habits[0]?.isPaused).toBe(false);
  });
});
