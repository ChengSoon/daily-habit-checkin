export function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateKey(date);
}

export function eachDateKey(startDateKey: string, endDateKey: string): string[] {
  const dates: string[] = [];
  let cursor = startDateKey;

  while (cursor <= endDateKey) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }

  return dates;
}

export function startOfMonthKey(dateKey: string): string {
  return `${dateKey.slice(0, 8)}01`;
}
