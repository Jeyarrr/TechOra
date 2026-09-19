const crypto = require('crypto');
const { getPool } = require('../backend/db');

(async () => {
  const db = getPool();
  if (!db) throw new Error('DATABASE_URL is missing from .env.');
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');
  const firstName = String(process.env.ADMIN_FIRST_NAME || 'Techora').trim();
  const lastName = String(process.env.ADMIN_LAST_NAME || 'Admin').trim();
  const phone = String(process.env.ADMIN_PHONE || '09000000000').trim();
  if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error('ADMIN_EMAIL must be a valid email address in .env.');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must contain at least 12 characters in .env.');
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  // Migrate the original public seed account, if it exists, instead of leaving
  // a predictable administrator credential available in the database.
  if (email !== 'admin@techora.local') {
    await db.query(`UPDATE users SET first_name = $1, last_name = $2, email = $3, phone = $4, password_hash = $5, password_salt = $6, role = 'ADMIN'
      WHERE email = 'admin@techora.local'
      AND NOT EXISTS (SELECT 1 FROM users WHERE email = $3)`, [firstName, lastName, email, phone, hash, salt]);
  }
  await db.query(`INSERT INTO users (first_name, last_name, email, phone, password_hash, password_salt, role)
    VALUES ($1, $2, $3, $4, $5, $6, 'ADMIN')
    ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, phone = EXCLUDED.phone, role = 'ADMIN', password_hash = EXCLUDED.password_hash, password_salt = EXCLUDED.password_salt`, [firstName, lastName, email, phone, hash, salt]);
  console.log(`Admin account ready: ${email}`);
  await db.end();
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
