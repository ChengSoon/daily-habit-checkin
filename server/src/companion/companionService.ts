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

type ServiceRuntime = {
  repository: Omit<CompanionRepository, "actions"> & { actions?: CompanionRepository["actions"] };
  stateRepository: CompanionStateRepository;
  resolveModel: ResolveCompanionModel;
  buildContext: (input: ContextInput) => Promise<CompanionContext>;
  createId: () => string;
  now: () => Date;
};

async function persistReply(runtime: ServiceRuntime, options: {
  spaceId: string; event: CompanionEvent; reply: CompanionReply;
}) {
  const { spaceId, event, reply } = options;
  await runtime.repository.completeEvent(spaceId, event.id, reply);
  if (reply.decision === "speak" && reply.message) {
    await runtime.repository.appendAssistantMessage(spaceId, {
      id: runtime.createId(), eventId: event.id, content: reply.message, riskLevel: reply.riskLevel
    });
  }
}

async function respondService(runtime: ServiceRuntime, input: { spaceId: string; accountId: string; event: CompanionEvent }) {
  const event = CompanionEventSchema.parse(input.event);
  const claim = await runtime.repository.claimEvent(input.spaceId, input.accountId, event);
  if (!claim.claimed) {
    if (claim.cachedReply) return claim.cachedReply;
    throw new CompanionEventInProgressError();
  }
  const reservation = await runtime.stateRepository.reserveDelivery({
    spaceId: input.spaceId, accountId: input.accountId, category: eventCategory(event),
    fingerprint: eventFingerprint(event), now: runtime.now(), timezoneOffsetMinutes: event.timezoneOffsetMinutes
  });
  if (!reservation.allowed) {
    const reply = silentReply(event.id);
    await persistReply(runtime, { spaceId: input.spaceId, event, reply });
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
      const context = await runtime.buildContext({ spaceId: input.spaceId, accountId: input.accountId,
        now: runtime.now(), timezoneOffsetMinutes: event.timezoneOffsetMinutes });
      const resolved = await runtime.resolveModel(input.spaceId);
      modelSource = resolved.source;
      reply = applyRisk(await resolved.model.respond({ event, context }), deterministicRisk);
      modelSucceeded = true;
    } catch (error) {
      logCompanionModelFailure(error, "respond", modelSource);
      reply = fallbackReply(event);
    }
  }
  const parsedReply = CompanionReplySchema.parse(reply);
  await persistReply(runtime, { spaceId: input.spaceId, event, reply: parsedReply });
  const award = modelSucceeded ? bondAward(event) : null;
  if (award) await runtime.stateRepository.awardBond(input.spaceId, award.sourceKey, award.points);
  return parsedReply;
}

function exchangeInput(runtime: ServiceRuntime, options: {
  request: { spaceId: string; accountId: string; input: CompanionChatRequest };
  assistantText: string;
  riskLevel: CompanionRiskLevel;
  action?: CompanionAction;
}) {
  const { request, assistantText, riskLevel, action } = options;
  return runtime.repository.appendExchange(request.spaceId, request.accountId, {
    userMessageId: request.input.messageId,
    userText: request.input.message,
    assistantMessageId: runtime.createId(),
    assistantText,
    riskLevel,
    memoryProposal: memoryProposalFromExplicitRequest(request.input.message),
    action: action ? {
      id: action.id, command: action.command, summary: action.summary,
      expiresAt: action.expiresAt, timezoneOffsetMinutes: action.timezoneOffsetMinutes
    } : undefined
  });
}

async function planChatResponse(options: {
  runtime: ServiceRuntime;
  model: CompanionModel;
  request: { spaceId: string; accountId: string; input: CompanionChatRequest };
  context: CompanionContext;
  riskLevel: CompanionRiskLevel;
  onDelta: (text: string) => void;
  onAction?: (action: CompanionAction) => void;
}): Promise<string | null> {
  const { runtime, model, request, context, riskLevel, onDelta, onAction } = options;
  if (!mayRequestAction(request.input.message) || !model.planAction) return null;
  const plan = await model.planAction({ context, userText: request.input.message });
  if (plan.decision === "propose_action" && plan.action) {
    const action = CompanionActionSchema.parse({
      id: runtime.createId(), command: plan.action, summary: plan.message, status: "pending",
      requestedBy: request.accountId,
      timezoneOffsetMinutes: request.input.timezoneOffsetMinutes,
      expiresAt: new Date(runtime.now().getTime() + 15 * 60_000).toISOString(), resultMessage: null
    });
    onDelta(plan.message);
    await exchangeInput(runtime, { request, assistantText: plan.message, riskLevel, action });
    onAction?.(action);
    return plan.message;
  }
  onDelta(plan.message);
  await exchangeInput(runtime, { request, assistantText: plan.message, riskLevel });
  return plan.message;
}

async function streamChatResponse(options: {
  runtime: ServiceRuntime;
  model: CompanionModel;
  modelSource: CompanionModelSource;
  request: { spaceId: string; accountId: string; input: CompanionChatRequest };
  context: CompanionContext;
  riskLevel: CompanionRiskLevel;
  onDelta: (text: string) => void;
}) {
  const { runtime, model, modelSource, request, context, riskLevel, onDelta } = options;
  let emitted = false;
  try {
    const assistantText = await model.streamChat({ context, userText: request.input.message }, (chunk) => {
      emitted = true;
      onDelta(chunk);
    });
    await exchangeInput(runtime, { request, assistantText, riskLevel });
    return assistantText;
  } catch (error) {
    logCompanionModelFailure(error, "chat", modelSource);
    if (emitted) throw new Error("陪伴回复中断");
    const fallback = "我暂时没接上话，但我还在这里。";
    onDelta(fallback);
    await exchangeInput(runtime, { request, assistantText: fallback, riskLevel });
    return fallback;
  }
}

