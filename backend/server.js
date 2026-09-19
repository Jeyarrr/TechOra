const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const products = require('./products');
const { getPool } = require('./db');
const { uploadsDirectory, saveProductImage, removeProductImage } = require('./images');

const app = express();
const orders = [];
const users = [];
fs.mkdirSync(uploadsDirectory, { recursive: true });
app.use(express.json({ limit: '6mb' }));
app.use('/uploads', express.static(uploadsDirectory));
const clientBuild = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(clientBuild)) app.use(express.static(clientBuild));

const publicUser = (user) => ({
  id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email,
  phone: user.phone, role: user.role || 'CUSTOMER', shippingAddress: user.shippingAddress
});

function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}

app.post('/api/auth/register', async (req, res) => {
  const { firstName, lastName, email, phone, password, address1, address2, city, state, postalCode, country } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (![firstName, lastName, normalizedEmail, phone, password, address1, city, state, postalCode, country].every(Boolean)) return res.status(422).json({ message: 'Please complete all required account and shipping fields.' });
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return res.status(422).json({ message: 'Enter a valid email address.' });
  if (String(password).length < 8) return res.status(422).json({ message: 'Password must be at least 8 characters.' });
  const db = getPool();
  if (db) {
    try {
      const { salt, hash } = passwordHash(password);
      const created = await db.query('INSERT INTO users (first_name, last_name, email, phone, password_hash, password_salt) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, first_name, last_name, email, phone', [String(firstName).trim(), String(lastName).trim(), normalizedEmail, String(phone).trim(), hash, salt]);
      const account = created.rows[0];
      const address = await db.query('INSERT INTO addresses (user_id, address_line_1, address_line_2, city, state, postal_code, country) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING address_line_1, address_line_2, city, state, postal_code, country', [account.id, String(address1).trim(), String(address2 || '').trim(), String(city).trim(), String(state).trim(), String(postalCode).trim(), String(country).trim()]);
      return res.status(201).json({ success: true, user: { id: account.id, firstName: account.first_name, lastName: account.last_name, email: account.email, phone: account.phone, role: 'CUSTOMER', shippingAddress: { address1: address.rows[0].address_line_1, address2: address.rows[0].address_line_2, city: address.rows[0].city, state: address.rows[0].state, postalCode: address.rows[0].postal_code, country: address.rows[0].country } } });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ message: 'An account already exists for this email.' });
      return res.status(500).json({ message: 'Could not create your account.' });
    }
  }
  if (users.some((user) => user.email === normalizedEmail)) return res.status(409).json({ message: 'An account already exists for this email.' });
  const { salt, hash } = passwordHash(password);
  const user = { id: crypto.randomUUID(), firstName: String(firstName).trim(), lastName: String(lastName).trim(), email: normalizedEmail, phone: String(phone).trim(), passwordSalt: salt, passwordHash: hash, shippingAddress: { address1: String(address1).trim(), address2: String(address2 || '').trim(), city: String(city).trim(), state: String(state).trim(), postalCode: String(postalCode).trim(), country: String(country).trim() }, createdAt: new Date().toISOString() };
  users.push(user);
  res.status(201).json({ success: true, user: publicUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');
  const db = getPool();
  if (db) {
    try {
      const found = await db.query('SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.role, u.password_hash, u.password_salt, a.address_line_1, a.address_line_2, a.city, a.state, a.postal_code, a.country FROM users u LEFT JOIN addresses a ON a.user_id = u.id AND a.is_default_shipping = TRUE WHERE u.email = $1 LIMIT 1', [email]);
      const account = found.rows[0];
      if (!account) return res.status(401).json({ message: 'Invalid email or password.' });
      const candidate = passwordHash(password, account.password_salt).hash;
      if (!crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(account.password_hash, 'hex'))) return res.status(401).json({ message: 'Invalid email or password.' });
      return res.json({ success: true, user: { id: account.id, firstName: account.first_name, lastName: account.last_name, email: account.email, phone: account.phone, role: account.role, shippingAddress: account.address_line_1 ? { address1: account.address_line_1, address2: account.address_line_2, city: account.city, state: account.state, postalCode: account.postal_code, country: account.country } : null } });
    } catch { return res.status(500).json({ message: 'Could not sign you in.' }); }
  }
  const user = users.find((account) => account.email === email);
  if (!user) return res.status(401).json({ message: 'Invalid email or password.' });
  const candidate = passwordHash(password, user.passwordSalt).hash;
  const valid = crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(user.passwordHash, 'hex'));
  if (!valid) return res.status(401).json({ message: 'Invalid email or password.' });
  res.json({ success: true, user: publicUser(user) });
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email)) return res.status(422).json({ message: 'Enter a valid email address.' });
  // Deliberately return the same response whether or not the email exists.
  // Email delivery/reset tokens are the next production integration point.
  res.json({ success: true, message: 'If that account exists, reset instructions have been prepared.' });
});

