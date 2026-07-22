import AVFoundation
import CoreImage
import Foundation
import React
import UIKit

/// On-device masked video retouch. Takes a video (live-recorded or imported from the
/// photo library — see VideoRetouchScreen.tsx) plus a static mask image (painted by the
/// artist on a freeze-frame) and re-exports the video with a gaussian-blur skin
/// smoothing effect blended in only where the mask is opaque. The lash/eye region is
/// never in the mask at all (VideoRetouchScreen enforces that at paint time), so this
/// module has no lash-specific logic of its own — it just respects whatever the mask
/// says, honestly.
///
/// Frame-by-frame tracking: the mask is authored once, against a single reference
/// frame, but the client's head can move during the clip. `applyMaskedRetouch` accepts
/// an optional `trackingJson` — a JSON-encoded `{ referenceBounds, samples }` built by
/// VideoRetouchScreen from periodic on-device face detections across the actual video
/// (see extractFrame below, which VideoRetouchScreen calls repeatedly to sample it).
/// Each output frame looks up the two bracketing samples for its own timestamp,
/// linearly interpolates between them, and applies a rigid transform (translate +
/// uniform scale + in-plane rotation) that moves the whole mask — retouch marks and
/// the excluded lash zone together, since the exclusion is baked into the same mask —
/// to track the face's position at that instant, anchored against where the face was
/// in the reference frame. This is a 2D affine approximation (translation, scale for
/// distance, in-plane roll), not full 3D head-pose tracking — it holds up well for
/// normal chairside movement (shifting, leaning, tilting) but won't follow a full
/// turn to profile. If `trackingJson` is empty/absent, this falls back to the original
/// v1 behavior: one static mask applied uniformly to every frame.
@objc(VideoRetouch)
class VideoRetouch: NSObject {

  @objc
  static func requiresMainQueueSetup() -> Bool { false }

  // MARK: - Frame extraction (reference-frame import + tracking samples)

