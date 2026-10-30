// Public catalog recovery only: does not access or modify any database.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const endpoint = 'https://techora-store.vercel.app/api/products';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const quote = value => value == null ? 'NULL' : "'" + String(value).replaceAll("'", "''") + "'";
const normalize = value => value.toLowerCase().replace(/^apple\s+/, '').replace(/[^a-z0-9]/g, '');
function walk(dir) {
  return fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry =>
    entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]) : [];
}
async function download(url) {
  let last;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30000), redirect: 'error' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) { last = error; }
  }
  throw last;
}
async function main() {
  const bytes = await download(endpoint);
  const products = JSON.parse(bytes);
  if (!Array.isArray(products) || !products.length) throw new Error('Empty or invalid catalog');
  const ids = new Set();
  for (const p of products) {
    if (typeof p.id !== 'string' || ids.has(p.id) || typeof p.name !== 'string' ||
        !Number.isInteger(p.price) || p.price < 0 || !Number.isInteger(p.stock)) throw new Error('Invalid catalog record');
    ids.add(p.id);
    const url = new URL(p.image);
    if (url.origin !== 'https://xxqoqyjokxixcwtlnfjb.supabase.co' ||
        !url.pathname.startsWith('/storage/v1/object/public/product-images/')) throw new Error('Unexpected image origin; review before export');
  }
  const out = fs.mkdtempSync(path.join(os.homedir(), 'techora-catalog-export-'));
  fs.mkdirSync(path.join(out, 'catalog-assets'));
  fs.mkdirSync(path.join(out, 'originals'));
  fs.writeFileSync(path.join(out, 'live-products.json'), bytes, { flag: 'wx' });
  const local = walk(path.join(root, 'Images')).map(file => ({ file, sha256: hash(fs.readFileSync(file)) }));
  const manifest = { source: endpoint, capturedAt: new Date().toISOString(), scope: 'Public products only; NOT a full database migration', products: [] };
  for (const [index, p] of products.entries()) {
    const item = { id: p.id, name: p.name, price: p.price, sourceUrl: p.image };
    try {
      const original = await download(p.image);
      item.sha256 = hash(original);
      const extension = path.extname(new URL(p.image).pathname).toLowerCase();
      if (!['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(extension)) throw new Error('Unsupported extension');
      const filename = `${String(index + 1).padStart(3, '0')}-${hash(Buffer.from(p.id)).slice(0, 16)}${extension}`;
      fs.writeFileSync(path.join(out, 'originals', filename), original, { flag: 'wx' });
      const exact = local.find(f => f.sha256 === item.sha256);
      item.localFile = exact ? path.relative(root, exact.file).replaceAll('\\', '/') : null;
      item.nameCandidates = local.filter(f => normalize(path.parse(f.file).name) === normalize(p.name)).map(f => path.relative(root, f.file));
      // Use a local image only when it is byte-identical to the live original.
      // Otherwise preserve the live original, never silently substitute a guess.
      const selected = exact ? fs.readFileSync(exact.file) : original;
      fs.writeFileSync(path.join(out, 'catalog-assets', filename), selected, { flag: 'wx' });
      item.newUrl = `/catalog-assets/${filename}`;
      item.status = exact ? 'verified-local-image' : 'preserved-live-original';
    } catch (error) { item.status = 'failed'; item.error = error.message; }
    manifest.products.push(item);
    fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
  }
  const failed = manifest.products.filter(p => p.status === 'failed');
  if (!failed.length) {
    const columns = 'id,name,category,price_pesos,rating,review_count,badge,image_url,description,stock_quantity';
    const rows = products.map((p, i) => '(' + [p.id,p.name,p.category,p.price,p.rating,p.reviews,p.badge,manifest.products[i].newUrl,p.description,p.stock].map(quote).join(',') + ')');
    const sql = `-- Public catalog recovery, not a full production database restore.\n-- Requires schema.sql in a NEW empty destination and catalog-assets deployed at the site root.\nBEGIN;\nSET LOCAL standard_conforming_strings = on;\nLOCK TABLE public.products IN ACCESS EXCLUSIVE MODE;\nDO $$ BEGIN IF EXISTS (SELECT 1 FROM public.products) THEN RAISE EXCEPTION 'Destination products must be empty; refusing overwrite'; END IF; END $$;\nINSERT INTO public.products (${columns}) VALUES\n${rows.join(',\n')};\nCOMMIT;\n`;
    fs.writeFileSync(path.join(out, 'products-for-empty-neon.sql'), sql, { flag: 'wx' });
  }
  console.log(JSON.stringify({ output: out, products: products.length, verifiedLocalImages: manifest.products.filter(p => p.status === 'verified-local-image').length, preservedLiveOriginals: manifest.products.filter(p => p.status === 'preserved-live-original').length, failed: failed.length, sqlGenerated: !failed.length }, null, 2));
  if (failed.length) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
