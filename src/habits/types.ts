export type HabitFrequency =
  | { type: "daily" }
  | { type: "weekdays" }
  | { type: "weekly"; daysOfWeek: number[] };

export type HabitTrackType = "check" | "numeric";

export type Habit = {
  id: string;
  name: string;
  description: string | null;
  frequency: HabitFrequency;
  reminderTime: string | null;
  isReminderEnabled: boolean;
  isPaused: boolean;
  trackType: HabitTrackType;
  numericUnit: string | null;
  createdAt: string;
};
