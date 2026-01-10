/**
 * Payroll Calculation Engine
 *
 * This module provides payroll calculation functionality including:
 * - Gross pay calculation (salary, hourly, commission)
 * - Tax withholding (federal, Social Security, Medicare)
 * - Deduction processing (flat, percentage, with employer match)
 * - Anomaly detection (large changes, negative net pay)
 */

export * from "./types";
export * from "./calculator";
