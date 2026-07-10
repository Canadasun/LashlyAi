-- Expiry tracking for inventory items (glue especially — see docs/lash-rules.md §8,
-- open glue bottles have a short usable life regardless of quantity remaining).

ALTER TABLE inventory_items ADD COLUMN expiry_date date;
