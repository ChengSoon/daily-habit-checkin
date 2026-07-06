import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { createReward, listRewards, updateReward } from "../../src/rewards/rewardRepository";
import { PickedImage, toDataUri } from "../../src/rewards/rewardImage";
import { Reward, RewardType, VirtualRewardKind } from "../../src/rewards/types";
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
import { spacing } from "../../src/ui/theme";

export default function AdminRewardsScreen() {
  return (
    <OwnerGate>
      <AdminRewardsContent />
    </OwnerGate>
  );
}

function AdminRewardsContent() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [editing, setEditing] = useState<Reward | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<RewardType>("real_world");
  const [priceXp, setPriceXp] = useState("300");
  const [virtualKind, setVirtualKind] = useState<VirtualRewardKind>("none");
  const [image, setImage] = useState<PickedImage | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    listRewards({ includeArchived: true }).then(setRewards);
  }, []);

  useFocusEffect(load);

  function startEdit(reward: Reward) {
    setEditing(reward);
    setTitle(reward.title);
    setDescription(reward.description ?? "");
    setType(reward.type);
    setPriceXp(String(reward.priceXp));
    setVirtualKind(reward.virtualKind);
    setImage(reward.imageData ? { data: reward.imageData, mime: reward.imageMime ?? "image/jpeg" } : null);
    setMessage(null);
  }

  function resetForm() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setType("real_world");
    setPriceXp("300");
    setVirtualKind("none");
    setImage(null);
  }

  async function save() {
    // 图片以 base64 存库，换图/移除直接覆盖字段，无本地文件需要清理。
    const input = {
      title,
      description: description || null,
      type,
      priceXp: Number(priceXp),
      status: editing?.status ?? "active",
      virtualKind: type === "virtual" ? virtualKind : "none",
      inventoryLimit: null,
      imageData: image?.data ?? null,
      imageMime: image?.mime ?? null
    } as const;

    if (editing) {
      await updateReward(editing.id, input);
      setMessage("奖励已更新");
    } else {
      await createReward(input);
      setMessage("奖励已新增");
    }
    resetForm();
    load();
  }

  async function toggleArchived(reward: Reward) {
    await updateReward(reward.id, {
      title: reward.title,
      description: reward.description,
      type: reward.type,
      priceXp: reward.priceXp,
      status: reward.status === "active" ? "archived" : "active",
      virtualKind: reward.virtualKind,
      inventoryLimit: reward.inventoryLimit,
      imageData: reward.imageData,
      imageMime: reward.imageMime
    });
    load();
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="display">奖励管理</AppText>
        <AppText variant="body" tone="muted">
          在这里新增、编辑、上下架商品。普通使用者只能浏览和兑换，看不到这个页面。
        </AppText>
      </View>

      <Card>
        <AppText variant="section">{editing ? "编辑商品" : "新增商品"}</AppText>
        <ImagePickerField type={type} value={image} onChange={setImage} />
        <TextField label="名称" value={title} onChangeText={setTitle} placeholder="例如：奶茶一杯" />
        <TextField label="描述" value={description} onChangeText={setDescription} placeholder="例如：周末兑现" />
        <View style={{ gap: spacing.sm }}>
          <Label>类型</Label>
          <SegmentedControl<RewardType>
            value={type}
            onChange={setType}
            options={[
              { label: "现实", value: "real_world" },
              { label: "虚拟", value: "virtual" }
            ]}
          />
        </View>
        {type === "virtual" ? (
          <View style={{ gap: spacing.sm }}>
            <Label>虚拟类型</Label>
            <SegmentedControl<VirtualRewardKind>
              value={virtualKind}
              onChange={setVirtualKind}
              options={[
                { label: "主题", value: "theme" },
                { label: "动效", value: "celebration" },
                { label: "称号", value: "title" }
              ]}
            />
          </View>
        ) : null}
        <TextField label="价格（积分）" value={priceXp} onChangeText={setPriceXp} keyboardType="numeric" />
        {message ? <HelperText tone="success">{message}</HelperText> : null}
        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <AppButton title="保存" onPress={save} disabled={!title || Number(priceXp) <= 0} style={{ flex: 1 }} />
          {editing ? (
            <AppButton title="取消编辑" variant="ghost" onPress={resetForm} style={{ flex: 1 }} />
          ) : (
            <AppButton
              title="兑现管理"
              variant="secondary"
              onPress={() => router.push("/admin/redemptions")}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </Card>

      <View style={{ gap: spacing.sm }}>
        {rewards.map((reward) => (
          <Card key={reward.id}>
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <RewardThumb uri={toDataUri(reward.imageData, reward.imageMime)} type={reward.type} size={56} />
              <View style={{ flex: 1, gap: spacing.xs }}>
                <Badge
                  label={reward.status === "active" ? "上架中" : "已下架"}
                  tone={reward.status === "active" ? "success" : "muted"}
                />
                <AppText variant="bodyStrong">{reward.title}</AppText>
                <AppText variant="small" tone="muted">
                  {reward.type === "virtual" ? "虚拟奖励" : "现实奖励"} · {reward.priceXp} 积分
                </AppText>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <AppButton title="编辑" variant="secondary" compact onPress={() => startEdit(reward)} style={{ flex: 1 }} />
              <AppButton
                title={reward.status === "active" ? "下架" : "重新上架"}
                variant="ghost"
                compact
                onPress={() => toggleArchived(reward)}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
