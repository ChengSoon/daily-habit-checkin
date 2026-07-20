import { describe, expect, it } from "vitest";
import { normalizeMoodCheckIn } from "./moodCheckIn";

describe("normalizeMoodCheckIn", () => {
  it("accepts all five mood scores and trims the optional note", () => {
    for (const score of [1, 2, 3, 4, 5]) {
      expect(normalizeMoodCheckIn(score, "  今天有点累  ")).toEqual({
        score,
        note: "今天有点累"
      });
    }
  });

  it("rejects invalid scores and caps notes at 500 characters", () => {
    expect(() => normalizeMoodCheckIn(0, "")).toThrow("心情");
    expect(normalizeMoodCheckIn(3, "x".repeat(520)).note).toHaveLength(500);
  });
});
