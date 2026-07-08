export type CheckButtonPressAction = "complete" | "undo" | "none";

export function getCheckButtonPressAction({
  disabled,
  checked,
  canUndo
}: {
  disabled: boolean;
  checked: boolean;
  canUndo: boolean;
}): CheckButtonPressAction {
  if (disabled) {
    return "none";
  }
  if (checked) {
    return canUndo ? "undo" : "none";
  }
  return "complete";
}
