const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { breakdown, chargeFor, rateText, money } = require('../lib/fees');
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
