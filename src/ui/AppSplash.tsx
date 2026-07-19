import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from "react-native-svg";
import { AppText } from "./Controls";
import { useTheme } from "./ThemeContext";
import { useReducedMotion } from "./useReducedMotion";

const INTRO_MS = 1400;
const EXIT_MS = 320;

/**
 * 品牌开屏：珊瑚印章 + 双人轨道 + 标题渐入。
 * 由 RootLayout 在字体就绪后短暂展示，再淡出进入主界面。
 */
export function AppSplash({
  visible,
  onFinish
}: {
  visible: boolean;
  onFinish: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const [loop] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const [enter] = useState(() => new Animated.Value(0));
  const [exit] = useState(() => new Animated.Value(1));

  useEffect(() => {
    if (!visible) {
      return;
    }

    enter.setValue(0);
    exit.setValue(1);

    const enterAnim = Animated.timing(enter, {
      toValue: 1,
      duration: reducedMotion ? 1 : 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    });

    let finished = false;
    const finishTimer = setTimeout(() => {
      Animated.timing(exit, {
        toValue: 0,
        duration: reducedMotion ? 1 : EXIT_MS,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true
      }).start(({ finished: ok }) => {
        if (ok && !finished) {
          finished = true;
          onFinish();
        }
      });
    }, reducedMotion ? 180 : INTRO_MS);

    enterAnim.start();

    return () => {
      clearTimeout(finishTimer);
      enter.stopAnimation();
      exit.stopAnimation();
    };
  }, [enter, exit, onFinish, reducedMotion, visible]);

  useEffect(() => {
    if (!visible || reducedMotion) {
      return;
    }

    const orbit = Animated.loop(
      Animated.timing(loop, {
        toValue: 1,
        duration: 2800,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    const heartbeat = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 760,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 920,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true
        })
      ])
    );

    orbit.start();
    heartbeat.start();
    return () => {
      orbit.stop();
      heartbeat.stop();
    };
  }, [loop, pulse, reducedMotion, visible]);

  const firstOrbit = loop.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const secondOrbit = loop.interpolate({ inputRange: [0, 1], outputRange: ["180deg", "540deg"] });
  const stampScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const glowScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.18] });
  const glowOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.22, 0.42] });
  const titleY = enter.interpolate({ inputRange: [0, 1], outputRange: [14, 0] });
  const markY = enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] });

  const gradientStops = useMemo(
    () => [
      { offset: "0%", color: colors.surfaceTint },
      { offset: "48%", color: colors.partnerSurface },
      { offset: "100%", color: colors.background }
    ],
    [colors.background, colors.partnerSurface, colors.surfaceTint]
  );

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      pointerEvents="auto"
      style={[styles.root, { opacity: exit, paddingTop: insets.top, paddingBottom: insets.bottom }]}
    >
      <Svg pointerEvents="none" style={StyleSheet.absoluteFill} preserveAspectRatio="none" viewBox="0 0 390 844">
        <Defs>
          <SvgLinearGradient id="splash-bg" x1="0" y1="0" x2="0" y2="1">
            {gradientStops.map((stop) => (
              <Stop key={stop.offset} offset={stop.offset} stopColor={stop.color} />
            ))}
          </SvgLinearGradient>
        </Defs>
        <Rect x="0" y="0" width="390" height="844" fill="url(#splash-bg)" />
      </Svg>

      <View style={styles.center}>
        <Animated.View
          style={[
            styles.markWrap,
            {
              opacity: enter,
              transform: [{ translateY: markY }, { scale: stampScale }]
            }
          ]}
        >
          <View style={styles.orbitStage}>
            <Animated.View
              style={[
                styles.glow,
                {
                  backgroundColor: colors.primary,
                  opacity: glowOpacity,
                  transform: [{ scale: glowScale }]
                }
              ]}
            />
            <View style={[styles.stampPlate, { backgroundColor: colors.primary, shadowColor: colors.primary }]}>
              <Ionicons name="leaf" size={40} color={colors.onPrimary} />
            </View>
            <View style={[styles.stampBadge, { backgroundColor: colors.celebration, borderColor: colors.surface }]}>
              <Ionicons name="checkmark" size={15} color="#FFFFFF" />
            </View>
            <Animated.View style={[styles.orbit, { transform: [{ rotate: firstOrbit }] }]}>
              <View style={[styles.planet, { backgroundColor: colors.primary }]} />
            </Animated.View>
            <Animated.View style={[styles.orbit, { transform: [{ rotate: secondOrbit }] }]}>
              <View style={[styles.planet, styles.partnerPlanet, { backgroundColor: colors.partner }]} />
            </Animated.View>
          </View>
        </Animated.View>

        <Animated.View
          style={{
            opacity: enter,
            transform: [{ translateY: titleY }],
            alignItems: "center",
            gap: 8
          }}
        >
          <AppText variant="display" style={{ textAlign: "center" }}>
            每日打卡
          </AppText>
          <AppText variant="body" tone="soft" style={{ textAlign: "center" }}>
            一起浇灌你们的小岛
          </AppText>
          <View style={[styles.pill, { backgroundColor: colors.surface, borderColor: colors.line }]}>
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
            <AppText variant="small" tone="soft">
              正在唤醒小岛…
            </AppText>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center"
  },
  center: {
    alignItems: "center",
    gap: 28,
    paddingHorizontal: 28
  },
  markWrap: {
    width: 188,
    height: 188,
    alignItems: "center",
    justifyContent: "center"
  },
  orbitStage: {
    width: 168,
    height: 168,
    alignItems: "center",
    justifyContent: "center"
  },
  glow: {
    position: "absolute",
    width: 132,
    height: 132,
    borderRadius: 66
  },
  stampPlate: {
    width: 88,
    height: 88,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6
  },
  stampBadge: {
    position: "absolute",
    right: 34,
    bottom: 34,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3
  },
  orbit: {
    position: "absolute",
    width: 148,
    height: 148,
    borderRadius: 74
  },
  planet: {
    position: "absolute",
    top: 6,
    left: 66,
    width: 16,
    height: 16,
    borderRadius: 8
  },
  partnerPlanet: {
    width: 13,
    height: 13,
    borderRadius: 7,
    top: 8,
    left: 67
  },
  pill: {
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4
  }
});
