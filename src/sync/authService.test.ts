import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetDatabaseForTests } from "../db/database";
import { getCurrentAccount, logout, type Account } from "./authService";
import { getStoredAccount, saveAuthToken, saveStoredAccount } from "./localSettings";

const mocks = vi.hoisted(() => ({ apiRequest: vi.fn() }));

vi.mock("./apiClient", () => ({ apiRequest: mocks.apiRequest }));

const cachedAccount: Account = {
  id: "account_1",
  email: "you@example.com",
  displayName: "小红",
  spaceId: "space_1",
  inviteCode: "ABCD1234",
  role: "owner",
  avatarKey: null
};

describe("auth service local account cache", () => {
  beforeEach(async () => {
    mocks.apiRequest.mockReset();
    await resetDatabaseForTests();
  });

  it("returns the cached account immediately when a token exists", async () => {
    await saveStoredAccount(cachedAccount);
    await saveAuthToken("token_1");

    await expect(getCurrentAccount()).resolves.toEqual(cachedAccount);
  });

  it("ignores cached account data when there is no token", async () => {
    await saveStoredAccount(cachedAccount);

    await expect(getCurrentAccount()).resolves.toBeNull();
  });

  it("clears cached account data on logout", async () => {
    mocks.apiRequest.mockResolvedValue(undefined);
    await saveStoredAccount(cachedAccount);
    await saveAuthToken("token_1");

    await logout();

    expect(mocks.apiRequest).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
    await expect(getStoredAccount<Account>()).resolves.toBeNull();
    await expect(getCurrentAccount()).resolves.toBeNull();
  });

  it("still clears local auth when the server cannot be reached", async () => {
    mocks.apiRequest.mockRejectedValue(new Error("offline"));
    await saveStoredAccount(cachedAccount);
    await saveAuthToken("token_1");

    await expect(logout()).resolves.toBeUndefined();

    await expect(getStoredAccount<Account>()).resolves.toBeNull();
    await expect(getCurrentAccount()).resolves.toBeNull();
  });
});
