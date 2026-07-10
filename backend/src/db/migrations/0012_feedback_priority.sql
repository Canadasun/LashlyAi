-- Priority-support flag for Pro-tier accounts (target pricing spec's "Priority
-- support" perk had nothing behind it — this is the minimal version).

ALTER TABLE feedback ADD COLUMN is_priority boolean NOT NULL DEFAULT false;
