/**
 * GRC (Governance, Risk, Compliance) domain schema - re-exports GRC tables from the main schema.
 *
 * Includes: Controls, Risks, Incidents, Requirements, Tasks, Alerts, Documents,
 * Tax Filings, Licenses, Compliance Calendar, Business Profiles.
 */
export {
  // Controls
  grcControls,
  grcControlTests,
  // Risks
  grcRisks,
  // Incidents
  grcIncidents,
  // Business Profiles
  businessProfiles,
  // Requirements
  grcRequirements,
  grcRequirementEvaluations,
  // Tasks & Alerts
  grcTasks,
  grcAlerts,
  // Documents & Audit
  grcDocumentLinks,
  grcAuditLog,
  // Tax & Licensing
  grcTaxFilings,
  grcLicenses,
  grcComplianceCalendar,
  // Relations
  grcRequirementsRelations,
  grcTasksRelations,
  grcAlertsRelations,
  // Enums
  grcControlCategory,
  grcControlStatus,
  grcControlTestResult,
  grcRiskCategory,
  grcRiskStatus,
  grcIncidentCategory,
  grcIncidentSeverity,
  grcIncidentStatus,
  grcRequirementStatus,
  grcRequirementCategory,
  grcRequirementRiskLevel,
  grcTaskStatus,
  grcAlertStatus,
  grcAlertSeverity,
  grcLicenseStatus,
  grcTaxFilingStatus,
  grcRiskSeverity,
  // Types
  type BusinessProfile,
  type NewBusinessProfile,
  type GrcRequirement,
  type NewGrcRequirement,
  type GrcTask,
  type NewGrcTask,
  type GrcAlert,
  type NewGrcAlert,
  type GrcTaxFiling,
  type NewGrcTaxFiling,
  type GrcLicense,
  type NewGrcLicense,
} from "../schema";
