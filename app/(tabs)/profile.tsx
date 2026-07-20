import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Linking, Platform, Pressable, Share, View } from "react-native";
import { loadAdventureState } from "../../src/adventure/adventureService";
import { listCheckInsForHabit } from "../../src/checkins/checkinRepository";
import { calculateCurrentStreak } from "../../src/checkins/stats";
import { listActiveHabits } from "../../src/habits/habitRepository";
import { shouldRunOnDate } from "../../src/habits/habitRules";
import { eachDateKey, todayKey } from "../../src/utils/date";
import { selectCurrentIsland, type CurrentIsland } from "../../src/adventure/currentIsland";
import { buildExportJson } from "../../src/export/exportData";
import { hasCompletedAndroidReminderGuide } from "../../src/reminders/androidReminderGuide";
import { registerDevicePushToken, requestServerPushTest } from "../../src/reminders/pushTokenService";
import {
  getReminderPermissionStatus,
  refreshScheduledReminders,
  ReminderPermissionStatus,
  requestReminderPermission,
  scheduleTestSystemReminder
} from "../../src/reminders/reminderService";
import { AndroidReminderGuideModal } from "../../src/ui/AndroidReminderGuideModal";
import { AppSettings, getAppSettings, saveAppSettings } from "../../src/settings/settingsRepository";
import { getCurrentAccount } from "../../src/sync/authService";
import type { Account } from "../../src/sync/authService";
import { getCurrentAppVersion } from "../../src/updates/appVersion";
import { AppUpdateCheckResult, checkForAppUpdate } from "../../src/updates/updateClient";
import { AnimatedReveal } from "../../src/ui/AnimatedReveal";
import { AppButton, AppText, Badge, Card, Divider, HelperText, ListRow, SectionCard, SegmentedControl, StatTile, SwitchRow, TextField } from "../../src/ui/Controls";
import { IslandHero } from "../../src/ui/IslandHero";
import { Screen } from "../../src/ui/Screen";
import { themeOptions } from "../../src/ui/theme";
import { ThemeMode, useTheme } from "../../src/ui/ThemeContext";
import { TimePickerField } from "../../src/ui/TimeWheelPicker";
import { useCouple } from "../../src/ui/useCouple";
import { getWallet } from "../../src/xp/xpRepository";


