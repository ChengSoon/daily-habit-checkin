import { router } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { loadAdventureState } from "../../src/adventure/adventureService";
import type { AdventureState } from "../../src/adventure/types";
import { AppButton, AppText, Card } from "../../src/ui/Controls";
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

  return (
    <Screen>
      <View
        style={{
          borderRadius: radius.lg,
          overflow: "hidden",
          padding: spacing.lg,
          gap: spacing.sm,
          backgroundColor: colors.primary
        }}
      >
        <AppText variant="caption" tone="onPrimary" style={{ opacity: 0.85 }}>
          双人旅程
        </AppText>
        <AppText variant="title" tone="onPrimary">
          {current ? current.title : "启程之前"}
        </AppText>
        <AppText variant="small" tone="onPrimary" style={{ opacity: 0.9 }}>
          累计 {state.lifetimeEarned} XP · 已解锁 {state.highestUnlockedOrder}/{total} 章
        </AppText>
        <View
          style={{
            marginTop: spacing.sm,
            height: 12,
            borderRadius: 999,
            backgroundColor: "rgba(255,255,255,0.22)",
            overflow: "hidden"
          }}
        >
          <View
            style={{
              width: `${Math.round(progressRatio * 100)}%`,
              height: "100%",
              backgroundColor: colors.onPrimary
            }}
          />
        </View>
      </View>

      <Card style={{ gap: spacing.sm, marginTop: spacing.md }}>
        <AppText variant="section">当前进度舱</AppText>
        {next ? (
          <>
            <AppText variant="bodyStrong">{next.viewStatus === "claimable" ? "可领取章节" : "下一章"}</AppText>
            <AppText variant="body">{next.title}</AppText>
            <AppText variant="caption" tone="muted">
              {next.viewStatus === "claimable"
                ? `徽章 ${next.badgeEmoji ?? ""} ${next.badgeName} 待领取`
                : remaining > 0
                  ? `再获得 ${remaining} XP 可推进`
                  : "已达门槛，等待线性解锁"}
            </AppText>
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
            backgroundColor: colors.surface
          }}
        >
          <AppText variant="bodyStrong">有 {state.claimableCount} 个章节奖励可领取</AppText>
          <AppText variant="caption" tone="muted" style={{ marginTop: 4 }}>
            打开地图点亮节点，阅读叙事后手动领取徽章。
          </AppText>
        </Card>
      ) : null}

      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <AppButton
          title={state.claimableCount > 0 ? "去领取奖励" : "打开世界地图"}
          onPress={() => router.push("/adventure/map")}
        />
        <AppButton title="刷新进度" variant="secondary" onPress={() => void reload()} />
      </View>
    </Screen>
  );
}
