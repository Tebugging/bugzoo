// Test helpers: boot the app on a random port and drive it with a tiny
// cookie-keeping HTTP client.

import { createApp } from '../src/server.js';
import { loadConfig } from '../src/config.js';

export async function startApp(bugs) {
  const app = createApp(loadConfig({ BUGZOO_BUGS: bugs }));
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  return { ...app, base, close: () => new Promise((r) => app.server.close(r)) };
}

export function client(base) {
  let cookie = '';
  async function request(method, path, form) {
    const res = await fetch(base + path, {
      method,
      redirect: 'manual',
      headers: {
        ...(cookie && { cookie }),
        ...(form && { 'content-type': 'application/x-www-form-urlencoded' }),
      },
      body: form ? new URLSearchParams(form).toString() : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) cookie = set.split(';')[0];
    const text = await res.text();
    if (res.status === 303) return request('GET', res.headers.get('location'));
    return { status: res.status, text, url: path };
  }
  return {
    get: (path) => request('GET', path),
    post: (path, form) => request('POST', path, form),
    login: (email = 'alice@bugzoo.dev', password = 'bugzoo-alice') => request('POST', '/login', { email, password }),
  };
}

export const testid = (html, id) => html.match(new RegExp(`data-testid="${id}">([^<]*)<`))?.[1];

export const CARD = { name: 'Test Buyer', address: '1 Test Street', city: 'Testville', postal: '12345', country: 'Testland', card: '4242 4242 4242 4242', expiry: '12/30', cvc: '123' };
