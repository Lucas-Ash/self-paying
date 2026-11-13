#!/usr/bin/env node
/* Static site generator. No dependencies: `node build.js` writes the site to ./dist */
const fs = require('fs');
const path = require('path');
const Fees = require('./lib/fees');

const data = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/platforms.json'), 'utf8'));
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'site.config.json'), 'utf8'));
const mon = cfg.monetization || {};
const OUT = path.join(__dirname, 'dist');
const BASE = (cfg.basePath || '').replace(/\/$/, '');
const ORIGIN = cfg.origin.replace(/\/$/, '');
const P = data.platforms;
const bySlug = Object.fromEntries(P.map(p => [p.slug, p]));
const { money, breakdown, chargeFor, rateText, profit, priceForMargin } = Fees;
const reviewed = new Date(data.reviewed + 'T00:00:00Z')
  .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const url = p => BASE + p;
const calcUrl = p => url(`/${p.slug}-fee-calculator/`);
const profitUrl = p => url(`/${p.slug}-profit-calculator/`);
const whole = n => '$' + n.toLocaleString('en-US');
const pages = [];

function page({ file, title, description, body, jsonld, noindex, bare }) {
  const canonical = ORIGIN + BASE + '/' + file.replace(/index\.html$/, '');
  const head = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}">`,
    noindex ? `<meta name="robots" content="noindex">` : `<link rel="canonical" href="${canonical}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(description)}">`,
    `<meta property="og:type" content="website">`,
    `<link rel="icon" href="${url('/favicon.svg')}" type="image/svg+xml">`,
    `<link rel="stylesheet" href="${url('/style.css')}">`,
    jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : '',
    mon.adsenseClient ? `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(mon.adsenseClient)}" crossorigin="anonymous"></script>` : '',
    mon.goatcounterCode ? `<script data-goatcounter="https://${esc(mon.goatcounterCode)}.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>` : ''
  ].filter(Boolean).join('\n');

  const scripts = `<script src="${url('/fees.js')}"></script>
<script src="${url('/platforms.js')}"></script>
<script src="${url('/tools.js')}"></script>
<script src="${url('/app.js')}"></script>
<script src="${url('/tools-app.js')}"></script>`;
  const html = bare ? `<!doctype html>
<html lang="en">
<head>
${head}
</head>
<body class="bare">
${body}
${scripts}
</body>
</html>
` : `<!doctype html>
<html lang="en">
<head>
${head}
</head>
<body>
<header class="top no-print"><div class="wrap">
  <a class="brand" href="${url('/')}">${esc(cfg.siteName)}</a>
  <nav><a href="${url('/')}#calculators">Fees</a><a href="${url('/tools/')}">Tools</a><a href="${url('/compare/')}">Compare</a><a href="${url('/about/')}">About</a>${mon.tipUrl ? `<a href="${url('/support/')}">Support</a>` : ''}</nav>
</div></header>
<main class="wrap">
${body}
${promo()}
</main>
<footer class="wrap foot no-print">
  <p>Rates are standard published US rates in USD, last reviewed ${reviewed}. Platforms change their pricing, and your account may be on different terms, so check the platform's own fee page before you rely on a figure. Nothing here is financial advice.</p>
  ${Object.keys(mon.affiliates || {}).length ? `<p>Some links to platforms are affiliate links: if you sign up through one, this site may earn a commission at no cost to you. It does not change the numbers shown.</p>` : ''}
  <p><a href="${url('/about/')}">About &amp; method</a>${mon.tipUrl ? ` · <a href="${url('/support/')}">Support this site</a>` : ''}</p>
</footer>
${scripts}
</body>
</html>
`;
  const dest = path.join(OUT, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
  if (!noindex) pages.push(canonical);
}

/* ---------- shared fragments ---------- */

