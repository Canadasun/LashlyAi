import { NativeModules } from 'react-native';

// A face's position/size/roll expressed as fractions of *its own* frame's width/
// height (0-1), not raw pixels — keeps values comparable across the reference photo,
// a live-recorded video, and a library-imported video even when they come from
// different-resolution sources. Mirrors VideoRetouch.swift's NormalizedBounds exactly
// (field names and shape matter here: this gets JSON.stringify'd and decoded on the
// Swift side with Codable, not hand-parsed).
export interface NormalizedFaceBounds {
  cx: number;
  cy: number;
  w: number;
  h: number;
  rollDeg: number;
}

export interface TrackingSample extends NormalizedFaceBounds {
  timeMs: number;
}

export interface TrackingData {
  referenceBounds: NormalizedFaceBounds;
  samples: TrackingSample[];
}

export interface ExtractFrameResult {
  path: string;
  durationMs: number;
}

interface VideoRetouchNativeModule {
  applyMaskedRetouch(videoPath: string, maskPath: string, trackingJson: string): Promise<string>;
  extractFrame(videoPath: string, atTimeMs: number): Promise<ExtractFrameResult>;
}

const { VideoRetouch } = NativeModules as { VideoRetouch?: VideoRetouchNativeModule };

export class VideoRetouchUnavailableError extends Error {}

function requireModule(): VideoRetouchNativeModule {
  if (!VideoRetouch) {
    throw new VideoRetouchUnavailableError(
      'Video Retouch native module is unavailable — rebuild the app after adding VideoRetouch.swift/.m to the Xcode project.',
    );
  }
  return VideoRetouch;
}

/**
 * Bakes a masked gaussian-blur skin-smoothing effect into a video, entirely on-device,
 * via the native VideoRetouch module (ios/LashlyAIMobile/VideoRetouch.swift —
 * AVFoundation + Core Image, no cloud AI call). maskPath must point to a PNG the same
 * aspect ratio as the reference frame it was painted against: opaque white = retouch
 * here, transparent/black = leave untouched. The lash/eye region must already be
 * excluded from the mask before calling this — see VideoRetouchScreen's paint canvas,
 * which enforces that at paint time.
 *
 * tracking is optional — pass it to track the mask (retouch marks and the baked-in
 * lash exclusion together) against face movement across the clip, interpolated
 * per-frame on the native side. Omit it (or pass undefined) to fall back to the
 * original v1 behavior: one static mask applied uniformly to every frame.
 *
 * Returns a file:// path to the retouched output video.
 */
export async function applyMaskedVideoRetouch(
  videoPath: string,
  maskPath: string,
  tracking?: TrackingData,
): Promise<string> {
  return requireModule().applyMaskedRetouch(videoPath, maskPath, tracking ? JSON.stringify(tracking) : '');
}

/**
 * Extracts a single still frame (JPEG) from any video file at the given timestamp,
 * plus the video's total duration. Used both to build a paintable reference frame
 * when a video is imported from the photo library (atTimeMs: 0) and, called
 * repeatedly at increasing timestamps, to sample face position across a clip for
 * applyMaskedVideoRetouch's tracking parameter.
 */
export async function extractVideoFrame(videoPath: string, atTimeMs: number): Promise<ExtractFrameResult> {
  return requireModule().extractFrame(videoPath, atTimeMs);
}
