import { useEffect, useRef, useState } from 'react';
import { Icon, ProductImage } from './ui';

export function StoreHeader({ user, cartCount, go, profile, orders, signOut, signIn, openBag }) {
  const [open, setOpen] = useState(false);
  const menu = useRef(null);
  const toggle = useRef(null);
  useEffect(() => {
    if (!open) return;
    function outside(event) { if (!menu.current?.contains(event.target)) setOpen(false); }
    function key(event) { if (event.key === 'Escape') { setOpen(false); toggle.current?.focus(); } }
    const desktop = matchMedia('(min-width:901px)');
    const resize = () => { if (desktop.matches) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', key);
    desktop.addEventListener('change', resize);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); desktop.removeEventListener('change', resize); };
  }, [open]);
  function run(action) { setOpen(false); action(); }
  return <header className="site-header">
    <button className="logo" onClick={() => go('top')} aria-label="Techora home">TECH<span>ORA</span></button>
    <nav aria-label="Store navigation"><button onClick={() => go('top')}>Home</button><button onClick={() => go('shop')}>Products</button><button onClick={() => go('shop')}>Categories</button><button onClick={() => go('why')}>Why Techora</button></nav>
    <div className="actions">
      {user ? <><div className="customer-text-links"><button onClick={profile}>Profile</button><button onClick={orders}>Orders</button></div><button className="sign-out" onClick={signOut}>Sign out</button></> : <button className="round" onClick={signIn}>Sign in</button>}
      <button className="bag" aria-label={cartCount ? 'Open shopping bag, ' + cartCount + ' items' : 'Open shopping bag'} onClick={() => run(openBag)}><Icon name="bag" />{cartCount > 0 && <span>{cartCount}</span>}</button>
      <div className="mobile-account" ref={menu}>
        <button ref={toggle} className="mobile-menu-toggle" aria-label={open ? 'Close navigation' : 'Open navigation'} aria-expanded={open} aria-controls="customer-navigation" onClick={() => setOpen(!open)}><Icon name={open ? 'close' : 'menu'} /></button>
        {open && <div id="customer-navigation" className="mobile-account-menu" aria-label="Mobile navigation">
          <button onClick={() => run(() => go('shop'))}><Icon name="products" />Products</button><button onClick={() => run(() => go('why'))}><Icon name="shield" />Why Techora</button>
          {user ? <><button onClick={() => run(profile)}><Icon name="customers" />Profile</button><button onClick={() => run(orders)}><Icon name="orders" />Orders</button><button className="mobile-sign-out" onClick={() => run(signOut)}><Icon name="logout" />Sign out</button></> : <button onClick={() => run(signIn)}><Icon name="customers" />Sign in</button>}
        </div>}
      </div>
    </div>
  </header>;
}

export function ProductCard({ product, money, view, add }) {
  return <article className="card">
    <div className="photo">{product.badge && <span>{product.badge}</span>}<button className="product-view-button" onClick={view} aria-label={'View ' + product.name}><ProductImage src={product.image} alt={product.name} loading="lazy" /></button></div>
    <div className="product-meta"><small><span>{product.category}</span><span aria-label={'Rating ' + product.rating + ' out of 5'}>★ {product.rating}</span></small><button className="product-name" onClick={view}><h3>{product.name}</h3></button><div className="card-bottom"><strong>{money(product.price)}</strong><button className="card-add" onClick={add} disabled={product.stock === 0}>{product.stock === 0 ? 'Out of stock' : 'Add to bag'}</button></div></div>
  </article>;
}

export function Pagination({ page, totalPages, onChange, total }) {
  if (totalPages <= 1) return null;
  return <nav className="pagination" aria-label="Table pagination"><span role="status">{total} results · Page {page} of {totalPages}</span><div><button type="button" disabled={page === 1} onClick={() => onChange(page - 1)}>Previous</button><button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}>Next</button></div></nav>;
}
