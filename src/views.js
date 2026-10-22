// HTML templates. Plain template strings, no framework.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
export const money = (cents) => `${cents < 0 ? '-' : ''}$${(Math.abs(cents) / 100).toFixed(2)}`;

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

export function layout(ctx, { title, body }) {
  const { user, cartCount, mode, flash } = ctx;
  const account = user
    ? `<span class="hello">Hi, ${esc(user.name.split(' ')[0])}</span>
       <form method="post" action="/logout" class="inline"><button class="link" type="submit">Log out</button></form>`
    : `<a href="/login">Log in</a><a href="/signup">Sign up</a>`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · Bug Zoo Shop</title>
<link rel="stylesheet" href="/static/style.css">
</head>
<body>
<header class="site">
  <a class="brand" href="/">🐞 Bug Zoo Shop</a>
  <form class="search" method="get" action="/search" role="search">
    <input type="search" name="q" placeholder="Search products" aria-label="Search products" value="${esc(ctx.query ?? '')}">
    <button type="submit">Search</button>
  </form>
  <nav>
    <a href="/">Products</a>
    <a href="/cart">Cart (<span data-testid="cart-count">${cartCount}</span>)</a>
    <a href="/orders">Orders</a>
    ${account}
  </nav>
</header>
<main>
${flash ? `<div class="flash ${esc(flash.kind)}" role="${flash.kind === 'error' ? 'alert' : 'status'}">${esc(flash.text)}</div>` : ''}
${body}
</main>
<footer class="site">
  <p>Bug Zoo is a practice shop for QA. Payments are fake: never enter a real card.
  Free shipping on orders of ${money(5000)} or more.</p>
  <p class="mode">Mode: ${esc(mode)}</p>
</footer>
</body>
</html>`;
}

function productCard(p) {
  return `<li class="card">
  <a href="/product/${p.id}">
    <span class="emoji" aria-hidden="true">${p.emoji}</span>
    <span class="name">${esc(p.name)}</span>
  </a>
  <span class="price">${money(p.priceCents)}</span>
</li>`;
}

export function productList({ items, page, pages, total }, sort) {
  const opt = (v, label) => `<option value="${v}"${sort === v ? ' selected' : ''}>${label}</option>`;
  const link = (n, label, disabled) =>
    disabled ? `<span class="disabled">${label}</span>` : `<a href="/?page=${n}&amp;sort=${esc(sort)}">${label}</a>`;
  const nums = Array.from({ length: pages }, (_, i) => i + 1)
    .map((n) => (n === page ? `<span class="current" aria-current="page">${n}</span>` : link(n, n, false)))
    .join(' ');
  return `<h1>All products</h1>
<form class="sort" method="get" action="/">
  <label>Sort by
    <select name="sort">
      ${opt('featured', 'Featured')}${opt('price-asc', 'Price: low to high')}${opt('price-desc', 'Price: high to low')}${opt('name', 'Name: A to Z')}
    </select>
  </label>
  <button type="submit">Apply</button>
  <span class="count">${total} products</span>
</form>
<ul class="grid">${items.map(productCard).join('')}</ul>
<nav class="pager" aria-label="Pagination">
  ${link(page - 1, '‹ Prev', page <= 1)} ${nums} ${link(page + 1, 'Next ›', page >= pages)}
</nav>`;
}

export function searchPage(query, results) {
  if (!query.trim()) return `<h1>Search</h1><p>Type something in the search box.</p>`;
  return `<h1>Search results for “${esc(query)}”</h1>
<p class="count">${results.length} result${results.length === 1 ? '' : 's'}</p>
${results.length ? `<ul class="grid">${results.map(productCard).join('')}</ul>` : '<p>No products match your search.</p>'}`;
}

export function productPage(p, has) {
  const mobileButton = has('B08')
    ? `<button type="button" class="primary">Add to cart</button>`
    : `<button type="submit" form="add-form" class="primary">Add to cart</button>`;
  return `<article class="product">
  <div class="hero" aria-hidden="true">${p.emoji}</div>
  <div class="info">
    <p class="crumbs"><a href="/">Products</a> › ${esc(p.category)}</p>
    <h1>${esc(p.name)}</h1>
    <p class="price big">${money(p.priceCents)}</p>
    <p>${esc(p.description)}</p>
    <p class="stock">${p.stock} in stock</p>
    <form id="add-form" method="post" action="/cart/add">
      <input type="hidden" name="productId" value="${p.id}">
      <label>Quantity <input type="number" name="qty" value="1" min="1" max="99" inputmode="numeric"></label>
      <button type="submit" class="primary desktop-only">Add to cart</button>
    </form>
  </div>
</article>
<div class="sticky-buy mobile-only">
  <span>${esc(p.name)} · ${money(p.priceCents)}</span>
  ${mobileButton}
</div>`;
}

function summary(t) {
  return `<dl class="totals">
  <dt>Subtotal</dt><dd data-testid="subtotal">${money(t.subtotalCents)}</dd>
  ${t.code ? `<dt>Discount (${esc(t.code)})</dt><dd data-testid="discount">-${money(t.discountCents)}</dd>` : ''}
  <dt>Shipping</dt><dd data-testid="shipping">${t.shippingCents ? money(t.shippingCents) : 'Free'}</dd>
  <dt class="grand">Total</dt><dd class="grand" data-testid="total">${money(t.totalCents)}</dd>
</dl>`;
}

export function cartPage(t) {
  if (!t.lines.length) return `<h1>Your cart</h1><p>Your cart is empty. <a href="/">Browse products</a>.</p>`;
  const rows = t.lines
    .map(
      (l, i) => `<tr>
  <td><a href="/product/${l.productId}">${l.emoji} ${esc(l.name)}</a></td>
  <td>${money(l.unitCents)}</td>
  <td>
    <form method="post" action="/cart/update" class="inline">
      <input type="hidden" name="line" value="${i}">
      <input type="number" name="qty" value="${l.qty}" aria-label="Quantity for ${esc(l.name)}" class="qty">
      <button type="submit">Update</button>
    </form>
  </td>
  <td>${money(l.lineCents)}</td>
  <td>
    <form method="post" action="/cart/remove" class="inline">
      <input type="hidden" name="line" value="${i}">
      <button type="submit" class="link">Remove</button>
    </form>
  </td>
</tr>`,
    )
    .join('');
  return `<h1>Your cart</h1>
<table class="cart">
  <thead><tr><th>Product</th><th>Price</th><th>Quantity</th><th>Line total</th><th></th></tr></thead>
  <tbody>${rows}</tbody>
</table>
<div class="cart-side">
  <form method="post" action="/cart/discount" class="discount">
    <label>Discount code <input name="code" value="${esc(t.code ?? '')}" autocomplete="off"></label>
    <button type="submit">Apply</button>
  </form>
  ${summary(t)}
  <a class="button primary" href="/checkout">Checkout</a>
</div>`;
}

export function checkoutPage(t, values = {}) {
  const v = (k) => esc(values[k] ?? '');
  return `<h1>Checkout</h1>
<div class="checkout">
  <form method="post" action="/checkout" class="stack">
    <fieldset>
      <legend>Shipping address</legend>
      <label>Full name <input name="name" value="${v('name')}" required autocomplete="name"></label>
      <label>Street address <input name="address" value="${v('address')}" required autocomplete="street-address"></label>
      <label>City <input name="city" value="${v('city')}" required autocomplete="address-level2"></label>
      <label>Postal code <input name="postal" value="${v('postal')}" required autocomplete="postal-code"></label>
      <label>Country <input name="country" value="${v('country')}" required autocomplete="country-name"></label>
    </fieldset>
    <fieldset>
      <legend>Payment (fake)</legend>
      <p class="note">This is a fake shop. Never enter a real card. Use test card <code>4242 4242 4242 4242</code>, any future expiry and any 3-digit CVC.</p>
      <label>Card number <input name="card" value="${v('card')}" required inputmode="numeric" autocomplete="off"></label>
      <label>Expiry (MM/YY) <input name="expiry" value="${v('expiry')}" required placeholder="12/30" autocomplete="off"></label>
      <label>CVC <input name="cvc" value="" required inputmode="numeric" autocomplete="off"></label>
    </fieldset>
    <button type="submit" class="primary">Place order</button>
  </form>
  <aside>
    <h2>Order summary</h2>
    <ul class="mini">${t.lines.map((l) => `<li>${l.qty} × ${esc(l.name)} <span>${money(l.lineCents)}</span></li>`).join('')}</ul>
    ${summary(t)}
  </aside>
</div>`;
}

export function orderPage(o, { justPlaced }) {
  return `<h1>${justPlaced ? 'Thank you! Your order is placed.' : `Order #${o.id}`}</h1>
<p>Order <strong data-testid="order-id">#${o.id}</strong> · ${fmtDate(o.createdAt)} · paid with card ending ${esc(o.cardLast4)}</p>
<p>Ship to: ${esc(o.shipTo)}</p>
<ul class="mini">${o.lines.map((l) => `<li>${l.qty} × ${esc(l.name)} <span>${money(l.unitCents * l.qty)}</span></li>`).join('')}</ul>
${summary(o)}
<p><a href="/orders">View order history</a></p>`;
}

export function ordersPage(orders) {
  if (!orders.length) return `<h1>Order history</h1><p>You have no orders yet.</p>`;
  return `<h1>Order history</h1>
<table class="orders">
  <thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Total</th></tr></thead>
  <tbody>${orders
    .map(
      (o) => `<tr data-testid="order-row">
    <td><a href="/orders/${o.id}">#${o.id}</a></td>
    <td>${fmtDate(o.createdAt)}</td>
    <td>${o.lines.reduce((n, l) => n + l.qty, 0)}</td>
    <td>${money(o.totalCents)}</td>
  </tr>`,
    )
    .join('')}</tbody>
</table>`;
}

export function loginPage(values = {}, next = '') {
  return `<h1>Log in</h1>
<form method="post" action="/login" class="stack narrow">
  <input type="hidden" name="next" value="${esc(next)}">
  <label>Email <input type="text" name="email" value="${esc(values.email ?? '')}" required autocomplete="username"></label>
  <label>Password <input type="password" name="password" required autocomplete="current-password"></label>
  <button type="submit" class="primary">Log in</button>
</form>
<p>No account? <a href="/signup">Sign up</a>. Demo accounts are listed in the project README.</p>`;
}

export function signupPage(values = {}) {
  return `<h1>Create an account</h1>
<form method="post" action="/signup" class="stack narrow">
  <label>Name <input name="name" value="${esc(values.name ?? '')}" required autocomplete="name"></label>
  <label>Email <input type="text" name="email" value="${esc(values.email ?? '')}" required autocomplete="email"></label>
  <label>Password (at least 8 characters) <input type="password" name="password" required autocomplete="new-password"></label>
  <button type="submit" class="primary">Sign up</button>
</form>
<p>Already have an account? <a href="/login">Log in</a>.</p>`;
}

export function notFound() {
  return `<h1>Page not found</h1><p><a href="/">Back to the shop</a></p>`;
}
