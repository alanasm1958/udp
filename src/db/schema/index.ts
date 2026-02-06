/**
 * Schema barrel - re-exports all tables from the main schema.
 *
 * The monolithic schema.ts remains the single source of truth for Drizzle ORM
 * table definitions (required for cross-domain foreign key references).
 *
 * Domain modules (finance.ts, hr.ts, grc.ts, etc.) provide organized
 * re-export subsets for ergonomic imports in application code:
 *
 *   import { accounts, journalEntries } from "@/db/schema/finance";
 *   import { hrPersons, hrPayrollRuns } from "@/db/schema/hr";
 *   import { grcRequirements } from "@/db/schema/grc";
 *
 * For full access to all tables:
 *
 *   import { accounts, hrPersons, ... } from "@/db/schema";
 */
export * from "../schema";
