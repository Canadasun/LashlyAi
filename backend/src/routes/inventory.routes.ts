import { NextFunction, Router, Request, Response } from "express";
import { requireUser } from "./middleware/requireUser";
import {
  createInventoryItem,
  deleteInventoryItem,
  getInventoryItemById,
  getInventoryItemsByOwner,
  InventoryCategory,
  updateInventoryItem,
} from "../models/InventoryItem";
import { checkInventoryAccess } from "../services/planLimits.service";
import { asyncHandler } from "../utils/asyncHandler";

export const inventoryRouter = Router();

// Every route below is Salon-only (grandfathered Pro subscribers included, see
// hasSalonFeatureAccess) — applied once here rather than per-route since, unlike the
// quota-gated features elsewhere, all four inventory routes share the exact same flat
// access check (see checkInventoryAccess).
async function requireSalonForInventory(req: Request, res: Response, next: NextFunction) {
  const access = await checkInventoryAccess(req.currentUser!.id);
  if (!access.allowed) {
    res.status(403).json({ error: "Inventory tracking is a Salon feature. Upgrade to Salon to use it." });
    return;
  }
  next();
}
inventoryRouter.use(requireUser, asyncHandler(requireSalonForInventory));

const VALID_CATEGORIES: InventoryCategory[] = ["lash_trays", "glue", "tools", "other"];

const EXPIRING_SOON_WINDOW_DAYS = 30;

// pg returns `numeric` columns as strings to avoid float precision loss — must parse
// before comparing, or "20.00" <= "5.00" compares lexicographically (wrong: true).
function withStockAndExpiryFlags<
  T extends { quantity: number; low_stock_threshold: number; expiry_date: string | null },
>(item: T) {
  let isExpired = false;
  let isExpiringSoon = false;
  if (item.expiry_date) {
    const msUntilExpiry = new Date(item.expiry_date).getTime() - Date.now();
    isExpired = msUntilExpiry < 0;
    isExpiringSoon = !isExpired && msUntilExpiry <= EXPIRING_SOON_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  }
  return {
    ...item,
    is_low_stock: Number(item.quantity) <= Number(item.low_stock_threshold),
    is_expired: isExpired,
    is_expiring_soon: isExpiringSoon,
  };
}

async function loadOwnedItem(req: Request, res: Response) {
  const item = await getInventoryItemById(req.params.id);
  if (!item) {
    res.status(404).json({ error: "Inventory item not found" });
    return null;
  }
  if (item.owner_user_id !== req.currentUser!.id) {
    res.status(403).json({ error: "You do not own this inventory item" });
    return null;
  }
  return item;
}

inventoryRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const {
      name,
      category,
      quantity,
      unit,
      low_stock_threshold: lowStockThreshold,
      notes,
      expiry_date: expiryDate,
    } = req.body ?? {};

    if (!name || typeof name !== "string") {
      res.status(400).json({ error: "name is required" });
      return;
    }
    if (!VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` });
      return;
    }
    if (typeof quantity === "number" && quantity < 0) {
      res.status(400).json({ error: "quantity cannot be negative" });
      return;
    }
    if (typeof lowStockThreshold === "number" && lowStockThreshold < 0) {
      res.status(400).json({ error: "low_stock_threshold cannot be negative" });
      return;
    }

    const item = await createInventoryItem({
      ownerUserId: req.currentUser!.id,
      name,
      category,
      quantity: typeof quantity === "number" ? quantity : 0,
      unit: typeof unit === "string" && unit ? unit : "pieces",
      lowStockThreshold: typeof lowStockThreshold === "number" ? lowStockThreshold : 0,
      notes,
      expiryDate: typeof expiryDate === "string" ? expiryDate : null,
    });
    res.status(201).json(withStockAndExpiryFlags(item));
  }),
);

inventoryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const items = await getInventoryItemsByOwner(req.currentUser!.id);
    res.json(items.map(withStockAndExpiryFlags));
  }),
);

inventoryRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = await loadOwnedItem(req, res);
    if (!item) return;

    const {
      name,
      category,
      quantity,
      unit,
      low_stock_threshold: lowStockThreshold,
      notes,
      expiry_date: expiryDate,
    } = req.body ?? {};
    if (category !== undefined && !VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(", ")}` });
      return;
    }
    if (typeof quantity === "number" && quantity < 0) {
      res.status(400).json({ error: "quantity cannot be negative" });
      return;
    }
    if (typeof lowStockThreshold === "number" && lowStockThreshold < 0) {
      res.status(400).json({ error: "low_stock_threshold cannot be negative" });
      return;
    }

    const updated = await updateInventoryItem(item.id, {
      name,
      category,
      quantity,
      unit,
      lowStockThreshold,
      notes,
      expiryDate,
    });
    res.json(withStockAndExpiryFlags(updated));
  }),
);

inventoryRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const item = await loadOwnedItem(req, res);
    if (!item) return;

    await deleteInventoryItem(item.id);
    res.status(204).send();
  }),
);
