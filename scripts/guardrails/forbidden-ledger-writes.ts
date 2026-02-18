/**
 * Guardrail: forbidden-ledger-writes
 *
 * Fails if any file outside the posting service package contains inserts
 * into journalEntries or journalLines tables.
 *
 * This ensures the single financial write path is maintained.
 */

import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";

const PROJECT_ROOT = path.resolve(__dirname, "../..");
const ALLOWED_PATHS = [
  "src/lib/posting.ts", // Backward-compatible re-export
  "src/lib/posting/",   // Posting service package implementation
];

// Patterns that indicate ledger writes
const FORBIDDEN_PATTERNS = [
  /\.insert\s*\(\s*journalEntries\s*\)/,
  /\.insert\s*\(\s*journalLines\s*\)/,
  /INSERT\s+INTO\s+journal_entries/i,
  /INSERT\s+INTO\s+journal_lines/i,
  /db\.insert\(journalEntries\)/,
  /db\.insert\(journalLines\)/,
];

function main() {
  console.log("🔍 Checking for forbidden ledger writes...\n");

  // Find all TypeScript files
  const files = glob.sync("src/**/*.{ts,tsx}", {
    cwd: PROJECT_ROOT,
    ignore: ["**/node_modules/**"],
  });

  const violations: { file: string; line: number; content: string }[] = [];

  for (const file of files) {
    const relativePath = file;
    const fullPath = path.join(PROJECT_ROOT, file);

    // Skip allowed posting service paths
    if (
      ALLOWED_PATHS.some(
        (allowed) => relativePath === allowed || relativePath.startsWith(allowed)
      )
    ) {
      console.log(`⊖ ${relativePath} (allowed - posting service)`);
      continue;
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const lines = content.split("\n");

    let hasViolation = false;

    lines.forEach((line, index) => {
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.test(line)) {
          violations.push({
            file: relativePath,
            line: index + 1,
            content: line.trim(),
          });
          hasViolation = true;
        }
      }
    });

    if (!hasViolation) {
      console.log(`✓ ${relativePath}`);
    } else {
      console.log(`❌ ${relativePath}`);
    }
  }

  console.log("");

  if (violations.length > 0) {
    console.error(`\n❌ FAILED: Found ${violations.length} forbidden ledger write(s):\n`);
    violations.forEach((v) => {
      console.error(`   ${v.file}:${v.line}`);
      console.error(`   > ${v.content}\n`);
    });
    console.error(
      "Ledger writes are only allowed in src/lib/posting.ts and src/lib/posting/*.\n" +
        "Move all journal_entries/journal_lines inserts to the posting service."
    );
    process.exit(1);
  }

  console.log("✅ No forbidden ledger writes found.\n");
  process.exit(0);
}

main();
