import { describe, expect, it } from "vitest";
import type { QueryResult, QueryResultRow } from "pg";
import { executeCompanionAction } from "./companionActionService.js";
import type { CompanionDb } from "./companionRepository.js";

function result<T extends QueryResultRow>(rows: T[], rowCount = rows.length): QueryResult<T> {
  return { rows, rowCount, command: "SELECT", oid: 0, fields: [] };
}

function fakeDb(responses: QueryResult<QueryResultRow>[]) {
  const queries: { text: string; values: readonly unknown[] }[] = [];
  const db: CompanionDb = {
    async query<T extends QueryResultRow>(text: string, values: readonly unknown[] = []) {
      queries.push({ text, values });
      return (responses.shift() ?? result([])) as QueryResult<T>;
    }
  };
  return { db, queries };
}

describe("companion action executor", () => {
  it("creates a habit through a parameterized space-scoped write", async () => {
    const { db, queries } = fakeDb([result([])]);

    await expect(
      executeCompanionAction({
        client: db,
        spaceId: "space-1",
        accountId: "account-1",
        now: new Date("2026-07-19T12:00:00.000Z"),
        timezoneOffsetMinutes: -480,
        command: {
          type: "create_habit",
          arguments: {
            name: "喝水",
            description: null,
            frequency: { type: "daily" },
            reminderTime: "21:30",
            trackType: "check",
            numericUnit: null
          }
        }
      })
    ).resolves.toEqual({ message: "已经新建「喝水」习惯。", resources: ["habits"] });
    expect(queries[0].text).toContain("INSERT INTO habits");
    expect(queries[0].values).toContain("space-1");
    expect(queries[0].values).toContain("喝水");
  });

  it("does not duplicate an already completed check-in", async () => {
    const { db, queries } = fakeDb([
      result([
        {
          id: "habit-1",
          name: "散步",
          frequency_json: JSON.stringify({ type: "daily" }),
          created_at: "2026-07-01T00:00:00.000Z",
          is_paused: false,
          track_type: "check",
          numeric_unit: null
        }
      ]),
      result([{ id: "checkin-1" }])
    ]);

    await expect(
      executeCompanionAction({
        client: db,
        spaceId: "space-1",
        accountId: "account-1",
        now: new Date("2026-07-19T12:00:00.000Z"),
        timezoneOffsetMinutes: -480,
        command: { type: "complete_checkin", arguments: { habitId: "habit-1", value: null } }
      })
    ).resolves.toEqual({
      message: "「散步」今天已经完成，不需要重复打卡。",
      resources: ["check_ins"]
    });
    expect(queries).toHaveLength(2);
    expect(queries.some((query) => query.text.includes("INSERT INTO check_ins"))).toBe(false);
  });

  it("completes a scheduled check-in and records its XP transaction", async () => {
    const { db, queries } = fakeDb([
      result([
        {
          id: "habit-1",
          name: "散步",
          frequency_json: JSON.stringify({ type: "daily" }),
          created_at: "2026-07-01T00:00:00.000Z",
          is_paused: false,
          track_type: "check",
          numeric_unit: null
        }
      ]),
      result([]),
      result([], 1),
      result([{ date: "2026-07-19" }]),
      result([]),
      result([]),
      result([], 1),
      result([])
    ]);

    await expect(
      executeCompanionAction({
        client: db,
        spaceId: "space-1",
        accountId: "account-1",
        now: new Date("2026-07-19T12:00:00.000Z"),
        timezoneOffsetMinutes: -480,
        command: { type: "complete_checkin", arguments: { habitId: "habit-1", value: null } }
      })
    ).resolves.toMatchObject({ resources: ["check_ins", "wallet"] });
    expect(queries.some((query) => query.text.includes("INSERT INTO xp_transactions"))).toBe(true);
    expect(queries.some((query) => query.text.includes("UPDATE xp_wallet"))).toBe(true);
  });

  it("updates only declared habit fields and keeps the write space-scoped", async () => {
    const { db, queries } = fakeDb([result([{ name: "散步" }])]);

    await executeCompanionAction({
      client: db,
      spaceId: "space-1",
      accountId: "account-1",
      now: new Date("2026-07-19T12:00:00.000Z"),
      timezoneOffsetMinutes: -480,
      command: {
        type: "update_habit",
        arguments: { habitId: "habit-1", reminderTime: "19:30" }
      }
    });

    expect(queries[0].text).toContain("UPDATE habits SET reminder_time");
    expect(queries[0].text).toContain("is_reminder_enabled");
    expect(queries[0].text).toContain("space_id = $1");
    expect(queries[0].values.slice(0, 2)).toEqual(["space-1", "habit-1"]);
  });
});
