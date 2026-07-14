-- "Gate all tiers": photo feedback, lash map generation, retention check, forum
-- posts, and marketing caption/reply generation had no usage tracking or quota at
-- all (unlike coach_question/eye_scan/retention_check-the-event-type, which already
-- existed but had no quota check wired to it either). See planLimits.service.ts —
-- enforcement only actually blocks requests once ENFORCE_PLAN_LIMITS=true is set in
-- the environment, which should happen after this ships and is verified, not before.

ALTER TABLE usage_events DROP CONSTRAINT usage_events_event_type_check;
ALTER TABLE usage_events ADD CONSTRAINT usage_events_event_type_check
  CHECK (event_type IN (
    'coach_question',
    'eye_scan',
    'retention_check',
    'photo_feedback',
    'lash_map_generation',
    'forum_post',
    'marketing_generation'
  ));
