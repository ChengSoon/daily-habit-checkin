import { beforeEach, describe, expect, it, vi } from "vitest";
import { refreshAuthenticatedReminders } from "./reminderRefresh";

const mocks = vi.hoisted(() => ({
  getAuthToken: vi.fn(),
  refreshScheduledReminders: vi.fn()
}));

vi.mock("../sync/localSettings", () => ({ getAuthToken: mocks.getAuthToken }));
vi.mock("./reminderService", () => ({
  refreshScheduledReminders: mocks.refreshScheduledReminders
}));

describe("authenticated reminder refresh", () => {
  beforeEach(() => {
    mocks.getAuthToken.mockReset();
    mocks.refreshScheduledReminders.mockReset();
  });

  it("skips cloud-backed reminder data while logged out", async () => {
    mocks.getAuthToken.mockResolvedValue(null);

    await expect(refreshAuthenticatedReminders()).resolves.toBeUndefined();

    expect(mocks.refreshScheduledReminders).not.toHaveBeenCalled();
  });

  it("refreshes reminders while logged in", async () => {
    const now = new Date("2026-07-22T10:00:00.000Z");
    mocks.getAuthToken.mockResolvedValue("token_1");
    mocks.refreshScheduledReminders.mockResolvedValue(undefined);

    await refreshAuthenticatedReminders(now);

    expect(mocks.refreshScheduledReminders).toHaveBeenCalledWith(now);
  });

  it("silently skips an expired session", async () => {
    mocks.getAuthToken.mockResolvedValue("expired-token");
    mocks.refreshScheduledReminders.mockRejectedValue({ status: 401 });

    await expect(refreshAuthenticatedReminders()).resolves.toBeUndefined();
  });

  it("keeps unexpected refresh failures visible to callers", async () => {
    const error = new Error("network down");
    mocks.getAuthToken.mockResolvedValue("token_1");
    mocks.refreshScheduledReminders.mockRejectedValue(error);

    await expect(refreshAuthenticatedReminders()).rejects.toBe(error);
  });
});
