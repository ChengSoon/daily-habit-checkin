import type { PetCheckInEvent, PetMood } from "./types";

/** 打卡事件 → 情绪 + 短气泡文案（本地规则，不调模型）。 */
export function reactionForCheckIn(event: PetCheckInEvent): { mood: PetMood; bubble: string } {
  if (event.milestoneDays) {
    return {
      mood: "happy",
      bubble: `哇！「${event.habitName}」连续 ${event.milestoneDays} 天了，太厉害啦！`
    };
  }
  if (event.allDone) {
    return { mood: "happy", bubble: "今日全勤！小岛为你撒花～" };
  }
  if (event.streak >= 3) {
    return {
      mood: "happy",
      bubble: `「${event.habitName}」打卡成功，已连续 ${event.streak} 天！`
    };
  }
  return { mood: "happy", bubble: `「${event.habitName}」打卡完成，给你点赞！` };
}

export function reactionForError(message: string): { mood: PetMood; bubble: string } {
  const short = message.trim().slice(0, 48) || "出了点小状况";
  return { mood: "sad", bubble: short };
}

export function greetingBubble(hour: number = new Date().getHours()): string {
  if (hour < 11) return "早上好，今天也轻轻推一把小习惯吧。";
  if (hour < 18) return "下午好，需要我帮你看看今日进度吗？";
  return "晚上好，收工前再完成一件小事也很好。";
}
