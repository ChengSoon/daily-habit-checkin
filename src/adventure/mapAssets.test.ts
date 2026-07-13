import { describe, expect, it } from "vitest";
import {
  DEFAULT_ISLAND_THEME_KEYS,
  FALLBACK_ISLAND_THEME,
  resolveDefaultIslandThemeKey
} from "./mapThemeKeys";

describe("mapThemeKeys", () => {
  it("covers six seed themes", () => {
    expect([...DEFAULT_ISLAND_THEME_KEYS]).toEqual([
      "lighthouse",
      "forest",
      "market",
      "camp",
      "bridge",
      "summit"
    ]);
  });

  it("resolves known theme keys", () => {
    expect(resolveDefaultIslandThemeKey("forest")).toBe("forest");
    expect(resolveDefaultIslandThemeKey("summit")).toBe("summit");
  });

  it("falls back for unknown or empty theme", () => {
    expect(resolveDefaultIslandThemeKey(null)).toBe(FALLBACK_ISLAND_THEME);
    expect(resolveDefaultIslandThemeKey(undefined)).toBe(FALLBACK_ISLAND_THEME);
    expect(resolveDefaultIslandThemeKey("unknown-theme")).toBe(FALLBACK_ISLAND_THEME);
  });
});
