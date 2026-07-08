/* eslint-disable react-hooks/immutability -- Reanimated shared values are intentionally updated from event handlers. */
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable } from "react-native";
import Animated, {
  interpolate,
  runOnJS,
  SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { AppText } from "./Controls";
import { getCheckButtonPressAction } from "./checkButtonPress";
import { useTheme } from "./ThemeContext";

const SIZE = 30;
const PARTICLE_COUNT = 6;
// 触发数据刷新前留给迸发动画的展示时间
const COMMIT_DELAY = 260;

type Particle = {
  angle: number;
  distance: number;
  size: number;
  colorKey: "primary" | "success" | "primaryInk";
};

function buildParticles(): Particle[] {
  const colorKeys: Particle["colorKey"][] = ["primary", "success", "primaryInk"];
  return Array.from({ length: PARTICLE_COUNT }, (_, index) => {
    // 均匀铺开一圈，再加一点随机偏移，迸发方向不会太规整
    const base = (index / PARTICLE_COUNT) * Math.PI * 2;
    return {
      angle: base + (Math.random() - 0.5) * 0.6,
      distance: 22 + Math.random() * 12,
      size: 4 + Math.random() * 3,
      colorKey: colorKeys[index % colorKeys.length]
    };
  });
}

function BurstParticle({ particle, progress, color }: { particle: Particle; progress: SharedValue<number>; color: string }) {
  const style = useAnimatedStyle(() => {
    const p = progress.value;
    const travel = particle.distance * interpolate(p, [0, 1], [0, 1]);
    return {
      transform: [
        { translateX: Math.cos(particle.angle) * travel },
        { translateY: Math.sin(particle.angle) * travel },
        { scale: interpolate(p, [0, 0.25, 1], [0, 1, 0]) }
      ],
      opacity: interpolate(p, [0, 0.15, 0.7, 1], [0, 1, 1, 0])
    };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          width: particle.size,
          height: particle.size,
          borderRadius: particle.size / 2,
          backgroundColor: color
        },
        style
      ]}
    />
  );
}

export function CheckButton({
  checked,
  disabled,
  accessibilityLabel,
  onComplete,
  onUndo,
  onCelebrate,
  optimistic = true,
  canUndo = false
}: {
  checked: boolean;
  disabled: boolean;
  accessibilityLabel: string;
  onComplete: () => void;
  onUndo?: () => void;
  onCelebrate?: () => void;
  // 数值型习惯点击后要弹输入框，不应立即显示"已完成"，此时传 false
  optimistic?: boolean;
  canUndo?: boolean;
}) {
  const { colors } = useTheme();
  const particles = useMemo(() => buildParticles(), []);
  const [justChecked, setJustChecked] = useState(false);
  const wasChecked = useRef(checked);
  const effectiveChecked = checked || justChecked;

  const circleScale = useSharedValue(1);
  const checkAnim = useSharedValue(checked ? 1 : 0);
  const burst = useSharedValue(0);
  const ripple = useSharedValue(0);

  const circleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: circleScale.value }]
  }));

  const checkStyle = useAnimatedStyle(() => ({
    opacity: checkAnim.value,
    transform: [
      { scale: checkAnim.value },
      { rotate: `${interpolate(checkAnim.value, [0, 1], [-110, 0])}deg` }
    ]
  }));

  const rippleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(ripple.value, [0, 0.1, 1], [0, 0.5, 0]),
    transform: [{ scale: interpolate(ripple.value, [0, 1], [0.6, 2.4]) }]
  }));

  useEffect(() => {
    if (wasChecked.current && !checked) {
      setJustChecked(false);
    }
    wasChecked.current = checked;
    checkAnim.value = withTiming(checked ? 1 : 0, { duration: checked ? 120 : 80 });
  }, [checkAnim, checked]);

  function handlePress() {
    const action = getCheckButtonPressAction({ disabled, checked: effectiveChecked, canUndo });

    if (action === "none") {
      return;
    }

    if (action === "undo") {
      onUndo?.();
      return;
    }

    // 数值型：这一步只是打开输入框，还没真正完成。
    // 只做一个轻按压反馈，立刻回调，不显示打勾/迸发。
    if (!optimistic) {
      circleScale.value = withSequence(
        withTiming(0.82, { duration: 80 }),
        withSpring(1, { damping: 10, stiffness: 240 })
      );
      onComplete();
      return;
    }

    setJustChecked(true);
    onCelebrate?.();

    // 圆圈：先被"按下"缩小，再带弹性回弹放大一下
    circleScale.value = withSequence(
      withTiming(0.78, { duration: 90 }),
      withSpring(1.18, { damping: 6, stiffness: 220 }),
      withSpring(1, { damping: 12, stiffness: 260 })
    );
    // ✓ 旋转弹入
    checkAnim.value = withDelay(70, withSpring(1, { damping: 9, stiffness: 200 }));
    // 粒子迸发 + 涟漪扩散
    burst.value = 0;
    burst.value = withTiming(1, { duration: 620 });
    ripple.value = 0;
    ripple.value = withTiming(1, { duration: 520 });

    // 迸发展现一小段时间后再刷新数据（刷新会重排/重建列表）
    circleScale.value = withDelay(COMMIT_DELAY, withSpring(1, { damping: 14 }, () => {
      runOnJS(onComplete)();
    }));
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: effectiveChecked, disabled: disabled || (effectiveChecked && !canUndo) }}
      disabled={disabled || (effectiveChecked && !canUndo)}
      hitSlop={8}
      onPress={handlePress}
      style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}
    >
      {/* 涟漪圆环 */}
      <Animated.View
        pointerEvents="none"
        style={[
          {
            position: "absolute",
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            borderWidth: 2,
            borderColor: colors.primary
          },
          rippleStyle
        ]}
      />

      {/* 勾选圆圈 */}
      <Animated.View
        style={[
          {
            width: SIZE,
            height: SIZE,
            borderRadius: SIZE / 2,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 2,
            borderColor: effectiveChecked ? colors.primary : colors.lineStrong,
            backgroundColor: effectiveChecked ? colors.primary : "transparent"
          },
          circleStyle
        ]}
      >
        <Animated.View style={checkStyle}>
          <AppText variant="bodyStrong" tone="onPrimary" style={{ lineHeight: 20 }}>
            ✓
          </AppText>
        </Animated.View>
      </Animated.View>

      {/* 迸发粒子 */}
      {particles.map((particle, index) => (
        <BurstParticle
          key={index}
          particle={particle}
          progress={burst}
          color={
            particle.colorKey === "success"
              ? colors.success
              : particle.colorKey === "primaryInk"
                ? colors.primaryInk
                : colors.primary
          }
        />
      ))}
    </Pressable>
  );
}
