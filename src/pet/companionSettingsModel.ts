import type {
  CompanionMemory,
  CompanionState,
  MemberPreferences
} from "./companionTypes";

const BOND_STAGES: Record<
  CompanionState["bond"]["stage"],
  { label: string; minimum: number; next: number | null }
> = {
  first_meeting: { label: "初次相遇", minimum: 0, next: 20 },
  getting_familiar: { label: "渐渐熟悉", minimum: 20, next: 60 },
  in_sync: { label: "很有默契", minimum: 60, next: 120 },
  long_companionship: { label: "长久相伴", minimum: 120, next: null }
};

const MEMORY_LABELS: Record<CompanionMemory["category"], string> = {
  preference: "称呼偏好",
  important_date: "重要日期",
  shared_goal: "共同目标",
  encouragement_style: "鼓励方式",
  shared_moment: "共同瞬间"
};

export function bondPresentation(bond: CompanionState["bond"]): {
  label: string;
  progress: number;
  nextAt: number | null;
} {
  const stage = BOND_STAGES[bond.stage];
  if (stage.next === null) return { label: stage.label, progress: 1, nextAt: null };
  const progress = (bond.points - stage.minimum) / (stage.next - stage.minimum);
  return {
    label: stage.label,
    progress: Math.max(0, Math.min(1, progress)),
    nextAt: stage.next
  };
}

export function memoryCategoryLabel(category: CompanionMemory["category"]): string {
  return MEMORY_LABELS[category];
}

export function memoryDeleteConfirmation(content: string): string {
  return `删除「${content}」后，这条共同记忆将从双方的卡卡中移除。`;
}

export function chatClearConfirmation(): string {
  return "将清空双方可见的近期共同对话与会话摘要。普通对话原本最长保留 90 天，清空后无法恢复。";
}

export function normalizeMemberPreferences(
  petVisible: boolean,
  proactiveMode: MemberPreferences["proactiveMode"]
): MemberPreferences {
  return { petVisible, proactiveMode };
}
