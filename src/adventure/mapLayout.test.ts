import { describe, expect, it } from "vitest";
import {
  MAP_LAYOUT,
  buildMapLayout,
  buildPathD,
  canvasHeightForCount,
  layoutChapters,
  toCanvasXY
} from "./mapLayout";

function distance(
  a: { cx: number; cy: number },
  b: { cx: number; cy: number }
): number {
  const dx = a.cx - b.cx;
  const dy = a.cy - b.cy;
  return Math.hypot(dx, dy);
}

describe("mapLayout procedural", () => {
  it("uses minimum height for empty map", () => {
    expect(canvasHeightForCount(0)).toBe(MAP_LAYOUT.minEmptyHeight);
    expect(buildMapLayout({ chapterCount: 0 }).points).toEqual([]);
  });

  it("places a single chapter in the lower area", () => {
    const layout = buildMapLayout({ chapterCount: 1 });
    expect(layout.height).toBe(MAP_LAYOUT.padTop + MAP_LAYOUT.padBottom);
    expect(layout.points).toHaveLength(1);
    const [point] = layout.points;
    expect(point.x).toBeGreaterThanOrEqual(MAP_LAYOUT.minX);
    expect(point.x).toBeLessThanOrEqual(MAP_LAYOUT.maxX);
    expect(point.cy).toBeGreaterThanOrEqual(layout.height * 0.45);
  });

  it("grows height linearly with chapter count", () => {
    const h6 = canvasHeightForCount(6);
    const h7 = canvasHeightForCount(7);
    const h12 = canvasHeightForCount(12);
    expect(h7 - h6).toBe(MAP_LAYOUT.segmentH);
    expect(h12 - h6).toBe(6 * MAP_LAYOUT.segmentH);
  });

  it("keeps cy strictly decreasing for multi-chapter journeys", () => {
    const layout = buildMapLayout({ chapterCount: 12 });
    for (let i = 0; i < layout.points.length - 1; i += 1) {
      expect(layout.points[i].cy).toBeGreaterThan(layout.points[i + 1].cy);
    }
  });

  it("keeps x in safe band and nodes far enough apart", () => {
    for (const n of [6, 12]) {
      const layout = buildMapLayout({ chapterCount: n });
      const minDist = 2.2 * layout.nodeRadius;
      for (const point of layout.points) {
        expect(point.x).toBeGreaterThanOrEqual(MAP_LAYOUT.minX);
        expect(point.x).toBeLessThanOrEqual(MAP_LAYOUT.maxX);
      }
      for (let i = 0; i < layout.points.length; i += 1) {
        for (let j = i + 1; j < layout.points.length; j += 1) {
          expect(distance(layout.points[i], layout.points[j])).toBeGreaterThanOrEqual(minDist);
        }
      }
    }
  });

  it("is a pure function for the same input", () => {
    const a = buildMapLayout({ chapterCount: 8, seed: 3 });
    const b = buildMapLayout({ chapterCount: 8, seed: 3 });
    expect(a).toEqual(b);
  });

  it("zips chapters by sortOrder into layout points", () => {
    const chapters = [
      { id: "c3", sortOrder: 3, title: "三" },
      { id: "c1", sortOrder: 1, title: "一" },
      { id: "c2", sortOrder: 2, title: "二" }
    ];
    const { items, layout } = layoutChapters(chapters);
    expect(layout.points).toHaveLength(3);
    expect(items.map((item) => item.id)).toEqual(["c1", "c2", "c3"]);
    expect(items[0].cy).toBeGreaterThan(items[1].cy);
    expect(items[1].cy).toBeGreaterThan(items[2].cy);
  });

  it("maps normalized coords to canvas pixels", () => {
    const { cx, cy } = toCanvasXY({ x: 0.5, y: 0.25 }, 200, 400);
    expect(cx).toBe(100);
    expect(cy).toBe(100);
  });

  it("builds a path string for multiple points", () => {
    const d = buildPathD([
      { cx: 10, cy: 20 },
      { cx: 40, cy: 60 },
      { cx: 80, cy: 40 }
    ]);
    expect(d.startsWith("M 10 20")).toBe(true);
    expect(d.includes("Q")).toBe(true);
  });
});
