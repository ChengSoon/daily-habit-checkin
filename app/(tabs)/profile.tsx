import { router } from "expo-router";
import { View } from "react-native";
import { AppButton, AppText } from "../../src/ui/Controls";
import { AndroidReminderGuideModal } from "../../src/ui/AndroidReminderGuideModal";
import { Screen } from "../../src/ui/Screen";
import { ProfileMorePanel } from "../../src/ui/profile/ProfileMorePanel";
import { ProfileOverview } from "../../src/ui/profile/ProfileOverview";
import { ProfileReminderPanel, ProfileThemePanel } from "../../src/ui/profile/ProfileSettingsPanels";
import { useProfileController, type ProfileController } from "../../src/ui/profile/useProfileController";

function SignedOut({ colors }: Pick<ProfileController, "colors">) {
  return <View style={{ borderRadius: 22, backgroundColor: colors.partnerSurface, borderWidth: 1,
    borderColor: colors.line, padding: 16, gap: 12 }}>
    <AppText variant="display">我的</AppText>
    <AppText variant="body" tone="muted">登录后，和另一半一起经营共同小岛。</AppText>
    <AppButton title="登录 / 注册" icon="log-in-outline" onPress={() => router.push("/account")} />
  </View>;
}

function ProfilePanels({ view }: { view: ProfileController }) {
  if (view.settingsPanel === "theme") {
    return <ProfileThemePanel mode={view.mode} themeName={view.themeName}
      onModeChange={view.setMode} onThemeChange={view.setThemeName} />;
  }
  if (view.settingsPanel !== "reminders") return null;
  return <ProfileReminderPanel
    settings={view.settings}
    permission={view.permission}
    testMessage={view.testReminderMessage}
    onSave={(next) => void view.save(next, true)}
    onEnablePermission={() => void view.enablePermission()}
    onRunTest={() => void view.runTestReminder()}
    onShowAndroidGuide={() => view.setAndroidGuideVisible(true)}
  />;
}

function AuthenticatedProfile({ view }: { view: ProfileController }) {
  return <>
    <ProfileOverview island={view.island} people={view.people} hasPartner={view.couple.partner !== null}
      themeName={view.themeName} xpBalance={view.xpBalance} lifetimeEarned={view.lifetimeEarned}
      streakDays={view.streakDays} badgeCount={view.badgeCount} settings={view.settings}
      panel={view.settingsPanel} onPanelChange={view.setSettingsPanel}
      onShowReminderGuide={() => view.setAndroidGuideVisible(true)}
      onExport={() => void view.exportData()} exportError={view.exportError} />
    <ProfilePanels view={view} />
    <ProfileMorePanel expanded={view.settingsPanel === "more"} currentVersion={view.currentAppVersion}
      updateResult={view.updateResult} isChecking={view.isCheckingUpdate} updateError={view.updateError}
      isOwner={view.account?.role === "owner"} settings={view.settings}
      onToggle={() => view.setSettingsPanel(view.settingsPanel === "more" ? null : "more")}
      onCheck={() => void view.checkUpdates()} onDownload={() => void view.downloadUpdate()}
      onSettingsChange={view.setSettings} onSettingsSave={() => void view.save(view.settings)} />
  </>;
}

export default function ProfileScreen() {
  const view = useProfileController();
  return (
    <Screen>
      {view.account ? <AuthenticatedProfile view={view} /> : <SignedOut colors={view.colors} />}
      <AndroidReminderGuideModal
        visible={view.androidGuideVisible}
        onClose={() => view.setAndroidGuideVisible(false)}
        onPermissionChanged={(granted) => view.setPermission(granted ? "granted" : "denied")}
      />
    </Screen>
  );
}
