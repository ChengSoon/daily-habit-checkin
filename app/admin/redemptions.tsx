import { useCallback, useState } from "react";
import { View } from "react-native";
import { getRewardById, listRedemptions } from "../../src/rewards/rewardRepository";
import { cancelRedemption, fulfillRedemption } from "../../src/rewards/rewardService";
import { Reward, RewardRedemption } from "../../src/rewards/types";
import { AppButton, AppText, Badge, Card, HelperText } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { OwnerGate } from "../../src/ui/OwnerGate";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";

export default function AdminRedemptionsScreen() {
  return (
    <OwnerGate>
      <AdminRedemptionsContent />
    </OwnerGate>
  );
}

type RedemptionActions = {
  busyId: string | null;
  fulfill: (id: string) => void;
  cancel: (id: string) => void;
};

function RedemptionCard({ item, reward, actions }: {
  item: RewardRedemption;
  reward?: Reward;
  actions: RedemptionActions;
}) {
  const busy = actions.busyId === item.id;
  return <Card elevated={false} style={{ gap: 10, padding: 13 }}>
    <Badge label="待核销" tone="primary" />
    <AppText variant="bodyStrong">{reward?.title ?? "奖励已不存在"}</AppText>
    <AppText variant="small" tone="muted">{item.priceXp} 积分 · {new Date(item.createdAt).toLocaleString()}</AppText>
    <View style={{ flexDirection: "row", gap: 8 }}>
      <AppButton title="核销" compact onPress={() => actions.fulfill(item.id)} disabled={busy} style={{ flex: 1 }} />
      <AppButton title="取消退回积分" compact variant="ghost" onPress={() => actions.cancel(item.id)}
        disabled={busy} style={{ flex: 1 }} />
    </View>
  </Card>;
}

function RedemptionList({ items, rewards, actions }: {
  items: RewardRedemption[];
  rewards: Record<string, Reward>;
  actions: RedemptionActions;
}) {
  if (items.length === 0) {
    return <EmptyState title="没有待核销奖励" body="商城兑换后，现实奖励会出现在这里等待核销。" />;
  }
  return <View style={{ gap: 8 }}>{items.map((item) => (
    <RedemptionCard key={item.id} item={item} reward={rewards[item.rewardId]} actions={actions} />
  ))}</View>;
}

function RedemptionsView({ pending, rewards, actions, message, error }: {
  pending: RewardRedemption[];
  rewards: Record<string, Reward>;
  actions: RedemptionActions;
  message: string | null;
  error: string | null;
}) {
  return <Screen>
    <View style={{ gap: 4 }}>
      <AppText variant="display">兑现管理</AppText>
      <AppText variant="body" tone="muted">核销成员兑换的现实奖励</AppText>
    </View>
    {message ? <HelperText tone="success">{message}</HelperText> : null}
    {error ? <HelperText tone="danger">{error}</HelperText> : null}
    <RedemptionList items={pending} rewards={rewards} actions={actions} />
  </Screen>;
}

function AdminRedemptionsContent() {
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

  async function mutate(id: string, action: () => Promise<unknown>, success: string) {
    setBusyId(id);
    setMessage(null);
    setError(null);
    try {
      await action();
      setMessage(success);
      await reload();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "操作失败");
    } finally {
      setBusyId(null);
    }
  }

  const fulfill = (id: string) => void mutate(id, () => fulfillRedemption(id), "已核销");
  const cancel = (id: string) => void mutate(id, () => cancelRedemption(id), "已取消并退回积分");

  const pending = redemptions.filter((item) => item.status === "pending_fulfillment");

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  return <RedemptionsView pending={pending} rewards={rewards}
    actions={{ busyId, fulfill, cancel }} message={message} error={error} />;
}
