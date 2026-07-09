import { api, setAuthToken, setUnauthorizedHandler } from '../api';

function mockFetchOnce(status: number, body: unknown) {
  (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
    status,
    ok: status >= 200 && status < 300,
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
  });
}

describe('api request handling', () => {
  afterEach(() => {
    setAuthToken(undefined);
    setUnauthorizedHandler(() => {});
  });

  it('returns the parsed body on success', async () => {
    mockFetchOnce(200, { hello: 'world' });
    const result = await api.get<{ hello: string }>('/anything');
    expect(result).toEqual({ hello: 'world' });
  });

  it('calls the unauthorized handler and throws on 401, without touching JSON parsing', async () => {
    mockFetchOnce(401, { error: 'Invalid or expired token' });
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(api.get('/clients')).rejects.toThrow('Your session expired');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('does not call the unauthorized handler for non-401 errors', async () => {
    mockFetchOnce(403, { error: 'You do not own this client profile' });
    const onUnauthorized = jest.fn();
    setUnauthorizedHandler(onUnauthorized);

    await expect(api.get('/clients/123')).rejects.toThrow('You do not own this client profile');
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('falls back to a clean status message when the error response is not JSON', async () => {
    (globalThis as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({
      status: 502,
      ok: false,
      text: async () => '<!DOCTYPE html><html><body>Bad Gateway</body></html>',
    });

    await expect(api.get('/clients')).rejects.toThrow('failed with status 502');
  });
});
