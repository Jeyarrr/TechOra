import { useEffect, useRef, useState } from 'react';
import { Icon, Modal, Field, SearchField, LoadingState, EmptyState, ProductImage, BackToTop, useNotification } from './ui';
import { Pagination } from './components';
import { money, categories, readResponse } from './lib';

export default function AdminPanel({ user, close }) {
  const modules = [
    { id: 'Dashboard', label: 'Dashboard', icon: 'dashboard' },
    { id: 'Product', label: 'Products', icon: 'products' },
    { id: 'Order', label: 'Orders', icon: 'orders' },
    { id: 'Customers', label: 'Customers', icon: 'customers' },
    { id: 'Promotions & reviews', label: 'Promotions & reviews', icon: 'promotions' },
    { id: 'Reports & settings', label: 'Reports & settings', icon: 'reports' }
  ];
  const savedSection = localStorage.getItem(`techora-admin-section-${user.id}`);
  const [section, setSection] = useState(modules.some((item) => item.id === savedSection) ? savedSection : 'Dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [reports, setReports] = useState(null);
  const [message, setMessage] = useNotification();
  const scrollRef = useRef(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [editorProduct, setEditorProduct] = useState(undefined);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [adminMenu, setAdminMenu] = useState(false);
  const [insightModal, setInsightModal] = useState(null);
  const [productCategory, setProductCategory] = useState('All');
  const [query, setQuery] = useState('');
  const [orderFilter, setOrderFilter] = useState('All');
  const [page, setPage] = useState(1);
  const [savingOrder, setSavingOrder] = useState(null);
  const statuses = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED'];
  const currentModule = modules.find((item) => item.id === section);
  async function load() {
    setLoading(true); setLoadError('');
    try {
      const result = await Promise.all(['dashboard', 'products', 'orders', 'customers', 'promotions-reviews', 'reports-settings'].map(async (path) => {
        const response = await fetch(`/api/admin/${path}?userId=${user.id}`);
        return readResponse(response);
      }));
      setDashboard(result[0]); setProducts(result[1]); setOrders(result[2]); setCustomers(result[3]); setPromotions(result[4]); setReports(result[5]);
    } catch (error) { setLoadError(error.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  useEffect(() => { document.body.classList.add('admin-open'); return () => document.body.classList.remove('admin-open'); }, []);
  useEffect(() => { localStorage.setItem(`techora-admin-section-${user.id}`, section); }, [section, user.id]);
  useEffect(() => {
    if (!adminMenu) return;
    function key(event) { if (event.key === 'Escape') { setAdminMenu(false); document.querySelector('.admin-menu-toggle')?.focus(); } }
    const desktop = matchMedia('(min-width:781px)');
    const resize = () => { if (desktop.matches) setAdminMenu(false); };
    document.addEventListener('keydown', key); desktop.addEventListener('change', resize);
    return () => { document.removeEventListener('keydown', key); desktop.removeEventListener('change', resize); };
  }, [adminMenu]);
  async function updateProduct(id, patch) {
    const response = await fetch(`/api/admin/products/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, ...patch }) });
    const data = await readResponse(response);
    setProducts((items) => items.map((item) => item.id === id ? data.product : item));
    window.dispatchEvent(new CustomEvent('techora-catalog-changed')); setMessage('Product saved.');
  }
  async function saveEditor(form) {
    const editing = Boolean(form.id);
    const response = await fetch(editing ? `/api/admin/products/${form.id}` : '/api/admin/products', { method: editing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, ...form }) });
    const data = await readResponse(response);
    setProducts((items) => editing ? items.map((item) => item.id === form.id ? data.product : item) : [data.product, ...items]);
    window.dispatchEvent(new CustomEvent('techora-catalog-changed')); setMessage(editing ? 'Product updated.' : 'Product added.'); return null;
  }
  async function deleteProduct(product, password) {
    const response = await fetch(`/api/admin/products/${product.id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, password }) });
    const data = await readResponse(response);
    setProducts((items) => items.filter((item) => item.id !== product.id));
    window.dispatchEvent(new CustomEvent('techora-catalog-changed', { detail: { deletedId: product.id } })); setMessage(data.message); return null;
  }
  async function updateStatus(id, status) {
    setSavingOrder(id);
    try {
      const response = await fetch(`/api/admin/orders/${id}/status`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, status }) });
      await readResponse(response);
      setOrders((items) => items.map((item) => item.id === id ? { ...item, status } : item)); setMessage('Order status updated.');
    } catch (error) { setMessage(error.message); }
    finally { setSavingOrder(null); }
  }
  function selectSection(id) {
    setSection(id); setAdminMenu(false); setQuery(''); setPage(1);
    scrollRef.current?.scrollTo({ top: 0 });
    if (adminMenu) document.querySelector('.admin-menu-toggle')?.focus();
  }
  const productCategories = ['All', ...new Set(products.map((product) => product.category).filter(Boolean)), ...(productCategory !== 'All' && !products.some((p) => p.category === productCategory) ? [productCategory] : [])];
  const matches = (...values) => values.join(' ').toLowerCase().includes(query.trim().toLowerCase());
  const filtered = section === 'Product' ? products.filter((p) => (productCategory === 'All' || p.category === productCategory) && matches(p.name, p.category))
    : section === 'Order' ? orders.filter((o) => (orderFilter === 'All' || o.status === orderFilter) && matches(o.id, o.customer))
    : section === 'Customers' ? customers.filter((c) => matches(c.name, c.email, c.phone, c.city))
    : promotions.filter((p) => matches(p.name, p.badge));
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const currentPage = Math.min(page, pages);
  const visible = filtered.slice((currentPage - 1) * 12, currentPage * 12);
  const pagination = <Pagination page={currentPage} totalPages={pages} total={filtered.length} onChange={setPage} />;
  const searchControl = <SearchField value={query} onChange={(value) => { setQuery(value); setPage(1); }} placeholder={'Search ' + currentModule.label.toLowerCase() + '…'} label={'Search ' + currentModule.label} />;
  const heading = (eyebrow, title, action) => <div className="admin-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2></div>{action}</div>;
  function content() {
    if (loading) return <LoadingState text="Loading your workspace…" />;
    if (loadError) return <div className="form-error" role="alert"><p>{loadError}</p><button className="button secondary" onClick={load}>Try again</button></div>;
    if (section === 'Dashboard') return <>
      {heading('Your store at a glance', 'Overview', <button className="button secondary" onClick={load}><Icon name="refresh" size={16} />Refresh data</button>)}
      <div className="metric-grid"><Metric label="Revenue" value={dashboard ? money(dashboard.revenue) : '—'} /><Metric label="Orders" value={dashboard?.orders ?? '—'} /><Metric label="Customers" value={dashboard?.customers ?? '—'} /><Metric label="Low stock alerts" value={dashboard?.lowStock?.length ?? '—'} /></div>
      <DashboardInsights dashboard={dashboard} open={setInsightModal} />
      <section className="admin-card"><h3>Stock that needs attention</h3>{dashboard?.lowStock?.length ? dashboard.lowStock.map((product) => <p className="alert-row" key={product.id}><span>{product.name}</span><strong>{product.stock} left</strong></p>) : <p className="empty">All products have healthy stock levels.</p>}</section>
    </>;
    if (section === 'Product') return <>
      {heading('Catalog management', 'Products', <button className="button dark" onClick={() => setEditorProduct(null)}><Icon name="plus" size={17} />Add product</button>)}
      <div className="admin-product-controls">{searchControl}<label>Category<select value={productCategory} onChange={(event) => { setProductCategory(event.target.value); setPage(1); }}>{productCategories.map((item) => <option key={item}>{item}</option>)}</select></label></div>
      <section className="admin-card admin-table" aria-label="Products"><div className="table-head" aria-hidden="true"><span>Product</span><span>Category</span><span>Price (₱)</span><span>Stock</span><span>Actions</span></div>{visible.length ? visible.map((product) => <ProductRow key={product.id} product={product} onSave={updateProduct} onEdit={setEditorProduct} onDelete={setDeletingProduct} />) : <EmptyState title="No matching products">Try another category or search term.</EmptyState>}</section>{pagination}
    </>;
    if (section === 'Order') return <>
      {heading('Fulfilment', 'Orders & delivery')}
      <div className="admin-product-controls">{searchControl}<label>Status<select value={orderFilter} onChange={(event) => { setOrderFilter(event.target.value); setPage(1); }}><option>All</option>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></label></div>
      <section className="admin-card admin-table" aria-label="Orders"><div className="order-table-head" aria-hidden="true"><span>Order</span><span>Customer</span><span>Total</span><span>Status</span></div>{visible.length ? visible.map((order) => <div className="order-table-row" key={order.id}><strong>{order.id}</strong><span>{order.customer}</span><span>{money(order.total)}</span><select aria-label={'Status for order ' + order.id} disabled={savingOrder === order.id} value={order.status} onChange={(event) => updateStatus(order.id, event.target.value)}>{statuses.map((status) => <option key={status} value={status}>{status.replaceAll('_', ' ')}</option>)}</select></div>) : <EmptyState title="No matching orders">Orders will appear here after customers check out.</EmptyState>}</section>{pagination}
    </>;
    if (section === 'Customers') return <>
      {heading('Customer management', 'Customers')}<div className="admin-list-tools">{searchControl}<span className="catalog-count">{filtered.length} customers</span></div>
      <section className="admin-card admin-table" aria-label="Customers"><div className="customer-table-head" aria-hidden="true"><span>Customer</span><span>Contact</span><span>Location</span><span>Orders</span><span>Total spend</span></div>{visible.length ? visible.map((customer) => <div className="customer-table-row" key={customer.id}><strong>{customer.name}</strong><span>{customer.email}<small>{customer.phone}</small></span><span>{customer.city ? `${customer.city}, ${customer.state}` : 'No address yet'}</span><span>{customer.orderCount}</span><strong>{money(customer.orderTotal)}</strong></div>) : <EmptyState title="No matching customers">Try a name, email address or phone number.</EmptyState>}</section>{pagination}
    </>;
    if (section === 'Promotions & reviews') return <>
      {heading('Growth & feedback', 'Promotions & reviews')}
      <div className="metric-grid"><Metric label="Featured products" value={promotions.filter((p) => p.badge).length} /><Metric label="Catalog reviews" value={promotions.reduce((sum, p) => sum + Number(p.reviews), 0)} /><Metric label="Average rating" value={promotions.length ? (promotions.reduce((sum, p) => sum + Number(p.rating), 0) / promotions.length).toFixed(1) : '—'} /><Metric label="Active badges" value={promotions.filter((p) => p.badge).length} /></div>
      <div className="admin-list-tools">{searchControl}</div>
      <section className="admin-card admin-table" aria-label="Promotions and reviews"><div className="promotion-table-head" aria-hidden="true"><span>Product</span><span>Promotion</span><span>Rating</span><span>Reviews</span><span>Price</span></div>{visible.length ? visible.map((product) => <div className="promotion-table-row" key={product.id}><strong>{product.name}</strong><span>{product.badge || 'No active promotion'}</span><span>★ {product.rating}</span><span>{product.reviews}</span><strong>{money(product.price)}</strong></div>) : <EmptyState title="No matching products" />}</section>{pagination}
    </>;
    return <>
      {heading('Platform controls', 'Reports & settings')}
      <div className="metric-grid"><Metric label="Products" value={reports?.inventory?.products ?? '—'} /><Metric label="Units in stock" value={reports?.inventory?.units ?? '—'} /><Metric label="Low stock" value={reports?.inventory?.low_stock ?? '—'} /><Metric label="Currency" value={reports?.currency ?? 'PHP'} /></div>
      <div className="report-grid"><section className="admin-card"><h3>User accounts & roles</h3>{reports?.roles?.length ? reports.roles.map((role) => <p className="setting-row" key={role.role}><span>{role.role}</span><strong>{role.count} users</strong></p>) : <p className="empty">No role data available.</p>}</section><section className="admin-card"><h3>Store settings</h3><p className="setting-row"><span>Store</span><strong>{reports?.store ?? 'Techora'}</strong></p><p className="setting-row"><span>Currency</span><strong>Philippine peso (PHP)</strong></p><p className="setting-row"><span>Fulfilment</span><strong>Order status updates enabled</strong></p></section><section className="admin-card"><h3>Recent orders</h3>{reports?.recentOrders?.length ? reports.recentOrders.map((order) => <p className="setting-row" key={order.id}><span>{order.id}<br />{order.status.replaceAll('_', ' ')}</span><strong>{money(order.total)}</strong></p>) : <p className="empty">No orders yet.</p>}</section></div>
    </>;
  }
  return <>
    <div className="admin-shell">
      {adminMenu && <button className="admin-menu-backdrop" aria-label="Close admin navigation" onClick={() => setAdminMenu(false)} />}
      <aside className={`admin-sidebar ${adminMenu ? 'menu-open' : ''}`} aria-label="Administration">
        <div className="admin-brand"><button className="admin-menu-toggle" aria-label={adminMenu ? 'Close admin navigation' : 'Open admin navigation'} aria-expanded={adminMenu} aria-controls="admin-navigation" onClick={() => setAdminMenu(!adminMenu)}><Icon name={adminMenu ? 'close' : 'menu'} /></button><button className="logo" onClick={close} aria-label="Return to storefront">TECH<span>ORA</span></button></div>
        <div className="admin-navigation" id="admin-navigation"><p>Workspace</p>{modules.map((item) => <button className={section === item.id ? 'active' : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => selectSection(item.id)} key={item.id}><span className="admin-nav-icon"><AdminNavIcon name={item.icon} /></span>{item.label}</button>)}
          <div className="admin-user"><span>Signed in as</span><strong>{user.firstName} {user.lastName}</strong><small>{user.email}</small></div>
          <button className="exit-admin" onClick={close}><Icon name="logout" size={17} />Sign out / storefront</button>
        </div>
      </aside>
      <main ref={scrollRef} className="admin-main" id="admin-content" inert={adminMenu || undefined}><div className="admin-page-top"><span>Workspace <Icon name="arrow" size={12} /><strong>{currentModule.label}</strong></span><span>Techora administration</span></div>{message && <button className="admin-message" role="status" onClick={() => setMessage('')}>{message}</button>}{content()}<BackToTop scrollRef={scrollRef} /></main>
    </div>
    {editorProduct !== undefined && <ProductEditor product={editorProduct} save={saveEditor} close={() => setEditorProduct(undefined)} />}
    {deletingProduct && <DeleteProductModal product={deletingProduct} remove={deleteProduct} close={() => setDeletingProduct(null)} />}
    {insightModal && <DashboardInsightModal type={insightModal} dashboard={dashboard} close={() => setInsightModal(null)} />}
  </>;
}

