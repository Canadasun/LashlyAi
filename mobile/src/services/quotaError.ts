import { ApiError } from './api';

// Every quota-gated backend route (coach, photo feedback, lash map generation, forum,
// marketing captions...) returns the same shape on quota exceeded: HTTP 403 with an
// { error } message telling the user to upgrade. This is the one place that decides
// "was this failure a quota wall", so screens don't each re-derive it from message text.
export function isQuotaExceededError(err: unknown): err is ApiError {
  return err instanceof ApiError && err.status === 403;
}