// Optional sponsor slot and email sign-up, both off unless configured.
function promo() {
  const sp = mon.sponsor || {}, nl = mon.newsletterAction;
  const parts = [];
  if (sp.url && sp.text) parts.push(`<p class="sponsor"><small>Sponsor</small> <a href="${esc(sp.url)}" rel="sponsored noopener" target="_blank">${esc(sp.text)}</a></p>`);
  if (nl) parts.push(`<form class="signup" action="${esc(nl)}" method="post" target="_blank">
  <label for="signup-email"><b>Get an email when a platform changes its fees.</b> A few messages a year, and you can unsubscribe at any time.</label>
  <div><input id="signup-email" type="email" name="email" placeholder="you@example.com" required><button class="btn" type="submit">Notify me</button></div>
</form>`);
  return parts.length ? `<aside class="promo">${parts.join('\n')}</aside>` : '';
}

function profitCalculator(p) {
  const opts = P.map(o => `<option value="${o.slug}"${p && o.slug === p.slug ? ' selected' : ''}>${esc(o.name)}</option>`).join('');
  return `<section class="calc" data-profit>
  <div class="fields three">
    <label>Platform<select data-in="platform">${opts}</select></label>
    <label>Item price (USD)<input type="number" inputmode="decimal" min="0" step="0.01" value="30" data-in="price"></label>
    <label>Shipping you charge the buyer<input type="number" inputmode="decimal" min="0" step="0.01" value="0" data-in="shippingCharged"></label>
    <label>Cost to make or buy the item<input type="number" inputmode="decimal" min="0" step="0.01" value="10" data-in="itemCost"></label>
    <label>What shipping costs you<input type="number" inputmode="decimal" min="0" step="0.01" value="0" data-in="shippingCost"></label>
    <label>Other costs per sale<input type="number" inputmode="decimal" min="0" step="0.01" value="0" data-in="otherCost"></label>
  </div>
  <div class="results">
    <div class="stat"><span>Platform fees</span><b data-out="fee"></b></div>
    <div class="stat"><span>Profit per sale</span><b data-out="profit"></b></div>
    <div class="stat"><span>Profit margin</span><b data-out="margin"></b></div>
  </div>
  <div class="target">
    <label>Target profit margin (%)<input type="number" inputmode="decimal" min="0" max="99" step="1" value="40" data-in="margin"></label>
    <p>Price to reach that margin: <b data-out="price"></b></p>
  </div>
  <noscript><p class="note">This calculator needs JavaScript. The table below shows worked examples.</p></noscript>
</section>`;
}

function embedSnippet(p) {
  const src = `${ORIGIN}${BASE}/embed/${p.slug}/`;
  const code = `<iframe src="${src}" title="${p.name} fee calculator" width="100%" height="260" style="border:1px solid #e2e0d8;border-radius:12px;max-width:480px" loading="lazy"></iframe>`;
  return `<details class="embed"><summary>Add this calculator to your own site</summary>
<p>Free to use on any blog, help page or shop. Copy this code and paste it into your page:</p>
<textarea readonly rows="4" data-copy>${esc(code)}</textarea>
<p><button class="btn small" type="button" data-copy-btn>Copy code</button></p></details>`;
}

function breakdownTable(p, amount) {
  const b = breakdown(p, amount);
  return `<table class="tbl">
<thead><tr><th>Item</th><th>Rate</th><th class="num">Amount</th></tr></thead>
<tbody>
<tr><td>Sale price</td><td></td><td class="num">${money(b.amount)}</td></tr>
${b.lines.map(l => `<tr><td>${esc(l.label)}</td><td>${[l.pct ? l.pct + '%' : '', l.fixed ? money(l.fixed) : ''].filter(Boolean).join(' + ')}</td><td class="num">-${money(l.fee)}</td></tr>`).join('\n')}
<tr class="total"><td>You keep</td><td>${b.effectivePct}% total fee</td><td class="num">${money(b.net)}</td></tr>
</tbody></table>`;
}

