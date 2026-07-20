import { describe, expect, it } from "vitest";
import type { QueryResult, QueryResultRow } from "pg";
import {
  createCompanionStateRepository,
  type CompanionStateDb
} from "./companionStateRepository.js";

function result<T extends QueryResultRow>(rows: T[]): QueryResult<T> {
  return { rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] };
}

function fakeDb(responses: QueryResult<QueryResultRow>[]) {
  const queries: Array<{ text: string; values: readonly unknown[] }> = [];
  const db: CompanionStateDb = {
    async query<T extends QueryResultRow>(text: string, values: readonly unknown[] = []) {
      queries.push({ text, values });
      return (responses.shift() ?? result([])) as QueryResult<T>;
    }
  };
  return { db, queries };
}

const memberRow = {
  pet_visible: true,
  proactive_mode: "balanced",
  delivery_date: "2026-07-19",
  ordinary_count: 1,
  last_ordinary_at: null,
  recent_fingerprints: {},
  last_active_at: null
};

describe("companion state repository", () => {
  it("blocks unsolicited delivery when the current member disabled proactive care", async () => {
    const { db } = fakeDb([result([]), result([{ ...memberRow, proactive_mode: "off" }])]);
    const repository = createCompanionStateRepository({ db, transact: async (run) => run(db) });

    await expect(
      repository.reserveDelivery({
        spaceId: "space-1",
        accountId: "account-1",
        category: "ordinary",
        fingerprint: "return:2026-07-19",
        now: new Date("2026-07-19T12:00:00.000Z")
      })
    ).resolves.toEqual({ allowed: false, reason: "disabled" });
  });

  it("limits restrained mode to one ordinary delivery per day", async () => {
    const { db } = fakeDb([
      result([]),
      result([{ ...memberRow, proactive_mode: "restrained", ordinary_count: 1 }])
    ]);
    const repository = createCompanionStateRepository({ db, transact: async (run) => run(db) });

    await expect(
      repository.reserveDelivery({
        spaceId: "space-1",
        accountId: "account-1",
        category: "ordinary",
        fingerprint: "return:2026-07-19",
        now: new Date("2026-07-19T12:00:00.000Z")
      })
    ).resolves.toEqual({ allowed: false, reason: "daily_cap" });
  });

  it("serializes delivery policy updates with a row lock", async () => {
    const { db, queries } = fakeDb([result([]), result([memberRow]), result([])]);
    let transactionCount = 0;
    const repository = createCompanionStateRepository({
      db,
      transact: async (run) => {
        transactionCount += 1;
        return run(db);
      }
    });

    const reservation = await repository.reserveDelivery({
      spaceId: "space-1",
      accountId: "account-1",
      category: "ordinary",
      fingerprint: "return:2026-07-19",
      now: new Date("2026-07-19T12:00:00.000Z")
    });

    expect(reservation.allowed).toBe(true);
    expect(transactionCount).toBe(1);
    expect(queries[1].text).toContain("FOR UPDATE");
    expect(queries.every((query) => query.values.includes("space-1"))).toBe(true);
  });

  it("does not increase bond points for a duplicate source key", async () => {
    const { db, queries } = fakeDb([
      result([]),
      result([]),
      result([{ bond_points: 60, bond_stage: "in_sync" }])
    ]);
    const repository = createCompanionStateRepository({ db, transact: async (run) => run(db) });

    await expect(repository.awardBond("space-1", "weekly:2026-W29", 10)).resolves.toEqual({
      awarded: false,
      points: 60,
      stage: "in_sync"
    });
    expect(queries.some((query) => query.text.startsWith("UPDATE companion_space_state"))).toBe(false);
  });

  it("persists member preferences without changing shared state", async () => {
    const { db, queries } = fakeDb([result([])]);
    const repository = createCompanionStateRepository({ db, transact: async (run) => run(db) });

    await repository.updateMemberPreferences("space-1", "account-1", {
      petVisible: false,
      proactiveMode: "restrained"
    });

    expect(queries[0].values).toEqual(["space-1", "account-1", false, "restrained"]);
    expect(queries[0].text).toContain("companion_member_state");
    expect(queries[0].text).not.toContain("companion_space_state");
  });

  it("clears the shared conversation summary with the shared chat", async () => {
    const { db, queries } = fakeDb([result([])]);
    const repository = createCompanionStateRepository({ db, transact: async (run) => run(db) });

    await repository.clearConversationSummary("space-1");

    expect(queries[0].values).toEqual(["space-1"]);
    expect(queries[0].text).toContain("conversation_summary = NULL");
  });
});
