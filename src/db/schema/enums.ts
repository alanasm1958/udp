import { pgEnum } from "drizzle-orm/pg-core";

/* ============================================================================
   CORE ENUMS
   ============================================================================ */

export const actorType = pgEnum("actor_type", ["user", "system", "connector"]);
export const transactionSetStatus = pgEnum("transaction_set_status", ["draft", "review", "posted"]);
export const approvalStatus = pgEnum("approval_status", ["pending", "approved", "rejected"]);
export const partyType = pgEnum("party_type", ["customer", "vendor", "employee", "bank", "government", "other"]);
export const productType = pgEnum("product_type", ["good", "service"]);
export const movementType = pgEnum("movement_type", ["receipt", "issue", "transfer", "adjustment"]);
export const movementStatus = pgEnum("movement_status", ["draft", "posted", "reversed"]);
export const purchaseReceiptType = pgEnum("purchase_receipt_type", ["receive", "unreceive", "return_to_vendor"]);
export const subscriptionStatus = pgEnum("subscription_status", ["none", "trialing", "active", "past_due", "canceled", "expired"]);
export const billingType = pgEnum("billing_type", ["recurring", "trial"]);
export const accountType = pgEnum("account_type", [
  "asset",
  "liability",
  "equity",
  "income",
  "expense",
  "contra_asset",
  "contra_liability",
  "contra_equity",
  "contra_income",
  "contra_expense",
]);

/* Document Enums */
export const documentCategory = pgEnum("document_category", [
  "id",
  "contract",
  "certificate",
  "visa",
  "license",
  "policy",
  "tax",
  "other",
]);

export const documentVerificationStatus = pgEnum("document_verification_status", [
  "pending",
  "verified",
  "rejected",
  "expired",
]);

/* Task & Alert Enums */
export const taskStatus = pgEnum("task_status", [
  "open",
  "done",
  "dismissed",
]);

export const taskPriority = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const taskDomain = pgEnum("task_domain", [
  "operations",
  "sales",
  "finance",
  "hr",
  "marketing",
]);

export const taskAssignedRole = pgEnum("task_assigned_role", [
  "sme_owner",
  "operations_user",
]);

export const alertSeverity = pgEnum("alert_severity", [
  "info",
  "warning",
  "critical",
]);

/* Master Task & Alert Enums */
export const masterTaskCategory = pgEnum("master_task_category", [
  "standard",
  "compliance",
  "marketing",
  "ai_suggestion",
]);

export const masterTaskStatus = pgEnum("master_task_status", [
  "open",
  "in_progress",
  "blocked",
  "in_review",
  "completed",
  "cancelled",
  "auto_resolved",
  "approved",
  "rejected",
  "expired",
]);

export const masterTaskPriority = pgEnum("master_task_priority", [
  "low",
  "normal",
  "high",
  "urgent",
  "critical",
]);

export const masterAlertCategory = pgEnum("master_alert_category", [
  "standard",
  "compliance",
]);

export const masterAlertStatus = pgEnum("master_alert_status", [
  "active",
  "acknowledged",
  "resolved",
  "dismissed",
]);

export const masterAlertSeverity = pgEnum("master_alert_severity", [
  "info",
  "warning",
  "critical",
]);

export const masterAlertSource = pgEnum("master_alert_source", [
  "system",
  "ai",
  "connector",
  "user",
]);

/* ============================================================================
   FINANCE ENUMS
   ============================================================================ */

export const paymentType = pgEnum("payment_type", ["receipt", "payment"]);
export const paymentMethod = pgEnum("payment_method", ["cash", "bank"]);
export const paymentStatus = pgEnum("payment_status", ["draft", "posted", "void"]);
export const paymentAllocationTargetType = pgEnum("payment_allocation_target_type", ["sales_doc", "purchase_doc"]);

export const prepaidExpenseStatus = pgEnum("prepaid_expense_status", [
  "active",
  "fully_amortized",
  "cancelled",
]);

export const amortizationFrequency = pgEnum("amortization_frequency", [
  "monthly",
  "quarterly",
]);

export const amortizationStatus = pgEnum("amortization_status", [
  "scheduled",
  "posted",
  "skipped",
]);

export const deferredRevenueStatus = pgEnum("deferred_revenue_status", [
  "pending",
  "partially_recognized",
  "recognized",
  "refunded",
]);

