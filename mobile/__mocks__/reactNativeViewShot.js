const React = require('react');

const ViewShot = React.forwardRef((props, ref) => {
  React.useImperativeHandle(ref, () => ({
    capture: jest.fn(() => Promise.resolve('mock://capture.png')),
  }));
  return props.children ?? null;
});

module.exports = ViewShot;
module.exports.default = ViewShot;
module.exports.captureRef = jest.fn(() => Promise.resolve('mock://capture.png'));
module.exports.releaseCapture = jest.fn();
