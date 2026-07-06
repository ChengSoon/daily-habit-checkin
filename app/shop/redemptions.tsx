import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { getRewardById, listRedemptions } from "../../src/rewards/rewardRepository";
import { toDataUri } from "../../src/rewards/rewardImage";
import { Reward, RewardRedemption } from "../../src/rewards/types";
import { AppText, Badge, Card } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { RewardThumb } from "../../src/ui/RewardImage";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { spacing } from "../../src/ui/theme";

const STATUS_LABEL = {
  pending_fulfillment: "待兑现",
  fulfilled: "已兑现",
  cancelled: "已取消"
} as const;

export default function RedemptionsScreen() {
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [rewards, setRewards] = useState<Record<string, Reward>>({});

  const load = useCallback(async () => {
    const items = await listRedemptions();
    const pairs = await Promise.all(
      items.map(async (item) => [item.rewardId, await getRewardById(item.rewardId)] as const)
    );
    setRedemptions(items);
    setRewards(Object.fromEntries(pairs.flatMap(([id, reward]) => (reward ? [[id, reward]] : []))));
  }, []);

  const { status, errorMessage, reload } = useSyncScreen(load);

  const groups = useMemo(() => {
    return {
      pending_fulfillment: redemptions.filter((item) => item.status === "pending_fulfillment"),
      fulfilled: redemptions.filter((item) => item.status === "fulfilled"),
      cancelled: redemptions.filter((item) => item.status === "cancelled")
    };
  }, [redemptions]);

  function renderGroup(status: RewardRedemption["status"], items: RewardRedemption[]) {
    if (items.length === 0) {
      return null;
    }

    return (
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" tone="muted">
          {STATUS_LABEL[status]}
        </AppText>
        {items.map((item) => {
          const reward = rewards[item.rewardId];
          return (
            <Card key={item.id}>
              <View style={{ flexDirection: "row", gap: spacing.md }}>
                <RewardThumb uri={toDataUri(reward?.imageData ?? null, reward?.imageMime ?? null)} type={reward?.type ?? "real_world"} />
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Badge label={STATUS_LABEL[item.status]} tone={item.status === "cancelled" ? "muted" : "primary"} />
                  <AppText variant="bodyStrong">{reward?.title ?? "奖励已不存在"}</AppText>
                  <AppText variant="small" tone="muted">
                    {new Date(item.createdAt).toLocaleString()}
                  </AppText>
                </View>
                <AppText variant="bodyStrong" tone="primary">
                  {item.priceXp} 积分
                </AppText>
              </View>
            </Card>
          );
        })}
      </View>
    );
  }

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  return (
    <Screen>
      <AppText variant="display">兑换记录</AppText>
      {redemptions.length === 0 ? (
        <EmptyState title="还没有兑换记录" body="攒够积分后，可以在奖励商城兑换喜欢的奖励。" />
      ) : (
        <View style={{ gap: spacing.lg }}>
          {renderGroup("pending_fulfillment", groups.pending_fulfillment)}
          {renderGroup("fulfilled", groups.fulfilled)}
          {renderGroup("cancelled", groups.cancelled)}
        </View>
      )}
    </Screen>
  );
}
