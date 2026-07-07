import { useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { getRewardById, listRedemptions } from "../../src/rewards/rewardRepository";
import { cancelRedemption, fulfillRedemption } from "../../src/rewards/rewardService";
import { toDataUri } from "../../src/rewards/rewardImage";
import { Reward, RewardRedemption } from "../../src/rewards/types";
import { AppButton, AppText, Badge, Card, HelperText } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { RewardThumb } from "../../src/ui/RewardImage";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { spacing } from "../../src/ui/theme";

const STATUS_LABEL = {
  pending_fulfillment: "待核销",
  fulfilled: "已核销",
  cancelled: "已取消"
} as const;

export default function RedemptionsScreen() {
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [rewards, setRewards] = useState<Record<string, Reward>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function redeem(id: string) {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      await fulfillRedemption(id);
      setMessage("已核销，尽情享用吧 💞");
      await reload();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "核销失败");
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(id: string) {
    setBusyId(id);
    setError(null);
    setMessage(null);
    try {
      await cancelRedemption(id);
      setMessage("已取消并退回积分");
      await reload();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "取消失败");
    } finally {
      setBusyId(null);
    }
  }

  function renderGroup(groupStatus: RewardRedemption["status"], items: RewardRedemption[]) {
    if (items.length === 0) {
      return null;
    }

    return (
      <View style={{ gap: spacing.sm }}>
        <AppText variant="caption" tone="muted">
          {STATUS_LABEL[groupStatus]}
        </AppText>
        {items.map((item) => {
          const reward = rewards[item.rewardId];
          const isPending = item.status === "pending_fulfillment";
          const isBusy = busyId === item.id;
          return (
            <Card key={item.id} style={{ gap: spacing.md }}>
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
              {isPending ? (
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <AppButton
                    title="核销"
                    compact
                    onPress={() => redeem(item.id)}
                    disabled={isBusy}
                    style={{ flex: 1 }}
                  />
                  <AppButton
                    title="取消退回积分"
                    compact
                    variant="ghost"
                    onPress={() => cancel(item.id)}
                    disabled={isBusy}
                    style={{ flex: 1 }}
                  />
                </View>
              ) : null}
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
      {message ? <HelperText tone="success">{message}</HelperText> : null}
      {error ? <HelperText tone="danger">{error}</HelperText> : null}
      {redemptions.length === 0 ? (
        <EmptyState title="还没有兑换记录" body="攒够积分后，可以在奖励商城购买喜欢的奖励，再来这里核销。" />
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
