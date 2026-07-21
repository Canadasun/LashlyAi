import { NativeModules } from 'react-native';

interface VideoRetouchNativeModule {
  applyMaskedRetouch(videoPath: string, maskPath: string): Promise<string>;
}

const { VideoRetouch } = NativeModules as { VideoRetouch?: VideoRetouchNativeModule };

export class VideoRetouchUnavailableError extends Error {}

/**
 * Bakes a masked gaussian-blur skin-smoothing effect into a recorded video, entirely
 * on-device, via the native VideoRetouch module (ios/LashlyAIMobile/VideoRetouch.swift
 * — AVFoundation + Core Image, no cloud AI call). maskPath must point to a PNG the same
 * aspect ratio as the video: opaque white = retouch here, transparent/black = leave
 * untouched. The lash/eye region must already be excluded from the mask before calling
 * this — see VideoRetouchScreen's paint canvas, which enforces that at paint time.
 *
 * Returns a file:// path to the retouched output video.
 */
export async function applyMaskedVideoRetouch(videoPath: string, maskPath: string): Promise<string> {
  if (!VideoRetouch) {
    throw new VideoRetouchUnavailableError(
      'Video Retouch native module is unavailable — rebuild the app after adding VideoRetouch.swift/.m to the Xcode project.',
    );
  }
  return VideoRetouch.applyMaskedRetouch(videoPath, maskPath);
}
