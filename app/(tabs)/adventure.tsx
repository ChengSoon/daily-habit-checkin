import { router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import { fetchAdventureCampaign, fetchAdventureProgress, fetchAdventureRewards } from "../../src/adventure/adventureClient";
import { AdventureWorldScreen } from "../../src/adventure/AdventureWorldScreen";
import { calculateAdventureProgress, getAdventureUnlockSummary, getStationSummary } from "../../src/adventure/adventureRules";
import { createUnlockPresentation } from "../../src/adventure/adventureUnlockPresentation";
import { listActiveHabits } from "../../src/habits/habitRepository";
import { shouldRunOnDate } from "../../src/habits/habitRules";
import { getCurrentAccount } from "../../src/sync/authService";
import { getAdventureSeenStationIds, saveAdventureSeenStationIds } from "../../src/sync/localSettings";
import { AppButton } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { useCouple } from "../../src/ui/useCouple";
import { todayKey } from "../../src/utils/date";
import { AdventureCampaign } from "../../src/adventure/types";

export default function AdventureScreen() {
  const couple = useCouple();
  const [campaign, setCampaign] = useState<AdventureCampaign | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [habitState, setHabitState] = useState({ active: 0, scheduledToday: 0 });
  const [claimedStationIds, setClaimedStationIds] = useState<string[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [pendingUnlockStationIds, setPendingUnlockStationIds] = useState<string[]>([]);
  const spaceIdRef = useRef<string | null>(null);
  const nextSeenRef = useRef<string[]>([]);

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
    const claimed = rewards.map((reward) => reward.stationId);

    // 解锁展示队列：对比本地已看过的站点，新的 claimed 站点排队播放仪式
    spaceIdRef.current = account?.spaceId ?? null;
    if (account?.spaceId) {
      const seen = await getAdventureSeenStationIds(account.spaceId, nextCampaign.id);
      const presentation = createUnlockPresentation(
        claimed,
        seen,
        nextCampaign.stations.map((station) => station.id)
      );
      nextSeenRef.current = presentation.nextSeenStationIds;
      if (seen === null) {
        // 首次进入：不播仪式，直接落库当前状态
        await saveAdventureSeenStationIds(
          account.spaceId, nextCampaign.id, presentation.nextSeenStationIds
        );
        setPendingUnlockStationIds([]);
      } else {
        setPendingUnlockStationIds(presentation.pendingStationIds);
      }
    } else {
      setPendingUnlockStationIds([]);
    }

    setCampaign(nextCampaign);
    setTotalPoints(progress.totalPoints);
    setClaimedStationIds(claimed);
    setHabitState({ active: habits.length, scheduledToday });
    setIsOwner(account?.role === "owner");
  }, []);

  const completeUnlockPresentation = useCallback(() => {
    setPendingUnlockStationIds([]);
    const spaceId = spaceIdRef.current;
    if (spaceId && campaign) {
      void saveAdventureSeenStationIds(spaceId, campaign.id, nextSeenRef.current);
    }
  }, [campaign]);

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

  if (habitState.active === 0) {
    return (
      <Screen>
        <EmptyState title="还没有冒险任务" body="先创建一个习惯，每次完成都会推动你们向下一站前进。" icon="map-outline" />
        <AppButton title="创建第一个习惯" icon="add" onPress={() => router.push("/habit/new")} />
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <AdventureWorldScreen
        campaign={campaign}
        progress={progress}
        summary={summary}
        unlockSummary={unlockSummary}
        campaignRatio={campaignRatio}
        claimedStationSet={claimedStationSet}
        people={people}
        isOwner={isOwner}
        pendingUnlockStationIds={pendingUnlockStationIds}
        onCeremonyComplete={completeUnlockPresentation}
      />
    </View>
  );
}
