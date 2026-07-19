/** 与 Codex 桌宠类似的情绪态，驱动动画与气泡。 */
export type PetMood = "idle" | "happy" | "thinking" | "waiting" | "sad" | "wave";

export type PetAnimationState =
  | "idle"
  | "running-right"
  | "running-left"
  | "waving"
  | "jumping"
  | "failed"
  | "waiting"
  | "running"
  | "review";

export type PetTravelState = Extract<PetAnimationState, "running-left" | "running-right">;

export type PetCheckInEvent = {
  habitName: string;
  streak: number;
  allDone?: boolean;
  milestoneDays?: number | null;
};

export type PetChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  createdAt: number;
};
