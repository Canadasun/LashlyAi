-- LashlyAI v1 schema: users, client_profiles, lash_maps, subscriptions

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text,
  role text NOT NULL CHECK (role IN ('beginner', 'certified', 'educator', 'salon_owner', 'academy')),
  experience_level text,
  certifications text[] NOT NULL DEFAULT '{}',
  specialties text[] NOT NULL DEFAULT '{}',
  location text,
  preferred_styles text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE client_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  photos text[] NOT NULL DEFAULT '{}',
  eye_analysis jsonb,
  lash_history jsonb NOT NULL DEFAULT '[]',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_client_profiles_owner_user_id ON client_profiles(owner_user_id);

CREATE TABLE lash_maps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_profile_id uuid NOT NULL REFERENCES client_profiles(id) ON DELETE CASCADE,
  style text NOT NULL,
  curl text NOT NULL,
  lengths jsonb NOT NULL,
  diameter text NOT NULL,
  fan_type text NOT NULL,
  visual_map jsonb,
  retention_pct numeric(5, 2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_lash_maps_client_profile_id ON lash_maps(client_profile_id);

CREATE TABLE subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('free', 'pro', 'educator', 'salon', 'enterprise')),
  status text NOT NULL,
  apple_transaction_id text,
  renews_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
