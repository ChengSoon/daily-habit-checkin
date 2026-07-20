import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { AppText, Divider, SegmentedControl } from "../ui/Controls";
import { useTheme } from "../ui/ThemeContext";
import { memoryCategoryLabel } from "./companionSettingsModel";
import type { CompanionMemory } from "./companionTypes";

type MemoryFilter = "all" | CompanionMemory["category"];

export function CompanionMemoryPanel({
  memories,
  busyId,
  onDelete
}: {
  memories: CompanionMemory[];
  busyId: string | null;
  onDelete: (memory: CompanionMemory) => void;
}) {
  const { colors } = useTheme();
  const [filter, setFilter] = useState<MemoryFilter>("all");
  const visibleMemories = useMemo(
    () => memories.filter((memory) => filter === "all" || memory.category === filter),
    [filter, memories]
  );

  return (
    <View style={{ gap: 10 }}>
      <SegmentedControl<MemoryFilter>
        value={filter}
        onChange={setFilter}
        options={[
          { label: "全部", value: "all" },
          { label: "偏好", value: "preference" },
          { label: "日期", value: "important_date" },
          { label: "目标", value: "shared_goal" },
          { label: "鼓励", value: "encouragement_style" },
          { label: "瞬间", value: "shared_moment" }
        ]}
      />
      {visibleMemories.length === 0 ? (
        <View style={{ minHeight: 88, alignItems: "center", justifyContent: "center", gap: 5 }}>
          <Ionicons name="heart-outline" size={22} color={colors.faint} />
          <AppText variant="small" tone="muted">还没有这类共同记忆</AppText>
        </View>
      ) : (
        visibleMemories.map((memory, index) => (
          <View key={memory.id}>
            {index > 0 ? <Divider /> : null}
            <View
              style={{
                minHeight: 66,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                paddingVertical: 8
              }}
            >
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.partnerSurface
                }}
              >
                <Ionicons name="heart" size={16} color={colors.partnerInk} />
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                <AppText variant="caption" tone="muted">
                  {memoryCategoryLabel(memory.category)} · {memory.creatorName ?? "空间成员"}
                </AppText>
                <AppText variant="bodyStrong">{memory.content}</AppText>
              </View>
              <Pressable
                onPress={() => onDelete(memory)}
                disabled={busyId === memory.id}
                accessibilityRole="button"
                accessibilityLabel={`删除共同记忆：${memory.content}`}
                hitSlop={6}
                style={({ pressed }) => ({
                  width: 38,
                  height: 38,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: busyId === memory.id ? 0.35 : pressed ? 0.7 : 1
                })}
              >
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </Pressable>
            </View>
          </View>
        ))
      )}
    </View>
  );
}
