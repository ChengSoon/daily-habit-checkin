import { useEffect, useState } from "react";
import { Animated, Easing, View } from "react-native";
import { AppText } from "./Controls";
import { useTheme } from "./ThemeContext";

type ThinkingDotsProps = {
  label?: string;
  /** bubble: 消息气泡内；bar: 底部输入区状态条 */
  variant?: "bubble" | "bar";
};

/** 三点跳动：表示模型思考中。 */
export function ThinkingDots({ label = "思考中", variant = "bubble" }: ThinkingDotsProps) {
  const { colors } = useTheme();
  const [dots] = useState(() => [new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]);
  const isBar = variant === "bar";
  const dotColor = isBar ? colors.partnerInk : colors.partnerInk;
  const size = isBar ? 6 : 7;

  useEffect(() => {
    const animations = dots.map((dot, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 140),
          Animated.timing(dot, {
            toValue: 1,
            duration: 320,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 320,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true
          })
        ])
      )
    );
    animations.forEach((item) => item.start());
    return () => {
      animations.forEach((item) => item.stop());
      dots.forEach((dot) => dot.setValue(0));
    };
  }, [dots]);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: isBar ? 8 : 10, minHeight: isBar ? 20 : 22 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: isBar ? 4 : 5 }}>
        {dots.map((dot, index) => {
          const translateY = dot.interpolate({ inputRange: [0, 1], outputRange: [0, isBar ? -4 : -5] });
          const opacity = dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] });
          return (
            <Animated.View
              key={index}
              style={{
                width: size,
                height: size,
                borderRadius: 999,
                backgroundColor: dotColor,
                opacity,
                transform: [{ translateY }]
              }}
            />
          );
        })}
      </View>
      {label ? (
        <AppText
          variant="small"
          style={{
            color: isBar ? colors.partnerInk : colors.muted,
            fontWeight: "800",
            fontSize: isBar ? 13 : 12
          }}
        >
          {label}
        </AppText>
      ) : null}
    </View>
  );
}
