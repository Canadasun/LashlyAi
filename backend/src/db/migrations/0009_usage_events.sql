-- Tracks usage against Free-tier quotas (5 client profiles, 5 coach questions/day,
-- 3 eye scans/month). See backend/src/services/planLimits.service.ts — enforcement is
-- gated behind ENFORCE_PLAN_LIMITS (default off during testing per owner instruction),
-- so this only tracks for now; nothing is blocked yet.

CREATE TABLE usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('coach_question', 'eye_scan')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_usage_events_user_id_type ON usage_events(user_id, event_type);
