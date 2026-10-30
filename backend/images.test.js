const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { saveProductImage, removeProductImage } = require('./images');
const index = require('./catalog-images.json');
const keys = ['VERCEL','NODE_ENV','SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_SERVICE_ROLE_KEY','CLOUDINARY_CLOUD_NAME','CLOUDINARY_API_KEY','CLOUDINARY_API_SECRET'];
function environment(t, extra = {}) {
  const original = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, { VERCEL: '1' }, extra);
  t.after(() => { for (const k of keys) { if (original[k] === undefined) delete process.env[k]; else process.env[k] = original[k]; } });
}
const sample = 'data:image/png;base64,' + Buffer.from('synthetic-upload').toString('base64');
test('all 47 catalog images are byte-verified and save without runtime disk writes', async t => {
  environment(t);
  t.mock.method(fs, 'mkdirSync', () => { throw Error('No disk writes'); });
  t.mock.method(global, 'fetch', () => { throw Error('No network'); });
  assert.equal(Object.keys(index).length, 47);
  for (const [sha, url] of Object.entries(index)) {
    const bytes = fs.readFileSync(path.join(__dirname, '../frontend/public', url));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), sha);
    assert.equal(await saveProductImage(`data:image/${url.endsWith('.png') ? 'png' : 'jpeg'};base64,${bytes.toString('base64')}`), url);
    await removeProductImage(url);
  }
});
test('missing or partial cloud configuration fails clearly without disk fallback', async t => {
  environment(t);
  t.mock.method(fs, 'mkdirSync', () => { throw Error('No disk writes'); });
  await assert.rejects(saveProductImage(sample), e => e.status === 503 && /CLOUDINARY/.test(e.message));
  process.env.CLOUDINARY_CLOUD_NAME = 'test';
  await assert.rejects(saveProductImage(sample), e => e.status === 503 && /partially/.test(e.message));
});
test('Cloudinary uploads are signed; originals unchanged; deletion scoped to owned images', async t => {
  environment(t, { CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-key', CLOUDINARY_API_SECRET: 'test-secret' });
  const calls = [];
  t.mock.method(global, 'fetch', async (url, options) => {
    calls.push(url);
    const body = options.body;
    const signed = [...body.entries()].filter(([k]) => !['file','api_key','signature'].includes(k)).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('&');
    assert.equal(body.get('signature'), crypto.createHash('sha256').update(signed + 'test-secret').digest('hex'));
    const id = body.get('public_id');
    if (url.endsWith('/upload')) {
      assert.equal(body.get('overwrite'), 'false');
      assert.equal(await body.get('file').text(), 'synthetic-upload');
    }
    return { ok: true, json: async () => ({ public_id: id, secure_url: `https://res.cloudinary.com/test-cloud/image/upload/v1/${id}.png` }) };
  });
  const url = await saveProductImage(sample);
  await removeProductImage(url);
  await removeProductImage('https://res.cloudinary.com/other/image/upload/v1/techora/products/x.png');
  assert.equal(calls.length, 2);
});
test('oversize upload rejected before storage', async t => {
  environment(t);
  await assert.rejects(saveProductImage('data:image/png;base64,' + Buffer.alloc(3 * 1024 * 1024 + 1).toString('base64')), e => e.status === 422);
});
