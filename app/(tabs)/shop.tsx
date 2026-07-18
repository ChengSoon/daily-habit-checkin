import { useCallback, useState } from "react";
import { View } from "react-native";
import { listRewards } from "../../src/rewards/rewardRepository";
import { ensureDefaultRewards, redeemReward } from "../../src/rewards/rewardService";
import { publicUrl } from "../../src/sync/uploadClient";
import { Reward } from "../../src/rewards/types";
import { AppButton, AppText, Badge, Card, HelperText } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { RewardImage } from "../../src/ui/RewardImage";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { radius, spacing } from "../../src/ui/theme";
import { useTheme } from "../../src/ui/ThemeContext";
import { getWallet } from "../../src/xp/xpRepository";

const GRID_GAP = spacing.sm;
const GRID_IMAGE_HEIGHT = 104;

function rewardTypeLabel(reward: Reward): string {
  return reward.type === "virtual" ? "虚拟奖励" : "现实奖励";
}

function groupRewards(rewards: Reward[]): Reward[][] {
  const rows: Reward[][] = [];
  for (let index = 0; index < rewards.length; index += 2) {
    rows.push(rewards.slice(index, index + 2));
  }
  return rows;
}

/** 积分不足时的状态条：进度 + 差额，替代禁用购买按钮。 */
function ShortfallLabel({ priceXp, balance }: { priceXp: number; balance: number }) {
  const { colors } = useTheme();
  const shortfall = Math.max(0, priceXp - balance);
  const progress = priceXp <= 0 ? 1 : Math.min(1, Math.max(0, balance / priceXp));
  const progressPct = Math.round(progress * 100);

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={`还差 ${shortfall} 积分，已攒 ${progressPct}%`}
      style={{
        minHeight: 40,
        borderRadius: radius.md,
        backgroundColor: colors.candySkySurface,
        borderWidth: 1,
        borderColor: colors.line,
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.sm,
        gap: 6,
        justifyContent: "center"
      }}
    >
      <View
        style={{
          height: 5,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceMuted,
          overflow: "hidden"
        }}
      >
        <View
          style={{
            width: `${progressPct}%`,
            height: "100%",
            borderRadius: radius.pill,
            backgroundColor: colors.primary
          }}
        />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.xs }}>
        <AppText variant="small" tone="primary" style={{ fontWeight: "700" }} numberOfLines={1}>
          还差 {shortfall}
        </AppText>
        <AppText variant="caption" tone="muted" numberOfLines={1} style={{ textTransform: "none", letterSpacing: 0 }}>
          {Math.min(balance, priceXp)}/{priceXp}
        </AppText>
      </View>
    </View>
  );
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
      await redeemReward(reward.id);
      setMessage("已购买，去「兑换记录」里核销后即可使用");
      await reload();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "购买失败");
    }
  }

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="display">商城</AppText>
        <AppText variant="body" tone="muted">
          用 XP 兑换小心意
        </AppText>
      </View>

      <View
        style={{
          borderRadius: 28,
          overflow: "hidden",
          backgroundColor: colors.primary,
          padding: spacing.lg,
          gap: spacing.xs,
          shadowColor: colors.primary,
          shadowOpacity: 0.28,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 10 },
          elevation: 6
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            right: -24,
            top: -24,
            width: 140,
            height: 140,
            borderRadius: 999,
            backgroundColor: colors.candySun,
            opacity: 0.35
          }}
        />
        <AppText variant="caption" tone="onPrimary" style={{ opacity: 0.85 }}>
          我的积分钱包
        </AppText>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          <AppText variant="display" tone="onPrimary" style={{ fontSize: 36, lineHeight: 42 }}>
            {balance}
          </AppText>
          <AppText variant="bodyStrong" tone="onPrimary" style={{ opacity: 0.9, marginBottom: 6 }}>
            XP
          </AppText>
        </View>
        <AppText variant="small" tone="onPrimary" style={{ opacity: 0.9 }}>
          完成打卡即可累积 XP，兑换喜欢的奖励
        </AppText>
      </View>

      {message ? <HelperText tone="success">{message}</HelperText> : null}
      {error ? <HelperText tone="danger">{error}</HelperText> : null}

      {rewards.length === 0 ? (
        <EmptyState title="商城还没有商品" body="等待管理员上架奖励后，就可以在这里兑换啦。" icon="gift-outline" />
      ) : (
        <View style={{ gap: GRID_GAP }}>
          {groupRewards(rewards).map((row) => (
            <View key={row[0].id} style={{ flexDirection: "row", gap: GRID_GAP }}>
              {row.map((reward) => {
                const canRedeem = balance >= reward.priceXp;
                return (
                  <Card key={reward.id} style={{ flex: 1, padding: 0, overflow: "hidden", gap: 0, borderRadius: radius.lg }}>
                    <RewardImage
                      uri={publicUrl(reward.imageKey)}
                      type={reward.type}
                      height={GRID_IMAGE_HEIGHT}
                      radiusToken={0}
                      contentFit="contain"
                    />
                    <View style={{ flex: 1, padding: spacing.sm, gap: spacing.sm }}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <Badge label={rewardTypeLabel(reward)} tone={reward.type === "virtual" ? "primary" : "success"} />
                        <AppText variant="bodyStrong" numberOfLines={2}>
                          {reward.title}
                        </AppText>
                        {reward.description ? (
                          <AppText variant="small" tone="muted" numberOfLines={2}>
                            {reward.description}
                          </AppText>
                        ) : null}
                      </View>
                      <View
                        style={{
                          alignSelf: "flex-start",
                          borderRadius: radius.pill,
                          backgroundColor: colors.candySunSurface,
                          paddingHorizontal: spacing.sm + 2,
                          paddingVertical: 4
                        }}
                      >
                        <AppText variant="small" tone="primary" style={{ fontWeight: "700" }}>
                          {reward.priceXp} XP
                        </AppText>
                      </View>
                      {canRedeem ? (
                        <AppButton title="购买" onPress={() => redeem(reward)} compact fullWidth />
                      ) : (
                        <ShortfallLabel priceXp={reward.priceXp} balance={balance} />
                      )}
                    </View>
                  </Card>
                );
              })}
              {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}
