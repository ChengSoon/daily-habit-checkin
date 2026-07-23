import { router } from "expo-router";
import { View } from "react-native";
import { publicUrl } from "../../src/sync/uploadClient";
import type { Reward, RewardType, VirtualRewardKind } from "../../src/rewards/types";
import { useAdminRewardsController, type AdminRewardsController } from "../../src/rewards/useAdminRewardsController";
import {
  AppButton,
  AppText,
  Badge,
  Card,
  HelperText,
  Label,
  SegmentedControl,
  TextField
} from "../../src/ui/Controls";
import { OwnerGate } from "../../src/ui/OwnerGate";
import { ImagePickerField, RewardThumb } from "../../src/ui/RewardImage";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback } from "../../src/ui/SyncScreen";

export default function AdminRewardsScreen() {
  return (
    <OwnerGate>
      <AdminRewardsContent />
    </OwnerGate>
  );
}

function AdminRewardsContent() {
  const view = useAdminRewardsController();
  if (view.sync.status !== "ready") {
    return <SyncFallback status={view.sync.status} errorMessage={view.sync.errorMessage} onRetry={view.sync.reload} />;
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <AppText variant="display">奖励管理</AppText>
        <AppText variant="body" tone="muted">
          维护商城奖励目录与价格 · Owner 专属
        </AppText>
      </View>

      <RewardEditor view={view} />
      <RewardList view={view} />
    </Screen>
  );
}

function RewardTypeFields({ view }: { view: AdminRewardsController }) {
  const form = view.form;
  return <>
    <View style={{ gap: 8 }}>
      <Label>类型</Label>
      <SegmentedControl<RewardType> value={form.type} onChange={view.change("type")}
        options={[{ label: "现实", value: "real_world" }, { label: "虚拟", value: "virtual" }]} />
    </View>
    {form.type === "virtual" ? <View style={{ gap: 8 }}>
      <Label>虚拟类型</Label>
      <SegmentedControl<VirtualRewardKind> value={form.virtualKind} onChange={view.change("virtualKind")}
        options={[{ label: "主题", value: "theme" }, { label: "动效", value: "celebration" }, { label: "称号", value: "title" }]} />
    </View> : null}
  </>;
}

function RewardEditor({ view }: { view: AdminRewardsController }) {
  const form = view.form;
  return <Card elevated={false}>
    <AppText variant="section">{form.editing ? "编辑商品" : "新增商品"}</AppText>
    <ImagePickerField type={form.type} previewUri={view.previewUri} onChange={view.pickImage} />
    <TextField label="名称" value={form.title} onChangeText={view.change("title")} placeholder="例如：奶茶一杯" />
    <TextField label="描述" value={form.description} onChangeText={view.change("description")} placeholder="例如：周末兑现" />
    <RewardTypeFields view={view} />
    <TextField label="价格（积分）" value={form.priceXp} onChangeText={view.change("priceXp")} keyboardType="numeric" />
    {view.message ? <HelperText tone="success">{view.message}</HelperText> : null}
    {view.error ? <HelperText tone="danger">{view.error}</HelperText> : null}
    <View style={{ flexDirection: "row", gap: 8 }}>
      <AppButton title="保存" icon="checkmark" onPress={() => void view.save()}
        disabled={view.busy || !form.title || Number(form.priceXp) <= 0} style={{ flex: 1 }} />
      {form.editing ? <AppButton title="取消" variant="ghost" onPress={view.reset} style={{ flex: 1 }} />
        : <AppButton title="兑现管理" variant="secondary" icon="receipt-outline"
          onPress={() => router.push("/admin/redemptions")} style={{ flex: 1 }} />}
    </View>
  </Card>;
}

function RewardItem({ reward, view }: { reward: Reward; view: AdminRewardsController }) {
  return <Card elevated={false} style={{ gap: 10, padding: 13 }}>
    <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
      <RewardThumb uri={publicUrl(reward.imageKey)} type={reward.type} size={52} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <AppText variant="bodyStrong" style={{ fontSize: 14, flex: 1 }} numberOfLines={1}>{reward.title}</AppText>
          <Badge label={reward.status === "active" ? "上架" : "下架"}
            tone={reward.status === "active" ? "success" : "muted"} />
        </View>
        <AppText variant="small" tone="muted">
          {reward.type === "virtual" ? "虚拟奖励" : "现实奖励"} · {reward.priceXp} XP
        </AppText>
      </View>
    </View>
    <View style={{ flexDirection: "row", gap: 8 }}>
      <AppButton title="编辑" variant="secondary" compact onPress={() => view.edit(reward)} style={{ flex: 1 }} />
      <AppButton title={reward.status === "active" ? "下架" : "上架"} variant="ghost" compact
        onPress={() => void view.toggleArchived(reward)} disabled={view.busy} style={{ flex: 1 }} />
    </View>
  </Card>;
}

function RewardList({ view }: { view: AdminRewardsController }) {
  return <View style={{ gap: 8 }}>{view.rewards.map((reward) => (
    <RewardItem key={reward.id} reward={reward} view={view} />
  ))}</View>;
}
