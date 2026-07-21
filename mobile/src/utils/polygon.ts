export interface Point2D {
  x: number;
  y: number;
}

/**
 * Standard ray-casting point-in-polygon test. Used to keep the Video Retouch paint
 * brush from ever marking the lash/eye region — see VideoRetouchScreen.tsx.
 */
export function isPointInPolygon(point: Point2D, polygon: Point2D[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersects = yi > point.y !== yj > point.y && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

/**
 * Scales a polygon outward from its own centroid by `factor` — used to pad the raw
 * eye contour into a safety margin around the lash line, not just the exact eyelid
 * edge (a technician's actual lash line sits slightly outside the eye contour ML Kit
 * detects, and this needs to be a strictly conservative "never paintable" zone, not a
 * pixel-tight one).
 */
export function expandPolygonFromCentroid(polygon: Point2D[], factor: number): Point2D[] {
  if (polygon.length === 0) return polygon;
  const centroid = polygon.reduce(
    (sum, p) => ({ x: sum.x + p.x / polygon.length, y: sum.y + p.y / polygon.length }),
    { x: 0, y: 0 },
  );
  return polygon.map((p) => ({
    x: centroid.x + (p.x - centroid.x) * factor,
    y: centroid.y + (p.y - centroid.y) * factor,
  }));
}
