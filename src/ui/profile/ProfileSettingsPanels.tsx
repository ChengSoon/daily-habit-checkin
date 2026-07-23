import { Ionicons } from "@expo/vector-icons";
import { Linking, Platform, Pressable, View } from "react-native";
import type { ReminderPermissionStatus } from "../../reminders/reminderService";
import type { AppSettings } from "../../settings/settingsRepository";
import { AnimatedReveal } from "../AnimatedReveal";
import {
  AppButton,
  AppText,
  Badge,
  Divider,
  HelperText,
  SectionCard,
  SegmentedControl,
  SwitchRow
} from "../Controls";
import { themeOptions } from "../theme";
import type { ThemeMode } from "../ThemeContext";
import { TimePickerField } from "../TimeWheelPicker";
import { useTheme } from "../ThemeContext";

type ThemeOption = (typeof themeOptions)[number];
type ReminderPanelProps = {
  settings: AppSettings;
  permission: ReminderPermissionStatus;
  testMessage: string | null;
  onSave: (settings: AppSettings) => void;
  onEnablePermission: () => void;
  onRunTest: () => void;
  onShowAndroidGuide: () => void;
};

function ThemeOptionRow({ active, onChange, option }: {
  active: boolean;
  onChange: (name: ThemeOption["name"]) => void;
  option: ThemeOption;
}) {
  const { colors } = useTheme();
  return <Pressable onPress={() => onChange(option.name)} style={{
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    borderRadius: 14,
    borderWidth: active ? 2 : 1,
    borderColor: active ? colors.primary : colors.line,
    backgroundColor: active ? colors.surfaceTint : colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10
  }}>
    <View style={{ flexDirection: "row" }}>
      <View style={{ width: 18, height: 18, borderRadius: 999, backgroundColor: option.swatch[0], borderWidth: 2, borderColor: colors.surface }} />
      <View style={{ width: 18, height: 18, borderRadius: 999, backgroundColor: option.swatch[1], borderWidth: 2, borderColor: colors.surface, marginLeft: -6 }} />
    </View>
    <View style={{ flex: 1, gap: 2 }}>
      <AppText variant="bodyStrong" style={{ fontSize: 15 }}>{option.label}</AppText>
      <AppText variant="small" tone="muted">{option.description}</AppText>
    </View>
    {active ? <Ionicons name="checkmark-circle" size={18} color={colors.primary} /> : null}
  </Pressable>;
}

export function ProfileThemePanel({ mode, themeName, onModeChange, onThemeChange }: {
  mode: ThemeMode;
  themeName: string;
  onModeChange: (mode: ThemeMode) => void;
  onThemeChange: (name: (typeof themeOptions)[number]["name"]) => void;
}) {
  return (
    <AnimatedReveal>
      <SectionCard title="主题外观">
        <View style={{ gap: 8 }}>
          {themeOptions.map((option) => <ThemeOptionRow key={option.name} option={option}
            active={option.name === themeName} onChange={onThemeChange} />)}
        </View>
        <Divider />
        <SegmentedControl
          value={mode}
          onChange={onModeChange}
          options={[
            { label: "跟随系统", value: "system" },
            { label: "浅色", value: "light" },
            { label: "深色", value: "dark" }
          ]}
        />
      </SectionCard>
    </AnimatedReveal>
  );
}

function PermissionControl(props: Pick<ReminderPanelProps, "permission" | "onEnablePermission">) {
  const { permission, onEnablePermission } = props;
  if (permission === "granted") return <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
    <AppText variant="bodyStrong">通知权限</AppText><Badge label="已开启" tone="success" />
  </View>;
  if (Platform.OS === "web") return <HelperText>本地提醒仅支持手机 App，请在安装版中开启通知权限。</HelperText>;
  return <AppButton title={permission === "denied" ? "前往系统设置" : "开启提醒权限"}
    onPress={() => permission === "denied" ? void Linking.openSettings() : onEnablePermission()} />;
}

function ReminderSchedule({ settings, onSave }: Pick<ReminderPanelProps, "settings" | "onSave">) {
  return <>
    <SwitchRow label="晚间未完成汇总" description="每天固定时间提醒"
      value={settings.isEveningSummaryEnabled}
      onValueChange={(value) => onSave({ ...settings, isEveningSummaryEnabled: value })} />
    {settings.isEveningSummaryEnabled ? <AnimatedReveal variant="inline">
      <TimePickerField label="汇总时间" value={settings.eveningSummaryTime}
        onChange={(value) => onSave({ ...settings, eveningSummaryTime: value })} />
    </AnimatedReveal> : null}
  </>;
}

function QuietHours({ settings, onSave }: Pick<ReminderPanelProps, "settings" | "onSave">) {
  return <>
    <SwitchRow label="开启免打扰" description="这段时间内不发送提醒" value={settings.isQuietHoursEnabled}
      onValueChange={(value) => onSave({ ...settings, isQuietHoursEnabled: value })} />
    {settings.isQuietHoursEnabled ? <AnimatedReveal variant="inline">
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={{ flex: 1 }}><TimePickerField label="开始" value={settings.quietHoursStart}
          onChange={(value) => onSave({ ...settings, quietHoursStart: value })} /></View>
        <View style={{ flex: 1 }}><TimePickerField label="结束" value={settings.quietHoursEnd}
          onChange={(value) => onSave({ ...settings, quietHoursEnd: value })} /></View>
      </View>
    </AnimatedReveal> : null}
  </>;
}

function ReminderTest(props: Pick<ReminderPanelProps, "testMessage" | "onRunTest" | "onShowAndroidGuide">) {
  if (Platform.OS === "web") return null;
  return <>
    <Divider />
    <AppButton title="8 秒后测试本地通知" variant="secondary" onPress={props.onRunTest} />
    {Platform.OS === "android" ? <>
      <HelperText>安卓后台还须关闭智能优化并打开横幅。可走下方完整引导。</HelperText>
      <AppButton title="设置后台提醒保护" variant="secondary" onPress={props.onShowAndroidGuide} />
    </> : null}
    {props.testMessage ? <HelperText>{props.testMessage}</HelperText> : null}
  </>;
}

export function ProfileReminderPanel(props: ReminderPanelProps) {
  return (
    <AnimatedReveal>
      <SectionCard title="提醒与免打扰">
        <PermissionControl {...props} />
        <Divider />
        <ReminderSchedule {...props} />
        <Divider />
        <QuietHours {...props} />
        <ReminderTest {...props} />
      </SectionCard>
    </AnimatedReveal>
  );
}