export const recognitionTrigger = pgEnum("recognition_trigger", [
  "manual",
  "completion",
  "schedule",
]);

export const fixedAssetStatus = pgEnum("fixed_asset_status", [
  "active",
  "fully_depreciated",
  "disposed",
]);

export const depreciationMethodEnum = pgEnum("depreciation_method", [
  "straight_line",
  "none",
]);

export const depreciationEntryStatus = pgEnum("depreciation_entry_status", [
  "scheduled",
  "posted",
  "skipped",
]);

export const periodStatus = pgEnum("period_status", [
  "open",
  "soft_closed",
  "hard_closed",
]);

export const reconciliationStatus = pgEnum("reconciliation_status", [
  "in_progress",
  "completed",
  "abandoned",
]);

export const statementLineStatus = pgEnum("statement_line_status", [
  "unmatched",
  "matched",
  "excluded",
]);

export const expenseAccrualStatus = pgEnum("expense_accrual_status", [
  "accrued",
  "paid",
  "reversed",
]);

export const recurringFrequency = pgEnum("recurring_frequency", [
  "weekly",
  "biweekly",
  "monthly",
  "quarterly",
  "yearly",
]);

export const recurringTransactionStatus = pgEnum("recurring_transaction_status", [
  "active",
  "paused",
  "cancelled",
  "completed",
]);

export const recurringTransactionType = pgEnum("recurring_transaction_type", [
  "expense",
  "transfer",
  "payment",
]);

export const followUpEscalationLevel = pgEnum("follow_up_escalation_level", [
  "reminder",
  "first_notice",
  "second_notice",
  "final_notice",
  "collections",
]);

export const followUpStatus = pgEnum("follow_up_status", [
  "pending",
  "in_progress",
  "contacted",
  "promised",
  "completed",
  "skipped",
]);

/* ============================================================================
   SALES ENUMS
   ============================================================================ */

export const leadStatus = pgEnum("lead_status", [
  "new",
  "contacted",
  "qualified",
  "disqualified",
  "won",
  "lost",
]);

export const salesActivityType = pgEnum("sales_activity_type", [
  "phone_call",
  "email_sent",
  "email_received",
  "meeting",
  "site_visit",
  "quote_sent",
  "quote_followed_up",
  "order_received",
  "order_confirmed",
  "delivery_scheduled",
  "delivery_completed",
  "payment_reminder_sent",
  "customer_issue",
  "deal_won",
  "deal_lost",
  "note",
]);

export const activityOutcome = pgEnum("activity_outcome", [
  "connected_successful",
  "connected_needs_followup",
  "voicemail",
  "no_answer",
  "wrong_number",
  "very_positive",
  "positive",
  "neutral",
  "negative",
  "resolved",
  "escalated",
  "investigating",
  "pending_followup",
]);

