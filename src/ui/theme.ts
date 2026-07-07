export type ColorScheme = "light" | "dark";

export type Palette = {
  // 背景层次
  background: string;
  surface: string;
  surfaceMuted: string;
  surfaceTint: string;
  // 文字
  ink: string;
  inkSoft: string;
  muted: string;
  faint: string;
  // 线条
  line: string;
  lineStrong: string;
  // 品牌与语义
  primary: string;
  primaryInk: string;
  onPrimary: string;
  // 情侣双人分色：primary/partner 分别代表「你」和「TA」
  partner: string;
  partnerInk: string;
  partnerSurface: string;
  onPartner: string;
  accent: string;
  // 庆祝动画的高光金，独立于主题主色，保证「盖章」在任何主题下都醒目
  celebration: string;
  danger: string;
  dangerSurface: string;
  success: string;
  successSurface: string;
  // 控件
  inputBackground: string;
  overlay: string;
};

// 恋恋粉紫（默认）：珊瑚粉 × 薰衣草紫
const romanceLight: Palette = {
  background: "#FDF6FA",
  surface: "#FFFFFF",
  surfaceMuted: "#F6EDF3",
  surfaceTint: "#FBE7EF",
  ink: "#2A1B24",
  inkSoft: "#5A4650",
  muted: "#8B7681",
  faint: "#B7A6B0",
  line: "#F0E2EA",
  lineStrong: "#E4D0DC",
  primary: "#E86A92",
  primaryInk: "#C24A73",
  onPrimary: "#FFFFFF",
  partner: "#8B7BD8",
  partnerInk: "#6A57BF",
  partnerSurface: "#EDE8FA",
  onPartner: "#FFFFFF",
  accent: "#8B7BD8",
  celebration: "#F6C84C",
  danger: "#C2453F",
  dangerSurface: "#F9E3E1",
  success: "#3F9E7A",
  successSurface: "#DDF1E8",
  inputBackground: "#FFFFFF",
  overlay: "rgba(42, 27, 36, 0.35)"
};

const romanceDark: Palette = {
  background: "#171014",
  surface: "#221A1F",
  surfaceMuted: "#2C222A",
  surfaceTint: "#33222C",
  ink: "#F3ECF0",
  inkSoft: "#D2C4CD",
  muted: "#9C8B96",
  faint: "#6F6069",
  line: "#352A31",
  lineStrong: "#463844",
  primary: "#F08DAD",
  primaryInk: "#F5A9C2",
  onPrimary: "#2A1019",
  partner: "#A99BE6",
  partnerInk: "#C0B4F0",
  partnerSurface: "#2E2740",
  onPartner: "#1A1330",
  accent: "#A99BE6",
  celebration: "#F6C84C",
  danger: "#F0857C",
  dangerSurface: "#3A2523",
  success: "#5FB68F",
  successSurface: "#1E3227",
  inputBackground: "#2C222A",
  overlay: "rgba(0, 0, 0, 0.55)"
};

// 海盐薄荷：清新青绿 × 天空蓝
const mintLight: Palette = {
  background: "#F2FAF9",
  surface: "#FFFFFF",
  surfaceMuted: "#E8F4F2",
  surfaceTint: "#DBF0ED",
  ink: "#10302E",
  inkSoft: "#3E5B58",
  muted: "#6E8683",
  faint: "#A3B8B5",
  line: "#DDEEEB",
  lineStrong: "#C7E2DD",
  primary: "#1FA39A",
  primaryInk: "#147F78",
  onPrimary: "#FFFFFF",
  partner: "#5B8DEF",
  partnerInk: "#3E6FD1",
  partnerSurface: "#E4EDFC",
  onPartner: "#FFFFFF",
  accent: "#5B8DEF",
  celebration: "#F6C84C",
  danger: "#C2453F",
  dangerSurface: "#F9E3E1",
  success: "#3F9E7A",
  successSurface: "#DDF1E8",
  inputBackground: "#FFFFFF",
  overlay: "rgba(16, 48, 46, 0.35)"
};

