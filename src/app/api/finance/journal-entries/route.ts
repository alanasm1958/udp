import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { journalEntries, journalLines, accounts } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireTenantIdFromHeaders, TenantError } from "@/lib/tenant";
import { createSimpleLedgerEntry } from "@/lib/posting";

interface JournalLineInput {
  accountId?: string;
  debit?: string | number;
  credit?: string | number;
  description?: string;
}

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
    const totalDebit = (lines as JournalLineInput[]).reduce(
      (sum: number, line) => sum + (parseFloat(String(line.debit ?? 0)) || 0),
      0
    );
    const totalCredit = (lines as JournalLineInput[]).reduce(
      (sum: number, line) => sum + (parseFloat(String(line.credit ?? 0)) || 0),
      0
    );

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return NextResponse.json(
        { error: "Journal entry must be balanced (debits must equal credits)" },
        { status: 400 }
      );
    }

    // Build lines for posting service
    const postingLines = (lines as JournalLineInput[])
      .filter((line) => line.accountId && (parseFloat(String(line.debit ?? 0)) !== 0 || parseFloat(String(line.credit ?? 0)) !== 0))
      .map((line) => ({
        accountId: line.accountId!,
        debit: parseFloat(String(line.debit ?? 0)) || 0,
        credit: parseFloat(String(line.credit ?? 0)) || 0,
        description: line.description || undefined,
      }));

    // Use posting service for ledger writes
    const result = await createSimpleLedgerEntry({
      tenantId,
      actorId,
      postingDate: postingDate || new Date().toISOString().split("T")[0],
      memo: memo || "Manual journal entry",
      source: "manual",
      lines: postingLines,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      entryId: result.journalEntryId,
    });
  } catch (error) {
    if (error instanceof TenantError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error("Error creating journal entry:", error);
    return NextResponse.json({ error: "Failed to create journal entry" }, { status: 500 });
  }
}
