const state = { products: [], category: 'All', cart: JSON.parse(localStorage.getItem('techora-cart') || '[]') };
const $ = selector => document.querySelector(selector);
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
const categories = ['All', 'Smartphones', 'Laptops', 'Audio', 'Wearables', 'Tablets', 'Home office', 'Accessories'];

function saveCart() { localStorage.setItem('techora-cart', JSON.stringify(state.cart)); renderCart(); }
function cartQuantity() { return state.cart.reduce((sum, item) => sum + item.quantity, 0); }
function cartTotal() { return state.cart.reduce((sum, item) => sum + item.price * item.quantity, 0); }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2400); }

function renderCategories() { $('#categoryTabs').innerHTML = categories.map(category => `<button class="${category === state.category ? 'active' : ''}" data-category="${category}">${category}</button>`).join(''); }
function productCard(product) { return `<article class="product-card"><div class="product-image">${product.badge ? `<span class="badge">${product.badge}</span>` : ''}<img src="${product.image}" alt="${product.name}" loading="lazy"><button class="quick-add" data-add="${product.id}">Add to bag</button></div><div class="product-info"><div class="product-meta"><span>${product.category}</span><span>★ ${product.rating}</span></div><div class="product-name-line"><h3>${product.name}</h3><strong>${money(product.price)}</strong></div></div></article>`; }
async function loadProducts() {
  const params = new URLSearchParams(); if (state.category !== 'All') params.set('category', state.category); if ($('#sortSelect').value) params.set('sort', $('#sortSelect').value);
  try { const response = await fetch(`/api/products?${params}`); state.products = await response.json(); $('#productGrid').innerHTML = state.products.map(productCard).join('') || '<p>No products found in this collection.</p>'; }
  catch { $('#productGrid').innerHTML = '<p>We could not load the collection. Please refresh to try again.</p>'; }
}
function addProduct(id) { const product = state.products.find(item => item.id === id); if (!product) return; const found = state.cart.find(item => item.id === id); found ? found.quantity++ : state.cart.push({ ...product, quantity: 1 }); saveCart(); toast(`${product.name} added to your bag`); }
function renderCart() {
  const hasItems = state.cart.length > 0; $('#cartItems').innerHTML = state.cart.map(item => `<div class="cart-item"><img src="${item.image}" alt="${item.name}"><div><h3>${item.name}</h3><p>${money(item.price)}</p><div class="qty"><button data-change="${item.id}" data-delta="-1" aria-label="Decrease ${item.name}">−</button><span>${item.quantity}</span><button data-change="${item.id}" data-delta="1" aria-label="Increase ${item.name}">+</button></div></div><button class="remove" data-remove="${item.id}">Remove</button></div>`).join('');
  $('#cartCount').textContent = cartQuantity(); $('#drawerCount').textContent = cartQuantity(); $('#cartTotal').textContent = money(cartTotal()); $('#cartEmpty').classList.toggle('hidden', hasItems); $('#checkoutButton').disabled = !hasItems; $('#checkoutButton').style.opacity = hasItems ? '1' : '.45';
}
function openCart() { $('#cartDrawer').classList.add('open'); $('#overlay').classList.add('open'); $('#cartDrawer').setAttribute('aria-hidden', 'false'); }
function closeCart() { $('#cartDrawer').classList.remove('open'); $('#overlay').classList.remove('open'); $('#cartDrawer').setAttribute('aria-hidden', 'true'); }
function checkoutTemplate() { return `<div class="checkout"><h2>Almost there.</h2><p>Enter your details and we’ll take care of the rest. Your total is <strong>${money(cartTotal())}</strong>.</p><form id="checkoutForm"><input name="name" placeholder="Full name" required><input name="email" type="email" placeholder="Email address" required><input class="wide" name="address" placeholder="Shipping address" required><input name="city" placeholder="City" required><input name="postalCode" placeholder="Postal code" required><button class="button button-dark">Place order <span>→</span></button></form></div>`; }
function showCheckout() { if (!state.cart.length) return; closeCart(); $('#checkoutContent').innerHTML = checkoutTemplate(); $('#checkoutDialog').showModal(); }
async function submitOrder(form) { const customer = Object.fromEntries(new FormData(form)); const button = form.querySelector('button'); button.disabled = true; button.textContent = 'Placing order…'; try { const response = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customer, items: state.cart.map(({ id, quantity }) => ({ id, quantity })) }) }); const order = await response.json(); if (!response.ok) throw new Error(order.error); state.cart = []; saveCart(); $('#checkoutContent').innerHTML = `<div class="order-success"><div class="success-mark">✓</div><h2>Order confirmed.</h2><p>Thank you, ${customer.name.split(' ')[0]}. Your order <strong>${order.id}</strong> is in the works. A confirmation is heading to ${customer.email}.</p><button class="button button-dark" id="doneButton">Continue shopping <span>→</span></button></div>`; } catch (error) { toast(error.message || 'Something went wrong. Please try again.'); button.disabled = false; button.textContent = 'Place order →'; } }

document.addEventListener('click', event => {
  const category = event.target.closest('[data-category]'); if (category) { state.category = category.dataset.category; renderCategories(); loadProducts(); }
  const add = event.target.closest('[data-add]'); if (add) addProduct(add.dataset.add);
  const change = event.target.closest('[data-change]'); if (change) { const item = state.cart.find(product => product.id === change.dataset.change); item.quantity += Number(change.dataset.delta); if (item.quantity < 1) state.cart = state.cart.filter(product => product !== item); saveCart(); }
  const remove = event.target.closest('[data-remove]'); if (remove) { state.cart = state.cart.filter(item => item.id !== remove.dataset.remove); saveCart(); }
  if (event.target.id === 'doneButton') { $('#checkoutDialog').close(); document.querySelector('#shop').scrollIntoView(); }
});
$('#cartButton').addEventListener('click', openCart); $('#closeCart').addEventListener('click', closeCart); $('#overlay').addEventListener('click', closeCart); $('#checkoutButton').addEventListener('click', showCheckout); $('#closeCheckout').addEventListener('click', () => $('#checkoutDialog').close()); $('#sortSelect').addEventListener('change', loadProducts); $('#viewAll').addEventListener('click', () => { state.category = 'All'; renderCategories(); loadProducts(); });
$('#checkoutContent').addEventListener('submit', event => { if (event.target.id === 'checkoutForm') { event.preventDefault(); submitOrder(event.target); } });
$('#newsletterForm').addEventListener('submit', event => { event.preventDefault(); $('#newsletterMessage').textContent = 'You’re on the list. Welcome to TechOra.'; event.target.reset(); });
renderCategories(); renderCart(); loadProducts();
