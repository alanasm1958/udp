/**
 * Bootstrap COA for existing tenants
 *
 * Run this script to add a Chart of Accounts and minimal accounts
 * to tenants that don't have them yet.
 *
 * Usage: npm run db:bootstrap-coa
 */

import "dotenv/config";
import { pool } from "../src/db";

async function main() {
  const client = await pool.connect();
  try {
    // Find tenants without a COA
    const tenantsWithoutCoa = await client.query(`
      SELECT t.id, t.name
      FROM tenants t
      LEFT JOIN chart_of_accounts coa ON coa.tenant_id = t.id
      WHERE coa.id IS NULL
    `);

    if (tenantsWithoutCoa.rows.length === 0) {
      console.log("All tenants already have a COA.");
      return;
    }

    console.log(`Found ${tenantsWithoutCoa.rows.length} tenant(s) without COA. Bootstrapping...`);

    const accountsData = [
      { code: "1000", name: "Cash", type: "asset" },
      { code: "1100", name: "Accounts Receivable", type: "asset" },
      { code: "1200", name: "Inventory", type: "asset" },
      { code: "2000", name: "Accounts Payable", type: "liability" },
      { code: "2100", name: "Tax Payable", type: "liability" },
      { code: "3000", name: "Retained Earnings", type: "equity" },
      { code: "4000", name: "Sales Revenue", type: "income" },
      { code: "5000", name: "Cost of Goods Sold", type: "expense" },
      { code: "5100", name: "Operating Expenses", type: "expense" },
    ];

    for (const tenant of tenantsWithoutCoa.rows) {
      await client.query("BEGIN");

      try {
        // Create COA
        const coaRes = await client.query(
          `INSERT INTO chart_of_accounts (id, tenant_id, name)
           VALUES (gen_random_uuid(), $1, 'Default Chart of Accounts')
           RETURNING id`,
          [tenant.id]
        );
        const coaId = coaRes.rows[0].id as string;

        // Create accounts
        for (const acc of accountsData) {
          // Check if account already exists
          const existing = await client.query(
            `SELECT id FROM accounts WHERE tenant_id = $1 AND code = $2`,
            [tenant.id, acc.code]
          );

          if (existing.rows.length === 0) {
            await client.query(
              `INSERT INTO accounts (id, tenant_id, coa_id, code, name, type)
               VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)`,
              [tenant.id, coaId, acc.code, acc.name, acc.type]
            );
          }
        }

        await client.query("COMMIT");
        console.log(`✓ Bootstrapped COA for tenant ${tenant.id} (${tenant.name})`);
      } catch (e) {
        await client.query("ROLLBACK");
        console.error(`✗ Failed to bootstrap tenant ${tenant.id}:`, e);
      }
    }

    console.log("Done.");
  } finally {
    client.release();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
