import { Link } from "expo-router";
import { Text } from "react-native";
import { Screen } from "../../src/ui/Screen";

export default function HabitsScreen() {
  return (
    <Screen>
      <Text>习惯管理</Text>
      <Link href="/habit/new">新增习惯</Link>
    </Screen>
  );
}
