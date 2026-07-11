import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, View } from "react-native";
import { AppButton, AppText, Card, SwitchRow, TextField } from "../ui/Controls";
import { radius, spacing } from "../ui/theme";
import { useTheme } from "../ui/ThemeContext";
import type { PickedBadgeImage } from "./adventureBadgeImage";
import { AdventureBadgePicker } from "./AdventureBadgePicker";
import type { AdventureStationFormValue } from "./adventureStationFormModel";

const ICONS = ["ribbon", "flower", "diamond", "star", "heart", "planet"] as const;
const COLORS = ["#E9507A", "#6E7BD9", "#D39B34", "#2D9C73", "#C85C3F", "#815AC0"];

type AdventureStationFormProps = {
  value: AdventureStationFormValue;
  everUnlocked: boolean;
  badgePreviewUri: string | null;
  submitting: boolean;
  onChange: (value: AdventureStationFormValue) => void;
  onBadgeChange: (image: PickedBadgeImage | null) => void;
  onSubmit: () => void;
};

type SetField = <K extends keyof AdventureStationFormValue>(
  key: K,
  next: AdventureStationFormValue[K]
) => void;

export function AdventureStationForm(props: AdventureStationFormProps) {
  const { value, everUnlocked, badgePreviewUri, submitting, onChange, onBadgeChange, onSubmit } = props;
  const set = <K extends keyof AdventureStationFormValue>(key: K, next: AdventureStationFormValue[K]) => {
    onChange({ ...value, [key]: next });
  };

  return (
    <View style={{ gap: spacing.lg }}>
      {everUnlocked ? <LockNotice /> : null}
      <StationInfoCard value={value} everUnlocked={everUnlocked} set={set} />
      <XpRewardCard value={value} everUnlocked={everUnlocked} set={set} />
      <BadgeRewardCard value={value} everUnlocked={everUnlocked} previewUri={badgePreviewUri} submitting={submitting} set={set} onBadgeChange={onBadgeChange} />
      <StoryRewardCard value={value} everUnlocked={everUnlocked} set={set} />
      <AppButton
        title={submitting ? "正在保存" : "保存关卡"}
        icon={submitting ? "sync" : "checkmark"}
        iconSpin={submitting}
        disabled={submitting}
        onPress={onSubmit}
      />
    </View>
  );
}

function LockNotice() {
  const { colors } = useTheme();
  return (
    <View style={[styles.lockNotice, { backgroundColor: colors.surfaceTint, borderColor: colors.celebration }] }>
      <Ionicons name="lock-closed-outline" size={18} color={colors.primaryInk} />
      <AppText variant="small" tone="soft" style={{ flex: 1 }}>
        已解锁关卡的累计门槛、奖励开关和 XP 已锁定，仍可更新名称、勋章设计和来信。
      </AppText>
    </View>
  );
}

function StationInfoCard({ value, everUnlocked, set }: { value: AdventureStationFormValue; everUnlocked: boolean; set: SetField }) {
  return (
    <Card>
      <AppText variant="section">关卡信息</AppText>
      <TextField label="关卡名称" value={value.title} onChangeText={(text) => set("title", text)} />
      <TextField
        label="累计行动力门槛"
        value={value.unlockAtText}
        onChangeText={(text) => set("unlockAtText", text)}
        keyboardType="number-pad"
        disabled={everUnlocked}
      />
    </Card>
  );
}

function XpRewardCard({ value, everUnlocked, set }: { value: AdventureStationFormValue; everUnlocked: boolean; set: SetField }) {
  return (
    <Card>
      <SwitchRow label="XP 奖励" description="解锁关卡时自动进入共享钱包" value={value.xpEnabled} onValueChange={(next) => set("xpEnabled", next)} disabled={everUnlocked} />
      {value.xpEnabled ? (
        <TextField label="XP 数量" value={value.xpText} onChangeText={(text) => set("xpText", text)} keyboardType="number-pad" disabled={everUnlocked} />
      ) : null}
    </Card>
  );
}

