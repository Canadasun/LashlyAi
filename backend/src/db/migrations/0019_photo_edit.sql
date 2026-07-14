-- Paid photo editor (filters/presets applied client-side via Skia, then uploaded as
-- the final high-res export) — new media purpose + usage tracking, distinct from
-- photo_feedback (an AI-scored "Score My Work" upload).

ALTER TABLE media_assets DROP CONSTRAINT media_assets_purpose_check;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_purpose_check
  CHECK (purpose IN ('eye_analysis', 'photo_feedback', 'lash_preview', 'photo_edit'));

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
    'photo_edit'
  ));