function formatVersion(version: string, buildNumber?: number | null): string {
  return buildNumber ? `${version} (${buildNumber})` : version;
}


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
  const [testReminderMessage, setTestReminderMessage] = useState<string | null>(null);
  const [androidGuideVisible, setAndroidGuideVisible] = useState(false);
  const [xpBalance, setXpBalance] = useState(0);
  const [lifetimeEarned, setLifetimeEarned] = useState(0);
  const [account, setAccount] = useState<Account | null>(null);
  const [currentAppVersion] = useState(() => getCurrentAppVersion());
  const [updateResult, setUpdateResult] = useState<AppUpdateCheckResult | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [island, setIsland] = useState<CurrentIsland | null>(null);
  const [badgeCount, setBadgeCount] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const couple = useCouple();
  const [settingsPanel, setSettingsPanel] = useState<null | "theme" | "reminders" | "more">(null);
  const reloadCouple = couple.reload;

  const checkUpdates = useCallback(async () => {
    setIsCheckingUpdate(true);
    setUpdateError(null);
    try {
      setUpdateResult(await checkForAppUpdate(currentAppVersion));
    } catch (caughtError) {
      setUpdateError(caughtError instanceof Error ? caughtError.message : "更新检查失败");
    } finally {
      setIsCheckingUpdate(false);
    }
  }, [currentAppVersion]);

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
      // 连续打卡：取活跃习惯中最大连续天数（展示用）
      void (async () => {
        try {
          const today = todayKey();
          const habits = await listActiveHabits();
          let maxStreak = 0;
          for (const habit of habits) {
            const habitStart = habit.createdAt.slice(0, 10);
            const scheduled = eachDateKey(habitStart, today).filter((date) =>
              shouldRunOnDate(habit.frequency, new Date(`${date}T00:00:00`))
            );
            const checks = await listCheckInsForHabit(habit.id);
            maxStreak = Math.max(
              maxStreak,
              calculateCurrentStreak({ today, scheduledDates: scheduled, checkIns: checks })
            );
          }
          setStreakDays(maxStreak);
        } catch {
          setStreakDays(0);
        }
      })();
      getCurrentAccount()
        .then(setAccount)
        .catch(() => setAccount(null));
      loadAdventureState()
        .then((adventure) => {
          setIsland(selectCurrentIsland(adventure));
          setBadgeCount(adventure.chapters.filter((c) => c.viewStatus === "claimed").length);
        })
        .catch(() => {
          setIsland(null);
          setBadgeCount(0);
        });
      reloadCouple();
      void checkUpdates();
    }, [checkUpdates, reloadCouple])
  );

  const isOwner = account?.role === "owner";

  async function save(next: AppSettings, shouldRefreshReminders = false) {
    setSettings(next);
    await saveAppSettings(next);
    if (shouldRefreshReminders) {
      await refreshScheduledReminders();
    }
  }

  async function enablePermission() {
    try {
      const granted = await requestReminderPermission();
      setPermission(granted ? "granted" : (await getReminderPermissionStatus()));
      if (granted) {
        await refreshScheduledReminders();
        if (Platform.OS === "android") {
          setAndroidGuideVisible(true);
        }
      }
    } catch {
      setPermission(await getReminderPermissionStatus().catch((): ReminderPermissionStatus => "undetermined"));
    }
  }

  async function runTestReminder() {
    setTestReminderMessage(null);
    try {
      const id = await scheduleTestSystemReminder(8);
      if (!id) {
        setTestReminderMessage("无法调度测试通知，请先开启通知权限。");
        return;
      }
      setTestReminderMessage("已安排 8 秒后测试。请立刻按 Home 退到桌面等待横幅。");
    } catch (error) {
      setTestReminderMessage(error instanceof Error ? error.message : "测试通知失败");
    }
  }

  async function runServerPushTest() {
    setTestReminderMessage(null);
    try {
      await registerDevicePushToken();
      const result = await requestServerPushTest();
      if (!result.ok) {
        setTestReminderMessage(result.error ?? "服务端推送失败");
        return;
      }
      setTestReminderMessage(
        `服务端个推已发送（成功 ${result.successCount ?? 0} / 失败 ${result.failureCount ?? 0}）。请退到桌面查看。`
      );
    } catch (error) {
      setTestReminderMessage(error instanceof Error ? error.message : "服务端推送失败");
    }
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

  async function downloadUpdate() {
    if (updateResult?.status !== "available") {
      return;
    }
    setUpdateError(null);
    try {
      await Linking.openURL(updateResult.update.downloadUrl);
    } catch (caughtError) {
      setUpdateError(caughtError instanceof Error ? caughtError.message : "无法打开下载链接");
    }
  }

  const availableUpdate = updateResult?.status === "available" ? updateResult.update : null;
  const currentVersionText = formatVersion(currentAppVersion.version, currentAppVersion.buildNumber);

  return (
    <Screen>
      {account ? (
        <>
          <IslandHero
            variant="profile"
            islandKey={island?.key}
            islandImageKey={island?.nodeImageKey}
            islandName={island?.name ?? "我们的小岛"}
            eyebrow=""
            title={`我们的空间 · ${island?.name ?? "小岛"}`}
            detail={
              couple.partner
                ? `${themeOptions.find((o) => o.name === themeName)?.label ?? "恋恋粉紫"}主题 · 已同步`
                : "还差另一半 · 把邀请码发给 TA"
            }
            people={couple.people.map((person) => ({
              name: person.name,
              tone: person.tone,
              imageUri: person.avatarUrl
            }))}
            xpBalance={xpBalance}
            lifetimeEarned={lifetimeEarned}
          />
          {/* board profile XP pills are on IslandHero; 累计用 partner pill 风格补充 */}
          <View style={{ flexDirection: "row", gap: 9 }}>
            <StatTile
              label="连续打卡"
              value={String(streakDays)}
              tint={colors.candySunSurface}
              labelColor={colors.candySunInk}
              valueColor={colors.candySunInk}
            />
            <StatTile
              label="徽章"
              value={String(badgeCount)}
              tint={colors.successSurface}
              labelColor={colors.candyMintInk}
              valueColor={colors.candyMintInk}
            />
          </View>

          <Card elevated={false} style={{ paddingVertical: 2, paddingHorizontal: 13, gap: 0 }}>
            <ListRow
              icon="cloud-outline"
              iconBg={colors.surfaceTint}
              iconColor={colors.primaryInk}
              onPress={() => router.push("/account")}
            >
              <AppText variant="bodyStrong" style={{ fontSize: 15 }}>
                账号与同步
              </AppText>
              <AppText variant="small" tone="muted">
                云端空间 · 实时推送
              </AppText>
            </ListRow>
            <Divider />
            <ListRow
              icon="color-palette-outline"
              iconBg={colors.partnerSurface}
              iconColor={colors.partnerInk}
              onPress={() => setSettingsPanel(settingsPanel === "theme" ? null : "theme")}
              right={
                <View style={{ flexDirection: "row", gap: 4, alignItems: "center" }}>
                  {themeOptions.map((option) => (
                    <View
                      key={option.name}
                      style={{ width: 14, height: 14, borderRadius: 999, backgroundColor: option.swatch[0] }}
                    />
                  ))}
                </View>
              }
            >
              <AppText variant="bodyStrong" style={{ fontSize: 15 }}>
                主题外观
              </AppText>
              <AppText variant="small" tone="muted">
                粉紫 / 薄荷 / 暖阳
              </AppText>
            </ListRow>
            <Divider />
            <ListRow
              icon="notifications-outline"
              iconBg={colors.candySkySurface}
              iconColor={colors.candySkyInk}
              onPress={() => {
                const next = settingsPanel === "reminders" ? null : "reminders";
                setSettingsPanel(next);
                if (next === "reminders" && Platform.OS === "android") {
                  void hasCompletedAndroidReminderGuide()
                    .then((done) => {
                      if (!done) {
                        setAndroidGuideVisible(true);
                      }
                    })
                    .catch(() => undefined);
                }
              }}
            >
              <AppText variant="bodyStrong" style={{ fontSize: 15 }}>
                提醒与免打扰
              </AppText>
              <AppText variant="small" tone="muted">
                {settings.isEveningSummaryEnabled ? `晚间小结 ${settings.eveningSummaryTime}` : "晚间小结未开启"}
              </AppText>
            </ListRow>
            <Divider />
            <ListRow
              icon="paw-outline"
              iconBg={colors.successSurface}
              iconColor={colors.candyMintInk}
              onPress={() => router.push("/companion-settings")}
            >
              <AppText variant="bodyStrong" style={{ fontSize: 15 }}>
                卡卡陪伴
              </AppText>
              <AppText variant="small" tone="muted">
                主动关心 · 共同记忆
              </AppText>
            </ListRow>
            <Divider />
            <ListRow
              icon="download-outline"
              iconBg={colors.candyOrangeSurface}
              iconColor={colors.candyOrangeInk}
              onPress={() => void exportData()}
            >
              <AppText variant="bodyStrong" style={{ fontSize: 15 }}>
                导出数据
              </AppText>
              <AppText variant="small" tone="muted">
                JSON 备份
              </AppText>
            </ListRow>
            {exportError ? (
              <>
                <Divider />
                <HelperText tone="danger">{exportError}</HelperText>
              </>
            ) : null}
          </Card>

          {settingsPanel === "theme" ? (
            <AnimatedReveal>
            <SectionCard title="主题外观">
              <View style={{ gap: 8 }}>
                {themeOptions.map((option) => {
                  const active = option.name === themeName;
                  return (
                    <Pressable
                      key={option.name}
                      onPress={() => setThemeName(option.name)}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 11,
                        borderRadius: 14,
                        borderWidth: active ? 2 : 1,
                        borderColor: active ? colors.primary : colors.line,
                        backgroundColor: active ? colors.surfaceTint : colors.surface,
                        paddingHorizontal: 12,
                        paddingVertical: 10
                      }}
                    >
                      <View style={{ flexDirection: "row" }}>
                        <View style={{ width: 18, height: 18, borderRadius: 999, backgroundColor: option.swatch[0], borderWidth: 2, borderColor: colors.surface }} />
                        <View style={{ width: 18, height: 18, borderRadius: 999, backgroundColor: option.swatch[1], borderWidth: 2, borderColor: colors.surface, marginLeft: -6 }} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <AppText variant="bodyStrong" style={{ fontSize: 15 }}>
                          {option.label}
                        </AppText>
                        <AppText variant="small" tone="muted">
                          {option.description}
                        </AppText>
                      </View>
                      {active ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
                    </Pressable>
                  );
                })}
              </View>
              <Divider />
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
            </AnimatedReveal>
          ) : null}

          {settingsPanel === "reminders" ? (
            <AnimatedReveal>
            <SectionCard title="提醒与免打扰">
              {permission === "granted" ? (
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <AppText variant="bodyStrong">通知权限</AppText>
                  <Badge label="已开启" tone="success" />
                </View>
              ) : Platform.OS === "web" ? (
                <HelperText>本地提醒仅支持手机 App，请在安装版中开启通知权限。</HelperText>
              ) : (
                <AppButton
                  title={permission === "denied" ? "前往系统设置" : "开启提醒权限"}
                  onPress={() => (permission === "denied" ? void Linking.openSettings() : void enablePermission())}
                />
              )}
              <Divider />
              <SwitchRow
                label="晚间未完成汇总"
                description="每天固定时间提醒"
                value={settings.isEveningSummaryEnabled}
                onValueChange={(value) => save({ ...settings, isEveningSummaryEnabled: value }, true)}
              />
              {settings.isEveningSummaryEnabled ? (
                <AnimatedReveal variant="inline">
                <TimePickerField
                  label="汇总时间"
                  value={settings.eveningSummaryTime}
                  onChange={(value) => save({ ...settings, eveningSummaryTime: value }, true)}
                />
                </AnimatedReveal>
              ) : null}
              <Divider />
              <SwitchRow
                label="开启免打扰"
                description="这段时间内不发送提醒"
                value={settings.isQuietHoursEnabled}
                onValueChange={(value) => save({ ...settings, isQuietHoursEnabled: value }, true)}
              />
              {settings.isQuietHoursEnabled ? (
                <AnimatedReveal variant="inline">
                <View style={{ flexDirection: "row", gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <TimePickerField label="开始" value={settings.quietHoursStart} onChange={(value) => save({ ...settings, quietHoursStart: value }, true)} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <TimePickerField label="结束" value={settings.quietHoursEnd} onChange={(value) => save({ ...settings, quietHoursEnd: value }, true)} />
                  </View>
                </View>
                </AnimatedReveal>
              ) : null}
              {Platform.OS !== "web" ? (
                <>
                  <Divider />
                  <HelperText>
                    服务端推送不依赖本地闹钟；点「测试服务端推送」后请退到桌面查看系统通知。
                  </HelperText>
                  <AppButton title="测试服务端推送 (个推)" onPress={() => void runServerPushTest()} />
                  <AppButton title="8 秒后测试本地通知" variant="secondary" onPress={() => void runTestReminder()} />
                  {Platform.OS === "android" ? (
                    <>
                      <HelperText>
                        安卓后台还须关闭智能优化并打开横幅。可走下方完整引导。
                      </HelperText>
                      <AppButton title="设置后台提醒保护" variant="secondary" onPress={() => setAndroidGuideVisible(true)} />
                    </>
                  ) : null}
                  {testReminderMessage ? <HelperText>{testReminderMessage}</HelperText> : null}
                </>
              ) : null}
            </SectionCard>
            </AnimatedReveal>
          ) : null}

          {/* board 主列表之外的能力：用同风格 ListRow 卡展开，避免 ghost 按钮跳戏 */}
          <Card elevated={false} style={{ paddingVertical: 2, paddingHorizontal: 13, gap: 0 }}>
            <ListRow
              icon="ellipsis-horizontal"
              iconBg={colors.surfaceMuted}
              iconColor={colors.inkSoft}
              onPress={() => setSettingsPanel(settingsPanel === "more" ? null : "more")}
            >
              <AppText variant="bodyStrong" style={{ fontSize: 15 }}>
                {settingsPanel === "more" ? "收起更多" : "更多"}
              </AppText>
              <AppText variant="small" tone="muted">
                更新 · 管理 · AI 配置
              </AppText>
            </ListRow>
          </Card>
          {settingsPanel === "more" ? (
            <AnimatedReveal style={{ gap: 12 }}>
              <SectionCard title="应用更新">
                <AppText variant="small" tone="muted">
                  当前 {currentVersionText}
                  {updateResult?.status === "current" ? " · 已是最新" : ""}
                </AppText>
                {availableUpdate ? (
                  <>
                    <AppText variant="bodyStrong">
                      版本 {formatVersion(availableUpdate.version, availableUpdate.buildNumber)}
                    </AppText>
                    <AppButton title="下载更新" icon="download-outline" compact fullWidth onPress={downloadUpdate} />
                  </>
                ) : (
                  <AppButton
                    title="检查更新"
                    variant="secondary"
                    icon="refresh-outline"
                    iconSpin={isCheckingUpdate}
                    compact
                    fullWidth
                    onPress={() => {
                      if (!isCheckingUpdate) void checkUpdates();
                    }}
                  />
                )}
                {updateError ? <HelperText tone="danger">{updateError}</HelperText> : null}
              </SectionCard>
              <SectionCard title="奖励与管理">
                <AppButton title="打开商城" icon="gift-outline" compact fullWidth onPress={() => router.push("/shop")} />
                <AppButton title="兑换记录" variant="secondary" compact fullWidth onPress={() => router.push("/shop/redemptions")} />
                {isOwner ? (
                  <>
                    <AppButton title="章节管理" variant="secondary" compact fullWidth onPress={() => router.push("/admin/adventure")} />
                    <AppButton title="章节兑现" variant="secondary" compact fullWidth onPress={() => router.push("/admin/adventure-claims")} />
                    <AppButton title="奖励管理" variant="secondary" compact fullWidth onPress={() => router.push("/admin/rewards")} />
                  </>
                ) : null}
              </SectionCard>
              <SectionCard title="AI 服务配置">
                <HelperText tone="muted">
                  填写 OpenAI 兼容接口（含中转）。对话与生成计划都会走这里的真实模型。
                </HelperText>
                <TextField
                  label="服务地址"
                  value={settings.aiBaseUrl}
                  onChangeText={(value) => setSettings({ ...settings, aiBaseUrl: value })}
                  onBlur={() => save(settings)}
                  placeholder="https://api.openai.com/v1"
                  keyboardType="url"
                />
                <TextField
                  label="API Key"
                  value={settings.aiApiKey}
                  onChangeText={(value) => setSettings({ ...settings, aiApiKey: value })}
                  onBlur={() => save(settings)}
                  placeholder="sk-..."
                  secureTextEntry
                />
                <TextField
                  label="模型名"
                  value={settings.aiModel}
                  onChangeText={(value) => setSettings({ ...settings, aiModel: value })}
                  onBlur={() => save(settings)}
                  placeholder="gpt-4o-mini / deepseek-chat"
                />
              </SectionCard>
            </AnimatedReveal>
          ) : null}
        </>
      ) : (
        <View
          style={{
            borderRadius: 22,
            backgroundColor: colors.partnerSurface,
            borderWidth: 1,
            borderColor: colors.line,
            padding: 16,
            gap: 12
          }}
        >
          <AppText variant="display">我的</AppText>
          <AppText variant="body" tone="muted">
            登录后，和另一半一起经营共同小岛。
          </AppText>
          <AppButton title="登录 / 注册" icon="log-in-outline" onPress={() => router.push("/account")} />
        </View>
      )}
    
      <AndroidReminderGuideModal
        visible={androidGuideVisible}
        onClose={() => setAndroidGuideVisible(false)}
        onPermissionChanged={(granted) => setPermission(granted ? "granted" : "denied")}
      />
</Screen>
  );
}
