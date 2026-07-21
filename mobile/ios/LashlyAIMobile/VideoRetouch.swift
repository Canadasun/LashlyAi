import AVFoundation
import CoreImage
import Foundation
import React

/// On-device masked video retouch. Takes a recorded video plus a single static mask
/// image (painted by the artist on a freeze-frame in the mobile Video Retouch tool —
/// see VideoRetouchScreen.tsx) and re-exports the video with a gaussian-blur skin
/// smoothing effect blended in only where the mask is opaque. The lash/eye region is
/// never in the mask at all (VideoRetouchScreen enforces that at paint time), so this
/// module has no lash-specific logic of its own — it just respects whatever the mask
/// says, honestly.
///
/// Known v1 limitation: the mask is a single static image applied uniformly across
/// every frame, not tracked frame-by-frame against face movement. This works well for
/// a fairly stationary chairside recording (the intended use case) but will drift if
/// the client's head moves a lot during the clip — a real constraint, not a bug,
/// documented here so it isn't "discovered" later as a surprise.
@objc(VideoRetouch)
class VideoRetouch: NSObject {

  @objc
  static func requiresMainQueueSetup() -> Bool { false }

  @objc(applyMaskedRetouch:maskPath:resolve:reject:)
  func applyMaskedRetouch(
    _ videoPath: String,
    maskPath: String,
    resolve: @escaping RCTPromiseResolveBlock,
    reject: @escaping RCTPromiseRejectBlock
  ) {
    let videoURL = URL(fileURLWithPath: videoPath)
    let maskURL = URL(fileURLWithPath: maskPath)

    guard let maskImage = CIImage(contentsOf: maskURL) else {
      reject("E_MASK_LOAD_FAILED", "Could not load the paint mask image at \(maskPath)", nil)
      return
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
          let blurred = source
            .applyingGaussianBlur(sigma: 9)
            .cropped(to: request.sourceImage.extent)

          // Fit the mask (authored against the freeze-frame's own dimensions) onto
          // this frame's extent. A straight scale, not a perspective transform — the
          // freeze frame and every other frame in the same video share one aspect
          // ratio and orientation.
          let scaleX = request.sourceImage.extent.width / maskImage.extent.width
          let scaleY = request.sourceImage.extent.height / maskImage.extent.height
          let fittedMask = maskImage.transformed(by: CGAffineTransform(scaleX: scaleX, y: scaleY))

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
