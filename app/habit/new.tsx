import { router } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { createHabit } from "../../src/habits/habitRepository";
import { HabitFrequency, HabitTrackType } from "../../src/habits/types";
import { refreshScheduledReminders } from "../../src/reminders/reminderService";
import {
  AppButton,
  AppText,
  HelperText,
  Label,
  SectionCard,
  SegmentedControl,
  SwitchRow,
  TextField,
  WeekdayPicker
} from "../../src/ui/Controls";
import { Screen } from "../../src/ui/Screen";
import { TimePickerField } from "../../src/ui/TimeWheelPicker";

type FrequencyType = "daily" | "weekdays" | "weekly";

function toFrequency(type: FrequencyType, weeklyDays: number[]): HabitFrequency {
  if (type === "weekdays") {
    return { type: "weekdays" };
  }
  if (type === "weekly") {
    return { type: "weekly", daysOfWeek: [...weeklyDays].sort((a, b) => a - b) };
  }
  return { type: "daily" };
}

export default function NewHabitScreen() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequencyType, setFrequencyType] = useState<FrequencyType>("daily");
  const [weeklyDays, setWeeklyDays] = useState<number[]>([1, 3, 5]);
  const [isReminderEnabled, setIsReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState("21:30");
  const [trackType, setTrackType] = useState<HabitTrackType>("check");
  const [numericUnit, setNumericUnit] = useState("");
  const [error, setError] = useState<string | null>(null);

  const frequencyInvalid = frequencyType === "weekly" && weeklyDays.length === 0;

  async function saveManualHabit() {
    setError(null);
    try {
      await createHabit({
        name,
        description: description || null,
        frequency: toFrequency(frequencyType, weeklyDays),
        reminderTime: isReminderEnabled ? reminderTime : null,
        isReminderEnabled,
        trackType,
        numericUnit: trackType === "numeric" ? numericUnit || "次" : null
      });
      await refreshScheduledReminders();
      router.replace("/(tabs)/habits");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "保存失败");
    }
  }

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <AppText variant="display">新增习惯</AppText>
        <AppText variant="body" tone="muted">
          手动创建一个岛上角落。想用 AI 规划，可从今日或习惯页右上角进入对话。
        </AppText>
      </View>

      <SectionCard title="习惯信息">
        <TextField label="名称" value={name} onChangeText={setName} placeholder="例如：睡前拉伸" />
        <TextField
          label="描述"
          value={description}
          onChangeText={setDescription}
          placeholder="例如：睡前 10 分钟"
        />
      </SectionCard>

      <SectionCard title="频率与提醒">
        <View style={{ gap: 8 }}>
          <Label>频率</Label>
          <SegmentedControl<FrequencyType>
            value={frequencyType}
            onChange={setFrequencyType}
            options={[
              { label: "每天", value: "daily" },
              { label: "工作日", value: "weekdays" },
              { label: "每周", value: "weekly" }
            ]}
          />
          {frequencyType === "weekly" ? <WeekdayPicker value={weeklyDays} onChange={setWeeklyDays} /> : null}
        </View>
        <SwitchRow
          label="开启提醒"
          description="到点提醒你完成这个习惯"
          value={isReminderEnabled}
          onValueChange={setIsReminderEnabled}
        />
        {isReminderEnabled ? (
          <TimePickerField label="提醒时间" value={reminderTime} onChange={setReminderTime} />
        ) : null}
      </SectionCard>

      <SectionCard title="记录方式">
        <SegmentedControl<HabitTrackType>
          value={trackType}
          onChange={setTrackType}
          options={[
            { label: "一键完成", value: "check" },
            { label: "数值记录", value: "numeric" }
          ]}
        />
        {trackType === "numeric" ? (
          <TextField
            label="单位"
            value={numericUnit}
            onChangeText={setNumericUnit}
            placeholder="例如：分钟、页、次"
          />
        ) : null}
      </SectionCard>

      {error ? <HelperText tone="danger">{error}</HelperText> : null}

      <AppButton
        title="保存为岛上新角落"
        icon="add"
        fullWidth
        onPress={saveManualHabit}
        disabled={!name || frequencyInvalid}
      />
    </Screen>
  );
}
