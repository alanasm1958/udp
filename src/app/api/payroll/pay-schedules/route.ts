/**
 * /api/payroll/pay-schedules
 *
 * Manage pay schedules for payroll processing.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { paySchedules, payPeriods } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
import {
  requireTenantIdFromHeaders,
  getUserIdFromHeaders,
  getActorIdFromHeaders,
  TenantError,
} from "@/lib/tenant";
import { resolveActor } from "@/lib/actor";

interface CreatePayScheduleRequest {
  name: string;
  frequency: "weekly" | "biweekly" | "semimonthly" | "monthly";
  anchorDate?: string;
  firstPayDay?: number; // Day of week (0=Sunday) or first semi-monthly day
  secondPayDay?: number; // Second semi-monthly day
  payDayOfMonth?: number; // Day of month for monthly
  isActive?: boolean;
  generatePeriods?: number; // Number of periods to generate
}

/**
 * GET /api/payroll/pay-schedules
 * List pay schedules
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);

    const schedules = await db
      .select({
        id: paySchedules.id,
        name: paySchedules.name,
        frequency: paySchedules.frequency,
        anchorDate: paySchedules.anchorDate,
        firstPayDay: paySchedules.firstPayDay,
        secondPayDay: paySchedules.secondPayDay,
        payDayOfMonth: paySchedules.payDayOfMonth,
        isActive: paySchedules.isActive,
        periodCount: sql<number>`(
          SELECT COUNT(*)::int FROM pay_periods
          WHERE pay_schedule_id = ${paySchedules.id}
        )`,
        createdAt: paySchedules.createdAt,
      })
      .from(paySchedules)
      .where(eq(paySchedules.tenantId, tenantId))
      .orderBy(desc(paySchedules.createdAt));

    return NextResponse.json({ items: schedules });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("GET /api/payroll/pay-schedules error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/payroll/pay-schedules
 * Create a new pay schedule
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const tenantId = requireTenantIdFromHeaders(req);
    const userIdFromHeader = getUserIdFromHeaders(req);
    const actorIdFromHeader = getActorIdFromHeaders(req);

    const actor = await resolveActor(tenantId, actorIdFromHeader, userIdFromHeader);

    const body: CreatePayScheduleRequest = await req.json();

    if (!body.name || !body.frequency) {
      return NextResponse.json(
        { error: "name and frequency are required" },
        { status: 400 }
      );
    }

    // Create pay schedule
    const [schedule] = await db
      .insert(paySchedules)
      .values({
        tenantId,
        name: body.name,
        frequency: body.frequency,
        anchorDate: body.anchorDate || null,
        firstPayDay: body.firstPayDay ?? (body.frequency === "weekly" || body.frequency === "biweekly" ? 5 : 15), // Friday default for weekly/biweekly, 15th for semimonthly
        secondPayDay: body.secondPayDay ?? (body.frequency === "semimonthly" ? 31 : null),
        payDayOfMonth: body.payDayOfMonth ?? (body.frequency === "monthly" ? 31 : null),
        isActive: body.isActive ?? true,
        createdByActorId: actor.actorId,
      })
      .returning();

    // Generate pay periods if requested
    if (body.generatePeriods && body.generatePeriods > 0) {
      const periodsToGenerate = Math.min(body.generatePeriods, 52); // Max 52 periods
      const periods = generatePayPeriods(
        {
          frequency: schedule.frequency,
          anchorDate: schedule.anchorDate,
          firstPayDay: schedule.firstPayDay,
          secondPayDay: schedule.secondPayDay,
          payDayOfMonth: schedule.payDayOfMonth,
        },
        periodsToGenerate
      );

      if (periods.length > 0) {
        await db.insert(payPeriods).values(
          periods.map((p, index) => ({
            tenantId,
            payScheduleId: schedule.id,
            periodNumber: index + 1,
            year: new Date(p.payDate).getFullYear(),
            startDate: p.startDate,
            endDate: p.endDate,
            payDate: p.payDate,
            status: "upcoming" as const,
          }))
        );
      }
    }

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("POST /api/payroll/pay-schedules error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Generate pay periods based on schedule settings
 */
function generatePayPeriods(
  schedule: {
    frequency: string;
    anchorDate: string | null;
    firstPayDay: number | null;
    secondPayDay: number | null;
    payDayOfMonth: number | null;
  },
  count: number
): Array<{ startDate: string; endDate: string; payDate: string }> {
  const periods: Array<{ startDate: string; endDate: string; payDate: string }> = [];
  const today = new Date();

  // Start from today or anchor date
  let currentDate = schedule.anchorDate
    ? new Date(schedule.anchorDate)
    : today;

  for (let i = 0; i < count; i++) {
    let startDate: Date;
    let endDate: Date;
    let payDate: Date;

    switch (schedule.frequency) {
      case "weekly":
        // Pay date is on firstPayDay (day of week)
        payDate = new Date(currentDate);
        endDate = new Date(payDate);
        endDate.setDate(endDate.getDate() - 1); // End day before pay date
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 6); // 7 days period
        // Move to next week
        currentDate.setDate(currentDate.getDate() + 7);
        break;

      case "biweekly":
        payDate = new Date(currentDate);
        endDate = new Date(payDate);
        endDate.setDate(endDate.getDate() - 1);
        startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 13); // 14 days period
        currentDate.setDate(currentDate.getDate() + 14);
        break;

      case "semimonthly":
        const day = currentDate.getDate();
        if (day <= 15) {
          // First half of month
          startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          endDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 15);
          payDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), schedule.firstPayDay || 15);
          // Move to second half
          currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 16);
        } else {
          // Second half of month
          startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 16);
          endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0); // Last day
          const lastDay = endDate.getDate();
          payDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), Math.min(schedule.secondPayDay || 31, lastDay));
          // Move to next month
          currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        }
        break;

      case "monthly":
      default:
        startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0); // Last day
        const lastDayOfMonth = endDate.getDate();
        payDate = new Date(
          currentDate.getFullYear(),
          currentDate.getMonth(),
          Math.min(schedule.payDayOfMonth || 31, lastDayOfMonth)
        );
        // Move to next month
        currentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
        break;
    }

    periods.push({
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
      payDate: formatDate(payDate),
    });
  }

  return periods;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
