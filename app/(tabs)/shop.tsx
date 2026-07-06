import { useCallback, useState } from "react";
import { View } from "react-native";
import { listRewards } from "../../src/rewards/rewardRepository";
import { ensureDefaultRewards, redeemReward } from "../../src/rewards/rewardService";
import { toDataUri } from "../../src/rewards/rewardImage";
import { Reward } from "../../src/rewards/types";
import { AppButton, AppText, Badge, Card, HelperText } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { RewardImage } from "../../src/ui/RewardImage";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { radius, spacing } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";
import { getWallet } from "../../src/xp/xpRepository";

function rewardTypeLabel(reward: Reward): string {
  return reward.type === "virtual" ? "虚拟奖励" : "现实奖励";
}

export default function ShopScreen() {
  const { colors } = useTheme();
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

  const { status, errorMessage, reload } = useSyncScreen(load);

  async function redeem(reward: Reward) {
    setError(null);
    setMessage(null);

    try {
      const redemption = await redeemReward(reward.id);
      setMessage(redemption.status === "fulfilled" ? "已解锁奖励" : "已提交兑换，等待兑现");
      await reload();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "兑换失败");
    }
  }

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  return (
    <Screen>
      <AppText variant="display">奖励商城</AppText>

      <Card
        style={{
          backgroundColor: colors.primary,
          borderColor: colors.primary,
          gap: spacing.xs
        }}
      >
        <AppText variant="caption" tone="onPrimary" style={{ opacity: 0.85 }}>
          我的积分
        </AppText>
        <AppText variant="display" tone="onPrimary">
          {balance}
        </AppText>
        <AppText variant="small" tone="onPrimary" style={{ opacity: 0.85 }}>
          完成打卡即可累积积分，兑换喜欢的奖励
        </AppText>
      </Card>

      {message ? <HelperText tone="success">{message}</HelperText> : null}
      {error ? <HelperText tone="danger">{error}</HelperText> : null}

      {rewards.length === 0 ? (
        <EmptyState title="商城还没有商品" body="等待管理员上架奖励后，就可以在这里兑换啦。" icon="gift-outline" />
      ) : (
        <View style={{ gap: spacing.md }}>
          {rewards.map((reward) => {
            const canRedeem = balance >= reward.priceXp;
            return (
              <Card key={reward.id} style={{ padding: 0, overflow: "hidden", gap: 0 }}>
                <RewardImage uri={toDataUri(reward.imageData, reward.imageMime)} type={reward.type} height={160} radiusToken={0} />
                <View style={{ padding: spacing.lg, gap: spacing.md }}>
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
                    <View
                      style={{
                        alignSelf: "flex-start",
                        borderRadius: radius.md,
                        backgroundColor: colors.surfaceTint,
                        paddingHorizontal: spacing.md,
                        paddingVertical: spacing.xs
                      }}
                    >
                      <AppText variant="bodyStrong" tone="primary">
                        {reward.priceXp} 积分
                      </AppText>
                    </View>
                  </View>
                  <AppButton
                    title={canRedeem ? "兑换" : `还差 ${reward.priceXp - balance} 积分`}
                    onPress={() => redeem(reward)}
                    disabled={!canRedeem}
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
