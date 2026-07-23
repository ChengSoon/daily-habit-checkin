import { router } from "expo-router";
import type { AppSettings } from "../../settings/settingsRepository";
import type { AppUpdateCheckResult, CurrentAppVersion } from "../../updates/updateClient";
import { AnimatedReveal } from "../AnimatedReveal";
import { AppButton, AppText, Card, HelperText, ListRow, SectionCard, TextField } from "../Controls";
import { useTheme } from "../ThemeContext";

function formatVersion(version: string, buildNumber?: number | null): string {
  return buildNumber ? `${version} (${buildNumber})` : version;
}

type ProfileMorePanelProps = {
  expanded: boolean;
  currentVersion: CurrentAppVersion;
  updateResult: AppUpdateCheckResult | null;
  isChecking: boolean;
  updateError: string | null;
  isOwner: boolean;
  settings: AppSettings;
  onToggle: () => void;
  onCheck: () => void;
  onDownload: () => void;
  onSettingsChange: (settings: AppSettings) => void;
  onSettingsSave: () => void;
};

function UpdateSection(props: Pick<ProfileMorePanelProps,
  "currentVersion" | "updateResult" | "isChecking" | "updateError" | "onCheck" | "onDownload">) {
  const { currentVersion, updateResult, isChecking, updateError, onCheck, onDownload } = props;
  const available = updateResult?.status === "available" ? updateResult.update : null;
  return <SectionCard title="应用更新">
    <AppText variant="small" tone="muted">
      当前 {formatVersion(currentVersion.version, currentVersion.buildNumber)}
      {updateResult?.status === "current" ? " · 已是最新" : ""}
    </AppText>
    {available ? <>
      <AppText variant="bodyStrong">版本 {formatVersion(available.version, available.buildNumber)}</AppText>
      <AppButton title="下载更新" icon="download-outline" compact fullWidth onPress={onDownload} />
    </> : <AppButton title="检查更新" variant="secondary" icon="refresh-outline" iconSpin={isChecking}
      compact fullWidth onPress={() => { if (!isChecking) onCheck(); }} />}
    {updateError ? <HelperText tone="danger">{updateError}</HelperText> : null}
  </SectionCard>;
}

function ManagementSection({ isOwner }: Pick<ProfileMorePanelProps, "isOwner">) {
  return <SectionCard title="奖励与管理">
    <AppButton title="打开商城" icon="gift-outline" compact fullWidth onPress={() => router.push("/shop")} />
    <AppButton title="兑换记录" variant="secondary" compact fullWidth onPress={() => router.push("/shop/redemptions")} />
    {isOwner ? <>
      <AppButton title="章节管理" variant="secondary" compact fullWidth onPress={() => router.push("/admin/adventure")} />
      <AppButton title="章节兑现" variant="secondary" compact fullWidth onPress={() => router.push("/admin/adventure-claims")} />
      <AppButton title="奖励管理" variant="secondary" compact fullWidth onPress={() => router.push("/admin/rewards")} />
    </> : null}
  </SectionCard>;
}

function AiSettingsSection(props: Pick<ProfileMorePanelProps, "settings" | "onSettingsChange" | "onSettingsSave">) {
  const { settings, onSettingsChange, onSettingsSave } = props;
  const change = (field: "aiBaseUrl" | "aiApiKey" | "aiModel") => (value: string) => {
    onSettingsChange({ ...settings, [field]: value });
  };
  return <SectionCard title="AI 服务配置">
    <HelperText tone="muted">填写 OpenAI 兼容接口（含中转）。对话与生成计划都会走这里的真实模型。</HelperText>
    <TextField label="服务地址" value={settings.aiBaseUrl} onChangeText={change("aiBaseUrl")}
      onBlur={onSettingsSave} placeholder="https://api.openai.com/v1" keyboardType="url" />
    <TextField label="API Key" value={settings.aiApiKey} onChangeText={change("aiApiKey")}
      onBlur={onSettingsSave} placeholder="sk-..." secureTextEntry />
    <TextField label="模型名" value={settings.aiModel} onChangeText={change("aiModel")}
      onBlur={onSettingsSave} placeholder="gpt-4o-mini / deepseek-chat" />
  </SectionCard>;
}

export function ProfileMorePanel(props: ProfileMorePanelProps) {
  const { expanded, onToggle } = props;
  const { colors } = useTheme();
  return (
    <>
      <Card elevated={false} style={{ paddingVertical: 2, paddingHorizontal: 13, gap: 0 }}>
        <ListRow icon="ellipsis-horizontal" iconBg={colors.surfaceMuted} iconColor={colors.inkSoft} onPress={onToggle}>
          <AppText variant="bodyStrong" style={{ fontSize: 15 }}>{expanded ? "收起更多" : "更多"}</AppText>
          <AppText variant="small" tone="muted">更新 · 管理 · AI 配置</AppText>
        </ListRow>
      </Card>
      {expanded ? (
        <AnimatedReveal style={{ gap: 12 }}>
          <UpdateSection {...props} />
          <ManagementSection isOwner={props.isOwner} />
          <AiSettingsSection {...props} />
        </AnimatedReveal>
      ) : null}
    </>
  );
}
