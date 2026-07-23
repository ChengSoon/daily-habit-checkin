import { ViewStyle } from "react-native";
import { Palette } from "./theme";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "mint";

const DISABLED_SHADOW: ViewStyle = {
  shadowColor: "#283048",
  shadowOpacity: 0.05,
  shadowRadius: 5,
  shadowOffset: { width: 0, height: 2 },
  elevation: 0
};

export function mixHex(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const h = hex.replace("#", "").trim();
    const full = h.length === 3 ? h.split("").map((char) => char + char).join("") : h;
    if (full.length < 6) return [0, 0, 0];
    return [0, 2, 4].map((index) => Number.parseInt(full.slice(index, index + 2), 16));
  };
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)));
  const channels = [clamp(ar + (br - ar) * t), clamp(ag + (bg - ag) * t), clamp(ab + (bb - ab) * t)];
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

const lighten = (hex: string, amount: number) => mixHex(hex, "#FFFFFF", amount);
const darken = (hex: string, amount: number) => mixHex(hex, "#000000", amount);

export function buttonShadow(
  variant: ButtonVariant,
  colors: Palette,
  state: { pressed: boolean; disabled: boolean }
): ViewStyle {
  if (state.disabled) return DISABLED_SHADOW;
  const baseColor = buttonShadowColor(variant, colors);
  if (state.pressed) {
    return shadow(baseColor, 0.18, { radius: 7, offsetHeight: 3, elevation: 2 });
  }
  if (variant === "primary" || variant === "mint") {
    return shadow(baseColor, 0.36, { radius: 14, offsetHeight: 8, elevation: 7 });
  }
  if (variant === "secondary" || variant === "danger") {
    return shadow(baseColor, 0.18, { radius: 12, offsetHeight: 6, elevation: 4 });
  }
  return shadow("#283048", 0.1, { radius: 10, offsetHeight: 4, elevation: 3 });
}

function buttonShadowColor(variant: ButtonVariant, colors: Palette): string {
  if (variant === "primary") return colors.primary;
  if (variant === "mint") return colors.success;
  if (variant === "secondary") return colors.partner;
  if (variant === "danger") return colors.danger;
  return "#283048";
}

function shadow(
  shadowColor: string,
  shadowOpacity: number,
  options: { radius: number; offsetHeight: number; elevation: number }
): ViewStyle {
  return {
    shadowColor,
    shadowOpacity,
    shadowRadius: options.radius,
    shadowOffset: { width: 0, height: options.offsetHeight },
    elevation: options.elevation
  };
}

export function primaryGradientStops(colors: Palette, themeName: string): [string, string, string] {
  if (themeName === "mint") return [lighten(colors.primary, 0.06), colors.primary, darken(colors.primary, 0.1)];
  if (themeName === "sunset") {
    return [lighten(colors.primary, 0.06), colors.primary, darken(colors.candyOrange, 0.05)];
  }
  return [lighten(colors.primary, 0.06), colors.primary, mixHex(colors.primary, colors.candyOrange, 0.4)];
}

export function mintGradientStops(colors: Palette): [string, string, string] {
  return [lighten(colors.success, 0.06), colors.success, darken(colors.success, 0.08)];
}
