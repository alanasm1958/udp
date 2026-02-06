/**
 * HR & People domain schema - re-exports HR/payroll/performance tables from the main schema.
 *
 * Includes: Payroll (compliance, runs, lines, taxes, deductions), Leave Management,
 * Performance Reviews, HR Documents, HR Persons (Remodel 2).
 */
export {
  // Payroll Compliance
  jurisdictions,
  complianceRuleSets,
  taxTables,
  taxBrackets,
  deductionTypes,
  earningTypes,
  tenantComplianceProfiles,
  tenantTaxRegistrations,
  tenantDeductionConfigs,
  // Employees
  employees,
  employeeBankAccounts,
  compensationRecords,
  employeeDeductions,
  employeeLeaveBalances,
  // Leave Management
  leaveTypes,
  leaveRequests,
  leaveBalanceAdjustments,
  // Pay Schedules & Periods
  paySchedules,
  payPeriods,
  // Payroll Runs
  payrollRuns,
  payrollRunEmployees,
  payrollEarnings,
  payrollTaxes,
  payrollDeductions,
  payrollGlMappings,
  // Tax Filings
  taxFilingSchedules,
  taxFilings,
  taxDeposits,
  // Performance Management
  performanceCycles,
  performanceReviews,
  performanceReviewRatings,
  performanceGoals,
  // HR V2 - Addresses, Payroll V2, Performance V2
  peopleAddresses,
  payrollRunsV2,
  payrollRunLines,
  performanceReviewsV2,
  // HR Documents
  hrDocuments,
  hrDocumentLinks,
  hrAuditLog,
  // HR Remodel 2
  hrPersons,
  hrPayrollRuns,
  hrPayrollLines,
  hrPerformanceReviews,
  // Enums
  jurisdictionType,
  employmentStatus,
  employmentType,
  leaveAccrualType,
  performanceCycleFrequency,
  aiOutcomeCategory,
  // Types
  type PeopleAddress,
  type NewPeopleAddress,
  type PayrollRunV2,
  type NewPayrollRunV2,
  type PayrollRunLine,
  type NewPayrollRunLine,
  type PerformanceReviewV2,
  type NewPerformanceReviewV2,
  type HrDocument,
  type NewHrDocument,
  type HrDocumentLink,
  type NewHrDocumentLink,
  type HrAuditLogEntry,
  type NewHrAuditLogEntry,
  type HrPerson,
  type NewHrPerson,
  type HrPayrollRun,
  type NewHrPayrollRun,
  type HrPayrollLine,
  type NewHrPayrollLine,
  type HrPerformanceReview,
  type NewHrPerformanceReview,
} from "../schema";
