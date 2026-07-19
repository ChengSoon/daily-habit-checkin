import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import { Image, Platform, Pressable, ScrollView, View } from "react-native";
import type { AdventureChapterView } from "./types";
import { resolveDefaultIslandSource } from "./mapAssets";
import { publicUrl } from "../sync/publicUrl";
import { AppButton, AppText, Card } from "../ui/Controls";
import { RewardThumb } from "../ui/RewardImage";
import { radius, sceneTint, type Palette } from "../ui/theme";
import { useTheme } from "../ui/ThemeContext";

function rewardTypeOf(chapter: AdventureChapterView): "real_world" | "virtual" {
  return chapter.rewardType === "real_pending" ? "real_world" : "virtual";
}

function statusMeta(
  chapter: AdventureChapterView,
  colors: Palette
): { label: string; bg: string; fg: string; border: string } {
  if (chapter.viewStatus === "claimed") {
    return {
      label: "已获",
      bg: colors.successSurface,
      fg: colors.candyMintInk,
      border: colors.success
    };
  }
  if (chapter.viewStatus === "claimable") {
    return {
      label: "可领",
      bg: colors.surfaceTint,
      fg: colors.primaryInk,
      border: colors.primary
    };
  }
  return {
    label: "锁定",
    bg: colors.surfaceMuted,
    fg: colors.muted,
    border: colors.line
  };
}

/** 优先展示上传徽章图，没有图再回退 emoji。 */
function BadgeVisual({
  chapter,
  size,
  dimmed = false
}: {
  chapter: AdventureChapterView;
  size: number;
  dimmed?: boolean;
}) {
  const uri = publicUrl(chapter.badgeImageKey);
  if (uri) {
    return (
      <View style={{ opacity: dimmed ? 0.45 : 1 }}>
        <RewardThumb uri={uri} type={rewardTypeOf(chapter)} size={size} />
      </View>
    );
  }

  return (
    <AppText
      style={{
        fontSize: size * 0.55,
        lineHeight: size * 0.7,
        textAlign: "center",
        opacity: dimmed ? 0.45 : 1,
        width: size
      }}
    >
      {chapter.viewStatus === "locked" ? "🔒" : chapter.badgeEmoji?.trim() || "🏅"}
    </AppText>
  );
}

