import { beforeEach, describe, expect, it } from "vitest";
import { initializeDatabase, resetDatabaseForTests } from "../db/database";
import { hasAdminPin, setAdminPin, verifyAdminPin } from "./adminSettingsRepository";

describe("admin settings repository", () => {
  beforeEach(async () => {
    await initializeDatabase();
    await resetDatabaseForTests();
  });

  it("sets and verifies the admin PIN without storing it as plain text", async () => {
    expect(await hasAdminPin()).toBe(false);

    await setAdminPin("1314");

    expect(await hasAdminPin()).toBe(true);
    expect(await verifyAdminPin("1314")).toBe(true);
    expect(await verifyAdminPin("0000")).toBe(false);
  });
});
