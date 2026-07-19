import { router } from "expo-router";
import { useCallback, useState } from "react";
import { View } from "react-native";
import {
  changeAdminChapterStatus,
  loadAdminChapters,
  moveAdminChapter,
  saveAdminChapter
} from "../../src/adventure/adventureService";
import type {
  AdminAdventureChapter,
  AdventureChapterStatus,
  AdventureRewardType
} from "../../src/adventure/types";
import { DEFAULT_ISLAND_THEME_KEYS } from "../../src/adventure/mapThemeKeys";
import type { PickedImage } from "../../src/rewards/rewardImage";
import { publicUrl, uploadImage } from "../../src/sync/uploadClient";
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

const STATUS_OPTIONS: { label: string; value: AdventureChapterStatus }[] = [
  { label: "发布", value: "published" },
  { label: "草稿", value: "draft" },
  { label: "下架", value: "archived" }
];

const REWARD_TYPE_OPTIONS: { label: string; value: AdventureRewardType }[] = [
  { label: "徽章叙事", value: "badge_story" },
  { label: "现实惊喜", value: "real_pending" }
];

function statusLabel(status: AdventureChapterStatus): string {
  if (status === "published") return "已发布";
  if (status === "draft") return "草稿";
  return "已下架";
}

export default function AdminAdventureScreen() {
  return (
    <OwnerGate>
      <AdminAdventureContent />
    </OwnerGate>
  );
}

