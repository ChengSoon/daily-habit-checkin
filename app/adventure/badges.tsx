import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Image, Platform, Pressable, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import {
  buildBadgeWallItems,
  selectPendingClaims
} from "../../src/adventure/badgeWall";
import { loadAdventureState } from "../../src/adventure/adventureService";
import { resolveDefaultIslandSource } from "../../src/adventure/mapAssets";
import type { AdventureState } from "../../src/adventure/types";
import { publicUrl } from "../../src/sync/publicUrl";
import { AppText, Badge, Card } from "../../src/ui/Controls";
import { RewardThumb } from "../../src/ui/RewardImage";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { useTheme } from "../../src/ui/ThemeContext";

type BadgeWallItem = ReturnType<typeof buildBadgeWallItems>[number];
type PendingClaim = ReturnType<typeof selectPendingClaims>[number];
type Chapter = AdventureState["chapters"][number];

function PendingClaims({ claims }: { claims: PendingClaim[] }) {
  if (claims.length === 0) return null;
  return <Card elevated={false} style={{ gap: 9, marginBottom: 8 }}>
    <AppText variant="section">待兑现惊喜</AppText>
    {claims.map((claim) => <Pressable key={claim.id}
      onPress={() => router.push({ pathname: "/adventure/[chapterId]", params: { chapterId: claim.chapterId } })}
      style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 9, opacity: pressed ? 0.88 : 1 })}>
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="bodyStrong">{claim.badgeEmoji ?? "🎁"} {claim.badgeName}</AppText>
        <AppText variant="caption" tone="muted" style={{ textTransform: "none" }}>{claim.chapterTitle}</AppText>
      </View>
      <Badge label="待兑现" tone="primary" />
    </Pressable>)}
  </Card>;
}

function BadgeImage({ item, chapter, claimed }: { item: BadgeWallItem; chapter?: Chapter; claimed: boolean }) {
  const active = claimed || item.viewStatus === "claimable";
  if (item.badgeImageKey) return <RewardThumb uri={publicUrl(item.badgeImageKey)}
    type={item.rewardType === "real_pending" ? "real_world" : "virtual"} size={58} />;
  if (chapter) return <Image source={resolveDefaultIslandSource(chapter.mapThemeKey)} style={{
    width: 58, height: 58, opacity: active ? 1 : 0.42, shadowColor: "#283048",
    shadowOpacity: active ? 0.16 : 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 6 },
    ...(Platform.OS === "web" && !active ? ({ filter: "grayscale(0.85) brightness(1.05)" } as object) : {})
  }} resizeMode="contain" />;
  return <AppText style={{ fontSize: 32, lineHeight: 40, opacity: claimed ? 1 : 0.42 }}>
    {claimed ? item.badgeEmoji?.trim() || "🏅" : item.viewStatus === "claimable" ? "✨" : "🔒"}
  </AppText>;
}

function BadgeTile({ item, chapter }: { item: BadgeWallItem; chapter?: Chapter }) {
  const { colors } = useTheme();
  const claimed = item.kind === "claimed";
  return <Pressable onPress={() => router.push({ pathname: "/adventure/[chapterId]", params: { chapterId: item.chapterId } })}
    style={({ pressed }) => ({ width: "31%", flexGrow: 1, minWidth: 96, borderRadius: 16, borderWidth: 1,
      borderColor: item.viewStatus === "claimable" ? colors.primary : colors.line,
      backgroundColor: claimed ? "#FAFBFE" : colors.surfaceMuted, paddingTop: 10, paddingHorizontal: 6,
      paddingBottom: 8, gap: 3, alignItems: "center", opacity: pressed ? 0.9 : 1 })}>
    <BadgeImage item={item} chapter={chapter} claimed={claimed} />
    <AppText variant="small" numberOfLines={1} style={{ fontWeight: "800", fontSize: 12, textAlign: "center",
      color: claimed || item.viewStatus === "claimable" ? colors.ink : colors.faint }}>
      {chapter?.title ?? item.badgeName}
    </AppText>
  </Pressable>;
}

function BadgeGrid({ items, chapters }: { items: BadgeWallItem[]; chapters: Chapter[] }) {
  const chapterByBadge = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>
    {items.map((item) => <BadgeTile key={item.chapterId} item={item} chapter={chapterByBadge.get(item.chapterId)} />)}
  </View>;
}

function NextBadgeHint({ claimedCount, total }: { claimedCount: number; total: number }) {
  const { colors } = useTheme();
  if (claimedCount >= total) return null;
  const ratio = Math.min(100, Math.round((claimedCount / Math.max(total, 1)) * 100));
  return <Card elevated={false} style={{ marginTop: 8, flexDirection: "row", alignItems: "center", gap: 11 }}>
    <View style={{ width: 38, height: 38, borderRadius: 13, backgroundColor: colors.candySunSurface, alignItems: "center", justifyContent: "center" }}>
      <Ionicons name="sparkles" size={18} color={colors.candySunInk} />
    </View>
    <View style={{ flex: 1, gap: 4 }}>
      <AppText variant="bodyStrong">下一枚徽章</AppText>
      <AppText variant="body" tone="muted">继续累积 XP，点亮下一座岛即可领取</AppText>
      <View style={{ height: 9, borderRadius: 999, backgroundColor: "#EEF1F7", overflow: "hidden", marginTop: 4 }}>
        <View style={{ height: "100%", width: `${ratio}%`, borderRadius: 999, overflow: "hidden" }}>
          <Svg width="200" height="9" viewBox="0 0 100 9" preserveAspectRatio="none" style={{ width: "100%", height: 9 }}>
            <Defs><LinearGradient id="badgeProg" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0%" stopColor={colors.partner} /><Stop offset="100%" stopColor={colors.candySky} />
            </LinearGradient></Defs>
            <Rect x="0" y="0" width="100" height="9" fill="url(#badgeProg)" />
          </Svg>
        </View>
      </View>
    </View>
  </Card>;
}

export default function AdventureBadgesScreen() {
  const { colors } = useTheme();
  const [state, setState] = useState<AdventureState | null>(null);

  const load = useCallback(async () => {
    setState(await loadAdventureState());
  }, []);

  const { status, errorMessage, reload } = useSyncScreen(load);

  const items = useMemo(() => (state ? buildBadgeWallItems(state) : []), [state]);
  const pending = useMemo(() => (state ? selectPendingClaims(state) : []), [state]);
  const claimedCount = items.filter((item) => item.kind === "claimed").length;

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  if (!state) {
    return <SyncFallback status="loading" errorMessage={errorMessage} onRetry={reload} />;
  }

  return (
    <Screen>
      <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }} hitSlop={8}>
        <Ionicons name="chevron-back" size={16} color={colors.inkSoft} />
        <AppText variant="small" tone="soft">返回</AppText>
      </Pressable>
      <View style={{ gap: 6, marginBottom: 8 }}>
        <AppText variant="display">徽章墙</AppText>
        <AppText variant="body" tone="muted">
          把共同坚持，变成看得见的纪念
        </AppText>
        <AppText variant="small" tone="faint">
          已获 {claimedCount} / {items.length} · 累计 {state.lifetimeEarned} XP
        </AppText>
      </View>

      <PendingClaims claims={pending} />
      <BadgeGrid items={items} chapters={state.chapters} />
      <NextBadgeHint claimedCount={claimedCount} total={items.length} />
    </Screen>
  );
}
