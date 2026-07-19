import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { type as typeScale, radius } from "./theme";
import { useTheme } from "./ThemeContext";
import { useReducedMotion } from "./useReducedMotion";

/** 明显停留约 3.6s，避免「只跳一下」。 */
const HOLD_MS = 3600;
const EXIT_MS = 450;
const COUNT_MS = 900;

/**
 * 积分卡上的「+N」反馈：大号胶囊、长停留、上浮淡出。
 * 默认 opacity=1，保证一出现就能看见。
 */
export function XpGainLabel({
  amount,
  playKey,
  onFinish
}: {
  amount: number;
  playKey: number;
  onFinish?: () => void;
}) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const translateY = useSharedValue(0);
  const scale = useSharedValue(1);
  const finishRef = useRef(onFinish);

  useEffect(() => {
    finishRef.current = onFinish;
  }, [onFinish]);

  useEffect(() => {
    if (amount <= 0) {
      return;
    }

    let exitTimer: ReturnType<typeof setTimeout> | undefined;
    let doneTimer: ReturnType<typeof setTimeout> | undefined;

    opacity.value = 1;
    translateY.value = 0;
    scale.value = 1;

    if (!reducedMotion) {
      translateY.value = 10;
      scale.value = 0.82;
      translateY.value = withSpring(0, { damping: 11, stiffness: 180 });
      scale.value = withSequence(
        withSpring(1.12, { damping: 9, stiffness: 220 }),
        withSpring(1, { damping: 12, stiffness: 200 })
      );
    }

    exitTimer = setTimeout(() => {
      if (reducedMotion) {
        return;
      }
      opacity.value = withTiming(0, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) });
      translateY.value = withTiming(-16, { duration: EXIT_MS, easing: Easing.in(Easing.cubic) });
    }, HOLD_MS);

    doneTimer = setTimeout(() => {
      finishRef.current?.();
    }, HOLD_MS + (reducedMotion ? 0 : EXIT_MS) + 60);

    return () => {
      if (exitTimer) {
        clearTimeout(exitTimer);
      }
      if (doneTimer) {
        clearTimeout(doneTimer);
      }
    };
  }, [amount, opacity, playKey, reducedMotion, scale, translateY]);

  const labelStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }, { scale: scale.value }]
  }));

  if (amount <= 0) {
    return null;
  }

  return (
    <View style={styles.slot} pointerEvents="none">
      <Animated.View
        style={[
          styles.chip,
          {
            backgroundColor: colors.successSurface,
            borderColor: colors.success
          },
          labelStyle
        ]}
      >
        <Text
          style={{
            color: colors.success,
            fontSize: typeScale.bodyStrong.fontSize,
            lineHeight: typeScale.bodyStrong.lineHeight,
            fontWeight: "800",
            letterSpacing: 0.2
          }}
        >
          +{amount}
        </Text>
      </Animated.View>
    </View>
  );
}

/**
 * 余额数字滚动上涨（而不是瞬间跳变），让「加分」过程可见。
 */
export function BalanceCountText({
  balance,
  toneColor,
  suffix = " 积分"
}: {
  balance: number;
  toneColor: string;
  suffix?: string;
}) {
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(balance);
  const prevRef = useRef(balance);
  const frameRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);
  const scale = useSharedValue(1);

  useEffect(() => {
    const from = prevRef.current;
    const to = balance;
    prevRef.current = to;

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (to === from) {
      setDisplay(to);
      return;
    }

    // 减少分时不滚动，直接落到新值
    if (to < from || reducedMotion) {
      setDisplay(to);
      return;
    }

    scale.value = withSequence(
      withTiming(1.08, { duration: 160, easing: Easing.out(Easing.cubic) }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );

    const startedAt = Date.now();
    const delta = to - from;

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const t = Math.min(1, elapsed / COUNT_MS);
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(from + delta * eased));
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        frameRef.current = null;
        setDisplay(to);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [balance, reducedMotion, scale]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }]
  }));

  return (
    <Animated.View style={pulseStyle}>
      <Text
        style={{
          color: toneColor,
          fontSize: typeScale.bodyStrong.fontSize,
          lineHeight: typeScale.bodyStrong.lineHeight,
          fontWeight: typeScale.bodyStrong.fontWeight
        }}
      >
        {display}
        {suffix}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  slot: {
    minWidth: 56,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center"
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1.5
  }
});
