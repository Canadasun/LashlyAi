const React = require('react');
const { View } = require('react-native');

// Minimal fake — ARLashPreviewScreen only renders <Camera> when useCameraDevice
// returns a device, and tests never get past the "no camera available" branch since
// this mock's device is always undefined, so the component body barely matters.
module.exports = {
  Camera: (props) => React.createElement(View, props),
  useCameraDevice: jest.fn(() => undefined),
  useCameraPermission: jest.fn(() => ({
    hasPermission: false,
    requestPermission: jest.fn().mockResolvedValue(false),
  })),
  usePhotoOutput: jest.fn(() => ({
    capturePhotoToFile: jest.fn().mockResolvedValue({ filePath: '/tmp/mock-photo.jpg' }),
  })),
  useVideoOutput: jest.fn(() => ({
    createRecorder: jest.fn().mockResolvedValue({
      filePath: '/tmp/mock-video.mp4',
      startRecording: jest.fn().mockResolvedValue(undefined),
      stopRecording: jest.fn().mockResolvedValue(undefined),
    }),
  })),
};