function amountsTable(p) {
  return `<table class="tbl">
<thead><tr><th>Sale price</th><th class="num">Fee</th><th class="num">You keep</th><th class="num">Effective rate</th><th class="num">Charge this to keep the full price</th></tr></thead>
<tbody>
${data.amounts.map(a => { const b = breakdown(p, a); return `<tr><td><a href="${calcUrl(p)}${a}/">${whole(a)}</a></td><td class="num">${money(b.fee)}</td><td class="num">${money(b.net)}</td><td class="num">${b.effectivePct}%</td><td class="num">${money(chargeFor(p, a))}</td></tr>`; }).join('\n')}
</tbody></table>`;
}

function comparisonTable(amount, list, highlight) {
  const rows = list.map(p => ({ p, b: breakdown(p, amount) })).sort((x, y) => y.b.net - x.b.net);
  return `<table class="tbl">
<thead><tr><th>Platform</th><th class="rate">Standard rate</th><th class="num">Fee</th><th class="num">You keep</th></tr></thead>
<tbody>
${rows.map(({ p, b }) => `<tr${p.slug === highlight ? ' class="hl"' : ''}><td><a href="${calcUrl(p)}">${esc(p.name)}</a></td><td class="rate">${esc(rateText(p, amount))}</td><td class="num">${money(b.fee)}</td><td class="num">${money(b.net)}</td></tr>`).join('\n')}
</tbody></table>`;
}

function calculator(p, amount) {
  return `<section class="calc" data-calc="${p.slug}">
  <div class="fields">
    <label>Sale price (USD)<input type="number" inputmode="decimal" min="0" step="0.01" value="${amount}" data-in="amount"></label>
    <label>Amount you want to keep (USD)<input type="number" inputmode="decimal" min="0" step="0.01" value="${amount}" data-in="target"></label>
  </div>
  <div class="results">
    <div class="stat"><span>Fee</span><b data-out="fee">${money(breakdown(p, amount).fee)}</b></div>
    <div class="stat"><span>You keep</span><b data-out="net">${money(breakdown(p, amount).net)}</b></div>
    <div class="stat"><span>Charge this to keep your target</span><b data-out="charge">${money(chargeFor(p, amount))}</b></div>
  </div>
  <div data-out="lines"></div>
</section>`;
}

function affiliateCta(p) {
  const link = (mon.affiliates || {})[p.slug];
  return link ? `<p class="cta"><a class="btn" href="${esc(link)}" rel="sponsored noopener" target="_blank">Get started with ${esc(p.name)}</a> <small>Affiliate link</small></p>` : '';
}

const faqLd = qa => ({
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: qa.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } }))
});
const faqHtml = qa => `<section class="faq"><h2>Common questions</h2>${qa.map(([q, a]) => `<h3>${esc(q)}</h3><p>${esc(a)}</p>`).join('\n')}</section>`;

const sameCategory = p => P.filter(o => o.category === p.category);
const pairSlug = (a, b) => [a.slug, b.slug].sort().join('-vs-');

/* ---------- pages ---------- */

const toolPages = require('./src/tool-pages')({ page, url, esc, P, bySlug, cfg, money, rateText, calcUrl, faqHtml, faqLd, affiliateCta, reviewed });

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

