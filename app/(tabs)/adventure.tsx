import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { fetchAdventureCampaign, fetchAdventureProgress, fetchAdventureRewards } from "../../src/adventure/adventureClient";
import { AdventureCollection } from "../../src/adventure/AdventureCollection";
import { AdventureMap } from "../../src/adventure/AdventureMap";
import { calculateAdventureProgress, getAdventureUnlockSummary, getStationSummary } from "../../src/adventure/adventureRules";
import { listActiveHabits } from "../../src/habits/habitRepository";
import { shouldRunOnDate } from "../../src/habits/habitRules";
import { CoupleAvatars } from "../../src/ui/Avatar";
import { getCurrentAccount } from "../../src/sync/authService";
import { publicUrl } from "../../src/sync/publicUrl";
import { AppButton, AppText, Card, IconButton } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { radius, spacing } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";
import { useCouple } from "../../src/ui/useCouple";
import { todayKey } from "../../src/utils/date";
import { AdventureCampaign } from "../../src/adventure/types";

export default function AdventureScreen() {
  const { colors } = useTheme();
  const couple = useCouple();
  const [campaign, setCampaign] = useState<AdventureCampaign | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [habitState, setHabitState] = useState({ active: 0, scheduledToday: 0 });
  const [claimedStationIds, setClaimedStationIds] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);

  const load = useCallback(async () => {
    const [nextCampaign, progress, rewards, habits, account] = await Promise.all([
      fetchAdventureCampaign(),
      fetchAdventureProgress(),
      fetchAdventureRewards(),
      listActiveHabits(),
      getCurrentAccount()
    ]);
    const today = todayKey();
    const scheduledToday = habits.filter((habit) =>
      shouldRunOnDate(habit.frequency, new Date(`${today}T00:00:00`))
    ).length;
    setCampaign(nextCampaign);
    setTotalPoints(progress.totalPoints);
    setClaimedStationIds(rewards.map((reward) => reward.stationId));
    setHabitState({ active: habits.length, scheduledToday });
    setIsOwner(account?.role === "owner");
  }, []);

  const { status, errorMessage, reload } = useSyncScreen(load);
  const progress = useMemo(
    () => campaign ? calculateAdventureProgress(campaign, totalPoints) : null,
    [campaign, totalPoints]
  );
  const summary = useMemo(
    () => campaign ? getStationSummary(campaign, totalPoints) : null,
    [campaign, totalPoints]
  );
  const unlockSummary = useMemo(
    () => campaign ? getAdventureUnlockSummary(campaign, totalPoints) : null,
    [campaign, totalPoints]
  );
  const nextStation = progress?.nextStationId
    ? campaign?.stations.find((station) => station.id === progress.nextStationId) ?? null
    : null;
  const campaignRatio = !unlockSummary || unlockSummary.totalCampaignCost === 0
    ? 1
    : Math.min(1, totalPoints / unlockSummary.totalCampaignCost);
  const claimedStationSet = useMemo(() => new Set(claimedStationIds), [claimedStationIds]);
  const people = couple.people.map((person) => ({
    name: person.name,
    tone: person.tone,
    imageUri: person.avatarUrl
  }));

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  if (!campaign || !progress || !summary || !unlockSummary) {
    return <SyncFallback status="error" errorMessage="冒险路线加载失败" onRetry={reload} />;
  }

  return (
    <Screen>
      <View style={styles.topBar}>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" tone="muted">双人冒险</AppText>
          <AppText variant="section">{campaign.title}</AppText>
        </View>
        {people.length > 0 ? <CoupleAvatars people={people} size={34} showRibbon={false} /> : null}
        {isOwner ? (
          <IconButton
            name="construct-outline"
            accessibilityLabel="设计冒险关卡"
            onPress={() => router.push("/adventure/manage")}
          />
        ) : null}
        <IconButton name="settings-outline" accessibilityLabel="打开设置" onPress={() => router.push("/profile")} />
      </View>

      {habitState.active === 0 ? (
        <>
          <EmptyState title="还没有冒险任务" body="先创建一个习惯，每次完成都会推动你们向下一站前进。" icon="map-outline" />
          <AppButton title="创建第一个习惯" icon="add" onPress={() => router.push("/habit/new")} />
        </>
      ) : (
        <>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="display">{summary.title}</AppText>
            <AppText variant="body" tone="soft">{summary.subtitle}</AppText>
          </View>

          {habitState.scheduledToday === 0 ? (
            <View style={[styles.restNotice, { backgroundColor: colors.surfaceMuted, borderColor: colors.line }]}>
              <Ionicons name="moon-outline" size={18} color={colors.partnerInk} />
              <AppText variant="small" tone="soft">今天没有安排任务，旅程会在下一个打卡日继续。</AppText>
            </View>
          ) : null}

          <AdventureMap campaign={campaign} people={people} progress={progress} />

          <Card style={styles.rowCard}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="section">累计行动力</AppText>
              <AppText variant="small" tone="muted">跨天累计，每次打卡 +1，全勤额外 +1</AppText>
              {unlockSummary.nextUnlockAt ? (
                <AppText variant="small" tone="soft">
                  累计 {unlockSummary.nextUnlockAt} 点解锁{unlockSummary.nextStationTitle}
                </AppText>
              ) : null}
            </View>
            <View style={[styles.pointPill, { backgroundColor: colors.surfaceTint }]}>
              <AppText variant="bodyStrong" tone="primary">{summary.actionPointLabel}</AppText>
            </View>
          </Card>

          <Card>
            <AppText variant="section">下一站奖励</AppText>
            {nextStation ? (
              <View style={styles.rewardRow}>
                {nextStation.reward.badgeEnabled ? (
                  <RewardChip
                    icon="ribbon-outline"
                    imageUri={publicUrl(nextStation.reward.badgeImageKey)}
                    label={nextStation.reward.badgeTitle ?? "站点徽章"}
                    color={colors.primaryInk}
                    background={colors.surfaceTint}
                  />
                ) : null}
                {nextStation.reward.xpEnabled ? (
                  <RewardChip icon="sparkles" label={`+${nextStation.reward.xp} XP`} color={colors.partnerInk} background={colors.partnerSurface} />
                ) : null}
                {nextStation.reward.storyEnabled ? (
                  <RewardChip icon="book-outline" label={nextStation.reward.storyTitle ?? "新剧情"} color={colors.inkSoft} background={colors.surfaceMuted} />
                ) : null}
              </View>
            ) : (
              <AppText variant="body" tone="muted">所有站点奖励都已解锁。</AppText>
            )}
          </Card>

          <View style={[styles.chapterCard, { backgroundColor: colors.ink }]}>
            <View style={{ flex: 1, gap: spacing.xs }}>
              <AppText variant="section" style={{ color: colors.surface }}>章节进度</AppText>
              <AppText variant="small" style={{ color: colors.surface, opacity: 0.72 }}>{summary.chapterProgressLabel}</AppText>
            </View>
            <View style={[styles.progressTrack, { backgroundColor: colors.faint }]}>
              <View style={[styles.progressFill, { backgroundColor: colors.celebration, width: `${campaignRatio * 100}%` }]} />
            </View>
          </View>
        </>
      )}

      <AdventureCollection campaign={campaign} claimedStationIds={claimedStationSet} />
    </Screen>
  );
}

