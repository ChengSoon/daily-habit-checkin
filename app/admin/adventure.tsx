import { router } from "expo-router";
import { View } from "react-native";
import { AdminAdventureForm } from "../../src/adventure/AdminAdventureForm";
import { AdminAdventureList } from "../../src/adventure/AdminAdventureList";
import { useAdminAdventureController, type AdminAdventureController } from "../../src/adventure/useAdminAdventureController";
import { AppButton, AppText } from "../../src/ui/Controls";
import { OwnerGate } from "../../src/ui/OwnerGate";
import { Screen } from "../../src/ui/Screen";
import { SyncFallback } from "../../src/ui/SyncScreen";

export default function AdminAdventureScreen() {
  return (
    <OwnerGate>
      <AdminAdventureContent />
    </OwnerGate>
  );
}

function AdminAdventureContent() {
  const view = useAdminAdventureController();
  if (view.sync.status !== "ready") {
    return <SyncFallback status={view.sync.status} errorMessage={view.sync.errorMessage} onRetry={view.sync.reload} />;
  }
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

      <AdventureEditor view={view} />
      <AdminAdventureList
        chapters={view.chapters}
        busy={view.busy}
        onEdit={view.edit}
        onMove={(id, direction) => void view.move(id, direction)}
        onStatus={(chapter, next) => void view.changeStatus(chapter, next)}
      />
    </Screen>
  );
}

function AdventureEditor({ view }: { view: AdminAdventureController }) {
  const form = view.form;
  return <AdminAdventureForm
        editing={form.editingId !== null}
        values={{
          title: form.title, subtitle: form.subtitle, storyText: form.storyText,
          thresholdLifetimeXp: form.thresholdLifetimeXp, badgeName: form.badgeName,
          badgeDescription: form.badgeDescription, badgeEmoji: form.badgeEmoji,
          mapThemeKey: form.mapThemeKey, rewardType: form.rewardType, status: form.status
        }}
        changes={{
          title: view.change("title"), subtitle: view.change("subtitle"), storyText: view.change("storyText"),
          thresholdLifetimeXp: view.change("thresholdLifetimeXp"), badgeName: view.change("badgeName"),
          badgeDescription: view.change("badgeDescription"), badgeEmoji: view.change("badgeEmoji"),
          mapThemeKey: view.change("mapThemeKey"), rewardType: view.change("rewardType"), status: view.change("status")
        }}
        previews={view.previews}
        onBadgeChange={view.changeImage("badgePicked", "badgeImageKey")}
        onNodeChange={view.changeImage("nodePicked", "nodeImageKey")}
        onBackgroundChange={view.changeImage("backgroundPicked", "backgroundImageKey")}
        busy={view.busy}
        message={view.message}
        error={view.error}
        onSave={() => void view.save()}
        onReset={view.reset}
      />;
}
