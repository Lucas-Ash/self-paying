const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { breakdown, chargeFor, rateText, money, profit, priceForMargin } = require('../lib/fees');
const data = require('../data/platforms.json');
const by = Object.fromEntries(data.platforms.map(p => [p.slug, p]));

test('Stripe: 2.9% + 30c on $100', () => {
  const b = breakdown(by.stripe, 100);
  assert.equal(b.fee, 3.2);
  assert.equal(b.net, 96.8);
  assert.equal(b.effectivePct, 3.2);
});

test('Etsy: three components add up on $100', () => {
  assert.equal(breakdown(by.etsy, 100).fee, 9.95); // 6.50 + 3.25 + 0.20
});

test('eBay: per-order fee tier switches above $10', () => {
  assert.equal(breakdown(by.ebay, 10).fee, 1.66);  // 1.36 + 0.30
  assert.equal(breakdown(by.ebay, 20).fee, 3.12);  // 2.72 + 0.40
});

test('Patreon: micropayment rate at $3 and under', () => {
  assert.equal(breakdown(by.patreon, 3).fee, 0.55);  // 0.30 + 0.15 + 0.10
  assert.equal(breakdown(by.patreon, 5).fee, 0.95);  // 0.50 + 0.145->0.15 + 0.30
});

test('chargeFor returns the lowest price that nets the target, for every platform', () => {
  for (const p of data.platforms) {
    for (const target of [1, 4.99, 10, 99.99, 100, 2500]) {
      const c = chargeFor(p, target);
      assert.ok(breakdown(p, c).net >= target, `${p.slug} ${target}: nets too little`);
      assert.ok(breakdown(p, c - 0.01).net < target, `${p.slug} ${target}: not the minimum`);
    }
  }
});

test('profit: Etsy fees apply to price plus shipping charged', () => {
  const r = profit(by.etsy, { price: 30, shippingCharged: 5, itemCost: 10, shippingCost: 4.5, otherCost: 0.5 });
  assert.equal(r.revenue, 35);
  assert.equal(r.fee, 3.78);      // 2.275->2.28 + 1.30 + 0.20
  assert.equal(r.profit, 16.22);  // 35 - 3.78 - 15
  assert.equal(r.marginPct, 46.34);
});

test('priceForMargin returns the lowest price that reaches the margin', () => {
  for (const p of data.platforms) {
    const c = { itemCost: 10, shippingCost: 3 };
    const price = priceForMargin(p, c, 40);
    assert.ok(profit(p, { ...c, price }).marginPct >= 40, p.slug);
    const below = profit(p, { ...c, price: price - 0.01 });
    assert.ok(below.profit / below.revenue * 100 < 40, p.slug);
  }
  assert.equal(priceForMargin(by.fiverr, { itemCost: 10 }, 85), null); // 20% fee makes 85% impossible
});

test('tools: income goal, freelance rate, break-even, discount, margin, invoice', () => {
  const T = require('../lib/tools');
  const s = T.supportersNeeded(by.patreon, 5, 1000);            // keep 5 - 0.95 = 4.05 each
  assert.equal(s.perSupporter, 4.05);
  assert.equal(s.supporters, 247);
  assert.ok(s.takeHome >= 1000 && s.takeHome - s.perSupporter < 1000);

  const f = T.freelanceRate({ income: 60000, expenses: 5000, taxPct: 25, weeksOff: 4, hoursPerWeek: 40, billablePct: 50, feePct: 20 });
  assert.equal(f.billableHours, 960);
  assert.equal(f.revenue, 106250);                              // (60000/0.75 + 5000) / 0.8
  assert.equal(f.hourly, 110.68);
  assert.equal(T.freelanceRate({ income: 1, hoursPerWeek: 0, billablePct: 50 }), null);

  const b = T.breakEven(by.stripe, { fixed: 1000, price: 20, unitCost: 5 }); // 20 - 0.88 - 5 = 14.12
  assert.equal(b.contribution, 14.12);
  assert.equal(b.units, 71);
  assert.equal(T.breakEven(by.fiverr, { fixed: 100, price: 10, unitCost: 9 }).units, null);

  const d = T.discount(null, { price: 30, unitCost: 10, discountPct: 20 });
  assert.deepEqual([d.salePrice, d.before, d.after, d.salesMultiple], [24, 20, 14, 1.43]);

  assert.deepEqual(T.marginMarkup(10, 25), { profit: 15, marginPct: 60, markupPct: 150 });
  assert.equal(T.priceFromMargin(10, 50), 20);
  assert.equal(T.priceFromMargin(10, 100), null);
  assert.equal(T.priceFromMarkup(10, 150), 25);

  const items = [{ qty: 10, rate: 50 }, { qty: 1, rate: 99.5 }];
  assert.deepEqual(T.invoice(items, 10), { subtotal: 599.5, tax: 59.95, fee: 0, total: 659.45 });
  const withFee = T.invoice(items, 10, by.stripe);
  assert.equal(breakdown(by.stripe, withFee.total).net >= 659.45, true);
  assert.equal(withFee.fee, Math.round((withFee.total - 659.45) * 100) / 100);
});

test('formatting', () => {
  assert.equal(money(1234.5), '$1,234.50');
  assert.equal(money(-0.2), '-$0.20');
  assert.equal(rateText(by.stripe), '2.9% + $0.30');
  assert.equal(rateText(by.etsy), '9.5% + $0.45');
});

test('data is well formed', () => {
  const slugs = new Set();
  for (const p of data.platforms) {
    assert.ok(!slugs.has(p.slug)); slugs.add(p.slug);
    assert.ok(data.categories[p.category], `${p.slug}: unknown category`);
    assert.match(p.source, /^https:\/\//);
    assert.ok(p.summary && p.notes.length && p.components.length);
    for (const a of data.amounts) assert.ok(breakdown(p, a).net > 0);
  }
});

test('build produces every page, with working internal links', () => {
  require('child_process').execFileSync('node', [path.join(__dirname, '../build.js')]);
  const cfg = require('../site.config.json');
  const dist = path.join(__dirname, '../dist');
  const n = data.platforms.length;
  const files = [];
  (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : files.push(path.join(d, e.name)); })(dist);
  const html = files.filter(f => f.endsWith('.html'));
  assert.ok(html.length >= 1 + n + n * data.amounts.length + n * (n - 1) / 2 + 3);
  for (const f of html) {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!/undefined|NaN|\[object/.test(src), `${f}: bad interpolation`);
    for (const m of src.matchAll(/(?:href|src)="(\/[^"#]*)/g)) {
      assert.ok(m[1].startsWith(cfg.basePath + '/'), `${f}: link outside base path: ${m[1]}`);
      let target = path.join(dist, m[1].slice(cfg.basePath.length));
      if (target.endsWith(path.sep) || !path.extname(target)) target = path.join(target, 'index.html');
      assert.ok(fs.existsSync(target), `${f}: broken link ${m[1]}`);
    }
  }
});
