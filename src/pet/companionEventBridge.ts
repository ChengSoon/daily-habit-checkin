import type { CheckIn } from "../checkins/types";
import {
  createCompanionEvent,
  type CompanionEvent,
  type CompanionEventOf
} from "./companionTypes";

type CompletedCheckInInput = {
  checkInId: string;
  habitId: string;
  streak: number;
  allDone: boolean;
  milestoneDays: number | null;
  occurredAt: Date;
};

type PartnerReconciliationInput = {
  seenCheckInIds: ReadonlySet<string>;
  checkIns: CheckIn[];
  currentAccountId: string;
};

const CHECK_IN_EVENT_TYPES = new Set<CompanionEvent["type"]>([
  "checkin_completed",
  "all_done",
  "streak_milestone",
  "partner_progress"
]);

function checkInEventId(checkInId: string, type: CompanionEvent["type"]): string {
  return `${checkInId}:${type}`;
}

export function createCheckInCompletedEvent(
  input: CompletedCheckInInput
): CompanionEventOf<"checkin_completed"> {
  return createCompanionEvent(
    checkInEventId(input.checkInId, "checkin_completed"),
    "checkin_completed",
    {
      habitId: input.habitId,
      streak: input.streak,
      allDone: input.allDone,
      milestoneDays: input.milestoneDays
    },
    input.occurredAt
  );
}

export function seedSeenCheckInIds(checkIns: CheckIn[]): Set<string> {
  return new Set(checkIns.map((checkIn) => checkIn.id));
}

export function reconcilePartnerCheckIns(input: PartnerReconciliationInput): {
  seenCheckInIds: Set<string>;
  events: CompanionEventOf<"partner_progress">[];
} {
  const seenCheckInIds = new Set(input.seenCheckInIds);
  const unseen = input.checkIns.filter((checkIn) => !seenCheckInIds.has(checkIn.id));
  for (const checkIn of input.checkIns) seenCheckInIds.add(checkIn.id);

  const events = unseen
    .filter(
      (checkIn) =>
        checkIn.status === "completed" &&
        !!checkIn.createdBy &&
        checkIn.createdBy !== input.currentAccountId
    )
    .sort(
      (left, right) =>
        left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id)
    )
    .map((checkIn) => {
      const occurredAt = new Date(checkIn.createdAt);
      return createCompanionEvent(
        checkInEventId(checkIn.id, "partner_progress"),
        "partner_progress",
        { checkInId: checkIn.id, habitId: checkIn.habitId },
        occurredAt
      );
    });

  return { seenCheckInIds, events };
}

export function sourceCheckInId(event: CompanionEvent): string | null {
  if (!CHECK_IN_EVENT_TYPES.has(event.type)) return null;
  const suffix = `:${event.type}`;
  return event.id.endsWith(suffix) ? event.id.slice(0, -suffix.length) || null : null;
}

export function createCheckInEventTracker() {
  let seenCheckInIds = new Set<string>();
  let ready = false;

  return {
    reset() {
      seenCheckInIds = new Set();
      ready = false;
    },
    seed(checkIns: CheckIn[]) {
      for (const id of seedSeenCheckInIds(checkIns)) seenCheckInIds.add(id);
      ready = true;
    },
    remember(event: CompanionEvent) {
      const checkInId = sourceCheckInId(event);
      if (checkInId) seenCheckInIds.add(checkInId);
    },
    reconcile(checkIns: CheckIn[], currentAccountId: string): CompanionEventOf<"partner_progress">[] {
      if (!ready) {
        for (const id of seedSeenCheckInIds(checkIns)) seenCheckInIds.add(id);
        ready = true;
        return [];
      }
      const result = reconcilePartnerCheckIns({
        seenCheckInIds,
        checkIns,
        currentAccountId
      });
      seenCheckInIds = result.seenCheckInIds;
      return result.events;
    }
  };
}
