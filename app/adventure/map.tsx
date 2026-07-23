import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { BoardWorldMap } from "../../src/adventure/BoardWorldMap";
import { loadAdventureState } from "../../src/adventure/adventureService";
import type { AdventureState } from "../../src/adventure/types";
import { AppButton, AppText, Card } from "../../src/ui/Controls";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { sceneTint } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";
import { useCouple } from "../../src/ui/useCouple";

function selectMapFocus(state: AdventureState | null) {
  if (!state) return null;
  const ordered = [...state.chapters].sort((a, b) => a.sortOrder - b.sortOrder);
  return ordered.find((chapter) => chapter.viewStatus === "claimable")
    ?? [...ordered].reverse().find((chapter) => chapter.viewStatus !== "locked") ?? ordered[0] ?? null;
}

function MapHeader({ unlocked, total }: { unlocked: number; total: number }) {
  const { colors } = useTheme();
  return <>
    <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }} hitSlop={8}>
      <Ionicons name="chevron-back" size={16} color={colors.inkSoft} /><AppText variant="small" tone="soft">返回</AppText>
    </Pressable>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="title">世界地图</AppText>
        <AppText variant="body" tone="muted">点亮群岛，收集徽章 · 地图框内可滑动浏览全部航站</AppText>
      </View>
      <View style={{ backgroundColor: colors.partnerSurface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }}>
        <AppText variant="small" style={{ color: colors.partnerInk, fontWeight: "800", fontSize: 12, lineHeight: 16 }}>
          {unlocked} / {total} 解锁
        </AppText>
      </View>
    </View>
  </>;
}

function FocusCard({ focus }: { focus: AdventureState["chapters"][number] | null }) {
  const { colors, scheme } = useTheme();
  if (!focus) return null;
  return <Card {...sceneTint("coral", scheme)} elevated={false} style={{ gap: 10, padding: 13 }}>
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <View style={{ flex: 1, gap: 4, paddingRight: 8 }}>
        <AppText variant="caption" style={{ color: colors.primaryInk, textTransform: "none", letterSpacing: 0.8, fontWeight: "800" }}>Current Chapter</AppText>
        <AppText variant="section">{focus.title}</AppText>
        <AppText variant="body" tone="muted">阈值 {focus.thresholdLifetimeXp.toLocaleString("en-US")} XP{focus.badgeName ? ` · 奖励：${focus.badgeName}` : ""}</AppText>
      </View>
      <View style={{ width: 44, height: 44, borderRadius: 15, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
        {focus.badgeEmoji?.trim() ? <AppText style={{ fontSize: 20 }}>{focus.badgeEmoji.trim()}</AppText>
          : <Ionicons name="flame" size={20} color={colors.primaryInk} />}
      </View>
    </View>
  </Card>;
}

export default function AdventureMapScreen() {
  const couple = useCouple();
  const [state, setState] = useState<AdventureState | null>(null);

  const load = useCallback(async () => {
    setState(await loadAdventureState());
  }, []);

  const { status, errorMessage, reload } = useSyncScreen(load);

  const focus = useMemo(() => selectMapFocus(state), [state]);

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }
  if (!state) {
    return <SyncFallback status="loading" errorMessage={errorMessage} onRetry={reload} />;
  }

  const total = state.chapters.length || 1;
  const claimable = focus?.viewStatus === "claimable";

  return (
    <Screen>
      <MapHeader unlocked={state.highestUnlockedOrder} total={total} />

      <BoardWorldMap
        chapters={state.chapters}
        people={couple.people.map((p) => ({ name: p.name, tone: p.tone, imageUri: p.avatarUrl }))}
        onPressChapter={(chapterId) => router.push(`/adventure/${chapterId}`)}
      />

      <FocusCard focus={focus} />

      <AppButton
        title={claimable ? "领取章节奖励" : "打开当前岛屿"}
        icon={claimable ? "ribbon-outline" : "map-outline"}
        variant={claimable ? "mint" : "primary"}
        fullWidth
        onPress={() => {
          if (focus) {
            router.push(`/adventure/${focus.id}`);
          }
        }}
        disabled={!focus}
      />
    </Screen>
  );
}