async function chatService(runtime: ServiceRuntime, options: {
  request: { spaceId: string; accountId: string; input: CompanionChatRequest };
  onDelta: (text: string) => void;
  onAction?: (action: CompanionAction) => void;
}): Promise<string> {
  const { request, onDelta, onAction } = options;
  const input = CompanionChatRequestSchema.parse(request.input);
  const riskLevel = classifyRisk(input.message);
  if (riskLevel === "crisis") {
    const message = crisisSupportMessage();
    onDelta(message);
    await exchangeInput(runtime, { request: { ...request, input }, assistantText: message, riskLevel });
    return message;
  }
  const context = await runtime.buildContext({ spaceId: request.spaceId, accountId: request.accountId,
    now: runtime.now(), timezoneOffsetMinutes: input.timezoneOffsetMinutes });
  let resolved: Awaited<ReturnType<ServiceRuntime["resolveModel"]>>;
  try {
    resolved = await runtime.resolveModel(request.spaceId);
    const planned = await planChatResponse({ runtime, model: resolved.model, request: { ...request, input }, context,
      riskLevel, onDelta, onAction });
    if (planned) return planned;
  } catch (error) {
    logCompanionModelFailure(error, "chat", "unresolved");
    const fallback = "我暂时没接上话，但我还在这里。";
    onDelta(fallback);
    await exchangeInput(runtime, { request: { ...request, input }, assistantText: fallback, riskLevel });
    return fallback;
  }
  return streamChatResponse({ runtime, model: resolved.model, modelSource: resolved.source,
    request: { ...request, input }, context, riskLevel, onDelta });
}

async function confirmActionService(runtime: ServiceRuntime, options: {
  spaceId: string; accountId: string; actionId: string;
}) {
  const { spaceId, accountId, actionId } = options;
  const actions = runtime.repository.actions;
  if (!actions) throw new Error("动作服务未配置");
  const result = await actions.withLockedAction({ spaceId, accountId, actionId, run: async (client, action) => {
    if (["succeeded", "failed", "cancelled", "expired"].includes(action.status)) {
      return { action, message: action.resultMessage ?? "这个动作已经处理过了。", resources: [] };
    }
    if (new Date(action.expiresAt).getTime() <= runtime.now().getTime()) {
      const message = "这个动作已经过期，请重新告诉我想做什么。";
      await actions.updateStatus({ client, spaceId, actionId: action.id, status: "expired", resultMessage: message });
      return { action: { ...action, status: "expired", resultMessage: message }, message, resources: [] };
    }
    try {
      const execution = await executeCompanionAction({ client, spaceId, accountId, command: action.command,
        now: runtime.now(), timezoneOffsetMinutes: action.timezoneOffsetMinutes });
      await actions.updateStatus({ client, spaceId, actionId: action.id, status: "succeeded", resultMessage: execution.message });
      return { action: { ...action, status: "succeeded", resultMessage: execution.message }, ...execution };
    } catch (error) {
      const message = error instanceof Error ? error.message : "这个动作暂时没完成。";
      await actions.updateStatus({ client, spaceId, actionId: action.id, status: "failed", resultMessage: message });
      return { action: { ...action, status: "failed", resultMessage: message }, message, resources: [] };
    }
  }});
  return { ...result, resources: await refreshAdventureAfterAction(spaceId, result.resources) };
}

async function cancelActionService(runtime: ServiceRuntime, options: {
  spaceId: string; accountId: string; actionId: string;
}) {
  const { spaceId, accountId, actionId } = options;
  const actions = runtime.repository.actions;
  if (!actions) throw new Error("动作服务未配置");
  return actions.withLockedAction({ spaceId, accountId, actionId, run: async (client, action) => {
    if (action.status !== "pending") return { action, message: action.resultMessage ?? "这个动作已经处理过了。", resources: [] };
    const expired = new Date(action.expiresAt).getTime() <= runtime.now().getTime();
    const status = expired ? "expired" : "cancelled";
    const message = expired ? "这个动作已经过期，没有执行。" : "好的，我没有执行这个动作。";
    await actions.updateStatus({ client, spaceId, actionId: action.id, status, resultMessage: message });
    return { action: { ...action, status, resultMessage: message }, message, resources: [] };
  }});
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

  const runtime: ServiceRuntime = { repository, stateRepository, resolveModel, buildContext, createId, now };
  return {
    respond: (input: { spaceId: string; accountId: string; event: CompanionEvent }) => respondService(runtime, input),
    chat: (request: { spaceId: string; accountId: string; input: CompanionChatRequest },
      onDelta: (text: string) => void, onAction?: (action: CompanionAction) => void) =>
      chatService(runtime, { request, onDelta, onAction }),
    confirmAction: (spaceId: string, accountId: string, actionId: string) =>
      confirmActionService(runtime, { spaceId, accountId, actionId }),
    cancelAction: (spaceId: string, accountId: string, actionId: string) =>
      cancelActionService(runtime, { spaceId, accountId, actionId }),

    ...createCompanionStateOperations({ repository, stateRepository })
  };
}
export type CompanionService = ReturnType<typeof createCompanionService>;
