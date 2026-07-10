import { pool } from "../db";

export type InventoryCategory = "lash_trays" | "glue" | "tools" | "other";

export interface InventoryItem {
  id: string;
  owner_user_id: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  low_stock_threshold: number;
  notes: string | null;
  expiry_date: string | null;
  created_at: string;
  updated_at: string;
}

export async function createInventoryItem(input: {
  ownerUserId: string;
  name: string;
  category: InventoryCategory;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
  notes?: string;
  expiryDate?: string | null;
}): Promise<InventoryItem> {
  const result = await pool.query<InventoryItem>(
    `INSERT INTO inventory_items (owner_user_id, name, category, quantity, unit, low_stock_threshold, notes, expiry_date)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      input.ownerUserId,
      input.name,
      input.category,
      input.quantity,
      input.unit,
      input.lowStockThreshold,
      input.notes ?? null,
      input.expiryDate ?? null,
    ],
  );
  return result.rows[0];
}

export async function getInventoryItemsByOwner(ownerUserId: string): Promise<InventoryItem[]> {
  const result = await pool.query<InventoryItem>(
    "SELECT * FROM inventory_items WHERE owner_user_id = $1 ORDER BY name ASC",
    [ownerUserId],
  );
  return result.rows;
}

export async function getInventoryItemById(id: string): Promise<InventoryItem | null> {
  const result = await pool.query<InventoryItem>("SELECT * FROM inventory_items WHERE id = $1", [
    id,
  ]);
  return result.rows[0] ?? null;
}

export async function updateInventoryItem(
  id: string,
  updates: Partial<{
    name: string;
    category: InventoryCategory;
    quantity: number;
    unit: string;
    lowStockThreshold: number;
    notes: string;
    expiryDate: string | null;
  }>,
): Promise<InventoryItem> {
  const result = await pool.query<InventoryItem>(
    `UPDATE inventory_items
     SET name = COALESCE($2, name),
         category = COALESCE($3, category),
         quantity = COALESCE($4, quantity),
         unit = COALESCE($5, unit),
         low_stock_threshold = COALESCE($6, low_stock_threshold),
         notes = COALESCE($7, notes),
         expiry_date = COALESCE($8, expiry_date),
         updated_at = now()
     WHERE id = $1
     RETURNING *`,
    [
      id,
      updates.name ?? null,
      updates.category ?? null,
      updates.quantity ?? null,
      updates.unit ?? null,
      updates.lowStockThreshold ?? null,
      updates.notes ?? null,
      updates.expiryDate ?? null,
    ],
  );
  return result.rows[0];
}

export async function deleteInventoryItem(id: string): Promise<void> {
  await pool.query("DELETE FROM inventory_items WHERE id = $1", [id]);
}
