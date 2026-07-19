import { Ionicons } from "@expo/vector-icons";
import { PropsWithChildren, ReactNode, useEffect, useState } from "react";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from "react-native-svg";
import {
  Animated,
  Easing,
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
import { numberLetterSpacing, Palette, radius, shadow, spacing, type as typeScale } from "./theme";
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

/** board 同款字体：Outfit 用于标题/数字，Nunito 用于正文。按 useFonts 注册的键名映射。 */
function fontFamilyForVariant(variant: TextVariant): string {
  switch (variant) {
    case "display":
    case "title":
      return "Outfit_800ExtraBold";
    case "section":
      return "Outfit_700Bold";
    case "bodyStrong":
      // board .rowtitle: Outfit 700
      return "Outfit_700Bold";
    case "caption":
      return "Nunito_800ExtraBold";
    case "small":
      return "Nunito_700Bold";
    case "body":
    default:
      return "Nunito_500Medium";
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
          fontFamily: fontFamilyForVariant(variant),
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

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "mint";

function ButtonIcon({
  activeSpin,
  color,
  name,
  size
}: {
  activeSpin: boolean;
  color: string;
  name: IoniconName;
  size: number;
}) {
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!activeSpin) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    loop.start();

    return () => {
      loop.stop();
      spin.setValue(0);
    };
  }, [activeSpin, spin]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  return (
    <Animated.View style={activeSpin ? { transform: [{ rotate }] } : null}>
      <Ionicons name={name} size={size} color={color} />
    </Animated.View>
  );
}


/** 简易色值混合，给按钮做同色系深浅渐变（避免跨色相脏边）。 */
function mixHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "").trim();
    const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
    if (full.length < 6) return [0, 0, 0];
    return [0, 2, 4].map((i) => Number.parseInt(full.slice(i, i + 2), 16));
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  const r = clamp(ar + (br - ar) * t);
  const g = clamp(ag + (bg - ag) * t);
  const bch = clamp(ab + (bb - ab) * t);
  return `#${[r, g, bch].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function lighten(hex: string, amount: number): string {
  return mixHex(hex, "#FFFFFF", amount);
}

function darken(hex: string, amount: number): string {
  return mixHex(hex, "#000000", amount);
}

function buttonShadow(
  variant: ButtonVariant,
  colors: Palette,
  pressed: boolean,
  disabled: boolean
): ViewStyle {
  if (disabled) {
    return {
      shadowColor: "#283048",
      shadowOpacity: 0.05,
      shadowRadius: 5,
      shadowOffset: { width: 0, height: 2 },
      elevation: 0
    };
  }

  const baseColor =
    variant === "primary"
      ? colors.primary
      : variant === "mint"
        ? colors.success
        : variant === "secondary"
          ? colors.partner
          : variant === "danger"
            ? colors.danger
            : "#283048";

  if (pressed) {
    return {
      shadowColor: baseColor,
      shadowOpacity: 0.18,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2
    };
  }

  if (variant === "primary" || variant === "mint") {
    return {
      shadowColor: baseColor,
      shadowOpacity: 0.36,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 8 },
      elevation: 7
    };
  }

  if (variant === "secondary" || variant === "danger") {
    return {
      shadowColor: baseColor,
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4
    };
  }

  return {
    shadowColor: "#283048",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3
  };
}

function primaryGradientStops(colors: Palette, themeName: string): [string, string, string] {
  // 同色系微立体：顶端只轻微提亮，避免出现白边；底端略压深。
  if (themeName === "mint") {
    return [lighten(colors.primary, 0.06), colors.primary, darken(colors.primary, 0.1)];
  }
  if (themeName === "sunset") {
    return [lighten(colors.primary, 0.06), colors.primary, darken(colors.candyOrange, 0.05)];
  }
  return [lighten(colors.primary, 0.06), colors.primary, mixHex(colors.primary, colors.candyOrange, 0.4)];
}

function mintGradientStops(colors: Palette): [string, string, string] {
  return [lighten(colors.success, 0.06), colors.success, darken(colors.success, 0.08)];
}

export function AppButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  compact = false,
  fullWidth = false,
  icon,
  iconSpin = false,
  style
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  icon?: IoniconName;
  iconSpin?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors, themeName } = useTheme();

  const background: Record<ButtonVariant, string> = {
    primary: colors.primary,
    secondary: colors.partnerSurface,
    ghost: colors.surface,
    danger: colors.dangerSurface,
    mint: colors.success
  };
  const textTone: Record<ButtonVariant, TextTone> = {
    primary: "onPrimary",
    secondary: "primary",
    ghost: "default",
    danger: "danger",
    mint: "onPrimary"
  };
  const iconColor = disabled ? colors.muted : toneColor(colors, textTone[variant]);
  const useGradient = (variant === "primary" || variant === "mint") && !disabled;
  const gradientId = `btn-${variant}-${themeName}-${compact ? "c" : "n"}-${colors.primary.replace("#", "")}`;

  const stops =
    variant === "mint" ? mintGradientStops(colors) : primaryGradientStops(colors, themeName);

  const labelColor = disabled
    ? colors.muted
    : variant === "secondary"
      ? colors.partnerInk
      : variant === "danger"
        ? colors.danger
        : variant === "ghost"
          ? colors.ink
          : colors.onPrimary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        {
          borderRadius: radius.pill,
          ...buttonShadow(variant, colors, pressed && !disabled, disabled),
          transform:
            pressed && !disabled
              ? [{ translateY: 1.5 }, { scale: 0.985 }]
              : [{ translateY: 0 }, { scale: 1 }]
        },
        fullWidth ? { alignSelf: "stretch" } : null,
        style
      ]}
    >
      <View
        style={{
          minHeight: compact ? 38 : 48,
          borderRadius: radius.pill,
          overflow: "hidden",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: compact ? 5 : 7,
          paddingHorizontal: compact ? 14 : 18,
          paddingVertical: compact ? 9 : 13,
          backgroundColor: disabled ? colors.surfaceMuted : useGradient ? "transparent" : background[variant],
          borderWidth: variant === "ghost" || variant === "secondary" || variant === "danger" ? 1 : 0,
          borderColor: disabled
            ? colors.lineStrong
            : variant === "ghost"
              ? colors.lineStrong
              : variant === "secondary"
                ? mixHex(colors.partner, "#FFFFFF", 0.55)
                : variant === "danger"
                  ? mixHex(colors.danger, "#FFFFFF", 0.7)
                  : "transparent"
        }}
      >
        {useGradient ? (
          <Svg
            pointerEvents="none"
            viewBox="0 0 200 56"
            preserveAspectRatio="none"
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              {/* 自上而下同色系微立体，不再叠白色 sheen，避免顶边发白 */}
              <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={stops[0]} />
                <Stop offset="55%" stopColor={stops[1]} />
                <Stop offset="100%" stopColor={stops[2]} />
              </SvgLinearGradient>
            </Defs>
            <Rect x="0" y="0" width="200" height="56" fill={`url(#${gradientId})`} />
          </Svg>
        ) : null}

        {/* secondary / ghost 也加极轻顶部高光 */}
        {!useGradient && !disabled && (variant === "secondary" || variant === "ghost") ? (
          <View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFill,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: "rgba(255,255,255,0.35)"
            }}
          />
        ) : null}

        {icon ? (
          <View style={{ zIndex: 1, marginTop: 0.5 }}>
            <ButtonIcon
              activeSpin={iconSpin}
              name={icon}
              size={compact ? 16 : 17}
              color={labelColor}
            />
          </View>
        ) : null}
        <AppText
          variant="bodyStrong"
          style={{
            zIndex: 1,
            fontSize: compact ? 14 : 15,
            lineHeight: compact ? 18 : 20,
            fontWeight: "800",
            letterSpacing: 0.2,
            color: labelColor
          }}
        >
          {title}
        </AppText>
      </View>
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
          width: 40,
          height: 40,
          borderRadius: radius.pill,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.line,
          shadowColor: "#283048",
          shadowOpacity: pressed && !disabled ? 0.06 : 0.12,
          shadowRadius: pressed && !disabled ? 4 : 8,
          shadowOffset: { width: 0, height: pressed && !disabled ? 2 : 4 },
          elevation: pressed && !disabled ? 1 : 3
        },
        disabled ? { opacity: 0.35 } : null,
        pressed && !disabled ? { opacity: 0.9, transform: [{ translateY: 1 }, { scale: 0.96 }] } : null
      ]}
    >
      <Ionicons name={name} size={16} color={disabled ? colors.faint : color} />
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
        borderRadius: radius.pill,
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
            borderRadius: radius.pill,
            backgroundColor: colors.surface,
            shadowColor: "#283048",
            shadowOpacity: 0.08,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 3 },
            elevation: 2,
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
              minHeight: 36,
              borderRadius: 999,
              alignItems: "center",
              justifyContent: "center",
              paddingHorizontal: 8
            }}
          >
            <AppText
              variant="bodyStrong"
              style={{
                color: active ? colors.primaryInk : colors.muted,
                fontWeight: "800",
                fontSize: 14
              }}
            >
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
  secureTextEntry = false,
  disabled = false
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
  disabled?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View style={{ gap: 8 }}>
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
        editable={!disabled}
        style={[
          {
            minHeight: multiline ? 88 : 48,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.inputBackground,
            color: colors.ink,
            fontSize: 15,
            fontFamily: "Nunito_500Medium",
            paddingHorizontal: 14,
            paddingVertical: 12,
            textAlignVertical: multiline ? "top" : "center"
          },
          disabled ? { opacity: 0.55 } : null
        ]}
      />
    </View>
  );
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
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  tone?: "surface" | "tint" | "muted";
  /** 直接指定场景色底（如 candySunSurface）；优先于 tone。用于 v2 彩色场景卡。 */
  tintColor?: string;
  /** v2 场景卡双色渐变底（对齐原型 .tint-*）。优先于 tintColor/tone。配合 theme.sceneTint 使用。 */
  gradient?: readonly [string, string];
  /** 渐变卡的描边色（原型 .tint-* 各有专属 border）。 */
  gradientBorder?: string;
  /** board 默认扁平白卡；需要浮起时显式 elevated。 */
  elevated?: boolean;
}>) {
  const { colors } = useTheme();
  const hasGradient = Array.isArray(gradient);
  const background =
    tintColor ?? (tone === "tint" ? colors.surfaceTint : tone === "muted" ? colors.surfaceMuted : colors.surface);
  // 渐变 id 由色值推导：同色对共享无害，异色对天然唯一，避免 web 上 SVG defs id 冲突。
  const gradId = gradient ? `cg${gradient[0].replace(/[^0-9a-z]/gi, "")}${gradient[1].replace(/[^0-9a-z]/gi, "")}` : "";

  // 渐变卡底色用渐变终点色兜底：SVG 在圆角抗锯齿/部分端上铺不满时，
  // 不再露出白色 surface，避免右下角「缺一块」的观感。
  const gradientFallback = hasGradient && gradient ? gradient[1] : background;
  const [cardSize, setCardSize] = useState({ width: 0, height: 0 });

  const content = (
    <View
      onLayout={(event) => {
        if (!hasGradient) {
          return;
        }
        const { width, height } = event.nativeEvent.layout;
        if (width !== cardSize.width || height !== cardSize.height) {
          setCardSize({ width, height });
        }
      }}
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
      {gradient && cardSize.width > 0 && cardSize.height > 0 ? (
        <Svg
          pointerEvents="none"
          width={cardSize.width}
          height={cardSize.height}
          style={{ position: "absolute", top: 0, left: 0 }}
        >
          <Defs>
            {/* 原型 158° 双色；两色极近，方向近似即可 */}
            <SvgLinearGradient id={gradId} x1="0.15" y1="0" x2="0.85" y2="1">
              <Stop offset="0%" stopColor={gradient[0]} />
              <Stop offset="100%" stopColor={gradient[1]} />
            </SvgLinearGradient>
          </Defs>
          {/* 像素级外扩 2px，盖住圆角抗锯齿缝 */}
          <Rect
            x={-2}
            y={-2}
            width={cardSize.width + 4}
            height={cardSize.height + 4}
            fill={`url(#${gradId})`}
          />
        </Svg>
      ) : null}
      {children}
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => (pressed ? { opacity: 0.92, transform: [{ scale: 0.995 }] } : null)}>
      {content}
    </Pressable>
  );
}

