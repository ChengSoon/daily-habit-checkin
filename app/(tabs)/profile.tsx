import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Pressable, Share, View } from "react-native";
import { buildExportJson } from "../../src/export/exportData";
import {
  getReminderPermissionStatus,
  ReminderPermissionStatus,
  requestReminderPermission
} from "../../src/reminders/reminderService";
import { AppSettings, getAppSettings, saveAppSettings } from "../../src/settings/settingsRepository";
import { getCurrentAccount } from "../../src/sync/authService";
import type { Account } from "../../src/sync/authService";
import { AppButton, AppText, Badge, Divider, HelperText, SectionCard, SegmentedControl, SwitchRow, TextField } from "../../src/ui/Controls";
import { Screen } from "../../src/ui/Screen";
import { radius, spacing, themeOptions } from "../../src/ui/theme";
import { ThemeMode, useTheme } from "../../src/ui/ThemeContext";
import { AvatarWithName, CoupleAvatars } from "../../src/ui/Avatar";
import { useCouple } from "../../src/ui/useCouple";
import { normalizeTimeInput } from "../../src/utils/time";
import { getWallet } from "../../src/xp/xpRepository";

export default function ProfileScreen() {
  const { mode, setMode, themeName, setThemeName, colors } = useTheme();
  const [settings, setSettings] = useState<AppSettings>({
    isEveningSummaryEnabled: false,
    eveningSummaryTime: "21:30",
    themeMode: "system",
    themeName: "romance",
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
  const [account, setAccount] = useState<Account | null>(null);
  const couple = useCouple();

  useFocusEffect(
    useCallback(() => {
      // profile 是登录入口本身，不能整页门禁。未登录时各请求单独降级为默认值，
      // 让「账号与同步」卡片仍能显示登录按钮。
      getAppSettings().then(setSettings).catch(() => undefined);
      getReminderPermissionStatus().then(setPermission);
      getWallet()
        .then((wallet) => {
          setXpBalance(wallet.balance);
          setLifetimeEarned(wallet.lifetimeEarned);
        })
        .catch(() => {
          setXpBalance(0);
          setLifetimeEarned(0);
        });
      getCurrentAccount()
        .then(setAccount)
        .catch(() => setAccount(null));
      couple.reload();
    }, [couple.reload])
  );

  const isOwner = account?.role === "owner";

  async function save(next: AppSettings) {
    setSettings(next);
    await saveAppSettings(next);
  }

  async function enablePermission() {
    const granted = await requestReminderPermission();
    setPermission(granted ? "granted" : (await getReminderPermissionStatus()));
  }

  const [exportError, setExportError] = useState<string | null>(null);
  const [summaryTimeError, setSummaryTimeError] = useState<string | null>(null);
  const [quietHoursError, setQuietHoursError] = useState<string | null>(null);

  function commitSummaryTime() {
    const normalized = normalizeTimeInput(settings.eveningSummaryTime);
    if (!normalized) {
      setSummaryTimeError("时间格式不正确，请用 24 小时制，例如 21:30");
      return;
    }
    setSummaryTimeError(null);
    save({ ...settings, eveningSummaryTime: normalized });
  }

  function commitQuietHours() {
    const start = normalizeTimeInput(settings.quietHoursStart);
    const end = normalizeTimeInput(settings.quietHoursEnd);
    if (!start || !end) {
      setQuietHoursError("时间格式不正确，请用 24 小时制，例如 22:00");
      return;
    }
    setQuietHoursError(null);
    save({ ...settings, quietHoursStart: start, quietHoursEnd: end });
  }

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
          账号、奖励与个性化设置
        </AppText>
      </View>

      <SectionCard title="我们的空间">
        {account ? (
          <>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.md }}>
              <View style={{ gap: spacing.xs, flex: 1 }}>
                <AppText variant="bodyStrong">{account.displayName}</AppText>
                <AppText variant="small" tone="muted">
                  {account.email}
                </AppText>
              </View>
              {couple.people.length > 0 ? (
                <CoupleAvatars
                  people={couple.people.map((person) => ({
                    name: person.name,
                    tone: person.tone,
                    imageUri: person.avatarUrl
                  }))}
                  size={40}
                />
              ) : null}
            </View>
            <AppText variant="small" tone="muted">
              {couple.partner
                ? `你和 ${couple.partner.name} 正在共享同一个空间 💞`
                : "还差另一半 —— 把邀请码发给 TA，一起打卡吧。"}
            </AppText>
            <AppButton title="管理账号" variant="secondary" icon="person-outline" onPress={() => router.push("/account")} />
          </>
        ) : (
          <>
            <AppText variant="body" tone="soft">
              登录后，你和另一半可以在两台设备共享习惯、积分和奖励。
            </AppText>
            <AppButton title="登录 / 注册" icon="log-in-outline" onPress={() => router.push("/account")} />
          </>
        )}
      </SectionCard>

      <SectionCard title="奖励">
        <View style={{ gap: spacing.xs }}>
          <AppText variant="caption" tone="primary">
            当前积分
          </AppText>
          <AppText variant="title" tone="primary">
            {xpBalance} 积分
          </AppText>
          <AppText variant="small" tone="muted">
            累计获得 {lifetimeEarned} 积分
          </AppText>
        </View>
        <Divider />
        <AppButton title="打开奖励商城" icon="gift-outline" onPress={() => router.push("/shop")} />
        <AppButton
          title="查看兑换记录"
          variant="secondary"
          icon="receipt-outline"
          onPress={() => router.push("/shop/redemptions")}
        />
        {isOwner ? (
          <AppButton
            title="奖励管理"
            variant="secondary"
            icon="construct-outline"
            onPress={() => router.push("/admin/rewards")}
          />
        ) : null}
      </SectionCard>

      <SectionCard title="外观">
        <View style={{ gap: spacing.sm }}>
          <AppText variant="small" tone="soft" style={{ fontWeight: "600" }}>
            主题配色
          </AppText>
          <View style={{ gap: spacing.sm }}>
            {themeOptions.map((option) => {
              const active = option.name === themeName;
              return (
                <Pressable
                  key={option.name}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setThemeName(option.name)}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: spacing.md,
                      borderRadius: radius.md,
                      borderWidth: active ? 2 : 1,
                      borderColor: active ? colors.primary : colors.line,
                      backgroundColor: active ? colors.surfaceTint : colors.surface,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.md
                    },
                    pressed ? { opacity: 0.85 } : null
                  ]}
                >
                  <View style={{ flexDirection: "row" }}>
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: radius.pill,
                        backgroundColor: option.swatch[0],
                        borderWidth: 2,
                        borderColor: colors.surface
                      }}
                    />
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: radius.pill,
                        backgroundColor: option.swatch[1],
                        borderWidth: 2,
                        borderColor: colors.surface,
                        marginLeft: -8
                      }}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="bodyStrong">{option.label}</AppText>
                    <AppText variant="small" tone="muted">
                      {option.description}
                    </AppText>
                  </View>
                  {active ? <Ionicons name="checkmark-circle" size={22} color={colors.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
        <Divider />
        <View style={{ gap: spacing.sm }}>
          <AppText variant="small" tone="soft" style={{ fontWeight: "600" }}>
            明暗模式
          </AppText>
          <SegmentedControl<ThemeMode>
            value={mode}
            onChange={setMode}
            options={[
              { label: "跟随系统", value: "system" },
              { label: "浅色", value: "light" },
              { label: "深色", value: "dark" }
            ]}
          />
        </View>
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
              onBlur={commitSummaryTime}
              placeholder="21:30"
            />
            {summaryTimeError ? <HelperText tone="danger">{summaryTimeError}</HelperText> : null}
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
                  onBlur={commitQuietHours}
                  placeholder="22:00"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="结束"
                  value={settings.quietHoursEnd}
                  onChangeText={(value) => setSettings({ ...settings, quietHoursEnd: value })}
                  onBlur={commitQuietHours}
                  placeholder="08:00"
                />
              </View>
            </View>
            {quietHoursError ? <HelperText tone="danger">{quietHoursError}</HelperText> : null}
            <AppText variant="small" tone="faint">
              跨夜时间段有效，例如 22:00 到次日 08:00
            </AppText>
          </>
        ) : null}
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
          secureTextEntry
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

      <SectionCard title="数据导出">
        <AppText variant="body" tone="soft">
          导出全部习惯、打卡记录和计划为 JSON，可保存或分享到其他应用。
        </AppText>
        {exportError ? <HelperText tone="danger">{exportError}</HelperText> : null}
        <AppButton title="导出数据" variant="secondary" onPress={exportData} />
      </SectionCard>
    </Screen>
  );
}
