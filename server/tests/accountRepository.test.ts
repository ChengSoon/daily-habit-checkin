import { describe, expect, it, vi } from "vitest";

const dbMock = vi.hoisted(() => ({
  withTransaction: vi.fn()
}));

vi.mock("../src/db/pool.js", () => ({
  query: vi.fn(),
  withTransaction: dbMock.withTransaction
}));

import { joinSpaceByInviteCode } from "../src/auth/accountRepository.js";

function accountRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "account-1",
    email: "owner@example.com",
    display_name: "Owner",
    password_hash: "hash",
    space_id: "space-1",
    role: "owner",
    avatar_key: null,
    created_at: "2026-07-08T00:00:00.000Z",
    ...overrides
  };
}

describe("joinSpaceByInviteCode", () => {
  it("rejects joining the current space without demoting the account", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FROM spaces")) {
          return { rows: [{ id: "space-1" }], rowCount: 1 };
        }
        if (sql.includes("FROM accounts")) {
          return { rows: [accountRow()], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      })
    };
    dbMock.withTransaction.mockImplementationOnce(async (fn) => fn(client));

    await expect(joinSpaceByInviteCode("account-1", "SELF1234")).rejects.toThrow("你已在这个空间");

    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining("UPDATE accounts SET space_id"),
      expect.anything()
    );
  });

  it("rejects joining another space when the current space already has a partner", async () => {
    const client = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("FROM spaces")) {
          return { rows: [{ id: "space-2" }], rowCount: 1 };
        }
        if (sql.includes("COUNT(*)")) {
          return { rows: [{ count: "2" }], rowCount: 1 };
        }
        if (sql.includes("FROM accounts")) {
          return { rows: [accountRow()], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      })
    };
    dbMock.withTransaction.mockImplementationOnce(async (fn) => fn(client));

    await expect(joinSpaceByInviteCode("account-1", "OTHER123")).rejects.toThrow(
      "当前空间已有成员，不能加入其他空间"
    );

    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining("UPDATE accounts SET space_id"),
      expect.anything()
    );
  });
});