app.patch('/api/account/profile', async (req, res) => {
  const { userId, firstName, lastName, email, phone, address1, address2, city, state, postalCode, country } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!userId || ![firstName, lastName, normalizedEmail, phone, address1, city, state, postalCode, country].every(Boolean)) return res.status(422).json({ message: 'Please complete all required profile and shipping fields.' });
  if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return res.status(422).json({ message: 'Enter a valid email address.' });
  const db = getPool();
  if (!db) return res.status(503).json({ message: 'Account updates require the database connection.' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const account = await client.query('UPDATE users SET first_name = $1, last_name = $2, email = $3, phone = $4, updated_at = NOW() WHERE id = $5 RETURNING id, first_name, last_name, email, phone, role', [String(firstName).trim(), String(lastName).trim(), normalizedEmail, String(phone).trim(), userId]);
    if (!account.rows[0]) throw Object.assign(new Error('Account not found.'), { status: 404 });
    const current = await client.query('SELECT id FROM addresses WHERE user_id = $1 AND is_default_shipping = TRUE ORDER BY created_at DESC LIMIT 1', [userId]);
    const addressValues = [String(address1).trim(), String(address2 || '').trim(), String(city).trim(), String(state).trim(), String(postalCode).trim(), String(country).trim()];
    if (current.rows[0]) await client.query('UPDATE addresses SET address_line_1 = $1, address_line_2 = $2, city = $3, state = $4, postal_code = $5, country = $6 WHERE id = $7', [...addressValues, current.rows[0].id]);
    else await client.query('INSERT INTO addresses (user_id, address_line_1, address_line_2, city, state, postal_code, country, is_default_shipping) VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)', [userId, ...addressValues]);
    await client.query('COMMIT');
    const record = account.rows[0];
    res.json({ success: true, user: { id: record.id, firstName: record.first_name, lastName: record.last_name, email: record.email, phone: record.phone, role: record.role, shippingAddress: { address1: String(address1).trim(), address2: String(address2 || '').trim(), city: String(city).trim(), state: String(state).trim(), postalCode: String(postalCode).trim(), country: String(country).trim() } } });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error.code === '23505') return res.status(409).json({ message: 'That email address is already used by another account.' });
    res.status(error.status || 500).json({ message: error.message || 'Could not update your profile.' });
  } finally { client.release(); }
});

