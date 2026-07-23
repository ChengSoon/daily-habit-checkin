import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle
} from "react-native";
import Svg, { Defs, LinearGradient as SvgLinearGradient, Rect, Stop } from "react-native-svg";
import {
  buttonShadow,
  mintGradientStops,
  mixHex,
  primaryGradientStops,
  type ButtonVariant
} from "./controlButtonStyle";
import { AppText } from "./controlText";
import { Palette, radius } from "./theme";
import { useTheme } from "./ThemeContext";

type IoniconName = keyof typeof Ionicons.glyphMap;

type AppButtonProps = {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
  icon?: IoniconName;
  iconSpin?: boolean;
  style?: StyleProp<ViewStyle>;
};

type ButtonVisuals = {
  backgroundColor: string;
  borderColor: string;
  gradientId: string;
  labelColor: string;
  stops: [string, string, string];
  useGradient: boolean;
};

function ButtonIcon({ activeSpin, color, name, size }: {
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
    const loop = Animated.loop(Animated.timing(spin, {
      toValue: 1,
      duration: 900,
      easing: Easing.linear,
      useNativeDriver: true
    }));
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

function getButtonVisuals(options: {
  colors: Palette;
  themeName: string;
  variant: ButtonVariant;
  compact: boolean;
  disabled: boolean;
}): ButtonVisuals {
  const { colors, themeName, variant, compact, disabled } = options;
  const backgrounds: Record<ButtonVariant, string> = {
    primary: colors.primary,
    secondary: colors.partnerSurface,
    ghost: colors.surface,
    danger: colors.dangerSurface,
    mint: colors.success
  };
  const labelColors: Record<ButtonVariant, string> = {
    primary: colors.onPrimary,
    secondary: colors.partnerInk,
    ghost: colors.ink,
    danger: colors.danger,
    mint: colors.onPrimary
  };
  const borders: Partial<Record<ButtonVariant, string>> = {
    ghost: colors.lineStrong,
    secondary: mixHex(colors.partner, "#FFFFFF", 0.55),
    danger: mixHex(colors.danger, "#FFFFFF", 0.7)
  };
  return {
    backgroundColor: disabled ? colors.surfaceMuted : backgrounds[variant],
    borderColor: disabled ? colors.lineStrong : borders[variant] ?? "transparent",
    gradientId: `btn-${variant}-${themeName}-${compact ? "c" : "n"}-${colors.primary.replace("#", "")}`,
    labelColor: disabled ? colors.muted : labelColors[variant],
    stops: variant === "mint" ? mintGradientStops(colors) : primaryGradientStops(colors, themeName),
    useGradient: (variant === "primary" || variant === "mint") && !disabled
  };
}

function ButtonGradient({ gradientId, stops }: Pick<ButtonVisuals, "gradientId" | "stops">) {
  return (
    <Svg pointerEvents="none" viewBox="0 0 200 56" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
      <Defs>
        <SvgLinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={stops[0]} />
          <Stop offset="55%" stopColor={stops[1]} />
          <Stop offset="100%" stopColor={stops[2]} />
        </SvgLinearGradient>
      </Defs>
      <Rect x="0" y="0" width="200" height="56" fill={`url(#${gradientId})`} />
    </Svg>
  );
}

function ButtonFace(props: AppButtonProps & { visuals: ButtonVisuals }) {
  const { compact = false, disabled = false, icon, iconSpin = false, title, variant = "primary", visuals } = props;
  const outlined = variant === "ghost" || variant === "secondary" || variant === "danger";
  return (
    <View style={{
      minHeight: compact ? 38 : 48,
      borderRadius: radius.pill,
      overflow: "hidden",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: compact ? 5 : 7,
      paddingHorizontal: compact ? 14 : 18,
      paddingVertical: compact ? 9 : 13,
      backgroundColor: visuals.useGradient ? "transparent" : visuals.backgroundColor,
      borderWidth: outlined ? 1 : 0,
      borderColor: visuals.borderColor
    }}>
      {visuals.useGradient ? <ButtonGradient gradientId={visuals.gradientId} stops={visuals.stops} /> : null}
      {!visuals.useGradient && !disabled && (variant === "secondary" || variant === "ghost") ? (
        <View pointerEvents="none" style={styles.topHighlight} />
      ) : null}
      {icon ? <View style={styles.icon}><ButtonIcon
        activeSpin={iconSpin} name={icon} size={compact ? 16 : 17} color={visuals.labelColor}
      /></View> : null}
      <AppText variant="bodyStrong" style={[
        styles.label,
        { fontSize: compact ? 14 : 15, lineHeight: compact ? 18 : 20, color: visuals.labelColor }
      ]}>{title}</AppText>
    </View>
  );
}

export function AppButton({ variant = "primary", disabled = false, compact = false, ...props }: AppButtonProps) {
  const { colors, themeName } = useTheme();
  const visuals = getButtonVisuals({ colors, themeName, variant, compact, disabled });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={props.onPress}
      style={({ pressed }) => [
        {
          borderRadius: radius.pill,
          ...buttonShadow(variant, colors, { pressed: pressed && !disabled, disabled }),
          transform: pressed && !disabled
            ? [{ translateY: 1.5 }, { scale: 0.985 }]
            : [{ translateY: 0 }, { scale: 1 }]
        },
        props.fullWidth ? { alignSelf: "stretch" } : null,
        props.style
      ]}
    >
      <ButtonFace {...props} compact={compact} disabled={disabled} variant={variant} visuals={visuals} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topHighlight: {
    ...StyleSheet.absoluteFill,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.35)"
  },
  icon: { zIndex: 1, marginTop: 0.5 },
  label: { zIndex: 1, fontWeight: "800", letterSpacing: 0.2 }
});

export function IconButton({ name, onPress, disabled = false, accessibilityLabel, tone = "muted" }: {
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
