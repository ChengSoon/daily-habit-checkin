import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Share, View } from "react-native";
import { buildExportJson } from "../../src/export/exportData";
import {
  getReminderPermissionStatus,
  ReminderPermissionStatus,
  requestReminderPermission
} from "../../src/reminders/reminderService";
import { AppSettings, getAppSettings, saveAppSettings } from "../../src/settings/settingsRepository";
import { AppButton, AppText, Badge, Divider, SectionCard, SegmentedControl, SwitchRow, TextField } from "../../src/ui/Controls";
import { Screen } from "../../src/ui/Screen";
import { spacing } from "../../src/ui/theme";
import { ThemeMode, useTheme } from "../../src/ui/ThemeContext";

export default function ProfileScreen() {
  const { mode, setMode } = useTheme();
  const [settings, setSettings] = useState<AppSettings>({
    isEveningSummaryEnabled: false,
    eveningSummaryTime: "21:30",
    themeMode: "system",
    isQuietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00"
  });
  const [permission, setPermission] = useState<ReminderPermissionStatus>("undetermined");

  useFocusEffect(
    useCallback(() => {
      getAppSettings().then(setSettings);
      getReminderPermissionStatus().then(setPermission);
    }, [])
  );

  async function save(next: AppSettings) {
    setSettings(next);
    await saveAppSettings(next);
  }

  async function enablePermission() {
    const granted = await requestReminderPermission();
    setPermission(granted ? "granted" : (await getReminderPermissionStatus()));
  }

  const [exportError, setExportError] = useState<string | null>(null);

  async function exportData() {
    setExportError(null);
    try {
      const json = await buildExportJson();
      await Share.share({ title: "习惯打卡数据", message: json });
    } catch (caughtError) {
      setExportError(caughtError instanceof Error ? caughtError.message : "导出失败");
    }
  }

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <AppText variant="display">我的</AppText>
        <AppText variant="body" tone="muted">
          提醒、外观与隐私说明
        </AppText>
      </View>

      <SectionCard title="外观">
        <SegmentedControl<ThemeMode>
          value={mode}
          onChange={setMode}
          options={[
            { label: "跟随系统", value: "system" },
            { label: "浅色", value: "light" },
            { label: "深色", value: "dark" }
          ]}
        />
      </SectionCard>

      <SectionCard title="提醒设置">
        {permission === "granted" ? (
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
            <View style={{ flex: 1, gap: 2 }}>
              <AppText variant="bodyStrong">通知权限</AppText>
              <AppText variant="small" tone="muted">
                已开启，习惯和汇总提醒可以按时送达
              </AppText>
            </View>
            <Badge label="已开启" tone="success" />
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <View style={{ gap: 2 }}>
              <AppText variant="bodyStrong">开启通知权限</AppText>
              <AppText variant="small" tone="muted">
                {permission === "denied"
                  ? "通知权限已被关闭，请到系统设置中重新允许，否则提醒无法送达。"
                  : "开启后，习惯提醒和晚间汇总才能按时提醒你。"}
              </AppText>
            </View>
            {permission === "denied" ? (
              <AppButton title="前往系统设置" variant="secondary" onPress={() => Linking.openSettings()} />
            ) : (
              <AppButton title="开启提醒权限" onPress={enablePermission} />
            )}
          </View>
        )}
        <Divider />
        <SwitchRow
          label="晚间未完成汇总"
          description="每天固定时间提醒你还有哪些习惯没完成"
          value={settings.isEveningSummaryEnabled}
          onValueChange={(value) => save({ ...settings, isEveningSummaryEnabled: value })}
        />
        {settings.isEveningSummaryEnabled ? (
          <>
            <Divider />
            <TextField
              label="汇总时间"
              value={settings.eveningSummaryTime}
              onChangeText={(value) => setSettings({ ...settings, eveningSummaryTime: value })}
              onBlur={() => save(settings)}
              placeholder="21:30"
            />
            <AppText variant="small" tone="faint">
              修改后离开输入框即自动保存
            </AppText>
          </>
        ) : null}
      </SectionCard>

      <SectionCard title="免打扰时间段">
        <SwitchRow
          label="开启免打扰"
          description="这段时间内不发送任何提醒"
          value={settings.isQuietHoursEnabled}
          onValueChange={(value) => save({ ...settings, isQuietHoursEnabled: value })}
        />
        {settings.isQuietHoursEnabled ? (
          <>
            <Divider />
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="开始"
                  value={settings.quietHoursStart}
                  onChangeText={(value) => setSettings({ ...settings, quietHoursStart: value })}
                  onBlur={() => save(settings)}
                  placeholder="22:00"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="结束"
                  value={settings.quietHoursEnd}
                  onChangeText={(value) => setSettings({ ...settings, quietHoursEnd: value })}
                  onBlur={() => save(settings)}
                  placeholder="08:00"
                />
              </View>
            </View>
            <AppText variant="small" tone="faint">
              跨夜时间段有效，例如 22:00 到次日 08:00
            </AppText>
          </>
        ) : null}
      </SectionCard>

      <SectionCard title="AI 数据使用说明">
        <AppText variant="body" tone="soft">
          AI 只接收你输入的目标、基础情况、可投入时间、频率偏好和必要完成统计。
        </AppText>
        <AppText variant="body" tone="soft">
          本地完整打卡日志不会发送给 AI。AI 建议不会自动修改你的习惯设置。
        </AppText>
      </SectionCard>

      <SectionCard title="数据导出">
        <AppText variant="body" tone="soft">
          导出全部习惯、打卡记录和计划为 JSON，可保存或分享到其他应用。
        </AppText>
        {exportError ? <HelperText tone="danger">{exportError}</HelperText> : null}
        <AppButton title="导出数据" variant="secondary" onPress={exportData} />
      </SectionCard>

      <SectionCard title="隐私策略">
        <AppText variant="body" tone="soft">
          首版数据优先保存在本机，不强制登录，也不做多设备同步。
        </AppText>
      </SectionCard>
    </Screen>
  );
}
