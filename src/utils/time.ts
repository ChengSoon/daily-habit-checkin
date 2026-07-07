/**
 * 把用户输入的时间规范为 "HH:MM"（24 小时制）。
 * 容忍单位数小时、首尾空格和全角冒号；无法解析或越界时返回 null。
 */
export function normalizeTimeInput(value: string): string | null {
  const match = value.trim().replace("：", ":").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  return `${`${hours}`.padStart(2, "0")}:${match[2]}`;
}
