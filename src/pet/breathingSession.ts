export type BreathingPhase = "inhale" | "hold" | "exhale";

export const BREATHING_PHASES: readonly {
  phase: BreathingPhase;
  durationMs: number;
  label: string;
  cue: string;
}[] = [
  { phase: "inhale", durationMs: 4000, label: "吸气", cue: "慢慢吸气" },
  { phase: "hold", durationMs: 2000, label: "停留", cue: "轻轻停住" },
  { phase: "exhale", durationMs: 6000, label: "呼气", cue: "缓缓呼气" }
] as const;

export const BREATHING_CYCLE_MS = BREATHING_PHASES.reduce(
  (total, item) => total + item.durationMs,
  0
);
export const BREATHING_SESSION_MS = BREATHING_CYCLE_MS * 3;

export type BreathingFrame = {
  phase: BreathingPhase;
  label: string;
  cue: string;
  secondsRemaining: number;
  phaseProgress: number;
  cycle: number;
};

export function breathingFrameAt(elapsedMs: number): BreathingFrame {
  const safeElapsed = Math.max(0, elapsedMs);
  const cycle = Math.floor(safeElapsed / BREATHING_CYCLE_MS) + 1;
  let cycleElapsed = safeElapsed % BREATHING_CYCLE_MS;

  for (const item of BREATHING_PHASES) {
    if (cycleElapsed < item.durationMs) {
      return {
        phase: item.phase,
        label: item.label,
        cue: item.cue,
        secondsRemaining: Math.ceil((item.durationMs - cycleElapsed) / 1000),
        phaseProgress: cycleElapsed / item.durationMs,
        cycle
      };
    }
    cycleElapsed -= item.durationMs;
  }

  return { ...breathingFrameAt(0), cycle };
}
