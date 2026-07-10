import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, View } from "react-native";
import {
  createAdventureStation,
  updateAdventureStation
} from "../../../src/adventure/adventureAdminClient";
import { fetchAdventureCampaign, fetchAdventureProgress } from "../../../src/adventure/adventureClient";
import type { PickedBadgeImage } from "../../../src/adventure/adventureBadgeImage";
import { AdventureStationForm } from "../../../src/adventure/AdventureStationForm";
import {
  emptyAdventureStationForm,
  getAdventureStationThresholdBounds,
  stationToFormValue,
  validateAdventureStationForm,
  type AdventureStationFormValue
} from "../../../src/adventure/adventureStationFormModel";
import type { AdventureCampaign } from "../../../src/adventure/types";
import { goBackOrReplace } from "../../../src/navigation/goBackOrReplace";
import { SyncError } from "../../../src/sync/apiClient";
import { uploadImage } from "../../../src/sync/uploadClient";
import { publicUrl } from "../../../src/sync/publicUrl";
import { AppText, IconButton } from "../../../src/ui/Controls";
import { OwnerGate } from "../../../src/ui/OwnerGate";
import { Screen } from "../../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../../src/ui/SyncScreen";
import { spacing } from "../../../src/ui/theme";

export default function AdventureStationScreen() {
  return <OwnerGate fallbackHref="/adventure"><AdventureStationContent /></OwnerGate>;
}

function AdventureStationContent() {
  const params = useLocalSearchParams<{ id: string }>();
  const stationId = Array.isArray(params.id) ? params.id[0] : params.id;
  const isNew = stationId === "new";
  const [campaign, setCampaign] = useState<AdventureCampaign | null>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [form, setForm] = useState<AdventureStationFormValue>(emptyAdventureStationForm());
  const [pickedBadge, setPickedBadge] = useState<PickedBadgeImage | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    const [nextCampaign, progress] = await Promise.all([
      fetchAdventureCampaign(),
      fetchAdventureProgress()
    ]);
    const station = nextCampaign.stations.find((item) => item.id === stationId);
    if (!isNew && !station) throw new Error("关卡不存在");
    const bounds = getAdventureStationThresholdBounds(nextCampaign, stationId, progress.totalPoints);
    setCampaign(nextCampaign);
    setTotalPoints(progress.totalPoints);
    setPickedBadge(null);
    setForm(station
      ? stationToFormValue(station)
      : { ...emptyAdventureStationForm(), unlockAtText: String(bounds.previousUnlockAt + 6) });
  }, [isNew, stationId]);
  const { status, errorMessage, reload } = useSyncScreen(load, {
    refreshOnForeground: false,
    refreshOnRemoteChange: false
  });

  const stationIndex = campaign?.stations.findIndex((item) => item.id === stationId) ?? -1;
  const station = stationIndex >= 0 ? campaign?.stations[stationIndex] ?? null : null;
  const thresholdBounds = campaign
    ? getAdventureStationThresholdBounds(campaign, stationId, totalPoints)
    : { previousUnlockAt: 0, nextUnlockAt: null };
  const badgePreviewUri = useMemo(
    () => pickedBadge?.uri ?? publicUrl(form.badgeImageKey),
    [form.badgeImageKey, pickedBadge]
  );

  if (status !== "ready" || !campaign) {
    return <SyncFallback status={status === "ready" ? "error" : status} errorMessage={errorMessage} onRetry={reload} />;
  }

  async function submit() {
    setSubmitting(true);
    try {
      let input = validateAdventureStationForm(form, {
        ...thresholdBounds,
        campaignVersion: campaign!.version
      });
      if (pickedBadge && input.badgeEnabled) {
        const badgeImageKey = await uploadImage("adventure_badge", pickedBadge);
        setForm((current) => ({ ...current, badgeImageKey }));
        setPickedBadge(null);
        input = { ...input, badgeImageKey };
      }
      if (isNew) await createAdventureStation(input);
      else await updateAdventureStation(stationId, input);
      goBackOrReplace(router, "/adventure/manage");
    } catch (error) {
      if (error instanceof SyncError && error.status === 409) {
        await refreshAfterConflict();
        return;
      }
      Alert.alert("保存失败", error instanceof Error ? error.message : "请检查内容后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  async function refreshAfterConflict() {
    try {
      const [latestCampaign, progress] = await Promise.all([
        fetchAdventureCampaign(),
        fetchAdventureProgress()
      ]);
      const latestStation = latestCampaign.stations.find((item) => item.id === stationId) ?? null;
      setCampaign(latestCampaign);
      setTotalPoints(progress.totalPoints);
      if (latestStation?.everUnlocked) {
        setForm((current) => ({
          ...current,
          unlockAtText: String(latestStation.unlockAt),
          xpEnabled: latestStation.reward.xpEnabled,
          xpText: String(latestStation.reward.xp),
          badgeEnabled: latestStation.reward.badgeEnabled,
          storyEnabled: latestStation.reward.storyEnabled
        }));
      }
      Alert.alert("关卡已更新", "已加载最新关卡状态，你填写的展示内容仍保留，请确认后重新保存。");
    } catch (refreshError) {
      Alert.alert("刷新失败", refreshError instanceof Error ? refreshError.message : "请稍后重试。");
    }
  }

  function changeBadge(image: PickedBadgeImage | null) {
    setPickedBadge(image);
    if (!image) setForm((current) => ({ ...current, badgeImageKey: null }));
  }

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <IconButton
          name="arrow-back"
          accessibilityLabel="返回关卡列表"
          onPress={() => goBackOrReplace(router, "/adventure/manage")}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" tone="muted">{campaign.title}</AppText>
          <AppText variant="title">{isNew ? "添加关卡" : `编辑 ${station?.title ?? "关卡"}`}</AppText>
        </View>
      </View>
      <AdventureStationForm
        value={form}
        everUnlocked={station?.everUnlocked ?? false}
        badgePreviewUri={badgePreviewUri}
        submitting={submitting}
        onChange={setForm}
        onBadgeChange={changeBadge}
        onSubmit={() => void submit()}
      />
    </Screen>
  );
}
