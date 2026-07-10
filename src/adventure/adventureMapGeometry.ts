export type RoutePoint = { x: number; y: number };

const CONTROL_POINTS: RoutePoint[] = [
  { x: 0.13, y: 0.78 },
  { x: 0.36, y: 0.67 },
  { x: 0.6, y: 0.43 },
  { x: 0.84, y: 0.2 }
];

function interpolate(left: RoutePoint, right: RoutePoint, ratio: number): RoutePoint {
  return {
    x: left.x + (right.x - left.x) * ratio,
    y: left.y + (right.y - left.y) * ratio
  };
}

export function createRoutePoints(count: number): RoutePoint[] {
  const safeCount = Math.max(1, Math.trunc(count));
  if (safeCount === 1) return [CONTROL_POINTS[0]];
  const segments = CONTROL_POINTS.length - 1;
  return Array.from({ length: safeCount }, (_, index) => {
    const scaled = (index / (safeCount - 1)) * segments;
    const segmentIndex = Math.min(Math.floor(scaled), segments - 1);
    return interpolate(CONTROL_POINTS[segmentIndex], CONTROL_POINTS[segmentIndex + 1], scaled - segmentIndex);
  });
}

export function travelerPoint(
  routePoints: RoutePoint[],
  stationIndex: number,
  segmentPoints: number,
  segmentCost: number
): RoutePoint {
  const current = routePoints[stationIndex] ?? routePoints[0];
  const next = routePoints[stationIndex + 1];
  if (!next || segmentCost <= 0) return current;
  return interpolate(current, next, Math.min(1, segmentPoints / segmentCost));
}
