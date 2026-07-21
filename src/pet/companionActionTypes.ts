import { z } from "zod";

const HabitFrequencySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("daily") }).strict(),
  z.object({ type: z.literal("weekdays") }).strict(),
  z
    .object({
      type: z.literal("weekly"),
      daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1).max(7)
    })
    .strict()
]);

const ReminderTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .nullable();

export const CompanionActionCommandSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("complete_checkin"),
      arguments: z
        .object({
          habitId: z.string().min(1).max(128),
          value: z.number().finite().nonnegative().max(1_000_000).nullable()
        })
        .strict()
    })
    .strict(),
  z
    .object({
      type: z.literal("create_habit"),
      arguments: z
        .object({
          name: z.string().trim().min(1).max(50),
          description: z.string().trim().max(200).nullable(),
          frequency: HabitFrequencySchema,
          reminderTime: ReminderTimeSchema,
          trackType: z.enum(["check", "numeric"]),
          numericUnit: z.string().trim().min(1).max(20).nullable()
        })
        .strict()
    })
    .strict(),
  z
    .object({
      type: z.literal("update_habit"),
      arguments: z
        .object({
          habitId: z.string().min(1).max(128),
          name: z.string().trim().min(1).max(50).optional(),
          description: z.string().trim().max(200).nullable().optional(),
          frequency: HabitFrequencySchema.optional(),
          reminderTime: ReminderTimeSchema.optional()
        })
        .strict()
    })
    .strict(),
  z
    .object({
      type: z.literal("set_habit_paused"),
      arguments: z
        .object({
          habitId: z.string().min(1).max(128),
          paused: z.boolean()
        })
        .strict()
    })
    .strict()
]);

export const CompanionActionSchema = z
  .object({
    id: z.string().min(1).max(128),
    command: CompanionActionCommandSchema,
    summary: z.string().trim().min(1).max(240),
    status: z.enum(["pending", "succeeded", "failed", "cancelled", "expired"]),
    requestedBy: z.string().min(1).max(128),
    timezoneOffsetMinutes: z.number().int().min(-840).max(840),
    expiresAt: z.iso.datetime(),
    resultMessage: z.string().trim().min(1).max(240).nullable()
  })
  .strict();

export type CompanionAction = z.infer<typeof CompanionActionSchema>;
export type CompanionActionCommand = z.infer<typeof CompanionActionCommandSchema>;
