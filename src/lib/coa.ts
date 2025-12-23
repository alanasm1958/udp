/**
 * Chart of Accounts (COA) Bootstrap Utilities
 *
 * Provides functions to ensure a tenant has a COA and basic accounts.
 * Used for initial tenant setup and seeding.
 */

import { db } from "@/db";
import { chartOfAccounts, accounts } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export type AccountTypeValue =
  | "asset"
  | "liability"
  | "equity"
  | "income"
  | "expense"
  | "contra_asset"
  | "contra_liability"
  | "contra_equity"
  | "contra_income"
  | "contra_expense";

/**
 * Ensure a default COA exists for the tenant.
 * Returns the COA ID (existing or newly created).
 */
export async function ensureDefaultCoa(
  tenantId: string,
  name: string = "Default Chart of Accounts"
): Promise<string> {
  // Check for existing COA
  const [existing] = await db
    .select({ id: chartOfAccounts.id })
    .from(chartOfAccounts)
    .where(eq(chartOfAccounts.tenantId, tenantId))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  // Create new COA
  const [newCoa] = await db
    .insert(chartOfAccounts)
    .values({
      tenantId,
      name,
    })
    .returning({ id: chartOfAccounts.id });

  return newCoa.id;
}

/**
 * Ensure an account exists for the tenant.
 * Returns the account ID (existing or newly created).
 */
export async function ensureAccount(
  tenantId: string,
  coaId: string,
  code: string,
  name: string,
  type: AccountTypeValue
): Promise<string> {
  // Check for existing account by code
  const [existing] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(and(eq(accounts.tenantId, tenantId), eq(accounts.code, code)))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  // Create new account
  const [newAccount] = await db
    .insert(accounts)
    .values({
      tenantId,
      coaId,
      code,
      name,
      type,
    })
    .returning({ id: accounts.id });

  return newAccount.id;
}

/**
 * Bootstrap minimal accounts for a tenant.
 * Creates a basic set of accounts needed for common transactions.
 */
export async function bootstrapMinimalAccounts(tenantId: string): Promise<{
  coaId: string;
  accounts: Record<string, string>;
}> {
  const coaId = await ensureDefaultCoa(tenantId);

  const accountsToCreate: Array<{
    code: string;
    name: string;
    type: AccountTypeValue;
  }> = [
    // Assets
    { code: "1000", name: "Cash", type: "asset" },
    { code: "1100", name: "Accounts Receivable", type: "asset" },
    { code: "1200", name: "Inventory", type: "asset" },

    // Liabilities
    { code: "2000", name: "Accounts Payable", type: "liability" },
    { code: "2100", name: "Tax Payable", type: "liability" },

    // Equity
    { code: "3000", name: "Retained Earnings", type: "equity" },

    // Income
    { code: "4000", name: "Sales Revenue", type: "income" },

    // Expenses
    { code: "5000", name: "Cost of Goods Sold", type: "expense" },
    { code: "5100", name: "Operating Expenses", type: "expense" },
  ];

  const createdAccounts: Record<string, string> = {};

  for (const acc of accountsToCreate) {
    const accountId = await ensureAccount(tenantId, coaId, acc.code, acc.name, acc.type);
    createdAccounts[acc.code] = accountId;
  }

  return { coaId, accounts: createdAccounts };
}
