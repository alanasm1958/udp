/**
 * /api/hr-people/payroll/analyze
 *
 * AI analysis for payroll compliance
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hrPayrollRuns, hrPayrollLines } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

interface PayrollLine {
  person_id: string;
  person_name: string;
  employment_type: string;
  gross_salary: number;
  overtime: number;
  bonus: number;
  allowances: number;
  income_tax: number;
  social_security: number;
  pension: number;
  health_insurance: number;
  other_deductions: number;
  total_gross: number;
  total_deductions: number;
  net_pay: number;
}

interface AnalyzeRequest {
  run_id: string;
  lines: PayrollLine[];
}

/**
 * POST /api/hr-people/payroll/analyze
 * Analyze payroll lines for compliance issues
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    const body: AnalyzeRequest = await req.json();

    // Validate request
    if (!body.run_id) {
      return NextResponse.json({ error: "run_id is required" }, { status: 400 });
    }

    // Verify run exists and belongs to tenant
    const [run] = await db
      .select()
      .from(hrPayrollRuns)
      .where(and(eq(hrPayrollRuns.id, body.run_id), eq(hrPayrollRuns.tenantId, tenantId)));

    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    // Analyze each line for compliance
    // In production, this would call Claude API for nuanced analysis
    const analyzedLines = body.lines.map((line) => {
      const suggestions: string[] = [];
      const issues: string[] = [];

      // Check income tax rate (simplified)
      const expectedTaxRate = 0.2; // 20%
      const actualTaxRate = line.gross_salary > 0 ? line.income_tax / line.gross_salary : 0;

      if (Math.abs(actualTaxRate - expectedTaxRate) > 0.05) {
        suggestions.push(
          `Income tax appears to be ${(actualTaxRate * 100).toFixed(1)}% of gross. Standard rate is ~20%.`
        );
      }

      // Check social security (6.2% for US)
      const expectedSSRate = 0.062;
      const actualSSRate = line.gross_salary > 0 ? line.social_security / line.gross_salary : 0;

      if (Math.abs(actualSSRate - expectedSSRate) > 0.01) {
        suggestions.push(
          `Social security appears to be ${(actualSSRate * 100).toFixed(2)}% of gross. Standard rate is 6.2%.`
        );
      }

      // Check for missing deductions
      if (line.income_tax === 0 && line.gross_salary > 500) {
        issues.push("No income tax withholding - verify if employee is tax exempt");
      }

      if (line.social_security === 0 && line.gross_salary > 500) {
        issues.push("No social security withholding - verify contractor status");
      }

      // Check for negative values
      if (line.net_pay < 0) {
        issues.push("Net pay is negative - deductions exceed gross pay");
      }

      // Check totals
      const calculatedGross =
        line.gross_salary + line.overtime + line.bonus + line.allowances;
      const calculatedDeductions =
        line.income_tax +
        line.social_security +
        line.pension +
        line.health_insurance +
        line.other_deductions;
      const calculatedNet = calculatedGross - calculatedDeductions;

      if (Math.abs(line.total_gross - calculatedGross) > 0.01) {
        suggestions.push("Total gross doesn't match sum of components");
      }

      if (Math.abs(line.net_pay - calculatedNet) > 0.01) {
        suggestions.push("Net pay doesn't match gross minus deductions");
      }

      return {
        ...line,
        ai_analyzed: true,
        ai_suggestions: suggestions.length > 0 ? { items: suggestions } : null,
        compliance_issues: issues.length > 0 ? { items: issues } : null,
      };
    });

    // Update lines in database
    for (const line of analyzedLines) {
      await db
        .update(hrPayrollLines)
        .set({
          aiAnalyzed: true,
          aiSuggestions: line.ai_suggestions,
          complianceIssues: line.compliance_issues,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(hrPayrollLines.payrollRunId, body.run_id),
            eq(hrPayrollLines.personId, line.person_id)
          )
        );
    }

    return NextResponse.json({
      analyzed_lines: analyzedLines,
      summary: {
        total_lines: analyzedLines.length,
        lines_with_issues: analyzedLines.filter((l) => l.compliance_issues).length,
        lines_with_suggestions: analyzedLines.filter((l) => l.ai_suggestions).length,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/hr-people/payroll/analyze error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
