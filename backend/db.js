const fs = require('fs');
const path = require('path');

let pool;

function loadEnvironmentFile() {
  const envFile = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envFile)) return;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

function getPool() {
  loadEnvironmentFile();
  if (!process.env.DATABASE_URL) return null;
  if (!pool) {
    let Pool;
    try { ({ Pool } = require('pg')); }
    catch { throw new Error('PostgreSQL support is not installed. Run npm install.'); }
    // Serverless hosts can create several app instances at once. Keep each one
    // to one reusable database connection so it works safely with Supabase's
    // transaction pooler as well as the local PostgreSQL database.
    const connectionString = process.env.DATABASE_URL;
    const usesSupabase = /(?:\.supabase\.co|\.pooler\.supabase\.com)/i.test(connectionString);
    pool = new Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX || 1),
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      // Supabase pooler endpoints require TLS. Keep local PostgreSQL unchanged.
      ...(usesSupabase ? { ssl: { rejectUnauthorized: false } } : {})
    });
  }
  return pool;
}

module.exports = { getPool };
