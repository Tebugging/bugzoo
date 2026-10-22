// In-memory data store. Everything lives in RAM and starts from the seed on
// every boot, so a restart is a full reset. Caps keep memory small on a
// shared server.

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import * as seed from './seed.js';

const LIMITS = { users: 2000, orders: 10000, sessions: 5000 };

// Async scrypt runs on the libuv thread pool, so logins never block requests.
const scryptAsync = promisify(scrypt);

export async function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = (await scryptAsync(password, salt, 32)).toString('hex');
  return `${salt}:${hash}`;
}

export async function checkPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = await scryptAsync(password, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

export async function createStore() {
  const products = structuredClone(seed.products);
  const users = await Promise.all(
    seed.users.map(async ({ password, ...u }) => ({ ...u, passwordHash: await hashPassword(password) })),
  );
  const orders = structuredClone(seed.orders);
  const sessions = new Map();
  let nextUserId = Math.max(...users.map((u) => u.id)) + 1;
  let nextOrderId = Math.max(...orders.map((o) => o.id)) + 1;

  return {
    products,
    users,
    orders,
    sessions,
    discountCodes: seed.discountCodes,

    product(id) {
      return products.find((p) => p.id === Number(id));
    },

    userByEmail(email) {
      const e = String(email).trim().toLowerCase();
      return users.find((u) => u.email === e);
    },

    user(id) {
      return users.find((u) => u.id === id);
    },

    async addUser({ name, email, password }) {
      const passwordHash = await hashPassword(password);
      // Checked after the await so two parallel sign-ups cannot both pass.
      if (users.length >= LIMITS.users) throw new Error('Sign-ups are full for today. Try again after the nightly reset.');
      if (this.userByEmail(email)) throw new Error('An account with this email already exists.');
      const user = { id: nextUserId++, name, email: email.trim().toLowerCase(), passwordHash };
      users.push(user);
      return user;
    },

    addOrder(order) {
      if (orders.length >= LIMITS.orders) throw new Error('The shop is full for today. Try again after the nightly reset.');
      const saved = { ...order, id: nextOrderId++, createdAt: new Date().toISOString() };
      orders.push(saved);
      return saved;
    },

    session(id) {
      return id ? sessions.get(id) : undefined;
    },

    newSession() {
      if (sessions.size >= LIMITS.sessions) {
        // Drop the oldest session (Map keeps insertion order).
        sessions.delete(sessions.keys().next().value);
      }
      const s = { id: randomBytes(18).toString('base64url'), userId: null, cart: { lines: [], code: null } };
      sessions.set(s.id, s);
      return s;
    },
  };
}
