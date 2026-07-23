import { describe, expect, it } from "vitest";
import type { QueryResult, QueryResultRow } from "pg";
import { cancelRedemptionInTransaction, redeemRewardInTransaction } from "./rewardCommandService.js";

function result<T extends QueryResultRow>(rows: T[], rowCount = rows.length): QueryResult<T> {
  return { rows, rowCount, command: "SELECT", oid: 0, fields: [] };
}

function fakeDb(responses: QueryResult<QueryResultRow>[]) {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  return {
    queries,
    db: {
      async query<T extends QueryResultRow>(text: string, values: readonly unknown[] = []) {
        queries.push({ text, values });
        return (responses.shift() ?? result([])) as QueryResult<T>;
      }
    }
  };
}

describe("reward command service", () => {
  it("locks the wallet and spends the server-side reward price", async () => {
    const { db, queries } = fakeDb([
      result([{ id: "reward-1", price_xp: 300, status: "active", inventory_limit: null }]),
      result([]),
      result([{ balance: 500, lifetime_earned: 500, lifetime_spent: 0, updated_at: "2026-07-22T12:00:00.000Z" }]),
      result([{
        id: "redemption-1",
        reward_id: "reward-1",
        price_xp: 300,
        status: "pending_fulfillment",
        created_at: "2026-07-22T12:00:00.000Z",
        fulfilled_at: null,
        cancelled_at: null,
        note: null
      }]),
      result([{ id: "tx-1" }]),
      result([{ balance: 200, lifetime_earned: 500, lifetime_spent: 300, updated_at: "2026-07-22T12:00:00.000Z" }])
    ]);

    const response = await redeemRewardInTransaction(db, "space-1", "reward-1");

    expect(response.redemption).toMatchObject({ priceXp: 300, status: "pending_fulfillment" });
    expect(response.wallet.balance).toBe(200);
    expect(queries[0].text).toContain("FOR UPDATE");
    expect(queries.some((query) => query.text.includes("FROM xp_wallet") && query.text.includes("FOR UPDATE"))).toBe(true);
    expect(queries.find((query) => query.text.includes("INSERT INTO xp_transactions"))?.values).toContain(-300);
  });

  it("rejects an insufficient balance before creating a redemption", async () => {
    const { db, queries } = fakeDb([
      result([{ id: "reward-1", price_xp: 300, status: "active", inventory_limit: null }]),
      result([]),
      result([{ balance: 50, lifetime_earned: 50, lifetime_spent: 0, updated_at: "2026-07-22T12:00:00.000Z" }])
    ]);

    await expect(redeemRewardInTransaction(db, "space-1", "reward-1")).rejects.toThrow("积分不足，还差 250 积分");
    expect(queries.some((query) => query.text.includes("INSERT INTO reward_redemptions"))).toBe(false);
  });

  it("does not refund the wallet twice when the refund transaction already exists", async () => {
    const pending = {
      id: "redemption-1",
      reward_id: "reward-1",
      price_xp: 300,
      status: "pending_fulfillment",
      created_at: "2026-07-22T12:00:00.000Z",
      fulfilled_at: null,
      cancelled_at: null,
      note: null
    };
    const cancelled = { ...pending, status: "cancelled", cancelled_at: "2026-07-22T12:01:00.000Z" };
    const wallet = {
      balance: 500,
      lifetime_earned: 500,
      lifetime_spent: 0,
      updated_at: "2026-07-22T12:01:00.000Z"
    };
    const { db, queries } = fakeDb([
      result([pending]),
      result([cancelled]),
      result([]),
      result([wallet]),
      result([])
    ]);

    const response = await cancelRedemptionInTransaction(db, "space-1", "redemption-1");

    expect(response.wallet.balance).toBe(500);
    expect(queries.some((query) => query.text.includes("UPDATE xp_wallet SET balance"))).toBe(false);
  });
});
