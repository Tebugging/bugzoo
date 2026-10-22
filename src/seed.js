// Seed data. Every server start (and every nightly reset) begins from this.
// Prices are in cents.

export const products = [
  { id: 1, name: 'Ceramic Coffee Mug', category: 'Kitchen', priceCents: 1250, emoji: '☕', stock: 40, description: 'A sturdy 350 ml stoneware mug with a matte glaze.' },
  { id: 2, name: 'Bamboo Cutting Board', category: 'Kitchen', priceCents: 2499, emoji: '🪵', stock: 25, description: 'Large reversible board made from sustainable bamboo.' },
  { id: 3, name: 'Chef Knife', category: 'Kitchen', priceCents: 5900, emoji: '🔪', stock: 12, description: '20 cm stainless steel blade, full tang, balanced handle.' },
  { id: 4, name: 'Glass Water Bottle', category: 'Outdoor', priceCents: 1899, emoji: '🧴', stock: 60, description: 'Borosilicate glass bottle with a silicone sleeve.' },
  { id: 5, name: 'Trail Backpack', category: 'Outdoor', priceCents: 8900, emoji: '🎒', stock: 8, description: '28 litre daypack with rain cover and hip belt.' },
  { id: 6, name: 'Camping Lantern', category: 'Outdoor', priceCents: 3450, emoji: '🏮', stock: 15, description: 'Rechargeable LED lantern, up to 40 hours of light.' },
  { id: 7, name: 'Wool Socks', category: 'Clothing', priceCents: 899, emoji: '🧦', stock: 100, description: 'Merino wool hiking socks, cushioned sole.' },
  { id: 8, name: 'Rain Jacket', category: 'Clothing', priceCents: 10500, emoji: '🧥', stock: 10, description: 'Waterproof, breathable shell with a packable hood.' },
  { id: 9, name: 'Knit Beanie', category: 'Clothing', priceCents: 1500, emoji: '🧢', stock: 45, description: 'Soft ribbed beanie in recycled yarn.' },
  { id: 10, name: 'Desk Lamp', category: 'Home', priceCents: 4200, emoji: '💡', stock: 20, description: 'Adjustable arm lamp with warm dimmable light.' },
  { id: 11, name: 'Linen Cushion Cover', category: 'Home', priceCents: 2200, emoji: '🛋️', stock: 30, description: 'Washed linen cover, 45 x 45 cm, hidden zip.' },
  { id: 12, name: 'Scented Candle', category: 'Home', priceCents: 1600, emoji: '🕯️', stock: 50, description: 'Soy wax candle with cedar and fig notes.' },
  { id: 13, name: 'Wall Clock', category: 'Home', priceCents: 3900, emoji: '🕰️', stock: 14, description: 'Silent sweep movement, oak frame.' },
  { id: 14, name: 'Notebook Set', category: 'Office', priceCents: 1100, emoji: '📓', stock: 70, description: 'Three dotted A5 notebooks with lay-flat binding.' },
  { id: 15, name: 'Fountain Pen', category: 'Office', priceCents: 2500, emoji: '🖋️', stock: 22, description: 'Steel nib fountain pen with a converter.' },
  { id: 16, name: 'Monitor Stand', category: 'Office', priceCents: 5000, emoji: '🖥️', stock: 18, description: 'Solid wood riser with a storage shelf.' },
  { id: 17, name: 'Wireless Mouse', category: 'Office', priceCents: 2999, emoji: '🖱️', stock: 35, description: 'Quiet clicks, USB-C charging, three device pairing.' },
  { id: 18, name: 'Yoga Mat', category: 'Fitness', priceCents: 3200, emoji: '🧘', stock: 28, description: 'Non-slip 5 mm mat with a carry strap.' },
  { id: 19, name: 'Jump Rope', category: 'Fitness', priceCents: 950, emoji: '🪢', stock: 55, description: 'Adjustable speed rope with ball bearings.' },
  { id: 20, name: 'Dumbbell Pair', category: 'Fitness', priceCents: 6400, emoji: '🏋️', stock: 9, description: 'Two 5 kg neoprene dumbbells.' },
  { id: 21, name: 'Plant Pot', category: 'Garden', priceCents: 1350, emoji: '🪴', stock: 40, description: 'Terracotta pot with a drainage saucer, 15 cm.' },
  { id: 22, name: 'Watering Can', category: 'Garden', priceCents: 2750, emoji: '🚿', stock: 16, description: '1.5 litre steel watering can with a long spout.' },
  { id: 23, name: 'Seed Starter Kit', category: 'Garden', priceCents: 1999, emoji: '🌱', stock: 33, description: 'Herb seeds, peat pots and a mini greenhouse lid.' },
  { id: 24, name: 'Puzzle 1000 Pieces', category: 'Games', priceCents: 2100, emoji: '🧩', stock: 26, description: 'Illustrated map of an imaginary zoo.' },
  { id: 25, name: 'Board Game Classic', category: 'Games', priceCents: 3800, emoji: '🎲', stock: 11, description: 'Strategy game for 2 to 4 players, ages 10 and up.' },
  { id: 26, name: 'Playing Cards', category: 'Games', priceCents: 700, emoji: '🃏', stock: 80, description: 'Linen-finish deck with a tuck box.' },
];

// Demo accounts. These passwords are public on purpose: this is a practice app.
export const users = [
  { id: 1, name: 'Alice Demo', email: 'alice@bugzoo.dev', password: 'bugzoo-alice' },
  { id: 2, name: 'Bob Demo', email: 'bob@bugzoo.dev', password: 'bugzoo-bob' },
];

const line = (productId, qty) => {
  const p = products.find((x) => x.id === productId);
  return { productId, name: p.name, unitCents: p.priceCents, qty };
};

// Seeded order history. Totals are computed by the store on load.
export const orders = [
  { id: 1001, userId: 1, createdAt: '2026-06-02T10:15:00Z', lines: [line(1, 2), line(7, 3)] },
  { id: 1002, userId: 1, createdAt: '2026-06-20T18:40:00Z', lines: [line(10, 1)] },
  { id: 1003, userId: 2, createdAt: '2026-07-05T09:05:00Z', lines: [line(18, 1), line(19, 1)] },
  { id: 1004, userId: 1, createdAt: '2026-07-14T12:00:00Z', lines: [line(14, 2), line(15, 1)] },
  { id: 1005, userId: 1, createdAt: '2026-08-30T16:25:00Z', lines: [line(21, 3)] },
  { id: 1006, userId: 1, createdAt: '2026-09-18T08:50:00Z', lines: [line(24, 1), line(26, 2)] },
];

export const discountCodes = {
  SAVE10: { percent: 10 },
};
