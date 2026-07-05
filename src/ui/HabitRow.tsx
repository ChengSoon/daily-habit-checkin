import { Button, Text, View } from "react-native";
import { Habit } from "../habits/types";

export function HabitRow({
  habit,
  isCompleted,
  onComplete,
  onOpen
}: {
  habit: Habit;
  isCompleted: boolean;
  onComplete: () => void;
  onOpen: () => void;
}) {
  return (
    <View style={{ gap: 8, padding: 12, borderRadius: 8, backgroundColor: isCompleted ? "#E9EFE4" : "#FFFFFF" }}>
      <Text style={{ fontSize: 18, fontWeight: "700" }}>{habit.name}</Text>
      <Text>{habit.reminderTime ? `提醒 ${habit.reminderTime}` : "未设置提醒"}</Text>
      {habit.isPaused ? <Text>已暂停</Text> : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Button title="详情" onPress={onOpen} />
        <Button title={isCompleted ? "已完成" : "打卡"} onPress={onComplete} disabled={isCompleted} />
      </View>
    </View>
  );
}
