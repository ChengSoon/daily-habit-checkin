import { View } from "react-native";
import type { AdminAdventureChapter, AdventureChapterStatus } from "./types";
import { publicUrl } from "../sync/uploadClient";
import { AppButton, AppText, Badge, Card } from "../ui/Controls";
import { RewardThumb } from "../ui/RewardImage";

export function statusLabel(status: AdventureChapterStatus): string {
  if (status === "published") return "已发布";
  if (status === "draft") return "草稿";
  return "已下架";
}

export function AdminAdventureList({ chapters, busy, onEdit, onMove, onStatus }: {
  chapters: AdminAdventureChapter[];
  busy: boolean;
  onEdit: (chapter: AdminAdventureChapter) => void;
  onMove: (chapterId: string, direction: "up" | "down") => void;
  onStatus: (chapter: AdminAdventureChapter, status: AdventureChapterStatus) => void;
}) {
  return (
    <>
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
              <AppText variant="bodyStrong">#{chapter.sortOrder} {chapter.badgeEmoji ?? ""} {chapter.title}</AppText>
              <AppText variant="caption" tone="muted">
                门槛 {chapter.thresholdLifetimeXp} XP · 已领 {chapter.claimCount} · {chapter.rewardType === "real_pending" ? "现实惊喜" : "徽章叙事"}
              </AppText>
            </View>
            <Badge label={statusLabel(chapter.status)} />
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <AppButton title="编辑" compact variant="secondary" onPress={() => onEdit(chapter)} disabled={busy} />
            <AppButton title="上移" compact variant="ghost" onPress={() => onMove(chapter.id, "up")} disabled={busy || index === 0} />
            <AppButton title="下移" compact variant="ghost" onPress={() => onMove(chapter.id, "down")} disabled={busy || index === chapters.length - 1} />
            {chapter.status !== "published" ? (
              <AppButton title="发布" compact onPress={() => onStatus(chapter, "published")} disabled={busy} />
            ) : null}
            {chapter.status !== "draft" ? (
              <AppButton title="草稿" compact variant="secondary" onPress={() => onStatus(chapter, "draft")} disabled={busy} />
            ) : null}
            {chapter.status !== "archived" ? (
              <AppButton title="下架" compact variant="danger" onPress={() => onStatus(chapter, "archived")} disabled={busy} />
            ) : null}
          </View>
        </Card>
      ))}
    </>
  );
}
