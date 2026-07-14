import {
  buildColorMatrix,
  IDENTITY_MATRIX,
  NEUTRAL_ADJUSTMENTS,
  saturationMatrix,
} from '../colorMatrix';

describe('buildColorMatrix', () => {
  it('returns the identity matrix for neutral adjustments', () => {
    const result = buildColorMatrix(NEUTRAL_ADJUSTMENTS);
    result.forEach((value, i) => {
      expect(value).toBeCloseTo(IDENTITY_MATRIX[i]);
    });
  });

  it('produces a valid 20-element matrix for non-neutral adjustments', () => {
    const result = buildColorMatrix({ brightness: 0.2, contrast: 0.3, saturation: -0.5 });
    expect(result).toHaveLength(20);
    expect(result.every((v) => Number.isFinite(v))).toBe(true);
  });
});

describe('saturationMatrix', () => {
  it('fully desaturating (saturation -1) collapses every row to the luminance weights', () => {
    const matrix = saturationMatrix(-1);
    // Rec. 601 luminance weights repeated across R/G/B output rows, zero offset.
    expect(matrix[0]).toBeCloseTo(0.213);
    expect(matrix[1]).toBeCloseTo(0.715);
    expect(matrix[2]).toBeCloseTo(0.072);
    expect(matrix[4]).toBe(0);
  });
});
