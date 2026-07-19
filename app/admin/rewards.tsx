import { router } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import { createReward, listRewards, updateReward } from "../../src/rewards/rewardRepository";
import { PickedImage } from "../../src/rewards/rewardImage";
import { uploadImage, publicUrl } from "../../src/sync/uploadClient";
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
import { SyncFallback, useSyncScreen } from "../../src/ui/SyncScreen";

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
  // 图片有两种来源：编辑时带回的已有远程图（imageKey）、以及刚从相册/相机选的本地图（picked）。
  // 保存时若有 picked 则先上传拿到新 key，否则沿用 imageKey；移除则两者都清空。
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [picked, setPicked] = useState<PickedImage | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setRewards(await listRewards({ includeArchived: true }));
  }, []);

  const { status, errorMessage, reload } = useSyncScreen(load);

  // 预览地址：优先显示刚选的本地图，其次是已有远程图，都没有则占位。
  const previewUri = picked ? picked.uri : publicUrl(imageKey);

  function startEdit(reward: Reward) {
    setEditing(reward);
    setTitle(reward.title);
    setDescription(reward.description ?? "");
    setType(reward.type);
    setPriceXp(String(reward.priceXp));
    setVirtualKind(reward.virtualKind);
    setImageKey(reward.imageKey);
    setPicked(null);
    setMessage(null);
    setError(null);
  }

  function resetForm() {
    setEditing(null);
    setTitle("");
    setDescription("");
    setType("real_world");
    setPriceXp("300");
    setVirtualKind("none");
    setImageKey(null);
    setPicked(null);
  }

  function onPickImage(image: PickedImage | null) {
    if (image) {
      setPicked(image);
    } else {
      // 移除：清掉本地选择与已有远程图。
      setPicked(null);
      setImageKey(null);
    }
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      // 有新选的本地图就先直传 R2 拿 key，否则沿用原有 key（可能为 null）。
      const finalKey = picked ? await uploadImage("reward", picked) : imageKey;
      const input = {
        title,
        description: description || null,
        type,
        priceXp: Number(priceXp),
        status: editing?.status ?? "active",
        virtualKind: type === "virtual" ? virtualKind : "none",
        inventoryLimit: null,
        imageKey: finalKey
      } as const;

      if (editing) {
        await updateReward(editing.id, input);
        setMessage("奖励已更新");
      } else {
        await createReward(input);
        setMessage("奖励已新增");
      }
      resetForm();
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchived(reward: Reward) {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      await updateReward(reward.id, {
        title: reward.title,
        description: reward.description,
        type: reward.type,
        priceXp: reward.priceXp,
        status: reward.status === "active" ? "archived" : "active",
        virtualKind: reward.virtualKind,
        inventoryLimit: reward.inventoryLimit,
        imageKey: reward.imageKey
      });
      setMessage(reward.status === "active" ? "奖励已下架" : "奖励已重新上架");
      await reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  if (status !== "ready") {
    return <SyncFallback status={status} errorMessage={errorMessage} onRetry={reload} />;
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <AppText variant="display">奖励管理</AppText>
        <AppText variant="body" tone="muted">
          维护商城奖励目录与价格 · Owner 专属
        </AppText>
      </View>

      <Card elevated={false}>
        <AppText variant="section">{editing ? "编辑商品" : "新增商品"}</AppText>
        <ImagePickerField type={type} previewUri={previewUri} onChange={onPickImage} />
        <TextField label="名称" value={title} onChangeText={setTitle} placeholder="例如：奶茶一杯" />
        <TextField label="描述" value={description} onChangeText={setDescription} placeholder="例如：周末兑现" />
        <View style={{ gap: 8 }}>
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
          <View style={{ gap: 8 }}>
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
        {error ? <HelperText tone="danger">{error}</HelperText> : null}
        <View style={{ flexDirection: "row", gap: 8 }}>
          <AppButton
            title="保存"
            icon="checkmark"
            onPress={save}
            disabled={busy || !title || Number(priceXp) <= 0}
            style={{ flex: 1 }}
          />
          {editing ? (
            <AppButton title="取消" variant="ghost" onPress={resetForm} style={{ flex: 1 }} />
          ) : (
            <AppButton
              title="兑现管理"
              variant="secondary"
              icon="receipt-outline"
              onPress={() => router.push("/admin/redemptions")}
              style={{ flex: 1 }}
            />
          )}
        </View>
      </Card>

      <View style={{ gap: 8 }}>
        {rewards.map((reward) => (
          <Card key={reward.id} elevated={false} style={{ gap: 10, padding: 13 }}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <RewardThumb uri={publicUrl(reward.imageKey)} type={reward.type} size={52} />
              <View style={{ flex: 1, gap: 4 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <AppText variant="bodyStrong" style={{ fontSize: 14, flex: 1 }} numberOfLines={1}>
                    {reward.title}
                  </AppText>
                  <Badge
                    label={reward.status === "active" ? "上架" : "下架"}
                    tone={reward.status === "active" ? "success" : "muted"}
                  />
                </View>
                <AppText variant="small" tone="muted">
                  {reward.type === "virtual" ? "虚拟奖励" : "现实奖励"} · {reward.priceXp} XP
                </AppText>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              <AppButton title="编辑" variant="secondary" compact onPress={() => startEdit(reward)} style={{ flex: 1 }} />
              <AppButton
                title={reward.status === "active" ? "下架" : "上架"}
                variant="ghost"
                compact
                onPress={() => toggleArchived(reward)}
                disabled={busy}
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
