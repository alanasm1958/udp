/**
 * Operations domain schema - re-exports operations tables from the main schema.
 *
 * Includes: Ops Payments, Offices, Office Assets, Asset Transfers, Maintenance.
 */
export {
  // Operations Payments
  opsPayments,
  // Offices
  offices,
  officeAssets,
  // Asset Management
  assetTransfers,
  assetMaintenanceSchedules,
  // Enums
  opsDomain,
  officeType,
  officeStatus,
  assetTransferType,
  assetCondition,
  maintenanceType,
  maintenancePriority,
  maintenanceStatus,
  // Types
  type Office,
  type NewOffice,
  type OfficeAsset,
  type NewOfficeAsset,
  type AssetTransfer,
  type NewAssetTransfer,
  type AssetMaintenanceSchedule,
  type NewAssetMaintenanceSchedule,
} from "../schema";
