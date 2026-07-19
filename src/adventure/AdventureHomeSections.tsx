import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo } from "react";
import { Image, Platform, Pressable, ScrollView, View } from "react-native";
import type { AdventureChapterView } from "./types";
import { resolveChapterIslandSource } from "./mapAssets";
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

/** 章节航线：board .rail-isle 紧凑卡；横向滚动时禁止子项被纵向 stretch 拉高。 */
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
  const { colors, scheme } = useTheme();
  const sorted = useMemo(
    () => [...chapters].sort((a, b) => a.sortOrder - b.sortOrder),
    [chapters]
  );

  if (sorted.length === 0) {
    return null;
  }

  const currentOrder = (() => {
    const claimable = sorted.find((c) => c.viewStatus === "claimable");
    if (claimable) return claimable.sortOrder;
    const unlocked = sorted.filter((c) => c.viewStatus !== "locked");
    return unlocked.length ? unlocked[unlocked.length - 1].sortOrder : -1;
  })();

  const rail = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      // flexGrow:0 避免在父 ScrollView 里被撑满；alignItems 防止子卡纵向拉长
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: 9, alignItems: "flex-start", paddingVertical: 2, paddingRight: 4 }}
    >
      {sorted.map((chapter) => {
        const meta = statusMeta(chapter, colors);
        const locked = chapter.viewStatus === "locked";
        const isCurrent = chapter.sortOrder === currentOrder;
        const statusLabel =
          chapter.viewStatus === "claimable" ? "当前" : chapter.viewStatus === "claimed" ? "已获" : "锁定";

        return (
          <Pressable
            key={chapter.id}
            accessibilityRole="button"
            accessibilityLabel={`${chapter.title}，${statusLabel}`}
            disabled={locked}
            onPress={() => onOpen(chapter.id)}
            style={({ pressed }) => ({
              width: 96,
              alignSelf: "flex-start",
              borderRadius: 16,
              borderWidth: isCurrent ? 1.5 : 1,
              borderColor: isCurrent ? colors.primary : colors.line,
              backgroundColor: scheme === "dark" ? colors.surface : "#FAFBFE",
              paddingTop: 10,
              paddingBottom: 10,
              paddingHorizontal: 8,
              gap: 6,
              alignItems: "center" as const,
              opacity: pressed && !locked ? 0.88 : locked ? 0.92 : 1,
              ...(isCurrent
                ? {
                    shadowColor: colors.primary,
                    shadowOpacity: 0.16,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 5 },
                    elevation: 3
                  }
                : {
                    shadowColor: "#283048",
                    shadowOpacity: 0.04,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 1
                  })
            })}
          >
            <Image
              source={resolveChapterIslandSource(chapter)}
              style={{
                width: 58,
                height: 58,
                opacity: locked ? 0.48 : 1,
                ...(Platform.OS === "web" && locked
                  ? ({ filter: "grayscale(0.8) brightness(1.05)" } as object)
                  : {})
              }}
              resizeMode="contain"
            />
            <AppText
              variant="small"
              numberOfLines={1}
              style={{
                fontWeight: "800",
                fontSize: 12,
                lineHeight: 15,
                color: locked ? colors.muted : colors.ink,
                maxWidth: 80,
                textAlign: "center"
              }}
            >
              {chapter.title}
            </AppText>
            <View
              style={{
                borderRadius: 999,
                backgroundColor: meta.bg,
                paddingHorizontal: 9,
                paddingVertical: 3,
                borderWidth: chapter.viewStatus === "claimable" ? 1 : 0,
                borderColor: chapter.viewStatus === "claimable" ? colors.primary : "transparent"
              }}
            >
              <AppText variant="small" style={{ color: meta.fg, fontWeight: "800", fontSize: 11, lineHeight: 14 }}>
                {statusLabel}
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
            <AppText variant="body" tone="soft" style={{ fontSize: 15, lineHeight: 22 }}>
              {step.text}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}
