import { beforeEach, describe, expect, it } from "vitest";
import { completeCheckIn } from "../checkins/checkinRepository";
import { resetSyncBackend } from "../../test/fakes/syncBackend";
import { createHabit } from "../habits/habitRepository";
import { getWallet, listXpTransactions } from "./xpRepository";
import { awardXpForCheckIn, revokeXpForCheckIn } from "./xpService";

describe("xp service", () => {
  beforeEach(() => {
    resetSyncBackend();
  });

  it("awards XP once for a completed check-in", async () => {
    const habit = await createHabit({
      name: "阅读",
      description: null,
      frequency: { type: "daily" },
      reminderTime: null,
      isReminderEnabled: false,
      trackType: "check",
      numericUnit: null
    });
    await completeCheckIn({ habitId: habit.id, date: "2026-07-06", value: null, note: null });

    const first = await awardXpForCheckIn({ habitId: habit.id, dateKey: "2026-07-06" });
    const second = await awardXpForCheckIn({ habitId: habit.id, dateKey: "2026-07-06" });

    expect(first.awards.map((award) => award.reason)).toEqual(["checkin"]);
    expect(second.insertedTransactions).toHaveLength(0);
    expect(await getWallet()).toMatchObject({ balance: 10, lifetimeEarned: 10 });
    expect(await listXpTransactions()).toHaveLength(1);
  });

  it("awards a three-day streak bonus", async () => {
    const habit = await createHabit({
      name: "运动",
      description: null,
      frequency: { type: "daily" },
      reminderTime: null,
      isReminderEnabled: false,
      trackType: "check",
      numericUnit: null
    });

    for (const date of ["2026-07-01", "2026-07-02", "2026-07-03"]) {
      await completeCheckIn({ habitId: habit.id, date, value: null, note: null });
    }

    const result = await awardXpForCheckIn({ habitId: habit.id, dateKey: "2026-07-03" });

    expect(result.awards.map((award) => award.reason)).toEqual(["checkin", "streak_3"]);
    expect(await getWallet()).toMatchObject({ balance: 30, lifetimeEarned: 30 });
  });

  it("reverses XP awarded for an undone check-in once", async () => {
    const habit = await createHabit({
      name: "阅读",
      description: null,
      frequency: { type: "daily" },
      reminderTime: null,
      isReminderEnabled: false,
      trackType: "check",
      numericUnit: null
    });
    const checkIn = await completeCheckIn({ habitId: habit.id, date: "2026-07-06", value: null, note: null });
    await awardXpForCheckIn({ habitId: habit.id, dateKey: "2026-07-06", checkInId: checkIn.id });

    const first = await revokeXpForCheckIn({ habitId: habit.id, dateKey: "2026-07-06", checkInId: checkIn.id });
    const second = await revokeXpForCheckIn({ habitId: habit.id, dateKey: "2026-07-06", checkInId: checkIn.id });

    expect(first.reversedAmount).toBe(10);
    expect(second.insertedTransactions).toHaveLength(0);
    expect(await getWallet()).toMatchObject({ balance: 0, lifetimeEarned: 10, lifetimeSpent: 10 });
    expect(await listXpTransactions()).toHaveLength(2);
  });

  it("awards XP again when a user re-completes after undoing", async () => {
    const habit = await createHabit({
      name: "阅读",
      description: null,
      frequency: { type: "daily" },
      reminderTime: null,
      isReminderEnabled: false,
      trackType: "check",
      numericUnit: null
    });
    const firstCheckIn = await completeCheckIn({ habitId: habit.id, date: "2026-07-06", value: null, note: null });
    await awardXpForCheckIn({ habitId: habit.id, dateKey: "2026-07-06", checkInId: firstCheckIn.id });
    await revokeXpForCheckIn({ habitId: habit.id, dateKey: "2026-07-06", checkInId: firstCheckIn.id });
    const secondCheckIn = await completeCheckIn({ habitId: habit.id, date: "2026-07-06", value: null, note: null });

    const result = await awardXpForCheckIn({ habitId: habit.id, dateKey: "2026-07-06", checkInId: secondCheckIn.id });

    expect(result.insertedTransactions).toHaveLength(1);
    expect(result.insertedTransactions[0]?.uniqueKey).toBe(`checkin_redo:checkin:${habit.id}:2026-07-06:${secondCheckIn.id}`);
    expect(await getWallet()).toMatchObject({ balance: 10 });
  });
});
