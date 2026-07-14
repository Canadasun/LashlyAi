// Skia's <ColorMatrix> takes a 20-number row-major 4x5 matrix operating on
// normalized [0,1] color channels (confirmed against the native SkColorMatrix header
// — identity is 1s on the diagonal with 0 offsets, not a 0-255 byte scale like
// Android's older CPU ColorMatrix). These are the standard formulas used across most
// color-matrix implementations (CSS filter polyfills, Android ColorMatrix wrappers)
// when operating in that normalized space.
export type ColorMatrix20 = number[];

export const IDENTITY_MATRIX: ColorMatrix20 = [
  1, 0, 0, 0, 0, //
  0, 1, 0, 0, 0, //
  0, 0, 1, 0, 0, //
  0, 0, 0, 1, 0,
];

// Applies `b` first, then `a` — i.e. the returned matrix is equivalent to a(b(color)).
function multiply(a: ColorMatrix20, b: ColorMatrix20): ColorMatrix20 {
  const result = new Array(20).fill(0);
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 4; col++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) {
        sum += a[row * 5 + k] * b[k * 5 + col];
      }
      result[row * 5 + col] = sum;
    }
    let translation = a[row * 5 + 4];
    for (let k = 0; k < 4; k++) {
      translation += a[row * 5 + k] * b[k * 5 + 4];
    }
    result[row * 5 + 4] = translation;
  }
  return result;
}

// brightness: -1 (black) .. 0 (identity) .. 1 (blown out)
export function brightnessMatrix(brightness: number): ColorMatrix20 {
  const b = brightness;
  return [
    1, 0, 0, 0, b, //
    0, 1, 0, 0, b, //
    0, 0, 1, 0, b, //
    0, 0, 0, 1, 0,
  ];
}

// contrast: -1 (flat gray) .. 0 (identity) .. 1 (max contrast). Keeps the 0.5 gray
// midpoint fixed so contrast doesn't also shift overall brightness.
export function contrastMatrix(contrast: number): ColorMatrix20 {
  const c = contrast + 1;
  const t = (1 - c) / 2;
  return [
    c, 0, 0, 0, t, //
    0, c, 0, 0, t, //
    0, 0, c, 0, t, //
    0, 0, 0, 1, 0,
  ];
}

// saturation: -1 (grayscale) .. 0 (identity) .. 1 (double saturation), using the
// standard Rec. 601 luminance weights.
export function saturationMatrix(saturation: number): ColorMatrix20 {
  const sat = saturation + 1;
  const lumR = 0.213;
  const lumG = 0.715;
  const lumB = 0.072;
  const sr = (1 - sat) * lumR;
  const sg = (1 - sat) * lumG;
  const sb = (1 - sat) * lumB;
  return [
    sr + sat, sg, sb, 0, 0, //
    sr, sg + sat, sb, 0, 0, //
    sr, sg, sb + sat, 0, 0, //
    0, 0, 0, 1, 0,
  ];
}

export interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
}

export const NEUTRAL_ADJUSTMENTS: Adjustments = { brightness: 0, contrast: 0, saturation: 0 };

// Order: saturation, then contrast, then brightness — a reasonable default order for
// a simple filter tool (no single "correct" order for non-commuting color ops).
export function buildColorMatrix({ brightness, contrast, saturation }: Adjustments): ColorMatrix20 {
  return multiply(brightnessMatrix(brightness), multiply(contrastMatrix(contrast), saturationMatrix(saturation)));
}

export interface FilterPreset {
  label: string;
  adjustments: Adjustments;
}

// PLACEHOLDER preset values — a visual filter tool, not a lash-accuracy rules table,
// so these are just reasonable starting points rather than something requiring
// owner sign-off the way lashMapRules.data.ts's mm/curl tables do.
export const FILTER_PRESETS: FilterPreset[] = [
  { label: 'Natural', adjustments: NEUTRAL_ADJUSTMENTS },
  { label: 'Warm', adjustments: { brightness: 0.03, contrast: 0.05, saturation: 0.15 } },
  { label: 'Cool', adjustments: { brightness: 0.02, contrast: 0.05, saturation: -0.1 } },
  { label: 'Dramatic', adjustments: { brightness: -0.05, contrast: 0.3, saturation: 0.1 } },
  { label: 'Vivid', adjustments: { brightness: 0.05, contrast: 0.15, saturation: 0.4 } },
];
