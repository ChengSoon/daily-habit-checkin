import { deleteResource, listResource, upsertResource } from "../sync/dataClient";
import { createId } from "../utils/id";
import { Habit, HabitFrequency, HabitTrackType } from "./types";

type CreateHabitInput = {
  name: string;
  description: string | null;
  frequency: HabitFrequency;
  reminderTime: string | null;
  isReminderEnabled: boolean;
  trackType: HabitTrackType;
  numericUnit: string | null;
};

export type UpdateHabitInput = CreateHabitInput;

/**
 * 服务端 habits 资源的一行（camelCase）。frequency 以 frequencyJson 字符串存储，
 * 布尔字段由服务端返回真正的 boolean。
 */
type HabitDto = {
  id: string;
  name: string;
  description: string | null;
  frequencyJson: string;
  reminderTime: string | null;
  isReminderEnabled: boolean;
  isPaused: boolean;
  trackType: HabitTrackType;
  numericUnit: string | null;
  sortOrder: number;
  createdAt: string;
};

function mapDto(dto: HabitDto): Habit {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    frequency: JSON.parse(dto.frequencyJson),
    reminderTime: dto.reminderTime,
    isReminderEnabled: Boolean(dto.isReminderEnabled),
    isPaused: Boolean(dto.isPaused),
    trackType: dto.trackType,
    numericUnit: dto.numericUnit,
    sortOrder: dto.sortOrder,
    createdAt: dto.createdAt
  };
}

/** 把 Habit 转成服务端期望的完整字段（upsert 用）。 */
function toFields(habit: Habit): Record<string, unknown> {
  return {
    name: habit.name,
    description: habit.description,
    frequencyJson: JSON.stringify(habit.frequency),
    reminderTime: habit.reminderTime,
    isReminderEnabled: habit.isReminderEnabled,
    isPaused: habit.isPaused,
    trackType: habit.trackType,
    numericUnit: habit.numericUnit,
    sortOrder: habit.sortOrder,
    createdAt: habit.createdAt
  };
}

async function fetchAll(): Promise<Habit[]> {
  const rows = await listResource<HabitDto>("habits");
  return rows.map(mapDto);
}

export async function createHabit(input: CreateHabitInput): Promise<Habit> {
  const activeHabits = await listActiveHabits();

  if (activeHabits.length >= 7) {
    throw new Error("最多只能同时管理 7 个活跃习惯");
  }

  const habit: Habit = {
    id: createId("habit"),
    name: input.name,
    description: input.description,
    frequency: input.frequency,
    reminderTime: input.reminderTime,
    isReminderEnabled: input.isReminderEnabled,
    isPaused: false,
    trackType: input.trackType,
    numericUnit: input.numericUnit,
    sortOrder: activeHabits.length,
    createdAt: new Date().toISOString()
  };

  await upsertResource<HabitDto>("habits", habit.id, toFields(habit));
  return habit;
}

export async function listActiveHabits(): Promise<Habit[]> {
  const habits = await fetchAll();
  return habits
    .filter((habit) => !habit.isPaused)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.createdAt.localeCompare(right.createdAt));
}

export async function listHabits(): Promise<Habit[]> {
  const habits = await fetchAll();
  return habits.sort(
    (left, right) =>
      Number(left.isPaused) - Number(right.isPaused) ||
      left.sortOrder - right.sortOrder ||
      left.createdAt.localeCompare(right.createdAt)
  );
}

export async function getHabitById(id: string): Promise<Habit | null> {
  const habits = await fetchAll();
  return habits.find((habit) => habit.id === id) ?? null;
}

export async function updateHabit(id: string, input: UpdateHabitInput): Promise<void> {
  const existing = await getHabitById(id);
  if (!existing) {
    throw new Error("习惯不存在");
  }

  await upsertResource<HabitDto>("habits", id, {
    ...toFields(existing),
    name: input.name,
    description: input.description,
    frequencyJson: JSON.stringify(input.frequency),
    reminderTime: input.reminderTime,
    isReminderEnabled: input.isReminderEnabled,
    trackType: input.trackType,
    numericUnit: input.numericUnit
  });
}

export async function setHabitPaused(id: string, isPaused: boolean): Promise<void> {
  const existing = await getHabitById(id);
  if (!existing) {
    return;
  }
  await upsertResource<HabitDto>("habits", id, { ...toFields(existing), isPaused });
}

export async function deleteHabit(id: string): Promise<void> {
  await deleteResource("habits", id);
}

export async function moveHabit(id: string, direction: "up" | "down"): Promise<void> {
  const habits = await listHabits();
  const currentIndex = habits.findIndex((habit) => habit.id === id);

  if (currentIndex < 0) {
    return;
  }

  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  const current = habits[currentIndex];
  const next = habits[nextIndex];

  if (!current || !next) {
    return;
  }

  // 交换两者的 sortOrder
  await upsertResource<HabitDto>("habits", current.id, { ...toFields(current), sortOrder: next.sortOrder });
  await upsertResource<HabitDto>("habits", next.id, { ...toFields(next), sortOrder: current.sortOrder });
}
