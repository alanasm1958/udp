/**
 * Payroll Calculator
 *
 * Calculates earnings, taxes, and deductions for employees.
 * This is a simplified calculation engine that covers basic US payroll.
 * For production use, integrate with a proper payroll tax service.
 */

import {
  PayrollEmployee,
  PayrollCalculationResult,
  PayrollRunSummary,
  EarningLine,
  TaxLine,
  DeductionLine,
  PayrollAnomaly,
  TAX_CONSTANTS,
  FEDERAL_TAX_BRACKETS_2024,
} from "./types";

/**
 * Calculate payroll for a single employee
 */
export function calculateEmployeePayroll(
  employee: PayrollEmployee,
  periodStart: string,
  periodEnd: string,
  previousPayroll?: { grossPay: number }
): PayrollCalculationResult {
  const anomalies: PayrollAnomaly[] = [];

  // 1. Calculate gross pay
  const { grossPay, earnings } = calculateGrossPay(employee);

  // 2. Check for large changes
  if (previousPayroll) {
    const changePercent = Math.abs((grossPay - previousPayroll.grossPay) / previousPayroll.grossPay);
    if (changePercent > 0.25) {
      anomalies.push({
        type: "large_change",
        severity: "warning",
        message: `Gross pay changed by ${(changePercent * 100).toFixed(1)}% from previous period`,
        field: "grossPay",
        previousValue: previousPayroll.grossPay,
        currentValue: grossPay,
      });
    }
  }

  // 3. Calculate taxes
  const { taxes, totalEmployeeTax, totalEmployerTax } = calculateTaxes(employee, grossPay);

  // 4. Calculate deductions
  const { deductions, totalEmployeeDeduction, totalEmployerContribution } = calculateDeductions(
    employee,
    grossPay
  );

  // 5. Calculate net pay
  const netPay = grossPay - totalEmployeeTax - totalEmployeeDeduction;

  // Check for negative net pay
  if (netPay < 0) {
    anomalies.push({
      type: "negative_net",
      severity: "error",
      message: "Net pay is negative. Review deductions and withholdings.",
      currentValue: netPay,
    });
  }

  // 6. Calculate total employer cost
  const totalEmployerCost = grossPay + totalEmployerTax + totalEmployerContribution;

  // 7. Update YTD
  const newYtdGross = employee.ytdGross + grossPay;

  return {
    employeeId: employee.employeeId,
    personId: employee.personId,
    fullName: employee.fullName,
    employeeNumber: employee.employeeNumber,
    payType: employee.payType,
    payRate: employee.payRate,
    grossPay,
    earnings,
    taxes,
    deductions,
    totalTaxes: totalEmployeeTax,
    totalDeductions: totalEmployeeDeduction,
    employerTaxes: totalEmployerTax,
    employerContributions: totalEmployerContribution,
    netPay,
    totalEmployerCost,
    ytdGross: newYtdGross,
    paymentMethod: employee.paymentMethod,
    anomalies,
  };
}

/**
 * Calculate gross pay based on pay type
 */
function calculateGrossPay(employee: PayrollEmployee): { grossPay: number; earnings: EarningLine[] } {
  const earnings: EarningLine[] = [];
  let grossPay = 0;

  switch (employee.payType) {
    case "salary": {
      // Calculate per-period salary based on frequency
      let periodsPerYear = 12; // default monthly
      switch (employee.payFrequency) {
        case "weekly":
          periodsPerYear = 52;
          break;
        case "biweekly":
          periodsPerYear = 26;
          break;
        case "semimonthly":
          periodsPerYear = 24;
          break;
        case "monthly":
          periodsPerYear = 12;
          break;
      }
      const periodPay = employee.payRate / periodsPerYear;
      grossPay = periodPay;

      earnings.push({
        earningTypeId: "salary",
        earningTypeName: "Regular Salary",
        earningTypeCode: "REG",
        hours: null,
        rate: employee.payRate,
        amount: periodPay,
        description: `${employee.payFrequency} salary`,
      });
      break;
    }

    case "hourly": {
      // Assume standard hours for the period
      const hoursPerPeriod = getHoursPerPeriod(employee.payFrequency, employee.standardHoursPerWeek);
      const regularPay = hoursPerPeriod * employee.payRate;
      grossPay = regularPay;

      earnings.push({
        earningTypeId: "hourly",
        earningTypeName: "Regular Hours",
        earningTypeCode: "REG",
        hours: hoursPerPeriod,
        rate: employee.payRate,
        amount: regularPay,
        description: "Regular hours",
      });
      break;
    }

    case "commission": {
      // For commission, use the pay rate as base and assume no commission this period
      // Actual commission would come from sales data
      grossPay = employee.payRate;

      earnings.push({
        earningTypeId: "base",
        earningTypeName: "Base Pay",
        earningTypeCode: "BASE",
        hours: null,
        rate: employee.payRate,
        amount: employee.payRate,
        description: "Base pay",
      });
      break;
    }
  }

  return { grossPay: Math.round(grossPay * 100) / 100, earnings };
}

/**
 * Get hours per pay period
 */
