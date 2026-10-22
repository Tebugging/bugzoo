// Smoke tests: the app boots, pages render, and the main shopping flow works.
// The full flow runs in clean mode (BUGZOO_BUGS=none).

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, client, testid, CARD } from './helpers.js';
import { parseBugs, ALL_BUGS, parseResetHour } from '../src/config.js';
import { msUntilHourUtc } from '../src/server.js';

test('config: all, none and lists', () => {
  assert.equal(parseBugs(undefined).size, ALL_BUGS.length);
  assert.equal(parseBugs('none').size, 0);
  assert.deepEqual([...parseBugs('b01, B03')], ['B01', 'B03']);
  assert.throws(() => parseBugs('B99'));
});

test('practice mode boots and serves every page', async () => {
  const app = await startApp('all');
  try {
    const c = client(app.base);
    const health = await (await fetch(`${app.base}/healthz`)).json();
    assert.deepEqual(health, { ok: true, mode: 'practice' });
    for (const path of ['/', '/?page=2&sort=name', '/search?q=lamp', '/product/1', '/cart', '/login', '/signup', '/static/style.css']) {
      assert.equal((await c.get(path)).status, 200, path);
    }
    assert.equal((await c.get('/product/999')).status, 404);
  } finally {
    await app.close();
  }
});

test('config: reset hour', () => {
  assert.equal(parseResetHour(undefined), 4);
  assert.equal(parseResetHour('0'), 0);
  assert.equal(parseResetHour('off'), null);
  assert.throws(() => parseResetHour('24'));
});

test('next reset time is the coming 04:00 UTC', () => {
  const hour = 3_600_000;
  assert.equal(msUntilHourUtc(4, new Date('2026-10-22T03:00:00Z')), hour);
  assert.equal(msUntilHourUtc(4, new Date('2026-10-22T04:00:00Z')), 24 * hour);
  assert.equal(msUntilHourUtc(4, new Date('2026-10-22T05:00:00Z')), 23 * hour);
});

test('reset brings data back to the seed without a restart', async () => {
  const a = await startApp('none');
  try {
    const c = client(a.base);
    await c.post('/signup', { name: 'Temp', email: 'temp@example.com', password: 'longenough' });
    assert.equal((await client(a.base).login('temp@example.com', 'longenough')).status, 200);
    await a.reset();
    assert.equal((await client(a.base).login('temp@example.com', 'longenough')).status, 401);
    assert.match((await c.get('/cart')).text, /Log in/, 'sessions are cleared too');
    assert.equal((await client(a.base).login()).status, 200, 'seed users still work');
  } finally {
    await a.close();
  }
});

let app;
before(async () => { app = await startApp('none'); });
after(() => app.close());

test('clean mode reports itself', async () => {
  const health = await (await fetch(`${app.base}/healthz`)).json();
  assert.equal(health.mode, 'clean');
});

test('clean mode: browse, search, product page', async () => {
  const c = client(app.base);
  const home = await c.get('/');
  assert.match(home.text, /All products/);
  assert.match(home.text, /26 products/);
  assert.match((await c.get('/search?q=Lamp')).text, /Desk Lamp/);
  assert.match((await c.get('/product/3')).text, /Chef Knife/);
});

test('clean mode: guest must log in to check out', async () => {
  const c = client(app.base);
  await c.post('/cart/add', { productId: '1', qty: '1' });
  const res = await c.get('/checkout');
  assert.match(res.text, /Please log in first/);
});

test('clean mode: full purchase flow ends up in order history', async () => {
  const c = client(app.base);
  const login = await c.login();
  assert.match(login.text, /Welcome back, Alice/);

  await c.post('/cart/add', { productId: '2', qty: '1' });
  await c.post('/cart/add', { productId: '9', qty: '2' });
  const cart = await c.get('/cart');
  assert.equal(testid(cart.text, 'cart-count'), '3');
  assert.equal(testid(cart.text, 'subtotal'), '$54.99');
  assert.equal(testid(cart.text, 'shipping'), 'Free');

  const bad = await c.post('/checkout', { ...CARD, card: '4000 0000 0000 0002' });
  assert.equal(bad.status, 422);
  assert.match(bad.text, /declined/);

  const done = await c.post('/checkout', CARD);
  assert.match(done.text, /Thank you! Your order is placed/);
  const orderId = testid(done.text, 'order-id');
  assert.ok(orderId);

  const history = await c.get('/orders');
  assert.ok(history.text.includes(orderId), 'new order is listed in history');
  assert.equal(testid((await c.get('/cart')).text, 'cart-count'), '0');
});

test('clean mode: sign up a new user', async () => {
  const c = client(app.base);
  const res = await c.post('/signup', { name: 'New Person', email: 'new.person@example.com', password: 'longenough' });
  assert.match(res.text, /Welcome, New!/);
  const dup = await c.post('/signup', { name: 'Again', email: 'new.person@example.com', password: 'longenough' });
  assert.match(dup.text, /already exists/);
});

test('wrong password is rejected', async () => {
  const res = await client(app.base).login('alice@bugzoo.dev', 'nope');
  assert.equal(res.status, 401);
});