function AdminNavIcon({ name }) { return <Icon name={name} size={18} />; }

function Metric({ label, value }) { return <article className="metric"><span>{label}</span><strong>{value}</strong></article>; }

function DashboardInsights({ dashboard, open }) {
  const popular = dashboard?.popularProducts || []; const topOrders = dashboard?.topOrders || []; const topCustomers = dashboard?.topCustomers || [];
  return <div className="dashboard-insights">
    <button className="admin-card insight-card insight-open" onClick={() => open('products')}><div className="insight-heading"><div><p className="eyebrow">Best sellers</p><h3>Popular products</h3></div><span>Top 5 · View</span></div>{popular.length ? popular.map((product, index) => <div className="popular-product" key={product.id}><b>{index + 1}</b><ProductImage src={product.image} alt="" /><div><strong>{product.name}</strong><small>{product.category}</small></div><span>{product.unitsSold} sold</span></div>) : <p className="empty">Sales will appear here after orders are placed.</p>}</button>
    <button className="admin-card insight-card insight-open" onClick={() => open('orders')}><div className="insight-heading"><div><p className="eyebrow">Highest value</p><h3>Top purchase orders</h3></div><span>Top 5 · View</span></div>{topOrders.length ? topOrders.map((order) => <div className="insight-row" key={order.id}><div><strong>{order.id}</strong><small>{order.customer} · {order.itemCount} item{order.itemCount === 1 ? '' : 's'}</small></div><b>{money(order.total)}</b></div>) : <p className="empty">No completed purchases yet.</p>}</button>
    <button className="admin-card insight-card insight-open" onClick={() => open('customers')}><div className="insight-heading"><div><p className="eyebrow">Returning shoppers</p><h3>Top customers</h3></div><span>Top 5 · View</span></div>{topCustomers.length ? topCustomers.map((customer) => <div className="insight-row" key={customer.id}><div><strong>{customer.name}</strong><small>{customer.orderCount} order{customer.orderCount === 1 ? '' : 's'} · {customer.email}</small></div><b>{money(customer.totalSpent)}</b></div>) : <p className="empty">Customer activity will appear here.</p>}</button>
  </div>;
}

