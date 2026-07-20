import { isWithinQuietHours, type QuietHours } from "../reminders/reminderPlan";
import type { CompanionEvent } from "./companionTypes";

type AttemptInput = {
  event: CompanionEvent;
  appState: "active" | "background" | "inactive" | "unknown" | "extension";
  panelOpen: boolean;
  typing: boolean;
  bubbleDismissedAt: number | null;
  quietHours?: QuietHours;
  now: Date;
};

type AttemptResult =
  | { allowed: true; reason: "allowed" }
  | { allowed: false; reason: "background" | "quiet_hours" | "busy" | "recently_dismissed" };

const DISMISS_COOLDOWN_MS = 15 * 60_000;
const DIRECT_EVENT_TYPES = new Set<CompanionEvent["type"]>([
  "mood_checkin",
  "quick_encouragement",
  "daily_reflection",
  "checkin_completed",
  "all_done",
  "streak_milestone"
]);

function localTime(event: CompanionEvent, now: Date): string {
  const shifted = new Date(now.getTime() - event.timezoneOffsetMinutes * 60_000);
  return `${String(shifted.getUTCHours()).padStart(2, "0")}:${String(shifted.getUTCMinutes()).padStart(2, "0")}`;
}

export function shouldAttemptEvent(input: AttemptInput): AttemptResult {
  if (input.appState !== "active") return { allowed: false, reason: "background" };
  const direct = DIRECT_EVENT_TYPES.has(input.event.type);
  if (!direct && (input.panelOpen || input.typing)) return { allowed: false, reason: "busy" };
  if (
    !direct &&
    input.bubbleDismissedAt !== null &&
    input.now.getTime() - input.bubbleDismissedAt < DISMISS_COOLDOWN_MS
  ) {
    return { allowed: false, reason: "recently_dismissed" };
  }
  if (
    !direct &&
    input.quietHours?.isEnabled &&
    isWithinQuietHours(
      localTime(input.event, input.now),
      input.quietHours.start,
      input.quietHours.end
    )
  ) {
    return { allowed: false, reason: "quiet_hours" };
  }
  return { allowed: true, reason: "allowed" };
}
