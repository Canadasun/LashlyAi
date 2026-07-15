-- Sign in with Apple: stores the immutable Apple user identifier ("sub" claim in the
-- identity token), never the transient/relay email — that's read fresh off the token
-- claim on every sign-in and only used to populate users.email at account-creation time.
ALTER TABLE users ADD COLUMN apple_user_id TEXT UNIQUE;