function DashboardInsightModal({ type, dashboard, close }) {
  const labels = { products: ['Best sellers', 'Popular products'], orders: ['Highest-value purchases', 'Top purchase orders'], customers: ['Returning shoppers', 'Top customers'] }; const [eyebrow, title] = labels[type];
  const rows = type === 'products' ? dashboard?.popularProducts || [] : type === 'orders' ? dashboard?.topOrders || [] : dashboard?.topCustomers || [];
  return <Modal close={close} className="insight-modal"><p className="eyebrow">{eyebrow}</p><h2 id="insight-modal-title">{title}</h2><p className="modal-copy">Showing the five strongest results from your current store data.</p><div className="insight-modal-list">{rows.length ? rows.map((row, index) => type === 'products' ? <article className="insight-detail-product" key={row.id}><b>{index + 1}</b><ProductImage src={row.image} alt="" /><div><strong>{row.name}</strong><small>{row.category} · {money(row.price)}</small></div><span><strong>{row.unitsSold}</strong> units sold<br />{row.orderCount} order{row.orderCount === 1 ? '' : 's'}</span></article> : type === 'orders' ? <article className="insight-detail-row" key={row.id}><div><strong>{row.id}</strong><small>{row.customer} · {row.itemCount} item{row.itemCount === 1 ? '' : 's'} · {row.status.replaceAll('_', ' ')}</small></div><b>{money(row.total)}</b></article> : <article className="insight-detail-row" key={row.id}><div><strong>{row.name}</strong><small>{row.email} · {row.orderCount} order{row.orderCount === 1 ? '' : 's'}</small></div><b>{money(row.totalSpent)}</b></article>) : <p className="empty">There is no data to show yet.</p>}</div></Modal>;
}

