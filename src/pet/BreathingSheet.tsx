import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton, AppText } from "../ui/Controls";
import { useTheme } from "../ui/ThemeContext";
import { useReducedMotion } from "../ui/useReducedMotion";
import {
  BREATHING_PHASES,
  BREATHING_SESSION_MS,
  breathingFrameAt
} from "./breathingSession";
import { PetSprite } from "./PetSprite";

export function BreathingSheet({
  visible,
  onClose,
  onComplete
}: {
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [elapsedMs, setElapsedMs] = useState(0);
  const [running, setRunning] = useState(true);
  const [completed, setCompleted] = useState(false);
  const anchor = useRef({ elapsedMs: 0, startedAt: 0 });
  const elapsedRef = useRef(0);
  const completionSent = useRef(false);
  const [orbScale] = useState(() => new Animated.Value(0.72));
  const frame = breathingFrameAt(elapsedMs);

  useEffect(() => {
    if (!visible || !running || completed) return;
    anchor.current = { elapsedMs: elapsedRef.current, startedAt: Date.now() };
    const timer = setInterval(() => {
      const next = anchor.current.elapsedMs + Date.now() - anchor.current.startedAt;
      const bounded = Math.min(next, BREATHING_SESSION_MS);
      elapsedRef.current = bounded;
      setElapsedMs(bounded);
      if (bounded < BREATHING_SESSION_MS || completionSent.current) return;
      completionSent.current = true;
      setCompleted(true);
      setRunning(false);
      onComplete();
    }, 100);
    return () => clearInterval(timer);
  }, [completed, onComplete, running, visible]);

  useEffect(() => {
    if (!visible || completed || reducedMotion) return;
    const phase = BREATHING_PHASES.find((item) => item.phase === frame.phase);
    Animated.timing(orbScale, {
      toValue: frame.phase === "exhale" ? 0.72 : 1,
      duration: phase?.durationMs ?? 500,
      easing: Easing.inOut(Easing.sin),
      useNativeDriver: true
    }).start();
  }, [completed, frame.phase, orbScale, reducedMotion, visible]);

  function toggleRunning() {
    if (running) {
      const next = anchor.current.elapsedMs + Date.now() - anchor.current.startedAt;
      const bounded = Math.min(next, BREATHING_SESSION_MS);
      elapsedRef.current = bounded;
      setElapsedMs(bounded);
      setRunning(false);
      return;
    }
    setRunning(true);
  }

  function restart() {
    anchor.current = { elapsedMs: 0, startedAt: Date.now() };
    elapsedRef.current = 0;
    completionSent.current = false;
    setElapsedMs(0);
    setCompleted(false);
    setRunning(true);
    orbScale.setValue(0.72);
  }

  const progress = Math.min(1, elapsedMs / BREATHING_SESSION_MS);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable style={{ flex: 1, backgroundColor: colors.overlay }} onPress={onClose} />
        <View
          style={{
            width: "100%",
            maxWidth: 560,
            alignSelf: "center",
            alignItems: "center",
            backgroundColor: colors.surface,
            borderTopLeftRadius: 18,
            borderTopRightRadius: 18,
            borderWidth: 1,
            borderBottomWidth: 0,
            borderColor: colors.line,
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: Math.max(insets.bottom, 16),
            gap: 14
          }}
        >
          <View style={{ width: "100%", flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 32 }} />
            <View style={{ flex: 1, alignItems: "center" }}>
              <AppText variant="section">和卡卡一起呼吸</AppText>
              <AppText variant="caption" tone="muted">3 轮 · 36 秒</AppText>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel="结束呼吸练习"
              style={{ width: 32, height: 32, alignItems: "center", justifyContent: "center" }}
            >
              <Ionicons name="close" size={22} color={colors.muted} />
            </Pressable>
          </View>

          <View style={{ height: 210, alignItems: "center", justifyContent: "center" }}>
            <Animated.View
              style={{
                width: 176,
                height: 176,
                borderRadius: 88,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.successSurface,
                borderWidth: 2,
                borderColor: colors.success,
                transform: [{ scale: reducedMotion ? 0.86 : orbScale }]
              }}
            >
              <PetSprite
                mood={completed ? "happy" : running ? "waiting" : "idle"}
                size={72}
              />
            </Animated.View>
          </View>

          <View style={{ alignItems: "center", minHeight: 70 }} accessibilityLiveRegion="polite">
            <AppText variant="title">{completed ? "完成啦" : frame.label}</AppText>
            <AppText tone="muted">
              {completed ? "把这份轻松带回今天" : running ? frame.cue : "停在这里，准备好再继续"}
            </AppText>
            {!completed ? (
              <AppText variant="caption" tone="primary" style={{ marginTop: 4 }}>
                {frame.secondsRemaining}
              </AppText>
            ) : null}
          </View>

          <View
            style={{
              width: "100%",
              height: 6,
              borderRadius: 3,
              overflow: "hidden",
              backgroundColor: colors.surfaceMuted
            }}
          >
            <View
              style={{
                width: `${progress * 100}%`,
                height: "100%",
                backgroundColor: colors.success
              }}
            />
          </View>

          {completed ? (
            <View style={{ width: "100%", flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <AppButton title="再来一轮" variant="secondary" fullWidth onPress={restart} />
              </View>
              <View style={{ flex: 1 }}>
                <AppButton title="完成" icon="checkmark" fullWidth onPress={onClose} />
              </View>
            </View>
          ) : (
            <AppButton
              title={running ? "暂停" : "继续"}
              icon={running ? "pause" : "play"}
              variant="secondary"
              fullWidth
              onPress={toggleRunning}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