// Home
page({
  file: 'index.html',
  title: `Seller Fee Calculator: Compare ${P.length} Platforms | ${cfg.siteName}`,
  description: `Enter a price and see what you keep after fees on Stripe, PayPal, Etsy, eBay, Gumroad, Patreon and ${P.length - 6} more platforms, side by side.`,
  body: `<h1>What do you keep after fees?</h1>
<p class="lede">Enter a sale price to see the fee and your take-home on ${P.length} selling platforms, side by side.</p>
<section class="calc" data-compare>
  <div class="fields">
    <label>Sale price (USD)<input type="number" inputmode="decimal" min="0" step="0.01" value="100" data-in="amount"></label>
    <label>Show<select data-in="category"><option value="">All platforms</option>${Object.entries(data.categories).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}</select></label>
  </div>
  <div data-out="table">${comparisonTable(100, P)}</div>
</section>

<h2>Your own rate</h2>
<p>On a negotiated or non-US rate? Enter it here.</p>
<section class="calc" data-custom>
  <div class="fields three">
    <label>Sale price (USD)<input type="number" inputmode="decimal" min="0" step="0.01" value="100" data-in="amount"></label>
    <label>Percentage fee (%)<input type="number" inputmode="decimal" min="0" step="0.01" value="2.9" data-in="pct"></label>
    <label>Fixed fee (USD)<input type="number" inputmode="decimal" min="0" step="0.01" value="0.30" data-in="fixed"></label>
  </div>
  <div class="results">
    <div class="stat"><span>Fee</span><b data-out="fee">$3.20</b></div>
    <div class="stat"><span>You keep</span><b data-out="net">$96.80</b></div>
    <div class="stat"><span>Charge this to keep the full price</span><b data-out="charge">$103.30</b></div>
  </div>
</section>

<h2>More tools</h2>
${toolPages.cards()}

<h2 id="calculators">Fee calculators by platform</h2>
${Object.entries(data.categories).map(([k, v]) => `<h3>${esc(v)}</h3>
<ul class="cards">${P.filter(p => p.category === k).map(p => `<li><a href="${calcUrl(p)}"><b>${esc(p.name)}</b><span>${esc(rateText(p))}</span></a></li>`).join('')}</ul>`).join('\n')}`,
  jsonld: { '@context': 'https://schema.org', '@type': 'WebApplication', name: cfg.siteName, applicationCategory: 'FinanceApplication', operatingSystem: 'Any', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, url: ORIGIN + BASE + '/' }
});