function AdminAdventureContent() {
  const [chapters, setChapters] = useState<AdminAdventureChapter[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [storyText, setStoryText] = useState("");
  const [thresholdLifetimeXp, setThresholdLifetimeXp] = useState("50");
  const [badgeName, setBadgeName] = useState("");
  const [badgeDescription, setBadgeDescription] = useState("");
  const [badgeEmoji, setBadgeEmoji] = useState("🏅");
  const [rewardType, setRewardType] = useState<AdventureRewardType>("badge_story");
  const [status, setStatus] = useState<AdventureChapterStatus>("published");
  const [badgeImageKey, setBadgeImageKey] = useState<string | null>(null);
  const [nodeImageKey, setNodeImageKey] = useState<string | null>(null);
  const [backgroundImageKey, setBackgroundImageKey] = useState<string | null>(null);
  const [mapThemeKey, setMapThemeKey] = useState<string>("lighthouse");
  const [badgePicked, setBadgePicked] = useState<PickedImage | null>(null);
  const [nodePicked, setNodePicked] = useState<PickedImage | null>(null);
  const [backgroundPicked, setBackgroundPicked] = useState<PickedImage | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setChapters(await loadAdminChapters());
  }, []);

  const { status: syncStatus, errorMessage, reload } = useSyncScreen(load);

  function startCreate() {
    setEditingId(null);
    setTitle("");
    setSubtitle("");
    setStoryText("");
    setThresholdLifetimeXp(String((chapters[chapters.length - 1]?.thresholdLifetimeXp ?? 0) + 100));
    setBadgeName("");
    setBadgeDescription("");
    setBadgeEmoji("🏅");
    setRewardType("badge_story");
    setStatus("published");
    setBadgeImageKey(null);
    setNodeImageKey(null);
    setBackgroundImageKey(null);
    setMapThemeKey("lighthouse");
    setBadgePicked(null);
    setNodePicked(null);
    setBackgroundPicked(null);
    setMessage(null);
    setError(null);
  }

  function startEdit(chapter: AdminAdventureChapter) {
    setEditingId(chapter.id);
    setTitle(chapter.title);
    setSubtitle(chapter.subtitle ?? "");
    setStoryText(chapter.storyText);
    setThresholdLifetimeXp(String(chapter.thresholdLifetimeXp));
    setBadgeName(chapter.badgeName);
    setBadgeDescription(chapter.badgeDescription ?? "");
    setBadgeEmoji(chapter.badgeEmoji ?? "🏅");
    setRewardType(chapter.rewardType === "real_pending" ? "real_pending" : "badge_story");
    setStatus(chapter.status);
    setBadgeImageKey(chapter.badgeImageKey);
    setNodeImageKey(chapter.nodeImageKey);
    setBackgroundImageKey(chapter.backgroundImageKey);
    setMapThemeKey(chapter.mapThemeKey ?? "lighthouse");
    setBadgePicked(null);
    setNodePicked(null);
    setBackgroundPicked(null);
    setMessage(null);
    setError(null);
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    setError(null);
    try {
      const threshold = Number(thresholdLifetimeXp);
      if (!Number.isFinite(threshold) || threshold < 0) {
        throw new Error("门槛 XP 必须是非负数字");
      }
      const finalBadgeKey = badgePicked ? await uploadImage("adventure", badgePicked) : badgeImageKey;
      const finalNodeKey = nodePicked ? await uploadImage("adventure", nodePicked) : nodeImageKey;
      const finalBackgroundKey = backgroundPicked
        ? await uploadImage("adventure", backgroundPicked)
        : backgroundImageKey;
      await saveAdminChapter(
        {
          title,
          subtitle: subtitle || null,
          storyText,
          thresholdLifetimeXp: Math.trunc(threshold),
          badgeName,
          badgeDescription: badgeDescription || null,
          badgeEmoji: badgeEmoji || null,
          badgeImageKey: finalBadgeKey,
          nodeImageKey: finalNodeKey,
          backgroundImageKey: finalBackgroundKey,
          mapThemeKey: mapThemeKey || null,
          rewardType,
          status
        },
        editingId ?? undefined
      );
      setMessage(editingId ? "章节已更新" : "章节已创建");
      startCreate();
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function onMove(chapterId: string, direction: "up" | "down") {
    setBusy(true);
    setError(null);
    try {
      setChapters(await moveAdminChapter(chapters, chapterId, direction));
      setMessage("排序已更新");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "排序失败");
    } finally {
      setBusy(false);
    }
  }

  async function onStatus(chapter: AdminAdventureChapter, next: AdventureChapterStatus) {
    if (chapter.status === next) return;
    setBusy(true);
    setError(null);
    try {
      await changeAdminChapterStatus(chapter.id, next);
      setMessage(`已设为${statusLabel(next)}`);
      await reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "更新状态失败");
    } finally {
      setBusy(false);
    }
  }

  if (syncStatus !== "ready") {
    return <SyncFallback status={syncStatus} errorMessage={errorMessage} onRetry={reload} />;
  }

  const badgePreview = badgePicked ? badgePicked.uri : publicUrl(badgeImageKey);
  const nodePreview = nodePicked ? nodePicked.uri : publicUrl(nodeImageKey);
  const backgroundPreview = backgroundPicked
    ? backgroundPicked.uri
    : publicUrl(backgroundImageKey);

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <AppText variant="display">章节管理</AppText>
        <AppText variant="body" tone="muted">
          配置群岛航线、门槛与徽章 · 已解锁章不会回锁
        </AppText>
      </View>
      <AppButton
        title="章节兑现"
        variant="secondary"
        icon="checkmark-done-outline"
        onPress={() => router.push("/admin/adventure-claims")}
      />

      <Card elevated={false} style={{ gap: 12 }}>
        <AppText variant="section">{editingId ? "编辑章节" : "新建章节"}</AppText>
        <TextField label="标题" value={title} onChangeText={setTitle} placeholder="例如：启程灯塔" />
        <TextField label="副标题" value={subtitle} onChangeText={setSubtitle} placeholder="一句话" />
        <TextField label="叙事正文" value={storyText} onChangeText={setStoryText} placeholder="过关故事" multiline />
        <TextField
          label="门槛累计 XP"
          value={thresholdLifetimeXp}
          onChangeText={setThresholdLifetimeXp}
          keyboardType="number-pad"
          placeholder="50"
        />
        <TextField label="徽章名称" value={badgeName} onChangeText={setBadgeName} placeholder="启程徽章" />
        <TextField
          label="徽章描述"
          value={badgeDescription}
          onChangeText={setBadgeDescription}
          placeholder="可选"
        />
        <TextField label="徽章 Emoji" value={badgeEmoji} onChangeText={setBadgeEmoji} placeholder="🏅" />
        <ImagePickerField
          label="徽章图片"
          type="virtual"
          previewUri={badgePreview}
          onChange={(image) => {
            if (image) setBadgePicked(image);
            else {
              setBadgePicked(null);
              setBadgeImageKey(null);
            }
          }}
        />
        <View style={{ gap: 8 }}>
          <Label>默认主题岛（无自定义岛图时）</Label>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {DEFAULT_ISLAND_THEME_KEYS.map((key) => {
              const active = mapThemeKey === key;
              return (
                <AppButton
                  key={key}
                  title={key}
                  variant={active ? "primary" : "secondary"}
                  compact
                  onPress={() => setMapThemeKey(key)}
                />
              );
            })}
          </View>
        </View>
        <ImagePickerField
          label="自定义岛屿形象（可选，支持 GIF）"
          type="virtual"
          previewUri={nodePreview}
          pickerMode="adventure"
          helperText="必须透明底 PNG/WebP（不要白底 JPG）。GIF 可动。上传后优先于默认主题岛。"
          onChange={(image) => {
            if (image) setNodePicked(image);
            else {
              setNodePicked(null);
              setNodeImageKey(null);
            }
          }}
        />
        <ImagePickerField
          label="自定义岛屿背景（可选，支持 GIF）"
          type="virtual"
          previewUri={backgroundPreview}
          pickerMode="adventure"
          helperText="整屏背景可用 JPG/PNG/GIF。岛屿形象请用透明 PNG，不要白底。"
          onChange={(image) => {
            if (image) setBackgroundPicked(image);
            else {
              setBackgroundPicked(null);
              setBackgroundImageKey(null);
            }
          }}
        />
        <View style={{ gap: 8 }}>
          <Label>奖励类型</Label>
          <SegmentedControl<AdventureRewardType>
            value={rewardType}
            onChange={setRewardType}
            options={REWARD_TYPE_OPTIONS}
          />
        </View>
        <View style={{ gap: 8 }}>
          <Label>状态</Label>
          <SegmentedControl<AdventureChapterStatus>
            value={status}
            onChange={setStatus}
            options={STATUS_OPTIONS}
          />
        </View>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <AppButton title={busy ? "保存中…" : "保存"} onPress={() => void save()} disabled={busy} />
          <AppButton title="清空表单" variant="secondary" onPress={startCreate} disabled={busy} />
        </View>
        {message ? <HelperText tone="success">{message}</HelperText> : null}
        {error ? <HelperText tone="danger">{error}</HelperText> : null}
      </Card>

      <AppText variant="section">全部章节（{chapters.length}）</AppText>
      {chapters.map((chapter, index) => (
        <Card key={chapter.id} elevated={false} style={{ gap: 10, padding: 13 }}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <RewardThumb
              uri={publicUrl(chapter.badgeImageKey)}
              type={chapter.rewardType === "real_pending" ? "real_world" : "virtual"}
              size={56}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <AppText variant="bodyStrong">
                #{chapter.sortOrder} {chapter.badgeEmoji ?? ""} {chapter.title}
              </AppText>
              <AppText variant="caption" tone="muted">
                门槛 {chapter.thresholdLifetimeXp} XP · 已领 {chapter.claimCount} ·{" "}
                {chapter.rewardType === "real_pending" ? "现实惊喜" : "徽章叙事"}
              </AppText>
            </View>
            <Badge label={statusLabel(chapter.status)} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <AppButton title="编辑" compact variant="secondary" onPress={() => startEdit(chapter)} disabled={busy} />
            <AppButton
              title="上移"
              compact
              variant="ghost"
              onPress={() => void onMove(chapter.id, "up")}
              disabled={busy || index === 0}
            />
            <AppButton
              title="下移"
              compact
              variant="ghost"
              onPress={() => void onMove(chapter.id, "down")}
              disabled={busy || index === chapters.length - 1}
            />
            {chapter.status !== "published" ? (
              <AppButton title="发布" compact onPress={() => void onStatus(chapter, "published")} disabled={busy} />
            ) : null}
            {chapter.status !== "draft" ? (
              <AppButton
                title="草稿"
                compact
                variant="secondary"
                onPress={() => void onStatus(chapter, "draft")}
                disabled={busy}
              />
            ) : null}
            {chapter.status !== "archived" ? (
              <AppButton
                title="下架"
                compact
                variant="danger"
                onPress={() => void onStatus(chapter, "archived")}
                disabled={busy}
              />
            ) : null}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
