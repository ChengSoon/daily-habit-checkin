import { describe, expect, it, vi } from "vitest";
import type { QueryResult, QueryResultRow } from "pg";
import type { CompanionDb } from "./companionRepository.js";
import type { CompanionModel } from "./companionModel.js";
import { createCompanionModelResolver } from "./companionModelResolver.js";

type RecordedQuery = { text: string; values: readonly unknown[] };

function result<T extends QueryResultRow>(rows: T[]): QueryResult<T> {
  return { rows, rowCount: rows.length, command: "SELECT", oid: 0, fields: [] };
}

function fakeDb(rows: Array<{ key: string; value: string }>) {
  const queries: RecordedQuery[] = [];
  const db: CompanionDb = {
    async query<T extends QueryResultRow>(text: string, values: readonly unknown[] = []) {
      queries.push({ text, values });
      return result(rows) as unknown as QueryResult<T>;
    }
  };
  return { db, queries };
}

function fakeModel(): CompanionModel {
  return {
    respond: vi.fn(),
    streamChat: vi.fn()
  };
}

describe("companion model resolver", () => {
  it("uses the authenticated space AI configuration and normalizes its base URL", async () => {
    const { db, queries } = fakeDb([
      { key: "aiBaseUrl", value: " https://relay.example.com/v1/chat/completions/ " },
      { key: "aiApiKey", value: " space-key " },
      { key: "aiModel", value: " space-model " }
    ]);
    const spaceModel = fakeModel();
    const serverModel = fakeModel();
    const createModel = vi.fn(() => spaceModel);
    const resolver = createCompanionModelResolver({ db, serverModel, createModel });

    await expect(resolver.resolve("space-1")).resolves.toEqual({
      model: spaceModel,
      source: "space"
    });
    expect(createModel).toHaveBeenCalledWith({
      apiKey: "space-key",
      baseUrl: "https://relay.example.com/v1",
      model: "space-model"
    });
    expect(queries[0].values).toEqual([
      "space-1",
      ["aiBaseUrl", "aiApiKey", "aiModel"]
    ]);
    expect(queries[0].text).toContain("space_id = $1");
    expect(queries[0].text).toContain("key = ANY($2::text[])");
  });

  it("falls back to the server model when any space setting is missing", async () => {
    const { db } = fakeDb([
      { key: "aiBaseUrl", value: "https://relay.example.com/v1" },
      { key: "aiModel", value: "space-model" }
    ]);
    const serverModel = fakeModel();
    const createModel = vi.fn(() => fakeModel());
    const resolver = createCompanionModelResolver({ db, serverModel, createModel });

    await expect(resolver.resolve("space-1")).resolves.toEqual({
      model: serverModel,
      source: "server"
    });
    expect(createModel).not.toHaveBeenCalled();
  });
});
