import { deleteResource, listResource, upsertResource } from "../sync/dataClient";
import { createId } from "../utils/id";
import { CheckIn } from "./types";
import { postCommand } from "../sync/commandClient";
import type { XpAward, XpTransaction, XpWallet } from "../xp/types";

type CheckInDto = {
  id: string;
  habitId: string;
  date: string;
  status: CheckIn["status"];
  value: number | null;
  note: string | null;
  createdAt: string;
  createdBy: string | null;
};

function mapDto(dto: CheckInDto): CheckIn {
  return {
    id: dto.id,
    habitId: dto.habitId,
    date: dto.date,
    status: dto.status,
    value: dto.value === null ? null : Number(dto.value),
    note: dto.note,
    createdAt: dto.createdAt,
    createdBy: dto.createdBy ?? null
  };
}

function toFields(checkIn: CheckIn): Record<string, unknown> {
  return {
    habitId: checkIn.habitId,
    date: checkIn.date,
    status: checkIn.status,
    value: checkIn.value,
    note: checkIn.note,
    createdAt: checkIn.createdAt,
    // 新建时留空，交给服务端按当前登录账号盖章（谁打的卡自动记录，不信任客户端自报）；
    // 更新已有记录时带上原归属，避免被服务端重新盖章成「最后操作者」。
    createdBy: checkIn.createdBy
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
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    createdBy: existing?.createdBy ?? null
  };

  await upsertResource<CheckInDto>("check_ins", checkIn.id, toFields(checkIn));
  return checkIn;
}

export type CompleteCheckInResult = {
  checkIn: CheckIn;
  awards: XpAward[];
  insertedTransactions: XpTransaction[];
  wallet: XpWallet;
  earnedDelta: number;
  streak: number;
};

export async function completeCheckInWithXp(input: {
  habitId: string;
  date: string;
  value: number | null;
  note: string | null;
}): Promise<CompleteCheckInResult> {
  const result = await postCommand<Omit<CompleteCheckInResult, "wallet"> & { wallet: Omit<XpWallet, "id"> }>(
    "/api/checkins/complete",
    { ...input, timezoneOffsetMinutes: new Date().getTimezoneOffset() }
  );
  return { ...result, wallet: { id: "default", ...result.wallet } };
}

export async function undoCheckInWithXp(input: {
  habitId: string;
  date: string;
  checkInId: string;
}): Promise<{
  removed: CheckIn;
  reversedAmount: number;
  insertedTransactions: XpTransaction[];
  wallet: XpWallet;
}> {
  const result = await postCommand<{
    removed: CheckIn;
    reversedAmount: number;
    insertedTransactions: XpTransaction[];
    wallet: Omit<XpWallet, "id">;
  }>("/api/checkins/undo", input);
  return { ...result, wallet: { id: "default", ...result.wallet } };
}

export async function undoCheckIn(input: {
  habitId: string;
  date: string;
  checkInId?: string | null;
}): Promise<CheckIn | null> {
  const all = await fetchAll();
  const existing = all.find((checkIn) => checkIn.habitId === input.habitId && checkIn.date === input.date);

  if (!existing || (input.checkInId && existing.id !== input.checkInId)) {
    return null;
  }

  await deleteResource("check_ins", existing.id);
  return existing;
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
