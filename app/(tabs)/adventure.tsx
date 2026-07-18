import { router } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import {
  BadgePreview,
  HowItWorksCard,
  JourneyRail
} from "../../src/adventure/AdventureHomeSections";
import { loadAdventureState } from "../../src/adventure/adventureService";
import type { AdventureState } from "../../src/adventure/types";
import { AppButton, AppText, Card } from "../../src/ui/Controls";
import { IslandHero } from "../../src/ui/IslandHero";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { radius, spacing } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";

export default function AdventureHomeScreen() {
  const { colors } = useTheme();
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
  const progressRatio = Math.min(1, state.highestUnlockedOrder / total);
  const next = state.nextChapter;
  const remaining = next ? Math.max(0, next.thresholdLifetimeXp - state.lifetimeEarned) : 0;
  const current =
    state.chapters
      .filter((chapter) => chapter.sortOrder <= state.highestUnlockedOrder)
      .sort((a, b) => b.sortOrder - a.sortOrder)[0] ?? state.chapters[0];

  function openChapter(chapterId: string) {
    router.push({ pathname: "/adventure/[chapterId]", params: { chapterId } });
  }

  function openMap() {
    router.push("/adventure/map");
  }

  return (
    <Screen>
      <IslandHero
        variant="adventure"
        islandKey={current?.mapThemeKey}
        islandName={current ? current.title : "启程之前"}
        eyebrow={current ? `双人旅程 · Chapter ${current.sortOrder}` : "双人旅程"}
        detail={`累计 ${state.lifetimeEarned} XP · 已点亮 ${state.highestUnlockedOrder}/${total} 岛`}
        progressBar={{
          ratio: progressRatio,
          label: next && remaining > 0 ? `距下一岛还差 ${remaining} XP` : undefined
        }}
      />

      <Card style={{ gap: spacing.sm, marginTop: spacing.sm }}>
        <AppText variant="section">当前进度</AppText>
        {next ? (
          <>
            <AppText variant="bodyStrong">{next.viewStatus === "claimable" ? "可领取章节" : "下一章"}</AppText>
            <AppText variant="body">{next.title}</AppText>
            {next.subtitle ? (
              <AppText variant="small" tone="muted" numberOfLines={2}>
                {next.subtitle}
              </AppText>
            ) : null}
            <AppText variant="caption" tone="muted" style={{ textTransform: "none", letterSpacing: 0 }}>
              {next.viewStatus === "claimable"
                ? `徽章 ${next.badgeEmoji ?? ""} ${next.badgeName} 待领取`
                : remaining > 0
                  ? `再获得 ${remaining} XP 可推进`
                  : "已达门槛，等待线性解锁"}
            </AppText>
            {next.viewStatus !== "claimable" && remaining > 0 && next.thresholdLifetimeXp > 0 ? (
              <View
                style={{
                  marginTop: 2,
                  height: 6,
                  borderRadius: radius.pill,
                  backgroundColor: colors.surfaceMuted,
                  overflow: "hidden"
                }}
              >
                <View
                  style={{
                    width: `${Math.round(Math.min(1, state.lifetimeEarned / next.thresholdLifetimeXp) * 100)}%`,
                    height: "100%",
                    backgroundColor: colors.primary
                  }}
                />
              </View>
            ) : null}
          </>
        ) : (
          <AppText variant="body" tone="muted">
            全部章节已解锁，去地图领取或回顾徽章吧。
          </AppText>
        )}
      </Card>

      {state.claimableCount > 0 ? (
        <Card
          style={{
            marginTop: spacing.sm,
            borderColor: colors.primary,
            backgroundColor: colors.surfaceTint
          }}
        >
          <AppText variant="bodyStrong">✨ 有 {state.claimableCount} 个章节徽章可领取</AppText>
          <AppText variant="caption" tone="muted" style={{ marginTop: 4, textTransform: "none", letterSpacing: 0 }}>
            打开地图点亮岛屿，阅读叙事后手动领取。
          </AppText>
        </Card>
      ) : null}

      {(state.pendingFulfillmentCount ?? 0) > 0 ? (
        <Card
          style={{ marginTop: spacing.sm }}
          onPress={() => router.push("/adventure/badges")}
        >
          <AppText variant="bodyStrong">有 {state.pendingFulfillmentCount} 个现实惊喜待兑现</AppText>
          <AppText variant="caption" tone="muted" style={{ marginTop: 4, textTransform: "none", letterSpacing: 0 }}>
            打开徽章墙查看兑现进度
          </AppText>
        </Card>
      ) : null}

      <JourneyRail chapters={state.chapters} onOpen={openChapter} />
      <BadgePreview chapters={state.chapters} onOpenMap={openMap} />
      <HowItWorksCard />

      <View style={{ marginTop: spacing.md, gap: spacing.sm, marginBottom: spacing.sm }}>
        <AppButton
          title={state.claimableCount > 0 ? "去领取奖励" : "打开世界地图"}
          onPress={openMap}
        />
        <AppButton title="徽章收藏" variant="secondary" onPress={() => router.push("/adventure/badges")} />
        <AppButton title="刷新进度" variant="ghost" onPress={() => void reload()} />
      </View>
    </Screen>
  );
}