app.get('/api/products', async (req, res) => {
  const { category, q, sort } = req.query;
  const db = getPool();
  if (db) {
    const values = [];
    const clauses = [];
    if (category && category !== 'All') { values.push(category); clauses.push(`category = $${values.length}`); }
    if (q) { values.push(`%${q}%`); clauses.push(`(name ILIKE $${values.length} OR category ILIKE $${values.length} OR description ILIKE $${values.length})`); }
    const ordering = { low: 'price_pesos ASC', high: 'price_pesos DESC', rating: 'rating DESC' }[sort] || 'created_at DESC';
    try {
      const result = await db.query(`SELECT id, name, category, price_pesos AS price, stock_quantity AS stock, rating, review_count AS reviews, badge, image_url AS image, description FROM products ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''} ORDER BY ${ordering}`, values);
      return res.json(result.rows);
    } catch { return res.status(500).json({ error: 'Could not load products from the database.' }); }
  }
  let result = [...products];
  if (category && category !== 'All') result = result.filter(p => p.category === category);
  if (q) { const term = q.toLowerCase(); result = result.filter(p => `${p.name} ${p.category} ${p.description}`.toLowerCase().includes(term)); }
  if (sort === 'low') result.sort((a, b) => a.price - b.price);
  if (sort === 'high') result.sort((a, b) => b.price - a.price);
  if (sort === 'rating') result.sort((a, b) => b.rating - a.rating);
  res.json(result);
});

