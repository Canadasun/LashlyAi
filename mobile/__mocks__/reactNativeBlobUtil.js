module.exports = {
  fs: { dirs: { CacheDir: '/mock/cache' } },
  config: jest.fn(() => ({
    fetch: jest.fn(() =>
      Promise.resolve({ path: () => '/mock/cache/file.jpg' }),
    ),
  })),
};
