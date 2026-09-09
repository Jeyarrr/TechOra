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
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  }
  return pool;
}

module.exports = { getPool };
