import { z } from "zod";

export const HabitPlanResponseSchema = z.object({
  habitName: z.string().min(1).max(32),
  description: z.string().min(1).max(120),
  durationDays: z.union([z.literal(7), z.literal(21)]),
  dailyActions: z
    .array(
      z.object({
        day: z.number().int().min(1).max(21),
        action: z.string().min(1).max(120),
        targetValue: z.number().nullable()
      })
    )
    .min(7)
    .max(21),
  recommendedReminderTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/),
  recommendedTrackType: z.union([z.literal("check"), z.literal("numeric")]),
  numericUnit: z.string().max(12).nullable(),
  fallbackAdvice: z.string().min(1).max(120),
  safetyNote: z.string().max(120).nullable()
});

export type HabitPlanResponse = z.infer<typeof HabitPlanResponseSchema>;

export const HabitPlanRequestSchema = z.object({
  goalText: z.string().min(2).max(120),
  currentLevel: z.union([z.literal("beginner"), z.literal("some_experience"), z.literal("stable")]),
  dailyAvailableMinutes: z.number().int().min(1).max(180),
  expectedFrequency: z.object({
    type: z.union([z.literal("daily"), z.literal("weekdays"), z.literal("weekly")]),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional()
  }),
  reminderPreference: z.union([
    z.literal("morning"),
    z.literal("noon"),
    z.literal("evening"),
    z.literal("custom")
  ]),
  customReminderTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).nullable(),
  preferredTrackType: z.union([z.literal("check"), z.literal("numeric")])
});