export const riskLevel = pgEnum("risk_level", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const scoreTrend = pgEnum("score_trend", [
  "improving",
  "stable",
  "declining",
]);

export const aiSalesTaskPriority = pgEnum("ai_sales_task_priority", ["low", "medium", "high", "critical"]);

export const aiSalesTaskStatus = pgEnum("ai_sales_task_status", ["pending", "in_progress", "completed", "dismissed", "snoozed"]);

export const aiSalesTaskType = pgEnum("ai_sales_task_type", [
  "follow_up_lead",
  "follow_up_quote",
  "follow_up_customer",
  "payment_reminder",
  "at_risk_customer",
  "hot_lead",
  "quote_expiring",
  "reactivate_customer",
  "upsell_opportunity",
  "churn_prevention",
]);

/* ============================================================================
   PROCUREMENT ENUMS
   ============================================================================ */

export const serviceJobStatus = pgEnum("service_job_status", [
  "pending",
  "assigned",
  "acknowledged",
  "in_progress",
  "delivered",
  "completed",
  "cancelled",
]);

/* ============================================================================
   INVENTORY ENUMS
   ============================================================================ */

export const itemType = pgEnum("item_type", [
  "product",
  "service",
  "consumable",
  "asset",
]);

export const itemExpiryPolicy = pgEnum("item_expiry_policy", [
  "none",
  "required",
  "optional",
]);

export const itemAvailability = pgEnum("item_availability", [
  "available",
  "unavailable",
]);

export const categoryDomain = pgEnum("category_domain", ["product", "party", "service", "generic"]);

export const returnType = pgEnum("return_type", [
  "customer_return",
  "supplier_return",
]);

/* ============================================================================
   HR ENUMS
   ============================================================================ */

export const personType = pgEnum("person_type", [
  "staff",
  "contractor",
  "supplier_contact",
  "sales_rep",
  "service_provider",
  "partner_contact",
  "customer_contact",
]);

export const contactChannel = pgEnum("contact_channel", [
  "whatsapp",
  "email",
  "phone",
  "sms",
]);

export const jurisdictionType = pgEnum("jurisdiction_type", ["country", "state", "province", "territory", "local"]);
export const employmentStatus = pgEnum("employment_status", ["active", "on_leave", "suspended", "terminated", "retired"]);
export const employmentType = pgEnum("employment_type", ["full_time", "part_time", "contractor", "temp", "intern"]);
export const flsaStatus = pgEnum("flsa_status", ["exempt", "non_exempt"]);
export const payType = pgEnum("pay_type", ["salary", "hourly", "commission"]);
export const payFrequency = pgEnum("pay_frequency", ["weekly", "biweekly", "semimonthly", "monthly"]);
export const compensationChangeReason = pgEnum("compensation_change_reason", ["hire", "promotion", "annual_review", "adjustment", "demotion", "transfer"]);
export const deductionCalcMethod = pgEnum("deduction_calc_method", ["fixed", "percent_gross", "percent_net"]);
export const payrollRunStatus = pgEnum("payroll_run_status", ["draft", "calculating", "calculated", "reviewing", "approved", "posting", "posted", "paid", "void"]);
export const payrollRunType = pgEnum("payroll_run_type", ["regular", "bonus", "correction", "final"]);
export const taxCalcMethod = pgEnum("tax_calc_method", ["bracket", "flat_rate", "wage_base", "formula"]);
export const filingFrequency = pgEnum("filing_frequency", ["monthly", "quarterly", "annual"]);
export const taxFilingStatus = pgEnum("tax_filing_status", ["pending", "in_progress", "submitted", "accepted", "rejected", "amended"]);
export const taxDepositStatus = pgEnum("tax_deposit_status", ["pending", "submitted", "confirmed", "rejected"]);
export const bankAccountTypeEnum = pgEnum("bank_account_type", ["checking", "savings"]);
export const depositType = pgEnum("deposit_type", ["percent", "fixed", "remainder"]);
export const taxRegistrationStatus = pgEnum("tax_registration_status", ["pending", "active", "suspended", "closed"]);

export const leaveAccrualType = pgEnum("leave_accrual_type", [
  "manual",
  "monthly",
  "annual",
  "per_period",
]);

export const leaveRequestStatus = pgEnum("leave_request_status", [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "taken",
]);

export const performanceCycleFrequency = pgEnum("performance_cycle_frequency", [
  "quarterly",
  "semi_annual",
  "annual",
  "custom",
]);

export const performanceCycleStatus = pgEnum("performance_cycle_status", [
  "planned",
  "active",
  "completed",
  "cancelled",
]);

export const performanceReviewStatus = pgEnum("performance_review_status", [
  "not_started",
  "in_progress",
  "submitted",
  "approved",
  "cancelled",
]);

export const performanceGoalStatus = pgEnum("performance_goal_status", [
  "not_started",
  "in_progress",
  "completed",
  "deferred",
  "cancelled",
]);

export const aiOutcomeCategory = pgEnum("ai_outcome_category", [
  "outstanding_contribution",
  "strong_performance",
  "solid_on_track",
  "below_expectations",
  "critical_concerns",
]);

export const payrollRunStatusV2 = pgEnum("payroll_run_status_v2", [
  "draft",
  "posted",
  "voided",
]);

export const reviewVisibility = pgEnum("review_visibility", [
  "visible_to_employee",
  "manager_only",
  "hr_only",
]);

export const hrDocumentCategory = pgEnum("hr_document_category", [
  "contract",
  "id_proof",
  "qualification",
  "certification",
  "visa_work_permit",
  "insurance",
  "tax_form",
  "bank_details",
  "other",
]);

export const hrDocumentAccessScope = pgEnum("hr_document_access_scope", [
  "employee_self",
  "manager",
  "hr_only",
  "public",
]);

/* ============================================================================
   MARKETING ENUMS
   ============================================================================ */

export const marketingChannelType = pgEnum("marketing_channel_type", [
  "social",
  "email",
  "messaging",
  "ads",
  "website_analytics",
  "sms",
  "offline",
  "agency",
  "influencer",
]);

export const marketingChannelStatus = pgEnum("marketing_channel_status", [
  "connected",
  "disconnected",
  "partial",
  "error",
  "manual",
]);

export const connectorConnectionType = pgEnum("connector_connection_type", [
  "oauth",
  "api_key",
  "credentials",
  "csv_upload",
  "manual_entry",
]);

export const connectorSyncMode = pgEnum("connector_sync_mode", [
  "realtime",
  "scheduled",
  "manual",
]);

export const analyticsCardScopeType = pgEnum("analytics_card_scope_type", [
  "global",
  "channel",
  "multi_channel",
  "product",
  "service",
  "campaign",
  "segment",
]);

export const analyticsCardRenderType = pgEnum("analytics_card_render_type", [
  "kpi",
  "trend",
  "funnel",
  "breakdown",
  "insight",
]);

export const marketingObjectiveType = pgEnum("marketing_objective_type", [
  "revenue",
  "units_sold",
  "leads",
  "awareness",
  "launch",
  "clear_inventory",
  "market_entry",
]);

export const marketingPlanStatus = pgEnum("marketing_plan_status", [
  "draft",
  "recommended",
  "edited",
  "approved",
  "implemented",
  "archived",
]);

export const marketingCampaignStatus = pgEnum("marketing_campaign_status", [
  "active",
  "paused",
  "completed",
  "cancelled",
]);

export const whatIfScenarioType = pgEnum("what_if_scenario_type", [
  "budget_change",
  "channel_remove",
  "channel_add",
  "pricing_change",
  "time_horizon_change",
]);

export const attributionModel = pgEnum("attribution_model", [
  "simple",
  "last_touch",
  "first_touch",
]);

export const marketingTaskType = pgEnum("marketing_task_type", [
  "plan_approval",
  "connector_error",
  "stale_data",
  "campaign_launch",
  "campaign_underperforming",
  "onboarding_incomplete",
  "budget_review",
  "channel_setup",
]);

export const marketingTaskStatus = pgEnum("marketing_task_status", [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
  "auto_resolved",
]);

/* ============================================================================
   GRC ENUMS
   ============================================================================ */

export const grcControlCategory = pgEnum("grc_control_category", [
  "preventive",
  "detective",
  "corrective",
  "directive",
]);

export const grcControlStatus = pgEnum("grc_control_status", [
  "active",
  "inactive",
  "draft",
  "under_review",
  "deprecated",
]);

export const grcControlTestResult = pgEnum("grc_control_test_result", [
  "passed",
  "failed",
  "partial",
  "not_tested",
]);

export const grcRiskCategory = pgEnum("grc_risk_category", [
  "operational",
  "financial",
  "compliance",
  "strategic",
  "reputational",
  "technology",
  "fraud",
]);

export const grcRiskSeverity = pgEnum("grc_risk_severity", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const grcRiskStatus = pgEnum("grc_risk_status", [
  "open",
  "mitigating",
  "monitoring",
  "closed",
  "escalated",
]);

export const grcIncidentCategory = pgEnum("grc_incident_category", [
  "security",
  "data",
  "fraud",
  "system",
  "physical",
  "compliance",
  "safety",
  "other",
]);

export const grcIncidentSeverity = pgEnum("grc_incident_severity", [
  "critical",
  "high",
  "medium",
  "low",
]);

export const grcIncidentStatus = pgEnum("grc_incident_status", [
  "reported",
  "investigating",
  "contained",
  "resolved",
  "closed",
]);

export const grcRequirementStatus = pgEnum("grc_requirement_status", [
  "satisfied",
  "unsatisfied",
  "at_risk",
  "unknown",
]);

export const grcRequirementCategory = pgEnum("grc_requirement_category", [
  "tax",
  "labor",
  "licensing",
  "environmental",
  "data_privacy",
  "financial",
  "health_safety",
  "insurance",
  "corporate_governance",
]);

export const grcRequirementRiskLevel = pgEnum("grc_requirement_risk_level", [
  "low",
  "medium",
  "high",
  "critical",
]);

export const grcTaskStatus = pgEnum("grc_task_status", [
  "open",
  "blocked",
  "completed",
]);

export const grcAlertStatus = pgEnum("grc_alert_status", [
  "active",
  "resolved",
]);

export const grcAlertSeverity = pgEnum("grc_alert_severity", [
  "info",
  "warning",
  "critical",
]);

export const grcLicenseStatus = pgEnum("grc_license_status", [
  "active",
  "expired",
  "suspended",
  "pending_renewal",
  "cancelled",
]);

export const grcTaxFilingStatus = pgEnum("grc_tax_filing_status", [
  "pending",
  "filed",
  "paid",
  "overdue",
  "amended",
]);

/* ============================================================================
   STRATEGY ENUMS
   ============================================================================ */

export const plannerHorizon = pgEnum("planner_horizon", ["run", "improve", "grow"]);
export const plannerStatus = pgEnum("planner_status", ["pending", "active", "completed"]);
export const plannerPriority = pgEnum("planner_priority", ["low", "medium", "high"]);

export const playbookCategory = pgEnum("playbook_category", [
  "market_expansion",
  "product_launch",
  "cost_optimization",
  "digital_transformation",
  "customer_acquisition",
  "revenue_growth",
  "operational_efficiency",
  "talent_development",
]);

export const playbookDifficulty = pgEnum("playbook_difficulty", [
  "easy",
  "medium",
  "hard",
  "expert",
]);

export const playbookStatus = pgEnum("playbook_status", [
  "draft",
  "active",
  "archived",
]);

export const playbookInitiationStatus = pgEnum("playbook_initiation_status", [
  "in_progress",
  "completed",
  "abandoned",
  "paused",
]);

/* ============================================================================
   AI ENUMS
   ============================================================================ */

export const aiConversationStatus = pgEnum("ai_conversation_status", ["active", "archived"]);
export const aiMessageRole = pgEnum("ai_message_role", ["user", "assistant", "tool", "system"]);
export const aiToolRunStatus = pgEnum("ai_tool_run_status", ["ok", "error"]);

export const aiTaskType = pgEnum("ai_task_type", [
  "link_person_to_user",
  "merge_duplicate_people",
  "complete_quick_add",
  "assign_item_to_warehouse",
  "approve_purchase_variance",
  "low_stock_reorder",
  "service_job_unassigned",
  "service_job_overdue",
  "supplier_delay_impact",
  "review_substitution",
  "landed_cost_allocation",
  "complete_performance_review",
  "document_expiry_alert",
  "verify_document",
  "approve_leave_request",
]);

export const aiTaskStatus = pgEnum("ai_task_status", [
  "pending",
  "in_review",
  "approved",
  "rejected",
  "auto_resolved",
  "expired",
]);

/* ============================================================================
   OPERATIONS ENUMS
   ============================================================================ */

export const opsDomain = pgEnum("ops_domain", [
  "operations",
  "sales",
  "finance",
  "hr",
  "marketing",
]);

export const evidenceState = pgEnum("evidence_state", [
  "evidence_ok",
  "pending_evidence",
]);

export const opsPaymentStatus = pgEnum("ops_payment_status", [
  "paid",
  "unpaid",
]);

export const opsPaymentMethod = pgEnum("ops_payment_method", [
  "cash",
  "bank",
]);

export const officeType = pgEnum("office_type", ["physical", "virtual", "hybrid"]);
export const officeStatus = pgEnum("office_status", ["active", "inactive", "closed"]);

export const assetTransferType = pgEnum("asset_transfer_type", [
  "location_change",
  "assignment_change",
  "location_and_assignment",
]);
export const assetCondition = pgEnum("asset_condition", [
  "excellent",
  "good",
  "fair",
  "poor",
  "needs_repair",
]);

export const maintenanceType = pgEnum("maintenance_type", [
  "preventive",
  "corrective",
  "emergency",
  "inspection",
]);
export const maintenancePriority = pgEnum("maintenance_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);
export const maintenanceStatus = pgEnum("maintenance_status", [
  "scheduled",
  "in_progress",
  "completed",
  "cancelled",
  "overdue",
]);
