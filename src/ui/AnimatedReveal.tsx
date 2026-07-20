import { PropsWithChildren, useEffect, useRef } from "react";
import { Animated, Easing, Platform, StyleProp, View, ViewStyle } from "react-native";
import { useReducedMotion } from "./useReducedMotion";

type RevealVariant = "panel" | "inline" | "fade";

type AnimatedRevealProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  /** panel：设置区块展开；inline：嵌套字段；fade：仅淡入淡出 */
  variant?: RevealVariant;
  delayMs?: number;
}>;

/**
 * 功能面板 / 折叠区块的轻量显隐动画。
 *
 * 不用 Reanimated entering/exiting：在页面切换、tab 转场时 entering 可能停在 opacity:0，
 * 导致内容“加载不出来”。这里用 RN Animated，并用超时兜底强制可见。
 */
export function AnimatedReveal({
  children,
  style,
  variant = "panel",
  delayMs = 0
}: AnimatedRevealProps) {
  const reducedMotion = useReducedMotion();
  // web 上 native driver + 条件卸载更容易闪空，直接静态渲染
  const disableMotion = reducedMotion || Platform.OS === "web";
  const opacity = useRef(new Animated.Value(disableMotion ? 1 : 0)).current;
  const translateY = useRef(new Animated.Value(disableMotion ? 0 : variant === "fade" ? 0 : 10)).current;

  useEffect(() => {
    if (disableMotion) {
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }

    opacity.setValue(0);
    translateY.setValue(variant === "fade" ? 0 : variant === "inline" ? 6 : 10);

    const duration = variant === "panel" ? 220 : 160;
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay: delayMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration,
        delay: delayMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]);

    animation.start();

    // 兜底：动画被导航打断时仍保证可见
    const failsafe = setTimeout(() => {
      opacity.setValue(1);
      translateY.setValue(0);
    }, delayMs + duration + 120);

    return () => {
      animation.stop();
      clearTimeout(failsafe);
      opacity.setValue(1);
      translateY.setValue(0);
    };
  }, [delayMs, disableMotion, opacity, translateY, variant]);

  if (disableMotion) {
    return <View style={style}>{children}</View>;
  }

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}
