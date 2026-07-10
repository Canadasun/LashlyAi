-- Additive presentation layer for lash maps: combined style/curl labels, spike
-- lengths for textured techniques, and an Inner/Middle/Outer client-friendly zone
-- summary. Nullable on purpose — existing rows predate this and get a computed
-- fallback in the application layer (see LashMap.ts) rather than a backfill.

ALTER TABLE lash_maps ADD COLUMN presentation jsonb;