export function SectionCard({ title, children }: PropsWithChildren<{ title?: string }>) {
  // board 表单区：白卡 + 细描边，不用重阴影
  return (
    <Card elevated={false}>
      {title ? <AppText variant="section">{title}</AppText> : null}
      {children}
    </Card>
  );
}

export function Label({ children }: PropsWithChildren) {
  return (
    <AppText variant="small" tone="soft" style={{ fontWeight: "800", fontSize: 13 }}>
      {children}
    </AppText>
  );
}

export function HelperText({
  children,
  tone = "muted"
}: PropsWithChildren<{ tone?: "muted" | "danger" | "success" }>) {
  const { colors } = useTheme();
  const color = tone === "danger" ? colors.danger : tone === "success" ? colors.success : colors.muted;
  return <AppText variant="small" style={{ color }}>{children}</AppText>;
}

export function StatTile({
  label,
  value,
  tint,
  labelColor,
  valueColor
}: {
  label: string;
  value: string;
  /** 可选色块底，默认 surfaceTint */
  tint?: string;
  labelColor?: string;
  valueColor?: string;
}) {
  const { colors } = useTheme();
  const fg = valueColor ?? colors.primaryInk;
  return (
    <View
      style={{
        flex: 1,
        minWidth: 96,
        borderRadius: 15,
        backgroundColor: tint ?? colors.surfaceTint,
        paddingHorizontal: 12,
        paddingVertical: 11,
        gap: 4
      }}
    >
      <AppText variant="small" style={{ color: labelColor ?? fg, fontWeight: "800", fontSize: 12, lineHeight: 16 }}>
        {label}
      </AppText>
      <AppText
        variant="title"
        style={{ color: fg, fontSize: 26, lineHeight: 32, letterSpacing: numberLetterSpacing, fontFamily: "Outfit_800ExtraBold" }}
      >
        {value}
      </AppText>
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
    success: { bg: colors.successSurface, fg: colors.candyMintInk },
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
        paddingHorizontal: 9,
        paddingVertical: 4
      }}
    >
      <Text style={{ fontSize: 12, lineHeight: 16, fontWeight: "800", fontFamily: "Nunito_800ExtraBold", color: fg }}>
        {label}
      </Text>
    </View>
  );
}

