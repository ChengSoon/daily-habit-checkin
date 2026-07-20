import { z } from "zod";

export type CompanionEventPayloads = {
  app_returned: Record<string, never>;
  checkin_completed: {
    habitId: string;
    streak: number;
    allDone: boolean;
    milestoneDays: number | null;
  };
  all_done: { dateKey: string };
  streak_milestone: { habitId: string; days: number };
  evening_no_progress: Record<string, never>;
  partner_progress: { checkInId: string; habitId: string };
  mood_checkin: { score: number; note: string };
  quick_encouragement: Record<string, never>;
  daily_reflection: Record<string, never>;
};

export type CompanionEventType = keyof CompanionEventPayloads;
export type CompanionEventOf<T extends CompanionEventType> = {
  id: string;
  type: T;
  occurredAt: string;
  timezoneOffsetMinutes: number;
  payload: CompanionEventPayloads[T];
};
export type CompanionEvent = {
  [T in CompanionEventType]: CompanionEventOf<T>;
}[CompanionEventType];

const MemoryProposalSchema = z
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
      context.addIssue({ code: "custom", path: ["message"], message: "speak requires message" });
    }
    if (
      reply.decision === "silent" &&
      (reply.message || reply.suggestedAction || reply.followUpQuestion || reply.memoryProposal)
    ) {
      context.addIssue({ code: "custom", path: ["decision"], message: "silent cannot contain output" });
    }
  });

export const CompanionMessageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  senderAccountId: z.string().nullable(),
  senderName: z.string().nullable(),
  riskLevel: z.enum(["normal", "distress", "crisis"]),
  memoryProposal: MemoryProposalSchema.nullable(),
  memoryConfirmed: z.boolean(),
  createdAt: z.string()
});
export const CompanionMemorySchema = MemoryProposalSchema.extend({
  id: z.string(),
  createdBy: z.string().nullable(),
  creatorName: z.string().nullable(),
  sourceMessageId: z.string().nullable(),
  createdAt: z.string()
});
export const CompanionStateSchema = z.object({
  member: z.object({
    petVisible: z.boolean(),
    proactiveMode: z.enum(["off", "restrained", "balanced"]),
    deliveryDate: z.string(),
    ordinaryCount: z.number(),
    lastOrdinaryAt: z.string().nullable(),
    recentFingerprints: z.record(z.string(), z.string()),
    lastActiveAt: z.string().nullable()
  }),
  bond: z.object({
    points: z.number(),
    stage: z.enum(["first_meeting", "getting_familiar", "in_sync", "long_companionship"])
  })
});

export type CompanionReply = z.infer<typeof CompanionReplySchema>;
export type CompanionMessage = z.infer<typeof CompanionMessageSchema>;
export type CompanionMemory = z.infer<typeof CompanionMemorySchema>;
export type CompanionState = z.infer<typeof CompanionStateSchema>;
export type MemoryProposal = z.infer<typeof MemoryProposalSchema>;
export type MemoryConfirmation = MemoryProposal & { sourceMessageId?: string };
export type MemberPreferences = Pick<CompanionState["member"], "petVisible" | "proactiveMode">;
export type CompanionChatInput = {
  messageId: string;
  message: string;
  timezoneOffsetMinutes: number;
};
export type SharedVisibility = "shared";

export function createCompanionEvent<T extends CompanionEventType>(
  id: string,
  type: T,
  payload: CompanionEventPayloads[T],
  occurredAt = new Date(),
  timezoneOffsetMinutes = occurredAt.getTimezoneOffset()
): CompanionEventOf<T> {
  return { id, type, occurredAt: occurredAt.toISOString(), timezoneOffsetMinutes, payload };
}

export function parseCompanionReply(value: unknown): CompanionReply {
  return CompanionReplySchema.parse(value);
}
