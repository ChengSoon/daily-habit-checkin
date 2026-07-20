import { describe, expect, it } from "vitest";
import type { QueryResult, QueryResultRow } from "pg";
import { createCompanionRepository, type CompanionDb } from "./companionRepository.js";

type RecordedQuery = { text: string; values: readonly unknown[] };

function result<T extends QueryResultRow>(rows: T[]): QueryResult<T> {
  return { rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] };
}

function fakeDb(responses: QueryResult<QueryResultRow>[]) {
  const queries: RecordedQuery[] = [];
  const db: CompanionDb = {
    async query<T extends QueryResultRow>(text: string, values: readonly unknown[] = []) {
      queries.push({ text, values });
      return (responses.shift() ?? result([])) as QueryResult<T>;
    }
  };
  return { db, queries };
}

describe("companion repository", () => {
  it("claims an event with auth-derived space and account identity", async () => {
    const { db, queries } = fakeDb([result([{ event_id: "event-1" }])]);
    const repository = createCompanionRepository({ db, transact: async (run) => run(db) });

    const claimed = await repository.claimEvent("space-1", "account-1", {
      id: "event-1",
      type: "app_returned",
      occurredAt: "2026-07-19T12:00:00.000Z",
      timezoneOffsetMinutes: -480,
      payload: {}
    });

    expect(claimed).toEqual({ claimed: true, cachedReply: null });
    expect(queries[0].text).toContain("ON CONFLICT (space_id, event_id) DO NOTHING");
    expect(queries[0].values.slice(0, 4)).toEqual([
      "space-1",
      "event-1",
      "account-1",
      "app_returned"
    ]);
  });

  it("returns the validated cached reply for an already completed event", async () => {
    const cached = {
      version: 1,
      eventId: "event-1",
      decision: "speak",
      message: "欢迎回来。",
      mood: "wave",
      intent: "encourage",
      riskLevel: "normal"
    };
    const { db } = fakeDb([result([]), result([{ response_json: cached }])]);
    const repository = createCompanionRepository({ db, transact: async (run) => run(db) });

    await expect(
      repository.claimEvent("space-1", "account-1", {
        id: "event-1",
        type: "app_returned",
        occurredAt: "2026-07-19T12:00:00.000Z",
        timezoneOffsetMinutes: -480,
        payload: {}
      })
    ).resolves.toEqual({ claimed: false, cachedReply: cached });
  });

  it("always scopes message reads and memory deletes to the current space", async () => {
    const { db, queries } = fakeDb([result([]), result([{ id: "memory-1" }])]);
    const repository = createCompanionRepository({ db, transact: async (run) => run(db) });

    await repository.listRecentMessages("space-1", 12);
    await repository.deleteMemory("space-1", "memory-1");

    expect(queries[0].values).toEqual(["space-1", 12]);
    expect(queries[0].text).toContain("space_id = $1");
    expect(queries[1].values).toEqual(["space-1", "memory-1"]);
    expect(queries[1].text).toContain("space_id = $1 AND id = $2");
  });

  it("paginates shared messages with an opaque created-at cursor", async () => {
    const rows = [2, 1, 0].map((index) => ({
      id: `message-${index}`,
      role: "assistant" as const,
      content: `message ${index}`,
      sender_account_id: null,
      sender_name: null,
      risk_level: "normal" as const,
      created_at: new Date(`2026-07-19T1${index}:00:00.000Z`)
    }));
    const { db, queries } = fakeDb([result(rows)]);
    const repository = createCompanionRepository({ db, transact: async (run) => run(db) });

    const page = await repository.listMessagePage(
      "space-1",
      2,
      "2026-07-19T13:00:00.000Z"
    );

    expect(page.items.map((item) => item.id)).toEqual(["message-1", "message-2"]);
    expect(page.nextCursor).toBe("2026-07-19T11:00:00.000Z");
    expect(queries[0].values).toEqual([
      "space-1",
      "2026-07-19T13:00:00.000Z",
      3
    ]);
  });

  it("writes both sides of a chat exchange inside one transaction", async () => {
    const { db, queries } = fakeDb([result([]), result([])]);
    let transactionCount = 0;
    const repository = createCompanionRepository({
      db,
      transact: async (run) => {
        transactionCount += 1;
        return run(db);
      }
    });

    await repository.appendExchange("space-1", "account-1", {
      userMessageId: "user-1",
      userText: "今天有点累",
      assistantMessageId: "assistant-1",
      assistantText: "那就先休息一下，我在这里。",
      riskLevel: "distress",
      memoryProposal: { category: "shared_moment", content: "今天选择先休息" }
    });

    expect(transactionCount).toBe(1);
    expect(queries).toHaveLength(2);
    expect(queries.every((query) => query.values[1] === "space-1")).toBe(true);
    expect(queries[1].values[4]).toBe(
      JSON.stringify({ category: "shared_moment", content: "今天选择先休息" })
    );
  });

  it("persists a proactive assistant message with its event identity", async () => {
    const { db, queries } = fakeDb([result([])]);
    const repository = createCompanionRepository({ db, transact: async (run) => run(db) });

    await repository.appendAssistantMessage("space-1", {
      id: "assistant-1",
      eventId: "event-1",
      content: "欢迎回来。",
      riskLevel: "normal"
    });

    expect(queries[0].values).toEqual([
      "assistant-1",
      "space-1",
      "欢迎回来。",
      "event-1",
      "normal"
    ]);
  });

  it("lists and saves only confirmed memories in the current space", async () => {
    const createdAt = new Date("2026-07-19T12:00:00.000Z");
    const row = {
      id: "memory-1",
      category: "shared_goal",
      content: "一起坚持晚饭后散步",
      created_by: "account-1",
      creator_name: "小程",
      source_message_id: "assistant-1",
      created_at: createdAt
    };
    const { db, queries } = fakeDb([result([row]), result([row])]);
    const repository = createCompanionRepository({
      db,
      transact: async (run) => run(db),
      createId: () => "memory-1"
    });

    await expect(repository.listMemories("space-1")).resolves.toEqual([
      {
        id: "memory-1",
        category: "shared_goal",
        content: "一起坚持晚饭后散步",
        createdBy: "account-1",
        creatorName: "小程",
        sourceMessageId: "assistant-1",
        createdAt: createdAt.toISOString()
      }
    ]);
    await repository.saveMemory("space-1", "account-1", {
      category: "shared_goal",
      content: "一起坚持晚饭后散步",
      sourceMessageId: "assistant-1"
    });

    expect(queries[0].values).toEqual(["space-1"]);
    expect(queries[1].values).toEqual([
      "memory-1",
      "space-1",
      "shared_goal",
      "一起坚持晚饭后散步",
      "account-1",
      "assistant-1"
    ]);
    expect(queries[1].text).toContain("ON CONFLICT (space_id, source_message_id)");
  });

  it("clears only expired or explicitly requested messages for the current space", async () => {
    const { db, queries } = fakeDb([result([]), result([])]);
    const repository = createCompanionRepository({ db, transact: async (run) => run(db) });

    await repository.pruneExpiredMessages("space-1");
    await repository.clearMessages("space-1");

    expect(queries[0].text).toContain("expires_at <= now()");
    expect(queries[1].text).toContain("WHERE space_id = $1");
    expect(queries.every((query) => query.values[0] === "space-1")).toBe(true);
  });
});
