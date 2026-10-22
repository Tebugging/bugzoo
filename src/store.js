// In-memory data store. Everything lives in RAM and starts from the seed on
// every boot, so a restart is a full reset. Caps keep memory small on a
// shared server.

import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import * as seed from './seed.js';

const LIMITS = { users: 2000, orders: 10000, sessions: 5000 };

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(password, salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function checkPassword(password, stored) {
  const [salt, hash] = stored.split(':');
  const candidate = scryptSync(password, salt, 32);
  return timingSafeEqual(candidate, Buffer.from(hash, 'hex'));
}

export function createStore() {
  const products = structuredClone(seed.products);
  const users = seed.users.map(({ password, ...u }) => ({ ...u, passwordHash: hashPassword(password) }));
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

    addUser({ name, email, password }) {
      if (users.length >= LIMITS.users) throw new Error('Sign-ups are full for today. Try again after the nightly reset.');
      const user = { id: nextUserId++, name, email: email.trim().toLowerCase(), passwordHash: hashPassword(password) };
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