/** 章节航线：一眼看到整段旅程走到哪。 */
export function JourneyRail({
  chapters,
  onOpen,
  bare = false
}: {
  chapters: AdventureChapterView[];
  onOpen: (chapterId: string) => void;
  /** board 风格：无外层 Card、无标题（由页面自带）。 */
  bare?: boolean;
}) {
  const { colors } = useTheme();
  const sorted = useMemo(
    () => [...chapters].sort((a, b) => a.sortOrder - b.sortOrder),
    [chapters]
  );

  if (sorted.length === 0) {
    return null;
  }

  const rail = (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 9 }}>
        {sorted.map((chapter) => {
          const meta = statusMeta(chapter, colors);
          const locked = chapter.viewStatus === "locked";
          return (
            <Pressable
              key={chapter.id}
              accessibilityRole="button"
              accessibilityLabel={`${chapter.title}，${meta.label}`}
              disabled={locked}
              onPress={() => onOpen(chapter.id)}
              style={({ pressed }) => {
                const isCurrent =
                  chapter.viewStatus === "claimable" ||
                  (chapter.viewStatus !== "locked" &&
                    !sorted.some((c) => c.sortOrder > chapter.sortOrder && c.viewStatus !== "locked"));
                return {
                  width: 92,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: isCurrent ? colors.primary : colors.line,
                  backgroundColor: "#FAFBFE",
                  paddingVertical: 8,
                  paddingHorizontal: 6,
                  gap: 4,
                  alignItems: "center" as const,
                  opacity: pressed && !locked ? 0.88 : 1,
                  ...(isCurrent
                    ? {
                        shadowColor: colors.primary,
                        shadowOpacity: 0.18,
                        shadowRadius: 12,
                        shadowOffset: { width: 0, height: 6 }
                      }
                    : {})
                };
              }}
            >
              <Image
                source={resolveDefaultIslandSource(chapter.mapThemeKey)}
                style={{
                  width: 56,
                  height: 56,
                  opacity: locked ? 0.5 : 1,
                  shadowColor: "#283048",
                  shadowOpacity: locked ? 0.06 : 0.12,
                  shadowRadius: 8,
                  shadowOffset: { width: 0, height: 4 },
                  ...(Platform.OS === "web" && locked
                    ? ({ filter: "grayscale(0.8) brightness(1.05)" } as object)
                    : {})
                }}
                resizeMode="contain"
              />
              <View
                style={{
                  borderRadius: 999,
                  backgroundColor: meta.bg,
                  paddingHorizontal: 8,
                  paddingVertical: 3
                }}
              >
                <AppText variant="small" style={{ color: meta.fg, fontWeight: "800", fontSize: 10.5, lineHeight: 14 }}>
                  {chapter.viewStatus === "claimable"
                    ? "当前"
                    : chapter.viewStatus === "claimed"
                      ? "已获"
                      : "锁定"}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
  );

  if (bare) {
    return rail;
  }

  return (
    <Card elevated={false} style={{ gap: 12, marginTop: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <AppText variant="section">章节航线</AppText>
        <AppText variant="small" tone="muted">
          共 {sorted.length} 站 · {sorted.filter((c) => c.viewStatus !== "locked").length} 已点亮
        </AppText>
      </View>
      {rail}
    </Card>
  );
}

/** 已获徽章墙预览：优先显示上传图。 */
export function BadgePreview({
  chapters,
  onOpenMap
}: {
  chapters: AdventureChapterView[];
  onOpenMap: () => void;
}) {
  const { colors } = useTheme();
  const claimed = useMemo(
    () => chapters.filter((chapter) => chapter.viewStatus === "claimed").sort((a, b) => a.sortOrder - b.sortOrder),
    [chapters]
  );
  const total = chapters.length;

  return (
    <Card elevated={false} style={{ gap: 12, marginTop: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <AppText variant="section">徽章收藏</AppText>
        <Pressable onPress={() => router.push("/adventure/badges")}>
          <AppText variant="caption" tone="primary" style={{ textTransform: "none", letterSpacing: 0 }}>
            {claimed.length}/{total || 0} · 全部
          </AppText>
        </Pressable>
      </View>

      {claimed.length === 0 ? (
        <View style={{ gap: 8 }}>
          <AppText variant="body" tone="muted">
            还没有徽章。去地图点亮第一座岛，读完故事就能领取。
          </AppText>
          <AppButton title="去点亮岛屿" variant="secondary" compact onPress={onOpenMap} />
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {claimed.map((chapter) => (
            <Pressable
              key={chapter.id}
              onPress={() => router.push({ pathname: "/adventure/[chapterId]", params: { chapterId: chapter.id } })}
              style={({ pressed }) => ({
                width: "30%",
                minWidth: 96,
                flexGrow: 1,
                borderRadius: radius.lg,
                borderWidth: 1,
                borderColor: colors.line,
                backgroundColor: colors.surfaceMuted,
                paddingVertical: 8,
                paddingHorizontal: 4,
                alignItems: "center",
                gap: 6,
                opacity: pressed ? 0.88 : 1
              })}
            >
              <BadgeVisual chapter={chapter} size={56} />
              <AppText variant="small" numberOfLines={1} style={{ fontWeight: "600" }}>
                {chapter.badgeName}
              </AppText>
              <AppText
                variant="caption"
                tone="muted"
                numberOfLines={1}
                style={{ textTransform: "none", letterSpacing: 0 }}
              >
                {chapter.title}
              </AppText>
            </Pressable>
          ))}
          <AppButton title="查看徽章墙" variant="secondary" compact onPress={() => router.push("/adventure/badges")} />
        </View>
      )}
    </Card>
  );
}

export function HowItWorksCard() {
  const { colors, scheme } = useTheme();
  const steps = [
    { icon: "checkmark" as const, color: colors.primaryInk, text: "每日打卡累积 XP" },
    { icon: "map-outline" as const, color: colors.partnerInk, text: "达标点亮下一座岛" },
    { icon: "medal-outline" as const, color: colors.candyMintInk, text: "读故事领徽章与奖励" }
  ];
  return (
    <Card {...sceneTint("sun", scheme)} elevated={false} style={{ gap: 10, marginTop: 4 }}>
      <AppText variant="caption" style={{ color: colors.candySunInk, textTransform: "none", letterSpacing: 0, fontWeight: "800" }}>
        How it works
      </AppText>
      <View style={{ gap: 8 }}>
        {steps.map((step) => (
          <View key={step.text} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Ionicons name={step.icon} size={16} color={step.color} />
            <AppText variant="body" tone="soft" style={{ fontSize: 12.5, lineHeight: 19 }}>
              {step.text}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}
