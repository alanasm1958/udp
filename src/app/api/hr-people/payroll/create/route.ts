/**
 * /api/hr-people/payroll/create
 *
 * Create a new payroll run with preloaded lines
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { hrPayrollRuns, hrPayrollLines, hrPersons } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";

interface CreatePayrollRequest {
  employment_types: string[];
  period_start: string;
  period_end: string;
  pay_date: string;
}

/**
 * POST /api/hr-people/payroll/create
 * Create a new payroll run and preload lines for selected employees
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);

    const body: CreatePayrollRequest = await req.json();

    // Validate required fields
    if (!body.employment_types || body.employment_types.length === 0) {
      return NextResponse.json(
        { error: "At least one employment type must be selected" },
        { status: 400 }
      );
    }
    if (!body.period_start || !body.period_end || !body.pay_date) {
      return NextResponse.json(
        { error: "Period start, period end, and pay date are required" },
        { status: 400 }
      );
    }

    // Create the payroll run
    const [run] = await db
      .insert(hrPayrollRuns)
      .values({
        tenantId,
        periodStart: body.period_start,
        periodEnd: body.period_end,
        payDate: body.pay_date,
        employmentTypes: body.employment_types,
        status: "draft",
        currency: "USD",
        createdBy: actor.actorId,
        updatedBy: actor.actorId,
      })
      .returning();

    // Get eligible persons based on employment types
    const eligiblePersons = await db
      .select()
      .from(hrPersons)
      .where(
        and(
          eq(hrPersons.tenantId, tenantId),
          eq(hrPersons.status, "active"),
          inArray(hrPersons.employmentType, body.employment_types)
        )
      );

    // Create payroll lines for each person
    const lines = [];
    for (const person of eligiblePersons) {
      const grossSalary = parseFloat(person.grossSalary || "0");
      const pensionPercent = parseFloat(person.pensionContributionPercent || "0");

      // Calculate basic deductions (simplified)
      const incomeTax = grossSalary * 0.2; // 20% income tax estimate
      const socialSecurity = grossSalary * 0.062; // 6.2% SS
      const pension = grossSalary * (pensionPercent / 100);
      const healthIns = person.healthInsurance ? 250 : 0; // Fixed health insurance

      const totalGross = grossSalary;
      const totalDeductions = incomeTax + socialSecurity + pension + healthIns;
      const netPay = totalGross - totalDeductions;

      const [line] = await db
        .insert(hrPayrollLines)
        .values({
          tenantId,
          payrollRunId: run.id,
          personId: person.id,
          personName: person.fullName,
          employmentType: person.employmentType || "staff",
          grossSalary: grossSalary.toFixed(2),
          overtime: "0",
          bonus: "0",
          allowances: "0",
          incomeTax: incomeTax.toFixed(2),
          socialSecurity: socialSecurity.toFixed(2),
          pension: pension.toFixed(2),
          healthInsurance: healthIns.toFixed(2),
          otherDeductions: "0",
          totalGross: totalGross.toFixed(2),
          totalDeductions: totalDeductions.toFixed(2),
          netPay: netPay.toFixed(2),
          aiAnalyzed: false,
        })
        .returning();

      lines.push({
        person_id: line.personId,
        person_name: line.personName,
        employment_type: line.employmentType,
        gross_salary: parseFloat(line.grossSalary || "0"),
        overtime: parseFloat(line.overtime || "0"),
        bonus: parseFloat(line.bonus || "0"),
        allowances: parseFloat(line.allowances || "0"),
        income_tax: parseFloat(line.incomeTax || "0"),
        social_security: parseFloat(line.socialSecurity || "0"),
        pension: parseFloat(line.pension || "0"),
        health_insurance: parseFloat(line.healthInsurance || "0"),
        other_deductions: parseFloat(line.otherDeductions || "0"),
        total_gross: parseFloat(line.totalGross || "0"),
        total_deductions: parseFloat(line.totalDeductions || "0"),
        net_pay: parseFloat(line.netPay || "0"),
        ai_analyzed: line.aiAnalyzed,
      });
    }

    return NextResponse.json({
      run_id: run.id,
      lines,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/hr-people/payroll/create error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
