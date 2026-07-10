-- Retention-check calls the OpenAI API (real cost now that a key is configured) but
-- had no usage tracking at all, unlike coach_question/eye_scan. Adds it to the
-- existing usage_events check constraint.

ALTER TABLE usage_events DROP CONSTRAINT usage_events_event_type_check;
ALTER TABLE usage_events ADD CONSTRAINT usage_events_event_type_check
  CHECK (event_type IN ('coach_question', 'eye_scan', 'retention_check'));
