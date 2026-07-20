import { describe, expect, it } from "vitest";
import {
  bondStageForPoints,
  evaluateDeliveryPolicy,
  nextBondState,
  type MemberDeliveryState
} from "./companionPolicy.js";

const now = new Date("2026-07-19T12:00:00.000Z");

function state(overrides: Partial<MemberDeliveryState> = {}): MemberDeliveryState {
  return {
    deliveryDate: "2026-07-19",
    ordinaryCount: 0,
    lastOrdinaryAt: null,
    recentFingerprints: {},
    ...overrides
  };
}

describe("evaluateDeliveryPolicy", () => {
  it("blocks the third ordinary delivery of the day", () => {
    const result = evaluateDeliveryPolicy({
      category: "ordinary",
      fingerprint: "app-returned",
      current: state({ ordinaryCount: 2 }),
      now
    });

    expect(result).toEqual({ allowed: false, reason: "daily_cap" });
  });

  it("blocks ordinary deliveries inside the 90 minute cooldown", () => {
    const result = evaluateDeliveryPolicy({
      category: "ordinary",
      fingerprint: "evening-no-progress",
      current: state({ lastOrdinaryAt: "2026-07-19T11:00:01.000Z" }),
      now
    });

    expect(result).toEqual({ allowed: false, reason: "cooldown" });
  });

  it("blocks the same event fingerprint for 24 hours", () => {
    const result = evaluateDeliveryPolicy({
      category: "ordinary",
      fingerprint: "partner:checkin-2",
      current: state({ recentFingerprints: { "partner:checkin-2": "2026-07-18T13:00:01.000Z" } }),
      now
    });

    expect(result).toEqual({ allowed: false, reason: "duplicate" });
  });

  it("allows requested events without consuming the proactive quota", () => {
    const current = state({ ordinaryCount: 2, lastOrdinaryAt: now.toISOString() });
    const result = evaluateDeliveryPolicy({
      category: "requested",
      fingerprint: "mood:mood-1",
      current,
      now
    });

    expect(result).toEqual({ allowed: true, reason: "allowed", next: current });
  });

  it("resets the ordinary quota at the member's local midnight", () => {
    const result = evaluateDeliveryPolicy({
      category: "ordinary",
      fingerprint: "return:2026-07-20",
      current: state({
        deliveryDate: "2026-07-19",
        ordinaryCount: 2,
        lastOrdinaryAt: "2026-07-19T15:00:00.000Z"
      }),
      now: new Date("2026-07-19T16:30:00.000Z"),
      timezoneOffsetMinutes: -480
    });

    expect(result).toMatchObject({
      allowed: true,
      next: { deliveryDate: "2026-07-20", ordinaryCount: 1 }
    });
  });
});

describe("bond progression", () => {
  it("maps points to four stable stages", () => {
    expect([0, 20, 60, 120].map(bondStageForPoints)).toEqual([
      "first_meeting",
      "getting_familiar",
      "in_sync",
      "long_companionship"
    ]);
  });

  it("never decreases points and rejects a duplicate source", () => {
    expect(nextBondState({ points: 60, seenSource: false }, -20)).toEqual({
      awarded: false,
      points: 60,
      stage: "in_sync"
    });
    expect(nextBondState({ points: 60, seenSource: true }, 10)).toEqual({
      awarded: false,
      points: 60,
      stage: "in_sync"
    });
  });
});
