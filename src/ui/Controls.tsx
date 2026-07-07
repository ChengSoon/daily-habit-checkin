import { Ionicons } from "@expo/vector-icons";
import { PropsWithChildren, ReactNode, useEffect, useState } from "react";
import {
  Animated,
  KeyboardTypeOptions,
  Pressable,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextStyle,
  View,
  ViewStyle
} from "react-native";
import { Palette, radius, spacing, type as typeScale } from "./theme";
import { useTheme } from "./ThemeContext";

type IoniconName = keyof typeof Ionicons.glyphMap;

type TextVariant = "display" | "title" | "section" | "body" | "bodyStrong" | "small" | "caption";
type TextTone = "default" | "soft" | "muted" | "faint" | "primary" | "danger" | "onPrimary";

function toneColor(colors: Palette, tone: TextTone): string {
  switch (tone) {
    case "soft":
      return colors.inkSoft;
    case "muted":
      return colors.muted;
    case "faint":
      return colors.faint;
    case "primary":
      return colors.primaryInk;
    case "danger":
      return colors.danger;
    case "onPrimary":
      return colors.onPrimary;
    default:
      return colors.ink;
  }
}

export function AppText({
  children,
  variant = "body",
  tone = "default",
  style,
  numberOfLines
}: PropsWithChildren<{
  variant?: TextVariant;
  tone?: TextTone;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}>) {
  const { colors } = useTheme();
  const scale = typeScale[variant];

  return (
    <Text
      numberOfLines={numberOfLines}
      style={[
        {
          fontSize: scale.fontSize,
          lineHeight: scale.lineHeight,
          fontWeight: scale.fontWeight,
          letterSpacing: scale.letterSpacing,
          color: toneColor(colors, tone)
        },
        variant === "caption" ? { textTransform: "uppercase" } : null,
        style
      ]}
    >
      {children}
    </Text>
  );
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

export function AppButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  compact = false,
  fullWidth = false,
  icon,
  style
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  icon?: IoniconName;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  const background: Record<ButtonVariant, string> = {
    primary: colors.primary,
    secondary: colors.surfaceTint,
    ghost: "transparent",
    danger: colors.dangerSurface
  };
  const border: Record<ButtonVariant, string> = {
    primary: colors.primary,
    secondary: colors.line,
    ghost: colors.lineStrong,
    danger: colors.dangerSurface
  };
  const textTone: Record<ButtonVariant, TextTone> = {
    primary: "onPrimary",
    secondary: "primary",
    ghost: "default",
    danger: "danger"
  };
  // 禁用态统一走中性底色 + 可读文字，避免在主题色上叠低透明度导致文字糊成一片。
  const iconColor = disabled ? colors.muted : toneColor(colors, textTone[variant]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: compact ? 38 : 50,
          borderRadius: radius.md,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: spacing.sm,
          paddingHorizontal: compact ? spacing.md : spacing.lg,
          paddingVertical: compact ? spacing.sm : spacing.md,
          backgroundColor: disabled ? colors.surfaceMuted : background[variant],
          borderWidth: 1,
          borderColor: disabled ? colors.lineStrong : border[variant]
        },
        fullWidth ? { alignSelf: "stretch" } : null,
        pressed && !disabled ? { opacity: 0.85, transform: [{ scale: 0.99 }] } : null,
        style
      ]}
    >
      {icon ? <Ionicons name={icon} size={compact ? 16 : 18} color={iconColor} /> : null}
      <AppText variant="bodyStrong" tone={disabled ? "muted" : textTone[variant]}>
        {title}
      </AppText>
    </Pressable>
  );
}

export function IconButton({
  name,
  onPress,
  disabled = false,
  accessibilityLabel,
  tone = "muted"
}: {
  name: IoniconName;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  tone?: "muted" | "primary";
}) {
  const { colors } = useTheme();
  const color = tone === "primary" ? colors.primaryInk : colors.inkSoft;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      hitSlop={6}
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 38,
          height: 38,
          borderRadius: radius.md,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surfaceMuted,
          borderWidth: 1,
          borderColor: colors.line
        },
        disabled ? { opacity: 0.35 } : null,
        pressed && !disabled ? { opacity: 0.7, transform: [{ scale: 0.96 }] } : null
      ]}
    >
      <Ionicons name={name} size={18} color={disabled ? colors.faint : color} />
    </Pressable>
  );
}

