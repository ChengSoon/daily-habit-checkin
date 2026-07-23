import { PropsWithChildren, useCallback, useState } from "react";
import { Pressable, StyleProp, View, ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from "react-native-svg";
import { AppText } from "./controlText";
import { radius, shadow } from "./theme";
import { useTheme } from "./ThemeContext";

type CardProps = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  tone?: "surface" | "tint" | "muted";
  tintColor?: string;
  gradient?: readonly [string, string];
  gradientBorder?: string;
  elevated?: boolean;
}>;

type CardSize = { width: number; height: number };

function CardGradient({ colors, gradientId, size }: {
  colors: readonly [string, string];
  gradientId: string;
  size: CardSize;
}) {
  if (size.width <= 0 || size.height <= 0) return null;
  return (
    <Svg pointerEvents="none" width={size.width} height={size.height} style={{ position: "absolute", top: 0, left: 0 }}>
      <Defs>
        <SvgLinearGradient id={gradientId} x1="0.15" y1="0" x2="0.85" y2="1">
          <Stop offset="0%" stopColor={colors[0]} />
          <Stop offset="100%" stopColor={colors[1]} />
        </SvgLinearGradient>
      </Defs>
      <Rect x={-2} y={-2} width={size.width + 4} height={size.height + 4} fill={`url(#${gradientId})`} />
    </Svg>
  );
}

function useCardSize(enabled: boolean) {
  const [size, setSize] = useState<CardSize>({ width: 0, height: 0 });
  const onLayout = useCallback((event: { nativeEvent: { layout: CardSize } }) => {
    if (!enabled) return;
    const next = event.nativeEvent.layout;
    setSize((current) => current.width === next.width && current.height === next.height ? current : next);
  }, [enabled]);
  return { size, onLayout };
}

export function Card({
  children,
  style,
  onPress,
  tone = "surface",
  tintColor,
  gradient,
  gradientBorder,
  elevated = false
}: CardProps) {
  const { colors } = useTheme();
  const hasGradient = Array.isArray(gradient);
  const background = tintColor ?? (tone === "tint"
    ? colors.surfaceTint : tone === "muted" ? colors.surfaceMuted : colors.surface);
  const gradientId = gradient ? `cg${gradient.map((color) => color.replace(/[^0-9a-z]/gi, "")).join("")}` : "";
  const gradientFallback = gradient?.[1] ?? background;
  const { size, onLayout } = useCardSize(hasGradient);
  const content = (
    <View
      onLayout={onLayout}
      style={[
        {
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: hasGradient ? gradientBorder ?? colors.line : colors.line,
          backgroundColor: gradientFallback,
          padding: 13,
          gap: 12,
          overflow: "hidden",
          position: "relative",
          ...(elevated ? shadow.card : {})
        },
        style
      ]}
    >
      {gradient ? <CardGradient colors={gradient} gradientId={gradientId} size={size} /> : null}
      {children}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => pressed ? { opacity: 0.92, transform: [{ scale: 0.995 }] } : null}
    >
      {content}
    </Pressable>
  );
}

export function SectionCard({ title, children }: PropsWithChildren<{ title?: string }>) {
  return (
    <Card elevated={false}>
      {title ? <AppText variant="section">{title}</AppText> : null}
      {children}
    </Card>
  );
}
