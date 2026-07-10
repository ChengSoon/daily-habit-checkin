import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, View } from "react-native";
import {
  deleteAdventureStation,
  reorderAdventureStations
} from "../../src/adventure/adventureAdminClient";
import { fetchAdventureCampaign } from "../../src/adventure/adventureClient";
import type { AdventureCampaign, AdventureStation } from "../../src/adventure/types";
import { goBackOrReplace } from "../../src/navigation/goBackOrReplace";
import { AppButton, AppText, Badge, Card, IconButton } from "../../src/ui/Controls";
import { OwnerGate } from "../../src/ui/OwnerGate";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { spacing } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";

export default function AdventureManageScreen() {
  return <OwnerGate fallbackHref="/adventure"><AdventureManageContent /></OwnerGate>;
}

function AdventureManageContent() {
  const { colors } = useTheme();
  const [campaign, setCampaign] = useState<AdventureCampaign | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const load = useCallback(async () => setCampaign(await fetchAdventureCampaign()), []);
  const { status, errorMessage, reload } = useSyncScreen(load);

  if (status !== "ready" || !campaign) {
    return <SyncFallback status={status === "ready" ? "error" : status} errorMessage={errorMessage} onRetry={reload} />;
  }

  async function move(station: AdventureStation, direction: -1 | 1) {
    const future = campaign!.stations.filter((item) => !item.everUnlocked);
    const index = future.findIndex((item) => item.id === station.id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= future.length) return;
    const ordered = [...future];
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    setBusyId(station.id);
    try {
      setCampaign(await reorderAdventureStations(ordered.map((item) => item.id), campaign!.version));
    } catch (error) {
      Alert.alert("排序失败", error instanceof Error ? error.message : "请刷新后重试。");
      await reload();
    } finally {
      setBusyId(null);
    }
  }

  function remove(station: AdventureStation) {
    Alert.alert("删除关卡", `确定删除“${station.title}”吗？`, [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: async () => {
          setBusyId(station.id);
          try {
            await deleteAdventureStation(station.id, campaign!.version);
            await reload();
          } catch (error) {
            Alert.alert("删除失败", error instanceof Error ? error.message : "请稍后重试。");
            await reload();
          } finally {
            setBusyId(null);
          }
        }
      }
    ]);
  }

  const future = campaign.stations.filter((station) => !station.everUnlocked);

  return (
    <Screen>
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <IconButton
          name="arrow-back"
          accessibilityLabel="返回冒险"
          onPress={() => goBackOrReplace(router, "/adventure")}
        />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="caption" tone="muted">当前路线</AppText>
          <AppText variant="title">关卡设计</AppText>
        </View>
        <AppButton title="添加" icon="add" compact onPress={() => router.push("/adventure/station/new")} />
      </View>

      <View style={{ backgroundColor: colors.ink, padding: spacing.lg, gap: spacing.xs }}>
        <AppText variant="section" style={{ color: colors.surface }}>{campaign.title}</AppText>
        <AppText variant="small" style={{ color: colors.surface, opacity: 0.72 }}>
          {campaign.stations.length} 个关卡 · 最终累计 {campaign.stations.at(-1)?.unlockAt ?? 0} 点
        </AppText>
      </View>

      <View style={{ gap: spacing.sm }}>
        {campaign.stations.map((station) => {
          const futureIndex = future.findIndex((item) => item.id === station.id);
          return (
            <Card key={station.id}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
                    <AppText variant="bodyStrong">{station.title}</AppText>
                    <Badge label={station.everUnlocked ? "已解锁" : "可编辑"} tone={station.everUnlocked ? "success" : "muted"} />
                  </View>
                  <AppText variant="small" tone="muted">
                    累计 {station.unlockAt} 点 · {rewardSummary(station)}
                  </AppText>
                </View>
                {!station.everUnlocked ? (
                  <View style={{ flexDirection: "row", gap: spacing.xs }}>
                    <IconButton
                      name="arrow-up"
                      accessibilityLabel="向前移动关卡"
                      disabled={futureIndex <= 0 || busyId !== null}
                      onPress={() => void move(station, -1)}
                    />
                    <IconButton
                      name="arrow-down"
                      accessibilityLabel="向后移动关卡"
                      disabled={futureIndex >= future.length - 1 || busyId !== null}
                      onPress={() => void move(station, 1)}
                    />
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: "row", gap: spacing.sm }}>
                <AppButton
                  title="编辑"
                  icon="create-outline"
                  variant="secondary"
                  compact
                  onPress={() => router.push(`/adventure/station/${station.id}`)}
                />
                {!station.everUnlocked ? (
                  <AppButton
                    title="删除"
                    icon="trash-outline"
                    variant="danger"
                    compact
                    disabled={busyId !== null}
                    onPress={() => remove(station)}
                  />
                ) : null}
              </View>
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

function rewardSummary(station: AdventureStation): string {
  const rewards = [
    station.reward.xpEnabled ? `${station.reward.xp} XP` : null,
    station.reward.badgeEnabled ? "勋章" : null,
    station.reward.storyEnabled ? "来信" : null
  ].filter(Boolean);
  return rewards.join(" · ");
}
