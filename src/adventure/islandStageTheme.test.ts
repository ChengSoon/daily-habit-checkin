import { describe, expect, it } from "vitest";
import { resolveIslandStageTheme } from "./islandStageTheme";

describe("islandStageTheme", () => {
  it("resolves known theme keys", () => {
    expect(resolveIslandStageTheme("forest").accent).toBe("#3F9E7A");
    expect(resolveIslandStageTheme("camp").top).toMatch(/^#/);
  });

  it("falls back for unknown keys", () => {
    const fallback = resolveIslandStageTheme(null);
    expect(resolveIslandStageTheme("nope").accent).toBe(fallback.accent);
  });
});
