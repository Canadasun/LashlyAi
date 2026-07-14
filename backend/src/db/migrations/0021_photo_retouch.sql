-- AI-based photo retouching (skin smoothing / blemish & redness reduction via an
-- OpenAI image-edit call, distinct from the free client-side Skia photo_edit tool) —
-- new media purpose + usage tracking so its real per-call OpenAI cost is metered
-- separately from the zero-AI-cost local-compute photo editor export.

ALTER TABLE media_assets DROP CONSTRAINT media_assets_purpose_check;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_purpose_check
  CHECK (purpose IN ('eye_analysis', 'photo_feedback', 'lash_preview', 'photo_edit', 'photo_retouch'));

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
    'photo_retouch_generation'
  ));
