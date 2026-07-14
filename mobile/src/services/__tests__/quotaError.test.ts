import { ApiError } from '../api';
import { isQuotaExceededError } from '../quotaError';

describe('isQuotaExceededError', () => {
  it('is true for a 403 ApiError', () => {
    expect(isQuotaExceededError(new ApiError('Upgrade to Pro', 403))).toBe(true);
  });

  it('is false for a non-403 ApiError', () => {
    expect(isQuotaExceededError(new ApiError('Invalid or expired token', 401))).toBe(false);
  });

  it('is false for a plain Error', () => {
    expect(isQuotaExceededError(new Error('network down'))).toBe(false);
  });
});
