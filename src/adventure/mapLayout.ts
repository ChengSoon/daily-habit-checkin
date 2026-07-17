/**
 * 程序化群岛布局：由章节数驱动画布高度与岛屿坐标。
 * 业务解锁规则不读坐标，仅 UI 使用。
 */

export const MAP_LAYOUT = {
  width: 360,
  /** 相邻岛屿纵向间距（岛体较大） */
  segmentH: 156,
  padTop: 96,
  padBottom: 110,
  minEmptyHeight: 280,
  /** 岛精灵逻辑半宽（用于命中与间距校验） */
  nodeRadius: 56,
  pathWidth: 4,
  ampX: 0.22,
  minX: 0.18,
  maxX: 0.82,
  pathTension: 0.35
} as const;

/** @deprecated 使用 MAP_LAYOUT */
export const MAP_CANVAS = {
  width: MAP_LAYOUT.width,
  height: MAP_LAYOUT.minEmptyHeight,
  nodeRadius: MAP_LAYOUT.nodeRadius,
  pathWidth: MAP_LAYOUT.pathWidth
} as const;

export type MapPoint = {
  x: number;
  y: number;
};

export type LayoutNode = {
  index: number;
  x: number;
  y: number;
  cx: number;
  cy: number;
};

export type MapLayoutResult = {
  width: number;
  height: number;
  nodeRadius: number;
  pathWidth: number;
  points: LayoutNode[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function canvasHeightForCount(chapterCount: number): number {
  if (chapterCount <= 0) {
    return MAP_LAYOUT.minEmptyHeight;
  }
  if (chapterCount === 1) {
    return MAP_LAYOUT.padTop + MAP_LAYOUT.padBottom;
  }
  return (
    MAP_LAYOUT.padTop + MAP_LAYOUT.padBottom + (chapterCount - 1) * MAP_LAYOUT.segmentH
  );
}

export function buildMapLayout(input: {
  chapterCount: number;
  width?: number;
  seed?: number;
}): MapLayoutResult {
  const width = input.width ?? MAP_LAYOUT.width;
  const count = Math.max(0, Math.floor(input.chapterCount));
  const height = canvasHeightForCount(count);
  const seed = input.seed ?? 0;
  const points: LayoutNode[] = [];

  for (let i = 0; i < count; i += 1) {
    const side = i % 2 === 0 ? -1 : 1;
    const wobble = seed ? 0.03 * Math.sin(seed * 12.9898 + i * 78.233) : 0;
    const x = clamp(0.5 + side * MAP_LAYOUT.ampX + wobble, MAP_LAYOUT.minX, MAP_LAYOUT.maxX);
    const cy =
      count === 1
        ? height - MAP_LAYOUT.padBottom
        : height - MAP_LAYOUT.padBottom - i * MAP_LAYOUT.segmentH;
    const cx = x * width;
    points.push({
      index: i,
      x,
      y: height > 0 ? cy / height : 0,
      cx,
      cy
    });
  }

  return {
    width,
    height,
    nodeRadius: MAP_LAYOUT.nodeRadius,
    pathWidth: MAP_LAYOUT.pathWidth,
    points
  };
}

export function layoutChapters<T extends { sortOrder: number }>(
  chapters: T[],
  options?: { width?: number; seed?: number }
): {
  layout: MapLayoutResult;
  items: (T & { index: number; x: number; y: number; cx: number; cy: number })[];
} {
  const ordered = [...chapters].sort((a, b) => a.sortOrder - b.sortOrder);
  const layout = buildMapLayout({
    chapterCount: ordered.length,
    width: options?.width,
    seed: options?.seed
  });

  const items = ordered.map((chapter, index) => {
    const point = layout.points[index];
    return {
      ...chapter,
      index,
      x: point.x,
      y: point.y,
      cx: point.cx,
      cy: point.cy
    };
  });

  return { layout, items };
}

export function toCanvasXY(
  point: MapPoint,
  width: number,
  height: number
): { cx: number; cy: number } {
  return {
    cx: point.x * width,
    cy: point.y * height
  };
}

export function buildPathD(
  points: { cx: number; cy: number }[],
  tension = MAP_LAYOUT.pathTension
): string {
  if (points.length === 0) return "";
  if (points.length === 1) {
    return `M ${points[0].cx} ${points[0].cy}`;
  }

  let d = `M ${points[0].cx} ${points[0].cy}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.cx + next.cx) / 2;
    const midY = (current.cy + next.cy) / 2;
    const cpx = midX + (next.cy - current.cy) * tension * 0.15;
    const cpy = midY - (next.cx - current.cx) * tension * 0.15;
    d += ` Q ${cpx} ${cpy} ${next.cx} ${next.cy}`;
  }
  return d;
}