function ProductEditor({ product, save, close }) {
  const adding = !product; const [form, setForm] = useState(product || { name: '', category: 'Smartphones', price: '', stock: 10, image: '', imageData: '', description: '' }); const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const [readingImage, setReadingImage] = useState(false);
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  function uploadImage(event) { const file = event.target.files?.[0]; if (!file) return; if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) return setError('Please choose a JPG, PNG, WebP, or GIF image.'); if (file.size > 4 * 1024 * 1024) return setError('Image must be smaller than 4 MB.'); setReadingImage(true); const reader = new FileReader(); reader.onload = () => { update('imageData', reader.result); update('image', ''); setError(''); setReadingImage(false); }; reader.onerror = () => { setError('Could not read this image. Please choose it again.'); setReadingImage(false); }; reader.readAsDataURL(file); }
  async function submit(event) { event.preventDefault(); if (saving || readingImage) return; setSaving(true); setError(''); try { const result = await save({ ...form, price: Number(form.price), stock: Number(form.stock) }); if (result) setError(result); else close(); } catch (reason) { setError(reason.message || 'Could not save this product.'); } finally { setSaving(false); } }
  return <Modal close={close} className="product-editor"><p className="eyebrow">Admin catalog</p><h2>{adding ? 'Add product' : 'Edit product'}</h2><form className="auth-form" onSubmit={submit}><Field label="Product name" value={form.name} onChange={(value) => update('name', value)} required /><label className="field"><span>Category</span><select value={form.category} onChange={(event) => update('category', event.target.value)}>{categories.filter((item) => item !== 'All').map((item) => <option key={item}>{item}</option>)}</select></label><div className="two-fields"><Field label="Price (₱)" type="number" min="0" step="1" value={form.price} onChange={(value) => update('price', value)} required /><Field label="Stock quantity" type="number" min="0" step="1" value={form.stock} onChange={(value) => update('stock', value)} required /></div><label className="field image-upload"><span>Product image</span><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={uploadImage} required={adding && !form.image} /><small>JPG, PNG, WebP, or GIF · maximum 4 MB</small></label>{(form.imageData || form.image) && <img className="upload-preview" src={form.imageData || form.image} alt="Product upload preview" />}<label className="field"><span>Description</span><textarea value={form.description || ''} onChange={(event) => update('description', event.target.value)} placeholder="Product description" /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button dark" disabled={saving || readingImage}>{readingImage ? 'Reading image…' : saving ? 'Saving product…' : adding ? 'Add product' : 'Save changes'}</button></form></Modal>;
}

