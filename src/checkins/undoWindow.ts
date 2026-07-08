import { CheckIn } from "./types";

export const CHECKIN_UNDO_WINDOW_MS = 60_000;

export function canUndoCheckIn(checkIn: CheckIn, now = new Date()): boolean {
  const createdAt = new Date(checkIn.createdAt).getTime();
  const currentTime = now.getTime();

  if (Number.isNaN(createdAt) || Number.isNaN(currentTime)) {
    return false;
  }

  const elapsed = currentTime - createdAt;
  return elapsed >= 0 && elapsed <= CHECKIN_UNDO_WINDOW_MS;
}