export function SegmentedControl<T extends string | number>({
  value,
  options,
  onChange
}: {
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}) {
  const { colors } = useTheme();
  const PADDING = 4;
  const [trackWidth, setTrackWidth] = useState(0);

  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === value)
  );
  // 滑块随选中项平滑滑动：以 activeIndex 为动画目标，宽度按等分计算。
  const [position] = useState(() => new Animated.Value(activeIndex));

  useEffect(() => {
    Animated.spring(position, {
      toValue: activeIndex,
      friction: 9,
      tension: 90,
      useNativeDriver: true
    }).start();
  }, [activeIndex, position]);

  const count = options.length || 1;
  const thumbWidth = trackWidth > 0 ? (trackWidth - PADDING * 2) / count : 0;

  return (
    <View
      onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
      style={{
        flexDirection: "row",
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.md,
        padding: PADDING
      }}
    >
      {/* 滑块：绝对定位，跟随选中项在选项间滑动。 */}
      {thumbWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={{
            position: "absolute",
            top: PADDING,
            left: PADDING,
            bottom: PADDING,
            width: thumbWidth,
            borderRadius: radius.sm,
            backgroundColor: colors.surface,
            shadowColor: "#000",
            shadowOpacity: 0.06,
            shadowRadius: 4,
            shadowOffset: { width: 0, height: 1 },
            elevation: 1,
            transform: [
              {
                translateX: position.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, thumbWidth]
                })
              }
            ]
          }}
        />
      ) : null}
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            style={{
              flex: 1,
              minHeight: 38,
              borderRadius: radius.sm,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: spacing.sm
            }}
          >
            <AppText variant="bodyStrong" tone={active ? "primary" : "muted"}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  keyboardType,
  multiline = false,
  autoFocus = false,
  secureTextEntry = false
}: {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  autoFocus?: boolean;
  secureTextEntry?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: spacing.sm }}>
      {label ? <Label>{label}</Label> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        keyboardType={keyboardType}
        multiline={multiline}
        autoFocus={autoFocus}
        secureTextEntry={secureTextEntry}
        style={{
          minHeight: multiline ? 92 : 50,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.inputBackground,
          color: colors.ink,
          fontSize: 16,
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.md,
          textAlignVertical: multiline ? "top" : "center"
        }}
      />
    </View>
  );
}

export function Card({
  children,
  style,
  onPress,
  tone = "surface"
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  tone?: "surface" | "tint" | "muted";
}>) {
  const { colors } = useTheme();
  const background =
    tone === "tint" ? colors.surfaceTint : tone === "muted" ? colors.surfaceMuted : colors.surface;

  const content = (
    <View
      style={[
        {
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: background,
          padding: spacing.lg,
          gap: spacing.md
        },
        style
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.9 } : null)}>
      {content}
    </Pressable>
  );
}

export function SectionCard({ title, children }: PropsWithChildren<{ title?: string }>) {
  return (
    <Card>
      {title ? <AppText variant="section">{title}</AppText> : null}
      {children}
    </Card>
  );
}

export function Label({ children }: PropsWithChildren) {
  return <AppText variant="small" tone="soft" style={{ fontWeight: "600" }}>{children}</AppText>;
}

export function HelperText({
  children,
  tone = "muted"
}: PropsWithChildren<{ tone?: "muted" | "danger" | "success" }>) {
  const { colors } = useTheme();
  const color = tone === "danger" ? colors.danger : tone === "success" ? colors.success : colors.muted;
  return <AppText variant="small" style={{ color }}>{children}</AppText>;
}

export function StatTile({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 96,
        borderRadius: radius.md,
        backgroundColor: colors.surfaceTint,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.md,
        gap: spacing.xs
      }}
    >
      <AppText variant="title" tone="primary">{value}</AppText>
      <AppText variant="small" tone="muted">{label}</AppText>
    </View>
  );
}

export function Badge({
  label,
  tone = "neutral"
}: {
  label: string;
  tone?: "neutral" | "success" | "primary" | "danger" | "muted";
}) {
  const { colors } = useTheme();
  const map = {
    neutral: { bg: colors.surfaceMuted, fg: colors.inkSoft },
    success: { bg: colors.successSurface, fg: colors.success },
    primary: { bg: colors.surfaceTint, fg: colors.primaryInk },
    danger: { bg: colors.dangerSurface, fg: colors.danger },
    muted: { bg: colors.surfaceMuted, fg: colors.muted }
  } as const;
  const { bg, fg } = map[tone];

  return (
    <View
      style={{
        alignSelf: "flex-start",
        borderRadius: radius.pill,
        backgroundColor: bg,
        paddingHorizontal: spacing.sm,
        paddingVertical: 3
      }}
    >
      <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: "600", color: fg }}>{label}</Text>
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line }} />;
}

const WEEKDAY_PICKER_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

/**
 * 选择每周执行的星期几（0=周日 .. 6=周六）。
 * 用于「每周几天」频率，可多选。
 */
export function WeekdayPicker({
  value,
  onChange
}: {
  value: number[];
  onChange: (value: number[]) => void;
}) {
  const { colors } = useTheme();
  const selected = new Set(value);

  function toggle(day: number) {
    const next = new Set(selected);
    if (next.has(day)) {
      next.delete(day);
    } else {
      next.add(day);
    }
    onChange([...next].sort((a, b) => a - b));
  }

  return (
    <View style={{ flexDirection: "row", gap: spacing.xs }}>
      {WEEKDAY_PICKER_LABELS.map((label, day) => {
        const active = selected.has(day);
        return (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`周${label}`}
            onPress={() => toggle(day)}
            style={({ pressed }) => [
              {
                flex: 1,
                minHeight: 42,
                borderRadius: radius.sm,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? colors.primary : colors.surfaceMuted,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.line
              },
              pressed ? { opacity: 0.8 } : null
            ]}
          >
            <AppText variant="bodyStrong" tone={active ? "onPrimary" : "muted"}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SwitchRow({
  label,
  description,
  value,
  onValueChange
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{label}</AppText>
        {description ? <AppText variant="small" tone="muted">{description}</AppText> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.lineStrong, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

export function ListRow({
  onPress,
  children,
  right
}: PropsWithChildren<{ onPress?: () => void; right?: ReactNode }>) {
  const { colors } = useTheme();
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.md,
        paddingVertical: spacing.md
      }}
    >
      <View style={{ flex: 1 }}>{children}</View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.faint} /> : null)}
    </View>
  );

  if (!onPress) {
    return body;
  }
  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.6 } : null)}>
      {body}
    </Pressable>
  );
}

export { spacing, radius };
