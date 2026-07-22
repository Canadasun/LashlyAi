import { boundingBox, computeFaceMetrics, Point2D } from '../faceMetrics';

function eyeBox(x: number, y: number, width: number, height: number): Point2D[] {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

describe('boundingBox', () => {
  it('derives width/height/center from arbitrary points, not just corners', () => {
    const box = boundingBox([
      { x: 10, y: 5 },
      { x: 50, y: 5 },
      { x: 30, y: 25 },
    ]);
    expect(box).toEqual({ width: 40, height: 20, cx: 30, cy: 15 });
  });
});

describe('computeFaceMetrics', () => {
  // Both eyes 40 wide, centers one eye-width apart (160 - 120 = 40) — the classic
  // "average" canthal-distance heuristic (eyes roughly one eye-width apart).
  const leftEye = eyeBox(100, 100, 40, 20); // cx 120, cy 110
  const rightEyeAverage = eyeBox(140, 100, 40, 20); // cx 160, cy 110

  it('reports 100% symmetry for identically-sized eyes', () => {
    const metrics = computeFaceMetrics({
      leftEyeContour: leftEye,
      rightEyeContour: rightEyeAverage,
      rollAngleDeg: 0,
    });
    expect(metrics?.eyeSymmetryPct).toBe(100);
  });

  it('reduces symmetry proportionally to the width difference between eyes', () => {
    const narrowerRightEye = eyeBox(160, 100, 30, 20); // width 30 vs left's 40
    const metrics = computeFaceMetrics({
      leftEyeContour: leftEye,
      rightEyeContour: narrowerRightEye,
      rollAngleDeg: 0,
    });
    // avg width (40+30)/2=35, diff=10 -> 100 - (10/35)*100 = 71.43 -> rounds to 71
    expect(metrics?.eyeSymmetryPct).toBe(71);
  });

  it('classifies eyes one eye-width apart as average spacing', () => {
    const metrics = computeFaceMetrics({
      leftEyeContour: leftEye,
      rightEyeContour: rightEyeAverage,
      rollAngleDeg: 0,
    });
    expect(metrics?.eyeSpacingLabel).toBe('average');
  });

  it('classifies eyes closer than 0.85x eye-width apart as close-set', () => {
    const closeRightEye = eyeBox(125, 100, 40, 20); // cx 145, gap from 120 = 25 (ratio 0.625)
    const metrics = computeFaceMetrics({
      leftEyeContour: leftEye,
      rightEyeContour: closeRightEye,
      rollAngleDeg: 0,
    });
    expect(metrics?.eyeSpacingLabel).toBe('close-set');
  });

  it('classifies eyes farther than 1.15x eye-width apart as wide-set', () => {
    const wideRightEye = eyeBox(170, 100, 40, 20); // cx 190, gap from 120 = 70 (ratio 1.75)
    const metrics = computeFaceMetrics({
      leftEyeContour: leftEye,
      rightEyeContour: wideRightEye,
      rollAngleDeg: 0,
    });
    expect(metrics?.eyeSpacingLabel).toBe('wide-set');
  });

  it('reports level for small roll angles and tilted at/above the threshold', () => {
    const level = computeFaceMetrics({ leftEyeContour: leftEye, rightEyeContour: rightEyeAverage, rollAngleDeg: 4.9 });
    const tilted = computeFaceMetrics({ leftEyeContour: leftEye, rightEyeContour: rightEyeAverage, rollAngleDeg: 5 });
    const tiltedNegative = computeFaceMetrics({ leftEyeContour: leftEye, rightEyeContour: rightEyeAverage, rollAngleDeg: -15 });
    expect(level?.levelness).toBe('level');
    expect(tilted?.levelness).toBe('tilted');
    expect(tiltedNegative?.levelness).toBe('tilted');
  });

  it('converts eye-open probabilities to rounded percentages, and null when absent', () => {
    const withProbabilities = computeFaceMetrics({
      leftEyeContour: leftEye,
      rightEyeContour: rightEyeAverage,
      rollAngleDeg: 0,
      leftEyeOpenProbability: 0.947,
      rightEyeOpenProbability: 0.981,
    });
    expect(withProbabilities?.leftEyeOpenPct).toBe(95);
    expect(withProbabilities?.rightEyeOpenPct).toBe(98);

    const withoutProbabilities = computeFaceMetrics({
      leftEyeContour: leftEye,
      rightEyeContour: rightEyeAverage,
      rollAngleDeg: 0,
    });
    expect(withoutProbabilities?.leftEyeOpenPct).toBeNull();
    expect(withoutProbabilities?.rightEyeOpenPct).toBeNull();
  });

  it('returns null when a contour has fewer than 3 points (detection too weak to trust)', () => {
    const metrics = computeFaceMetrics({
      leftEyeContour: [{ x: 0, y: 0 }, { x: 1, y: 1 }],
      rightEyeContour: rightEyeAverage,
      rollAngleDeg: 0,
    });
    expect(metrics).toBeNull();
  });
});
