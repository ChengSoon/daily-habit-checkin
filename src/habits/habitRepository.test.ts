import { beforeEach, describe, expect, it } from "vitest";
import { initializeDatabase, resetDatabaseForTests } from "../db/database";
import { createHabit, deleteHabit, getHabitById, listActiveHabits, setHabitPaused, updateHabit } from "./habitRepository";

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
    expect(habits[0]?.sortOrder).toBe(0);
  });

  it("enforces at most seven active habits", async () => {
    for (let index = 0; index < 7; index += 1) {
      await createHabit({
        name: `习惯 ${index + 1}`,
        description: null,
        frequency: { type: "daily" },
        reminderTime: null,
        isReminderEnabled: false,
        trackType: "check",
        numericUnit: null
      });
    }

    await expect(
      createHabit({
        name: "第八个习惯",
        description: null,
        frequency: { type: "daily" },
        reminderTime: null,
        isReminderEnabled: false,
        trackType: "check",
        numericUnit: null
      })
    ).rejects.toThrow("最多只能同时管理 7 个活跃习惯");
  });

  it("updates, pauses, resumes, and deletes a habit", async () => {
    const habit = await createHabit({
      name: "每日阅读",
      description: "睡前阅读 10 分钟",
      frequency: { type: "daily" },
      reminderTime: "21:30",
      isReminderEnabled: true,
      trackType: "numeric",
      numericUnit: "分钟"
    });

    await updateHabit(habit.id, {
      name: "晨间阅读",
      description: "早起阅读",
      frequency: { type: "weekdays" },
      reminderTime: "08:00",
      isReminderEnabled: true,
      trackType: "check",
      numericUnit: null
    });

    const updated = await getHabitById(habit.id);
    expect(updated?.name).toBe("晨间阅读");
    expect(updated?.frequency).toEqual({ type: "weekdays" });

    await setHabitPaused(habit.id, true);
    expect(await listActiveHabits()).toHaveLength(0);

    await setHabitPaused(habit.id, false);
    expect(await listActiveHabits()).toHaveLength(1);

    await deleteHabit(habit.id);
    expect(await getHabitById(habit.id)).toBeNull();
  });
});
