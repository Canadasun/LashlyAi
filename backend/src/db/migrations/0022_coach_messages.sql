-- AI Lash Coach conversation history — saved for Pro users only (see coach.routes.ts);
-- free tier stays ephemeral/session-only, same as before this migration.
CREATE TABLE coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'coach')),
  text text NOT NULL,
  mock boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_coach_messages_owner_user_id ON coach_messages(owner_user_id, created_at);
