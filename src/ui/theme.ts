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
  // 糖果色辅助点缀（UI 装饰用，不参与业务语义）
  candySun: string;
  candySunSurface: string;
  // 暖阳深墨：sun-soft 底上的文字/图标（对齐原型 --sun-ink 金），比 candyOrange 更"金"、对比更足
  candySunInk: string;
  // 浅底深墨的其余三色（对齐原型 --sky-ink/--orange-ink/--mint-ink），用于 soft 底上的文字/图标/标签
  candySkyInk: string;
  candyOrangeInk: string;
  candyMintInk: string;
  candySky: string;
  candySkySurface: string;
  candyOrange: string;
  candyOrangeSurface: string;
};

// 恋恋粉紫（默认）：珊瑚粉 × 薰衣草紫 · 糖果社交系统
const romanceLight: Palette = {
  background: "#F3F4F8",
  surface: "#FFFFFF",
  surfaceMuted: "#F6F7FB",
  surfaceTint: "#FFE4E8",
  ink: "#1F2430",
  inkSoft: "#5B6475",
  muted: "#8B93A7",
  faint: "#B4BAC9",
  line: "#E8EBF3",
  lineStrong: "#D7DCE8",
  primary: "#FF7B8A",
  primaryInk: "#E25C70",
  onPrimary: "#FFFFFF",
  partner: "#9B8CFF",
  partnerInk: "#6B5AD6",
  partnerSurface: "#ECE8FF",
  onPartner: "#FFFFFF",
  accent: "#9B8CFF",
  celebration: "#FFC857",
  danger: "#E2554F",
  dangerSurface: "#FDE8E6",
  success: "#3FBE96",
  successSurface: "#DDF8EF",
  inputBackground: "#FAFBFE",
  overlay: "rgba(31, 36, 48, 0.38)",
  candySun: "#FFC857",
  candySunSurface: "#FFF3D6",
  candySunInk: "#B8860B",
  candySkyInk: "#3E86D1",
  candyOrangeInk: "#D67B40",
  candyMintInk: "#1F9B78",
  candySky: "#6CB8FF",
  candySkySurface: "#E3F1FF",
  candyOrange: "#FF9B6A",
  candyOrangeSurface: "#FFE7DB"
};

const romanceDark: Palette = {
  background: "#14151C",
  surface: "#1E2029",
  surfaceMuted: "#282B36",
  surfaceTint: "#3A2730",
  ink: "#F4F5F8",
  inkSoft: "#C7CCD8",
  muted: "#9399AB",
  faint: "#6A7082",
  line: "#303443",
  lineStrong: "#3E4355",
  primary: "#FF8FA0",
  primaryInk: "#FFB0BB",
  onPrimary: "#2A1016",
  partner: "#B0A3FF",
  partnerInk: "#C8BFFF",
  partnerSurface: "#2E2748",
  onPartner: "#160F30",
  accent: "#B0A3FF",
  celebration: "#FFC857",
  danger: "#F0857C",
  dangerSurface: "#3A2523",
  success: "#5FCBAA",
  successSurface: "#1A332C",
  inputBackground: "#282B36",
  overlay: "rgba(0, 0, 0, 0.58)",
  candySun: "#FFD070",
  candySunSurface: "#3A3018",
  candySunInk: "#E8B65E",
  candySkyInk: "#7FC0FF",
  candyOrangeInk: "#E8A06A",
  candyMintInk: "#63CBA9",
  candySky: "#7EC2FF",
  candySkySurface: "#1C2D42",
  candyOrange: "#FFB085",
  candyOrangeSurface: "#3A261C"
};