function BadgeRewardCard({ value, everUnlocked, previewUri, submitting, set, onBadgeChange }: {
  value: AdventureStationFormValue;
  everUnlocked: boolean;
  previewUri: string | null;
  submitting: boolean;
  set: SetField;
  onBadgeChange: AdventureStationFormProps["onBadgeChange"];
}) {
  return (
    <Card>
      <SwitchRow label="勋章奖励" description="上传自己的设计，默认图标只用于兜底" value={value.badgeEnabled} onValueChange={(next) => set("badgeEnabled", next)} disabled={everUnlocked} />
      {value.badgeEnabled ? <BadgeRewardFields value={value} previewUri={previewUri} submitting={submitting} set={set} onBadgeChange={onBadgeChange} /> : null}
    </Card>
  );
}

function BadgeRewardFields({ value, previewUri, submitting, set, onBadgeChange }: {
  value: AdventureStationFormValue;
  previewUri: string | null;
  submitting: boolean;
  set: SetField;
  onBadgeChange: AdventureStationFormProps["onBadgeChange"];
}) {
  return (
    <>
      <TextField label="勋章名称" value={value.badgeTitle} onChangeText={(text) => set("badgeTitle", text)} />
      <AdventureBadgePicker previewUri={previewUri} disabled={submitting} onChange={onBadgeChange} />
      <BadgeIconOptions value={value} set={set} />
      <BadgeColorOptions value={value} set={set} />
    </>
  );
}

function BadgeIconOptions({ value, set }: { value: AdventureStationFormValue; set: SetField }) {
  const { colors } = useTheme();
  return (
    <>
      <AppText variant="small" tone="muted">默认图标</AppText>
      <View style={styles.swatches}>{ICONS.map((icon) => (
        <Pressable key={icon} accessibilityRole="button" accessibilityState={{ selected: value.badgeIcon === icon }} onPress={() => set("badgeIcon", icon)} style={[styles.iconSwatch, { backgroundColor: value.badgeIcon === icon ? colors.surfaceTint : colors.surfaceMuted, borderColor: value.badgeIcon === icon ? colors.primary : colors.line }]}>
          <Ionicons name={icon} size={21} color={value.badgeColor} />
        </Pressable>
      ))}</View>
    </>
  );
}

function BadgeColorOptions({ value, set }: { value: AdventureStationFormValue; set: SetField }) {
  const { colors } = useTheme();
  return (
    <>
      <AppText variant="small" tone="muted">默认颜色</AppText>
      <View style={styles.swatches}>{COLORS.map((color) => (
        <Pressable key={color} accessibilityRole="button" accessibilityLabel={`选择颜色 ${color}`} accessibilityState={{ selected: value.badgeColor === color }} onPress={() => set("badgeColor", color)} style={[styles.colorSwatch, { backgroundColor: color, borderColor: value.badgeColor === color ? colors.ink : colors.surface }]} />
      ))}</View>
    </>
  );
}

function StoryRewardCard({ value, everUnlocked, set }: { value: AdventureStationFormValue; everUnlocked: boolean; set: SetField }) {
  return (
    <Card>
      <SwitchRow label="来信奖励" value={value.storyEnabled} onValueChange={(next) => set("storyEnabled", next)} disabled={everUnlocked} />
      {value.storyEnabled ? (
        <>
          <TextField label="来信标题" value={value.storyTitle} onChangeText={(text) => set("storyTitle", text)} />
          <TextField label="来信正文" value={value.storyBody} onChangeText={(text) => set("storyBody", text)} multiline />
        </>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  lockNotice: {
    alignItems: "center",
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  iconSwatch: {
    alignItems: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  colorSwatch: { borderRadius: radius.pill, borderWidth: 3, height: 34, width: 34 }
});
