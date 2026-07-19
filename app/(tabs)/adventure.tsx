import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { HowItWorksCard, JourneyRail } from "../../src/adventure/AdventureHomeSections";
import { loadAdventureState } from "../../src/adventure/adventureService";
import type { AdventureState } from "../../src/adventure/types";
import { AppButton, AppText } from "../../src/ui/Controls";
import { IslandHero } from "../../src/ui/IslandHero";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";

/** board 03 · 闯关旅程：岛屿 hero + 章节航线 + How it works（不塞旧进度卡/多按钮）。 */
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

  const total = state.chapters.length || 1;
  const unlocked = state.highestUnlockedOrder;
  const next = state.nextChapter;
  const remaining = next ? Math.max(0, next.thresholdLifetimeXp - state.lifetimeEarned) : 0;
  const progressRatio = next && next.thresholdLifetimeXp > 0
    ? Math.min(1, state.lifetimeEarned / next.thresholdLifetimeXp)
    : Math.min(1, unlocked / total);
  const current =
    state.chapters
      .filter((chapter) => chapter.sortOrder <= unlocked)
      .sort((a, b) => b.sortOrder - a.sortOrder)[0] ?? state.chapters[0];

  return (
    <Screen>
      <IslandHero
        variant="adventure"
        islandKey={current?.mapThemeKey}
        islandName={current ? current.title : "启程之前"}
        eyebrow={current ? `双人旅程 · Chapter ${String(current.sortOrder).padStart(2, "0")}` : "双人旅程"}
        detail={`累计 ${state.lifetimeEarned.toLocaleString("en-US")} XP · 已点亮 ${unlocked} / ${total} 岛`}
        progressBar={{
          ratio: progressRatio,
          label: next && remaining > 0 ? `距下一岛还差 ${remaining} XP` : unlocked >= total ? "群岛已全部点亮" : undefined
        }}
      />

      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2 }}>
        <AppText variant="section">章节航线</AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <Pressable onPress={() => router.push("/adventure/badges")}>
            <AppText variant="small" tone="muted">
              徽章墙
            </AppText>
          </Pressable>
          <AppText variant="small" tone="muted">
            共 {total} 站 · {unlocked} 已点亮
          </AppText>
        </View>
      </View>

      <JourneyRail
        chapters={state.chapters}
        onOpen={(chapterId) => router.push({ pathname: "/adventure/[chapterId]", params: { chapterId } })}
        bare
      />

      <HowItWorksCard />

      {/* board 03 本体止于 How it works；可领时用 mint 主按钮，否则 secondary 进入地图 */}
      <AppButton
        title={state.claimableCount > 0 ? "领取章节奖励" : "打开世界地图"}
        icon={state.claimableCount > 0 ? "ribbon-outline" : "map-outline"}
        variant={state.claimableCount > 0 ? "mint" : "secondary"}
        fullWidth
        onPress={() => router.push("/adventure/map")}
      />
    </Screen>
  );
}
