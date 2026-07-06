export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
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
