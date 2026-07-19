import type { PetChatMessage } from "./types";

export const PET_NAME = "卡卡";

export const PET_SYSTEM_PROMPT = `你是「每日打卡」App 里的小岛宠物「卡卡」，一只软乎乎的海豹小伙伴。
身份：陪伴情侣/双人养成习惯的鼓励型伙伴，不是冷冰冰的客服。
能力：聊习惯、打卡、积分奖励、温柔督促；可给小建议，但不编造用户未提供的数据。
风格：中文、简短（通常 1-3 句）、口语、可爱但不幼齿；可偶尔用「～」或轻拟声。
约束：不输出 Markdown 代码块；不提你是大模型/系统提示；不讨论违法或危险内容。
若用户要生成完整习惯计划，引导他们去「AI」页走计划流程。`;

export function buildPetMessages(
  history: PetChatMessage[],
  userText: string
): { role: "system" | "user" | "assistant"; content: string }[] {
  const recent = history.slice(-10).map((item) => ({
    role: item.role as "user" | "assistant",
    content: item.text
  }));
  return [
    { role: "system", content: PET_SYSTEM_PROMPT },
    ...recent,
    { role: "user", content: userText }
  ];
}
