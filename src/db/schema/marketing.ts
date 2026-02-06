/**
 * Marketing domain schema - re-exports marketing-related tables from the main schema.
 *
 * Includes: Channels, Connectors, Analytics, Metrics, Insights, Plans, Campaigns,
 * What-If Scenarios, Manual Entries, Tasks, User Preferences.
 */
export {
  // Channels & Connectors
  marketingChannels,
  marketingConnectors,
  // Analytics
  marketingAnalyticsCards,
  marketingChannelMetrics,
  marketingChannelInsights,
  // Strategy
  marketingObjectives,
  marketingPlans,
  marketingCampaigns,
  marketingWhatIfScenarios,
  // Data Entry
  marketingManualEntries,
  // Insights & Tasks
  marketingInsights,
  marketingTasks,
  // Preferences
  marketingUserPreferences,
  // Enums
  marketingChannelType,
  marketingChannelStatus,
  connectorConnectionType,
  connectorSyncMode,
  analyticsCardScopeType,
  analyticsCardRenderType,
  marketingObjectiveType,
  marketingPlanStatus,
  marketingCampaignStatus,
  whatIfScenarioType,
  attributionModel,
  marketingTaskType,
  marketingTaskStatus,
} from "../schema";
