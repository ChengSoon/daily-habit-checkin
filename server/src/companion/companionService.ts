import { randomUUID } from "node:crypto";
import {
  buildCompanionContext,
  createSqlCompanionContextSource,
  type CompanionContext
} from "./companionContext.js";
import { createCompanionModel, type CompanionModel } from "./companionModel.js";
import { memoryProposalFromExplicitRequest } from "./companionMemory.js";
import { deliveryDateKey, type DeliveryCategory } from "./companionPolicy.js";
import {
  createCompanionRepository,
  type CompanionRepository
} from "./companionRepository.js";
import { classifyRisk, crisisSupportMessage, mergeRisk } from "./companionSafety.js";
import {
  CompanionEventSchema,
  CompanionChatRequestSchema,
  CompanionReplySchema,
  type CompanionChatRequest,
  type CompanionEvent,
  type CompanionReply,
  type CompanionRiskLevel,
  type MemberPreferences,
  type MemoryConfirmation,
  type MemoryProposal
} from "./companionSchemas.js";
import {
  createCompanionStateRepository,
  type CompanionStateRepository
} from "./companionStateRepository.js";

type ContextInput = {
  spaceId: string;
  accountId: string;
  now: Date;
  timezoneOffsetMinutes: number;
};

export class CompanionEventInProgressError extends Error {
  constructor() {
    super("陪伴事件正在处理");
    this.name = "CompanionEventInProgressError";
  }
}

type ServiceOptions = {
  repository?: CompanionRepository;
  stateRepository?: CompanionStateRepository;
  model?: CompanionModel;
  buildContext?: (input: ContextInput) => Promise<CompanionContext>;
  createId?: () => string;
  now?: () => Date;
};

function eventCategory(event: CompanionEvent): DeliveryCategory {
  if (["mood_checkin", "quick_encouragement", "daily_reflection"].includes(event.type)) {
    return "requested";
  }
  if (
    event.type === "all_done" ||
    event.type === "streak_milestone" ||
    (event.type === "checkin_completed" && (event.payload.allDone || event.payload.milestoneDays))
  ) {
    return "high_value";
  }
  return "ordinary";
}

function eventFingerprint(event: CompanionEvent): string {
  if (event.type === "partner_progress") return `partner:${event.payload.checkInId}`;
  if (event.type === "streak_milestone") return `streak:${event.payload.habitId}:${event.payload.days}`;
  if (event.type === "all_done") return `all_done:${event.payload.dateKey}`;
  if (event.type === "checkin_completed") return `checkin:${event.id}`;
  return `${event.type}:${event.occurredAt.slice(0, 10)}`;
}

function eventText(event: CompanionEvent): string {
  return event.type === "mood_checkin" ? event.payload.note : "";
}

function silentReply(eventId: string): CompanionReply {
  return {
    version: 1,
    eventId,
    decision: "silent",
    mood: "idle",
    intent: "listen",
    riskLevel: "normal"
  };
}

function fallbackReply(event: CompanionEvent): CompanionReply {
  const messages: Partial<Record<CompanionEvent["type"], string>> = {
    app_returned: "回来啦，今天也可以慢慢来。",
    checkin_completed: "这一步已经稳稳落下啦。",
    all_done: "今天的小目标都完成了，辛苦啦。",
    streak_milestone: "这段坚持很不容易，值得好好庆祝。",
    mood_checkin: "我在这里，你可以慢慢说。"
  };
  return {
    version: 1,
    eventId: event.id,
    decision: "speak",
    message: messages[event.type] ?? "我在这里陪你，先做当下最轻的一步就好。",
    mood: event.type === "mood_checkin" ? "waiting" : "wave",
    intent: event.type === "mood_checkin" ? "listen" : "encourage",
    riskLevel: classifyRisk(eventText(event))
  };
}

function crisisReply(eventId: string): CompanionReply {
  return {
    version: 1,
    eventId,
    decision: "speak",
    message: crisisSupportMessage(),
    mood: "sad",
    intent: "listen",
    riskLevel: "crisis"
  };
}

function bondAward(event: CompanionEvent): { sourceKey: string; points: number } | null {
  if (event.type === "all_done") return { sourceKey: `all_done:${event.payload.dateKey}`, points: 5 };
  if (event.type === "streak_milestone") {
    return { sourceKey: `streak:${event.payload.habitId}:${event.payload.days}`, points: 5 };
  }
  if (event.type === "checkin_completed" && event.payload.milestoneDays) {
    return {
      sourceKey: `streak:${event.payload.habitId}:${event.payload.milestoneDays}`,
      points: 5
    };
  }
  if (event.type === "checkin_completed" && event.payload.allDone) {
    const dateKey = deliveryDateKey(
      new Date(event.occurredAt),
      event.timezoneOffsetMinutes
    );
    return { sourceKey: `all_done:${dateKey}`, points: 5 };
  }
  if (event.type === "mood_checkin") {
    return { sourceKey: `mood:${event.occurredAt.slice(0, 10)}`, points: 2 };
  }
  return null;
}

function applyRisk(reply: CompanionReply, deterministic: CompanionRiskLevel): CompanionReply {
  const riskLevel = mergeRisk(reply.riskLevel, deterministic);
  return riskLevel === "crisis" ? crisisReply(reply.eventId) : { ...reply, riskLevel };
}

