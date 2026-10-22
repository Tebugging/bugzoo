// Bug Zoo Shop: a tiny web shop with planted functional bugs.
// Zero dependencies: Node's built-in http server and in-memory data.

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createStore, checkPassword } from './store.js';
import { createShop, priceSeedOrders } from './shop.js';
import * as views from './views.js';

const PUBLIC_DIR = fileURLToPath(new URL('../public/', import.meta.url));
const MAX_BODY = 16 * 1024;
const COOKIE = 'bz_sid';
// Changes whenever style.css changes, so browsers never keep stale CSS.
const ASSET_VERSION = createHash('sha256').update(readFileSync(join(PUBLIC_DIR, 'style.css'))).digest('hex').slice(0, 10);
const TYPES = { '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i <= 0) continue;
    const value = part.slice(i + 1).trim();
    try {
      out[part.slice(0, i).trim()] = decodeURIComponent(value);
    } catch {
      out[part.slice(0, i).trim()] = value; // malformed escape from some other cookie: keep raw
    }
  }
  return out;
}

async function readForm(req) {
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Request body too large'), { status: 413 });
    chunks.push(chunk);
  }
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
}

const toInt = (v) => (/^\s*-?\d+\s*$/.test(String(v ?? '')) ? Number.parseInt(v, 10) : NaN);

export async function createApp(config = loadConfig()) {
  const store = await createStore();
  priceSeedOrders(store);
  const shop = createShop(store, config.bugs);

  async function handle(req, res) {
    const url = new URL(req.url, 'http://localhost');
    const path = url.pathname;
    // HEAD is served like GET (Node drops the body), for uptime monitors.
    const method = req.method === 'HEAD' ? 'GET' : req.method;
    let session = store.session(parseCookies(req.headers.cookie)[COOKIE]);

    const ensureSession = () => {
      if (!session) {
        session = store.newSession();
        res.setHeader('Set-Cookie', `${COOKIE}=${session.id}; Path=/; HttpOnly; SameSite=Lax`);
      }
      return session;
    };
    const user = () => (session?.userId ? store.user(session.userId) : null);
    const flash = (kind, text) => {
      ensureSession().flash = { kind, text };
    };
    const redirect = (to) => {
      res.writeHead(303, { Location: to });
      res.end();
    };
    const send = (status, html) => {
      res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(html);
    };
    const page = (title, body, { status = 200, query } = {}) => {
      const f = session?.flash;
      if (session) session.flash = null;
      const cartCount = session ? session.cart.lines.reduce((n, l) => n + l.qty, 0) : 0;
      send(status, views.layout({ user: user(), cartCount, mode: config.mode, flash: f, query, assetVersion: ASSET_VERSION }, { title, body }));
    };
    const requireLogin = () => {
      if (user()) return true;
      // No flash here: it would create a session for every anonymous crawler hit.
      // The login page shows "Please log in first." when `next` is set.
      redirect(`/login?next=${encodeURIComponent(path)}`);
      return false;
    };

    // Static files and health check
    if (method === 'GET' && path.startsWith('/static/')) {
      const file = normalize(join(PUBLIC_DIR, path.slice('/static/'.length)));
      if (!file.startsWith(PUBLIC_DIR)) return send(404, 'Not found');
      try {
        const data = await readFile(file);
        res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'public, max-age=3600' });
        return res.end(data);
      } catch {
        return send(404, 'Not found');
      }
    }
    if (method === 'GET' && path === '/healthz') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, mode: config.mode }));
    }

    // Catalogue
    if (method === 'GET' && path === '/') {
      const sort = url.searchParams.get('sort') ?? 'featured';
      return page('Products', views.productList(shop.listProducts({ page: url.searchParams.get('page'), sort }), sort));
    }
    if (method === 'GET' && path === '/search') {
      const q = url.searchParams.get('q') ?? '';
      return page('Search', views.searchPage(q, shop.search(q)), { query: q });
    }
    let m = path.match(/^\/product\/(\d+)$/);
    if (method === 'GET' && m) {
      const p = store.product(m[1]);
      if (!p) return page('Not found', views.notFound(), { status: 404 });
      return page(p.name, views.productPage(p, shop.has));
    }

    // Cart
    if (method === 'GET' && path === '/cart') {
      return page('Cart', views.cartPage(shop.totals(session?.cart ?? { lines: [], code: null })));
    }
    if (method === 'POST' && path.startsWith('/cart/')) {
      const form = await readForm(req);
      const cart = ensureSession().cart;
      let err = null;
      if (path === '/cart/add') {
        err = shop.addToCart(cart, toInt(form.productId), toInt(form.qty));
        if (!err) flash('success', 'Added to cart.');
        else {
          flash('error', err);
          return redirect(store.product(toInt(form.productId)) ? `/product/${toInt(form.productId)}` : '/');
        }
      } else if (path === '/cart/update') {
        err = shop.updateLine(cart, toInt(form.line), toInt(form.qty));
        if (!err) flash('success', 'Cart updated.');
      } else if (path === '/cart/remove') {
        err = shop.removeLine(cart, toInt(form.line));
        if (!err) flash('success', 'Item removed.');
      } else if (path === '/cart/discount') {
        err = shop.applyCode(cart, form.code);
        if (!err) flash('success', cart.code ? `Code ${cart.code} applied.` : 'Discount code removed.');
      } else {
        return page('Not found', views.notFound(), { status: 404 });
      }
      if (err) flash('error', err);
      return redirect('/cart');
    }

    // Checkout
    if (path === '/checkout') {
      if (!requireLogin()) return;
      const t = shop.totals(session.cart);
      if (!t.lines.length) {
        flash('info', 'Your cart is empty.');
        return redirect('/cart');
      }
      if (method === 'GET') return page('Checkout', views.checkoutPage(t, { name: user().name }));
      if (method === 'POST') {
        const form = await readForm(req);
        const error = checkCheckout(form);
        if (error) {
          session.flash = { kind: 'error', text: error };
          return page('Checkout', views.checkoutPage(t, form), { status: 422 });
        }
        let order;
        try {
          order = store.addOrder({
            userId: user().id,
            lines: t.lines.map(({ productId, name, unitCents, qty }) => ({ productId, name, unitCents, qty })),
            subtotalCents: t.subtotalCents,
            code: t.code,
            discountCents: t.discountCents,
            shippingCents: t.shippingCents,
            totalCents: t.totalCents,
            shipTo: [form.name, form.address, `${form.postal} ${form.city}`, form.country].map((s) => s.trim()).join(', '),
            cardLast4: form.card.replace(/\D/g, '').slice(-4),
          });
        } catch (e) {
          flash('error', e.message);
          return redirect('/cart');
        }
        session.cart = { lines: [], code: null };
        session.lastOrderId = order.id;
        return redirect(`/orders/${order.id}`);
      }
    }

    // Orders
    if (method === 'GET' && path === '/orders') {
      if (!requireLogin()) return;
      return page('Order history', views.ordersPage(shop.orderHistory(user().id)));
    }
    m = path.match(/^\/orders\/(\d+)$/);
    if (method === 'GET' && m) {
      if (!requireLogin()) return;
      const o = store.orders.find((x) => x.id === Number(m[1]) && x.userId === user().id);
      if (!o) return page('Not found', views.notFound(), { status: 404 });
      const justPlaced = session.lastOrderId === o.id;
      session.lastOrderId = null;
      return page(`Order #${o.id}`, views.orderPage(o, { justPlaced }));
    }

    // Accounts
    if (path === '/login') {
      const next = url.searchParams.get('next') ?? '';
      if (method === 'GET') return page('Log in', views.loginPage({}, next));
      if (method === 'POST') {
        const form = await readForm(req);
        const u = store.userByEmail(form.email ?? '');
        if (!u || !(await checkPassword(form.password ?? '', u.passwordHash))) {
          ensureSession().flash = { kind: 'error', text: 'Wrong email or password.' };
          return page('Log in', views.loginPage(form, form.next), { status: 401 });
        }
        ensureSession().userId = u.id;
        flash('success', `Welcome back, ${u.name.split(' ')[0]}.`);
        return redirect(safeNext(form.next));
      }
    }
    if (path === '/signup') {
      if (method === 'GET') return page('Sign up', views.signupPage());
      if (method === 'POST') {
        const form = await readForm(req);
        const name = (form.name ?? '').trim();
        const email = (form.email ?? '').trim();
        let error = null;
        if (!name) error = 'Please enter your name.';
        else if (!shop.validEmail(email)) error = 'Please enter a valid email address.';
        else if ((form.password ?? '').length < 8) error = 'Password must be at least 8 characters.';
        else if (store.userByEmail(email)) error = 'An account with this email already exists.';
        let u;
        if (!error) {
          try {
            u = await store.addUser({ name, email, password: form.password });
          } catch (e) {
            error = e.message;
          }
        }
        if (error) {
          ensureSession().flash = { kind: 'error', text: error };
          return page('Sign up', views.signupPage(form), { status: 422 });
        }
        ensureSession().userId = u.id;
        flash('success', `Welcome, ${name.split(' ')[0]}! Your account is ready.`);
        return redirect('/');
      }
    }
    if (method === 'POST' && path === '/logout') {
      if (session) session.userId = null;
      flash('success', 'You are logged out.');
      return redirect('/');
    }

    return page('Not found', views.notFound(), { status: 404 });
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      if (!res.headersSent) {
        res.writeHead(err.status ?? 500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end(err.status ? err.message : 'Internal error');
      if (!err.status) console.error(err);
    });
  });
  server.requestTimeout = 10_000;
  server.headersTimeout = 10_000;
  return { server, store, shop, config };
}

