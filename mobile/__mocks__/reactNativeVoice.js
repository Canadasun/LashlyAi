// Minimal fake — tests only need start()/stop()/destroy() to resolve and the event
// setter properties to exist so useVoiceDictation.ts doesn't throw wiring them up.
module.exports = {
  onSpeechStart: null,
  onSpeechEnd: null,
  onSpeechError: null,
  onSpeechResults: null,
  onSpeechPartialResults: null,
  start: jest.fn().mockResolvedValue(undefined),
  stop: jest.fn().mockResolvedValue(undefined),
  destroy: jest.fn().mockResolvedValue(undefined),
  removeAllListeners: jest.fn(),
};
