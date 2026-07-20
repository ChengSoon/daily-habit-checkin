import { describe, expect, it } from "vitest";
import type { CheckIn } from "../checkins/types";
import {
  createCheckInEventTracker,
  createCheckInCompletedEvent,
  reconcilePartnerCheckIns,
  seedSeenCheckInIds,
  sourceCheckInId
} from "./companionEventBridge";

const occurredAt = new Date("2026-07-19T12:00:00.000Z");

function checkIn(overrides: Partial<CheckIn> = {}): CheckIn {
  return {
    id: "checkin-1",
    habitId: "habit-1",
    date: "2026-07-19",
    status: "completed",
    value: null,
    note: null,
    createdAt: occurredAt.toISOString(),
    createdBy: "partner-1",
    ...overrides
  };
}

describe("createCheckInCompletedEvent", () => {
  it("uses a stable check-in event id and sends only deterministic facts", () => {
    const event = createCheckInCompletedEvent({
      checkInId: "checkin-1",
      habitId: "habit-1",
      streak: 7,
      allDone: true,
      milestoneDays: 7,
      occurredAt
    });

    expect(event).toEqual({
      id: "checkin-1:checkin_completed",
      type: "checkin_completed",
      occurredAt: occurredAt.toISOString(),
      timezoneOffsetMinutes: occurredAt.getTimezoneOffset(),
      payload: {
        habitId: "habit-1",
        streak: 7,
        allDone: true,
        milestoneDays: 7
      }
    });
    expect(sourceCheckInId(event)).toBe("checkin-1");
  });
});

describe("reconcilePartnerCheckIns", () => {
  it("suppresses own writes and creates an event only for a new partner completion", () => {
    const known = checkIn({ id: "known-partner" });
    const own = checkIn({ id: "own-new", createdBy: "account-1" });
    const partner = checkIn({ id: "partner-new", habitId: "habit-2" });
    const unattributed = checkIn({ id: "legacy-new", createdBy: null });
    const skipped = checkIn({ id: "skipped-new", status: "skipped" });

    const result = reconcilePartnerCheckIns({
      seenCheckInIds: seedSeenCheckInIds([known]),
      checkIns: [known, own, partner, unattributed, skipped],
      currentAccountId: "account-1"
    });

    expect(result.events).toEqual([
      {
        id: "partner-new:partner_progress",
        type: "partner_progress",
        occurredAt: occurredAt.toISOString(),
        timezoneOffsetMinutes: occurredAt.getTimezoneOffset(),
        payload: { checkInId: "partner-new", habitId: "habit-2" }
      }
    ]);
    expect([...result.seenCheckInIds].sort()).toEqual([
      "known-partner",
      "legacy-new",
      "own-new",
      "partner-new",
      "skipped-new"
    ]);
  });

  it("deduplicates repeated invalidations after the first snapshot diff", () => {
    const partner = checkIn({ id: "partner-new" });
    const first = reconcilePartnerCheckIns({
      seenCheckInIds: new Set(),
      checkIns: [partner],
      currentAccountId: "account-1"
    });
    const repeated = reconcilePartnerCheckIns({
      seenCheckInIds: first.seenCheckInIds,
      checkIns: [partner],
      currentAccountId: "account-1"
    });

    expect(first.events).toHaveLength(1);
    expect(repeated.events).toEqual([]);
  });
});

describe("createCheckInEventTracker", () => {
  it("seeds the first snapshot, then emits only later unseen partner progress", () => {
    const tracker = createCheckInEventTracker();
    const historical = checkIn({ id: "historical" });
    const fresh = checkIn({ id: "fresh", habitId: "habit-2" });

    expect(tracker.reconcile([historical], "account-1")).toEqual([]);
    expect(tracker.reconcile([historical, fresh], "account-1")).toHaveLength(1);
    expect(tracker.reconcile([historical, fresh], "account-1")).toEqual([]);
  });

  it("remembers a locally emitted check-in across the next invalidation", () => {
    const tracker = createCheckInEventTracker();
    tracker.seed([]);
    tracker.remember(
      createCheckInCompletedEvent({
        checkInId: "local-checkin",
        habitId: "habit-1",
        streak: 1,
        allDone: false,
        milestoneDays: null,
        occurredAt
      })
    );

    expect(
      tracker.reconcile(
        [checkIn({ id: "local-checkin", createdBy: "account-1" })],
        "account-1"
      )
    ).toEqual([]);
  });
});
