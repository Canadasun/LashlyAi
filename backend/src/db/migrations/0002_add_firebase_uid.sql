-- Link Postgres users to their Firebase Authentication identity.
-- password_hash stays for now but is unused when Firebase is the identity source of truth.

ALTER TABLE users ADD COLUMN firebase_uid text UNIQUE;
