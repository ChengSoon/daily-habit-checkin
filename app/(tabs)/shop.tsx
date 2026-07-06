import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { listRewards } from "../../src/rewards/rewardRepository";
import { ensureDefaultRewards, redeemReward } from "../../src/rewards/rewardService";
import { Reward } from "../../src/rewards/types";
import { AppButton, AppText, Badge, Card, HelperText } from "../../src/ui/Controls";
import { Screen } from "../../src/ui/Screen";
import { spacing } from "../../src/ui/theme";
import { getWallet } from "../../src/xp/xpRepository";

function rewardTypeLabel(reward: Reward): string {
  return reward.type === "virtual" ? "虚拟奖励" : "现实奖励";
}

export default function ShopScreen() {
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    await ensureDefaultRewards();
    const wallet = await getWallet();
    setBalance(wallet.balance);
    setRewards(await listRewards({ includeArchived: false }));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function redeem(reward: Reward) {
    setError(null);
    setMessage(null);

    try {
      const redemption = await redeemReward(reward.id);
      setMessage(redemption.status === "fulfilled" ? "已解锁奖励" : "已提交兑换，等待兑现");
      await load();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "兑换失败");
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="display">奖励商城</AppText>
        <AppText variant="body" tone="muted">
          当前余额 {balance} XP
        </AppText>
      </View>

      {message ? <HelperText tone="success">{message}</HelperText> : null}
      {error ? <HelperText tone="danger">{error}</HelperText> : null}

      <View style={{ gap: spacing.md }}>
        {rewards.map((reward) => {
          const canRedeem = balance >= reward.priceXp;
          return (
            <Card key={reward.id}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
                <View style={{ flex: 1, gap: spacing.xs }}>
                  <Badge label={rewardTypeLabel(reward)} tone={reward.type === "virtual" ? "primary" : "success"} />
                  <AppText variant="bodyStrong">{reward.title}</AppText>
                  {reward.description ? (
                    <AppText variant="small" tone="muted">
                      {reward.description}
                    </AppText>
                  ) : null}
                </View>
                <AppText variant="bodyStrong" tone="primary">
                  {reward.priceXp} XP
                </AppText>
              </View>
              <AppButton
                title={canRedeem ? "兑换" : `还差 ${reward.priceXp - balance} XP`}
                onPress={() => redeem(reward)}
                disabled={!canRedeem}
              />
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}
