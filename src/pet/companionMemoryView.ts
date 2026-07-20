import type { CompanionMessage } from "./companionTypes";

export type MemoryAction = "confirm" | "confirmed";

export function memoryActionForMessage(message: CompanionMessage): MemoryAction | null {
  if (!message.memoryProposal) return null;
  return message.memoryConfirmed ? "confirmed" : "confirm";
}
