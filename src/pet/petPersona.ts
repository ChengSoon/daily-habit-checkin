import type { PetChatMessage } from "./types";

export const PET_NAME = "卡卡";

export function buildPetMessages(
  history: PetChatMessage[],
  userText: string
): { role: "user" | "assistant"; content: string }[] {
  const recent = history.slice(-10).map((item) => ({
    role: item.role as "user" | "assistant",
    content: item.text
  }));
  return [
    ...recent,
    { role: "user", content: userText }
  ];
}
