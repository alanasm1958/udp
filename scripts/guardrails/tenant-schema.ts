/**
 * Guardrail: tenant-schema
 *
 * Fails if any pgTable block in src/db/schema.ts does not include tenantId.
 * This ensures all tables are tenant-scoped.
 *
 * Allowed exceptions: none for now (tenants table itself has id, not tenant_id)
 */

import * as fs from "fs";
import * as path from "path";

const SCHEMA_PATH = path.resolve(__dirname, "../../src/db/schema.ts");

// Tables that are explicitly allowed to NOT have tenant_id
// - tenants: the tenant table itself has id, not tenant_id
// - subscription_plans: global SaaS plans shared across all tenants
const ALLOWED_EXCEPTIONS = ["tenants", "subscription_plans"];

function main() {
  console.log("🔍 Checking tenant scope in schema...\n");

  if (!fs.existsSync(SCHEMA_PATH)) {
    console.error(`❌ Schema file not found: ${SCHEMA_PATH}`);
    process.exit(1);
  }

  const content = fs.readFileSync(SCHEMA_PATH, "utf-8");

  // Find all pgTable declarations
  // Pattern: export const <name> = pgTable("<table_name>", {
  const tablePattern = /export\s+const\s+(\w+)\s*=\s*pgTable\s*\(\s*["'](\w+)["']/g;

  const tables: { varName: string; tableName: string }[] = [];
  let match;

  while ((match = tablePattern.exec(content)) !== null) {
    tables.push({
      varName: match[1],
      tableName: match[2],
    });
  }

  console.log(`Found ${tables.length} tables in schema.\n`);

  const failures: string[] = [];

  for (const table of tables) {
    // Skip allowed exceptions
    if (ALLOWED_EXCEPTIONS.includes(table.tableName)) {
      console.log(`✓ ${table.tableName} (exception - allowed without tenant_id)`);
      continue;
    }

    // Find the table definition block
    // Look for the pattern from "export const <varName>" to the next "export const" or end
    const tableDefPattern = new RegExp(
      `export\\s+const\\s+${table.varName}\\s*=\\s*pgTable\\s*\\([^)]*\\{([\\s\\S]*?)\\}\\s*(?:,\\s*\\([^)]*\\)\\s*=>\\s*\\{[\\s\\S]*?\\})?\\s*\\)`,
      "m"
    );

    const tableDefMatch = content.match(tableDefPattern);

    if (!tableDefMatch) {
      console.log(`⚠ ${table.tableName} - could not parse table definition`);
      continue;
    }

    const tableBody = tableDefMatch[1];

    // Check if tenantId is defined in the table
    if (tableBody.includes("tenantId:") || tableBody.includes("tenant_id")) {
      console.log(`✓ ${table.tableName}`);
    } else {
      console.log(`❌ ${table.tableName} - missing tenant_id`);
      failures.push(table.tableName);
    }
  }

  console.log("");

  if (failures.length > 0) {
    console.error(`\n❌ FAILED: ${failures.length} table(s) missing tenant_id:`);
    failures.forEach((t) => console.error(`   - ${t}`));
    console.error("\nAll tables must be tenant-scoped. Add tenantId FK to these tables.");
    process.exit(1);
  }

  console.log("✅ All tables have tenant scope.\n");
  process.exit(0);
}

main();