function getHoursPerPeriod(frequency: string, weeklyHours: number): number {
  switch (frequency) {
    case "weekly":
      return weeklyHours;
    case "biweekly":
      return weeklyHours * 2;
    case "semimonthly":
      return (weeklyHours * 52) / 24;
    case "monthly":
      return (weeklyHours * 52) / 12;
    default:
      return weeklyHours * 2;
  }
}

/**
 * Calculate all taxes for an employee
 */
function calculateTaxes(
  employee: PayrollEmployee,
  grossPay: number
): { taxes: TaxLine[]; totalEmployeeTax: number; totalEmployerTax: number } {
  const taxes: TaxLine[] = [];
  let totalEmployeeTax = 0;
  let totalEmployerTax = 0;

  // 1. Federal Income Tax (simplified)
  if (!employee.isExemptFromFederal) {
    const federalTax = calculateFederalIncomeTax(employee, grossPay);
    taxes.push({
      taxType: "federal_income",
      taxableWages: grossPay,
      taxRate: null,
      employeeAmount: federalTax,
      employerAmount: 0,
      calculationDetails: { method: "bracket", filingStatus: employee.federalFilingStatus },
    });
    totalEmployeeTax += federalTax;
  }

  // 2. Social Security
  if (!employee.isExemptFromFica) {
    const ssWageBase = TAX_CONSTANTS.SOCIAL_SECURITY_WAGE_BASE_2024;
    const ytdSsWages = employee.ytdSocialSecurity / TAX_CONSTANTS.SOCIAL_SECURITY_RATE;
    const remainingWageBase = Math.max(0, ssWageBase - ytdSsWages);
    const taxableWages = Math.min(grossPay, remainingWageBase);
    const ssTax = taxableWages * TAX_CONSTANTS.SOCIAL_SECURITY_RATE;

    taxes.push({
      taxType: "social_security",
      taxableWages,
      taxRate: TAX_CONSTANTS.SOCIAL_SECURITY_RATE,
      employeeAmount: ssTax,
      employerAmount: ssTax, // Employer matches
      calculationDetails: { wageBase: ssWageBase, remainingWageBase },
    });
    totalEmployeeTax += ssTax;
    totalEmployerTax += ssTax;
  }

  // 3. Medicare
  if (!employee.isExemptFromFica) {
    const medicareTax = grossPay * TAX_CONSTANTS.MEDICARE_RATE;

    // Additional Medicare for high earners
    let additionalMedicare = 0;
    const ytdGrossWithCurrent = employee.ytdGross + grossPay;
    if (ytdGrossWithCurrent > TAX_CONSTANTS.MEDICARE_ADDITIONAL_THRESHOLD) {
      const excessWages = Math.min(
        grossPay,
        ytdGrossWithCurrent - TAX_CONSTANTS.MEDICARE_ADDITIONAL_THRESHOLD
      );
      additionalMedicare = Math.max(0, excessWages) * TAX_CONSTANTS.MEDICARE_ADDITIONAL_RATE;
    }

    taxes.push({
      taxType: "medicare",
      taxableWages: grossPay,
      taxRate: TAX_CONSTANTS.MEDICARE_RATE,
      employeeAmount: medicareTax + additionalMedicare,
      employerAmount: medicareTax, // Employer doesn't pay additional
      calculationDetails: { additionalMedicare },
    });
    totalEmployeeTax += medicareTax + additionalMedicare;
    totalEmployerTax += medicareTax;
  }

  // 4. FUTA (employer only)
  const futaWageBase = TAX_CONSTANTS.FUTA_WAGE_BASE;
  const remainingFutaWages = Math.max(0, futaWageBase - employee.ytdGross);
  if (remainingFutaWages > 0) {
    const taxableWages = Math.min(grossPay, remainingFutaWages);
    const futaTax = taxableWages * TAX_CONSTANTS.FUTA_RATE;

    taxes.push({
      taxType: "futa",
      taxableWages,
      taxRate: TAX_CONSTANTS.FUTA_RATE,
      employeeAmount: 0,
      employerAmount: futaTax,
      calculationDetails: { wageBase: futaWageBase, remainingWages: remainingFutaWages },
    });
    totalEmployerTax += futaTax;
  }

  return {
    taxes,
    totalEmployeeTax: Math.round(totalEmployeeTax * 100) / 100,
    totalEmployerTax: Math.round(totalEmployerTax * 100) / 100,
  };
}

/**
 * Calculate federal income tax using 2024 brackets
 */
