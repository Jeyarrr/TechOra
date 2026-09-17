// GitHub Pages cannot run Express or PostgreSQL. This small in-browser API makes
// the public demo interactive while keeping the real local/full-stack app intact.
const storageKey = 'techora-pages-demo-v1';

const catalog = [
  ['nova-x1', 'Nova X1', 'Smartphones', 56116, 4.9, 284, 'New', 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?auto=format&fit=crop&w=900&q=85', 'Flagship performance, an edge-to-edge OLED display, and a camera that catches every detail.'],
  ['aero-pro', 'Aero Pro', 'Laptops', 81084, 4.8, 156, 'Best seller', 'https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=85', 'A thin, powerful laptop engineered for deep work, creative flow, and life on the move.'],
  ['pulse-max', 'Pulse Max', 'Audio', 15543, 4.7, 412, 'Popular', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=900&q=85', 'Immersive adaptive sound with all-day comfort and intelligent noise control.'],
  ['orbit-watch', 'Orbit Watch', 'Wearables', 20536, 4.8, 198, 'New', 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=85', 'Health insights, training metrics, and a refined design that goes everywhere.'],
  ['halo-desk', 'Halo Desk Lamp', 'Home office', 7428, 4.6, 75, '', 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?auto=format&fit=crop&w=900&q=85', 'Warm, focused light with touch controls and a beautifully minimal silhouette.'],
  ['frame-mini', 'Frame Mini', 'Tablets', 29899, 4.7, 104, '', 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=900&q=85', 'A compact canvas for notes, shows, sketches, and your most important ideas.'],
  ['key-01', 'Key 01', 'Home office', 8676, 4.8, 63, '', 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=900&q=85', 'A satisfying mechanical keyboard designed for focused, quiet productivity.'],
  ['arc-charge', 'Arc Charge', 'Accessories', 4307, 4.5, 221, '', 'https://images.unsplash.com/photo-1587033411391-5d9e51cce126?auto=format&fit=crop&w=900&q=85', 'A compact multi-device charging hub that keeps every essential powered.']
].map(([id, name, category, price, rating, reviews, badge, image, description], index) => ({ id, name, category, price, rating, reviews, badge, image, description, stock: index === 4 ? 4 : 15 }));

const defaultState = () => ({ products: catalog, users: [], orders: [], reviews: {} });
const read = () => { try { return { ...defaultState(), ...JSON.parse(localStorage.getItem(storageKey) || '{}') }; } catch { return defaultState(); } };
const write = (state) => localStorage.setItem(storageKey, JSON.stringify(state));
const id = (prefix) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const json = (value, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
const failure = (message, status = 400) => json({ message }, status);
const bodyOf = (init) => { try { return init?.body ? JSON.parse(init.body) : {}; } catch { return {}; } };
const publicUser = (user) => ({ id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, phone: user.phone, role: user.role || 'CUSTOMER', shippingAddress: user.shippingAddress });

function customers(state) {
  return state.users.filter((user) => user.role !== 'ADMIN').map((user) => {
    const orders = state.orders.filter((order) => order.userId === user.id);
    return { id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email, phone: user.phone, city: user.shippingAddress?.city || '', state: user.shippingAddress?.state || '', orderCount: orders.length, orderTotal: orders.reduce((sum, order) => sum + order.total, 0) };
  });
}

function adminDashboard(state) {
  const validOrders = state.orders.filter((order) => order.status !== 'CANCELLED');
  const topProducts = state.products.map((product) => {
    const matching = validOrders.flatMap((order) => order.items).filter((item) => item.id === product.id);
    return { ...product, unitsSold: matching.reduce((sum, item) => sum + item.quantity, 0), orderCount: matching.length };
  }).sort((a, b) => b.unitsSold - a.unitsSold || b.rating - a.rating).slice(0, 5);
  return { revenue: validOrders.reduce((sum, order) => sum + order.total, 0), orders: state.orders.length, customers: customers(state).length, lowStock: state.products.filter((product) => product.stock <= 5), latestOrders: state.orders.slice(0, 6), popularProducts: topProducts, topOrders: [...validOrders].sort((a, b) => b.total - a.total).slice(0, 5), topCustomers: customers(state).sort((a, b) => b.orderCount - a.orderCount || b.orderTotal - a.orderTotal).slice(0, 5) };
}

export function installDemoApi() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input, init = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, window.location.origin);
    if (!url.pathname.startsWith('/api/')) return originalFetch(input, init);
    const state = read(); const body = bodyOf(init); const method = (init.method || 'GET').toUpperCase(); const path = url.pathname;

    if (path === '/api/products' && method === 'GET') {
      let products = [...state.products]; const category = url.searchParams.get('category'); const sort = url.searchParams.get('sort');
      if (category) products = products.filter((product) => product.category === category);
      if (sort === 'low') products.sort((a, b) => a.price - b.price);
      if (sort === 'high') products.sort((a, b) => b.price - a.price);
      if (sort === 'rating') products.sort((a, b) => b.rating - a.rating);
      return json(products);
    }
    if (path === '/api/auth/forgot-password') return json({ message: 'Demo mode: password-reset email is not sent.' });
    if (path === '/api/auth/register' && method === 'POST') {
      if (state.users.some((user) => user.email === String(body.email).toLowerCase())) return failure('An account already exists for this email.', 409);
      const user = { id: id('customer'), firstName: body.firstName, lastName: body.lastName, email: String(body.email || '').toLowerCase(), phone: body.phone, role: 'CUSTOMER', shippingAddress: { address1: body.address1, address2: body.address2 || '', city: body.city, state: body.state, postalCode: body.postalCode, country: body.country || 'Philippines' } };
      state.users.push(user); write(state); return json({ success: true, user: publicUser(user) }, 201);
    }
    if (path === '/api/auth/login' && method === 'POST') {
      const email = String(body.email || '').toLowerCase();
      if (email === 'admin@techora.demo' && body.password === 'demo-admin') return json({ user: { id: 'demo-admin', firstName: 'Demo', lastName: 'Admin', email, phone: '09171234567', role: 'ADMIN', shippingAddress: null } });
      let user = state.users.find((account) => account.email === email);
      if (!user) { user = { id: id('customer'), firstName: 'Demo', lastName: 'Shopper', email: email || 'shopper@techora.demo', phone: '09171234567', role: 'CUSTOMER', shippingAddress: { address1: 'Demo address', address2: '', city: 'Manila', state: 'Metro Manila', postalCode: '1000', country: 'Philippines' } }; state.users.push(user); write(state); }
      return json({ user: publicUser(user) });
    }
    if (path === '/api/account/profile' && method === 'PATCH') {
      const user = state.users.find((account) => account.id === body.userId);
      if (!user) return failure('Demo account was not found.', 404);
      Object.assign(user, { firstName: body.firstName, lastName: body.lastName, email: body.email, phone: body.phone, shippingAddress: { address1: body.address1, address2: body.address2 || '', city: body.city, state: body.state, postalCode: body.postalCode, country: body.country } }); write(state); return json({ user: publicUser(user) });
    }
    const reviewMatch = path.match(/^\/api\/products\/([^/]+)\/reviews$/);
    if (reviewMatch) {
      const productId = reviewMatch[1]; const reviews = state.reviews[productId] || [];
      if (method === 'GET') return json(reviews);
      const user = state.users.find((account) => account.id === body.userId) || { firstName: 'Demo', lastName: 'Shopper' };
      reviews.unshift({ id: id('review'), customer: `${user.firstName} ${user.lastName?.[0] || ''}.`, rating: Number(body.rating), comment: body.comment }); state.reviews[productId] = reviews; write(state); return json({ success: true, message: 'Thank you for your demo review.' }, 201);
    }
    if (path === '/api/orders' && method === 'POST') {
      const items = body.items.map((item) => ({ ...state.products.find((product) => product.id === item.id), quantity: item.quantity })).filter(Boolean);
      if (!items.length) return failure('Your bag is empty.');
      const order = { id: `TO-${Date.now().toString().slice(-8)}`, userId: body.userId, customer: `${state.users.find((user) => user.id === body.userId)?.firstName || 'Demo'} Shopper`, items: items.map((item) => ({ id: item.id, name: item.name, quantity: item.quantity })), total: items.reduce((sum, item) => sum + item.price * item.quantity, 0), status: 'PENDING', createdAt: new Date().toISOString() };
      state.orders.unshift(order); write(state); return json({ order }, 201);
    }
    if (path === '/api/orders' && method === 'GET') return json(state.orders.filter((order) => order.userId === url.searchParams.get('userId')));
    if (path.startsWith('/api/admin/')) {
      if (path === '/api/admin/dashboard') return json(adminDashboard(state));
      if (path === '/api/admin/products' && method === 'GET') return json(state.products);
      if (path === '/api/admin/products' && method === 'POST') { const product = { id: id('product'), name: body.name, category: body.category, price: Number(body.price), stock: Number(body.stock), image: body.imageData || body.image, description: body.description || `A new ${body.name} added to the Techora demo catalog.`, rating: 0, reviews: 0, badge: '' }; state.products.unshift(product); write(state); return json({ product }, 201); }
      const productMatch = path.match(/^\/api\/admin\/products\/([^/]+)$/);
      if (productMatch) { const index = state.products.findIndex((product) => product.id === productMatch[1]); if (index < 0) return failure('Product not found.', 404); if (method === 'DELETE') { if (body.password !== 'demo-admin') return failure('Use demo-admin to confirm this demo deletion.', 401); state.products.splice(index, 1); write(state); return json({ message: 'Product deleted from this browser demo.' }); } const product = state.products[index]; Object.assign(product, { ...body, price: body.price === undefined ? product.price : Number(body.price), stock: body.stock === undefined ? product.stock : Number(body.stock), image: body.imageData || product.image }); delete product.userId; delete product.imageData; write(state); return json({ product }); }
      if (path === '/api/admin/orders') return json(state.orders);
      const statusMatch = path.match(/^\/api\/admin\/orders\/([^/]+)\/status$/);
      if (statusMatch) { const order = state.orders.find((item) => item.id === statusMatch[1]); if (!order) return failure('Order not found.', 404); order.status = body.status; write(state); return json({ order }); }
      if (path === '/api/admin/customers') return json(customers(state));
      if (path === '/api/admin/promotions-reviews') return json(state.products);
      if (path === '/api/admin/reports-settings') return json({ inventory: { products: state.products.length, units: state.products.reduce((sum, product) => sum + product.stock, 0), low_stock: state.products.filter((product) => product.stock <= 5).length }, roles: [{ role: 'ADMIN', count: 1 }, { role: 'CUSTOMER', count: customers(state).length }], recentOrders: state.orders.slice(0, 5), currency: 'PHP', store: 'Techora demo' });
    }
    return failure('This feature is unavailable in the GitHub Pages demo.', 404);
  };
}
