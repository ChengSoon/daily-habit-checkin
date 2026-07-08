import { beforeEach, describe, expect, it } from "vitest";
import { resetSyncBackend } from "../../test/fakes/syncBackend";
import { completeCheckIn, isHabitCompletedOn, listCheckInsForHabit, undoCheckIn } from "./checkinRepository";

describe("check-in repository", () => {
  beforeEach(() => {
    resetSyncBackend();
  });

  it("removes an existing check-in for a habit and date", async () => {
    const checkIn = await completeCheckIn({
      habitId: "habit_1",
      date: "2026-07-08",
      value: null,
      note: null
    });

    const removed = await undoCheckIn({ habitId: "habit_1", date: "2026-07-08" });

    expect(removed?.id).toBe(checkIn.id);
    expect(await isHabitCompletedOn("habit_1", "2026-07-08")).toBe(false);
    expect(await listCheckInsForHabit("habit_1")).toHaveLength(0);
  });

  it("returns null when there is no matching check-in to undo", async () => {
    await completeCheckIn({
      habitId: "habit_1",
      date: "2026-07-08",
      value: null,
      note: null
    });

    const removed = await undoCheckIn({ habitId: "habit_2", date: "2026-07-08" });

    expect(removed).toBeNull();
    expect(await isHabitCompletedOn("habit_1", "2026-07-08")).toBe(true);
  });

  it("does not remove a check-in when the expected id no longer matches", async () => {
    await completeCheckIn({
      habitId: "habit_1",
      date: "2026-07-08",
      value: null,
      note: null
    });

    const removed = await undoCheckIn({
      habitId: "habit_1",
      date: "2026-07-08",
      checkInId: "stale_checkin_id"
    });

    expect(removed).toBeNull();
    expect(await isHabitCompletedOn("habit_1", "2026-07-08")).toBe(true);
  });
});
