import { listResource, upsertResource } from "../sync/dataClient";
import { createId } from "../utils/id";
import { CheckIn } from "./types";

type CheckInDto = {
  id: string;
  habitId: string;
  date: string;
  status: CheckIn["status"];
  value: number | null;
  note: string | null;
  createdAt: string;
};

function mapDto(dto: CheckInDto): CheckIn {
  return {
    id: dto.id,
    habitId: dto.habitId,
    date: dto.date,
    status: dto.status,
    value: dto.value === null ? null : Number(dto.value),
    note: dto.note,
    createdAt: dto.createdAt
  };
}

function toFields(checkIn: CheckIn): Record<string, unknown> {
  return {
    habitId: checkIn.habitId,
    date: checkIn.date,
    status: checkIn.status,
    value: checkIn.value,
    note: checkIn.note,
    createdAt: checkIn.createdAt
  };
}

async function fetchAll(): Promise<CheckIn[]> {
  const rows = await listResource<CheckInDto>("check_ins");
  return rows.map(mapDto);
}

export async function completeCheckIn(input: {
  habitId: string;
  date: string;
  value: number | null;
  note: string | null;
}): Promise<CheckIn> {
  // 服务端 check_ins 有 UNIQUE(habit_id, date)，而按 id upsert 不会命中这个约束，
  // 因此先查当天已有记录复用其 id，实现「同一天再次打卡即更新」。
  const all = await fetchAll();
  const existing = all.find((checkIn) => checkIn.habitId === input.habitId && checkIn.date === input.date);

  const checkIn: CheckIn = {
    id: existing?.id ?? createId("checkin"),
    habitId: input.habitId,
    date: input.date,
    status: "completed",
    value: input.value,
    note: input.note,
    createdAt: existing?.createdAt ?? new Date().toISOString()
  };

  await upsertResource<CheckInDto>("check_ins", checkIn.id, toFields(checkIn));
  return checkIn;
}

export async function listCheckInsForHabit(habitId: string): Promise<CheckIn[]> {
  const all = await fetchAll();
  return all
    .filter((checkIn) => checkIn.habitId === habitId)
    .sort((left, right) => left.date.localeCompare(right.date));
}

export async function isHabitCompletedOn(habitId: string, date: string): Promise<boolean> {
  const all = await fetchAll();
  const row = all.find((checkIn) => checkIn.habitId === habitId && checkIn.date === date);
  return row?.status === "completed";
}

export async function listAllCheckIns(): Promise<CheckIn[]> {
  const all = await fetchAll();
  return all.sort((left, right) => left.date.localeCompare(right.date));
}
