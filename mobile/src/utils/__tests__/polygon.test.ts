import { expandPolygonFromCentroid, isPointInPolygon } from '../polygon';

const SQUARE = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('isPointInPolygon', () => {
  it('detects a point inside a simple square', () => {
    expect(isPointInPolygon({ x: 5, y: 5 }, SQUARE)).toBe(true);
  });

  it('detects a point outside a simple square', () => {
    expect(isPointInPolygon({ x: 20, y: 20 }, SQUARE)).toBe(false);
  });

  it('treats a point far outside as outside regardless of axis', () => {
    expect(isPointInPolygon({ x: -5, y: 5 }, SQUARE)).toBe(false);
  });
});

describe('expandPolygonFromCentroid', () => {
  it('leaves the polygon unchanged at factor 1', () => {
    expect(expandPolygonFromCentroid(SQUARE, 1)).toEqual(SQUARE);
  });

  it('scales points outward from the centroid, growing the enclosed area', () => {
    const expanded = expandPolygonFromCentroid(SQUARE, 2);
    // Centroid of SQUARE is (5,5); doubling distance from centroid moves (0,0) to (-5,-5).
    expect(expanded[0]).toEqual({ x: -5, y: -5 });
    expect(isPointInPolygon({ x: -2, y: -2 }, expanded)).toBe(true);
    expect(isPointInPolygon({ x: -2, y: -2 }, SQUARE)).toBe(false);
  });

  it('returns an empty polygon unchanged', () => {
    expect(expandPolygonFromCentroid([], 1.4)).toEqual([]);
  });
});
