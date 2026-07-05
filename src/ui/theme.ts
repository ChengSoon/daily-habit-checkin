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
  accent: string;
  danger: string;
  dangerSurface: string;
  success: string;
  successSurface: string;
  // 控件
  inputBackground: string;
  overlay: string;
};

const light: Palette = {
  background: "#F6F7F5",
  surface: "#FFFFFF",
  surfaceMuted: "#EFF1EE",
  surfaceTint: "#E8F0EB",
  ink: "#16201B",
  inkSoft: "#3A453F",
  muted: "#6B7770",
  faint: "#9AA39D",
  line: "#E4E8E4",
  lineStrong: "#D2D8D3",
  primary: "#2F6B4F",
  primaryInk: "#1E4D38",
  onPrimary: "#FFFFFF",
  accent: "#2C6BC9",
  danger: "#B3261E",
  dangerSurface: "#F7E7E4",
  success: "#2F6B4F",
  successSurface: "#DEEFDD",
  inputBackground: "#FFFFFF",
  overlay: "rgba(20, 32, 27, 0.35)"
};

const dark: Palette = {
  background: "#101512",
  surface: "#1A211D",
  surfaceMuted: "#232B26",
  surfaceTint: "#1F2E26",
  ink: "#ECF1ED",
  inkSoft: "#C4CDC7",
  muted: "#8C968F",
  faint: "#6A736D",
  line: "#2C342E",
  lineStrong: "#3A443D",
  primary: "#5BAE85",
  primaryInk: "#8FD3AE",
  onPrimary: "#0C130F",
  accent: "#6EA8F0",
  danger: "#F0857C",
  dangerSurface: "#3A2523",
  success: "#5BAE85",
  successSurface: "#1E3227",
  inputBackground: "#232B26",
  overlay: "rgba(0, 0, 0, 0.55)"
};

export const palettes: Record<ColorScheme, Palette> = { light, dark };

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
  caption: { fontSize: 11, lineHeight: 14, fontWeight: "600", letterSpacing: 0.4 }
};
