import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { journalEntries, journalLines, accounts } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");

    // Fetch journal entries - using actual schema fields
    const entries = await db
      .select({
        id: journalEntries.id,
        postingDate: journalEntries.postingDate,
        entryDate: journalEntries.entryDate,
        memo: journalEntries.memo,
        sourceTransactionSetId: journalEntries.sourceTransactionSetId,
        postedAt: journalEntries.postedAt,
      })
      .from(journalEntries)
      .where(eq(journalEntries.tenantId, tenantId))
      .orderBy(desc(journalEntries.postingDate), desc(journalEntries.postedAt))
      .limit(limit);

    // Fetch lines for each entry with account details
    const entriesWithLines = await Promise.all(
      entries.map(async (entry) => {
        const lines = await db
          .select({
            id: journalLines.id,
            accountId: journalLines.accountId,
            accountCode: accounts.code,
            accountName: accounts.name,
            description: journalLines.description,
            debit: journalLines.debit,
            credit: journalLines.credit,
            lineNo: journalLines.lineNo,
          })
          .from(journalLines)
          .leftJoin(accounts, eq(journalLines.accountId, accounts.id))
          .where(eq(journalLines.journalEntryId, entry.id))
          .orderBy(journalLines.lineNo);

        const totalDebit = lines.reduce(
          (sum, line) => sum + parseFloat(line.debit || "0"),
          0
        );
        const totalCredit = lines.reduce(
          (sum, line) => sum + parseFloat(line.credit || "0"),
          0
        );

        return {
          ...entry,
          lines,
          totalDebit: totalDebit.toString(),
          totalCredit: totalCredit.toString(),
        };
      })
    );

    return NextResponse.json({
      entries: entriesWithLines,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error fetching journal entries:", error);
    return NextResponse.json({ error: "Failed to fetch journal entries" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const tenantId = requireTenantIdFromHeaders(request);
    const body = await request.json();

    const {
      postingDate,
      memo,
      lines = [],
      actorId, // Required: ID of the actor posting this entry
    } = body;

    // Validate lines
    if (!lines || lines.length < 2) {
      return NextResponse.json(
        { error: "Journal entry must have at least two lines" },
        { status: 400 }
      );
    }

    if (!actorId) {
      return NextResponse.json(
        { error: "Actor ID is required for posting journal entries" },
        { status: 400 }
      );
    }

    // Validate balance
    const totalDebit = lines.reduce(
      (sum: number, line: any) => sum + (parseFloat(line.debit) || 0),
      0
    );
    const totalCredit = lines.reduce(
      (sum: number, line: any) => sum + (parseFloat(line.credit) || 0),
      0
    );

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json(
        { error: "Journal entry must be balanced (debits must equal credits)" },
        { status: 400 }
      );
    }

    // Create journal entry using actual schema - let database generate the ID
    const [insertedEntry] = await db.insert(journalEntries).values({
      tenantId,
      postingDate: postingDate || new Date().toISOString().split("T")[0],
      memo: memo || "Manual journal entry",
      postedByActorId: actorId,
      postedAt: new Date(),
    }).returning({ id: journalEntries.id });

    const entryId = insertedEntry.id;

    // Create journal lines
    let lineNo = 1;
    for (const line of lines) {
      if (!line.accountId) continue;
      if (parseFloat(line.debit || 0) === 0 && parseFloat(line.credit || 0) === 0) continue;

      await db.insert(journalLines).values({
        tenantId,
        journalEntryId: entryId,
        lineNo: lineNo++,
        accountId: line.accountId,
        description: line.description || null,
        debit: (parseFloat(line.debit) || 0).toString(),
        credit: (parseFloat(line.credit) || 0).toString(),
      });
    }

    return NextResponse.json({
      success: true,
      entryId,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error creating journal entry:", error);
    return NextResponse.json({ error: "Failed to create journal entry" }, { status: 500 });
  }
}
