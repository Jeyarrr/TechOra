// Isolated UI smoke tests. Serves sample API data; never connects to PostgreSQL.
// Run npm run test:ui in a terminal that permits browser child processes.
// Set TECHORA_CHROME_PATH if Chrome/Edge is installed in a custom location.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync, spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.cache/ui-preview');
const customer = { id: 'test-customer', firstName: 'Jamie', lastName: 'Santos', role: 'CUSTOMER', email: 'jamie@example.test', phone: '09171234567', shippingAddress: { address1: '123 Sample Street', city: 'Manila', state: 'Metro Manila', postalCode: '1000', country: 'Philippines' } };
const admin = { ...customer, id: 'test-admin', firstName: 'Alex', role: 'ADMIN', email: 'admin@example.test' };
const categoryNames = ['Smartphones', 'Laptops', 'Audio', 'Wearables', 'Tablets', 'Home office', 'Accessories'];
let products = Array.from({ length: 17 }, (_, i) => ({ id: 'p' + i, name: ['Everyday Smartphone', 'Studio Notebook', 'Wireless Headphones', 'Fitness Watch', 'Portable Tablet', 'Desktop Monitor', 'USB-C Charger'][i % 7] + ' ' + (i + 1), category: categoryNames[i % 7], image: '/product-fallback.svg', price: (i + 1) * 1590, stock: i === 0 ? 0 : i === 1 ? 3 : 15, rating: 4.6, reviews: 2, badge: i % 4 === 0 ? 'Featured' : '', description: 'Designed for everyday work and play. Clear details, thoughtful features and a compact design.' }));
let orders = Array.from({ length: 14 }, (_, i) => ({ id: 'TO-100' + i, customer: 'Jamie Santos', createdAt: '2026-09-17T01:00:00Z', status: i === 0 ? 'DELIVERED' : 'PROCESSING', total: 3180 + i * 1590, itemCount: 2, items: [{ name: products[1].name, quantity: 2 }] }));
const customers = [{ ...customer, name: 'Jamie Santos', city: 'Manila', state: 'Metro Manila', orderCount: 14, orderTotal: 89040, totalSpent: 89040 }];
const requests = [];
let failCatalog = false;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const json = (data, status = 200) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(data)); };
  if (url.pathname.startsWith('/api/')) {
    let raw = ''; for await (const chunk of req) raw += chunk;
    const body = raw ? JSON.parse(raw) : {};
    requests.push({ method: req.method, path: url.pathname, body });
    if (url.pathname === '/api/products') {
      if (failCatalog) return json({ message: 'Unavailable' }, 503);
      let list = products.filter(p => !url.searchParams.get('category') || p.category === url.searchParams.get('category'));
      if (url.searchParams.get('sort') === 'high') list = [...list].sort((a,b) => b.price-a.price);
      if (url.searchParams.get('sort') === 'low') list = [...list].sort((a,b) => a.price-b.price);
      return json(list);
    }
    if (url.pathname.endsWith('/reviews')) return json(req.method === 'POST' ? { message: 'Thank you for your review.' } : [{ id: 1, customer: 'Sam R.', rating: 5, comment: 'Arrived safely and works well.' }]);
    if (url.pathname === '/api/auth/login' || url.pathname === '/api/auth/register') return body.password === 'wrongpass' ? json({ message: 'Invalid email or password.' }, 401) : json({ user: body.email === admin.email ? admin : customer });
    if (url.pathname === '/api/auth/forgot-password') return json({ message: 'Instructions are ready for your account.' });
    if (url.pathname === '/api/account/profile') return json({ user: { ...customer, ...body } });
    if (url.pathname === '/api/orders') return json(req.method === 'POST' ? { order: { id: 'TO-NEW', total: 3180 } } : orders);
    if (url.pathname === '/api/admin/dashboard') return json({ revenue: 89040, orders: 14, customers: 1, lowStock: products.filter(p => p.stock <= 5), popularProducts: products.slice(0,5).map(p => ({ ...p, unitsSold: 8, orderCount: 4 })), topOrders: orders.slice(0,5), topCustomers: customers });
    if (url.pathname === '/api/admin/customers') return json(customers);
    if (url.pathname === '/api/admin/promotions-reviews') return json(products);
    if (url.pathname === '/api/admin/reports-settings') return json({ inventory: { products: products.length, units: 228, low_stock: 2 }, roles: [{ role: 'ADMIN', count: 1 }, { role: 'CUSTOMER', count: 1 }], recentOrders: orders.slice(0,5), currency: 'PHP', store: 'Techora' });
    if (url.pathname === '/api/admin/orders') return json(orders);
    if (url.pathname.endsWith('/status')) { orders = orders.map(o => url.pathname.includes(o.id) ? { ...o, status: body.status } : o); return json({ success: true }); }
    if (url.pathname.startsWith('/api/admin/products')) {
      if (req.method === 'GET') return json(products);
      if (req.method === 'POST') { const product = { ...body, id: 'p-new', image: '/product-fallback.svg', rating: 0 }; products.push(product); return json({ product }); }
      const id = url.pathname.split('/').at(-1);
      if (req.method === 'DELETE') { if (body.password !== 'adminpass') return json({ message: 'Incorrect admin password. Product was not deleted.' }, 401); products = products.filter(p => p.id !== id); return json({ message: 'Product deleted.' }); }
      const product = { ...products.find(p => p.id === id), ...body }; products = products.map(p => p.id === id ? product : p); return json({ product });
    }
    return json({ message: 'Unexpected fixture endpoint' }, 404);
  }
  const file = url.pathname === '/main.js' || url.pathname === '/main.css' ? path.join(out, url.pathname.slice(1)) : url.pathname === '/product-fallback.svg' ? path.join(root, 'frontend/public/product-fallback.svg') : null;
  if (file) { res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'image/svg+xml'); return fs.createReadStream(file).pipe(res); }
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/main.css"></head><body><div id="root"></div><script src="/main.js"></script></body></html>');
});
const checks = [];
const errors = [];
let browser;
let chromeProcess;
async function run() {
  fs.mkdirSync(out, { recursive: true });
  const esbuild = process.platform === 'win32' ? path.join(root, 'node_modules/@esbuild/win32-x64/esbuild.exe') : path.join(root, 'node_modules/esbuild/bin/esbuild');
  execFileSync(esbuild, ['frontend/src/main.jsx', '--bundle', '--jsx=automatic', '--outfile=.cache/ui-preview/main.js', '--loader:.css=css', '--define:process.env.NODE_ENV="development"'], { cwd: root, stdio: 'inherit', windowsHide: true });
  const candidates = [process.env.TECHORA_CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'].filter(Boolean);
  const executable = candidates.find(file => fs.existsSync(file));
  if (!executable) throw Error('No Chrome/Edge executable found. Set TECHORA_CHROME_PATH.');
  const existing = await fetch('http://localhost:9223/json').then(() => true).catch(() => false);
  if (existing) throw Error('Port 9223 is already in use. Close the previous test browser before running.');
  chromeProcess = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9223', '--user-data-dir=' + path.join(out, 'browser-' + Date.now()), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let launchError;
  chromeProcess.on('error', error => { launchError = error; });
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (launchError) throw launchError;
    ready = await fetch('http://localhost:9223/json').then(() => true).catch(() => false);
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  if (!ready) throw Error('Chrome could not start. Browser process execution may be restricted.');
  await new Promise(resolve => server.listen(4187, '127.0.0.1', resolve));
  const pages = await (await fetch('http://localhost:9223/json')).json();
  browser = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise(resolve => browser.addEventListener('open', resolve, { once:true }));
  let serial = 0; const pending = new Map();
  browser.addEventListener('message', event => {
    const msg = JSON.parse(event.data);
    if (msg.id) { const task = pending.get(msg.id); pending.delete(msg.id); msg.error ? task.reject(Error(msg.error.message)) : task.resolve(msg.result); }
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text + ': ' + (msg.params.exceptionDetails.exception?.description || ''));
  });
  const cdp = (method, params = {}) => new Promise((resolve,reject) => { const id = ++serial; pending.set(id,{resolve,reject}); browser.send(JSON.stringify({id,method,params})); });
  const evaluate = async (expression) => { const result = await cdp('Runtime.evaluate',{ expression, returnByValue:true, awaitPromise:true }); if(result.exceptionDetails) throw Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text); return result.result.value; };
  const pause = (ms = 150) => new Promise(resolve => setTimeout(resolve,ms));
  async function waitFor(expression) { for(let i=0;i<60;i++){ if(await evaluate(expression)) return; await pause(100); } throw Error('Timeout: '+expression); }
  const click = async selector => { await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await pause(); };
  const clickText = async (scope,text) => { await evaluate(`[...document.querySelectorAll(${JSON.stringify(scope)})].find(el => el.textContent.trim() === ${JSON.stringify(text)}).click()`); await pause(); };
  async function input(selector,value) { await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await pause(); }
  async function session(account) { await evaluate(`localStorage.setItem('techora-user',${JSON.stringify(JSON.stringify(account))});localStorage.removeItem('techora-admin-section-test-admin');location.reload()`); await waitFor(account?.role === 'ADMIN' ? "!!document.querySelector('.insight-open')" : "!!document.querySelector('.card')"); }
  async function viewport(width) { await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false}); await pause(); }
  async function screenshot(name) { const shot=await cdp('Page.captureScreenshot',{format:'png'}); fs.writeFileSync(path.join(out,name+'.png'),Buffer.from(shot.data,'base64')); }
  async function fits(name) {
    const result=await evaluate(`(()=>{const nodes=[document.documentElement,...document.querySelectorAll('.admin-main,.dialog-panel,.site-header')];return nodes.filter(e=>e.getClientRects().length&&e.scrollWidth>e.clientWidth+2).map(e=>e.className||e.tagName)})()`);
    assert.deepEqual(result,[],name+' overflow: '+result); checks.push(name);
  }
  await cdp('Runtime.enable'); await cdp('Page.enable'); await viewport(1440); await cdp('Page.navigate',{url:'http://127.0.0.1:4187'}); await waitFor("!!document.querySelector('.card')");
  for(const w of [320,375,430,768,1024,1280,1440]){
    await viewport(w); await fits('Storefront '+w);
    await click('.product-view-button'); await fits('Product modal '+w);
    assert(await evaluate("document.querySelector('.product-detail-image img').getBoundingClientRect().height <= document.querySelector('.product-detail-image').getBoundingClientRect().height"),'Image contained');
    await click('.modal-close');
    await click('.round'); await fits('Login '+w);
    await clickText('.switcher button','Create an account'); await fits('Registration '+w);
    await click('.modal-close');
  }
  await viewport(1440); await screenshot('storefront-desktop');
  await input('.catalog-tools input','Headphones'); assert(await evaluate("document.querySelectorAll('.card').length===3")); await input('.catalog-tools input','');
  await clickText('.tabs button','Audio'); await waitFor("document.querySelectorAll('.card').length===3"); await clickText('.tabs button','All'); await waitFor("document.querySelectorAll('.card').length===17");
  await click('.round'); await input('.auth-form input[type=email]','jamie@example.test'); await input('.auth-form input[type=password]','wrongpass'); await click('.auth-form>.button'); await waitFor("!!document.querySelector('.form-error')");
  await input('.auth-form input[type=password]','customerpass'); await click('.auth-form>.button'); await waitFor("!!document.querySelector('.customer-text-links')");
  checks.push('Login validation and sign-in');
  assert(await evaluate("document.querySelector('.toast')?.textContent.includes('Welcome')"));
  await waitFor("!document.querySelector('.toast')");
  await click('.card:nth-child(2) .card-add');
  await pause(3000);
  await click('.card:nth-child(2) .card-add');
  await pause(2200);
  assert(await evaluate("document.querySelector('.toast')?.textContent.includes('added to your bag')"), 'Repeated notices restart the five-second timer');
  await waitFor("!document.querySelector('.toast')");
  await evaluate("window.scrollTo({top:1000,behavior:'instant'})");
  await waitFor("!!document.querySelector('.back-to-top')");
  await click('.back-to-top'); await waitFor("window.scrollY===0 && !document.querySelector('.back-to-top')");
  checks.push('Welcome and repeated bag notifications expire; storefront back to top');
  await viewport(375); await click('.mobile-menu-toggle'); await screenshot('storefront-mobile-menu'); await clickText('.mobile-account-menu button','Profile'); await fits('Profile mobile'); await clickText('.profile-actions button','Edit details'); await fits('Profile edit mobile'); await click('.modal-close');
  await click('.mobile-menu-toggle'); await clickText('.mobile-account-menu button','Orders'); await waitFor("!!document.querySelector('.order-card')"); await fits('Order tracking mobile'); await clickText('.order-items button','Review'); await waitFor("!!document.querySelector('.review-form')"); await input('.review-form textarea','An excellent everyday notebook.'); await click('.review-submit'); await waitFor("document.querySelector('.review-message')?.textContent.includes('Thank you')"); await click('.modal-close');
  await click('.card:nth-child(2) .card-add'); await click('.bag'); await fits('Bag mobile'); await click('.quantity button:last-child'); await click('.summary .button'); await fits('Checkout mobile'); await click('.checkout-modal>.button'); await waitFor("!document.querySelector('.checkout-modal')"); checks.push('Bag quantity, checkout and delivered-product review');
  await click('.card:nth-child(2) .card-add');
  await evaluate('location.reload()'); await waitFor("!!document.querySelector('.card')");
  assert(await evaluate("document.querySelector('.bag span')?.textContent==='1'"), 'Signed-in bag survives refresh');
  await click('.mobile-menu-toggle'); await clickText('.mobile-account-menu button','Sign out');
  assert(await evaluate("!document.querySelector('.bag span') && localStorage.getItem('techora-cart-php')===null"), 'Sign-out clears badge and persisted bag');
  await click('.bag');
  assert(await evaluate("document.querySelectorAll('.cart-item').length===0 && !!document.querySelector('.drawer .empty')"), 'Signed-out bag is empty');
  await click('.modal-close');
  await evaluate(`localStorage.setItem('techora-cart-php',${JSON.stringify(JSON.stringify([{ ...products[1], quantity: 1 }]))});location.reload()`);
  await waitFor("!!document.querySelector('.card')");
  assert(await evaluate("!document.querySelector('.bag span') && localStorage.getItem('techora-cart-php')===null"), 'Guest reload discards stale saved bag');
  await click('.card:nth-child(2) .card-add'); await waitFor("!!document.querySelector('.auth-modal')");
  await input('.auth-form input[type=email]','jamie@example.test'); await input('.auth-form input[type=password]','customerpass'); await click('.auth-form>.button');
  await waitFor("!!document.querySelector('.customer-text-links')");
  assert(await evaluate("!document.querySelector('.bag span')"), 'Fresh login does not restore signed-out bag');
  checks.push('Cart persistence, logout clearing, stale guest storage and fresh login');
  await session(admin);
  assert(await evaluate("getComputedStyle(document.querySelector('.admin-main')).scrollBehavior==='smooth'"));
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  assert(await evaluate("getComputedStyle(document.querySelector('.admin-main')).scrollBehavior==='auto'"));
  await cdp('Emulation.setEmulatedMedia', { features: [] });
  checks.push('Admin smooth scrolling respects reduced motion');
  for(const w of [320,375,430,768,1024,1280,1440]){
    await viewport(w);
    for(const label of ['Dashboard','Products','Orders','Customers','Promotions & reviews','Reports & settings']){
      if(w<=780) await click('.admin-menu-toggle');
      await clickText('.admin-navigation>button',label); await fits(label+' '+w);
    }
    if(w<=780) await click('.admin-menu-toggle'); await clickText('.admin-navigation>button','Dashboard');
    for(const nth of [1,2,3]){await click('.insight-open:nth-child('+nth+')');await fits('Insight '+nth+' '+w);await click('.modal-close');}
  }
  await viewport(1440); await screenshot('admin-desktop');
  await viewport(375); await screenshot('admin-mobile');
  await click('.admin-menu-toggle'); await clickText('.admin-navigation>button','Products'); await screenshot('admin-products-mobile');
  await click('.pagination button:last-child'); assert(await evaluate("document.querySelectorAll('.product-row').length===5")); await click('.pagination button:first-child');
  await input('.admin-product-controls select','Audio'); assert(await evaluate("document.querySelectorAll('.product-row').length===3")); await input('.admin-product-controls select','All');
  await input('.product-row input','2222'); await click('.product-row .row-actions button'); await waitFor("document.querySelector('.admin-message')?.textContent.includes('saved')");
  for (const width of [375, 1440]) {
    await viewport(width);
    await evaluate("document.querySelector('.pagination').scrollIntoView({block:'end',behavior:'instant'})"); await pause();
    assert(await evaluate("(()=>{const b=document.querySelector('.pagination button:last-child');const r=b.getBoundingClientRect();return !b.disabled && b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})()"), 'Next is visible and unobstructed at '+width);
    await click('.pagination button:last-child');
    assert(await evaluate("document.querySelector('.pagination').textContent.includes('Page 2 of 2')"));
    await click('.pagination button:first-child');
    await evaluate("document.querySelector('.admin-main').scrollTo({top:1000,behavior:'instant'})");
    await waitFor("!!document.querySelector('.admin-main .back-to-top')");
    await click('.admin-main .back-to-top');
    await waitFor("document.querySelector('.admin-main').scrollTop===0 && !document.querySelector('.admin-main .back-to-top')");
  }
  await viewport(375);
  checks.push('Unobstructed pagination and admin back to top on mobile and desktop');
  await click('.product-row .edit-product'); await fits('Product editor mobile'); await input('.product-editor .auth-form input','Updated fixture product'); await click('.product-editor .auth-form>.button'); await waitFor("!document.querySelector('.product-editor')");
  await click('.product-row .delete-row-button'); await fits('Delete confirmation mobile'); await input('.delete-product-modal input','wrongpass'); await click('.delete-product-button'); await waitFor("!!document.querySelector('.delete-product-modal .form-error')"); await input('.delete-product-modal input','adminpass'); await click('.delete-product-button'); await waitFor("!document.querySelector('.delete-product-modal')");
  await click('.admin-heading>.button'); await fits('Add product mobile'); await input('.product-editor .auth-form input','New fixture product'); await input('.product-editor input[type=number]','1234');
  await evaluate("(()=>{const f=new File(['fixture'],'fixture.png',{type:'image/png'});const transfer=new DataTransfer();transfer.items.add(f);const input=document.querySelector('input[type=file]');input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));})()"); await pause(); await click('.product-editor .auth-form>.button'); await waitFor("!document.querySelector('.product-editor')");
  checks.push('Admin filtering, pagination, inline save, edit, image upload, add and password-confirmed delete');
  await click('.admin-menu-toggle'); await clickText('.admin-navigation>button','Orders'); await input('.order-table-row select','SHIPPED'); await waitFor("document.querySelector('.admin-message')?.textContent.includes('status updated')");
  await click('.admin-menu-toggle'); await clickText('.admin-navigation>button','Dashboard'); await click('.insight-open');
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9}); assert(await evaluate("document.querySelector('.dialog-panel').contains(document.activeElement)"));
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27}); await waitFor("!document.querySelector('.dialog-panel')"); assert(await evaluate("document.activeElement.classList.contains('insight-open')")); checks.push('Dialog keyboard focus, Escape and focus restoration');
  await session(null); failCatalog=true; await evaluate('location.reload()'); await waitFor("!!document.querySelector('#shop .form-error')"); await fits('Catalog error'); failCatalog=false; await click('#shop .form-error button'); await waitFor("!!document.querySelector('.card')");
  assert.equal(errors.length,0,errors.join('\n'));
  fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({checks,requests:requests.map(r=>({method:r.method,path:r.path})),errors},null,2));
  console.log('PASS: '+checks.length+' layout and interaction checks; '+requests.length+' mocked API calls; no runtime exceptions.');
  await cdp('Browser.close').catch(()=>{}); browser.close(); server.close();
}
run().catch(error=>{console.error(error);if(browser)browser.close();if(chromeProcess)chromeProcess.kill();server.close();process.exitCode=1;});
