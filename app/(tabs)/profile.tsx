import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Pressable, Share, View } from "react-native";
import { hasAdminPin, setAdminPin, verifyAdminPin } from "../../src/admin/adminSettingsRepository";
import { buildExportJson } from "../../src/export/exportData";
import {
  getReminderPermissionStatus,
  ReminderPermissionStatus,
  requestReminderPermission
} from "../../src/reminders/reminderService";
import { AppSettings, getAppSettings, saveAppSettings } from "../../src/settings/settingsRepository";
import { AppButton, AppText, Badge, Divider, HelperText, SectionCard, SegmentedControl, SwitchRow, TextField } from "../../src/ui/Controls";
import { Screen } from "../../src/ui/Screen";
import { spacing } from "../../src/ui/theme";
import { ThemeMode, useTheme } from "../../src/ui/ThemeContext";
import { getWallet } from "../../src/xp/xpRepository";

export default function ProfileScreen() {
  const { mode, setMode } = useTheme();
  const [settings, setSettings] = useState<AppSettings>({
    isEveningSummaryEnabled: false,
    eveningSummaryTime: "21:30",
    themeMode: "system",
    isQuietHoursEnabled: false,
    quietHoursStart: "22:00",
    quietHoursEnd: "08:00",
    aiBaseUrl: "",
    aiApiKey: "",
    aiModel: ""
  });
  const [permission, setPermission] = useState<ReminderPermissionStatus>("undetermined");
  const [xpBalance, setXpBalance] = useState(0);
  const [lifetimeEarned, setLifetimeEarned] = useState(0);
  const [adminTapCount, setAdminTapCount] = useState(0);
  const [showAdminEntry, setShowAdminEntry] = useState(false);
  const [adminPin, setAdminPinInput] = useState("");
  const [adminMessage, setAdminMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      getAppSettings().then(setSettings);
      getReminderPermissionStatus().then(setPermission);
      getWallet().then((wallet) => {
        setXpBalance(wallet.balance);
        setLifetimeEarned(wallet.lifetimeEarned);
      });
    }, [])
  );

  function revealAdminEntry() {
    const next = adminTapCount + 1;
    setAdminTapCount(next);
    if (next >= 5) {
      setShowAdminEntry(true);
    }
  }

  async function enterAdminMode() {
    const exists = await hasAdminPin();

    if (!exists) {
      await setAdminPin(adminPin);
      setAdminMessage("管理 PIN 已设置");
      router.push("/admin/rewards");
      return;
    }

    const ok = await verifyAdminPin(adminPin);
    if (!ok) {
      setAdminMessage("管理 PIN 不正确");
      return;
    }

    router.push("/admin/rewards");
  }

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

      <SectionCard title="奖励">
        <Pressable onPress={revealAdminEntry} style={{ gap: spacing.xs }}>
          <AppText variant="caption" tone="primary">
            当前积分
          </AppText>
          <AppText variant="title" tone="primary">
            {xpBalance} 积分
          </AppText>
          <AppText variant="small" tone="muted">
            累计获得 {lifetimeEarned} 积分
          </AppText>
        </Pressable>
        <Divider />
        <AppButton title="打开奖励商城" icon="gift-outline" onPress={() => router.push("/shop")} />
        <AppButton
          title="查看兑换记录"
          variant="secondary"
          icon="receipt-outline"
          onPress={() => router.push("/shop/redemptions")}
        />
        {showAdminEntry ? (
          <>
            <Divider />
            <TextField
              label="管理 PIN"
              value={adminPin}
              onChangeText={setAdminPinInput}
              keyboardType="number-pad"
              placeholder="输入或设置 PIN"
            />
            {adminMessage ? (
              <HelperText tone={adminMessage.includes("不正确") ? "danger" : "success"}>{adminMessage}</HelperText>
            ) : null}
            <AppButton
              title="进入奖励管理"
              variant="secondary"
              onPress={enterAdminMode}
              disabled={adminPin.length < 4}
            />
          </>
        ) : null}
      </SectionCard>

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

      <SectionCard title="AI 服务配置">
        <AppText variant="body" tone="soft">
          填写你自己的 AI 服务地址、访问密钥和模型名。留空则使用默认配置。
        </AppText>
        <TextField
          label="服务地址"
          value={settings.aiBaseUrl}
          onChangeText={(value) => setSettings({ ...settings, aiBaseUrl: value })}
          onBlur={() => save(settings)}
          placeholder="https://your-server.com"
          keyboardType="url"
        />
        <TextField
          label="访问密钥"
          value={settings.aiApiKey}
          onChangeText={(value) => setSettings({ ...settings, aiApiKey: value })}
          onBlur={() => save(settings)}
          placeholder="x-api-key（可留空）"
        />
        <TextField
          label="模型名"
          value={settings.aiModel}
          onChangeText={(value) => setSettings({ ...settings, aiModel: value })}
          onBlur={() => save(settings)}
          placeholder="例如：gpt-5.5"
        />
        <AppText variant="small" tone="faint">
          修改后离开输入框即自动保存
        </AppText>
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

      <SectionCard title="数据导出">
        <AppText variant="body" tone="soft">
          导出全部习惯、打卡记录和计划为 JSON，可保存或分享到其他应用。
        </AppText>
        {exportError ? <HelperText tone="danger">{exportError}</HelperText> : null}
        <AppButton title="导出数据" variant="secondary" onPress={exportData} />
      </SectionCard>

      <SectionCard title="AI 数据使用说明">
        <AppText variant="body" tone="soft">
          制定计划时，AI 只接收你填写的目标、当前基础、可投入时间、频率与提醒偏好，以及必要的完成情况统计。
        </AppText>
        <AppText variant="body" tone="soft">
          完整的打卡日志不会发送给 AI。AI 只提供建议，不会自动修改你的习惯，所有调整都需要你确认后才会生效。
        </AppText>
      </SectionCard>

      <SectionCard title="隐私策略">
        <AppText variant="body" tone="soft">
          首版数据优先保存在本机，不强制登录，也不做多设备同步。
        </AppText>
      </SectionCard>
    </Screen>
  );
}
