import type { CompanionEvent, CompanionReply } from "./companionTypes";

export function fallbackForEvent(event: CompanionEvent): CompanionReply {
  const message =
    event.type === "all_done"
      ? "今天的小目标都完成了，辛苦啦。"
      : event.type === "checkin_completed"
        ? "这一步已经稳稳落下啦。"
        : event.type === "mood_checkin"
          ? "我在这里，你可以慢慢说。"
          : "我在这里陪你，先做当下最轻的一步就好。";
  return {
    version: 1,
    eventId: event.id,
    decision: "speak",
    message,
    mood: event.type === "mood_checkin" ? "waiting" : "wave",
    intent: event.type === "mood_checkin" ? "listen" : "encourage",
    riskLevel: "normal"
  };
}
