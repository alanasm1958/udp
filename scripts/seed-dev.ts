import "dotenv/config";
import { pool } from "../src/db";

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const tenantRes = await client.query(
      `insert into tenants (id, name, base_currency)
       values (gen_random_uuid(), $1, $2)
       returning id`,
      ["Demo Tenant", "USD"]
    );
    const tenantId = tenantRes.rows[0].id as string;

    const userRes = await client.query(
      `insert into users (id, tenant_id, email, full_name, is_active)
       values (gen_random_uuid(), $1, $2, $3, true)
       returning id`,
      [tenantId, "admin@demo.local", "Tenant Admin"]
    );
    const userId = userRes.rows[0].id as string;

    const actorRes = await client.query(
      `insert into actors (id, tenant_id, type, user_id)
       values (gen_random_uuid(), $1, 'user', $2)
       returning id`,
      [tenantId, userId]
    );
    const adminActorId = actorRes.rows[0].id as string;

    const systemActorRes = await client.query(
      `insert into actors (id, tenant_id, type, system_name)
       values (gen_random_uuid(), $1, 'system', 'udp-system')
       returning id`,
      [tenantId]
    );
    const systemActorId = systemActorRes.rows[0].id as string;

    const roleNames = ["Tenant Admin", "Finance", "Sales"];
    const roleIds: Record<string, string> = {};

    for (const name of roleNames) {
      const r = await client.query(
        `insert into roles (id, tenant_id, name)
         values (gen_random_uuid(), $1, $2)
         returning id`,
        [tenantId, name]
      );
      roleIds[name] = r.rows[0].id as string;
    }

    await client.query(
      `insert into user_roles (tenant_id, user_id, role_id)
       values ($1, $2, $3)`,
      [tenantId, userId, roleIds["Tenant Admin"]]
    );

    await client.query(
      `insert into audit_events (id, tenant_id, actor_id, entity_type, entity_id, action, metadata)
       values (gen_random_uuid(), $1, $2, 'tenant', $1, 'seeded', $3::jsonb)`,
      [tenantId, systemActorId, JSON.stringify({ adminUserId: userId, adminActorId })]
    );

    // Bootstrap Chart of Accounts
    const coaRes = await client.query(
      `insert into chart_of_accounts (id, tenant_id, name)
       values (gen_random_uuid(), $1, 'Default Chart of Accounts')
       returning id`,
      [tenantId]
    );
    const coaId = coaRes.rows[0].id as string;

    // Create minimal accounts
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

    const accountIds: Record<string, string> = {};
    for (const acc of accountsData) {
      const res = await client.query(
        `insert into accounts (id, tenant_id, coa_id, code, name, type)
         values (gen_random_uuid(), $1, $2, $3, $4, $5)
         returning id`,
        [tenantId, coaId, acc.code, acc.name, acc.type]
      );
      accountIds[acc.code] = res.rows[0].id as string;
    }

    await client.query("COMMIT");

    console.log("Seeded:");
    console.log({ tenantId, userId, adminActorId, systemActorId, roles: roleIds, coaId, accounts: accountIds });
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
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