// 海盐薄荷：清新青绿 × 天空蓝
const mintLight: Palette = {
  background: "#F0F7F6",
  surface: "#FFFFFF",
  surfaceMuted: "#E7F2F0",
  surfaceTint: "#D8F3EE",
  ink: "#10302E",
  inkSoft: "#3E5B58",
  muted: "#6E8683",
  faint: "#A3B8B5",
  line: "#D8EBE7",
  lineStrong: "#C2DFD9",
  primary: "#2EB8AB",
  primaryInk: "#1A8F85",
  onPrimary: "#FFFFFF",
  partner: "#6CB8FF",
  partnerInk: "#3E86D1",
  partnerSurface: "#E3F1FF",
  onPartner: "#FFFFFF",
  accent: "#6CB8FF",
  celebration: "#FFC857",
  danger: "#E2554F",
  dangerSurface: "#FDE8E6",
  success: "#3FBE96",
  successSurface: "#DDF8EF",
  inputBackground: "#FFFFFF",
  overlay: "rgba(16, 48, 46, 0.35)",
  candySun: "#FFC857",
  candySunSurface: "#FFF3D6",
  candySunInk: "#B8860B",
  candySkyInk: "#3E86D1",
  candyOrangeInk: "#D67B40",
  candyMintInk: "#1F9B78",
  candySky: "#6CB8FF",
  candySkySurface: "#E3F1FF",
  candyOrange: "#FF9B6A",
  candyOrangeSurface: "#FFE7DB"
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
  celebration: "#FFC857",
  danger: "#F0857C",
  dangerSurface: "#3A2523",
  success: "#5FB68F",
  successSurface: "#1E3227",
  inputBackground: "#1F2C2A",
  overlay: "rgba(0, 0, 0, 0.55)",
  candySun: "#FFD070",
  candySunSurface: "#3A3018",
  candySunInk: "#E8B65E",
  candySkyInk: "#7FC0FF",
  candyOrangeInk: "#E8A06A",
  candyMintInk: "#63CBA9",
  candySky: "#7EC2FF",
  candySkySurface: "#1C2D42",
  candyOrange: "#FFB085",
  candyOrangeSurface: "#3A261C"
};

// 暮光暖阳：落日橙 × 温柔珊瑚
const sunsetLight: Palette = {
  background: "#F7F3EE",
  surface: "#FFFFFF",
  surfaceMuted: "#F3EBE2",
  surfaceTint: "#FFEADF",
  ink: "#2C2118",
  inkSoft: "#5E4A3B",
  muted: "#927A67",
  faint: "#C0AC9A",
  line: "#EDE2D5",
  lineStrong: "#E0D0BE",
  primary: "#FF9B6A",
  primaryInk: "#D67B40",
  onPrimary: "#FFFFFF",
  partner: "#FF7B8A",
  partnerInk: "#E25C70",
  partnerSurface: "#FFE8EC",
  onPartner: "#FFFFFF",
  accent: "#FF7B8A",
  celebration: "#FFC857",
  danger: "#E2554F",
  dangerSurface: "#FDE8E6",
  success: "#3FBE96",
  successSurface: "#DDF8EF",
  inputBackground: "#FFFFFF",
  overlay: "rgba(44, 33, 24, 0.35)",
  candySun: "#FFC857",
  candySunSurface: "#FFF3D6",
  candySunInk: "#B8860B",
  candySkyInk: "#3E86D1",
  candyOrangeInk: "#D67B40",
  candyMintInk: "#1F9B78",
  candySky: "#6CB8FF",
  candySkySurface: "#E3F1FF",
  candyOrange: "#FF9B6A",
  candyOrangeSurface: "#FFE7DB"
};