// Platform pages and platform × amount pages
for (const p of P) {
  const b100 = breakdown(p, 100);
  const peers = sameCategory(p).filter(o => o !== p);
  const qa = [
    [`How much does ${p.name} take from a $100 sale?`, `At the standard US rate (${rateText(p, 100)}), ${p.name} takes ${money(b100.fee)} from a $100 sale, leaving you ${money(b100.net)}.`],
    [`How much should I charge to receive $100 after ${p.name} fees?`, `Charge ${money(chargeFor(p, 100))}. After ${p.name}'s fees you keep ${money(breakdown(p, chargeFor(p, 100)).net)}.`],
    [`What is the ${p.name} fee on a $25 sale?`, `${money(breakdown(p, 25).fee)}, which is ${breakdown(p, 25).effectivePct}% of the price. Fixed per-sale fees make the percentage higher on small sales.`]
  ];
  page({
    file: `${p.slug}-fee-calculator/index.html`,
    title: `${p.name} Fee Calculator (${data.reviewed.slice(0, 4)}): Fees and Take-Home | ${cfg.siteName}`,
    description: `${p.summary} Calculate the fee on any amount, or the price to charge to keep a target amount.`,
    body: `<p class="crumb"><a href="${url('/')}">All calculators</a> › ${esc(p.name)}</p>
<h1>${esc(p.name)} fee calculator</h1>
<p class="lede">${esc(p.summary)}</p>
${calculator(p, 100)}
${affiliateCta(p)}
<p class="links">Selling a physical or costed product? Use the <a href="${profitUrl(p)}">${esc(p.name)} profit calculator</a> to include your costs.</p>
<h2>${esc(p.name)} fees on common amounts</h2>
${amountsTable(p)}
<h2>What to know</h2>
<ul>${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
<p class="src">Source: <a href="${esc(p.source)}" rel="noopener nofollow">${esc(p.name)}'s published fees</a>. Reviewed ${reviewed}.</p>
${peers.length ? `<h2>${esc(p.name)} compared with similar platforms</h2>
<p>On a $100 sale:</p>
${comparisonTable(100, sameCategory(p), p.slug)}
<p class="links">${peers.map(o => `<a href="${url(`/compare/${pairSlug(p, o)}/`)}">${esc(p.name)} vs ${esc(o.name)}</a>`).join(' · ')}</p>` : ''}
${faqHtml(qa)}
${embedSnippet(p)}`,
    jsonld: faqLd(qa)
  });

  // Profit calculator for this platform
  const ex = [[15, 5], [30, 10], [60, 20], [120, 45]].map(([price, cost]) => ({ price, cost, r: profit(p, { price, itemCost: cost }) }));
  const exBase = { itemCost: 10 };
  const pqa = [
    [`How do I calculate profit per sale on ${p.name}?`, `Take what the buyer pays (item price plus any shipping you charge), subtract ${p.name}'s fees (${rateText(p, 30)} at the standard US rate), then subtract what the item and shipping cost you. On a $30 item that cost you $10, the fees are ${money(ex[1].r.fee)} and the profit is ${money(ex[1].r.profit)}.`],
    [`What should I charge on ${p.name} for a 40% profit margin?`, priceForMargin(p, exBase, 40) == null ? `At ${p.name}'s rates a 40% margin is not reachable for a typical item; lower your costs or choose a lower target.` : `For an item that costs you $10, charge ${money(priceForMargin(p, exBase, 40))}. After ${p.name}'s fees and your cost, 40% of the price is left as profit.`],
    [`Is profit margin the same as markup?`, `No. Margin is profit divided by the selling price; markup is profit divided by your cost. A $10 item sold for $30 has a 200% markup, but the margin is lower, and lower again once platform fees come off.`]
  ];
  page({
    file: `${p.slug}-profit-calculator/index.html`,
    title: `${p.name} Profit Calculator: Fees, Profit and Margin | ${cfg.siteName}`,
    description: `Work out your profit and margin per sale on ${p.name} after fees (${rateText(p, 30)}), item cost and shipping, and find the price that reaches your target margin.`,
    body: `<p class="crumb"><a href="${url('/')}">All calculators</a> › <a href="${calcUrl(p)}">${esc(p.name)}</a> › Profit</p>
<h1>${esc(p.name)} profit calculator</h1>
<p class="lede">Enter your price and costs to see what you earn per sale on ${esc(p.name)} after fees, and the price that reaches your target margin.</p>
${profitCalculator(p)}
${affiliateCta(p)}
<h2>Worked examples</h2>
<table class="tbl">
<thead><tr><th>Item price</th><th class="num">Item cost</th><th class="num">${esc(p.name)} fees</th><th class="num">Profit</th><th class="num">Margin</th></tr></thead>
<tbody>
${ex.map(e => `<tr><td>${whole(e.price)}</td><td class="num">${money(e.cost)}</td><td class="num">${money(e.r.fee)}</td><td class="num">${money(e.r.profit)}</td><td class="num">${e.r.marginPct}%</td></tr>`).join('\n')}
</tbody></table>
<h2>How ${esc(p.name)} fees are applied</h2>
<p>${esc(p.summary)}</p>
<ul>${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
<p class="links"><a href="${calcUrl(p)}">${esc(p.name)} fee calculator</a> · <a href="${url('/profit-calculator/')}">Profit calculator for all platforms</a></p>
<p class="src">Source: <a href="${esc(p.source)}" rel="noopener nofollow">${esc(p.name)}'s published fees</a>. Reviewed ${reviewed}.</p>
${faqHtml(pqa)}`,
    jsonld: faqLd(pqa)
  });

  // Embeddable widget
  page({
    file: `embed/${p.slug}/index.html`, noindex: true, bare: true,
    title: `${p.name} fee calculator`, description: `${p.name} fee calculator widget.`,
    body: `<div class="widget">
<h1>${esc(p.name)} fee calculator</h1>
${calculator(p, 100)}
<p class="credit">${esc(rateText(p))} standard US rate · <a href="${ORIGIN}${calcUrl(p)}" target="_blank" rel="noopener">${esc(p.name)} fee calculator by ${esc(cfg.siteName)}</a></p>
</div>`
  });

  for (const a of data.amounts) {
    const b = breakdown(p, a), charge = chargeFor(p, a);
    const idx = data.amounts.indexOf(a);
    const near = [data.amounts[idx - 1], data.amounts[idx + 1]].filter(Boolean);
    page({
      file: `${p.slug}-fee-calculator/${a}/index.html`,
      title: `${p.name} Fee on ${whole(a)}: You Keep ${money(b.net)} | ${cfg.siteName}`,
      description: `${p.name} takes ${money(b.fee)} from a ${whole(a)} sale (${b.effectivePct}%), so you keep ${money(b.net)}. To keep the full ${whole(a)}, charge ${money(charge)}.`,
      body: `<p class="crumb"><a href="${url('/')}">All calculators</a> › <a href="${calcUrl(p)}">${esc(p.name)}</a> › ${whole(a)}</p>
<h1>${esc(p.name)} fee on ${whole(a)}</h1>
<p class="lede">${esc(p.name)} takes <b>${money(b.fee)}</b> from a ${whole(a)} sale, so you keep <b>${money(b.net)}</b>. To keep the full ${whole(a)}, charge <b>${money(charge)}</b>.</p>
${breakdownTable(p, a)}
<h2>Try another amount</h2>
${calculator(p, a)}
${affiliateCta(p)}
<h2>${whole(a)} on other platforms</h2>
${comparisonTable(a, P, p.slug)}
<p class="links">${near.map(n => `<a href="${calcUrl(p)}${n}/">${esc(p.name)} fee on ${whole(n)}</a>`).join(' · ')} · <a href="${calcUrl(p)}">${esc(p.name)} fee calculator</a></p>
<p class="src">Source: <a href="${esc(p.source)}" rel="noopener nofollow">${esc(p.name)}'s published fees</a>. Reviewed ${reviewed}.</p>`
    });
  }
}

