import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Image, Pressable, View, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { resolveDefaultIslandSource } from "../adventure/mapAssets";
import { CoupleAvatars, type CouplePerson } from "./Avatar";
import { AppText } from "./Controls";
import { formatIslandLevel, shouldUseIslandImage } from "./islandHeroLogic";
import { Palette, radius, shadow, spacing } from "./theme";
import { useTheme } from "./ThemeContext";

export type IslandHeroVariant = "today" | "profile" | "adventure";

/** 迷你进度环：只显百分比，用于今日岛屿卡角标（ProgressRing 自带 "done" 文案、尺寸偏大，这里另做紧凑版）。 */
function IslandRing({ ratio, colors }: { ratio: number; colors: Palette }) {
  const size = 54;
  const stroke = 6;
  const clamped = Math.max(0, Math.min(1, ratio));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const center = size / 2;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Defs>
          <LinearGradient id="islandRing" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={colors.primary} />
            <Stop offset="100%" stopColor={colors.candySun} />
          </LinearGradient>
        </Defs>
        <Circle cx={center} cy={center} r={r} stroke={colors.surfaceMuted} strokeWidth={stroke} fill="none" />
        <Circle
          cx={center}
          cy={center}
          r={r}
          stroke="url(#islandRing)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - clamped)}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </Svg>
      <AppText variant="bodyStrong" style={{ fontSize: 15, lineHeight: 18, color: colors.ink }}>
        {Math.round(clamped * 100)}%
      </AppText>
    </View>
  );
}

/**
 * 共同岛屿卡（v2 招牌组件）。
 * 你俩共同经营一片小岛：打卡即浇灌。出现在今日 / 我的 / 闯关顶部。
 * - variant="today"：右上迷你进度环 + 岛上双人头像
 * - variant="profile"：缩略岛 + 空间信息
 * - variant="adventure"：当前章节岛 + 章节进度条
 * 无有效 islandKey → 回退抽象柔光态（不崩、仍显双人与文案）。
 */