const sunsetDark: Palette = {
  background: "#17120F",
  surface: "#231C17",
  surfaceMuted: "#2E251E",
  surfaceTint: "#3A271C",
  ink: "#F5ECE3",
  inkSoft: "#D9C8B8",
  muted: "#A08D7B",
  faint: "#6F6055",
  line: "#372A20",
  lineStrong: "#4A382B",
  primary: "#FFB085",
  primaryInk: "#FFC8A8",
  onPrimary: "#2A1808",
  partner: "#FF8FA0",
  partnerInk: "#FFB0BB",
  partnerSurface: "#402426",
  onPartner: "#2A1011",
  accent: "#FF8FA0",
  celebration: "#FFC857",
  danger: "#F0857C",
  dangerSurface: "#3A2523",
  success: "#5FB68F",
  successSurface: "#1E3227",
  inputBackground: "#2E251E",
  overlay: "rgba(0, 0, 0, 0.55)",
  candySun: "#FFD070",
  candySunSurface: "#3A3018",
  candySunInk: "#E8B65E",
  candySkyInk: "#7FC0FF",
  candyOrangeInk: "#E8A06A",
  candyMintInk: "#63CBA9",
  candySky: "#7EC2FF",
  candySkySurface: "#1C2D42",
  candyOrange: "#FFB085",
  candyOrangeSurface: "#3A261C"
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

/** 糖果社交系统：更大圆角，卡片更柔软 */
export const radius = {
  sm: 14,
  md: 16,
  lg: 20,
  xl: 22,
  pill: 999
} as const;

/** 统一软阴影，避免各页面各自发明 elevation */
export const shadow = {
  // board: card 0 6px 16px rgba(40,48,72,0.035) / soft 0 10px 24px 0.06 / float 0 22px 46px 0.16
  card: {
    shadowColor: "#283048",
    shadowOpacity: 0.04,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  soft: {
    shadowColor: "#283048",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2
  },
  float: {
    shadowColor: "#283048",
    shadowOpacity: 0.16,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6
  }
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
  // v2 board：Outfit 标题用负字距（.title -0.02em），Nunito 正文不用负字距。
  // RN letterSpacing 为绝对 px，由 em×fontSize 换算：-0.02em × {25,20,15.5} ≈ {-0.5,-0.4,-0.3}。
  display: { fontSize: 25, lineHeight: 30, fontWeight: "800", letterSpacing: -0.5 },
  title: { fontSize: 20, lineHeight: 26, fontWeight: "800", letterSpacing: -0.4 },
  section: { fontSize: 15.5, lineHeight: 20, fontWeight: "700", letterSpacing: -0.3 },
  body: { fontSize: 12.5, lineHeight: 19, fontWeight: "600" },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontWeight: "700" },
  small: { fontSize: 11, lineHeight: 15, fontWeight: "700" },
  caption: { fontSize: 10, lineHeight: 14, fontWeight: "800", letterSpacing: 0 }
};

/** v2 数字负字距（.num -0.03em）。用于 Outfit 大数字（统计/进度/连续天数）。约 -0.03em × 23px。 */
export const numberLetterSpacing = -0.7;

export type TintName = "coral" | "lavender" | "mint" | "sky" | "sun" | "orange";

/**
 * v2 场景卡渐变底：对齐原型 `.tint-*`（158° 双色）。
 * light 用原型精确值；dark 用低饱和暗色对，夜间不刺眼。跨主题共用（同 candy* 逻辑）。
 */
export const tintGradients: Record<
  TintName,
  { light: { colors: [string, string]; border: string }; dark: { colors: [string, string]; border: string } }
> = {
  coral: { light: { colors: ["#FFF5F7", "#FFE7EB"], border: "#FFD6DD" }, dark: { colors: ["#2A1B1F", "#33222A"], border: "#3E2A31" } },
  lavender: { light: { colors: ["#F7F5FF", "#EDE9FF"], border: "#DDD6FF" }, dark: { colors: ["#211E2E", "#2A2545"], border: "#332C4A" } },
  mint: { light: { colors: ["#F2FCF8", "#E1F7EF"], border: "#C8F0E1" }, dark: { colors: ["#152420", "#18302A"], border: "#25423B" } },
  sky: { light: { colors: ["#F3F9FF", "#E4F0FF"], border: "#CDE5FF" }, dark: { colors: ["#161F27", "#1A2C3F"], border: "#26384A" } },
  sun: { light: { colors: ["#FFF9EC", "#FFF0CD"], border: "#FFE4A3" }, dark: { colors: ["#241E12", "#332B18"], border: "#443A22" } },
  orange: { light: { colors: ["#FFF6F0", "#FFE9DD"], border: "#FFD5BE" }, dark: { colors: ["#241A12", "#33261C"], border: "#443521" } }
};

/** 取某场景色的渐变底 Card 属性（随明暗自适应）。纯函数，供 <Card {...sceneTint("sun", scheme)} /> 使用。 */
export function sceneTint(name: TintName, scheme: ColorScheme): { gradient: [string, string]; gradientBorder: string } {
  const t = tintGradients[name][scheme];
  return { gradient: [t.colors[0], t.colors[1]], gradientBorder: t.border };
}
