const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const products = require('./products');
test('catalog has products with valid prices', () => {
  assert.ok(products.length >= 8);
  assert.ok(products.every(product => product.id && product.name && product.price > 0));
});

test('Vercel API initializes when directory creation is unavailable', (t) => {
  const entryPath = require.resolve('../api/index.js');
  const serverPath = require.resolve('./server');
  delete require.cache[entryPath];
  delete require.cache[serverPath];
  t.after(() => {
    delete require.cache[entryPath];
    delete require.cache[serverPath];
  });
  t.mock.method(fs, 'mkdirSync', () => {
    throw Object.assign(new Error('Application filesystem is not writable'), { code: 'EROFS' });
  });
  const app = require('../api/index.js');
  assert.equal(typeof app, 'function');
  assert.equal(typeof app.listen, 'function');
});

test('API entry handles nested login requests and verifies passwords', async (t) => {
  const crypto = require('node:crypto');
  const db = require('./db');
  const password = 'Synthetic-test-password';
  const salt = 'test-salt';
  const account = {
    id: 'test-user', email: 'routing-test@example.invalid',
    first_name: 'Test', last_name: 'User', role: 'CUSTOMER',
    password_salt: salt,
    password_hash: crypto.scryptSync(password, salt, 64).toString('hex')
  };
  const queries = [];
  // Exercise JSON parsing, the real login route, and password verification
  // without reading .env or contacting a local or production database.
  t.mock.method(db, 'getPool', () => ({
    query: async (sql, values) => {
      queries.push({ sql, values });
      return { rows: values[0] === account.email ? [account] : [] };
    }
  }));
  const entryPath = require.resolve('../api/index.js');
  const serverPath = require.resolve('./server');
  delete require.cache[entryPath];
  delete require.cache[serverPath];
  t.after(() => {
    delete require.cache[entryPath];
    delete require.cache[serverPath];
  });
  const app = require('../api/index.js');
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve) => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const url = `http://127.0.0.1:${server.address().port}/api/auth/login`;
  const login = (passwordValue) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: passwordValue })
  });
  const accepted = await login(password);
  assert.equal(accepted.status, 200);
  const body = await accepted.json();
  assert.equal(body.success, true);
  assert.equal(body.user.id, account.id);
  assert.equal(body.user.password_hash, undefined);
  const rejected = await login('incorrect-password');
  assert.equal(rejected.status, 401);
  assert.equal((await rejected.json()).message, 'Invalid email or password.');
  assert.equal(queries.length, 2);
  assert.match(queries[0].sql, /FROM users/);
});
