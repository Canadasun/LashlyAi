-- On-device manual video retouch (Skia paint mask + native AVFoundation masked blur
-- export, no AI call — see storage.service.ts uploadVideo) — new media content types,
-- purpose, and usage event, distinct from every prior purpose which was image-only.

ALTER TABLE media_assets DROP CONSTRAINT media_assets_content_type_check;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_content_type_check
  CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/quicktime'));

-- Video files are far larger than the 10MB photo cap; 200MB comfortably covers a
-- short (under ~2 minute) chairside before/after clip at phone-camera bitrates.
ALTER TABLE media_assets DROP CONSTRAINT media_assets_byte_size_check;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_byte_size_check
  CHECK (byte_size > 0 AND byte_size <= 209715200);

ALTER TABLE media_assets DROP CONSTRAINT media_assets_purpose_check;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_purpose_check
  CHECK (purpose IN (
    'eye_analysis', 'photo_feedback', 'lash_preview', 'photo_edit', 'photo_retouch', 'video_retouch'
  ));

ALTER TABLE usage_events DROP CONSTRAINT usage_events_event_type_check;
ALTER TABLE usage_events ADD CONSTRAINT usage_events_event_type_check
  CHECK (event_type IN (
    'coach_question',
    'eye_scan',
    'retention_check',
    'photo_feedback',
    'lash_map_generation',
    'forum_post',
    'marketing_generation',
    'lash_preview_generation',
    'photo_edit',
    'photo_retouch_generation',
    'video_retouch'
  ));
