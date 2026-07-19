import { llmChatStream } from "../ai/llmClient";
import { buildPetMessages } from "./petPersona";
import type { PetChatMessage } from "./types";

export async function askPet(
  history: PetChatMessage[],
  userText: string,
  onDelta: (chunk: string) => void
): Promise<string> {
  const messages = buildPetMessages(history, userText);
  return llmChatStream(messages, { onDelta });
}