function RewardChip({
  background,
  color,
  icon,
  imageUri,
  label
}: {
  background: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  imageUri?: string | null;
  label: string;
}) {
  const [failedImageUri, setFailedImageUri] = useState<string | null>(null);
  return (
    <View style={[styles.rewardChip, { backgroundColor: background }]}>
      {imageUri && failedImageUri !== imageUri ? (
        <Image
          source={{ uri: imageUri }}
          contentFit="cover"
          onError={() => setFailedImageUri(imageUri)}
          style={styles.rewardImage}
        />
      ) : (
        <Ionicons name={icon} size={15} color={color} />
      )}
      <AppText variant="small" style={{ color, fontWeight: "700" }}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  restNotice: { alignItems: "center", borderRadius: radius.md, borderWidth: 1, flexDirection: "row", gap: spacing.sm, padding: spacing.md },
  rowCard: { alignItems: "center", flexDirection: "row" },
  pointPill: { borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rewardRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  rewardChip: { alignItems: "center", borderRadius: radius.md, flexDirection: "row", gap: spacing.xs, minHeight: 40, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  rewardImage: { borderRadius: radius.pill, height: 20, width: 20 },
  chapterCard: { alignItems: "center", borderRadius: radius.lg, flexDirection: "row", gap: spacing.lg, padding: spacing.lg },
  progressTrack: { borderRadius: radius.pill, height: 10, overflow: "hidden", width: 96 },
  progressFill: { borderRadius: radius.pill, height: "100%" }
});
