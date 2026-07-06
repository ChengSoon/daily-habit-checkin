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
    setMessage("已确认兑现");
    await load();
  }

  async function cancel(id: string) {
    await cancelRedemption(id);
    setMessage("已取消兑换并退回 XP");
    await load();
  }

  const pending = redemptions.filter((item) => item.status === "pending_fulfillment");

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="display">兑现管理</AppText>
        <AppText variant="body" tone="muted">
          现实奖励兑换后在这里确认
        </AppText>
      </View>
      {message ? <HelperText tone="success">{message}</HelperText> : null}
      {pending.length === 0 ? (
        <EmptyState title="没有待兑现奖励" body="她兑换现实奖励后，会出现在这里。" />
      ) : (
        <View style={{ gap: spacing.sm }}>
          {pending.map((item) => {
            const reward = rewards[item.rewardId];
            return (
              <Card key={item.id}>
                <Badge label="待兑现" tone="primary" />
                <AppText variant="bodyStrong">{reward?.title ?? "奖励已不存在"}</AppText>
                <AppText variant="small" tone="muted">
                  {item.priceXp} XP · {new Date(item.createdAt).toLocaleString()}
                </AppText>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <AppButton title="确认已兑现" compact onPress={() => fulfill(item.id)} style={{ flex: 1 }} />
                  <AppButton title="取消并退回 XP" compact variant="ghost" onPress={() => cancel(item.id)} style={{ flex: 1 }} />
                </View>
              </Card>
            );
          })}
        </View>
      )}
    </Screen>
  );
}
