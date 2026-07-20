import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppSplashBackdrop } from "./AppSplashBackdrop";
import { AppText } from "./Controls";
import { useTheme } from "./ThemeContext";
import { useReducedMotion } from "./useReducedMotion";
import { appSplashStyles as styles } from "./appSplashStyles";

const INTRO_MS = 2100;
const EXIT_MS = 380;
const STATUS_LINES = ["正在唤醒小岛…", "同步你们的节奏…", "点亮今日角落…"] as const;

type AppSplashProps = {
  visible: boolean;
  onFinish: () => void;
};

/**
 * 满屏品牌开屏：沉浸式岛景 + 双人轨迹 + 底部进度。
 * 字体就绪后由 RootLayout 展示，结束后淡出进入主界面。
 */
export function AppSplash({ visible, onFinish }: AppSplashProps) {
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const finishedRef = useRef(false);
  const [statusIndex, setStatusIndex] = useState(0);

  const [enter] = useState(() => new Animated.Value(0));
  const [exit] = useState(() => new Animated.Value(1));
  const [progress] = useState(() => new Animated.Value(0));
  const [wave] = useState(() => new Animated.Value(0));
  const [floatA] = useState(() => new Animated.Value(0));
  const [floatB] = useState(() => new Animated.Value(0));
  const [orbit] = useState(() => new Animated.Value(0));

  const { width, height } = Dimensions.get("window");

  useEffect(() => {
    if (!visible) {
      return;
    }
    finishedRef.current = false;
    enter.setValue(0);
    exit.setValue(1);
    progress.setValue(0);

    const enterMs = reducedMotion ? 1 : 520;
    const holdMs = reducedMotion ? 220 : INTRO_MS;

    Animated.timing(enter, {
      toValue: 1,
      duration: enterMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();

    Animated.timing(progress, {
      toValue: 1,
      duration: holdMs,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false
    }).start();

    const finishTimer = setTimeout(() => {
      Animated.timing(exit, {
        toValue: 0,
        duration: reducedMotion ? 1 : EXIT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true
      }).start(({ finished }) => {
        if (finished && !finishedRef.current) {
          finishedRef.current = true;
          onFinish();
        }
      });
    }, holdMs);

    const failsafe = setTimeout(() => {
      if (!finishedRef.current) {
        finishedRef.current = true;
        onFinish();
      }
    }, holdMs + EXIT_MS + 240);

    return () => {
      clearTimeout(finishTimer);
      clearTimeout(failsafe);
      enter.stopAnimation();
      exit.stopAnimation();
      progress.stopAnimation();
    };
  }, [enter, exit, onFinish, progress, reducedMotion, visible]);

  useEffect(() => {
    if (!visible || reducedMotion) {
      return;
    }

    const waveLoop = Animated.loop(
      Animated.timing(wave, {
        toValue: 1,
        duration: 4200,
        easing: Easing.inOut(Easing.sin),
        useNativeDriver: true
      })
    );
    const floatLoopA = Animated.loop(
      Animated.sequence([
        Animated.timing(floatA, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatA, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])
    );
    const floatLoopB = Animated.loop(
      Animated.sequence([
        Animated.timing(floatB, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(floatB, { toValue: 0, duration: 2200, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])
    );
    const orbitLoop = Animated.loop(
      Animated.timing(orbit, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );

    waveLoop.start();
    floatLoopA.start();
    floatLoopB.start();
    orbitLoop.start();

    const statusTimer = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_LINES.length);
    }, 700);

    return () => {
      waveLoop.stop();
      floatLoopA.stop();
      floatLoopB.stop();
      orbitLoop.stop();
      clearInterval(statusTimer);
    };
  }, [floatA, floatB, orbit, reducedMotion, visible, wave]);

  const titleY = enter.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
  const heroY = enter.interpolate({ inputRange: [0, 1], outputRange: [36, 0] });
  const footerY = enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });
  const waveShift = wave.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  const floatShiftA = floatA.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const floatShiftB = floatB.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const orbitRotate = orbit.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["8%", "100%"] });
  const cardBg = scheme === "dark" ? colors.surface : "rgba(255,255,255,0.78)";

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="auto"
      accessibilityRole="progressbar"
      accessibilityLabel="正在启动每日打卡"
      style={[styles.root, { opacity: exit, backgroundColor: colors.background }]}
    >
      <AppSplashBackdrop width={width} height={height} colors={colors} scheme={scheme} />

      <Animated.View
        pointerEvents="none"
        style={[
          styles.orbitLayer,
          {
            top: height * 0.18,
            opacity: enter,
            transform: [{ translateY: heroY }, { rotate: orbitRotate }]
          }
        ]}
      >
        <View style={[styles.orbitRing, { borderColor: `${colors.primary}33` }]} />
        <View style={[styles.orbitRingInner, { borderColor: `${colors.partner}40` }]} />
        <View style={[styles.personDot, styles.personYou, { backgroundColor: colors.primary }]} />
        <View style={[styles.personDot, styles.personPartner, { backgroundColor: colors.partner }]} />
      </Animated.View>

      <View style={[styles.content, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 22 }]}>
        <Animated.View style={{ opacity: enter, transform: [{ translateY: titleY }] }}>
          <View style={[styles.eyebrow, { backgroundColor: cardBg }]}>
            <View style={[styles.eyebrowDot, { backgroundColor: colors.primary }]} />
            <AppText variant="caption" tone="soft">
              FOR TWO · DAILY RITUAL
            </AppText>
          </View>
        </Animated.View>

        <View style={styles.heroBlock}>
          <Animated.View
            style={[
              styles.emblemWrap,
              { opacity: enter, transform: [{ translateY: Animated.add(heroY, floatShiftA) }] }
            ]}
          >
            <View style={[styles.emblemPlate, { backgroundColor: colors.surface, borderColor: colors.line }]}>
              <View style={[styles.emblemCore, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
                <Ionicons name="leaf" size={34} color={colors.onPrimary} />
              </View>
              <View style={[styles.emblemChip, { backgroundColor: colors.partnerSurface, borderColor: colors.surface }]}>
                <Ionicons name="heart" size={13} color={colors.partnerInk} />
              </View>
            </View>
            <Animated.View style={{ transform: [{ translateY: floatShiftB }] }}>
              <AppText variant="display" style={styles.title}>
                每日打卡
              </AppText>
              <AppText variant="body" tone="soft" style={styles.subtitle}>
                两个人，一座慢慢长大的小岛
              </AppText>
            </Animated.View>
          </Animated.View>
        </View>

        <Animated.View style={[styles.footer, { opacity: enter, transform: [{ translateY: footerY }, { translateX: waveShift }] }]}>
          <View style={[styles.statusCard, { backgroundColor: cardBg, borderColor: colors.line }]}>
            <View style={styles.statusRow}>
              <View style={[styles.statusAvatar, { backgroundColor: colors.primary }]}>
                <AppText variant="caption" style={{ color: colors.onPrimary, fontWeight: "800" }}>
                  你
                </AppText>
              </View>
              <View style={[styles.statusBridge, { backgroundColor: colors.lineStrong }]} />
              <View style={[styles.statusAvatar, { backgroundColor: colors.partner }]}>
                <AppText variant="caption" style={{ color: colors.onPartner, fontWeight: "800" }}>
                  TA
                </AppText>
              </View>
              <AppText variant="small" tone="soft" style={{ flex: 1 }}>
                {STATUS_LINES[statusIndex]}
              </AppText>
            </View>
            <View style={[styles.track, { backgroundColor: colors.line }]}>
              <Animated.View style={[styles.trackFill, { width: progressWidth, backgroundColor: colors.primary }]} />
            </View>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

