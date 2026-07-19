import { Image } from "expo-image";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { AppText } from "../ui/Controls";
import { radius } from "../ui/theme";
import { useTheme } from "../ui/ThemeContext";
import { resolveChapterIslandSource } from "./mapAssets";
import type { AdventureChapterView } from "./types";

type Props = {
  chapter: AdventureChapterView;
  islandSize: number;
  scale: number;
  active?: boolean;
  /** 新解锁时播一次弹入 */
  emphasizeOnce?: boolean;
  onPress: () => void;
};

/**
 * 2.5D 立体岛（单岛焦点）。
 * - 自定义 nodeImageKey（含 GIF）优先
 * - 否则 mapThemeKey 默认主题岛
 * - 锁定弱浮 / 已解锁轻浮 / 可领强浮
 * - 点击：下压 → 弹跳回弹；锁定则拒绝摇晃
 */
export function IslandMarker({
  chapter,
  islandSize,
  scale,
  active = false,
  emphasizeOnce = false,
  onPress
}: Props) {
  const { colors } = useTheme();
  const locked = chapter.viewStatus === "locked";
  const claimable = chapter.viewStatus === "claimable";
  const claimed = chapter.viewStatus === "claimed";
  const islandSource = resolveChapterIslandSource(chapter);
  const customUri = typeof islandSource === "object" && islandSource && "uri" in islandSource ? islandSource.uri : null;
  const isGif = Boolean(customUri && String(customUri).toLowerCase().includes(".gif"));

  const floatY = useSharedValue(0);
  const pressScale = useSharedValue(1);
  const pressY = useSharedValue(0);
  const wobble = useSharedValue(0);
  const tapGlow = useSharedValue(0);
  const shadowPulse = useSharedValue(1);
  const pop = useSharedValue(1);

  useEffect(() => {
    if (!emphasizeOnce) {
      pop.value = 1;
      return;
    }
    pop.value = 0.82;
    pop.value = withSpring(1, { damping: 8, stiffness: 180 });
  }, [emphasizeOnce, pop]);

  useEffect(() => {
    // 幅度：锁定轻、已解锁中、可领/焦点强
    const amp = locked ? 3 * scale : claimable || active ? 10 * scale : 5.5 * scale;
    // 半周期（单程）；withRepeat reverse 会原路返回，形成无缝上下浮动
    const halfMs = locked ? 2000 : claimable ? 1400 : 1700;

    cancelAnimation(floatY);
    cancelAnimation(shadowPulse);

    // 从当前位置平滑过渡到 0，再开始 ping-pong，避免切状态时硬跳
    floatY.value = withTiming(0, { duration: 220, easing: Easing.out(Easing.quad) }, (finished) => {
      if (!finished) return;
      // reverse:true → 0 ⇄ -amp，终点速度为 0，循环无突变
      floatY.value = withRepeat(
        withTiming(-amp, {
          duration: halfMs,
          easing: Easing.inOut(Easing.sin)
        }),
        -1,
        true
      );
    });

    // 阴影随高度反向呼吸：岛越高影子越小越淡
    shadowPulse.value = withTiming(1, { duration: 220 }, (finished) => {
      if (!finished) return;
      shadowPulse.value = withRepeat(
        withTiming(0.72, {
          duration: halfMs,
          easing: Easing.inOut(Easing.sin)
        }),
        -1,
        true
      );
    });

    return () => {
      cancelAnimation(floatY);
      cancelAnimation(shadowPulse);
    };
  }, [locked, claimable, active, floatY, shadowPulse, scale]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value + pressY.value },
      { rotateZ: `${wobble.value}deg` },
      { scale: pressScale.value * pop.value }
    ]
  }));

  const softShadowStyle = useAnimatedStyle(() => {
    // 按下时岛更贴海面 → 影子更大；弹起时更小
    const pressBoost = (pressY.value > 0 ? pressY.value : pressY.value * 0.35) / Math.max(1, 10 * scale);
    const pulse = shadowPulse.value - pressBoost * 0.2;
    return {
      opacity: 0.16 + pulse * 0.24 + Math.max(0, pressBoost) * 0.12,
      transform: [
        { scaleX: 0.84 + pulse * 0.2 + Math.max(0, pressBoost) * 0.16 },
        { scaleY: 0.88 + pulse * 0.14 + Math.max(0, pressBoost) * 0.1 }
      ]
    };
  });

  const tapGlowStyle = useAnimatedStyle(() => ({
    opacity: tapGlow.value * 0.55,
    transform: [{ scaleX: 0.9 + tapGlow.value * 0.35 }, { scaleY: 0.9 + tapGlow.value * 0.25 }]
  }));

  const runPressIn = () => {
    cancelAnimation(pressScale);
    cancelAnimation(pressY);
    pressScale.value = withTiming(0.92, { duration: 85, easing: Easing.out(Easing.quad) });
    pressY.value = withTiming(8 * scale, { duration: 85, easing: Easing.out(Easing.quad) });
  };

  const runPressOutBounce = () => {
    cancelAnimation(pressScale);
    cancelAnimation(pressY);
    cancelAnimation(wobble);

    if (locked) {
      // 锁定：回弹 + 拒绝摇晃
      pressScale.value = withSpring(1, { damping: 11, stiffness: 220 });
      pressY.value = withSpring(0, { damping: 12, stiffness: 210 });
      wobble.value = withSequence(
        withTiming(-5.5, { duration: 45 }),
        withTiming(5.5, { duration: 45 }),
        withTiming(-3.5, { duration: 45 }),
        withTiming(3.5, { duration: 45 }),
        withTiming(0, { duration: 55 })
      );
      return;
    }

    // 解锁：下压释放后上跳回弹 + 轻晃
    const hop = (claimable || active ? 14 : 11) * scale;
    const overshoot = claimable || active ? 1.1 : 1.07;

    pressScale.value = withSequence(
      withSpring(overshoot, { damping: 7, stiffness: 320 }),
      withSpring(0.98, { damping: 10, stiffness: 240 }),
      withSpring(1, { damping: 12, stiffness: 200 })
    );
    pressY.value = withSequence(
      withSpring(-hop, { damping: 8, stiffness: 300 }),
      withSpring(0, { damping: 11, stiffness: 190 })
    );
    wobble.value = withSequence(
      withTiming(claimable ? -3.2 : -2.2, { duration: 70 }),
      withTiming(claimable ? 3.2 : 2.2, { duration: 90 }),
      withSpring(0, { damping: 9, stiffness: 170 })
    );

    if (claimable) {
      cancelAnimation(tapGlow);
      tapGlow.value = 0;
      tapGlow.value = withSequence(
        withTiming(1, { duration: 90 }),
        withTiming(0, { duration: 480, easing: Easing.out(Easing.cubic) })
      );
    }
  };

  const bodyW = islandSize;
  const bodyH = islandSize;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={runPressIn}
      onPressOut={runPressOutBounce}
      style={styles.hit}
      accessibilityRole="button"
      accessibilityLabel={`第${chapter.sortOrder}章 ${chapter.title}，${
        claimed ? "已领取" : claimable ? "可领取" : `锁定 ${chapter.thresholdLifetimeXp} XP`
      }`}
    >
      <Animated.View style={[{ alignItems: "center", width: bodyW + 48 }, floatStyle]}>
        {claimable ? (
          <View
            style={[
              styles.glow,
              {
                width: bodyW * 1.2,
                height: bodyW * 0.4,
                backgroundColor: colors.celebration
              }
            ]}
          />
        ) : null}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.tapGlow,
            {
              width: bodyW * 1.15,
              height: bodyW * 0.42,
              backgroundColor: claimable ? colors.celebration : "rgba(255,255,255,0.85)"
            },
            tapGlowStyle
          ]}
        />

        <View style={{ width: bodyW, height: bodyH, alignItems: "center", justifyContent: "center" }}>
          {/* 海面接触阴影（软），不与资源内阴影硬叠 */}
          <Animated.View
            style={[
              styles.softShadow,
              {
                width: bodyW * 0.62,
                height: bodyW * 0.12,
                bottom: bodyH * 0.08
              },
              softShadowStyle
            ]}
          />
          <Image
            source={islandSource}
            style={{
              width: bodyW,
              height: bodyH,
              opacity: locked ? 0.5 : 1
            }}
            contentFit="contain"
            transition={isGif ? 0 : 180}
          />
          {locked ? <View style={[styles.lockVeil, { width: bodyW * 0.88, height: bodyH * 0.72 }]} /> : null}

          <View
            style={[
              styles.orderChip,
              {
                backgroundColor: locked ? "rgba(40,45,50,0.88)" : "rgba(255,255,255,0.96)",
                borderColor: claimable ? colors.celebration : "rgba(255,255,255,0.35)"
              }
            ]}
          >
            <AppText
              variant="caption"
              style={{
                fontSize: 13,
                fontWeight: "800",
                color: locked ? "#D0D5D8" : "#2A1B24",
                textTransform: "none"
              }}
            >
              {chapter.sortOrder}
            </AppText>
          </View>

          {claimed ? (
            <View style={[styles.claimedFlag, { backgroundColor: colors.primary }]}>
              <AppText style={{ fontSize: 11, color: colors.onPrimary, fontWeight: "800" }}>✓</AppText>
            </View>
          ) : null}
          {claimable ? (
            <View style={[styles.claimDot, { backgroundColor: colors.celebration }]} />
          ) : null}
          {locked ? (
            <View style={styles.lockBadge}>
              <AppText style={{ fontSize: 11, color: "#EEF2F4" }}>锁</AppText>
            </View>
          ) : null}
        </View>

        <View style={[styles.caption, { maxWidth: Math.min(240, bodyW + 56) }]}>
          <AppText
            variant="small"
            style={{ fontWeight: "800", textAlign: "center", color: "#F5FBFF", fontSize: 16 }}
            numberOfLines={1}
          >
            {chapter.title}
          </AppText>
          {chapter.subtitle ? (
            <AppText
              variant="caption"
              style={{
                textTransform: "none",
                textAlign: "center",
                fontSize: 11,
                color: "rgba(230,240,245,0.72)"
              }}
              numberOfLines={1}
            >
              {chapter.subtitle}
            </AppText>
          ) : null}
          <AppText
            variant="caption"
            style={{
              textTransform: "none",
              textAlign: "center",
              fontSize: 12,
              marginTop: 2,
              color: claimable ? colors.celebration : "rgba(230,240,245,0.92)"
            }}
            numberOfLines={1}
          >
            {claimed ? "已领取 · 点击回顾" : claimable ? "可领取 · 点击领奖" : `锁定 · ${chapter.thresholdLifetimeXp} XP`}
          </AppText>
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    alignItems: "center",
    justifyContent: "center"
  },
  glow: {
    position: "absolute",
    bottom: 78,
    borderRadius: 999,
    opacity: 0.34
  },
  tapGlow: {
    position: "absolute",
    bottom: 76,
    borderRadius: 999
  },
  softShadow: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(8, 20, 28, 1)"
  },
  lockVeil: {
    position: "absolute",
    backgroundColor: "rgba(18, 28, 38, 0.42)",
    borderRadius: 28
  },
  orderChip: {
    position: "absolute",
    right: 8,
    top: 12,
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6
  },
  claimDot: {
    position: "absolute",
    top: 10,
    left: 12,
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)"
  },
  claimedFlag: {
    position: "absolute",
    top: 10,
    left: 12,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  lockBadge: {
    position: "absolute",
    bottom: 28,
    right: 16,
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(20,28,34,0.8)",
    paddingHorizontal: 6
  },
  caption: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.28)",
    alignItems: "center",
    gap: 2,
    backgroundColor: "rgba(10, 24, 32, 0.8)"
  }
});