function calculateFederalIncomeTax(employee: PayrollEmployee, grossPay: number): number {
  // Annualize the gross pay
  let periodsPerYear = 12;
  switch (employee.payFrequency) {
    case "weekly":
      periodsPerYear = 52;
      break;
    case "biweekly":
      periodsPerYear = 26;
      break;
    case "semimonthly":
      periodsPerYear = 24;
      break;
    case "monthly":
      periodsPerYear = 12;
      break;
  }

  const annualizedGross = grossPay * periodsPerYear;

  // Apply W-4 2020+ adjustments
  let adjustedIncome = annualizedGross + employee.w4OtherIncome;
  adjustedIncome -= employee.w4Deductions;
  adjustedIncome -= employee.w4DependentsAmount;

  // If Step 2 checkbox is checked, use single brackets even if married
  const filingStatus = employee.w4Step2Checkbox ? "single" : employee.federalFilingStatus;
  const brackets = filingStatus === "married"
    ? FEDERAL_TAX_BRACKETS_2024.married
    : FEDERAL_TAX_BRACKETS_2024.single;

  // Standard deduction
  const standardDeduction = filingStatus === "married"
    ? TAX_CONSTANTS.STANDARD_DEDUCTION_MARRIED
    : TAX_CONSTANTS.STANDARD_DEDUCTION_SINGLE;

  const taxableIncome = Math.max(0, adjustedIncome - standardDeduction);

  // Calculate tax using brackets
  let annualTax = 0;
  let remainingIncome = taxableIncome;

  for (const bracket of brackets) {
    if (remainingIncome <= 0) break;

    const bracketWidth = bracket.max - bracket.min;
    const incomeInBracket = Math.min(remainingIncome, bracketWidth);
    annualTax += incomeInBracket * bracket.rate;
    remainingIncome -= incomeInBracket;
  }

  // Add additional withholding
  annualTax += employee.additionalFederalWithholding * periodsPerYear;

  // Convert back to per-period
  const periodTax = annualTax / periodsPerYear;

  return Math.max(0, Math.round(periodTax * 100) / 100);
}

/**
 * Calculate deductions for an employee
 */
function calculateDeductions(
  employee: PayrollEmployee,
  grossPay: number
): { deductions: DeductionLine[]; totalEmployeeDeduction: number; totalEmployerContribution: number } {
  const deductions: DeductionLine[] = [];
  let totalEmployeeDeduction = 0;
  let totalEmployerContribution = 0;

  for (const ded of employee.deductions) {
    let employeeAmount = 0;
    let employerAmount = 0;

    // Calculate employee amount based on method
    switch (ded.calculationMethod) {
      case "flat":
        employeeAmount = ded.amount;
        break;
      case "percent_gross":
        employeeAmount = grossPay * (ded.amount / 100);
        break;
      case "percent_net":
        // This is tricky - would need iterative calculation
        // For simplicity, use gross as approximation
        employeeAmount = grossPay * (ded.amount / 100);
        break;
      case "hours":
        // Would need actual hours worked
        employeeAmount = ded.amount;
        break;
    }

    // Check annual limit
    if (ded.maxAnnualLimit && ded.maxAnnualLimit > 0) {
      const remainingLimit = ded.maxAnnualLimit - ded.ytdAmount;
      if (remainingLimit <= 0) {
        employeeAmount = 0;
      } else if (employeeAmount > remainingLimit) {
        employeeAmount = remainingLimit;
      }
    }

    // Calculate employer match if applicable
    if (ded.hasEmployerMatch && ded.employerMatchPercent) {
      // Match up to a percentage of gross (capped by max match percent if specified)
      const employeeContribPercent = (employeeAmount / grossPay) * 100;
      const maxMatchPercent = ded.employerMatchMaxPercent ?? ded.employerMatchPercent;
      const actualMatchPercent = Math.min(employeeContribPercent, maxMatchPercent);
      employerAmount = grossPay * (actualMatchPercent / 100);
    }

    employeeAmount = Math.round(employeeAmount * 100) / 100;
    employerAmount = Math.round(employerAmount * 100) / 100;

    if (employeeAmount > 0 || employerAmount > 0) {
      deductions.push({
        deductionTypeId: ded.deductionTypeId,
        deductionTypeName: ded.deductionTypeName,
        deductionTypeCode: ded.deductionTypeCode,
        employeeAmount,
        employerAmount,
        ytdEmployeeAmount: ded.ytdAmount + employeeAmount,
        ytdEmployerAmount: 0, // Would need to track separately
        calculationDetails: { method: ded.calculationMethod, rate: ded.amount },
      });

      totalEmployeeDeduction += employeeAmount;
      totalEmployerContribution += employerAmount;
    }
  }

  return {
    deductions,
    totalEmployeeDeduction: Math.round(totalEmployeeDeduction * 100) / 100,
    totalEmployerContribution: Math.round(totalEmployerContribution * 100) / 100,
  };
}

/**
 * Calculate summary for a payroll run
 */
export function calculatePayrollSummary(results: PayrollCalculationResult[]): PayrollRunSummary {
  return {
    totalGrossPay: results.reduce((sum, r) => sum + r.grossPay, 0),
    totalEmployeeTaxes: results.reduce((sum, r) => sum + r.totalTaxes, 0),
    totalEmployeeDeductions: results.reduce((sum, r) => sum + r.totalDeductions, 0),
    totalNetPay: results.reduce((sum, r) => sum + r.netPay, 0),
    totalEmployerTaxes: results.reduce((sum, r) => sum + r.employerTaxes, 0),
    totalEmployerContributions: results.reduce((sum, r) => sum + r.employerContributions, 0),
    employeeCount: results.length,
    anomalyCount: results.reduce((sum, r) => sum + r.anomalies.length, 0),
  };
}
