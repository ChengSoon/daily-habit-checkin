import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import { AdventureClaimCelebration } from "../../src/adventure/AdventureClaimCelebration";
import { ChapterIslandHero } from "../../src/adventure/ChapterIslandHero";
import { fulfillmentLabel, fulfillmentTone } from "../../src/adventure/badgeWall";
import { claimChapter, loadAdventureState } from "../../src/adventure/adventureService";
import { publicUrl } from "../../src/sync/publicUrl";
import type { AdventureChapterView, AdventureState } from "../../src/adventure/types";
import { AppButton, AppText, Badge, Card, HelperText } from "../../src/ui/Controls";
import { RewardImage } from "../../src/ui/RewardImage";
import { EmptyState } from "../../src/ui/EmptyState";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { useTheme } from "../../src/ui/ThemeContext";

export default function AdventureChapterScreen() {
  const { colors } = useTheme();
  const { chapterId } = useLocalSearchParams<{ chapterId: string }>();
  const [state, setState] = useState<AdventureState | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [celebrate, setCelebrate] = useState<{
    emoji: string;
    title: string;
    subtitle: string;
  } | null>(null);

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
        <EmptyState title="找不到这座岛" body="可能已被下架，回地图看看其他岛屿吧。" icon="map-outline" />
        <AppButton title="返回" variant="secondary" icon="chevron-back" onPress={() => router.back()} />
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
      setCelebrate({
        emoji: chapter.badgeEmoji?.trim() || "🏅",
        title: chapter.badgeName,
        subtitle:
          chapter.rewardType === "real_pending"
            ? "现实惊喜已登记，等待兑现"
            : "徽章已收入收藏"
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "领取失败");
    } finally {
      setClaiming(false);
    }
  }

  const remaining = Math.max(0, chapter.thresholdLifetimeXp - state.lifetimeEarned);
  const claimInfo = chapter.claim;

  return (
    <Screen scroll>
      <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }} hitSlop={8}>
        <Ionicons name="chevron-back" size={16} color={colors.inkSoft} />
        <AppText variant="small" tone="soft">返回</AppText>
      </Pressable>

      <ChapterIslandHero chapter={chapter} />

      <Card elevated={false} style={{ gap: 10 }}>
        <AppText variant="caption" style={{ color: colors.primaryInk, textTransform: "none", letterSpacing: 0, fontWeight: "800" }}>
          第 {chapter.sortOrder} 章 · 门槛 {chapter.thresholdLifetimeXp.toLocaleString("en-US")} XP
        </AppText>
        <AppText variant="title">{chapter.title}</AppText>
        {chapter.subtitle ? <AppText variant="body" tone="muted">{chapter.subtitle}</AppText> : null}
        <AppText variant="body" tone="soft" style={{ marginTop: 4, lineHeight: 22 }}>
          {chapter.storyText}
        </AppText>
      </Card>

      <Card elevated={false} tintColor={colors.candySunSurface} style={{ gap: 10 }}>
        <AppText variant="section">章节徽章</AppText>
        {chapter.badgeImageKey ? (
          <RewardImage
            uri={publicUrl(chapter.badgeImageKey)}
            type={chapter.rewardType === "real_pending" ? "real_world" : "virtual"}
            height={160}
          />
        ) : null}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
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

      {chapter.viewStatus === "claimed" &&
      chapter.rewardType === "real_pending" &&
      claimInfo ? (
        <Card elevated={false} style={{ gap: 10 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <AppText variant="section">现实惊喜</AppText>
            <Badge
              label={fulfillmentLabel(claimInfo.fulfillmentStatus) ?? "状态"}
              tone={fulfillmentTone(claimInfo.fulfillmentStatus)}
            />
          </View>
          {claimInfo.fulfillmentStatus === "pending" ? (
            <AppText variant="body" tone="soft">
              已领取 · 等待创建者兑现惊喜
            </AppText>
          ) : null}
          {claimInfo.fulfillmentStatus === "fulfilled" ? (
            <AppText variant="body" tone="soft">
              已兑现
              {claimInfo.fulfilledAt
                ? ` · ${new Date(claimInfo.fulfilledAt).toLocaleString()}`
                : ""}
            </AppText>
          ) : null}
          {claimInfo.fulfillmentStatus === "cancelled" ? (
            <AppText variant="body" tone="soft">
              已取消兑现 · 章节仍完成，徽章保留
            </AppText>
          ) : null}
          {claimInfo.note ? (
            <AppText variant="caption" tone="muted" style={{ textTransform: "none", letterSpacing: 0 }}>
              备注：{claimInfo.note}
            </AppText>
          ) : null}
        </Card>
      ) : null}

      <View style={{ marginTop: 12, gap: 8 }}>
        {chapter.viewStatus === "claimable" ? (
          <AppButton
            title={
              claiming
                ? "领取中…"
                : chapter.rewardType === "real_pending"
                  ? "领取现实惊喜"
                  : "领取徽章"
            }
            variant="mint"
            icon="ribbon-outline"
            onPress={() => void onClaim()}
            disabled={claiming}
          />
        ) : null}
        {chapter.viewStatus === "claimed" && chapter.rewardType !== "real_pending" ? (
          <AppText variant="bodyStrong" tone="primary">
            已获得该徽章
          </AppText>
        ) : null}
        {chapter.viewStatus === "claimed" && chapter.rewardType === "real_pending" ? (
          <AppText variant="bodyStrong" tone="primary">
            已领取该章节奖励
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

      <AdventureClaimCelebration
        visible={celebrate !== null}
        emoji={celebrate?.emoji ?? "🏅"}
        title={celebrate?.title ?? ""}
        subtitle={celebrate?.subtitle ?? ""}
        onDone={() => setCelebrate(null)}
      />
    </Screen>
  );
}
