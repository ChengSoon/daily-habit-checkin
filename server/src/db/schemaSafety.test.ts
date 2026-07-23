import { describe, expect, it } from "vitest";
import { SCHEMA_SQL } from "./schema.js";

describe("runtime schema safety", () => {
  it("preserves legacy adventure data in an isolated schema instead of dropping tables", () => {
    expect(SCHEMA_SQL).not.toMatch(/DROP TABLE/iu);
    expect(SCHEMA_SQL).toContain("CREATE SCHEMA IF NOT EXISTS legacy");
    expect(SCHEMA_SQL).toContain("ALTER TABLE adventure_progress SET SCHEMA legacy");
    expect(SCHEMA_SQL).not.toMatch(/RENAME TO adventure_[a-z_]+_legacy/iu);
  });
});
