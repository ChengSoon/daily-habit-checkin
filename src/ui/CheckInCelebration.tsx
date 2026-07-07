import { useEffect } from "react";
import { Modal, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { AppText } from "./Controls";
import { radius, spacing } from "./theme";
import { useTheme } from "./ThemeContext";

/**
 * 庆祝分级：
 * - 普通打卡 → MiniCheckInBurst：非阻断的轻量「盖章」，可以继续操作页面
 * - 今日全勤 / 连续里程碑 → CheckInCelebration：全屏仪式感
 */
export type FullCelebration =
  | { kind: "allDone" }
  | { kind: "milestone"; days: number; habitName: string };

const ORBIT_DOTS = [
  { angle: -0.2, distance: 118, size: 9, delay: 0 },
  { angle: 0.8, distance: 142, size: 6, delay: 0.1 },
  { angle: 1.9, distance: 126, size: 10, delay: 0.18 },
  { angle: 2.8, distance: 154, size: 7, delay: 0.04 },
  { angle: 3.7, distance: 112, size: 8, delay: 0.14 },
  { angle: 4.9, distance: 148, size: 6, delay: 0.22 }
] as const;

const SPARKS = Array.from({ length: 18 }, (_, index) => ({
  angle: (index / 18) * Math.PI * 2,
  distance: 116 + (index % 4) * 18,
  length: 18 + (index % 3) * 8
}));

// 轻量版的迸发线条：数量更少、距离更短，配合小盖章的体量
const MINI_SPARKS = Array.from({ length: 10 }, (_, index) => ({
  angle: (index / 10) * Math.PI * 2 - Math.PI / 2,
  distance: 64 + (index % 3) * 14,
  length: 12 + (index % 3) * 5
}));

function Halo({ progress, size, delay }: { progress: SharedValue<number>; size: number; delay: number }) {
  const { colors } = useTheme();
  const haloStyle = useAnimatedStyle(() => {
    const p = Math.max(0, progress.value - delay) / (1 - delay);
    return {
      opacity: interpolate(p, [0, 0.18, 1], [0, 0.38, 0]),
      transform: [{ scale: interpolate(p, [0, 1], [0.5, 1.75]) }]
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.halo,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: colors.onPrimary
        },
        haloStyle
      ]}
    />
  );
}

function OrbitDot({
  progress,
  dot,
  color
}: {
  progress: SharedValue<number>;
  dot: (typeof ORBIT_DOTS)[number];
  color: string;
}) {
  const dotStyle = useAnimatedStyle(() => {
    const p = Math.max(0, progress.value - dot.delay) / (1 - dot.delay);
    const spin = interpolate(p, [0, 1], [0, Math.PI * 1.2]);
    const travel = interpolate(p, [0, 0.3, 1], [20, dot.distance, dot.distance * 1.08]);

    return {
      opacity: interpolate(p, [0, 0.12, 0.75, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: Math.cos(dot.angle + spin) * travel },
        { translateY: Math.sin(dot.angle + spin) * travel },
        { scale: interpolate(p, [0, 0.18, 1], [0.2, 1, 0.65]) }
      ]
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.orbitDot,
        {
          width: dot.size,
          height: dot.size,
          borderRadius: dot.size / 2,
          backgroundColor: color
        },
        dotStyle
      ]}
    />
  );
}

function Spark({
  progress,
  spark,
  color,
  height = 3
}: {
  progress: SharedValue<number>;
  spark: { angle: number; distance: number; length: number };
  color: string;
  height?: number;
}) {
  const sparkStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const travel = interpolate(p, [0, 0.42, 1], [24, spark.distance, spark.distance * 1.18]);
    return {
      opacity: interpolate(p, [0, 0.16, 0.55, 1], [0, 0.9, 0.9, 0]),
      transform: [
        { translateX: Math.cos(spark.angle) * travel },
        { translateY: Math.sin(spark.angle) * travel },
        { rotate: `${spark.angle}rad` },
        { scaleX: interpolate(p, [0, 0.22, 1], [0.2, 1, 0.35]) }
      ]
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.spark,
        { width: spark.length, height, backgroundColor: color },
        sparkStyle
      ]}
    />
  );
}

