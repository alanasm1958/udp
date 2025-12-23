/**
 * Guardrail: no-deletes-financial
 *
 * Fails if code uses db.delete(...) or SQL DELETE against financial tables.
 * Financial records must use reversal/void/supersede patterns, never deletion.
 */

import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";

const PROJECT_ROOT = path.resolve(__dirname, "../..");

// Financial tables that must never have DELETE operations
const FINANCIAL_TABLES = [
  "transactionSets",
  "transaction_sets",
  "businessTransactions",
  "business_transactions",
  "businessTransactionLines",
  "business_transaction_lines",
  "postingIntents",
  "posting_intents",
  "journalEntries",
  "journal_entries",
  "journalLines",
  "journal_lines",
  "documents",
  "documentExtractions",
  "document_extractions",
  "documentLinks",
  "document_links",
  "reversalLinks",
  "reversal_links",
];

function main() {
  console.log("🔍 Checking for forbidden deletes on financial tables...\n");

  // Find all TypeScript files
  const files = glob.sync("src/**/*.{ts,tsx}", {
    cwd: PROJECT_ROOT,
    ignore: ["**/node_modules/**"],
  });

  const violations: { file: string; line: number; content: string; table: string }[] = [];

  for (const file of files) {
    const fullPath = path.join(PROJECT_ROOT, file);
    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");

    let hasViolation = false;

    lines.forEach((line, index) => {
      // Check for Drizzle delete pattern: .delete(tableName)
      const drizzleDeleteMatch = line.match(/\.delete\s*\(\s*(\w+)\s*\)/);
      if (drizzleDeleteMatch) {
        const tableName = drizzleDeleteMatch[1];
        if (FINANCIAL_TABLES.includes(tableName)) {
          violations.push({
            file,
            line: index + 1,
            content: line.trim(),
            table: tableName,
          });
          hasViolation = true;
        }
      }

      // Check for raw SQL DELETE
      for (const table of FINANCIAL_TABLES) {
        const sqlPattern = new RegExp(`DELETE\\s+FROM\\s+${table}`, "i");
        if (sqlPattern.test(line)) {
          violations.push({
            file,
            line: index + 1,
            content: line.trim(),
            table,
          });
          hasViolation = true;
        }
      }
    });

    if (!hasViolation) {
      console.log(`✓ ${file}`);
    } else {
      console.log(`❌ ${file}`);
    }
  }

  console.log("");

  if (violations.length > 0) {
    console.error(`\n❌ FAILED: Found ${violations.length} forbidden delete(s):\n`);
    violations.forEach((v) => {
      console.error(`   ${v.file}:${v.line} (table: ${v.table})`);
      console.error(`   > ${v.content}\n`);
    });
    console.error(
      "Financial records must never be deleted.\n" +
        "Use reversal, void, or supersede patterns instead."
    );
    process.exit(1);
  }

  console.log("✅ No forbidden deletes found.\n");
  process.exit(0);
}

main();
