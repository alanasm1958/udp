/* eslint-disable @typescript-eslint/no-require-imports */
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('Fatal: DATABASE_URL environment variable is required');
  process.exit(1);
}
const client = new Client({ connectionString });

async function run() {
  await client.connect();

  // Get all migration files in order
  const files = fs.readdirSync('./drizzle')
    .filter(f => f.endsWith('.sql'))
    .sort();

  console.log('Found', files.length, 'migration files');

  for (const file of files) {
    const sql = fs.readFileSync(path.join('./drizzle', file), 'utf8');
    const statements = sql.split('--> statement-breakpoint').filter(s => s.trim().length > 0);

    let fileSuccess = 0;
    let fileSkipped = 0;

    for (const stmt of statements) {
      const cleanStmt = stmt.trim();
      if (!cleanStmt || cleanStmt.startsWith('--') || cleanStmt === 'SELECT 1;') continue;

      try {
        await client.query(cleanStmt);
        fileSuccess++;
      } catch (e) {
        if (e.message.includes('already exists') || e.message.includes('duplicate')) {
          fileSkipped++;
        } else {
          console.error(file + ':', e.message.slice(0, 80));
        }
      }
    }

    if (fileSuccess > 0) console.log(file + ': ' + fileSuccess + ' applied, ' + fileSkipped + ' skipped');
  }

  await client.end();
  console.log('Done!');
}

run().catch(e => console.error('Fatal:', e.message));
