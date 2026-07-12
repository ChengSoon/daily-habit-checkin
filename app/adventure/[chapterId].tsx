import { useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { claimChapter, loadAdventureState } from "../../src/adventure/adventureService";
import type { AdventureChapterView, AdventureState } from "../../src/adventure/types";
import { AppButton, AppText, Card, HelperText } from "../../src/ui/Controls";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { spacing } from "../../src/ui/theme";

export default function AdventureChapterScreen() {
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();
  const [state, setState] = useState<AdventureState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);

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

  const chapter: AdventureChapterView | undefined = state.chapters.find((item) => item.id === chapterId);

  if (!chapter) {
    return (
      <Screen>
        <AppText variant="title">章节不存在</AppText>
        <HelperText>可能已被下架，返回地图看看其他节点。</HelperText>
      </Screen>
    );
  }

  async function onClaim() {
    if (!chapter) return;
    setClaiming(true);
    setError(null);
    setMessage(null);
    try {
      const next = await claimChapter(chapter.id);
      setState(next);
      setMessage(`已领取 ${chapter.badgeEmoji ?? ""} ${chapter.badgeName}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "领取失败");
    } finally {
      setClaiming(false);
    }
  }

  const remaining = Math.max(0, chapter.thresholdLifetimeXp - state.lifetimeEarned);

  return (
    <Screen scroll>
      <Card style={{ gap: spacing.sm }}>
        <AppText variant="caption" tone="muted">
          第 {chapter.sortOrder} 章 · 门槛 {chapter.thresholdLifetimeXp} XP
        </AppText>
        <AppText variant="title">{chapter.title}</AppText>
        {chapter.subtitle ? <AppText variant="body" tone="soft">{chapter.subtitle}</AppText> : null}
        <AppText variant="body" style={{ marginTop: spacing.sm, lineHeight: 22 }}>
          {chapter.storyText}
        </AppText>
      </Card>

      <Card style={{ marginTop: spacing.md, gap: spacing.sm }}>
        <AppText variant="section">章节徽章</AppText>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <AppText variant="display">{chapter.badgeEmoji ?? "🏅"}</AppText>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">{chapter.badgeName}</AppText>
            {chapter.badgeDescription ? (
              <AppText variant="caption" tone="muted">
                {chapter.badgeDescription}
              </AppText>
            ) : null}
          </View>
        </View>
      </Card>

      <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
        {chapter.viewStatus === "claimable" ? (
          <AppButton title={claiming ? "领取中…" : "领取徽章"} onPress={() => void onClaim()} disabled={claiming} />
        ) : null}
        {chapter.viewStatus === "claimed" ? (
          <AppText variant="bodyStrong" tone="primary">
            已获得该徽章
          </AppText>
        ) : null}
        {chapter.viewStatus === "locked" ? (
          <HelperText>
            {remaining > 0
              ? `还需 ${remaining} 累计 XP，并完成上一章解锁后才能领取。`
              : "需先按顺序解锁前面的章节。"}
          </HelperText>
        ) : null}
        {message ? <HelperText>{message}</HelperText> : null}
        {error ? <HelperText tone="danger">{error}</HelperText> : null}
      </View>
    </Screen>
  );
}