function safeNext(next) {
  return typeof next === 'string' && /^\/(?!\/)[\w\-/?=&%.]*$/.test(next) ? next : '/';
}

function checkCheckout(f) {
  for (const [key, label] of [['name', 'full name'], ['address', 'street address'], ['city', 'city'], ['postal', 'postal code'], ['country', 'country']]) {
    if (!(f[key] ?? '').trim()) return `Please enter your ${label}.`;
  }
  const card = (f.card ?? '').replace(/[\s-]/g, '');
  if (!/^\d{13,19}$/.test(card)) return 'Please enter a valid card number (this shop is fake; use 4242 4242 4242 4242).';
  if (card === '4000000000000002') return 'Your card was declined (fake test card).';
  const exp = (f.expiry ?? '').trim().match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!exp || +exp[1] < 1 || +exp[1] > 12) return 'Please enter the expiry as MM/YY.';
  const now = new Date();
  const expYear = 2000 + +exp[2];
  if (expYear < now.getUTCFullYear() || (expYear === now.getUTCFullYear() && +exp[1] < now.getUTCMonth() + 1)) return 'Your card has expired.';
  if (!/^\d{3,4}$/.test((f.cvc ?? '').trim())) return 'Please enter the 3- or 4-digit CVC.';
  return null;
}

// Start the server when run directly (not when imported by tests).
if (process.argv[1] && fileURLToPath(import.meta.url) === normalize(process.argv[1])) {
  const config = loadConfig();
  const { server } = await createApp(config);
  server.listen(config.port, config.host, () => {
    console.log(`Bug Zoo Shop on http://localhost:${config.port} (mode: ${config.mode}, active bugs: ${config.bugs.size})`);
  });
  const stop = () => server.close(() => process.exit(0));
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
