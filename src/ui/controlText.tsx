import { PropsWithChildren } from "react";
import { StyleProp, Text, TextStyle } from "react-native";
import { type as typeScale, type Palette } from "./theme";
import { useTheme } from "./ThemeContext";

type TextVariant = "display" | "title" | "section" | "body" | "bodyStrong" | "small" | "caption";
type TextTone = "default" | "soft" | "muted" | "faint" | "primary" | "danger" | "onPrimary";

function toneColor(colors: Palette, tone: TextTone): string {
  switch (tone) {
    case "soft": return colors.inkSoft;
    case "muted": return colors.muted;
    case "faint": return colors.faint;
    case "primary": return colors.primaryInk;
    case "danger": return colors.danger;
    case "onPrimary": return colors.onPrimary;
    default: return colors.ink;
  }
}

function fontFamilyForVariant(variant: TextVariant): string {
  switch (variant) {
    case "display":
    case "title":
      return "Outfit_800ExtraBold";
    case "section":
    case "bodyStrong":
      return "Outfit_700Bold";
    case "caption":
      return "Nunito_800ExtraBold";
    case "small":
      return "Nunito_700Bold";
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
