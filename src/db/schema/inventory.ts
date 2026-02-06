/**
 * Inventory domain schema - re-exports inventory-related tables from the main schema.
 *
 * Includes: Items Catalog, Warehouses, Storage Locations, Movements, Balances,
 * UOMs, Tax Categories, Products, Adjustments, Transfers.
 */
export {
  // Items Catalog
  items,
  itemIdentifiers,
  // Products (legacy)
  products,
  productIdentifiers,
  // Warehouses & Storage
  warehouses,
  storageLocations,
  // Inventory Movements
  inventoryMovements,
  inventoryBalances,
  inventoryPostingLinks,
  // Operations Inventory
  inventoryAdjustments,
  inventoryTransfers,
  returns,
  // Units & Tax
  uoms,
  taxCategories,
  // Enums
  itemType,
  itemExpiryPolicy,
  itemAvailability,
  productType,
  movementType,
  movementStatus,
} from "../schema";
