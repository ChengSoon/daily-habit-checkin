import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { loadAdventureState } from "../../src/adventure/adventureService";
import { shouldPlayUnlockFeedback } from "../../src/adventure/badgeWall";
import {
  getLastSeenUnlockedOrder,
  setLastSeenUnlockedOrder
} from "../../src/adventure/unlockSeen";
import { WorldMapCanvas } from "../../src/adventure/WorldMapCanvas";
import type { AdventureChapterView, AdventureState } from "../../src/adventure/types";
import type { Account } from "../../src/sync/authService";
import { getStoredAccount } from "../../src/sync/localSettings";
import { AppText, Card } from "../../src/ui/Controls";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { spacing } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";

function resolveFocusChapter(
  chapters: AdventureChapterView[],
  highestUnlockedOrder: number
): AdventureChapterView | null {
  const ordered = [...chapters].sort((a, b) => a.sortOrder - b.sortOrder);
  if (ordered.length === 0) return null;
  return (
    ordered.find((c) => c.viewStatus === "claimable") ??
    [...ordered].reverse().find((c) => c.sortOrder <= highestUnlockedOrder) ??
    ordered[0]
  );
}

export default function AdventureMapScreen() {
  const { colors } = useTheme();
  const [state, setState] = useState<AdventureState | null>(null);
  const [focus, setFocus] = useState<AdventureChapterView | null>(null);
  const [pulseSortOrder, setPulseSortOrder] = useState<number | null>(null);
  const [unlockBanner, setUnlockBanner] = useState<string | null>(null);
  const unlockCheckedRef = useRef(false);

  const load = useCallback(async () => {
    const next = await loadAdventureState();
    setState(next);
    setFocus(resolveFocusChapter(next.chapters, next.highestUnlockedOrder));
  }, []);

  const { status, errorMessage, reload } = useSyncScreen(load);

  useEffect(() => {
    if (!state || unlockCheckedRef.current) {
      return;
    }
    unlockCheckedRef.current = true;
    void (async () => {
      const account = await getStoredAccount<Account>();
      const spaceId = account?.spaceId;
      if (!spaceId) {
        return;
      }
      const lastSeen = await getLastSeenUnlockedOrder(spaceId);
      if (shouldPlayUnlockFeedback(state.highestUnlockedOrder, lastSeen)) {
        setPulseSortOrder(state.highestUnlockedOrder);
        setUnlockBanner(`新解锁至第 ${state.highestUnlockedOrder} 章`);
        setTimeout(() => setUnlockBanner(null), 2200);
      }
      await setLastSeenUnlockedOrder(spaceId, state.highestUnlockedOrder);
    })();
  }, [state]);

  const total = state?.chapters.length || 1;
  const progressRatio =
    state && total > 0 ? Math.min(1, state.highestUnlockedOrder / total) : 0;

  const focusHint = useMemo(() => {
    if (!state || !focus) return null;
    if (focus.viewStatus === "claimable") {
      return `「${focus.title}」奖励可领取 · 点岛进入`;
    }
    if (focus.viewStatus === "claimed") {
      return `「${focus.title}」已领取 · 可点开回顾`;
    }
    const need = Math.max(0, focus.thresholdLifetimeXp - state.lifetimeEarned);
    return need > 0
      ? `「${focus.title}」锁定中 · 还需 ${need} XP`
      : `「${focus.title}」已达门槛 · 等待顺序解锁`;
  }, [focus, state]);

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  if (!state) {
    return <SyncFallback status="loading" errorMessage={errorMessage} onRetry={reload} />;
  }

  return (
    <Screen scroll={false}>
      <Card style={{ marginBottom: spacing.sm, gap: 6 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <AppText variant="section">世界地图</AppText>
          <AppText variant="caption" tone="muted" style={{ textTransform: "none" }}>
            {state.highestUnlockedOrder}/{total} 岛
          </AppText>
        </View>
        <View
          style={{
            height: 6,
            borderRadius: 999,
            backgroundColor: "rgba(0,0,0,0.06)",
            overflow: "hidden"
          }}
        >
          <View
            style={{
              width: `${Math.max(6, progressRatio * 100)}%`,
              height: "100%",
              borderRadius: 999,
              backgroundColor: state.claimableCount > 0 ? colors.celebration : colors.primary
            }}
          />
        </View>
        <AppText variant="caption" tone="muted" style={{ textTransform: "none" }}>
          累计 {state.lifetimeEarned} XP
          {state.claimableCount > 0 ? ` · 可领取 ${state.claimableCount}` : ""}
        </AppText>
        {unlockBanner ? (
          <AppText variant="small" tone="primary">
            {unlockBanner}
          </AppText>
        ) : focusHint ? (
          <AppText variant="small" tone="soft">
            {focusHint}
          </AppText>
        ) : (
          <AppText variant="small" tone="soft">
            上下滑动切换岛屿
          </AppText>
        )}
      </Card>

      <View style={{ flex: 1, minHeight: 0, alignItems: "center", justifyContent: "center" }}>
        <WorldMapCanvas
          chapters={state.chapters}
          highestUnlockedOrder={state.highestUnlockedOrder}
          pulseSortOrder={pulseSortOrder}
          onPressChapter={(chapterId) => router.push(`/adventure/${chapterId}`)}
          onFocusChange={(chapter) => setFocus(chapter)}
        />
      </View>

      <AppText
        variant="caption"
        tone="muted"
        style={{
          textAlign: "center",
          textTransform: "none",
          marginTop: spacing.sm,
          marginBottom: spacing.sm
        }}
      >
        上下滑动或点两侧圆点切换 · 点击岛屿进入
      </AppText>
    </Screen>
  );
}
