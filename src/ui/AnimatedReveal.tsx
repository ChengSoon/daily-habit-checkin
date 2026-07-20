import { PropsWithChildren } from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  FadeOutUp,
  LinearTransition
} from "react-native-reanimated";
import { useReducedMotion } from "./useReducedMotion";

type RevealVariant = "panel" | "inline" | "fade";

type AnimatedRevealProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  /** panel：设置区块展开；inline：嵌套字段；fade：仅淡入淡出 */
  variant?: RevealVariant;
  delayMs?: number;
}>;

/**
 * 功能面板 / 折叠区块的统一显隐动画。
 * 条件渲染包裹：`{open ? <AnimatedReveal>...</AnimatedReveal> : null}`
 */
export function AnimatedReveal({
  children,
  style,
  variant = "panel",
  delayMs = 0
}: AnimatedRevealProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) {
    return <View style={style}>{children}</View>;
  }

  if (variant === "fade") {
    return (
      <Animated.View
        entering={FadeIn.duration(180).delay(delayMs)}
        exiting={FadeOut.duration(140)}
        layout={LinearTransition.duration(200)}
        style={style}
      >
        {children}
      </Animated.View>
    );
  }

  if (variant === "inline") {
    return (
      <Animated.View
        entering={FadeInDown.duration(180).delay(delayMs)}
        exiting={FadeOutUp.duration(120)}
        layout={LinearTransition.duration(180)}
        style={style}
      >
        {children}
      </Animated.View>
    );
  }

  return (
    <Animated.View
      entering={FadeInDown.duration(240).delay(delayMs)}
      exiting={FadeOutUp.duration(160)}
      layout={LinearTransition.duration(200)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** 列表项重排 / 相邻区块高度变化时的布局过渡 */
export const revealLayoutTransition = LinearTransition.duration(200);
