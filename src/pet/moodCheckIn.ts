export type MoodScore = 1 | 2 | 3 | 4 | 5;

export function normalizeMoodCheckIn(score: number, note: string): {
  score: MoodScore;
  note: string;
} {
  if (!Number.isInteger(score) || score < 1 || score > 5) {
    throw new Error("请选择一个心情");
  }
  return { score: score as MoodScore, note: note.trim().slice(0, 500) };
}
