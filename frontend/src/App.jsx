import { useEffect, useMemo, useState } from 'react';
import { Icon, Modal, SearchField, LoadingState, EmptyState, ProductImage, BackToTop, useNotification } from './ui';
import { StoreHeader, ProductCard } from './components';
import { AuthModal, OrdersModal, ProfileModal } from './AccountModals';
import { ProductModal } from './ProductModal';
import AdminPanel from './AdminPanel';
import { money, categories } from './lib';

export default function App() {
  const isDemo = import.meta.env.VITE_DEMO === 'true';
  const [products, setProducts] = useState([]); const [category, setCategory] = useState('All'); const [sort, setSort] = useState(''); const [catalogVersion, setCatalogVersion] = useState(0); const [search, setSearch] = useState(''); const [catalogLoading, setCatalogLoading] = useState(true); const [catalogError, setCatalogError] = useState('');
  const filteredProducts = products.filter((product) => (product.name + ' ' + product.category).toLowerCase().includes(search.toLowerCase()));
  const [cart, setCart] = useState(() => {
    try {
      if (!JSON.parse(localStorage.getItem('techora-user') || 'null')) return [];
      const saved = JSON.parse(localStorage.getItem('techora-cart-php') || '[]');
      return Array.isArray(saved) ? saved : [];
    } catch { return []; }
  });
  const [drawer, setDrawer] = useState(false); const [checkout, setCheckout] = useState(false); const [auth, setAuth] = useState(null); const [ordersOpen, setOrdersOpen] = useState(false); const [profileOpen, setProfileOpen] = useState(false); const [productView, setProductView] = useState(null); const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('techora-user') || 'null')); const [notice, setNotice] = useNotification(); const [placingOrder, setPlacingOrder] = useState(false);
  const cartCount = useMemo(() => cart.reduce((count, item) => count + item.quantity, 0), [cart]); const total = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams(); if (category !== 'All') query.set('category', category); if (sort) query.set('sort', sort);
    setCatalogLoading(true); setCatalogError('');
    fetch(`/api/products?${query}`, { signal: controller.signal }).then(async (res) => {
      if (!res.ok) throw new Error('Unable to load products. Please try again.');
      const data = await res.json(); if (!Array.isArray(data)) throw new Error('The catalog is temporarily unavailable.'); return data;
    }).then(setProducts).catch((error) => { if (error.name !== 'AbortError') setCatalogError(error.message); }).finally(() => { if (!controller.signal.aborted) setCatalogLoading(false); });
    return () => controller.abort();
  }, [category, sort, catalogVersion]);
  useEffect(() => { const syncCatalog = (event) => { if (event.detail?.deletedId) setCart((items) => items.filter((item) => item.id !== event.detail.deletedId)); setCatalogVersion((version) => version + 1); }; window.addEventListener('techora-catalog-changed', syncCatalog); return () => window.removeEventListener('techora-catalog-changed', syncCatalog); }, []);
  useEffect(() => {
    if (user) localStorage.setItem('techora-cart-php', JSON.stringify(cart));
    else localStorage.removeItem('techora-cart-php');
  }, [cart, user]);
  useEffect(() => { const openReview = (event) => { const product = products.find((item) => item.name === event.detail); if (product) { setOrdersOpen(false); setProductView(product); } }; window.addEventListener('techora-review-product', openReview); return () => window.removeEventListener('techora-review-product', openReview); }, [products]);
  useEffect(() => { if (!drawer) return undefined; const closeOnOutsideClick = (event) => { if (!event.target.closest('.drawer') && !event.target.closest('.bag')) setDrawer(false); }; document.addEventListener('mousedown', closeOnOutsideClick); return () => document.removeEventListener('mousedown', closeOnOutsideClick); }, [drawer]);
  const go = (id) => document.getElementById(id)?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  function add(product) { if (!user) { setAuth('login'); setNotice('Sign in to add items to your bag.'); return; } if (product.stock === 0) return setNotice(`${product.name} is currently out of stock.`); setCart((items) => { const existing = items.find((item) => item.id === product.id); return existing ? items.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item) : [...items, { ...product, quantity: 1 }]; }); setNotice(`${product.name} added to your bag.`); }
  function signOut() { localStorage.removeItem('techora-user'); localStorage.removeItem('techora-cart-php'); setCart([]); setUser(null); setProfileOpen(false); setOrdersOpen(false); setCheckout(false); setDrawer(false); setNotice('You have been signed out.'); }
  function updateQuantity(id, delta) { setCart((items) => items.map((item) => item.id === id ? { ...item, quantity: item.quantity + delta } : item).filter((item) => item.quantity > 0)); }
  function authenticate(account) { if (account.role === 'ADMIN') localStorage.removeItem(`techora-admin-section-${account.id}`); setCart([]); setUser(account); setNotice(`Welcome to Techora, ${account.firstName}.`); }
  async function placeOrder() {
    setPlacingOrder(true);
    try {
      const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId: user.id, items: cart.map(({ id, quantity }) => ({ id, quantity })) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || result.error || 'Could not place your order.');
      setCart([]); setCheckout(false); setNotice(`Order ${result.order.id} confirmed — total ${money(result.order.total)}.`);
    } catch (error) { setNotice(error.message); } finally { setPlacingOrder(false); }
  }
  return <><a className="skip-link" href="#shop">Skip to products</a>
    {user?.role === 'ADMIN' && <AdminPanel user={user} close={signOut} />}
    {user?.role !== 'ADMIN' && <BackToTop />}
    <div className="announcement">{isDemo ? <>Public browser demo <span>•</span> Changes are saved on this device only</> : <>Technology for every day <span>•</span> Prices in Philippine pesos</>}</div>
    <StoreHeader user={user} cartCount={cartCount} go={go} profile={() => setProfileOpen(true)} orders={() => setOrdersOpen(true)} signOut={signOut} signIn={() => setAuth('login')} openBag={() => setDrawer(true)} />
    <main id="top">
      <section className="hero">
        <div className="hero-copy"><p className="eyebrow">Welcome to Techora</p><h1>Good tech.<br /><em>Great everyday.</em></h1><p>Find your next upgrade. Explore phones, laptops, audio and the little things that make a big difference.</p><div className="hero-actions"><button className="button dark" onClick={() => go('shop')}>Explore products <Icon name="arrow" size={17} /></button><button className="button secondary" onClick={() => go('why')}>Why Techora</button></div></div>
        <div className="hero-art"><img src="https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&w=1000&q=85" alt="A collection of modern electronics" /><div className="hero-caption"><span>Find your everyday essentials</span><Icon name="arrow" size={18} /></div></div>
      </section>
      <section className="benefits" id="why"><div><b><Icon name="shield" /></b><h3>Thoughtfully selected</h3><p>Explore technology from familiar brands.</p></div><div><b><Icon name="truck" /></b><h3>Stay in the loop</h3><p>Follow your order, from checkout to delivery.</p></div><div><b><Icon name="products" /></b><h3>Everything in one place</h3><p>From your desk setup to your daily essentials.</p></div></section>
      <section className="shop" id="shop">
        <div className="section-heading"><div><p className="eyebrow">The collection</p><h2>Your next upgrade starts here.</h2></div><span className="catalog-count">{filteredProducts.length} products</span></div>
        <div className="filters"><div className="catalog-tools"><SearchField value={search} onChange={setSearch} placeholder="Search this collection…" label="Search products" /><label>Sort by<select value={sort} onChange={(event) => setSort(event.target.value)}><option value="">Featured</option><option value="low">Price: low to high</option><option value="high">Price: high to low</option><option value="rating">Highest rated</option></select></label></div><div className="tabs" aria-label="Product categories">{categories.map((item) => <button key={item} className={category === item ? 'active' : ''} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div></div>
        {catalogLoading ? <LoadingState text="Loading the collection…" /> : catalogError ? <div className="form-error" role="alert">{catalogError} <button className="button secondary" onClick={() => setCatalogVersion((v) => v + 1)}>Try again</button></div> : <div className="products">{filteredProducts.length ? filteredProducts.map((product) => <ProductCard key={product.id} product={product} money={money} view={() => setProductView(product)} add={() => add(product)} />) : <EmptyState title="No products found">Try another category or search term.</EmptyState>}</div>}
      </section>
      <section className="account-cta"><p className="eyebrow">Your Techora account</p><h2>{user ? 'Everything you need, in your account.' : 'A little less effort. A better shopping day.'}</h2><p>Keep your delivery details ready, track your orders, and share your experience with the community.</p><button className="button lime" onClick={() => user ? setProfileOpen(true) : setAuth('signup')}>{user ? 'View your profile' : 'Create an account'} <Icon name="arrow" size={17} /></button></section>
    </main>
    <footer><button className="logo" onClick={() => go('top')}>TECH<span>ORA</span></button><p>Technology for your everyday.</p><small>© 2026 Techora. All rights reserved.</small></footer>
    {drawer && <Modal className="drawer" label="Shopping bag" close={() => setDrawer(false)}><div className="drawer-head"><h2>Your bag <small>{cartCount}</small></h2></div>{cart.length ? <>{cart.map((item) => <div className="cart-item" key={item.id}><ProductImage src={item.image} alt="" /><div><h3>{item.name}</h3><p>{money(item.price)}</p><div className="quantity"><button aria-label={`Decrease quantity of ${item.name}`} onClick={() => updateQuantity(item.id, -1)}>−</button><span>{item.quantity}</span><button aria-label={`Increase quantity of ${item.name}`} onClick={() => updateQuantity(item.id, 1)}>+</button></div></div><button className="remove" onClick={() => setCart((items) => items.filter((product) => product.id !== item.id))}>Remove</button></div>)}<div className="summary"><p>Subtotal <strong>{money(total)}</strong></p><button className="button dark" onClick={() => { setDrawer(false); if (user) setCheckout(true); else setAuth('signup'); }}>{user ? 'Proceed to checkout →' : 'Create account to checkout →'}</button></div></> : <p className="empty">Your bag is waiting for something good.</p>}</Modal>}
    {checkout && <Modal className="checkout-modal" label="Checkout" close={() => setCheckout(false)}><p className="eyebrow">Secure test checkout</p><h2 id="checkout-heading">Review your order.</h2><div className="checkout-details"><p><strong>Deliver to</strong><br />{user.firstName} {user.lastName}<br />{user.shippingAddress?.address1}<br />{user.shippingAddress?.city}, {user.shippingAddress?.state} {user.shippingAddress?.postalCode}<br />{user.shippingAddress?.country}</p><p><strong>Payment</strong><br />Cash on delivery (test)</p><p className="checkout-total">Order total <strong>{money(total)}</strong></p></div><button className="button dark" onClick={placeOrder} disabled={placingOrder}>{placingOrder ? 'Placing order…' : `Place order · ${money(total)}`}</button></Modal>}
    {auth && <AuthModal mode={auth} close={() => setAuth(null)} success={authenticate} switchMode={setAuth} />}{profileOpen && <ProfileModal user={user} close={() => setProfileOpen(false)} openOrders={() => setOrdersOpen(true)} signOut={signOut} />}{ordersOpen && <OrdersModal user={user} close={() => setOrdersOpen(false)} />}{productView && <ProductModal product={productView} close={() => setProductView(null)} add={add} />}{notice && <button role="status" className="toast" onClick={() => setNotice('')}>{notice}</button>}</>;
}
