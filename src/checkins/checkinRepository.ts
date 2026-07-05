import { getDatabase } from "../db/database";
import { createId } from "../utils/id";
import { CheckIn } from "./types";

type CheckInRow = {
  id: string;
  habit_id: string;
  date: string;
  status: CheckIn["status"];
  value: number | null;
  note: string | null;
  created_at: string;
};

function mapRow(row: CheckInRow): CheckIn {
  return {
    id: row.id,
    habitId: row.habit_id,
    date: row.date,
    status: row.status,
    value: row.value,
    note: row.note,
    createdAt: row.created_at
  };
}

export async function completeCheckIn(input: {
  habitId: string;
  date: string;
  value: number | null;
  note: string | null;
}): Promise<CheckIn> {
  const db = getDatabase();
  const checkIn: CheckIn = {
    id: createId("checkin"),
    habitId: input.habitId,
    date: input.date,
    status: "completed",
    value: input.value,
    note: input.note,
    createdAt: new Date().toISOString()
  };

  await db.runAsync(
    `INSERT INTO check_ins (id, habit_id, date, status, value, note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(habit_id, date) DO UPDATE SET
       status = excluded.status,
       value = excluded.value,
       note = excluded.note,
       created_at = excluded.created_at`,
    [checkIn.id, checkIn.habitId, checkIn.date, checkIn.status, checkIn.value, checkIn.note, checkIn.createdAt]
  );

  return checkIn;
}

export async function listCheckInsForHabit(habitId: string): Promise<CheckIn[]> {
  const db = getDatabase();
  const rows = await db.getAllAsync<CheckInRow>(
    "SELECT * FROM check_ins WHERE habit_id = ? ORDER BY date ASC",
    [habitId]
  );

  return rows.map(mapRow);
}
