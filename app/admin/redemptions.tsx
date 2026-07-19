import { useCallback, useState } from "react";
import { View } from "react-native";
import { getRewardById, listRedemptions } from "../../src/rewards/rewardRepository";
import { cancelRedemption, fulfillRedemption } from "../../src/rewards/rewardService";
import { Reward, RewardRedemption } from "../../src/rewards/types";
import { AppButton, AppText, Badge, Card, HelperText } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";

export default function AdminRedemptionsScreen() {
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

  async function fulfill(id: string) {
    setBusyId(id);
    setMessage(null);
    setError(null);
    try {
      await fulfillRedemption(id);
      setMessage("已核销");
      await reload();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "核销失败");
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(id: string) {
    setBusyId(id);
    setMessage(null);
    setError(null);
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

  const pending = redemptions.filter((item) => item.status === "pending_fulfillment");

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <AppText variant="display">兑现管理</AppText>
        <AppText variant="body" tone="muted">
          核销成员兑换的现实奖励
        </AppText>
      </View>

      {message ? <HelperText tone="success">{message}</HelperText> : null}
      {error ? <HelperText tone="danger">{error}</HelperText> : null}
      {pending.length === 0 ? (
        <EmptyState title="没有待核销奖励" body="商城兑换后，现实奖励会出现在这里等待核销。" />
      ) : (
        <View style={{ gap: 8 }}>
          {pending.map((item) => {
            const reward = rewards[item.rewardId];
            return (
              <Card key={item.id} elevated={false} style={{ gap: 10, padding: 13 }}>
                <Badge label="待核销" tone="primary" />
                <AppText variant="bodyStrong">{reward?.title ?? "奖励已不存在"}</AppText>
                <AppText variant="small" tone="muted">
                  {item.priceXp} 积分 · {new Date(item.createdAt).toLocaleString()}
                </AppText>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <AppButton
                    title="核销"
                    compact
                    onPress={() => fulfill(item.id)}
                    disabled={busyId === item.id}
                    style={{ flex: 1 }}
                  />
                  <AppButton
                    title="取消退回积分"
                    compact
                    variant="ghost"
                    onPress={() => cancel(item.id)}
                    disabled={busyId === item.id}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