// Head-to-head pages
const pairs = [];
for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) pairs.push([P[i], P[j]]);
for (const [a, b] of pairs) {
  const slug = pairSlug(a, b);
  const rows = data.amounts.map(n => ({ n, x: breakdown(a, n), y: breakdown(b, n) }));
  const aWins = rows.filter(r => r.x.net > r.y.net).length, bWins = rows.filter(r => r.y.net > r.x.net).length;
  const verdict = aWins && bWins
    ? `Which is cheaper depends on the sale price: ${a.name} leaves you more at ${rows.filter(r => r.x.net > r.y.net).map(r => whole(r.n)).join(', ')}, and ${b.name} leaves you more at ${rows.filter(r => r.y.net > r.x.net).map(r => whole(r.n)).join(', ')}.`
    : aWins ? `${a.name} leaves you more at every price in the table.`
    : bWins ? `${b.name} leaves you more at every price in the table.`
    : `The two cost the same at standard rates.`;
  const same = a.category === b.category;
  page({
    file: `compare/${slug}/index.html`,
    title: `${a.name} vs ${b.name} Fees Compared | ${cfg.siteName}`,
    description: `${a.name} (${rateText(a)}) vs ${b.name} (${rateText(b)}): fees and take-home on sales from $5 to $5,000. On $100 you keep ${money(breakdown(a, 100).net)} vs ${money(breakdown(b, 100).net)}.`,
    body: `<p class="crumb"><a href="${url('/')}">All calculators</a> › <a href="${url('/compare/')}">Compare</a> › ${esc(a.name)} vs ${esc(b.name)}</p>
<h1>${esc(a.name)} vs ${esc(b.name)} fees</h1>
<p class="lede">${esc(verdict)}</p>
${same ? '' : `<p class="note">These are different kinds of platform (${esc(data.categories[a.category].toLowerCase())} and ${esc(data.categories[b.category].toLowerCase())}), so the fee buys different things. Compare what each includes, not only the price.</p>`}
<table class="tbl">
<thead><tr><th>Sale price</th><th class="num">${esc(a.name)} fee</th><th class="num">You keep</th><th class="num">${esc(b.name)} fee</th><th class="num">You keep</th></tr></thead>
<tbody>
${rows.map(r => `<tr><td>${whole(r.n)}</td><td class="num">${money(r.x.fee)}</td><td class="num${r.x.net > r.y.net ? ' win' : ''}">${money(r.x.net)}</td><td class="num">${money(r.y.fee)}</td><td class="num${r.y.net > r.x.net ? ' win' : ''}">${money(r.y.net)}</td></tr>`).join('\n')}
</tbody></table>
<div class="two">
${[a, b].map(p => `<section><h2>${esc(p.name)}</h2><p>${esc(p.summary)}</p><ul>${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul><p><a href="${calcUrl(p)}">${esc(p.name)} fee calculator</a></p>${affiliateCta(p)}</section>`).join('\n')}
</div>`
  });
}

page({
  file: 'compare/index.html',
  title: `Compare Platform Fees Head to Head | ${cfg.siteName}`,
  description: `Head-to-head fee comparisons between ${P.length} selling platforms, from Stripe vs PayPal to Gumroad vs Lemon Squeezy.`,
  body: `<h1>Compare platform fees</h1>
<p class="lede">Pick two platforms to see fees and take-home side by side.</p>
${Object.entries(data.categories).map(([k, v]) => {
    const inCat = pairs.filter(([a, b]) => a.category === k && b.category === k);
    return inCat.length ? `<h2>${esc(v)}</h2><ul class="plain">${inCat.map(([a, b]) => `<li><a href="${url(`/compare/${pairSlug(a, b)}/`)}">${esc(a.name)} vs ${esc(b.name)}</a></li>`).join('')}</ul>` : '';
  }).join('\n')}
<h2>Across categories</h2>
<ul class="plain">${pairs.filter(([a, b]) => a.category !== b.category).map(([a, b]) => `<li><a href="${url(`/compare/${pairSlug(a, b)}/`)}">${esc(a.name)} vs ${esc(b.name)}</a></li>`).join('')}</ul>`
});

page({
  file: 'profit-calculator/index.html',
  title: `Profit Margin Calculator for Online Sellers | ${cfg.siteName}`,
  description: `Calculate profit and margin on a sale after platform fees, item cost and shipping on ${P.length} platforms, and find the price that reaches your target margin.`,
  body: `<h1>Profit calculator for online sellers</h1>
<p class="lede">Pick a platform, enter your price and costs, and see your profit per sale after fees, plus the price that reaches your target margin.</p>
${profitCalculator(null)}
<h2>Profit calculators by platform</h2>
<ul class="cards">${P.map(p => `<li><a href="${profitUrl(p)}"><b>${esc(p.name)}</b><span>${esc(rateText(p))}</span></a></li>`).join('')}</ul>
<h2>How it works</h2>
<p>Platform fees are charged on what the buyer pays, which is the item price plus any shipping you charge. Profit is that amount minus the fees, the cost of the item, what shipping costs you and any other per-sale costs. Margin is profit as a share of what the buyer pays.</p>`
});

page({
  file: 'price-list/index.html',
  title: `Price List Fee Calculator: Compare Platforms, Export CSV | ${cfg.siteName}`,
  description: `Paste a list of prices and see the fee and take-home for each one on the platforms you choose, then download the result as a CSV file.`,
  body: `<h1>Price list tool</h1>
<p class="lede">Paste your prices, tick the platforms you sell on, and get the take-home for every price. Download the result as a CSV file for your spreadsheet.</p>
<section class="calc" data-pricelist>
  <label>Prices in USD, one per line or separated by commas<textarea rows="6" data-in="prices">9.99
19.99
24
49
99
249</textarea></label>
  <fieldset><legend>Platforms</legend>
  ${P.map(p => `<label class="chk"><input type="checkbox" value="${p.slug}"${['stripe', 'paypal', 'etsy', 'gumroad'].includes(p.slug) ? ' checked' : ''}> ${esc(p.name)}</label>`).join('\n  ')}
  </fieldset>
  <p><button class="btn" type="button" data-csv>Download CSV</button> <small data-out="count"></small></p>
  <div data-out="table"></div>
  <noscript><p class="note">This tool needs JavaScript.</p></noscript>
</section>
<p>Nothing you paste leaves your browser. The CSV includes the fee and the take-home for each platform.</p>`
});

toolPages.build();

page({
  file: 'about/index.html',
  title: `About and Method | ${cfg.siteName}`,
  description: `How ${cfg.siteName} calculates platform fees, where the rates come from and what the numbers leave out.`,
  body: `<h1>About and method</h1>
<p class="lede">${esc(cfg.siteName)} shows what a seller keeps after a platform's standard fees. It is free to use and runs entirely in your browser: nothing you type is sent anywhere.</p>
<h2>How fees are calculated</h2>
<p>Each platform is modelled as a list of fee components, each a percentage of the sale price plus a fixed amount. Each component is rounded to the cent and the components are added up. "Charge this to keep your target" is the lowest price, to the cent, that leaves at least your target after fees.</p>
<h2>Where the rates come from</h2>
<p>Rates are the standard published US rates for a domestic USD sale, last reviewed ${reviewed}. Every platform page links to the platform's own fee page.</p>
<table class="tbl"><thead><tr><th>Platform</th><th>Rate used</th><th>Source</th></tr></thead><tbody>
${P.map(p => `<tr><td><a href="${calcUrl(p)}">${esc(p.name)}</a></td><td>${esc(rateText(p))}</td><td><a href="${esc(p.source)}" rel="noopener nofollow">Fee page</a></td></tr>`).join('\n')}
</tbody></table>
<h2>What the numbers leave out</h2>
<ul><li>Sales tax, VAT and income tax.</li><li>International, currency conversion, payout, dispute and refund fees.</li><li>Monthly subscriptions, advertising fees and negotiated or volume pricing.</li></ul>
<p>Platforms change their pricing. If you spot a rate that is out of date, the data lives in one file in the <a href="https://github.com/Lucas-Ash/self-paying" rel="noopener">project repository</a>.</p>`
});

if (mon.tipUrl) {
  page({
    file: 'support/index.html',
    title: `Support ${cfg.siteName}`,
    description: `${cfg.siteName} is free to use. If it saved you time, you can support it here.`,
    body: `<h1>Support ${esc(cfg.siteName)}</h1>
<p class="lede">The calculators are free and always will be. If one saved you time or money, a small contribution keeps the rates reviewed and the site online.</p>
<p><a class="btn" href="${esc(mon.tipUrl)}" rel="noopener">Contribute</a></p>`
  });
}

page({
  file: '404.html', noindex: true,
  title: `Page not found | ${cfg.siteName}`, description: 'Page not found.',
  body: `<h1>Page not found</h1><p><a href="${url('/')}">Go to the calculators</a></p>`
});

/* ---------- assets ---------- */
for (const f of ['style.css', 'app.js', 'tools-app.js', 'favicon.svg']) fs.copyFileSync(path.join(__dirname, 'src', f), path.join(OUT, f));
fs.copyFileSync(path.join(__dirname, 'lib/fees.js'), path.join(OUT, 'fees.js'));
fs.copyFileSync(path.join(__dirname, 'lib/tools.js'), path.join(OUT, 'tools.js'));
fs.writeFileSync(path.join(OUT, 'platforms.js'),
  `window.SITE=${JSON.stringify({ base: BASE, categories: data.categories, platforms: P.map(({ slug, name, category, components }) => ({ slug, name, category, components })) })};\n`);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(u => `<url><loc>${u}</loc><lastmod>${data.reviewed}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}${BASE}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
if (mon.adsenseClient) fs.writeFileSync(path.join(OUT, 'ads.txt'), `google.com, ${mon.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);

console.log(`Built ${pages.length} pages to dist/`);
