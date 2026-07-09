-- One subscription row per user, updated in place as their plan changes.

ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id);
