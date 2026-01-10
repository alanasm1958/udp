/**
 * Seed deduction types and earning types
 *
 * Run: npx tsx scripts/seed/payroll_types.ts
 *
 * Includes standard deduction codes (pre-tax, post-tax, employer contributions)
 * and earning types (regular, overtime, bonuses, etc.)
 */

import "dotenv/config";
import { db } from "@/db";
import { deductionTypes, earningTypes } from "@/db/schema";
import { sql, eq } from "drizzle-orm";

interface DeductionTypeDef {
  code: string;
  name: string;
  category: string;
  isPretaxFederal: boolean;
  isPretaxState: boolean;
  isPretaxFica: boolean;
  annualLimitEmployee?: string;
  annualLimitEmployer?: string;
  catchUpAge?: number;
  catchUpLimit?: string;
  defaultCalcMethod?: "fixed" | "percent_gross" | "percent_net";
}

interface EarningTypeDef {
  code: string;
  name: string;
  category: string;
  isTaxableFederal: boolean;
  isTaxableState: boolean;
  isTaxableFica: boolean;
  multiplier?: string;
  defaultExpenseAccountCode?: string;
}

// Standard deduction types
const deductionTypesDefs: DeductionTypeDef[] = [
  // Pre-tax deductions (reduce taxable income)
  { code: "401K_EE", name: "401(k) Employee Contribution", category: "retirement", isPretaxFederal: true, isPretaxState: true, isPretaxFica: false, annualLimitEmployee: "23000", catchUpAge: 50, catchUpLimit: "7500", defaultCalcMethod: "percent_gross" },
  { code: "401K_ROTH_EE", name: "Roth 401(k) Employee Contribution", category: "retirement", isPretaxFederal: false, isPretaxState: false, isPretaxFica: false, annualLimitEmployee: "23000", catchUpAge: 50, catchUpLimit: "7500", defaultCalcMethod: "percent_gross" },
  { code: "HSA_EE", name: "Health Savings Account", category: "health", isPretaxFederal: true, isPretaxState: true, isPretaxFica: true, annualLimitEmployee: "4150", defaultCalcMethod: "fixed" },
  { code: "HSA_FAMILY", name: "HSA Family", category: "health", isPretaxFederal: true, isPretaxState: true, isPretaxFica: true, annualLimitEmployee: "8300", defaultCalcMethod: "fixed" },
  { code: "FSA_HEALTH", name: "Health FSA", category: "health", isPretaxFederal: true, isPretaxState: true, isPretaxFica: true, annualLimitEmployee: "3200", defaultCalcMethod: "fixed" },
  { code: "FSA_DEPENDENT", name: "Dependent Care FSA", category: "health", isPretaxFederal: true, isPretaxState: true, isPretaxFica: true, annualLimitEmployee: "5000", defaultCalcMethod: "fixed" },
  { code: "MEDICAL_EE", name: "Medical Insurance - Employee", category: "insurance", isPretaxFederal: true, isPretaxState: true, isPretaxFica: true, defaultCalcMethod: "fixed" },
  { code: "DENTAL_EE", name: "Dental Insurance - Employee", category: "insurance", isPretaxFederal: true, isPretaxState: true, isPretaxFica: true, defaultCalcMethod: "fixed" },
  { code: "VISION_EE", name: "Vision Insurance - Employee", category: "insurance", isPretaxFederal: true, isPretaxState: true, isPretaxFica: true, defaultCalcMethod: "fixed" },
  { code: "TRANSIT", name: "Commuter Transit", category: "commuter", isPretaxFederal: true, isPretaxState: true, isPretaxFica: true, annualLimitEmployee: "3480", defaultCalcMethod: "fixed" },
  { code: "PARKING", name: "Commuter Parking", category: "commuter", isPretaxFederal: true, isPretaxState: true, isPretaxFica: true, annualLimitEmployee: "3480", defaultCalcMethod: "fixed" },
  // Post-tax deductions
  { code: "LIFE_ADD_EE", name: "Supplemental Life Insurance", category: "insurance", isPretaxFederal: false, isPretaxState: false, isPretaxFica: false, defaultCalcMethod: "fixed" },
  { code: "DISABILITY_STD", name: "Short-Term Disability", category: "insurance", isPretaxFederal: false, isPretaxState: false, isPretaxFica: false, defaultCalcMethod: "percent_gross" },
  { code: "DISABILITY_LTD", name: "Long-Term Disability", category: "insurance", isPretaxFederal: false, isPretaxState: false, isPretaxFica: false, defaultCalcMethod: "percent_gross" },
  { code: "GARNISHMENT", name: "Wage Garnishment", category: "garnishment", isPretaxFederal: false, isPretaxState: false, isPretaxFica: false, defaultCalcMethod: "fixed" },
  { code: "CHILD_SUPPORT", name: "Child Support", category: "garnishment", isPretaxFederal: false, isPretaxState: false, isPretaxFica: false, defaultCalcMethod: "fixed" },
  { code: "LOAN_REPAY", name: "401(k) Loan Repayment", category: "retirement", isPretaxFederal: false, isPretaxState: false, isPretaxFica: false, defaultCalcMethod: "fixed" },
  { code: "UNION_DUES", name: "Union Dues", category: "other", isPretaxFederal: false, isPretaxState: false, isPretaxFica: false, defaultCalcMethod: "fixed" },
  { code: "CHARITY", name: "Charitable Contribution", category: "other", isPretaxFederal: false, isPretaxState: false, isPretaxFica: false, defaultCalcMethod: "fixed" },
  // Employer-paid (tracked but not deducted from employee)
  { code: "401K_ER", name: "401(k) Employer Match", category: "retirement", isPretaxFederal: false, isPretaxState: false, isPretaxFica: false, annualLimitEmployer: "69000", defaultCalcMethod: "percent_gross" },
  { code: "MEDICAL_ER", name: "Medical Insurance - Employer", category: "insurance", isPretaxFederal: false, isPretaxState: false, isPretaxFica: false, defaultCalcMethod: "fixed" },
  { code: "DENTAL_ER", name: "Dental Insurance - Employer", category: "insurance", isPretaxFederal: false, isPretaxState: false, isPretaxFica: false, defaultCalcMethod: "fixed" },
  { code: "VISION_ER", name: "Vision Insurance - Employer", category: "insurance", isPretaxFederal: false, isPretaxState: false, isPretaxFica: false, defaultCalcMethod: "fixed" },
  { code: "LIFE_BASIC_ER", name: "Basic Life Insurance - Employer", category: "insurance", isPretaxFederal: false, isPretaxState: false, isPretaxFica: false, defaultCalcMethod: "fixed" },
  { code: "HSA_ER", name: "HSA Employer Contribution", category: "health", isPretaxFederal: false, isPretaxState: false, isPretaxFica: false, defaultCalcMethod: "fixed" },
];

