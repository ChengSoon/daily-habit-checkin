import { useEffect } from "react";
import { AppState } from "react-native";

const BACKGROUND_STOP_DELAY_MS = 1800;

/** 仅在确认进入后台后结束语音；过滤 Android 权限/录音启动时短暂误报的 background。 */
export function useStopVoiceOnBackground(stop: () => void, isActive: () => boolean) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      if (nextState !== "background") return;
      timer = setTimeout(() => {
        if (AppState.currentState === "background" && isActive()) stop();
      }, BACKGROUND_STOP_DELAY_MS);
    });
    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [isActive, stop]);
}
