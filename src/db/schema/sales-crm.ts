/**
 * Sales CRM domain schema - re-exports CRM-related tables from the main schema.
 *
 * Includes: Leads, Salespersons, Activities, Customer Health, AI Sales Tasks.
 */
export {
  // Leads & Salespersons
  leads,
  salespersons,
  userCardPreferences,
  // Activities & Health
  salesActivities,
  customerHealthScores,
  // AI Sales
  aiSalesTasks,
  aiSalesScanLogs,
  // Enums
  leadStatus,
  salesActivityType,
  activityOutcome,
  riskLevel,
  scoreTrend,
  aiSalesTaskPriority,
  aiSalesTaskStatus,
  aiSalesTaskType,
  // Types
  type SalesActivity,
  type NewSalesActivity,
  type CustomerHealthScore,
  type NewCustomerHealthScore,
  type AISalesTask,
  type NewAISalesTask,
  type AISalesScanLog,
  type NewAISalesScanLog,
} from "../schema";
