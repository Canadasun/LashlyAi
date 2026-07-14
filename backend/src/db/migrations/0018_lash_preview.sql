-- AI "after look" preview: a synthetic image edited from the client's real eye photo
-- to show the finished lash look for a chosen Lash Set/Lash Style. This persists a
-- generated image of a real, identifiable client's face, which is a different privacy
-- posture than the existing vision-analysis call (input photo, no image output kept) —
-- consented_by_user_id/consented_at record which technician confirmed client consent
-- before the preview was generated (see the mobile consent checkbox).

ALTER TABLE media_assets DROP CONSTRAINT media_assets_purpose_check;
ALTER TABLE media_assets ADD CONSTRAINT media_assets_purpose_check
  CHECK (purpose IN ('eye_analysis', 'photo_feedback', 'lash_preview'));

ALTER TABLE media_assets ADD COLUMN consented_by_user_id uuid REFERENCES users(id);
ALTER TABLE media_assets ADD COLUMN consented_at timestamptz;

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
    'lash_preview_generation'
  ));
