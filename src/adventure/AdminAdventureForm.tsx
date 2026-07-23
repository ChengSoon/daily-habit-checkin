import { View } from "react-native";
import { DEFAULT_ISLAND_THEME_KEYS } from "./mapThemeKeys";
import type { AdventureChapterStatus, AdventureRewardType } from "./types";
import type { PickedImage } from "../rewards/rewardImage";
import {
  AppButton,
  AppText,
  Card,
  HelperText,
  Label,
  SegmentedControl,
  TextField
} from "../ui/Controls";
import { ImagePickerField } from "../ui/RewardImage";

const THEME_LABELS: Record<(typeof DEFAULT_ISLAND_THEME_KEYS)[number], string> = {
  lighthouse: "灯塔", forest: "森林", market: "市集", camp: "营地", bridge: "云桥", summit: "山顶"
};
const STATUS_OPTIONS: { label: string; value: AdventureChapterStatus }[] = [
  { label: "发布", value: "published" },
  { label: "草稿", value: "draft" },
  { label: "下架", value: "archived" }
];
const REWARD_TYPE_OPTIONS: { label: string; value: AdventureRewardType }[] = [
  { label: "徽章叙事", value: "badge_story" },
  { label: "现实惊喜", value: "real_pending" }
];

type FormValues = {
  title: string;
  subtitle: string;
  storyText: string;
  thresholdLifetimeXp: string;
  badgeName: string;
  badgeDescription: string;
  badgeEmoji: string;
  mapThemeKey: string;
  rewardType: AdventureRewardType;
  status: AdventureChapterStatus;
};

type FormChanges = {
  [Key in keyof FormValues]: (value: FormValues[Key]) => void;
};

type AdminAdventureFormProps = {
  editing: boolean;
  values: FormValues;
  changes: FormChanges;
  previews: { badge: string | null; node: string | null; background: string | null };
  onBadgeChange: (image: PickedImage | null) => void;
  onNodeChange: (image: PickedImage | null) => void;
  onBackgroundChange: (image: PickedImage | null) => void;
  busy: boolean;
  message: string | null;
  error: string | null;
  onSave: () => void;
  onReset: () => void;
};

function BasicFields({ values, changes }: Pick<AdminAdventureFormProps, "values" | "changes">) {
  return <>
    <TextField label="标题" value={values.title} onChangeText={changes.title} placeholder="例如：启程灯塔" />
    <TextField label="副标题" value={values.subtitle} onChangeText={changes.subtitle} placeholder="一句话" />
    <TextField label="叙事正文" value={values.storyText} onChangeText={changes.storyText} placeholder="过关故事" multiline />
    <TextField label="门槛累计 XP" value={values.thresholdLifetimeXp}
      onChangeText={changes.thresholdLifetimeXp} keyboardType="number-pad" placeholder="50" />
    <TextField label="徽章名称" value={values.badgeName} onChangeText={changes.badgeName} placeholder="启程徽章" />
    <TextField label="徽章描述" value={values.badgeDescription} onChangeText={changes.badgeDescription} placeholder="可选" />
    <TextField label="徽章 Emoji" value={values.badgeEmoji} onChangeText={changes.badgeEmoji} placeholder="🏅" />
  </>;
}

function ThemeOptions({ values, changes }: Pick<AdminAdventureFormProps, "values" | "changes">) {
  return <View style={{ gap: 8 }}>
    <Label>默认主题岛（无自定义岛图时）</Label>
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {DEFAULT_ISLAND_THEME_KEYS.map((key) => <AppButton key={key} title={THEME_LABELS[key] ?? key}
        variant={values.mapThemeKey === key ? "primary" : "secondary"} compact
        onPress={() => changes.mapThemeKey(key)} />)}
    </View>
  </View>;
}

function ImageFields(props: Pick<AdminAdventureFormProps,
  "values" | "changes" | "previews" | "onBadgeChange" | "onNodeChange" | "onBackgroundChange">) {
  return <>
    <ImagePickerField label="徽章图片" type="virtual" previewUri={props.previews.badge} onChange={props.onBadgeChange} />
    <ThemeOptions values={props.values} changes={props.changes} />
    <ImagePickerField label="自定义岛屿形象（可选，支持 GIF）" type="virtual"
      previewUri={props.previews.node} pickerMode="adventure"
      helperText="必须透明底 PNG/WebP（不要白底 JPG）。GIF 可动。上传后优先于默认主题岛。"
      onChange={props.onNodeChange} />
    <ImagePickerField label="自定义岛屿背景（可选，支持 GIF）" type="virtual"
      previewUri={props.previews.background} pickerMode="adventure"
      helperText="整屏背景可用 JPG/PNG/GIF。岛屿形象请用透明 PNG，不要白底。"
      onChange={props.onBackgroundChange} />
  </>;
}

function ChapterOptions({ values, changes }: Pick<AdminAdventureFormProps, "values" | "changes">) {
  return <>
    <View style={{ gap: 8 }}>
      <Label>奖励类型</Label>
      <SegmentedControl value={values.rewardType} onChange={changes.rewardType} options={REWARD_TYPE_OPTIONS} />
    </View>
    <View style={{ gap: 8 }}>
      <Label>状态</Label>
      <SegmentedControl value={values.status} onChange={changes.status} options={STATUS_OPTIONS} />
    </View>
  </>;
}

export function AdminAdventureForm(props: AdminAdventureFormProps) {
  const { editing, busy, message, error, onSave, onReset } = props;
  return (
    <Card elevated={false} style={{ gap: 12 }}>
      <AppText variant="section">{editing ? "编辑章节" : "新建章节"}</AppText>
      <BasicFields values={props.values} changes={props.changes} />
      <ImageFields {...props} />
      <ChapterOptions values={props.values} changes={props.changes} />
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <AppButton title={busy ? "保存中…" : "保存"} onPress={onSave} disabled={busy} />
        <AppButton title="清空表单" variant="secondary" onPress={onReset} disabled={busy} />
      </View>
      {message ? <HelperText tone="success">{message}</HelperText> : null}
      {error ? <HelperText tone="danger">{error}</HelperText> : null}
    </Card>
  );
}
