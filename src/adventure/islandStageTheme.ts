/**
 * 单岛舞台的主题氛围色（无自定义背景时使用）。
 * 比整张竖向世界图裁切更干净，也更贴合「一岛一景」。
 */

export type IslandStageTheme = {
  top: string;
  mid: string;
  bottom: string;
  washTop: number;
  washMid: number;
  washBottom: number;
  accent: string;
};

const THEMES: Record<string, IslandStageTheme> = {
  lighthouse: {
    top: "#7EC8E3",
    mid: "#B8DFF0",
    bottom: "#F2E2B8",
    washTop: 0.18,
    washMid: 0.06,
    washBottom: 0.22,
    accent: "#F0A15E"
  },
  forest: {
    top: "#8FCBB0",
    mid: "#B7DFC4",
    bottom: "#5F9E78",
    washTop: 0.16,
    washMid: 0.05,
    washBottom: 0.24,
    accent: "#3F9E7A"
  },
  market: {
    top: "#F3C1D4",
    mid: "#F8D9E5",
    bottom: "#E8B48A",
    washTop: 0.14,
    washMid: 0.05,
    washBottom: 0.2,
    accent: "#E86A92"
  },
  camp: {
    top: "#2A2A55",
    mid: "#4A3F78",
    bottom: "#1A1A33",
    washTop: 0.28,
    washMid: 0.12,
    washBottom: 0.35,
    accent: "#8B7BD8"
  },
  bridge: {
    top: "#8FD4CF",
    mid: "#C7EDE9",
    bottom: "#6BA8A3",
    washTop: 0.15,
    washMid: 0.05,
    washBottom: 0.22,
    accent: "#1FA39A"
  },
  summit: {
    top: "#C9D6EA",
    mid: "#E8EEF7",
    bottom: "#9AA8C0",
    washTop: 0.16,
    washMid: 0.06,
    washBottom: 0.24,
    accent: "#C24A73"
  }
};

const FALLBACK: IslandStageTheme = {
  top: "#6FB7D6",
  mid: "#A9D7EA",
  bottom: "#3E7F96",
  washTop: 0.2,
  washMid: 0.08,
  washBottom: 0.28,
  accent: "#5BA4C8"
};

export function resolveIslandStageTheme(mapThemeKey: string | null | undefined): IslandStageTheme {
  if (mapThemeKey && THEMES[mapThemeKey]) {
    return THEMES[mapThemeKey];
  }
  return FALLBACK;
}
