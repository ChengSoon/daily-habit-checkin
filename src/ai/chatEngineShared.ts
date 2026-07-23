import { createId } from "../utils/id";
import { ChatEngineEffect, ChatFlow, ChatMessage, QuickReply } from "./chatTypes";

export type ChatEngineState = {
  messages: ChatMessage[];
  flow: ChatFlow;
};

export type ChatEngineResult = {
  state: ChatEngineState;
  effects: ChatEngineEffect[];
};

export const HOME_REPLIES: QuickReply[] = [
  { id: "plan", label: "生成习惯计划", value: "plan" },
  { id: "adjust", label: "调整现有习惯", value: "adjust" },
  { id: "reset", label: "重新开始", value: "reset" }
];

export function msg(
  role: "assistant" | "user",
  text: string,
  extras?: Partial<Pick<ChatMessage, "quickReplies" | "planCard" | "suggestionCard">>
): ChatMessage {
  return { id: createId("msg"), role, text, createdAt: Date.now(), ...extras };
}

export function append(state: ChatEngineState, ...messages: ChatMessage[]): ChatEngineState {
  return { ...state, messages: [...state.messages, ...messages] };
}

export function withFlow(state: ChatEngineState, flow: ChatFlow): ChatEngineState {
  return { ...state, flow };
}

export function homeAssistant(text?: string): ChatMessage {
  return msg(
    "assistant",
    text ?? "你好，我是小岛 AI 助手。\n已接入你在「我的」里配置的真实模型。可以自由提问，或点下方快捷项生成计划 / 调整习惯。",
    { quickReplies: HOME_REPLIES }
  );
}
