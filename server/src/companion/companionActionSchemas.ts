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

const CompleteCheckInCommandSchema = z
  .object({
    type: z.literal("complete_checkin"),
    arguments: z
      .object({
        habitId: z.string().min(1).max(128),
        value: z.number().finite().nonnegative().max(1_000_000).nullable()
      })
      .strict()
  })
  .strict();

const CreateHabitCommandSchema = z
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
      .superRefine((value, context) => {
        if (value.trackType === "numeric" && !value.numericUnit) {
          context.addIssue({
            code: "custom",
            path: ["numericUnit"],
            message: "numeric habits require a unit"
          });
        }
        if (value.trackType === "check" && value.numericUnit) {
          context.addIssue({
            code: "custom",
            path: ["numericUnit"],
            message: "check habits cannot contain a unit"
          });
        }
      })
  })
  .strict();

const UpdateHabitCommandSchema = z
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
      .superRefine((value, context) => {
        if (Object.keys(value).every((key) => key === "habitId")) {
          context.addIssue({ code: "custom", message: "habit update cannot be empty" });
        }
      })
  })
  .strict();

const SetHabitPausedCommandSchema = z
  .object({
    type: z.literal("set_habit_paused"),
    arguments: z
      .object({
        habitId: z.string().min(1).max(128),
        paused: z.boolean()
      })
      .strict()
  })
  .strict();

export const CompanionActionCommandSchema = z.discriminatedUnion("type", [
  CompleteCheckInCommandSchema,
  CreateHabitCommandSchema,
  UpdateHabitCommandSchema,
  SetHabitPausedCommandSchema
]);

export const CompanionActionPlanSchema = z
  .object({
    decision: z.enum(["chat", "clarify", "propose_action"]),
    message: z.string().trim().min(1).max(240),
    action: CompanionActionCommandSchema.optional()
  })
  .strict()
  .superRefine((plan, context) => {
    if (plan.decision === "propose_action" && !plan.action) {
      context.addIssue({ code: "custom", path: ["action"], message: "action is required" });
    }
    if (plan.decision !== "propose_action" && plan.action) {
      context.addIssue({ code: "custom", path: ["action"], message: "action is not allowed" });
    }
    if (plan.decision !== "chat" && !plan.message) {
      context.addIssue({ code: "custom", path: ["message"], message: "message is required" });
    }
  });

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

export type CompanionActionCommand = z.infer<typeof CompanionActionCommandSchema>;
export type CompanionActionPlan = z.infer<typeof CompanionActionPlanSchema>;
export type CompanionAction = z.infer<typeof CompanionActionSchema>;
export type CompanionActionStatus = CompanionAction["status"];
