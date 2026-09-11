const { getPool } = require('../backend/db');

const catalog = [
  ['Apple iPhone 17','Smartphones',62990],['Samsung Galaxy S26 Ultra','Smartphones',84990],['Samsung Galaxy Z Fold7','Smartphones',109990],['Google Pixel 10 Pro','Smartphones',61990],['Xiaomi 17','Smartphones',42990],['OnePlus 14','Smartphones',45990],['ASUS ROG Phone 10','Smartphones',55990],['Nothing Phone (4)','Smartphones',38990],
  ['Apple MacBook Air','Laptops',64990],['Apple MacBook Pro','Laptops',114990],['ASUS ROG Zephyrus G16','Laptops',119990],['ASUS TUF Gaming A15','Laptops',59990],['Lenovo Legion 5','Laptops',72990],['Lenovo ThinkPad X1 Carbon','Laptops',99990],['HP Pavilion','Laptops',45990],['Acer Nitro V','Laptops',52990],['Dell XPS 14','Laptops',94990],
  ['Apple AirPods Pro','Audio',14990],['Apple AirPods Max','Audio',32990],['Samsung Galaxy Buds','Audio',8990],['Sony WH-1000XM6','Audio',22990],['Sony WF-1000XM6','Audio',16990],['Bose QuietComfort Ultra','Audio',24990],['JBL Live Beam','Audio',7990],['Anker Soundcore Liberty','Audio',5990],
  ['Apple Watch Series','Wearables',24990],['Apple Watch Ultra','Wearables',52990],['Samsung Galaxy Watch','Wearables',18990],['Google Pixel Watch','Wearables',19990],['Garmin Venu','Wearables',23990],['Fitbit Charge','Wearables',8990],['Xiaomi Smart Band','Wearables',2990],['Huawei Watch GT','Wearables',11990],['Samsung Galaxy Ring','Wearables',23990],
  ['Apple iPad','Tablets',23990],['iPad Air','Tablets',37990],['iPad Pro','Tablets',66990],['Samsung Galaxy Tab S11','Tablets',44990],['Samsung Galaxy Tab S11 Ultra','Tablets',69990],['Xiaomi Pad','Tablets',19990],['Lenovo Tab','Tablets',14990],['Huawei MatePad','Tablets',17990],
  ['Logitech MX Master 3S','Home office',6990],['Logitech MX Keys','Home office',7990],['HP OfficeJet Pro Printer','Home office',10990],['ASUS ProArt Monitor','Home office',30990],['LG UltraGear Monitor','Home office',21990],['Samsung Smart Monitor','Home office',19990],['Dell UltraSharp Monitor','Home office',27990],['Anker Webcam','Home office',3990],['Logitech Brio 4K','Home office',10990],
  ['Anker Power Bank','Accessories',3990],['Anker GaN Charger','Accessories',2790],['Apple MagSafe Charger','Accessories',2990],['Samsung 45W Charger','Accessories',2290],['UGREEN USB-C Hub','Accessories',3490],['Baseus Power Bank','Accessories',2490],['SanDisk Portable SSD','Accessories',5990],['Samsung T7 SSD','Accessories',6990],['Logitech Wireless Mouse','Accessories',1590],['Mechanical Keyboard','Accessories',4590]
];
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const imageFor = (name) => `https://picsum.photos/seed/techora-${slug(name)}/900/900`;

(async () => {
  const db = getPool(); if (!db) throw new Error('DATABASE_URL is missing.');
  for (const [name, category, price] of catalog) await db.query(`INSERT INTO products (id, name, category, price_pesos, rating, review_count, image_url, description, stock_quantity)
    VALUES ($1, $2, $3, $4, 4.6, 0, $5, $6, 15)
    ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category = EXCLUDED.category, price_pesos = EXCLUDED.price_pesos, image_url = EXCLUDED.image_url, updated_at = NOW()`, [slug(name), name, category, price, imageFor(name), `A carefully selected ${name} for your everyday technology setup.`]);
  const existing = await db.query('SELECT id, name FROM products');
  for (const product of existing.rows) await db.query('UPDATE products SET image_url = $1, updated_at = NOW() WHERE id = $2', [imageFor(product.name), product.id]);
  console.log(`Expanded catalog ready: ${catalog.length} products added or updated.`); await db.end();
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
