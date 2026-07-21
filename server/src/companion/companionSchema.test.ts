import { describe, expect, it } from "vitest";
import { COMPANION_SCHEMA_SQL } from "./companionSchema.js";

describe("companion schema", () => {
  it("creates every companion table with space-scoped idempotency", () => {
    for (const table of [
      "companion_events",
      "companion_messages",
      "companion_actions",
      "companion_memories",
      "companion_space_state",
      "companion_member_state",
      "companion_bond_events"
    ]) {
      expect(COMPANION_SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(COMPANION_SCHEMA_SQL).toContain("PRIMARY KEY (space_id, event_id)");
    expect(COMPANION_SCHEMA_SQL).toContain("PRIMARY KEY (space_id, source_key)");
    expect(COMPANION_SCHEMA_SQL).toContain("UNIQUE (space_id, source_message_id)");
    expect(COMPANION_SCHEMA_SQL).toContain("ON DELETE CASCADE");
  });
});
