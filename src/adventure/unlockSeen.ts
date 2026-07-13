import { getDatabase } from "../db/database";

export function unlockSeenKey(spaceId: string): string {
  return `adventure:lastSeenUnlockedOrder:${spaceId}`;
}

export function parseUnlockSeen(raw: string | null): number | null {
  if (raw === null) {
    return null;
  }
  const value = Number(raw);
  return Number.isFinite(value) ? Math.trunc(value) : null;
}

export async function getLastSeenUnlockedOrder(spaceId: string): Promise<number | null> {
  const db = getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM local_settings WHERE key = ?",
    [unlockSeenKey(spaceId)]
  );
  return parseUnlockSeen(row?.value ?? null);
}

export async function setLastSeenUnlockedOrder(spaceId: string, order: number): Promise<void> {
  const db = getDatabase();
  await db.runAsync(
    "INSERT INTO local_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    [unlockSeenKey(spaceId), String(order)]
  );
}