/**
 * 普通打卡的轻量庆祝：一枚小盖章从底部弹起、微微歪斜地「敲」在屏幕上，
 * 伴随一圈短促的迸发与光环，随后上浮消散。全程不拦截触摸，用户可以连续打卡。
 * trigger.key 变化即重播（连续打多个习惯时可连续触发）。
 */
export function MiniCheckInBurst({
  trigger,
  onFinish
}: {
  trigger: { key: number; habitName: string } | null;
  onFinish: () => void;
}) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const stamp = useSharedValue(0);
  const exit = useSharedValue(0);
  const triggerKey = trigger?.key;

  useEffect(() => {
    if (triggerKey === undefined) {
      return;
    }

    progress.value = 0;
    stamp.value = 0;
    exit.value = 0;
    progress.value = withTiming(1, { duration: 760, easing: Easing.out(Easing.cubic) });
    stamp.value = withSpring(1, { damping: 9, stiffness: 190 });
    exit.value = withDelay(980, withTiming(1, { duration: 260 }, (finished) => {
      if (finished) {
        runOnJS(onFinish)();
      }
    }));
  }, [exit, onFinish, progress, stamp, triggerKey]);

  const stampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(stamp.value, [0, 0.2, 1], [0, 1, 1]) * interpolate(exit.value, [0, 1], [1, 0]),
    transform: [
      { translateY: interpolate(stamp.value, [0, 1], [26, 0]) + interpolate(exit.value, [0, 1], [0, -20]) },
      { scale: interpolate(stamp.value, [0, 0.7, 1], [0.55, 1.07, 1]) },
      { rotate: `${interpolate(stamp.value, [0, 1], [-14, -4])}deg` }
    ]
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.15, 1], [0, 0.5, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.5, 1.9]) }]
  }));

  if (!trigger) {
    return null;
  }

  return (
    <View pointerEvents="none" style={styles.miniStage}>
      <View style={styles.miniCenter}>
        <Animated.View
          pointerEvents="none"
          style={[styles.miniRing, { borderColor: colors.primary }, ringStyle]}
        />
        {MINI_SPARKS.map((spark, index) => (
          <Spark
            key={index}
            progress={progress}
            spark={spark}
            height={2.5}
            color={index % 3 === 0 ? colors.celebration : index % 3 === 1 ? colors.primary : colors.partner}
          />
        ))}
        <Animated.View
          style={[
            styles.miniStamp,
            { borderColor: colors.celebration, backgroundColor: colors.surface },
            stampStyle
          ]}
        >
          <AppText variant="caption" tone="primary" style={styles.kicker}>
            打卡成功
          </AppText>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.miniHabitName}>
            {trigger.habitName} +1
          </AppText>
        </Animated.View>
      </View>
    </View>
  );
}

