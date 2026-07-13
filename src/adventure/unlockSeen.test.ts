import { describe, expect, it } from "vitest";
import { parseUnlockSeen, unlockSeenKey } from "./unlockSeen";

describe("unlockSeen", () => {
  it("builds space-scoped key", () => {
    expect(unlockSeenKey("space-1")).toBe("adventure:lastSeenUnlockedOrder:space-1");
  });

  it("parses integer or null", () => {
    expect(parseUnlockSeen("3")).toBe(3);
    expect(parseUnlockSeen(null)).toBeNull();
    expect(parseUnlockSeen("x")).toBeNull();
  });
});