export function createCompanionService(options: ServiceOptions = {}) {
  const repository = options.repository ?? createCompanionRepository();
  const stateRepository = options.stateRepository ?? createCompanionStateRepository();
  const model = options.model ?? createCompanionModel();
  const createId = options.createId ?? randomUUID;
  const now = options.now ?? (() => new Date());
  const source = createSqlCompanionContextSource({ repository, stateRepository });
  const buildContext =
    options.buildContext ??
    ((input: ContextInput) => buildCompanionContext({ source, ...input }));

  async function persistReply(spaceId: string, event: CompanionEvent, reply: CompanionReply) {
    await repository.completeEvent(spaceId, event.id, reply);
    if (reply.decision === "speak" && reply.message) {
      await repository.appendAssistantMessage(spaceId, {
        id: createId(),
        eventId: event.id,
        content: reply.message,
        riskLevel: reply.riskLevel
      });
    }
  }

  return {
    async respond(input: { spaceId: string; accountId: string; event: CompanionEvent }) {
      const event = CompanionEventSchema.parse(input.event);
      const claim = await repository.claimEvent(input.spaceId, input.accountId, event);
      if (!claim.claimed) {
        if (claim.cachedReply) return claim.cachedReply;
        throw new CompanionEventInProgressError();
      }
      const reservation = await stateRepository.reserveDelivery({
        spaceId: input.spaceId,
        accountId: input.accountId,
        category: eventCategory(event),
        fingerprint: eventFingerprint(event),
        now: now(),
        timezoneOffsetMinutes: event.timezoneOffsetMinutes
      });
      if (!reservation.allowed) {
        const reply = silentReply(event.id);
        await persistReply(input.spaceId, event, reply);
        return reply;
      }

      const deterministicRisk = classifyRisk(eventText(event));
      let reply: CompanionReply;
      let modelSucceeded = false;
      if (deterministicRisk === "crisis") {
        reply = crisisReply(event.id);
      } else {
        try {
          const context = await buildContext({
            spaceId: input.spaceId,
            accountId: input.accountId,
            now: now(),
            timezoneOffsetMinutes: event.timezoneOffsetMinutes
          });
          reply = applyRisk(await model.respond({ event, context }), deterministicRisk);
          modelSucceeded = true;
        } catch {
          reply = fallbackReply(event);
        }
      }
      reply = CompanionReplySchema.parse(reply);
      await persistReply(input.spaceId, event, reply);
      const award = modelSucceeded ? bondAward(event) : null;
      if (award) await stateRepository.awardBond(input.spaceId, award.sourceKey, award.points);
      return reply;
    },

    async chat(
      request: { spaceId: string; accountId: string; input: CompanionChatRequest },
      onDelta: (text: string) => void
    ): Promise<string> {
      const input = CompanionChatRequestSchema.parse(request.input);
      const riskLevel = classifyRisk(input.message);
      let assistantText: string;
      if (riskLevel === "crisis") {
        assistantText = crisisSupportMessage();
        onDelta(assistantText);
      } else {
        const context = await buildContext({
          spaceId: request.spaceId,
          accountId: request.accountId,
          now: now(),
          timezoneOffsetMinutes: input.timezoneOffsetMinutes
        });
        let emitted = false;
        try {
          assistantText = await model.streamChat({ context, userText: input.message }, (chunk) => {
            emitted = true;
            onDelta(chunk);
          });
        } catch {
          if (emitted) throw new Error("陪伴回复中断");
          assistantText = "我暂时没接上话，但我还在这里。";
          onDelta(assistantText);
        }
      }
      await repository.appendExchange(request.spaceId, request.accountId, {
        userMessageId: input.messageId,
        userText: input.message,
        assistantMessageId: createId(),
        assistantText,
        riskLevel,
        memoryProposal: memoryProposalFromExplicitRequest(input.message)
      });
      return assistantText;
    },

    listMessages(spaceId: string, limit: number, cursor: string | null) {
      return repository.listMessagePage(spaceId, limit, cursor);
    },

    listMemories(spaceId: string) {
      return repository.listMemories(spaceId);
    },

    async saveMemory(spaceId: string, accountId: string, proposal: MemoryConfirmation) {
      const memory = await repository.saveMemory(spaceId, accountId, proposal);
      await stateRepository.awardBond(spaceId, `memory:${memory.id}`, 3);
      return memory;
    },

    deleteMemory(spaceId: string, memoryId: string) {
      return repository.deleteMemory(spaceId, memoryId);
    },

    async clearMessages(spaceId: string) {
      await repository.clearMessages(spaceId);
      await stateRepository.clearConversationSummary(spaceId);
    },

    async getState(spaceId: string, accountId: string) {
      const [member, bond] = await Promise.all([
        stateRepository.getMemberState(spaceId, accountId),
        stateRepository.getBondState(spaceId)
      ]);
      return { member, bond };
    },

    async updateState(spaceId: string, accountId: string, preferences: MemberPreferences) {
      await stateRepository.updateMemberPreferences(spaceId, accountId, preferences);
      return this.getState(spaceId, accountId);
    }
  };
}
export type CompanionService = ReturnType<typeof createCompanionService>;