app.get('/api/products/:id', async (req, res) => {
  const db = getPool();
  if (db) {
    try {
      const result = await db.query('SELECT id, name, category, price_pesos AS price, stock_quantity AS stock, rating, review_count AS reviews, badge, image_url AS image, description FROM products WHERE id = $1', [req.params.id]);
      if (!result.rows[0]) return res.status(404).json({ error: 'Product not found' });
      return res.json(result.rows[0]);
    } catch { return res.status(500).json({ error: 'Could not load this product.' }); }
  }
  const product = products.find(p => p.id === req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

app.get('/api/products/:id/reviews', async (req, res) => {
  const db = getPool();
  if (!db) return res.json([]);
  try {
    const result = await db.query(`SELECT r.id, r.rating, r.comment, r.created_at AS "createdAt", u.first_name || ' ' || LEFT(u.last_name, 1) || '.' AS customer
      FROM reviews r JOIN users u ON u.id = r.customer_id WHERE r.product_id = $1 ORDER BY r.created_at DESC`, [req.params.id]);
    res.json(result.rows);
  } catch { res.status(500).json({ message: 'Could not load reviews.' }); }
});

app.post('/api/products/:id/reviews', async (req, res) => {
  const { userId, rating, comment } = req.body || {};
  const score = Number(rating);
  if (!userId || !Number.isInteger(score) || score < 1 || score > 5 || String(comment || '').trim().length < 3) return res.status(422).json({ message: 'Provide a rating and a review of at least 3 characters.' });
  const db = getPool();
  if (!db) return res.status(503).json({ message: 'Reviews require the database connection.' });
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const purchased = await client.query(`SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id = o.id
      WHERE o.customer_id = $1 AND oi.product_id = $2 AND o.status = 'DELIVERED'
      AND NOT EXISTS (SELECT 1 FROM reviews r WHERE r.order_id = o.id AND r.product_id = $2 AND r.customer_id = $1)
      ORDER BY o.created_at DESC LIMIT 1`, [userId, req.params.id]);
    if (!purchased.rows[0]) throw Object.assign(new Error('You can review this product after a delivered order.'), { status: 403 });
    await client.query('INSERT INTO reviews (product_id, customer_id, order_id, rating, comment) VALUES ($1, $2, $3, $4, $5)', [req.params.id, userId, purchased.rows[0].id, score, String(comment).trim()]);
    await client.query(`UPDATE products SET rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM reviews WHERE product_id = $1), review_count = (SELECT COUNT(*) FROM reviews WHERE product_id = $1), updated_at = NOW() WHERE id = $1`, [req.params.id]);
    await client.query('COMMIT');
    res.status(201).json({ success: true, message: 'Thank you for your review.' });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(error.status || 500).json({ message: error.message || 'Could not save your review.' });
  } finally { client.release(); }
});

app.post('/api/orders', async (req, res) => {
  const { userId, items } = req.body || {};
  if (!userId || !Array.isArray(items) || !items.length) return res.status(400).json({ error: 'A signed-in customer and cart items are required.' });
  const db = getPool();
  if (db) {
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      const customer = await client.query('SELECT id FROM users WHERE id = $1', [userId]);
      if (!customer.rows[0]) throw Object.assign(new Error('Please sign in before checkout.'), { status: 401 });
      const address = await client.query('SELECT id FROM addresses WHERE user_id = $1 AND is_default_shipping = TRUE ORDER BY created_at DESC LIMIT 1', [userId]);
      if (!address.rows[0]) throw Object.assign(new Error('Add a shipping address before checkout.'), { status: 422 });
      const purchased = [];
      for (const item of items) {
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const product = await client.query('SELECT id, name, price_pesos, stock_quantity FROM products WHERE id = $1 FOR UPDATE', [item.id]);
        const row = product.rows[0];
        if (!row) throw Object.assign(new Error('A product in your bag is no longer available.'), { status: 400 });
        if (row.stock_quantity < quantity) throw Object.assign(new Error(`${row.name} does not have enough stock.`), { status: 409 });
        await client.query('UPDATE products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2', [quantity, row.id]);
        purchased.push({ ...row, quantity });
      }
      const total = purchased.reduce((sum, item) => sum + item.price_pesos * item.quantity, 0);
      const orderNumber = `TO-${Date.now().toString().slice(-8)}`;
      const order = await client.query('INSERT INTO orders (order_number, customer_id, shipping_address_id, total_pesos) VALUES ($1, $2, $3, $4) RETURNING order_number, total_pesos, status', [orderNumber, userId, address.rows[0].id, total]);
      for (const item of purchased) await client.query('INSERT INTO order_items (order_id, product_id, quantity, unit_price_pesos) VALUES ((SELECT id FROM orders WHERE order_number = $1), $2, $3, $4)', [orderNumber, item.id, item.quantity, item.price_pesos]);
      await client.query('COMMIT');
      return res.status(201).json({ success: true, order: { id: order.rows[0].order_number, total: order.rows[0].total_pesos, status: order.rows[0].status } });
    } catch (error) {
      await client.query('ROLLBACK');
      return res.status(error.status || 500).json({ message: error.message || 'Could not place your order.' });
    } finally { client.release(); }
  }
  const customer = users.find((account) => account.id === userId);
  if (!customer) return res.status(401).json({ error: 'Please sign in before checkout.' });
  const checkedItems = items.map(item => {
    const product = products.find(p => p.id === item.id);
    return product && { ...product, quantity: Math.max(1, Number(item.quantity) || 1) };
  }).filter(Boolean);
  if (!checkedItems.length) return res.status(400).json({ error: 'No valid products in order.' });
  const total = checkedItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const order = { id: `TO-${Date.now().toString().slice(-6)}`, customer, items: checkedItems, total, createdAt: new Date().toISOString() };
  orders.push(order);
  res.status(201).json({ id: order.id, total: order.total });
});

app.get('/api/orders', async (req, res) => {
  const userId = req.query.userId;
  if (!userId) return res.status(400).json({ message: 'A customer is required.' });
  const db = getPool();
  if (!db) return res.json(orders.filter((order) => order.customer.id === userId));
  try {
    const result = await db.query(`SELECT o.order_number AS id, o.status, o.total_pesos AS total, o.created_at AS "createdAt",
      COALESCE(json_agg(json_build_object('name', p.name, 'quantity', oi.quantity, 'image', p.image_url) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      LEFT JOIN products p ON p.id = oi.product_id
      WHERE o.customer_id = $1
      GROUP BY o.id
      ORDER BY o.created_at DESC`, [userId]);
    res.json(result.rows);
  } catch { res.status(500).json({ message: 'Could not load your orders.' }); }
});

async function requireAdmin(userId) {
  const db = getPool();
  if (!db) return null;
  const result = await db.query("SELECT id FROM users WHERE id = $1 AND role = 'ADMIN'", [userId]);
  return result.rows[0] ? db : null;
}

app.get('/api/admin/dashboard', async (req, res) => {
  try {
    const db = await requireAdmin(req.query.userId);
    if (!db) return res.status(403).json({ message: 'Admin access is required.' });
    const [sales, ordersResult, customers, lowStock, latestOrders, popularProducts, topOrders, topCustomers] = await Promise.all([
      db.query("SELECT COALESCE(SUM(total_pesos), 0)::int AS revenue FROM orders WHERE status <> 'CANCELLED'"),
      db.query('SELECT COUNT(*)::int AS count FROM orders'),
      db.query("SELECT COUNT(*)::int AS count FROM users WHERE role = 'CUSTOMER'"),
      db.query('SELECT id, name, stock_quantity AS stock FROM products WHERE stock_quantity <= 5 ORDER BY stock_quantity ASC'),
      db.query('SELECT order_number AS id, status, total_pesos AS total, created_at AS "createdAt" FROM orders ORDER BY created_at DESC LIMIT 6'),
      db.query(`SELECT p.id, p.name, p.category, p.image_url AS image, p.price_pesos AS price,
        COALESCE(SUM(oi.quantity) FILTER (WHERE o.id IS NOT NULL), 0)::int AS "unitsSold", (COUNT(DISTINCT oi.order_id) FILTER (WHERE o.id IS NOT NULL))::int AS "orderCount"
        FROM products p LEFT JOIN order_items oi ON oi.product_id = p.id
        LEFT JOIN orders o ON o.id = oi.order_id AND o.status <> 'CANCELLED'
        GROUP BY p.id ORDER BY "unitsSold" DESC, p.rating DESC, p.name ASC LIMIT 5`),
      db.query(`SELECT o.order_number AS id, o.total_pesos AS total, o.status, o.created_at AS "createdAt",
        u.first_name || ' ' || u.last_name AS customer, COALESCE(SUM(oi.quantity), 0)::int AS "itemCount"
        FROM orders o JOIN users u ON u.id = o.customer_id LEFT JOIN order_items oi ON oi.order_id = o.id
        WHERE o.status <> 'CANCELLED' GROUP BY o.id, u.first_name, u.last_name
        ORDER BY o.total_pesos DESC, o.created_at DESC LIMIT 5`),
      db.query(`SELECT u.id, u.first_name || ' ' || u.last_name AS name, u.email,
        COUNT(o.id)::int AS "orderCount", COALESCE(SUM(o.total_pesos), 0)::int AS "totalSpent"
        FROM users u LEFT JOIN orders o ON o.customer_id = u.id AND o.status <> 'CANCELLED'
        WHERE u.role = 'CUSTOMER' GROUP BY u.id ORDER BY "orderCount" DESC, "totalSpent" DESC, u.created_at DESC LIMIT 5`)
    ]);
    res.json({ revenue: sales.rows[0].revenue, orders: ordersResult.rows[0].count, customers: customers.rows[0].count, lowStock: lowStock.rows, latestOrders: latestOrders.rows, popularProducts: popularProducts.rows, topOrders: topOrders.rows, topCustomers: topCustomers.rows });
  } catch { res.status(500).json({ message: 'Could not load admin analytics.' }); }
});

app.get('/api/admin/products', async (req, res) => {
  try {
    const db = await requireAdmin(req.query.userId);
    if (!db) return res.status(403).json({ message: 'Admin access is required.' });
    const result = await db.query('SELECT id, name, category, price_pesos AS price, stock_quantity AS stock, rating, badge, image_url AS image FROM products ORDER BY name');
    res.json(result.rows);
  } catch { res.status(500).json({ message: 'Could not load products.' }); }
});

app.post('/api/admin/products', async (req, res) => {
  const { userId, name, category, price, stock, image, imageData, description } = req.body || {};
  try {
    const db = await requireAdmin(userId);
    if (!db) return res.status(403).json({ message: 'Admin access is required.' });
    if (![name, category].every(Boolean) || !(image || imageData) || !Number.isInteger(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(stock)) || Number(stock) < 0) return res.status(422).json({ message: 'Name, category, product image, whole-peso price, and stock are required.' });
    const id = `${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${Date.now().toString().slice(-5)}`;
    let imagePath = image;
    if (imageData) imagePath = await saveProductImage(imageData);
    const result = await db.query(`INSERT INTO products (id, name, category, price_pesos, stock_quantity, image_url, description, rating, review_count)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 0)
      RETURNING id, name, category, price_pesos AS price, stock_quantity AS stock, rating, badge, image_url AS image`, [id, String(name).trim(), String(category).trim(), Number(price), Number(stock), String(imagePath).trim(), String(description || `A new ${name} added to the Techora catalog.`).trim()]);
    res.status(201).json({ success: true, product: result.rows[0] });
  } catch (error) { res.status(error.status || 500).json({ message: error.status ? error.message : 'Could not add the product.' }); }
});

app.patch('/api/admin/products/:id', async (req, res) => {
  const { userId, stock, price, name, category, description, imageData } = req.body || {};
  try {
    const db = await requireAdmin(userId);
    if (!db) return res.status(403).json({ message: 'Admin access is required.' });
    if (stock !== undefined && (!Number.isInteger(Number(stock)) || Number(stock) < 0)) return res.status(422).json({ message: 'Stock must be a whole number of zero or more.' });
    if (price !== undefined && (!Number.isInteger(Number(price)) || Number(price) < 0)) return res.status(422).json({ message: 'Price must be a whole peso amount.' });
    let imagePath = null;
    if (imageData) imagePath = await saveProductImage(imageData);
    const result = await db.query('UPDATE products SET stock_quantity = COALESCE($1, stock_quantity), price_pesos = COALESCE($2, price_pesos), name = COALESCE($3, name), category = COALESCE($4, category), description = COALESCE($5, description), image_url = COALESCE($6, image_url), updated_at = NOW() WHERE id = $7 RETURNING id, name, category, price_pesos AS price, stock_quantity AS stock, rating, badge, image_url AS image', [stock === undefined ? null : Number(stock), price === undefined ? null : Number(price), name || null, category || null, description || null, imagePath, req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Product not found.' });
    res.json({ success: true, product: result.rows[0] });
  } catch (error) { res.status(error.status || 500).json({ message: error.status ? error.message : 'Could not update this product.' }); }
});

app.delete('/api/admin/products/:id', async (req, res) => {
  const { userId, password } = req.body || {};
  try {
    const db = await requireAdmin(userId);
    if (!db) return res.status(403).json({ message: 'Admin access is required.' });
    if (!password) return res.status(422).json({ message: 'Enter your admin password to permanently delete this product.' });

    const account = await db.query('SELECT password_hash, password_salt FROM users WHERE id = $1 AND role = \'ADMIN\'', [userId]);
    if (!account.rows[0]) return res.status(403).json({ message: 'Admin account was not found.' });
    const candidate = passwordHash(String(password), account.rows[0].password_salt).hash;
    if (!crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(account.rows[0].password_hash, 'hex'))) return res.status(401).json({ message: 'Incorrect admin password. Product was not deleted.' });

    const deleted = await db.query('DELETE FROM products WHERE id = $1 RETURNING id, name, image_url', [req.params.id]);
    if (!deleted.rows[0]) return res.status(404).json({ message: 'Product not found.' });
    try { await removeProductImage(deleted.rows[0].image_url); } catch { /* the product is already deleted; a stale image can be cleaned up later */ }
    res.json({ success: true, message: `${deleted.rows[0].name} was permanently deleted.` });
  } catch { res.status(500).json({ message: 'Could not delete this product.' }); }
});

app.get('/api/admin/orders', async (req, res) => {
  try {
    const db = await requireAdmin(req.query.userId);
    if (!db) return res.status(403).json({ message: 'Admin access is required.' });
    const result = await db.query("SELECT o.order_number AS id, o.status, o.total_pesos AS total, o.created_at AS \"createdAt\", u.first_name || ' ' || u.last_name AS customer FROM orders o JOIN users u ON u.id = o.customer_id ORDER BY o.created_at DESC");
    res.json(result.rows);
  } catch { res.status(500).json({ message: 'Could not load orders.' }); }
});

app.patch('/api/admin/orders/:id/status', async (req, res) => {
  const { userId, status } = req.body || {};
  const allowed = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  try {
    const db = await requireAdmin(userId);
    if (!db) return res.status(403).json({ message: 'Admin access is required.' });
    if (!allowed.includes(status)) return res.status(422).json({ message: 'Invalid order status.' });
    const result = await db.query('UPDATE orders SET status = $1, updated_at = NOW() WHERE order_number = $2 RETURNING order_number AS id, status', [status, req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ message: 'Order not found.' });
    res.json({ success: true, order: result.rows[0] });
  } catch { res.status(500).json({ message: 'Could not update order status.' }); }
});

app.get('/api/admin/customers', async (req, res) => {
  try {
    const db = await requireAdmin(req.query.userId);
    if (!db) return res.status(403).json({ message: 'Admin access is required.' });
    const result = await db.query(`SELECT u.id, u.first_name || ' ' || u.last_name AS name, u.email, u.phone, u.created_at AS "createdAt",
      a.city, a.state, COUNT(o.id)::int AS "orderCount", COALESCE(SUM(o.total_pesos), 0)::int AS "orderTotal"
      FROM users u LEFT JOIN addresses a ON a.user_id = u.id AND a.is_default_shipping = TRUE
      LEFT JOIN orders o ON o.customer_id = u.id WHERE u.role = 'CUSTOMER'
      GROUP BY u.id, a.city, a.state ORDER BY u.created_at DESC`);
    res.json(result.rows);
  } catch { res.status(500).json({ message: 'Could not load customers.' }); }
});

app.get('/api/admin/promotions-reviews', async (req, res) => {
  try {
    const db = await requireAdmin(req.query.userId);
    if (!db) return res.status(403).json({ message: 'Admin access is required.' });
    const result = await db.query('SELECT id, name, badge, rating, review_count AS reviews, price_pesos AS price FROM products ORDER BY rating DESC');
    res.json(result.rows);
  } catch { res.status(500).json({ message: 'Could not load promotions and reviews.' }); }
});

app.get('/api/admin/reports-settings', async (req, res) => {
  try {
    const db = await requireAdmin(req.query.userId);
    if (!db) return res.status(403).json({ message: 'Admin access is required.' });
    const [inventory, roles, recent] = await Promise.all([
      db.query('SELECT COUNT(*)::int AS products, COALESCE(SUM(stock_quantity), 0)::int AS units, COUNT(*) FILTER (WHERE stock_quantity <= 5)::int AS low_stock FROM products'),
      db.query('SELECT role, COUNT(*)::int AS count FROM users GROUP BY role ORDER BY role'),
      db.query("SELECT order_number AS id, status, total_pesos AS total, created_at AS \"createdAt\" FROM orders ORDER BY created_at DESC LIMIT 5")
    ]);
    res.json({ inventory: inventory.rows[0], roles: roles.rows, recentOrders: recent.rows, currency: 'PHP', store: 'Techora' });
  } catch { res.status(500).json({ message: 'Could not load reports and settings.' }); }
});

if (fs.existsSync(clientBuild)) app.get('*splat', (_req, res) => res.sendFile(path.join(clientBuild, 'index.html')));

if (require.main === module) app.listen(process.env.PORT || 3000, () => console.log('TechOra running at http://localhost:3000'));
module.exports = app;
