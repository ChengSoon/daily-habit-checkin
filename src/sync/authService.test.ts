import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseForTests } from "../db/database";
import { getCurrentAccount, type Account } from "./authService";
import { clearAuthToken, getStoredAccount, saveAuthToken, saveStoredAccount } from "./localSettings";

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
    await saveStoredAccount(cachedAccount);
    await saveAuthToken("token_1");

    await clearAuthToken();

    await expect(getStoredAccount<Account>()).resolves.toBeNull();
    await expect(getCurrentAccount()).resolves.toBeNull();
  });
});