  /// Extracts a single still frame from any video file at the given timestamp, plus
  /// the video's total duration — used both to build a paintable reference frame when
  /// a video is imported from the photo library (atTimeMs: 0) and, called repeatedly
  /// at increasing timestamps, to sample face position across the clip for tracking
  /// (see VideoRetouchScreen's runProcessing).
  @objc(extractFrame:atTimeMs:resolve:reject:)
  func extractFrame(
    _ videoPath: String,
    atTimeMs: Double,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let videoURL = URL(fileURLWithPath: videoPath)
    let asset = AVURLAsset(url: videoURL)

    Task {
      do {
        let durationSeconds = try await asset.load(.duration).seconds
        guard durationSeconds.isFinite, durationSeconds > 0 else {
          reject("E_NO_DURATION", "Could not read a valid duration for this video.", nil)
          return
        }

        let generator = AVAssetImageGenerator(asset: asset)
        generator.appliesPreferredTrackTransform = true
        generator.requestedTimeToleranceBefore = .zero
        generator.requestedTimeToleranceAfter = .zero

        let clampedMs = max(0, min(atTimeMs, durationSeconds * 1000))
        let time = CMTime(seconds: clampedMs / 1000, preferredTimescale: 600)

        // generateCGImagesAsynchronously(forTimes:), not the iOS 16+-only image(at:)
        // async API — this project's deployment target is iOS 15.5 (see
        // IPHONEOS_DEPLOYMENT_TARGET in the Xcode project), so the older
        // completion-handler API is what's actually available, wrapped here for
        // async/await ergonomics. Requesting a single-element times array means the
        // handler fires exactly once, safe to pair with a single continuation.
        let cgImage = try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<CGImage, Error>) in
          generator.generateCGImagesAsynchronously(forTimes: [NSValue(time: time)]) { _, image, _, result, error in
            if let image = image, result == .succeeded {
              continuation.resume(returning: image)
            } else {
              continuation.resume(
                throwing: error ?? NSError(
                  domain: "VideoRetouch",
                  code: -1,
                  userInfo: [NSLocalizedDescriptionKey: "Frame generation did not succeed (result \(result.rawValue))"]
                )
              )
            }
          }
        }

        let uiImage = UIImage(cgImage: cgImage)
        guard let jpegData = uiImage.jpegData(compressionQuality: 0.9) else {
          reject("E_ENCODE_FAILED", "Could not encode the extracted frame as JPEG.", nil)
          return
        }

        let outputURL = FileManager.default.temporaryDirectory
          .appendingPathComponent(UUID().uuidString)
          .appendingPathExtension("jpg")
        try jpegData.write(to: outputURL)

        resolve([
          "path": outputURL.path,
          "durationMs": durationSeconds * 1000,
        ])
      } catch {
        reject("E_EXTRACT_FAILED", error.localizedDescription, error)
      }
    }
  }

  // MARK: - Tracking data model (mirrors the JSON VideoRetouchScreen builds)

  private struct NormalizedBounds: Codable {
    let cx: Double
    let cy: Double
    let w: Double
    let h: Double
    let rollDeg: Double
  }

  private struct TrackingSample: Codable {
    let timeMs: Double
    let cx: Double
    let cy: Double
    let w: Double
    let h: Double
    let rollDeg: Double
  }

  private struct TrackingData: Codable {
    let referenceBounds: NormalizedBounds
    let samples: [TrackingSample]
  }

  /// Linear interpolation between the two samples bracketing `t`, clamped to the first/
  /// last sample outside that range. Samples are expected pre-sorted ascending by
  /// timeMs (VideoRetouchScreen appends them in capture order). Static and stateless
  /// so the per-frame composition closure below doesn't need to capture `self` at all.
  private static func interpolatedBounds(_ samples: [TrackingSample], at t: Double) -> NormalizedBounds? {
    guard let first = samples.first, let last = samples.last else { return nil }
    if t <= first.timeMs {
      return NormalizedBounds(cx: first.cx, cy: first.cy, w: first.w, h: first.h, rollDeg: first.rollDeg)
    }
    if t >= last.timeMs {
      return NormalizedBounds(cx: last.cx, cy: last.cy, w: last.w, h: last.h, rollDeg: last.rollDeg)
    }
    for i in 0..<(samples.count - 1) {
      let a = samples[i]
      let b = samples[i + 1]
      if t >= a.timeMs && t <= b.timeMs {
        let span = b.timeMs - a.timeMs
        let frac = span > 0 ? (t - a.timeMs) / span : 0
        return NormalizedBounds(
          cx: a.cx + (b.cx - a.cx) * frac,
          cy: a.cy + (b.cy - a.cy) * frac,
          w: a.w + (b.w - a.w) * frac,
          h: a.h + (b.h - a.h) * frac,
          rollDeg: a.rollDeg + (b.rollDeg - a.rollDeg) * frac
        )
      }
    }
    return nil
  }

  // MARK: - Retouch export

  @objc(applyMaskedRetouch:maskPath:trackingJson:resolve:reject:)
  func applyMaskedRetouch(
    _ videoPath: String,
    maskPath: String,
    trackingJson: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let videoURL = URL(fileURLWithPath: videoPath)
    let maskURL = URL(fileURLWithPath: maskPath)

    guard let maskImage = CIImage(contentsOf: maskURL) else {
      reject("E_MASK_LOAD_FAILED", "Could not load the paint mask image at \(maskPath)", nil)
      return
    }

    // Parsed once up front, not per-frame — trackingJson is small (a few dozen
    // samples at most) but there's no reason to re-parse it on every one of a video's
    // frames. Empty/unparseable JSON just means "no tracking data" — falls back to
    // the original static-mask behavior rather than failing the whole export, since a
    // tracking pass that found zero usable samples (e.g. detection failed throughout)
    // shouldn't block the retouch entirely.
    var trackingData: TrackingData?
    if !trackingJson.isEmpty, let data = trackingJson.data(using: .utf8) {
      trackingData = try? JSONDecoder().decode(TrackingData.self, from: data)
    }

    let asset = AVURLAsset(url: videoURL)

    Task {
      do {
        guard let videoTrack = try await asset.loadTracks(withMediaType: .video).first else {
          reject("E_NO_VIDEO_TRACK", "The recorded file has no video track.", nil)
          return
        }
        let naturalSize = try await videoTrack.load(.naturalSize)

        let videoComposition = AVMutableVideoComposition(asset: asset) { request in
          let source = request.sourceImage.clampedToExtent()
          let frameExtent = request.sourceImage.extent
          let blurred = source
            .applyingGaussianBlur(sigma: 9)
            .cropped(to: frameExtent)

          // Baseline fit: the mask is authored against the reference frame's own
          // resolution, which can differ from the video's — this scale alone (no
          // tracking) is exactly the original v1 behavior.
          let baselineScaleX = frameExtent.width / maskImage.extent.width
          let baselineScaleY = frameExtent.height / maskImage.extent.height
          var fittedMask = maskImage.transformed(by: CGAffineTransform(scaleX: baselineScaleX, y: baselineScaleY))

          if let tracking = trackingData {
            let tMs = request.compositionTime.seconds * 1000
            if let sample = VideoRetouch.interpolatedBounds(tracking.samples, at: tMs) {
              let ref = tracking.referenceBounds
              // Defensive floor: referenceBounds only ever comes from a successful
              // on-device detection (VideoRetouchScreen doesn't send tracking data
              // otherwise), so this shouldn't be near-zero in practice — guards
              // against a divide-by-near-zero blowing up every frame's export if it
              // somehow were.
              let refW = max(ref.w, 0.001)
              let refH = max(ref.h, 0.001)
              let correctionScaleX = sample.w / refW
              let correctionScaleY = sample.h / refH
              // cx/cy/w/h are fractions of *their own* frame's dimensions, so a delta
              // between two normalized values converts directly into this frame's own
              // pixel space by multiplying by this frame's own extent — no
              // cross-resolution unit mismatch between the reference frame and this
              // video frame, even if they came from different-resolution sources
              // (e.g. a library-imported video vs. the live-captured reference photo).
              let dxPixels = (sample.cx - ref.cx) * frameExtent.width
              let dyPixels = (sample.cy - ref.cy) * frameExtent.height
              // NOTE — not verified on a real device: this assumes face.rollAngle's
              // sign matches CGAffineTransform.rotated(by:)'s convention once applied
              // to a CIImage already known (from the pre-existing baseline scale-only
              // fit) to align with camera-frame content with no manual Y-flip. If a
              // real-device test shows the mask rotating the wrong way as the head
              // tilts, negate rotationRadians here — translation and scale tracking
              // are unaffected by that sign either way.
              let rotationRadians = (sample.rollDeg - ref.rollDeg) * .pi / 180

              let pivotX = ref.cx * fittedMask.extent.width + fittedMask.extent.origin.x
              let pivotY = ref.cy * fittedMask.extent.height + fittedMask.extent.origin.y

              var transform = CGAffineTransform(translationX: pivotX, y: pivotY)
              transform = transform.rotated(by: rotationRadians)
              transform = transform.scaledBy(x: correctionScaleX, y: correctionScaleY)
              transform = transform.translatedBy(x: -pivotX, y: -pivotY)
              transform = transform.concatenating(CGAffineTransform(translationX: dxPixels, y: dyPixels))

              fittedMask = fittedMask.transformed(by: transform)
            }
          }

          let blended = blurred.applyingFilter("CIBlendWithMask", parameters: [
            kCIInputBackgroundImageKey: source,
            kCIInputMaskImageKey: fittedMask,
          ])

          request.finish(with: blended, context: nil)
        }
        videoComposition.renderSize = naturalSize
        videoComposition.frameDuration = CMTime(value: 1, timescale: 30)

        guard
          let exportSession = AVAssetExportSession(asset: asset, presetName: AVAssetExportPresetHighestQuality)
        else {
          reject("E_EXPORT_SESSION", "Could not create an export session for this video.", nil)
          return
        }

        let outputURL = FileManager.default.temporaryDirectory
          .appendingPathComponent(UUID().uuidString)
          .appendingPathExtension("mp4")
        exportSession.outputURL = outputURL
        exportSession.outputFileType = .mp4
        exportSession.videoComposition = videoComposition

        await exportSession.export()

        switch exportSession.status {
        case .completed:
          resolve(outputURL.path)
        case .failed, .cancelled:
          reject(
            "E_EXPORT_FAILED",
            exportSession.error?.localizedDescription ?? "Video export failed for an unknown reason.",
            exportSession.error
          )
        default:
          reject("E_EXPORT_INCOMPLETE", "Video export ended in an unexpected state.", nil)
        }
      } catch {
        reject("E_UNKNOWN", error.localizedDescription, error)
      }
    }
  }
}
