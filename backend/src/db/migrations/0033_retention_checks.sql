-- Retention Intelligence (Pro tier): persists every retention-troubleshooting
-- submission (previously only the single latest retention_pct scalar on lash_maps was
-- kept — days_since_application/humidity_pct/glue_used/symptoms were used for one AI
-- call in POST /clients/:id/lash-maps/:mapId/retention-check and then discarded). This
-- table keeps the full history so per-client trends and cross-client "which lash set/
-- glue held up best" aggregates are possible.

CREATE TABLE retention_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lash_map_id uuid NOT NULL REFERENCES lash_maps(id) ON DELETE CASCADE,
  days_since_application integer NOT NULL,
  retention_pct numeric(5, 2) NOT NULL,
  humidity_pct numeric(5, 2),
  glue_used text,
  symptoms jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_retention_checks_lash_map_id ON retention_checks(lash_map_id);
