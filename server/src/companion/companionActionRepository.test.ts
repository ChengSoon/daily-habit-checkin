import { describe, expect, it } from "vitest";
import type { QueryResult, QueryResultRow } from "pg";
import {
  CompanionActionForbiddenError,
  createCompanionActionRepository
} from "./companionActionRepository.js";
import type { CompanionDb } from "./companionRepository.js";

function result<T extends QueryResultRow>(rows: T[]): QueryResult<T> {
  return { rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] };
}

const row = {
  id: "action-1",
  action_type: "complete_checkin",
  arguments_json: { habitId: "habit-1", value: null },
  summary: "完成散步打卡",
  status: "pending",
  requested_by: "account-1",
  timezone_offset_minutes: -480,
  expires_at: "2026-07-19T12:15:00.000Z",
  result_message: null
};

function fakeDb(responses: QueryResult<QueryResultRow>[]) {
  const queries: string[] = [];
  const db: CompanionDb = {
    async query<T extends QueryResultRow>(text: string) {
      queries.push(text);
      return (responses.shift() ?? result([])) as QueryResult<T>;
    }
  };
  return { db, queries };
}

describe("companion action repository", () => {
  it("locks a space-scoped action and checks the requesting account", async () => {
    const { db, queries } = fakeDb([result([row])]);
    const repository = createCompanionActionRepository({ db, transact: async (run) => run(db) });

    await expect(
      repository.withLockedAction({ spaceId: "space-1", accountId: "account-1", actionId: "action-1",
        run: async (_client, action) => action })
    ).resolves.toMatchObject({ id: "action-1", requestedBy: "account-1" });
    expect(queries[0]).toContain("FOR UPDATE");
    expect(queries[0]).toContain("space_id = $2");
  });

  it("rejects a partner from confirming another member's action", async () => {
    const { db } = fakeDb([result([row])]);
    const repository = createCompanionActionRepository({ db, transact: async (run) => run(db) });

    await expect(
      repository.withLockedAction({ spaceId: "space-1", accountId: "account-2", actionId: "action-1",
        run: async () => undefined })
    ).rejects.toBeInstanceOf(CompanionActionForbiddenError);
  });
});
