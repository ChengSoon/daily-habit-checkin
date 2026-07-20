import type { CompanionMessage } from "./companionTypes";

export type CompanionEngineState = {
  spaceId: string | null;
  messages: CompanionMessage[];
  loading: boolean;
  busy: boolean;
  requestId: string | null;
  streamText: string;
  errorMessage: string | null;
};

export const initialCompanionEngineState: CompanionEngineState = {
  spaceId: null,
  messages: [],
  loading: false,
  busy: false,
  requestId: null,
  streamText: "",
  errorMessage: null
};

type Action =
  | { type: "space_changed"; spaceId: string | null }
  | { type: "conversation_cleared"; spaceId: string }
  | { type: "load_started"; spaceId: string }
  | { type: "load_succeeded"; spaceId: string; messages: CompanionMessage[] }
  | { type: "load_failed"; spaceId: string }
  | { type: "chat_started"; requestId: string; message: CompanionMessage }
  | { type: "chat_delta"; requestId: string; delta: string }
  | { type: "chat_succeeded"; requestId: string; message: CompanionMessage }
  | { type: "chat_failed"; requestId: string; message: CompanionMessage };

function mergeMessages(
  current: CompanionMessage[],
  incoming: CompanionMessage[]
): CompanionMessage[] {
  const byId = new Map(current.map((message) => [message.id, message]));
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

export function canStartChat(state: CompanionEngineState): boolean {
  return !!state.spaceId && !state.busy;
}

export function shouldReloadCompanion(event: { resource: string }): boolean {
  return event.resource === "companion";
}

export function companionEngineReducer(
  state: CompanionEngineState,
  action: Action
): CompanionEngineState {
  switch (action.type) {
    case "space_changed":
      if (state.spaceId === action.spaceId) return state;
      return { ...initialCompanionEngineState, spaceId: action.spaceId };
    case "conversation_cleared":
      return state.spaceId === action.spaceId
        ? { ...initialCompanionEngineState, spaceId: action.spaceId }
        : state;
    case "load_started":
      return state.spaceId === action.spaceId ? { ...state, loading: true } : state;
    case "load_succeeded":
      return state.spaceId === action.spaceId
        ? { ...state, loading: false, messages: mergeMessages([], action.messages), errorMessage: null }
        : state;
    case "load_failed":
      return state.spaceId === action.spaceId
        ? { ...state, loading: false, errorMessage: "共同对话暂时加载失败" }
        : state;
    case "chat_started":
      if (!canStartChat(state)) return state;
      return {
        ...state,
        busy: true,
        requestId: action.requestId,
        streamText: "",
        errorMessage: null,
        messages: mergeMessages(state.messages, [action.message])
      };
    case "chat_delta":
      return state.requestId === action.requestId
        ? { ...state, streamText: `${state.streamText}${action.delta}` }
        : state;
    case "chat_succeeded":
      return state.requestId === action.requestId
        ? {
            ...state,
            busy: false,
            requestId: null,
            streamText: "",
            messages: mergeMessages(state.messages, [action.message])
          }
        : state;
    case "chat_failed":
      return state.requestId === action.requestId
        ? {
            ...state,
            busy: false,
            requestId: null,
            streamText: "",
            errorMessage: "卡卡暂时没接上话",
            messages: mergeMessages(state.messages, [action.message])
          }
        : state;
  }
}