export function IslandHero({
  variant,
  islandKey,
  islandName,
  islandLevel,
  title,
  eyebrow,
  detail,
  ratio = 0,
  people = [],
  streakDays,
  xpBalance,
  xpAccessory,
  onPressXp,
  progressBar
}: {
  variant: IslandHeroVariant;
  /** 岛屿主题 key（lighthouse/forest/…）；经 resolveDefaultIslandSource 取图。缺失→柔光态。 */
  islandKey?: string | null;
  islandName?: string;
  islandLevel?: number;
  /** 覆盖主标题；默认用 islandName。 */
  title?: string;
  /** 顶部小标题行；缺省 adventure→「双人旅程」/ 其它→「我们的小岛 · Lv.N」。 */
  eyebrow?: string;
  /** 标题下的明细行，如「今天你们一起浇灌了 3 次」/「累计 2,480 XP · 已点亮 4/8 岛」。 */
  detail?: string;
  /** 今日完成率 0..1（today 变体的进度环）。 */
  ratio?: number;
  people?: CouplePerson[];
  streakDays?: number;
  xpBalance?: number;
  xpAccessory?: ReactNode;
  onPressXp?: () => void;
  /** adventure 变体的章节进度条。 */
  progressBar?: { ratio: number; label?: string };
}) {
  const { colors, scheme } = useTheme();
  const isDark = scheme === "dark";
  const showIsland = shouldUseIslandImage(islandKey);
  const levelLabel = formatIslandLevel(islandLevel);
  const compact = variant === "profile";
  const islandSize = compact ? 112 : 148;
  const showRing = variant === "today";

  const pill: ViewStyle = {
    backgroundColor: isDark ? colors.surface : "rgba(255,255,255,0.9)",
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    ...shadow.soft
  };

  const eyebrowText =
    eyebrow ??
    (variant === "adventure" ? "双人旅程" : `我们的小岛${levelLabel ? " · " + levelLabel : ""}`);

  return (
    <View
      style={{
        borderRadius: radius.xl,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: isDark ? colors.line : "rgba(255,255,255,0.9)",
        backgroundColor: isDark ? colors.surfaceTint : colors.candySkySurface,
        ...shadow.card
      }}
    >
      {/* 天空渐变层：蓝→薰衣草→珊瑚的斜向天空，随主题自适应 */}
      <Svg
        pointerEvents="none"
        width="100%"
        height="100%"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <Defs>
          <LinearGradient id={`sky-${variant}`} x1="0" y1="0" x2="0.7" y2="1">
            <Stop offset="0%" stopColor={isDark ? colors.surfaceMuted : colors.candySkySurface} />
            <Stop offset="52%" stopColor={isDark ? colors.surfaceTint : colors.partnerSurface} />
            <Stop offset="100%" stopColor={isDark ? colors.surface : colors.surfaceTint} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100" height="100" fill={`url(#sky-${variant})`} />
      </Svg>
      {/* 暖阳光晕 */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: -28,
          right: -12,
          width: 116,
          height: 116,
          borderRadius: 999,
          backgroundColor: colors.candySun,
          opacity: isDark ? 0.18 : 0.42
        }}
      />

      <View style={{ padding: spacing.lg, flexDirection: "row", alignItems: "center", gap: spacing.sm, minHeight: compact ? 116 : 150 }}>
        {/* 左列文案 */}
        <View style={{ flex: 1, gap: 5 }}>
          <AppText variant="caption" tone="primary" style={{ textTransform: "none", letterSpacing: 0.2 }}>
            {eyebrowText}
          </AppText>
          <AppText variant="title" style={{ fontSize: compact ? 20 : 23, lineHeight: compact ? 26 : 29, color: colors.ink }}>
            {title ?? islandName ?? "我们的小岛"}
          </AppText>
          {detail ? (
            <AppText variant="small" tone="soft" style={{ fontWeight: "600" }}>
              {detail}
            </AppText>
          ) : null}

          {variant === "adventure" && progressBar ? (
            <View style={{ gap: 5, marginTop: 4 }}>
              <View style={{ height: 8, borderRadius: 999, backgroundColor: isDark ? colors.surfaceMuted : "rgba(255,255,255,0.55)", overflow: "hidden" }}>
                <View style={{ height: "100%", width: `${Math.round(Math.max(0, Math.min(1, progressBar.ratio)) * 100)}%`, borderRadius: 999, backgroundColor: colors.primary }} />
              </View>
              {progressBar.label ? (
                <AppText variant="small" tone="muted">
                  {progressBar.label}
                </AppText>
              ) : null}
            </View>
          ) : null}

          {(typeof streakDays === "number" && streakDays > 0) || typeof xpBalance === "number" ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 6, alignItems: "center" }}>
              {typeof streakDays === "number" && streakDays > 0 ? (
                <View style={pill}>
                  <Ionicons name="flame" size={13} color={colors.primaryInk} />
                  <AppText variant="small" tone="primary" style={{ fontWeight: "800" }}>
                    连续 {streakDays} 天
                  </AppText>
                </View>
              ) : null}
              {typeof xpBalance === "number" ? (
                <Pressable onPress={onPressXp} style={pill}>
                  <Ionicons name="diamond" size={12} color={colors.partnerInk} />
                  <AppText variant="small" style={{ color: colors.partnerInk, fontWeight: "800" }}>
                    {xpBalance}
                  </AppText>
                  {xpAccessory}
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        {/* 右侧：岛图 + 岛上双人 + 今日进度环 */}
        <View style={{ width: islandSize, height: islandSize, alignItems: "center", justifyContent: "center" }}>
          {showIsland ? (
            <>
              <View
                style={{
                  position: "absolute",
                  bottom: islandSize * 0.14,
                  width: islandSize * 0.52,
                  height: islandSize * 0.1,
                  borderRadius: 999,
                  backgroundColor: "rgba(40,48,72,0.16)",
                  transform: [{ scaleX: 1.5 }]
                }}
              />
              <Image source={resolveDefaultIslandSource(islandKey)} style={{ width: islandSize, height: islandSize }} resizeMode="contain" />
              {people.length > 0 ? (
                <View style={{ position: "absolute", bottom: islandSize * 0.22 }}>
                  <CoupleAvatars people={people} size={compact ? 22 : 26} showRibbon={false} />
                </View>
              ) : null}
            </>
          ) : people.length > 0 ? (
            <CoupleAvatars people={people} size={compact ? 32 : 40} showRibbon />
          ) : null}

          {showRing ? (
            <View
              style={{
                position: "absolute",
                top: -8,
                right: -6,
                backgroundColor: isDark ? colors.surface : "rgba(255,255,255,0.92)",
                borderRadius: 999,
                padding: 3,
                ...shadow.soft
              }}
            >
              <IslandRing ratio={ratio} colors={colors} />
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
