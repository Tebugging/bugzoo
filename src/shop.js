// Shop rules: catalogue queries, cart maths, validation, order history.
// `has(id)` tells whether a planted bug is switched on.

export const PAGE_SIZE = 8;
export const SHIPPING_CENTS = 499;
export const FREE_SHIPPING_FROM_CENTS = 5000;
export const MAX_QTY = 99;

export function createShop(store, bugs) {
  const has = (id) => bugs.has(id);

  function sortProducts(list, sort) {
    const out = [...list];
    switch (sort) {
      case 'price-asc':
        if (has('B07')) return out.sort((a, b) => String(a.priceCents).localeCompare(String(b.priceCents)));
        return out.sort((a, b) => a.priceCents - b.priceCents);
      case 'price-desc':
        return out.sort((a, b) => b.priceCents - a.priceCents);
      case 'name':
        return out.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return out.sort((a, b) => a.id - b.id);
    }
  }

  function listProducts({ page = 1, sort = 'featured' } = {}) {
    const sorted = sortProducts(store.products, sort);
    const pages = has('B05')
      ? Math.max(1, Math.floor(sorted.length / PAGE_SIZE))
      : Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    const current = Math.min(Math.max(1, Number.parseInt(page, 10) || 1), pages);
    const start = (current - 1) * PAGE_SIZE;
    return { items: sorted.slice(start, start + PAGE_SIZE), page: current, pages, total: sorted.length };
  }

  function search(query) {
    const q = String(query ?? '').trim();
    if (!q) return [];
    if (has('B03')) return store.products.filter((p) => p.name.includes(q));
    const needle = q.toLowerCase();
    return store.products.filter(
      (p) => p.name.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle),
    );
  }

  // Returns an error message, or null when the quantity is acceptable.
  function checkQty(qty, { allowZero }) {
    if (!Number.isInteger(qty)) return 'Quantity must be a whole number.';
    if (has('B02')) return qty > MAX_QTY ? `You can order at most ${MAX_QTY} of an item.` : null;
    const min = allowZero ? 0 : 1;
    if (qty < min || qty > MAX_QTY) return `Quantity must be between ${min} and ${MAX_QTY}.`;
    return null;
  }

  function addToCart(cart, productId, qty) {
    const product = store.product(productId);
    if (!product) return 'That product does not exist.';
    const err = checkQty(qty, { allowZero: false });
    if (err) return err;
    const existing = cart.lines.find((l) => l.productId === product.id);
    const newQty = (existing?.qty ?? 0) + qty;
    if (newQty > MAX_QTY) return `You can order at most ${MAX_QTY} of an item.`;
    if (existing) existing.qty = newQty;
    else cart.lines.push({ productId: product.id, qty });
    return null;
  }

  function updateLine(cart, index, qty) {
    if (!cart.lines[index]) return 'That cart line no longer exists.';
    const err = checkQty(qty, { allowZero: true });
    if (err) return err;
    if (qty === 0) cart.lines.splice(index, 1);
    else cart.lines[index].qty = qty;
    return null;
  }

  function removeLine(cart, index) {
    if (!cart.lines[index]) return 'That cart line no longer exists.';
    if (has('B09')) cart.lines.splice(index - 1, 1);
    else cart.lines.splice(index, 1);
    return null;
  }

  function applyCode(cart, code) {
    const c = String(code ?? '').trim().toUpperCase();
    if (!c) {
      cart.code = null;
      return null;
    }
    if (!store.discountCodes[c]) return 'That discount code is not valid.';
    cart.code = c;
    return null;
  }

  // Prices the cart. Lines are resolved against the current catalogue.
  function totals(cart) {
    const lines = cart.lines
      .map((l) => {
        const p = store.product(l.productId);
        return p && { productId: p.id, name: p.name, emoji: p.emoji, unitCents: p.priceCents, qty: l.qty, lineCents: p.priceCents * l.qty };
      })
      .filter(Boolean);
    const subtotalCents = lines.reduce((sum, l) => sum + l.lineCents, 0);
    const percent = cart.code ? store.discountCodes[cart.code]?.percent ?? 0 : 0;
    const discountBase = has('B01') ? lines.reduce((sum, l) => sum + l.unitCents, 0) : subtotalCents;
    const discountCents = Math.round((discountBase * percent) / 100);
    const freeShipping = has('B10') ? subtotalCents > FREE_SHIPPING_FROM_CENTS : subtotalCents >= FREE_SHIPPING_FROM_CENTS;
    const shippingCents = lines.length === 0 || freeShipping ? 0 : SHIPPING_CENTS;
    const totalCents = subtotalCents - discountCents + shippingCents;
    return { lines, subtotalCents, code: cart.code, discountCents, shippingCents, totalCents };
  }

  function validEmail(email) {
    const e = String(email ?? '').trim();
    if (has('B04')) return /^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(e);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }

  function orderHistory(userId) {
    const mine = store.orders.filter((o) => o.userId === userId);
    if (has('B06')) return mine.slice(0, 5).reverse();
    return mine.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return { listProducts, search, addToCart, updateLine, removeLine, applyCode, totals, validEmail, orderHistory, has };
}

// Fill in totals for seeded orders that only list their lines, using the
// same pricing as live orders (with no planted bugs).
export function priceSeedOrders(store) {
  const { totals } = createShop(store, new Set());
  for (const o of store.orders) {
    if (o.totalCents !== undefined) continue;
    const t = totals({ lines: o.lines.map(({ productId, qty }) => ({ productId, qty })), code: null });
    Object.assign(o, {
      subtotalCents: t.subtotalCents,
      code: null,
      discountCents: t.discountCents,
      shippingCents: t.shippingCents,
      totalCents: t.totalCents,
    });
    o.shipTo = 'Demo address';
    o.cardLast4 = '4242';
  }
}
