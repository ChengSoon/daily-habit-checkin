import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { AppText } from "../ui/Controls";
import { radius, spacing } from "../ui/theme";
import { useTheme } from "../ui/ThemeContext";
import { useReducedMotion } from "../ui/useReducedMotion";

type Props = {
  visible: boolean;
  emoji: string;
  title: string;
  subtitle: string;
  onDone: () => void;
};

/** 领奖成功半屏庆祝；减动效时短时静态展示后结束。 */
export function AdventureClaimCelebration({ visible, emoji, title, subtitle, onDone }: Props) {
  const { colors } = useTheme();
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);
  const stamp = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    if (!visible) {
      progress.value = 0;
      stamp.value = 0;
      exit.value = 0;
      return;
    }

    if (reducedMotion) {
      const timer = setTimeout(() => onDone(), 450);
      return () => clearTimeout(timer);
    }

    progress.value = 0;
    stamp.value = 0;
    exit.value = 0;
    progress.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) });
    stamp.value = withSpring(1, { damping: 9, stiffness: 160 });
    exit.value = withDelay(
      1200,
      withTiming(1, { duration: 280 }, (finished) => {
        if (finished) {
          runOnJS(onDone)();
        }
      })
    );
  }, [exit, onDone, progress, reducedMotion, stamp, visible]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(stamp.value, [0, 0.2, 1], [0, 1, 1]) * interpolate(exit.value, [0, 1], [1, 0]),
    transform: [
      { translateY: interpolate(stamp.value, [0, 1], [28, 0]) + interpolate(exit.value, [0, 1], [0, -12]) },
      { scale: interpolate(stamp.value, [0, 0.7, 1], [0.72, 1.06, 1]) }
    ]
  }));

  const ringStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.2, 1], [0, 0.45, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.55, 1.7]) }]
  }));

  if (!visible) {
    return null;
  }

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onDone}>
      <Pressable style={styles.backdrop} onPress={onDone}>
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.line },
            cardStyle
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { borderColor: colors.celebration }, ringStyle]}
          />
          <AppText style={styles.emoji}>{emoji}</AppText>
          <AppText variant="title" style={{ textAlign: "center" }}>
            {title}
          </AppText>
          <AppText variant="body" tone="muted" style={{ textAlign: "center" }}>
            {subtitle}
          </AppText>
          <View style={{ height: spacing.xs }} />
          <AppText variant="caption" tone="soft" style={{ textAlign: "center", textTransform: "none" }}>
            轻触关闭
          </AppText>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(20, 16, 28, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg
  },
  card: {
    width: "100%",
    maxWidth: 320,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    gap: spacing.sm,
    overflow: "hidden"
  },
  ring: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2
  },
  emoji: {
    fontSize: 56,
    lineHeight: 64
  }
});
