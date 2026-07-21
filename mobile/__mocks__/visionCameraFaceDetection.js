module.exports = {
  useFaceDetectorOutput: jest.fn(() => ({})),
  useImageFaceDetector: jest.fn(() => ({
    detectFaces: jest.fn(() => []),
  })),
};
