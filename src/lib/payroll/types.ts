/**
 * Payroll Calculation Types
 */

export interface PayrollEmployee {
  employeeId: string;
  personId: string;
  fullName: string;
  employeeNumber: string;
  payType: "salary" | "hourly" | "commission";
  payRate: number;
  payFrequency: "weekly" | "biweekly" | "semimonthly" | "monthly";
  standardHoursPerWeek: number;
  // Tax settings
  federalFilingStatus: string;
  federalAllowances: number;
  additionalFederalWithholding: number;
  isExemptFromFederal: boolean;
  isExemptFromState: boolean;
  isExemptFromFica: boolean;
  // W-4 2020+ fields
  w4Step2Checkbox: boolean;
  w4DependentsAmount: number;
  w4OtherIncome: number;
  w4Deductions: number;
  // YTD totals
  ytdGross: number;
  ytdFederalTax: number;
  ytdStateTax: number;
  ytdSocialSecurity: number;
  ytdMedicare: number;
  // Deductions
  deductions: EmployeeDeduction[];
  // Payment
  paymentMethod: string;
}

export interface EmployeeDeduction {
  id: string;
  deductionTypeId: string;
  deductionTypeName: string;
  deductionTypeCode: string;
  calculationMethod: "flat" | "percent_gross" | "percent_net" | "hours";
  amount: number;
  maxAnnualLimit: number | null;
  ytdAmount: number;
  hasEmployerMatch: boolean;
  employerMatchPercent: number | null;
  employerMatchMaxPercent: number | null;
}

export interface EarningLine {
  earningTypeId: string;
  earningTypeName: string;
  earningTypeCode: string;
  hours: number | null;
  rate: number | null;
  amount: number;
  description: string | null;
}

export interface TaxLine {
  taxType: string;
  taxableWages: number;
  taxRate: number | null;
  employeeAmount: number;
  employerAmount: number;
  calculationDetails: Record<string, unknown> | null;
}

export interface DeductionLine {
  deductionTypeId: string;
  deductionTypeName: string;
  deductionTypeCode: string;
  employeeAmount: number;
  employerAmount: number;
  ytdEmployeeAmount: number;
  ytdEmployerAmount: number;
  calculationDetails: Record<string, unknown> | null;
}

export interface PayrollAnomaly {
  type: "large_change" | "missing_data" | "over_limit" | "negative_net";
  severity: "info" | "warning" | "error";
  message: string;
  field?: string;
  previousValue?: number;
  currentValue?: number;
}

export interface PayrollCalculationResult {
  employeeId: string;
  personId: string;
  fullName: string;
  employeeNumber: string;
  payType: "salary" | "hourly" | "commission";
  payRate: number;
  grossPay: number;
  earnings: EarningLine[];
  taxes: TaxLine[];
  deductions: DeductionLine[];
  totalTaxes: number;
  totalDeductions: number;
  employerTaxes: number;
  employerContributions: number;
  netPay: number;
  totalEmployerCost: number;
  ytdGross: number;
  paymentMethod: string;
  anomalies: PayrollAnomaly[];
}

export interface PayrollRunSummary {
  totalGrossPay: number;
  totalEmployeeTaxes: number;
  totalEmployeeDeductions: number;
  totalNetPay: number;
  totalEmployerTaxes: number;
  totalEmployerContributions: number;
  employeeCount: number;
  anomalyCount: number;
}

// Tax calculation constants for 2024/2025
export const TAX_CONSTANTS = {
  // Social Security
  SOCIAL_SECURITY_RATE: 0.062,
  SOCIAL_SECURITY_WAGE_BASE_2024: 168600,
  SOCIAL_SECURITY_WAGE_BASE_2025: 176100,

  // Medicare
  MEDICARE_RATE: 0.0145,
  MEDICARE_ADDITIONAL_RATE: 0.009,
  MEDICARE_ADDITIONAL_THRESHOLD: 200000,

  // FUTA (Federal Unemployment)
  FUTA_RATE: 0.006,
  FUTA_WAGE_BASE: 7000,

  // Standard deduction for W-4 2020+
  STANDARD_DEDUCTION_SINGLE: 14600,
  STANDARD_DEDUCTION_MARRIED: 29200,
};

// 2024 Federal Tax Brackets (simplified)
export const FEDERAL_TAX_BRACKETS_2024 = {
  single: [
    { min: 0, max: 11600, rate: 0.10 },
    { min: 11600, max: 47150, rate: 0.12 },
    { min: 47150, max: 100525, rate: 0.22 },
    { min: 100525, max: 191950, rate: 0.24 },
    { min: 191950, max: 243725, rate: 0.32 },
    { min: 243725, max: 609350, rate: 0.35 },
    { min: 609350, max: Infinity, rate: 0.37 },
  ],
  married: [
    { min: 0, max: 23200, rate: 0.10 },
    { min: 23200, max: 94300, rate: 0.12 },
    { min: 94300, max: 201050, rate: 0.22 },
    { min: 201050, max: 383900, rate: 0.24 },
    { min: 383900, max: 487450, rate: 0.32 },
    { min: 487450, max: 731200, rate: 0.35 },
    { min: 731200, max: Infinity, rate: 0.37 },
  ],
};
