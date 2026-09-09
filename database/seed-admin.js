const crypto = require('crypto');
const { getPool } = require('../backend/db');

const email = 'admin@techora.local';
const password = 'TechoraAdmin123!';
const salt = crypto.randomBytes(16).toString('hex');
const hash = crypto.scryptSync(password, salt, 64).toString('hex');

(async () => {
  const db = getPool();
  if (!db) throw new Error('DATABASE_URL is missing from .env.');
  await db.query(`INSERT INTO users (first_name, last_name, email, phone, password_hash, password_salt, role)
    VALUES ('Techora', 'Admin', $1, '09000000000', $2, $3, 'ADMIN')
    ON CONFLICT (email) DO UPDATE SET role = 'ADMIN', password_hash = EXCLUDED.password_hash, password_salt = EXCLUDED.password_salt`, [email, hash, salt]);
  console.log(`Admin account ready: ${email}`);
  await db.end();
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
