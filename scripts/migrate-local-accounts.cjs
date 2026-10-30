// Explicitly authorized local account migration. Never copies product data.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Client, types } = require('pg');
const { getPool } = require('../backend/db');
types.setTypeParser(1184, value => value); // Preserve timestamp precision.
const tables = ['users', 'addresses'];
const identifier = value => '"' + value.replaceAll('"', '""') + '"';
const canonical = row => JSON.stringify(Object.keys(row).sort().map(k => [k, row[k]]));

async function main() {
  const env = fs.readFileSync(path.join(os.homedir(), 'techora-migration.env'), 'utf8');
  const match = env.match(/^NEON_DATABASE_URL=(.*)$/m);
  if (!match) throw new Error('Neon configuration missing');
  const url = new URL(match[1].trim());
  if (!url.hostname.endsWith('.neon.tech')) throw new Error('Destination must be Neon');
  url.searchParams.delete('sslmode');
  url.searchParams.delete('channel_binding');
  const source = getPool();
  const sourceHost = new URL(process.env.DATABASE_URL).hostname;
  if (!['localhost', '127.0.0.1', '[::1]'].includes(sourceHost)) throw new Error('Source must be local');
  const target = new Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: true }, enableChannelBinding: true, connectionTimeoutMillis: 15000, statement_timeout: 30000 });
  const client = await source.connect();
  let committed = false;
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    const snapshot = {};
    for (const table of tables) snapshot[table] = (await client.query(`SELECT * FROM public.${identifier(table)} ORDER BY id`)).rows;
    await client.query('COMMIT');
    await target.connect();
    await target.query('BEGIN');
    await target.query("SET LOCAL TIME ZONE 'UTC'");
    await target.query("SET LOCAL lock_timeout = '5s'");
    await target.query('LOCK TABLE public.users, public.addresses IN SHARE ROW EXCLUSIVE MODE');
    const before = {};
    for (const table of tables) before[table] = (await target.query(`SELECT * FROM public.${identifier(table)} ORDER BY id`)).rows;
    const productBefore = (await target.query('SELECT * FROM public.products ORDER BY id')).rows.map(canonical);
    const backup = fs.mkdtempSync(path.join(os.homedir(), 'techora-accounts-backup-'));
    const contents = JSON.stringify({ capturedAt: new Date().toISOString(), source: 'localhost', tables: snapshot, destinationBefore: before }, null, 2);
    fs.writeFileSync(path.join(backup, 'accounts.json'), contents, { flag: 'wx', mode: 0o600 });
    fs.writeFileSync(path.join(backup, 'sha256.txt'), crypto.createHash('sha256').update(contents).digest('hex'), { flag: 'wx' });
    const inserted = {};
    for (const table of tables) {
      inserted[table] = 0;
      for (const row of snapshot[table]) {
        const existing = before[table].find(r => r.id === row.id);
        if (existing) {
          if (canonical(existing) !== canonical(row)) throw new Error(`Conflicting ${table} record; refusing overwrite`);
          continue;
        }
        const keys = Object.keys(row);
        await target.query(`INSERT INTO public.${identifier(table)} (${keys.map(identifier).join(',')}) VALUES (${keys.map((_,i) => '$' + (i+1)).join(',')})`, keys.map(k => row[k]));
        inserted[table]++;
      }
      const saved = (await target.query(`SELECT * FROM public.${identifier(table)}`)).rows;
      for (const row of snapshot[table]) {
        const found = saved.find(r => r.id === row.id);
        if (!found || canonical(found) !== canonical(row)) throw new Error(`Verification failed: ${table}`);
      }
    }
    const productAfter = (await target.query('SELECT * FROM public.products ORDER BY id')).rows.map(canonical);
    if (JSON.stringify(productBefore) !== JSON.stringify(productAfter)) throw new Error('Catalog changed during migration');
    await target.query('COMMIT');
    committed = true;
    console.log(JSON.stringify({ committed, inserted, sourceCounts: Object.fromEntries(tables.map(t => [t, snapshot[t].length])), backup, passwordHashesAndSaltsVerified: true, productsUnchanged: true }));
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (!committed) await target.query('ROLLBACK').catch(() => {});
    // Do not log SQL error details: they can contain account emails or other PII.
    console.error(JSON.stringify({ committed, code: error.code || 'MIGRATION_FAILED', message: error.code ? 'Database rejected migration; transaction rolled back if not committed' : error.message }));
    process.exitCode = 1;
  } finally {
    client.release();
    await source.end();
    await target.end().catch(() => {});
  }
}
main().catch(() => { console.error('Migration initialization failed; check private configuration'); process.exitCode = 1; });
