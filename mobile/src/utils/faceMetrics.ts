// Pure geometry helpers for FaceDeepScanScreen — split out from the screen so the math
// itself (not just that the screen renders) can be verified without a camera or a real
// device. Every value here is a plain, honest measurement of detected landmark
// geometry — not a diagnosis, and not the same thing as the app's trained AI eye-shape
// classification (round/almond/hooded/etc., see EyeAnalysisResultScreen). See
// FaceDeepScanScreen.tsx's doc comment for why that distinction matters.

export interface Point2D {
  x: number;
  y: number;
}

export interface BoundingBox {
  width: number;
  height: number;
  cx: number;
  cy: number;
}

export function boundingBox(points: Point2D[]): BoundingBox {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { width: maxX - minX, height: maxY - minY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
}

export type EyeSpacingLabel = 'close-set' | 'average' | 'wide-set';

export interface FaceMetrics {
  eyeSymmetryPct: number;
  eyeSpacingLabel: EyeSpacingLabel;
  leftEyeOpenPct: number | null;
  rightEyeOpenPct: number | null;
  levelness: 'level' | 'tilted';
}

export interface FaceMetricsInput {
  leftEyeContour: Point2D[];
  rightEyeContour: Point2D[];
  rollAngleDeg: number;
  leftEyeOpenProbability?: number;
  rightEyeOpenProbability?: number;
}

const CLOSE_SET_THRESHOLD = 0.85;
const WIDE_SET_THRESHOLD = 1.15;
const LEVEL_THRESHOLD_DEG = 5;

export function computeFaceMetrics(input: FaceMetricsInput): FaceMetrics | null {
  if (input.leftEyeContour.length < 3 || input.rightEyeContour.length < 3) return null;

  const leftBox = boundingBox(input.leftEyeContour);
  const rightBox = boundingBox(input.rightEyeContour);
  const avgEyeWidth = (leftBox.width + rightBox.width) / 2;
  const eyeSymmetryPct =
    avgEyeWidth > 0 ? Math.max(0, Math.round(100 - (Math.abs(leftBox.width - rightBox.width) / avgEyeWidth) * 100)) : 100;

  const interocular = Math.hypot(leftBox.cx - rightBox.cx, leftBox.cy - rightBox.cy);
  const spacingRatio = avgEyeWidth > 0 ? interocular / avgEyeWidth : 1;
  const eyeSpacingLabel: EyeSpacingLabel =
    spacingRatio < CLOSE_SET_THRESHOLD ? 'close-set' : spacingRatio > WIDE_SET_THRESHOLD ? 'wide-set' : 'average';

  return {
    eyeSymmetryPct,
    eyeSpacingLabel,
    leftEyeOpenPct: input.leftEyeOpenProbability != null ? Math.round(input.leftEyeOpenProbability * 100) : null,
    rightEyeOpenPct: input.rightEyeOpenProbability != null ? Math.round(input.rightEyeOpenProbability * 100) : null,
    levelness: Math.abs(input.rollAngleDeg) < LEVEL_THRESHOLD_DEG ? 'level' : 'tilted',
  };
}
