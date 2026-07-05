import { PropsWithChildren, ReactNode } from "react";
import {
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
  style
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
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
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: compact ? spacing.md : spacing.lg,
          paddingVertical: compact ? spacing.sm : spacing.md,
          backgroundColor: background[variant],
          borderWidth: 1,
          borderColor: border[variant]
        },
        fullWidth ? { alignSelf: "stretch" } : null,
        disabled ? { opacity: 0.4 } : null,
        pressed && !disabled ? { opacity: 0.85, transform: [{ scale: 0.99 }] } : null,
        style
      ]}
    >
      <AppText variant="bodyStrong" tone={disabled ? "muted" : textTone[variant]}>
        {title}
      </AppText>
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

  return (
    <View
      style={{
        flexDirection: "row",
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.md,
        padding: 4,
        gap: 4
      }}
    >
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
              paddingHorizontal: spacing.sm,
              backgroundColor: active ? colors.surface : "transparent",
              ...(active
                ? {
                    shadowColor: "#000",
                    shadowOpacity: 0.06,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 1
                  }
                : {})
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
  multiline = false
}: {
  label?: string;
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
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
      {right ?? (onPress ? <AppText variant="body" tone="faint">›</AppText> : null)}
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
