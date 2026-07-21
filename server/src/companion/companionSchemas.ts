import { z } from "zod";

const eventBase = {
  id: z.string().min(1).max(128),
  occurredAt: z.iso.datetime(),
  timezoneOffsetMinutes: z.number().int().min(-840).max(840)
};

const emptyEvent = (type: "app_returned" | "evening_no_progress" | "quick_encouragement" | "daily_reflection") =>
  z.object({ ...eventBase, type: z.literal(type), payload: z.object({}).strict() }).strict();

export const CompanionEventSchema = z.discriminatedUnion("type", [
  emptyEvent("app_returned"),
  z
    .object({
      ...eventBase,
      type: z.literal("checkin_completed"),
      payload: z
        .object({
          habitId: z.string().min(1).max(128),
          streak: z.number().int().nonnegative(),
          allDone: z.boolean(),
          milestoneDays: z.number().int().positive().nullable()
        })
        .strict()
    })
    .strict(),
  z
    .object({
      ...eventBase,
      type: z.literal("all_done"),
      payload: z.object({ dateKey: z.iso.date() }).strict()
    })
    .strict(),
  z
    .object({
      ...eventBase,
      type: z.literal("streak_milestone"),
      payload: z
        .object({ habitId: z.string().min(1).max(128), days: z.number().int().positive() })
        .strict()
    })
    .strict(),
  z
    .object({
      ...eventBase,
      type: z.literal("partner_progress"),
      payload: z
        .object({
          checkInId: z.string().min(1).max(128),
          habitId: z.string().min(1).max(128)
        })
        .strict()
    })
    .strict(),
  z
    .object({
      ...eventBase,
      type: z.literal("mood_checkin"),
      payload: z
        .object({ score: z.number().int().min(1).max(5), note: z.string().trim().max(500) })
        .strict()
    })
    .strict(),
  emptyEvent("evening_no_progress"),
  emptyEvent("quick_encouragement"),
  emptyEvent("daily_reflection")
]);

export const MemoryProposalSchema = z
  .object({
    category: z.enum([
      "preference",
      "important_date",
      "shared_goal",
      "encouragement_style",
      "shared_moment"
    ]),
    content: z.string().trim().min(1).max(200)
  })
  .strict();

export const MemoryConfirmationSchema = MemoryProposalSchema.extend({
  sourceMessageId: z.string().min(1).max(128).optional()
}).strict();

export const CompanionReplySchema = z
  .object({
    version: z.literal(1),
    eventId: z.string().min(1).max(128),
    decision: z.enum(["speak", "silent"]),
    message: z.string().trim().min(1).max(240).optional(),
    mood: z.enum(["idle", "happy", "thinking", "waiting", "sad", "wave"]),
    intent: z.enum(["celebrate", "comfort", "encourage", "listen", "reflect"]),
    riskLevel: z.enum(["normal", "distress", "crisis"]),
    suggestedAction: z.enum(["open_habit", "open_checkin", "open_chat"]).optional(),
    followUpQuestion: z.string().trim().min(1).max(120).optional(),
    memoryProposal: MemoryProposalSchema.optional()
  })
  .strict()
  .superRefine((reply, context) => {
    if (reply.decision === "speak" && !reply.message) {
      context.addIssue({ code: "custom", path: ["message"], message: "speak reply requires message" });
    }
    if (
      reply.decision === "silent" &&
      (reply.message || reply.suggestedAction || reply.followUpQuestion || reply.memoryProposal)
    ) {
      context.addIssue({ code: "custom", path: ["decision"], message: "silent reply cannot contain output" });
    }
  });

export const CompanionChatRequestSchema = z
  .object({
    messageId: z.string().min(1).max(128),
    message: z.string().trim().min(1).max(1000),
    timezoneOffsetMinutes: z.number().int().min(-840).max(840)
  })
  .strict();


export const CompanionAsrRequestSchema = z
  .object({
    audioBase64: z.string().min(8).max(3_500_000),
    mimeType: z.enum(["audio/mp4", "audio/m4a", "audio/mpeg", "audio/wav", "audio/webm"]),
    language: z.enum(["zh", "en"]).optional()
  })
  .strict();

export const CompanionTtsRequestSchema = z
  .object({
    text: z.string().trim().min(1).max(800)
  })
  .strict();

export const MemberPreferencesSchema = z
  .object({
    petVisible: z.boolean(),
    proactiveMode: z.enum(["off", "restrained", "balanced"])
  })
  .strict();

export type CompanionEvent = z.infer<typeof CompanionEventSchema>;
export type CompanionReply = z.infer<typeof CompanionReplySchema>;
export type MemoryProposal = z.infer<typeof MemoryProposalSchema>;
export type MemoryConfirmation = z.infer<typeof MemoryConfirmationSchema>;
export type CompanionChatRequest = z.infer<typeof CompanionChatRequestSchema>;
export type CompanionTtsRequest = z.infer<typeof CompanionTtsRequestSchema>;
export type CompanionAsrRequest = z.infer<typeof CompanionAsrRequestSchema>;
export type MemberPreferences = z.infer<typeof MemberPreferencesSchema>;
export type CompanionRiskLevel = CompanionReply["riskLevel"];
