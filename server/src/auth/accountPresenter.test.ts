import { describe, expect, it } from "vitest";
import type { Account } from "./accountRepository.js";
import { toPublicAccount } from "./accountPresenter.js";

describe("account presenter", () => {
  it("only exposes fields needed by the client", () => {
    const internalAccount: Account & { passwordHash: string } = {
      id: "account_1",
      email: "person@example.com",
      displayName: "Person",
      spaceId: "space_1",
      role: "owner",
      avatarKey: null,
      createdAt: "2026-07-23T00:00:00.000Z",
      sessionVersion: 7,
      passwordHash: "secret-hash"
    };

    expect(toPublicAccount(internalAccount)).toEqual({
      id: "account_1",
      email: "person@example.com",
      displayName: "Person",
      spaceId: "space_1",
      role: "owner",
      avatarKey: null
    });
  });
});
