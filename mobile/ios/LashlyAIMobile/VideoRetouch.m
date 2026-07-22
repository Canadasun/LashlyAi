#import <React/RCTBridgeModule.h>

// Bridges the Swift VideoRetouch class (VideoRetouch.swift) into RN's classic native
// module registry. No bridging header needed for this direction — Xcode auto-generates
// the "LashlyAIMobile-Swift.h" interface for Swift classes marked @objc within the
// same target.
@interface RCT_EXTERN_MODULE(VideoRetouch, NSObject)

RCT_EXTERN_METHOD(applyMaskedRetouch:(NSString *)videoPath
                  maskPath:(NSString *)maskPath
                  trackingJson:(NSString *)trackingJson
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(extractFrame:(NSString *)videoPath
                  atTimeMs:(double)atTimeMs
                  resolve:(RCTPromiseResolveBlock)resolve
                  reject:(RCTPromiseRejectBlock)reject)

@end
