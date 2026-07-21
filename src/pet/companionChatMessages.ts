import type { CompanionMessage, CompanionReply } from "./companionTypes";

export const CHAT_FAILURE_MESSAGE = "我暂时没接上话，但我还在这里。";

export function assistantMessage(
  id: string,
  content: string,
  riskLevel: CompanionMessage["riskLevel"]
): CompanionMessage {
  return {
    id,
    role: "assistant",
    content,
    senderAccountId: null,
    senderName: null,
    riskLevel,
    memoryProposal: null,
    memoryConfirmed: false,
    createdAt: new Date().toISOString()
  };
}

export function userMessage(
  id: string,
  content: string,
  sender: { id: string; displayName: string }
): CompanionMessage {
  return {
    id,
    role: "user",
    content,
    senderAccountId: sender.id,
    senderName: sender.displayName,
    riskLevel: "normal",
    memoryProposal: null,
    memoryConfirmed: false,
    createdAt: new Date().toISOString()
  };
}

export function replyMood(reply: CompanionReply) {
  return reply.mood;
}
