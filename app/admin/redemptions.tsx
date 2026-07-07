import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { getRewardById, listRedemptions } from "../../src/rewards/rewardRepository";
import { cancelRedemption, fulfillRedemption } from "../../src/rewards/rewardService";
import { Reward, RewardRedemption } from "../../src/rewards/types";
import { AppButton, AppText, Badge, Card, HelperText } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { Screen } from "../../src/ui/Screen";
import { spacing } from "../../src/ui/theme";

export default function AdminRedemptionsScreen() {
  const [redemptions, setRedemptions] = useState<RewardRedemption[]>([]);
  const [rewards, setRewards] = useState<Record<string, Reward>>({});
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const items = await listRedemptions();
    const pairs = await Promise.all(
      items.map(async (item) => [item.rewardId, await getRewardById(item.rewardId)] as const)
    );
    setRedemptions(items);
    setRewards(Object.fromEntries(pairs.flatMap(([id, reward]) => (reward ? [[id, reward]] : []))));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function fulfill(id: string) {
    await fulfillRedemption(id);
    setMessage("已核销");
    await load();
  }

  async function cancel(id: string) {
    await cancelRedemption(id);
    setMessage("已取消并退回积分");
    await load();
  }

  const pending = redemptions.filter((item) => item.status === "pending_fulfillment");

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="display">核销管理</AppText>
        <AppText variant="body" tone="muted">
          购买后的奖励在这里核销
        </AppText>
      </View>
      {message ? <HelperText tone="success">{message}</HelperText> : null}
      {pending.length === 0 ? (
        <EmptyState title="没有待核销奖励" body="购买奖励后，会出现在这里等待核销。" />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {pending.map((item) => {
            const reward = rewards[item.rewardId];
            return (
              <Card key={item.id}>
                <Badge label="待核销" tone="primary" />
                <AppText variant="bodyStrong">{reward?.title ?? "奖励已不存在"}</AppText>
                <AppText variant="small" tone="muted">
                  {item.priceXp} 积分 · {new Date(item.createdAt).toLocaleString()}
                </AppText>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <AppButton title="核销" compact onPress={() => fulfill(item.id)} style={{ flex: 1 }} />
                  <AppButton title="取消退回积分" compact variant="ghost" onPress={() => cancel(item.id)} style={{ flex: 1 }} />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
