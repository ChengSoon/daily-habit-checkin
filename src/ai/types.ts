import { HabitFrequency, HabitTrackType } from "../habits/types";

export type AIPlanRequest = {
  goalText: string;
  currentLevel: "beginner" | "some_experience" | "stable";
  durationDays: 7 | 21;
  dailyAvailableMinutes: number;
  expectedFrequency: HabitFrequency;
  reminderPreference: "morning" | "noon" | "evening" | "custom";
  customReminderTime: string | null;
  preferredTrackType: HabitTrackType;
};

export type AIPlanDay = {
  day: number;
  action: string;
  targetValue: number | null;
};

export type HabitPlan = {
  id: string;
  habitId: string;
  durationDays: 7 | 21;
  goalText: string;
  dailyActions: AIPlanDay[];
  startDate: string;
  endDate: string;
  currentStage: string;
  createdBy: "ai" | "manual";
};

export type AIPlanPreview = {
  habitName: string;
  description: string;
  durationDays: 7 | 21;
  dailyActions: AIPlanDay[];
  recommendedReminderTime: string;
  recommendedTrackType: HabitTrackType;
  numericUnit: string | null;
  fallbackAdvice: string;
  safetyNote: string | null;
};
