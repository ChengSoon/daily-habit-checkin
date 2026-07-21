import { randomUUID } from "node:crypto";
import {
  buildCompanionContext,
  createSqlCompanionContextSource,
  type CompanionContext
} from "./companionContext.js";
import type { CompanionModel } from "./companionModel.js";
import {
  createCompanionModelLookup,
  type ResolveCompanionModel
} from "./companionModelResolver.js";
import {
  logCompanionModelFailure,
  type CompanionModelSource
} from "./companionModelDiagnostics.js";
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
  type MemoryProposal
} from "./companionSchemas.js";
import {
  createCompanionStateRepository,
  type CompanionStateRepository
} from "./companionStateRepository.js";
import { createCompanionStateOperations } from "./companionServiceState.js";
import {
  CompanionActionForbiddenError,
  CompanionActionNotFoundError
} from "./companionActionRepository.js";
import {
  refreshAdventureAfterAction,
  executeCompanionAction
} from "./companionActionService.js";
import {
  CompanionActionSchema,
  type CompanionAction
} from "./companionActionSchemas.js";

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
  repository?: Omit<CompanionRepository, "actions"> & { actions?: CompanionRepository["actions"] };
  stateRepository?: CompanionStateRepository;
  model?: CompanionModel;
  resolveModel?: ResolveCompanionModel;
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

function mayRequestAction(message: string): boolean {
  return /(打卡|完成|新建|创建|添加|习惯|提醒|改到|改成|频率|暂停|恢复|继续)/.test(message);
}

export function createCompanionService(options: ServiceOptions = {}) {
  const repository = options.repository ?? createCompanionRepository();
  const stateRepository = options.stateRepository ?? createCompanionStateRepository();
  const resolveModel = options.resolveModel ?? createCompanionModelLookup(options.model);
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
        let modelSource: CompanionModelSource = "unresolved";
        try {
          const context = await buildContext({
            spaceId: input.spaceId,
            accountId: input.accountId,
            now: now(),
            timezoneOffsetMinutes: event.timezoneOffsetMinutes
          });
          const resolved = await resolveModel(input.spaceId);
          modelSource = resolved.source;
          reply = applyRisk(await resolved.model.respond({ event, context }), deterministicRisk);
          modelSucceeded = true;
        } catch (error) {
          logCompanionModelFailure(error, "respond", modelSource);
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
      onDelta: (text: string) => void,
      onAction?: (action: CompanionAction) => void
    ): Promise<string> {
      const input = CompanionChatRequestSchema.parse(request.input);
      const riskLevel = classifyRisk(input.message);
      let assistantText: string;
      let pendingAction: CompanionAction | null = null;
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
        let modelSource: CompanionModelSource = "unresolved";
        try {
          const resolved = await resolveModel(request.spaceId);
          modelSource = resolved.source;
          if (mayRequestAction(input.message) && resolved.model.planAction) {
            const plan = await resolved.model.planAction({ context, userText: input.message });
            if (plan.decision === "propose_action" && plan.action) {
              const assistantMessageId = createId();
              const expiresAt = new Date(now().getTime() + 15 * 60_000).toISOString();
              pendingAction = CompanionActionSchema.parse({
                id: createId(),
                command: plan.action,
                summary: plan.message,
                status: "pending",
                requestedBy: request.accountId,
                timezoneOffsetMinutes: input.timezoneOffsetMinutes,
                expiresAt,
                resultMessage: null
              });
              assistantText = plan.message;
              onDelta(assistantText);
              await repository.appendExchange(request.spaceId, request.accountId, {
                userMessageId: input.messageId,
                userText: input.message,
                assistantMessageId,
                assistantText,
                riskLevel,
                memoryProposal: memoryProposalFromExplicitRequest(input.message),
                action: {
                  id: pendingAction.id,
                  command: pendingAction.command,
                  summary: pendingAction.summary,
                  expiresAt: pendingAction.expiresAt,
                  timezoneOffsetMinutes: input.timezoneOffsetMinutes
                }
              });
              onAction?.(pendingAction);
              return assistantText;
            }
            if (plan.decision === "clarify") {
              assistantText = plan.message;
              onDelta(assistantText);
              await repository.appendExchange(request.spaceId, request.accountId, {
                userMessageId: input.messageId,
                userText: input.message,
                assistantMessageId: createId(),
                assistantText,
                riskLevel,
                memoryProposal: memoryProposalFromExplicitRequest(input.message)
              });
              return assistantText;
            }
            assistantText = plan.message;
            onDelta(assistantText);
            await repository.appendExchange(request.spaceId, request.accountId, {
              userMessageId: input.messageId,
              userText: input.message,
              assistantMessageId: createId(),
              assistantText,
              riskLevel,
              memoryProposal: memoryProposalFromExplicitRequest(input.message)
            });
            return assistantText;
          }
          assistantText = await resolved.model.streamChat(
            { context, userText: input.message },
            (chunk) => {
              emitted = true;
              onDelta(chunk);
            }
          );
        } catch (error) {
          logCompanionModelFailure(error, "chat", modelSource);
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

    async confirmAction(spaceId: string, accountId: string, actionId: string) {
      const actions = repository.actions;
      if (!actions) throw new Error("动作服务未配置");
      const result = await actions.withLockedAction(
        spaceId,
        accountId,
        actionId,
        async (client, action) => {
          if (action.status === "succeeded" || action.status === "failed" || action.status === "cancelled" || action.status === "expired") {
            return { action, message: action.resultMessage ?? "这个动作已经处理过了。", resources: [] };
          }
          if (new Date(action.expiresAt).getTime() <= now().getTime()) {
            const message = "这个动作已经过期，请重新告诉我想做什么。";
            await actions.updateStatus(client, spaceId, action.id, "expired", message);
            return { action: { ...action, status: "expired", resultMessage: message }, message, resources: [] };
          }
          try {
            const execution = await executeCompanionAction({
              client,
              spaceId,
              accountId,
              command: action.command,
              now: now(),
              timezoneOffsetMinutes: action.timezoneOffsetMinutes
            });
            await actions.updateStatus(client, spaceId, action.id, "succeeded", execution.message);
            return { action: { ...action, status: "succeeded", resultMessage: execution.message }, ...execution };
          } catch (error) {
            const message = error instanceof Error ? error.message : "这个动作暂时没完成。";
            await actions.updateStatus(client, spaceId, action.id, "failed", message);
            return { action: { ...action, status: "failed", resultMessage: message }, message, resources: [] };
          }
        }
      );
      return { ...result, resources: await refreshAdventureAfterAction(spaceId, result.resources) };
    },

    async cancelAction(spaceId: string, accountId: string, actionId: string) {
      const actions = repository.actions;
      if (!actions) throw new Error("动作服务未配置");
      return actions.withLockedAction(spaceId, accountId, actionId, async (client, action) => {
        if (action.status !== "pending") {
          return { action, message: action.resultMessage ?? "这个动作已经处理过了。", resources: [] };
        }
        if (new Date(action.expiresAt).getTime() <= now().getTime()) {
          const message = "这个动作已经过期，没有执行。";
          await actions.updateStatus(client, spaceId, action.id, "expired", message);
          return { action: { ...action, status: "expired", resultMessage: message }, message, resources: [] };
        }
        const message = "好的，我没有执行这个动作。";
        await actions.updateStatus(client, spaceId, action.id, "cancelled", message);
        return { action: { ...action, status: "cancelled", resultMessage: message }, message, resources: [] };
      });
    },

    ...createCompanionStateOperations({ repository, stateRepository })
  };
}
export type CompanionService = ReturnType<typeof createCompanionService>;
