module.exports = {
  CameraRoll: {
    save: jest.fn(() => Promise.resolve('mock://saved')),
  },
};
