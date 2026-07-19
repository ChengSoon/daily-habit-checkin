import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { listRewards } from "../../src/rewards/rewardRepository";
import { ensureDefaultRewards, redeemReward } from "../../src/rewards/rewardService";
import { publicUrl } from "../../src/sync/uploadClient";
import { Reward } from "../../src/rewards/types";
import { AppButton, AppText, Card, HelperText } from "../../src/ui/Controls";
import { EmptyState } from "../../src/ui/EmptyState";
import { ImagePreviewModal } from "../../src/ui/ImagePreviewModal";
import { RewardImage } from "../../src/ui/RewardImage";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";
import { useTheme } from "../../src/ui/ThemeContext";
import { getWallet } from "../../src/xp/xpRepository";

const GRID_GAP = 9;
const GRID_IMAGE_HEIGHT = 68;

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
/** board 04 不足态：细进度条 +「还差 N」，无重框。 */
function ShortfallLabel({ priceXp, balance }: { priceXp: number; balance: number }) {
  const { colors } = useTheme();
  const shortfall = Math.max(0, priceXp - balance);
  const progress = priceXp <= 0 ? 1 : Math.min(1, Math.max(0, balance / priceXp));
  const progressPct = Math.round(progress * 100);

  return (
    <View accessibilityRole="text" accessibilityLabel={`还差 ${shortfall}`} style={{ gap: 4 }}>
      <View style={{ height: 9, borderRadius: 999, backgroundColor: "#EEF1F7", overflow: "hidden" }}>
        <View style={{ width: `${progressPct}%`, height: "100%", borderRadius: 999, overflow: "hidden" }}>
          <Svg width={200} height={9} viewBox="0 0 100 9" preserveAspectRatio="none" style={{ width: "100%", height: 9 }}>
            <Defs>
              <LinearGradient id="shopProg" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0%" stopColor={colors.candySky} />
                <Stop offset="100%" stopColor={colors.partner} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100" height="9" fill="url(#shopProg)" />
          </Svg>
        </View>
      </View>
      <AppText variant="small" tone="muted" style={{ fontWeight: "700" }}>
        还差 {shortfall}
      </AppText>
    </View>
  );
}

export default function ShopScreen() {
  const { colors } = useTheme();
  const [balance, setBalance] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ uri: string; title: string } | null>(null);

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
      <Pressable onPress={() => router.back()} style={{ flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" }} hitSlop={8}>
        <Ionicons name="chevron-back" size={16} color={colors.inkSoft} />
        <AppText variant="small" tone="soft">返回</AppText>
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="display">商城</AppText>
          <AppText variant="body" tone="muted">
            用 XP 兑换小心意
          </AppText>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 5,
            backgroundColor: colors.candySunSurface,
            borderRadius: 999,
            paddingHorizontal: 12,
            paddingVertical: 8
          }}
        >
          <Ionicons name="diamond" size={15} color={colors.candySunInk} />
          <AppText variant="small" style={{ color: colors.candySunInk, fontWeight: "800", fontSize: 12 }}>
            {balance.toLocaleString("en-US")}
          </AppText>
        </View>
      </View>

      {message ? <HelperText tone="success">{message}</HelperText> : null}
      {error ? <HelperText tone="danger">{error}</HelperText> : null}

      {rewards.length === 0 ? (
        <EmptyState title="商城还没有商品" body="等待管理员上架奖励后，就可以在这里兑换啦。" icon="gift-outline" />
      ) : (
        <View style={{ gap: GRID_GAP }}>
          {groupRewards(rewards).map((row, rowIndex) => (
            <View key={row[0].id} style={{ flexDirection: "row", gap: GRID_GAP }}>
              {row.map((reward, colIndex) => {
                const thumbTints = [colors.surfaceTint, colors.partnerSurface, colors.candySkySurface, colors.successSurface, colors.candySunSurface, colors.candyOrangeSurface];
                const thumbBg = thumbTints[(rowIndex * 2 + colIndex) % thumbTints.length];
                const canRedeem = balance >= reward.priceXp;
                return (
                  <Card key={reward.id} elevated={false} style={{ flex: 1, padding: 10, overflow: "hidden", gap: 8, borderRadius: 20 }}>
                    {(() => {
                      const imageUri = publicUrl(reward.imageKey);
                      const imageNode = (
                        <View
                          style={{
                            height: GRID_IMAGE_HEIGHT,
                            borderRadius: 12,
                            backgroundColor: thumbBg,
                            alignItems: "center",
                            justifyContent: "center",
                            overflow: "hidden"
                          }}
                        >
                          <RewardImage
                            uri={imageUri}
                            type={reward.type}
                            height={GRID_IMAGE_HEIGHT}
                            radiusToken={0}
                            contentFit="cover"
                          />
                        </View>
                      );

                      if (!imageUri) {
                        return imageNode;
                      }

                      return (
                        <Pressable
                          accessibilityRole="imagebutton"
                          accessibilityLabel={`预览 ${reward.title}`}
                          onPress={() => setPreview({ uri: imageUri, title: reward.title })}
                          style={({ pressed }) => (pressed ? { opacity: 0.9 } : null)}
                        >
                          {imageNode}
                        </Pressable>
                      );
                    })()}
                    <View style={{ flex: 1, gap: 6 }}>
                      <View style={{ flex: 1, gap: 3 }}>
                        <AppText variant="bodyStrong" numberOfLines={2} style={{ fontSize: 15 }}>
                          {reward.title}
                        </AppText>
                        <AppText variant="small" tone="muted">
                          {rewardTypeLabel(reward)}
                        </AppText>
                      </View>
                      {canRedeem ? (
                        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                          <View style={{ borderRadius: 999, backgroundColor: colors.candySunSurface, paddingHorizontal: 9, paddingVertical: 4 }}>
                            <AppText variant="small" style={{ color: colors.candySunInk, fontWeight: "800", fontSize: 12, lineHeight: 16 }}>
                              {reward.priceXp} XP
                            </AppText>
                          </View>
                          <Pressable
                            onPress={() => redeem(reward)}
                            style={{ borderRadius: 999, backgroundColor: colors.successSurface, paddingHorizontal: 9, paddingVertical: 4 }}
                          >
                            <AppText variant="small" style={{ color: colors.candyMintInk, fontWeight: "800", fontSize: 12, lineHeight: 16 }}>
                              可兑
                            </AppText>
                          </Pressable>
                        </View>
                      ) : (
                        <View style={{ gap: 6 }}>
                          <View style={{ borderRadius: 999, backgroundColor: colors.candySunSurface, paddingHorizontal: 9, paddingVertical: 4, alignSelf: "flex-start" }}>
                            <AppText variant="small" style={{ color: colors.candySunInk, fontWeight: "800", fontSize: 12, lineHeight: 16 }}>
                              {reward.priceXp} XP
                            </AppText>
                          </View>
                          <ShortfallLabel priceXp={reward.priceXp} balance={balance} />
                        </View>
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

      <AppButton
        title="兑换记录"
        icon="gift-outline"
        fullWidth
        onPress={() => router.push("/shop/redemptions")}
      />

      <ImagePreviewModal
        visible={preview !== null}
        uri={preview?.uri ?? null}
        title={preview?.title}
        onClose={() => setPreview(null)}
      />
    </Screen>
  );
}