const mintDark: Palette = {
  background: "#0F1817",
  surface: "#172221",
  surfaceMuted: "#1F2C2A",
  surfaceTint: "#1C302D",
  ink: "#EAF4F2",
  inkSoft: "#C2D4D1",
  muted: "#869A96",
  faint: "#5E706D",
  line: "#283734",
  lineStrong: "#374A46",
  primary: "#4FC7BD",
  primaryInk: "#6FD9CF",
  onPrimary: "#06211E",
  partner: "#7FA8F5",
  partnerInk: "#9CBEF8",
  partnerSurface: "#23304A",
  onPartner: "#0A1428",
  accent: "#7FA8F5",
  celebration: "#F6C84C",
  danger: "#F0857C",
  dangerSurface: "#3A2523",
  success: "#5FB68F",
  successSurface: "#1E3227",
  inputBackground: "#1F2C2A",
  overlay: "rgba(0, 0, 0, 0.55)"
};

// 暮光暖阳：落日橙 × 温柔珊瑚
const sunsetLight: Palette = {
  background: "#FFF8F1",
  surface: "#FFFFFF",
  surfaceMuted: "#FBEFE2",
  surfaceTint: "#FCE7D2",
  ink: "#33241A",
  inkSoft: "#5E4A3B",
  muted: "#927A67",
  faint: "#C0AC9A",
  line: "#F3E6D8",
  lineStrong: "#E9D4C0",
  primary: "#E8823C",
  primaryInk: "#C56521",
  onPrimary: "#FFFFFF",
  partner: "#DE6A6F",
  partnerInk: "#C24A50",
  partnerSurface: "#FBE3E1",
  onPartner: "#FFFFFF",
  accent: "#DE6A6F",
  celebration: "#F6C84C",
  danger: "#C2453F",
  dangerSurface: "#F9E3E1",
  success: "#3F9E7A",
  successSurface: "#DDF1E8",
  inputBackground: "#FFFFFF",
  overlay: "rgba(51, 36, 26, 0.35)"
};

const sunsetDark: Palette = {
  background: "#1A1310",
  surface: "#251C16",
  surfaceMuted: "#2F241C",
  surfaceTint: "#35271C",
  ink: "#F5ECE3",
  inkSoft: "#D9C8B8",
  muted: "#A08D7B",
  faint: "#6F6055",
  line: "#372A20",
  lineStrong: "#4A382B",
  primary: "#F0A15E",
  primaryInk: "#F5B77E",
  onPrimary: "#2A1808",
  partner: "#EF8A8E",
  partnerInk: "#F3A8AB",
  partnerSurface: "#402426",
  onPartner: "#2A1011",
  accent: "#EF8A8E",
  celebration: "#F6C84C",
  danger: "#F0857C",
  dangerSurface: "#3A2523",
  success: "#5FB68F",
  successSurface: "#1E3227",
  inputBackground: "#2F241C",
  overlay: "rgba(0, 0, 0, 0.55)"
};

export type ThemeName = "romance" | "mint" | "sunset";

export const themes: Record<ThemeName, Record<ColorScheme, Palette>> = {
  romance: { light: romanceLight, dark: romanceDark },
  mint: { light: mintLight, dark: mintDark },
  sunset: { light: sunsetLight, dark: sunsetDark }
};

export const DEFAULT_THEME: ThemeName = "romance";

export type ThemeOption = {
  name: ThemeName;
  label: string;
  description: string;
  // [primary, partner]，用于设置页色卡预览
  swatch: [string, string];
};

export const themeOptions: ThemeOption[] = [
  { name: "romance", label: "恋恋粉紫", description: "珊瑚粉 × 薰衣草紫", swatch: [romanceLight.primary, romanceLight.partner] },
  { name: "mint", label: "海盐薄荷", description: "清新青绿 × 天空蓝", swatch: [mintLight.primary, mintLight.partner] },
  { name: "sunset", label: "暮光暖阳", description: "落日橙 × 温柔珊瑚", swatch: [sunsetLight.primary, sunsetLight.partner] }
];

// 兼容旧引用：默认主题的双 scheme palette
export const palettes: Record<ColorScheme, Palette> = themes[DEFAULT_THEME];

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999
} as const;

export type TypeScale = {
  fontSize: number;
  lineHeight: number;
  fontWeight:
    | "400"
    | "500"
    | "600"
    | "700"
    | "800";
  letterSpacing?: number;
};

export const type: Record<"display" | "title" | "section" | "body" | "bodyStrong" | "small" | "caption", TypeScale> = {
  display: { fontSize: 32, lineHeight: 38, fontWeight: "700", letterSpacing: -0.5 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: "700", letterSpacing: -0.3 },
  section: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  body: { fontSize: 16, lineHeight: 22, fontWeight: "400" },
  bodyStrong: { fontSize: 16, lineHeight: 22, fontWeight: "600" },
  small: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.4 }
};
