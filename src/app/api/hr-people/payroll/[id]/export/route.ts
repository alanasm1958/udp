/**
 * /api/hr-people/payroll/[id]/export
 *
 * Export payroll run as PDF or Excel
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hrPayrollRuns, hrPayrollLines } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

/**
 * GET /api/hr-people/payroll/[id]/export
 * Export payroll run as PDF or XLSX
 * Query params: format=pdf|xlsx
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const { id } = await params;
    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "pdf";

    const [run] = await db
      .select()
      .from(hrPayrollRuns)
      .where(and(eq(hrPayrollRuns.id, id), eq(hrPayrollRuns.tenantId, tenantId)));

    if (!run) {
      return NextResponse.json({ error: "Payroll run not found" }, { status: 404 });
    }

    const lines = await db
      .select()
      .from(hrPayrollLines)
      .where(eq(hrPayrollLines.payrollRunId, id));

    if (format === "xlsx") {
      // Generate Excel-compatible CSV for now
      // In production, use a library like xlsx or exceljs
      const headers = [
        "Employee",
        "Type",
        "Gross Salary",
        "Overtime",
        "Bonus",
        "Allowances",
        "Income Tax",
        "Social Security",
        "Pension",
        "Health Insurance",
        "Other Deductions",
        "Total Gross",
        "Total Deductions",
        "Net Pay",
      ];

      const rows = lines.map((line) => [
        line.personName,
        line.employmentType,
        line.grossSalary,
        line.overtime,
        line.bonus,
        line.allowances,
        line.incomeTax,
        line.socialSecurity,
        line.pension,
        line.healthInsurance,
        line.otherDeductions,
        line.totalGross,
        line.totalDeductions,
        line.netPay,
      ]);

      const csv = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="payroll_${run.periodStart}_${run.periodEnd}.csv"`,
        },
      });
    }

    // For PDF, generate HTML that can be printed/saved as PDF
    // In production, use a proper PDF library like puppeteer or pdfkit
    const html = `
<!DOCTYPE html>
<html>
<head>
  <title>Payroll Report - ${run.periodStart} to ${run.periodEnd}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    h1 { color: #333; }
    .summary { margin: 20px 0; padding: 15px; background: #f5f5f5; border-radius: 5px; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: right; }
    th { background: #333; color: white; }
    .name { text-align: left; }
    .total { font-weight: bold; background: #f0f0f0; }
    @media print {
      body { margin: 20px; }
    }
  </style>
</head>
<body>
  <h1>Payroll Report</h1>
  <div class="summary">
    <p><strong>Period:</strong> ${run.periodStart} to ${run.periodEnd}</p>
    <p><strong>Pay Date:</strong> ${run.payDate}</p>
    <p><strong>Status:</strong> ${run.status}</p>
    <p><strong>Currency:</strong> ${run.currency}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th class="name">Employee</th>
        <th>Type</th>
        <th>Gross</th>
        <th>Overtime</th>
        <th>Bonus</th>
        <th>Tax</th>
        <th>SS</th>
        <th>Pension</th>
        <th>Health</th>
        <th>Other</th>
        <th>Net Pay</th>
      </tr>
    </thead>
    <tbody>
      ${lines
        .map(
          (line) => `
        <tr>
          <td class="name">${line.personName}</td>
          <td>${line.employmentType}</td>
          <td>$${parseFloat(line.grossSalary || "0").toFixed(2)}</td>
          <td>$${parseFloat(line.overtime || "0").toFixed(2)}</td>
          <td>$${parseFloat(line.bonus || "0").toFixed(2)}</td>
          <td>$${parseFloat(line.incomeTax || "0").toFixed(2)}</td>
          <td>$${parseFloat(line.socialSecurity || "0").toFixed(2)}</td>
          <td>$${parseFloat(line.pension || "0").toFixed(2)}</td>
          <td>$${parseFloat(line.healthInsurance || "0").toFixed(2)}</td>
          <td>$${parseFloat(line.otherDeductions || "0").toFixed(2)}</td>
          <td><strong>$${parseFloat(line.netPay || "0").toFixed(2)}</strong></td>
        </tr>
      `
        )
        .join("")}
    </tbody>
    <tfoot>
      <tr class="total">
        <td class="name">TOTALS</td>
        <td>${lines.length} employees</td>
        <td>$${parseFloat(run.totalGross || "0").toFixed(2)}</td>
        <td colspan="4"></td>
        <td colspan="3"></td>
        <td><strong>$${parseFloat(run.totalNet || "0").toFixed(2)}</strong></td>
      </tr>
    </tfoot>
  </table>

  <p style="margin-top: 30px; color: #666; font-size: 12px;">
    Generated on ${new Date().toLocaleString()}
  </p>
</body>
</html>
    `;

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
        "Content-Disposition": `inline; filename="payroll_${run.periodStart}_${run.periodEnd}.html"`,
      },
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/hr-people/payroll/[id]/export error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
