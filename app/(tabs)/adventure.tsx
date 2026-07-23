import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { HowItWorksCard, JourneyRail } from "../../src/adventure/AdventureHomeSections";
import { loadAdventureState } from "../../src/adventure/adventureService";
import type { AdventureState } from "../../src/adventure/types";
import { AppButton, AppText, Card } from "../../src/ui/Controls";
import { IslandHero } from "../../src/ui/IslandHero";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { useTheme } from "../../src/ui/ThemeContext";

function adventureSummary(state: AdventureState) {
  const total = state.chapters.length || 1;
  const unlocked = state.highestUnlockedOrder;
  const next = state.nextChapter;
  const remaining = next ? Math.max(0, next.thresholdLifetimeXp - state.lifetimeEarned) : 0;
  const ratio = next && next.thresholdLifetimeXp > 0
    ? Math.min(1, state.lifetimeEarned / next.thresholdLifetimeXp) : Math.min(1, unlocked / total);
  const current = state.chapters.filter((chapter) => chapter.sortOrder <= unlocked)
    .sort((a, b) => b.sortOrder - a.sortOrder)[0] ?? state.chapters[0];
  return { total, unlocked, next, remaining, ratio, current };
}

function JourneySection({ state, total, unlocked }: { state: AdventureState; total: number; unlocked: number }) {
  const { colors } = useTheme();
  return <View style={{ gap: 10 }}>
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
      <AppText variant="section" style={{ flexShrink: 0 }}>章节航线</AppText>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 }}>
        <Pressable onPress={() => router.push("/adventure/badges")} hitSlop={8}
          style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <AppText variant="small" style={{ color: colors.partnerInk, fontWeight: "800" }}>徽章墙</AppText>
        </Pressable>
        <AppText variant="small" tone="muted" numberOfLines={1}>共 {total} 站 · {unlocked} 已点亮</AppText>
      </View>
    </View>
    <Card elevated={false} style={{ gap: 0, paddingVertical: 12, paddingHorizontal: 10 }}>
      <JourneyRail chapters={state.chapters}
        onOpen={(chapterId) => router.push({ pathname: "/adventure/[chapterId]", params: { chapterId } })} bare />
    </Card>
  </View>;
}

function AdventureHomeContent({ state }: { state: AdventureState }) {
  const summary = adventureSummary(state);
  const { current, next, remaining, unlocked, total, ratio } = summary;
  return <Screen>
    <IslandHero variant="adventure" islandKey={current?.mapThemeKey} islandImageKey={current?.nodeImageKey}
      islandName={current ? current.title : "启程之前"}
      eyebrow={current ? `双人旅程 · Chapter ${String(current.sortOrder).padStart(2, "0")}` : "双人旅程"}
      detail={`累计 ${state.lifetimeEarned.toLocaleString("en-US")} XP · 已点亮 ${unlocked} / ${total} 岛`}
      progressBar={{ ratio, label: next && remaining > 0 ? `距下一岛还差 ${remaining} XP`
        : unlocked >= total ? "群岛已全部点亮" : undefined }} />
    <JourneySection state={state} total={total} unlocked={unlocked} />
    <HowItWorksCard />
    <AppButton title={state.claimableCount > 0 ? "领取章节奖励" : "打开世界地图"}
      icon={state.claimableCount > 0 ? "ribbon-outline" : "map-outline"}
      variant={state.claimableCount > 0 ? "mint" : "secondary"} fullWidth
      onPress={() => router.push("/adventure/map")} />
  </Screen>;
}

/** board 03 · 闯关旅程：岛屿 hero + 章节航线 + How it works。 */
export default function AdventureHomeScreen() {
  const [state, setState] = useState<AdventureState | null>(null);

  const load = useCallback(async () => {
    setState(await loadAdventureState());
  }, []);

  const { status, errorMessage, reload } = useSyncScreen(load);

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }
  if (!state) {
    return <SyncFallback status="loading" errorMessage={errorMessage} onRetry={reload} />;
  }

  return <AdventureHomeContent state={state} />;
}