function DeleteProductModal({ product, remove, close }) {
  const [password, setPassword] = useState(''); const [error, setError] = useState(''); const [saving, setSaving] = useState(false);
  async function submit(event) { event.preventDefault(); if (saving) return; setSaving(true); setError(''); try { const result = await remove(product, password); if (result) setError(result); else close(); } catch (reason) { setError(reason.message || 'Could not delete this product.'); } finally { setSaving(false); } }
  return <Modal close={close} className="delete-product-modal"><p className="eyebrow">Permanent action</p><h2 id="delete-product-title">Delete {product.name}?</h2><p>This permanently removes the product, its reviews, and its uploaded image. It cannot be undone.</p><form className="auth-form" onSubmit={submit}><Field label="Admin password" type="password" value={password} onChange={setPassword} autoComplete="current-password" required />{error && <p className="form-error" role="alert">{error}</p>}<div className="delete-actions"><button type="button" onClick={close}>Cancel</button><button className="delete-product-button" disabled={saving}>{saving ? 'Deleting…' : 'Permanently delete'}</button></div></form></Modal>;
}

function ProductRow({ product, onSave, onEdit, onDelete }) {
  const [price, setPrice] = useState(product.price); const [stock, setStock] = useState(product.stock);
  const [saving, setSaving] = useState(false); const [error, setError] = useState('');
  useEffect(() => { setPrice(product.price); setStock(product.stock); }, [product]);
  async function save() {
    if (price === '' || stock === '' || !Number.isInteger(Number(price)) || !Number.isInteger(Number(stock)) || Number(price) < 0 || Number(stock) < 0) { setError('Price and stock must be whole numbers of zero or more.'); return; }
    setSaving(true); setError('');
    try { await onSave(product.id, { price: Number(price), stock: Number(stock) }); }
    catch (reason) { setError(reason.message || 'Could not save this product.'); } finally { setSaving(false); }
  }
  return <div className={`product-row ${product.stock <= 5 ? 'low' : ''}`}>
    <strong className="admin-product-name"><ProductImage src={product.image} alt="" />{product.name}</strong>
    <span>{product.category}</span>
    <label className="admin-edit-field"><small>Price (₱)</small><input type="number" min="0" step="1" value={price} onChange={(event) => setPrice(event.target.value)} /></label>
    <label className="admin-edit-field"><small>Stock</small><input type="number" min="0" step="1" value={stock} onChange={(event) => setStock(event.target.value)} /></label>
    <div className="row-actions"><button disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save'}</button><button className="edit-product" disabled={saving} onClick={() => onEdit(product)}>Edit</button><button className="delete-row-button" disabled={saving} onClick={() => onDelete(product)}>Delete</button></div>
    {error && <p className="form-error row-error" role="alert">{error}</p>}
  </div>;
}
