-- Inventory tracking (Pro tier): lash trays, glue, tools, and other supplies.

CREATE TABLE inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL CHECK (category IN ('lash_trays', 'glue', 'tools', 'other')),
  quantity numeric(10, 2) NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'pieces',
  low_stock_threshold numeric(10, 2) NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_inventory_items_owner_user_id ON inventory_items(owner_user_id);
