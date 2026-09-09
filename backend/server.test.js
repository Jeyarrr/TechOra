const test = require('node:test');
const assert = require('node:assert/strict');
const products = require('./products');
test('catalog has products with valid prices', () => {
  assert.ok(products.length >= 8);
  assert.ok(products.every(product => product.id && product.name && product.price > 0));
});