export function CheckInCelebration({
  celebration,
  onFinish
}: {
  celebration: FullCelebration | null;
  onFinish: () => void;
}) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  const stamp = useSharedValue(0);
  const exit = useSharedValue(0);
  const visible = celebration !== null;

  useEffect(() => {
    if (!visible) {
      return;
    }

    progress.value = 0;
    stamp.value = 0;
    exit.value = 0;
    progress.value = withTiming(1, { duration: 1350, easing: Easing.out(Easing.cubic) });
    stamp.value = withDelay(140, withSpring(1, { damping: 8, stiffness: 120 }));
    exit.value = withDelay(1650, withTiming(1, { duration: 320 }, (finished) => {
      if (finished) {
        runOnJS(onFinish)();
      }
    }));
  }, [exit, onFinish, progress, stamp, visible]);

  const stageStyle = useAnimatedStyle(() => ({
    opacity: interpolate(exit.value, [0, 1], [1, 0]),
    transform: [{ scale: interpolate(exit.value, [0, 1], [1, 1.04]) }]
  }));
  const poolStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3, 1], [0, 0.5, 0.26]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.72, 1.35]) }]
  }));
  const stampStyle = useAnimatedStyle(() => ({
    opacity: interpolate(stamp.value, [0, 0.25, 1], [0, 1, 1]),
    transform: [
      { translateY: interpolate(stamp.value, [0, 1], [42, 0]) },
      { scale: interpolate(stamp.value, [0, 0.75, 1], [0.54, 1.08, 1]) },
      { rotate: `${interpolate(stamp.value, [0, 1], [-18, -5])}deg` }
    ]
  }));

  const kicker = celebration?.kind === "milestone" ? "连续坚持里程碑" : "今日全勤达成";
  const headline = celebration?.kind === "milestone" ? `${celebration.days} 天` : "全部完成";
  const subline =
    celebration?.kind === "milestone" ? celebration.habitName : "今天的坚持，一件不落";
  const accessibilityText =
    celebration?.kind === "milestone"
      ? `${celebration.habitName} 连续打卡 ${celebration.days} 天`
      : "今天的习惯全部完成";

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onFinish}>
      <Animated.View
        accessible
        accessibilityLabel={accessibilityText}
        accessibilityRole="alert"
        style={[styles.stage, { backgroundColor: colors.overlay }, stageStyle]}
      >
        <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.primaryInk, opacity: 0.9 }]} />
        <Animated.View style={[styles.colorPool, { backgroundColor: colors.accent }, poolStyle]} />
        <Animated.View style={[styles.colorPoolAlt, { backgroundColor: colors.celebration }, poolStyle]} />

        <View style={styles.center}>
          <Halo progress={progress} size={210} delay={0} />
          <Halo progress={progress} size={310} delay={0.14} />
          {SPARKS.map((spark, index) => (
            <Spark key={index} progress={progress} spark={spark} color={index % 2 === 0 ? colors.celebration : colors.onPrimary} />
          ))}
          {ORBIT_DOTS.map((dot, index) => (
            <OrbitDot key={index} progress={progress} dot={dot} color={index % 2 === 0 ? colors.accent : colors.celebration} />
          ))}

          <Animated.View style={[styles.stamp, { borderColor: colors.celebration, backgroundColor: colors.surface }, stampStyle]}>
            <AppText variant="caption" tone="primary" style={styles.kicker}>
              {kicker}
            </AppText>
            <AppText variant="display" tone="primary" style={styles.doneText}>
              {headline}
            </AppText>
            <AppText variant="bodyStrong" tone="soft" numberOfLines={1} style={styles.habitName}>
              {subline}
            </AppText>
          </Animated.View>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  center: {
    width: 1,
    height: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  miniStage: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    // 落在首屏列表上沿附近，靠近用户刚点过的区域又不挡住后续操作
    paddingTop: 170,
    zIndex: 10
  },
  miniCenter: {
    width: 1,
    height: 1,
    alignItems: "center",
    justifyContent: "center"
  },
  miniRing: {
    position: "absolute",
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2
  },
  miniStamp: {
    minWidth: 150,
    maxWidth: 240,
    alignItems: "center",
    borderWidth: 2.5,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 18,
    elevation: 8
  },
  miniHabitName: {
    marginTop: 2,
    maxWidth: 200,
    textAlign: "center"
  },
  colorPool: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 210,
    left: -90,
    top: -80
  },
  colorPoolAlt: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    right: -90,
    bottom: -60
  },
  halo: {
    position: "absolute",
    borderWidth: 2
  },
  orbitDot: {
    position: "absolute"
  },
  spark: {
    position: "absolute",
    height: 3,
    borderRadius: 99
  },
  stamp: {
    width: 238,
    minHeight: 150,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.28,
    shadowRadius: 28,
    elevation: 12
  },
  kicker: {
    letterSpacing: 1.4
  },
  doneText: {
    lineHeight: 46,
    marginTop: spacing.xs
  },
  habitName: {
    marginTop: spacing.sm,
    maxWidth: 188,
    textAlign: "center"
  }
});
