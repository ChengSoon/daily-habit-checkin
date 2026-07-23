import { router } from "expo-router";
import { Platform, View } from "react-native";
import type { CurrentIsland } from "../../adventure/currentIsland";
import { hasCompletedAndroidReminderGuide } from "../../reminders/androidReminderGuide";
import type { AppSettings } from "../../settings/settingsRepository";
import type { CouplePerson } from "../Avatar";
import { AppText, Card, Divider, HelperText, ListRow, StatTile } from "../Controls";
import { IslandHero } from "../IslandHero";
import { themeOptions, type ThemeName } from "../theme";
import { useTheme } from "../ThemeContext";

export type ProfilePanel = null | "theme" | "reminders" | "more";

export type ProfileOverviewProps = {
  island: CurrentIsland | null;
  people: CouplePerson[];
  hasPartner: boolean;
  themeName: ThemeName;
  xpBalance: number;
  lifetimeEarned: number;
  streakDays: number;
  badgeCount: number;
  settings: AppSettings;
  panel: ProfilePanel;
  onPanelChange: (panel: ProfilePanel) => void;
  onShowReminderGuide: () => void;
  onExport: () => void;
  exportError: string | null;
};

function ProfileStats({ streakDays, badgeCount }: Pick<ProfileOverviewProps, "streakDays" | "badgeCount">) {
  const { colors } = useTheme();
  return <View style={{ flexDirection: "row", gap: 9 }}>
    <StatTile label="连续打卡" value={String(streakDays)} tint={colors.candySunSurface}
      labelColor={colors.candySunInk} valueColor={colors.candySunInk} />
    <StatTile label="徽章" value={String(badgeCount)} tint={colors.successSurface}
      labelColor={colors.candyMintInk} valueColor={colors.candyMintInk} />
  </View>;
}

function ThemeSwatches() {
  return <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
    {themeOptions.map((option) => (
      <View key={option.name} style={{ width: 14, height: 14, borderRadius: 999, backgroundColor: option.swatch[0] }} />
    ))}
  </View>;
}

function ProfileMenu(props: Pick<ProfileOverviewProps,
  "settings" | "panel" | "onPanelChange" | "onShowReminderGuide" | "onExport" | "exportError">) {
  const { settings, panel, onPanelChange, onShowReminderGuide, onExport, exportError } = props;
  const { colors } = useTheme();
  const openReminders = () => {
    const next = panel === "reminders" ? null : "reminders";
    onPanelChange(next);
    if (next === "reminders" && Platform.OS === "android") {
      void hasCompletedAndroidReminderGuide()
        .then((done) => {
          if (!done) onShowReminderGuide();
        })
        .catch(() => undefined);
    }
  };
  return <Card elevated={false} style={{ paddingVertical: 2, paddingHorizontal: 13, gap: 0 }}>
    <ListRow icon="cloud-outline" iconBg={colors.surfaceTint} iconColor={colors.primaryInk} onPress={() => router.push("/account")}>
      <AppText variant="bodyStrong" style={{ fontSize: 15 }}>账号与同步</AppText>
      <AppText variant="small" tone="muted">云端空间 · 实时推送</AppText>
    </ListRow>
    <Divider />
    <ListRow icon="color-palette-outline" iconBg={colors.partnerSurface} iconColor={colors.partnerInk}
      onPress={() => onPanelChange(panel === "theme" ? null : "theme")} right={<ThemeSwatches />}>
      <AppText variant="bodyStrong" style={{ fontSize: 15 }}>主题外观</AppText>
      <AppText variant="small" tone="muted">粉紫 / 薄荷 / 暖阳</AppText>
    </ListRow>
    <Divider />
    <ListRow icon="notifications-outline" iconBg={colors.candySkySurface} iconColor={colors.candySkyInk} onPress={openReminders}>
      <AppText variant="bodyStrong" style={{ fontSize: 15 }}>提醒与免打扰</AppText>
      <AppText variant="small" tone="muted">
        {settings.isEveningSummaryEnabled ? `晚间小结 ${settings.eveningSummaryTime}` : "晚间小结未开启"}
      </AppText>
    </ListRow>
    <Divider />
    <ListRow icon="paw-outline" iconBg={colors.successSurface} iconColor={colors.candyMintInk} onPress={() => router.push("/companion-settings")}>
      <AppText variant="bodyStrong" style={{ fontSize: 15 }}>卡卡陪伴</AppText>
      <AppText variant="small" tone="muted">主动关心 · 共同记忆</AppText>
    </ListRow>
    <Divider />
    <ListRow icon="download-outline" iconBg={colors.candyOrangeSurface} iconColor={colors.candyOrangeInk} onPress={onExport}>
      <AppText variant="bodyStrong" style={{ fontSize: 15 }}>导出数据</AppText>
      <AppText variant="small" tone="muted">JSON 备份</AppText>
    </ListRow>
    {exportError ? <><Divider /><HelperText tone="danger">{exportError}</HelperText></> : null}
  </Card>;
}

export function ProfileOverview(props: ProfileOverviewProps) {
  const { island, people, hasPartner, themeName, xpBalance, lifetimeEarned } = props;
  return (
    <>
      <IslandHero
        variant="profile"
        islandKey={island?.key}
        islandImageKey={island?.nodeImageKey}
        islandName={island?.name ?? "我们的小岛"}
        eyebrow=""
        title={`我们的空间 · ${island?.name ?? "小岛"}`}
        detail={hasPartner
          ? `${themeOptions.find((option) => option.name === themeName)?.label ?? "恋恋粉紫"}主题 · 已同步`
          : "还差另一半 · 把邀请码发给 TA"}
        people={people}
        xpBalance={xpBalance}
        lifetimeEarned={lifetimeEarned}
      />
      <ProfileStats streakDays={props.streakDays} badgeCount={props.badgeCount} />
      <ProfileMenu {...props} />
    </>
  );
}