export function Divider() {
  const { colors } = useTheme();
  // board .list-item border-top: 1px solid var(--line)
  return <View style={{ height: 1, backgroundColor: colors.line }} />;
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
    <View style={{ flexDirection: "row", gap: 4 }}>
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
                minHeight: 36,
                borderRadius: 999,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: active ? colors.primary : colors.surfaceMuted,
                borderWidth: 1,
                borderColor: active ? colors.primary : colors.line
              },
              pressed ? { opacity: 0.8 } : null
            ]}
          >
            <AppText
              variant="bodyStrong"
              style={{
                color: active ? colors.onPrimary : colors.muted,
                fontSize: 14,
                fontWeight: "800"
              }}
            >
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
  onValueChange,
  disabled = false
}: {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong" style={{ fontSize: 15 }}>
          {label}
        </AppText>
        {description ? <AppText variant="small" tone="muted">{description}</AppText> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{ false: colors.lineStrong, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

export function ListRow({
  onPress,
  children,
  right,
  icon,
  iconBg,
  iconColor
}: PropsWithChildren<{
  onPress?: () => void;
  right?: ReactNode;
  /** 左侧 icon-chip（Ionicons）。 */
  icon?: IoniconName;
  iconBg?: string;
  iconColor?: string;
}>) {
  const { colors } = useTheme();
  const body = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 11,
        paddingVertical: 11
      }}
    >
      {icon ? (
        <View
          style={{
            width: 38,
            height: 38,
            borderRadius: 13,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: iconBg ?? colors.surfaceMuted
          }}
        >
          <Ionicons name={icon} size={16} color={iconColor ?? colors.primaryInk} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>{children}</View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={15} color={colors.faint} /> : null)}
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

export { spacing, radius, shadow };
