import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// A single, consistent 24px outline icon set for the whole interface.
export function Icon({ name, size = 20, ...props }) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
    products: <><path d="m3 7 9-4 9 4-9 4-9-4Z M3 7v10l9 4 9-4V7 M12 11v10 M7.5 5l9 4" /></>,
    orders: <><rect x="5" y="4" width="14" height="17" rx="2" /><rect x="9" y="2" width="6" height="4" rx="1" /><path d="M9 11h6M9 15h6" /></>,
    customers: <><circle cx="9" cy="7" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3M16 4a3 3 0 0 1 0 6M18 14a5 5 0 0 1 3 4v3" /></>,
    promotions: <><path d="M3 3h8l10 10-8 8L3 11V3Z" /><circle cx="7.5" cy="7.5" r="1" /></>,
    reports: <><path d="M5 3v18M12 3v18M19 3v18" /><rect x="3" y="6" width="4" height="4" rx="1" /><rect x="10" y="14" width="4" height="4" rx="1" /><rect x="17" y="8" width="4" height="4" rx="1" /></>,
    bag: <><path d="M5 7h14l2 14H3L5 7Z M8 8V6a4 4 0 0 1 8 0v2" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    up: <path d="M12 20V4m-6 6 6-6 6 6" />,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
    truck: <><path d="M3 5h11v12H3V5Zm11 5h4l3 4v3h-7" /><circle cx="7" cy="18" r="2" /><circle cx="17" cy="18" r="2" /></>,
    logout: <><path d="M9 4H4v16h5M10 12h11m-4-4 4 4-4 4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    refresh: <><path d="M20 7V3m0 4h-4M4 17v4m0-4h4M20 7a8 8 0 0 0-14-1M4 17a8 8 0 0 0 14 1" /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>{paths[name] || paths.products}</svg>;
}

// A fresh notification also restarts the timer when its text is unchanged.
export function useNotification(duration = 5000) {
  const [notification, setNotification] = useState({ text: '' });
  const notify = useCallback((text) => setNotification({ text }), []);
  useEffect(() => {
    if (!notification.text) return;
    const timer = setTimeout(() => setNotification({ text: '' }), duration);
    return () => clearTimeout(timer);
  }, [notification, duration]);
  return [notification.text, notify];
}

export function BackToTop({ scrollRef }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const target = scrollRef?.current || window;
    const update = () => setVisible((target === window ? window.scrollY : target.scrollTop) > 400);
    update();
    target.addEventListener('scroll', update, { passive: true });
    return () => target.removeEventListener('scroll', update);
  }, [scrollRef]);
  function goToTop() {
    const target = scrollRef?.current || window;
    target.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  return visible ? <button type="button" className="back-to-top" onClick={goToTop} aria-label="Back to top" title="Back to top"><Icon name="up" /></button> : null;
}

let openDialogs = 0;
let previousOverflow = '';
let previousInert = false;
export function Modal({ close, className = '', children, label = 'Dialog' }) {
  const panel = useRef(null);
  const dialogId = useId();
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previousFocus = document.activeElement;
    const root = document.getElementById('root');
    if (openDialogs++ === 0) {
      previousOverflow = document.body.style.overflow;
      previousInert = root?.inert || false;
      document.body.style.overflow = 'hidden';
      if (root) root.inert = true;
    }
    const target = panel.current;
    const heading = target.querySelector('h2');
    if (heading) { heading.id ||= dialogId; target.setAttribute('aria-labelledby', heading.id); }
    const focusable = () => [...target.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter((el) => el.getClientRects().length);
    target.focus();
    function onKey(event) {
      if (document.querySelector('.modal-layer:last-of-type [role="dialog"]') !== target) return;
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key === 'Tab') {
        const items = focusable(); const first = items[0]; const last = items.at(-1);
        if (!first) { event.preventDefault(); target.focus(); }
        else if (event.shiftKey && (document.activeElement === first || document.activeElement === target)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (document.activeElement === last || document.activeElement === target)) { event.preventDefault(); first.focus(); }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (--openDialogs === 0) {
        document.body.style.overflow = previousOverflow;
        if (root) root.inert = previousInert;
      }
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return createPortal(<div className="modal-layer" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <section ref={panel} className={'dialog-panel ' + className} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
      <button type="button" className="modal-close" onClick={close} aria-label="Close dialog"><Icon name="close" /></button>
      {children}
    </section>
  </div>, document.body);
}

export function Field({ label, type = 'text', value, onChange, ...props }) {
  const [visible, setVisible] = useState(false); const password = type === 'password'; const id = useId();
  return <div className="field"><label htmlFor={id}>{label}{props.required && <span className="required-mark" aria-hidden="true"> *</span>}</label><div className={password ? 'password-control' : ''}><input id={id} type={password && visible ? 'text' : type} value={value} onChange={(event) => onChange(event.target.value)} {...props} />{password && <button type="button" onClick={() => setVisible(!visible)} aria-label={visible ? 'Hide password' : 'Show password'} title={visible ? 'Hide password' : 'Show password'}>{visible ? 'Hide' : 'Show'}</button>}</div></div>;
}

export function SearchField({ value, onChange, placeholder = 'Search', label = 'Search' }) {
  return <label className="search-field"><Icon name="search" /><span className="sr-only">{label}</span><input type="search" placeholder={placeholder} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

export function LoadingState({ text = 'Loading…' }) {
  return <div className="loading-state" role="status"><span className="spinner" />{text}</div>;
}

export function EmptyState({ title, children }) {
  return <div className="empty-state"><Icon name="products" size={28} /><h3>{title}</h3>{children && <p>{children}</p>}</div>;
}

export function ProductImage({ src, alt = '', ...props }) {
  return <img src={src || '/product-fallback.svg'} alt={alt} {...props} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/product-fallback.svg'; }} />;
}
