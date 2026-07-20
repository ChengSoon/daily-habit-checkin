import { beforeEach, describe, expect, it } from "vitest";
import { initializeDatabase, resetDatabaseForTests } from "../db/database";
import {
  ANDROID_REMINDER_GUIDE_STEPS,
  hasCompletedAndroidReminderGuide,
  markAndroidReminderGuideCompleted,
  resetAndroidReminderGuideForTests
} from "./androidReminderGuide";

describe("androidReminderGuide", () => {
  beforeEach(async () => {
    await initializeDatabase();
    await resetDatabaseForTests();
    await resetAndroidReminderGuideForTests();
  });

  it("exposes five user-facing setup steps", () => {
    expect(ANDROID_REMINDER_GUIDE_STEPS.map((step) => step.id)).toEqual([
      "permission",
      "battery",
      "banner",
      "exactAlarm",
      "test"
    ]);
  });

  it("persists completion locally", async () => {
    expect(await hasCompletedAndroidReminderGuide()).toBe(false);
    await markAndroidReminderGuideCompleted();
    expect(await hasCompletedAndroidReminderGuide()).toBe(true);
  });
});