// Standard earning types
const earningTypesDefs: EarningTypeDef[] = [
  // Regular earnings
  { code: "REG", name: "Regular Pay", category: "regular", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, multiplier: "1.00", defaultExpenseAccountCode: "6000" },
  { code: "SAL", name: "Salary", category: "regular", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, multiplier: "1.00", defaultExpenseAccountCode: "6000" },
  // Overtime
  { code: "OT_1_5", name: "Overtime (1.5x)", category: "overtime", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, multiplier: "1.50", defaultExpenseAccountCode: "6010" },
  { code: "OT_2", name: "Overtime (2x)", category: "overtime", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, multiplier: "2.00", defaultExpenseAccountCode: "6010" },
  // Bonuses
  { code: "BONUS", name: "Discretionary Bonus", category: "bonus", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6030" },
  { code: "BONUS_SIGN", name: "Sign-On Bonus", category: "bonus", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6030" },
  { code: "BONUS_PERF", name: "Performance Bonus", category: "bonus", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6030" },
  { code: "BONUS_REFERRAL", name: "Referral Bonus", category: "bonus", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6030" },
  { code: "BONUS_RETENTION", name: "Retention Bonus", category: "bonus", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6030" },
  { code: "BONUS_SPOT", name: "Spot Bonus", category: "bonus", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6030" },
  // Commission
  { code: "COMM", name: "Commission", category: "commission", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6040" },
  { code: "COMM_DRAW", name: "Commission Draw", category: "commission", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6040" },
  // Leave
  { code: "PTO", name: "Paid Time Off", category: "leave", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6050" },
  { code: "SICK", name: "Sick Pay", category: "leave", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6051" },
  { code: "VACATION", name: "Vacation Pay", category: "leave", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6052" },
  { code: "HOLIDAY", name: "Holiday Pay", category: "leave", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6053" },
  { code: "BEREAVEMENT", name: "Bereavement Pay", category: "leave", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6054" },
  { code: "JURY", name: "Jury Duty Pay", category: "leave", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6055" },
  // Reimbursements (non-taxable)
  { code: "REIMB_MILEAGE", name: "Mileage Reimbursement", category: "reimbursement", isTaxableFederal: false, isTaxableState: false, isTaxableFica: false, defaultExpenseAccountCode: "6500" },
  { code: "REIMB_EXPENSE", name: "Expense Reimbursement", category: "reimbursement", isTaxableFederal: false, isTaxableState: false, isTaxableFica: false, defaultExpenseAccountCode: "6510" },
  { code: "REIMB_CELL", name: "Cell Phone Reimbursement", category: "reimbursement", isTaxableFederal: false, isTaxableState: false, isTaxableFica: false, defaultExpenseAccountCode: "6520" },
  { code: "REIMB_WFH", name: "Home Office Reimbursement", category: "reimbursement", isTaxableFederal: false, isTaxableState: false, isTaxableFica: false, defaultExpenseAccountCode: "6530" },
  // Imputed income (taxable non-cash)
  { code: "IMPUTED_LIFE", name: "Imputed Life Insurance", category: "imputed", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true },
  { code: "IMPUTED_AUTO", name: "Personal Use of Company Vehicle", category: "imputed", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true },
  { code: "IMPUTED_HOUSING", name: "Housing Allowance", category: "imputed", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true },
  // Other
  { code: "TIPS", name: "Tips", category: "tips", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6060" },
  { code: "ALLOC_TIPS", name: "Allocated Tips", category: "tips", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true },
  { code: "SEVERANCE", name: "Severance Pay", category: "separation", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6070" },
  { code: "RETRO", name: "Retroactive Pay", category: "adjustment", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6000" },
  { code: "PTO_PAYOUT", name: "PTO Payout", category: "separation", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6050" },
  { code: "SHIFT_DIFF", name: "Shift Differential", category: "premium", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6020" },
  { code: "ON_CALL", name: "On-Call Pay", category: "premium", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6020" },
  { code: "HAZARD", name: "Hazard Pay", category: "premium", isTaxableFederal: true, isTaxableState: true, isTaxableFica: true, defaultExpenseAccountCode: "6020" },
];

async function seedPayrollTypes() {
  console.log("Seeding payroll types...\n");

  // Seed deduction types - check if exists first, then insert or update
  console.log("Seeding deduction types...");
  for (const dt of deductionTypesDefs) {
    // Check if exists
    const existing = await db
      .select({ id: deductionTypes.id })
      .from(deductionTypes)
      .where(eq(deductionTypes.code, dt.code))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      await db
        .update(deductionTypes)
        .set({
          name: dt.name,
          category: dt.category,
          isPretaxFederal: dt.isPretaxFederal,
          isPretaxState: dt.isPretaxState,
          isPretaxFica: dt.isPretaxFica,
          annualLimitEmployee: dt.annualLimitEmployee,
          annualLimitEmployer: dt.annualLimitEmployer,
          catchUpAge: dt.catchUpAge,
          catchUpLimit: dt.catchUpLimit,
          defaultCalcMethod: dt.defaultCalcMethod,
          updatedAt: sql`now()`,
        })
        .where(eq(deductionTypes.id, existing[0].id));
    } else {
      // Insert new
      await db.insert(deductionTypes).values({
        code: dt.code,
        name: dt.name,
        category: dt.category,
        isPretaxFederal: dt.isPretaxFederal,
        isPretaxState: dt.isPretaxState,
        isPretaxFica: dt.isPretaxFica,
        annualLimitEmployee: dt.annualLimitEmployee,
        annualLimitEmployer: dt.annualLimitEmployer,
        catchUpAge: dt.catchUpAge,
        catchUpLimit: dt.catchUpLimit,
        defaultCalcMethod: dt.defaultCalcMethod,
      });
    }
    console.log(`  - ${dt.code}: ${dt.name}`);
  }

  // Seed earning types - check if exists first, then insert or update
  console.log("\nSeeding earning types...");
  for (const et of earningTypesDefs) {
    // Check if exists
    const existing = await db
      .select({ id: earningTypes.id })
      .from(earningTypes)
      .where(eq(earningTypes.code, et.code))
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      await db
        .update(earningTypes)
        .set({
          name: et.name,
          category: et.category,
          isTaxableFederal: et.isTaxableFederal,
          isTaxableState: et.isTaxableState,
          isTaxableFica: et.isTaxableFica,
          multiplier: et.multiplier,
          defaultExpenseAccountCode: et.defaultExpenseAccountCode,
          updatedAt: sql`now()`,
        })
        .where(eq(earningTypes.id, existing[0].id));
    } else {
      // Insert new
      await db.insert(earningTypes).values({
        code: et.code,
        name: et.name,
        category: et.category,
        isTaxableFederal: et.isTaxableFederal,
        isTaxableState: et.isTaxableState,
        isTaxableFica: et.isTaxableFica,
        multiplier: et.multiplier,
        defaultExpenseAccountCode: et.defaultExpenseAccountCode,
      });
    }
    console.log(`  - ${et.code}: ${et.name}`);
  }

  console.log("\nDone seeding payroll types.");
  console.log(`Total: ${deductionTypesDefs.length} deduction types, ${earningTypesDefs.length} earning types.`);
}

seedPayrollTypes()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Error seeding payroll types:", err);
    process.exit(1);
  });
