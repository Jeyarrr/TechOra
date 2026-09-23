const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const products = require('./products');
test('catalog has products with valid prices', () => {
  assert.ok(products.length >= 8);
  assert.ok(products.every(product => product.id && product.name && product.price > 0));
});

test('Vercel API initializes when directory creation is unavailable', (t) => {
  const entryPath = require.resolve('../api/[...path].js');
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
  const app = require('../api/[...path].js');
  assert.equal(typeof app, 'function');
  assert.equal(typeof app.listen, 'function');
});
