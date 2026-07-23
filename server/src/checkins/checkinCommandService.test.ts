import { describe, expect, it } from "vitest";
import type { QueryResult, QueryResultRow } from "pg";
import { completeCheckInInTransaction, undoCheckInInTransaction } from "./checkinCommandService.js";

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

describe("check-in command service", () => {
  it("upserts the check-in and awards server-defined XP in one transaction", async () => {
    const { db, queries } = fakeDb([
      result([{
        id: "habit-1",
        name: "阅读",
        frequency_json: JSON.stringify({ type: "daily" }),
        created_at: "2026-07-01T00:00:00.000Z",
        is_paused: false,
        track_type: "check"
      }]),
      result([{
        id: "checkin-1",
        habit_id: "habit-1",
        date: "2026-07-22",
        status: "completed",
        value: null,
        note: null,
        created_by: "account-1",
        created_at: "2026-07-22T12:00:00.000Z"
      }]),
      result([{ date: "2026-07-22" }]),
      result([]),
      result([]),
      result([{
        id: "tx-1",
        unique_key: "checkin:habit-1:2026-07-22",
        amount: 10,
        type: "earn",
        reason: "checkin",
        habit_id: "habit-1",
        check_in_id: "checkin-1",
        reward_id: null,
        redemption_id: null,
        date_key: "2026-07-22",
        created_at: "2026-07-22T12:00:00.000Z"
      }]),
      result([{ balance: 10, lifetime_earned: 10, lifetime_spent: 0, updated_at: "2026-07-22T12:00:00.000Z" }])
    ]);

    const response = await completeCheckInInTransaction({ db, spaceId: "space-1", accountId: "account-1", input: {
      habitId: "habit-1",
      date: "2026-07-22",
      value: null,
      note: null,
      timezoneOffsetMinutes: -480
    }, now: new Date("2026-07-22T12:00:00.000Z") });

    expect(response.checkIn).toMatchObject({ id: "checkin-1", createdBy: "account-1" });
    expect(response.insertedTransactions).toHaveLength(1);
    expect(response.wallet.balance).toBe(10);
    expect(queries[1].text).toContain("ON CONFLICT (habit_id, date)");
    expect(queries[1].values).toContain("account-1");
    expect(queries.find((query) => query.text.includes("INSERT INTO xp_transactions"))?.values).toContain(10);
  });

  it("rejects check-ins outside the caller's current local date", async () => {
    const { db, queries } = fakeDb([]);

    await expect(completeCheckInInTransaction({ db, spaceId: "space-1", accountId: "account-1", input: {
      habitId: "habit-1",
      date: "2026-07-21",
      value: null,
      note: null,
      timezoneOffsetMinutes: -480
    }, now: new Date("2026-07-22T12:00:00.000Z") })).rejects.toThrow("只能完成今天的打卡");
    expect(queries).toHaveLength(0);
  });

  it("rejects undo after the 60 second window", async () => {
    const { db, queries } = fakeDb([result([checkInRow()])]);

    await expect(undoCheckInInTransaction({ db, spaceId: "space-1", input: {
      habitId: "habit-1",
      date: "2026-07-22",
      checkInId: "checkin-1"
    }, now: new Date("2026-07-22T12:01:01.000Z") })).rejects.toThrow("撤销时间已超过 60 秒");

    expect(queries).toHaveLength(1);
  });

  it("writes a reversal transaction and deducts the awarded XP", async () => {
    const award = transactionRow(10);
    const reversal = { ...transactionRow(-10), id: "tx-undo", reason: "checkin_undo" };
    const { db, queries } = fakeDb([
      result([checkInRow()]),
      result([award]),
      result([]),
      result([]),
      result([reversal]),
      result([{ balance: 20, lifetime_earned: 30, lifetime_spent: 10, updated_at: "2026-07-22T12:00:30.000Z" }])
    ]);

    const response = await undoCheckInInTransaction({ db, spaceId: "space-1", input: {
      habitId: "habit-1",
      date: "2026-07-22",
      checkInId: "checkin-1"
    }, now: new Date("2026-07-22T12:00:30.000Z") });

    expect(response.reversedAmount).toBe(10);
    expect(response.wallet.balance).toBe(20);
    expect(queries.find((query) => query.text.includes("checkin_undo"))?.values).toContain(-10);
    expect(queries.at(-1)?.text).toContain("balance >= $2");
  });

  it("rejects undo when the awarded XP has already been spent", async () => {
    const { db } = fakeDb([
      result([checkInRow()]),
      result([transactionRow(10)]),
      result([]),
      result([]),
      result([{ ...transactionRow(-10), id: "tx-undo", reason: "checkin_undo" }]),
      result([])
    ]);

    await expect(undoCheckInInTransaction({ db, spaceId: "space-1", input: {
      habitId: "habit-1",
      date: "2026-07-22",
      checkInId: "checkin-1"
    }, now: new Date("2026-07-22T12:00:30.000Z") })).rejects.toThrow("本次获得的 XP 已使用，无法撤销");
  });
});

function checkInRow() {
  return {
    id: "checkin-1", habit_id: "habit-1", date: "2026-07-22", status: "completed",
    value: null, note: null, created_by: "account-1", created_at: "2026-07-22T12:00:00.000Z"
  };
}

function transactionRow(amount: number) {
  return {
    id: "tx-1", unique_key: "checkin:habit-1:2026-07-22", amount, type: "earn", reason: "checkin",
    habit_id: "habit-1", check_in_id: "checkin-1", reward_id: null, redemption_id: null,
    date_key: "2026-07-22", created_at: "2026-07-22T12:00:00.000Z"
  };
}
