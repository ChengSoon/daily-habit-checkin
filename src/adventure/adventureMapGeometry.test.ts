import { describe, expect, it } from "vitest";
import { createRoutePoints, travelerPoint } from "./adventureMapGeometry";

describe("adventure map geometry", () => {
  it("creates stable route endpoints for arbitrary station counts", () => {
    const points = createRoutePoints(8);

    expect(points).toHaveLength(8);
    expect(points[0]).toEqual({ x: 0.13, y: 0.78 });
    expect(points[7]).toEqual({ x: 0.84, y: 0.2 });
  });

  it("keeps a one-point route at the starting position", () => {
    expect(createRoutePoints(1)).toEqual([{ x: 0.13, y: 0.78 }]);
  });

  it("interpolates the traveler inside the current segment", () => {
    const points = createRoutePoints(4);

    expect(travelerPoint(points, 1, 3, 6)).toEqual({
      x: (points[1].x + points[2].x) / 2,
      y: (points[1].y + points[2].y) / 2
    });
  });
});
