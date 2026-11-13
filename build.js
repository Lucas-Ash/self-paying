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
const { money, breakdown, chargeFor, rateText } = Fees;
const reviewed = new Date(data.reviewed + 'T00:00:00Z')
  .toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const url = p => BASE + p;
const calcUrl = p => url(`/${p.slug}-fee-calculator/`);
const whole = n => '$' + n.toLocaleString('en-US');
const pages = [];

function page({ file, title, description, body, jsonld, noindex }) {
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

  const html = `<!doctype html>
<html lang="en">
<head>
${head}
</head>
<body>
<header class="top"><div class="wrap">
  <a class="brand" href="${url('/')}">${esc(cfg.siteName)}</a>
  <nav><a href="${url('/')}#calculators">Calculators</a><a href="${url('/compare/')}">Compare</a><a href="${url('/about/')}">About</a>${mon.tipUrl ? `<a href="${url('/support/')}">Support</a>` : ''}</nav>
</div></header>
<main class="wrap">
${body}
</main>
<footer class="wrap foot">
  <p>Rates are standard published US rates in USD, last reviewed ${reviewed}. Platforms change their pricing, and your account may be on different terms, so check the platform's own fee page before you rely on a figure. Nothing here is financial advice.</p>
  ${Object.keys(mon.affiliates || {}).length ? `<p>Some links to platforms are affiliate links: if you sign up through one, this site may earn a commission at no cost to you. It does not change the numbers shown.</p>` : ''}
  <p><a href="${url('/about/')}">About &amp; method</a>${mon.tipUrl ? ` · <a href="${url('/support/')}">Support this site</a>` : ''}</p>
</footer>
<script src="${url('/fees.js')}"></script>
<script src="${url('/platforms.js')}"></script>
<script src="${url('/app.js')}"></script>
</body>
</html>
`;
  const dest = path.join(OUT, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
  if (!noindex) pages.push(canonical);
}

/* ---------- shared fragments ---------- */

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

<h2 id="calculators">Calculators by platform</h2>
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
<h2>${esc(p.name)} fees on common amounts</h2>
${amountsTable(p)}
<h2>What to know</h2>
<ul>${p.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>
<p class="src">Source: <a href="${esc(p.source)}" rel="noopener nofollow">${esc(p.name)}'s published fees</a>. Reviewed ${reviewed}.</p>
${peers.length ? `<h2>${esc(p.name)} compared with similar platforms</h2>
<p>On a $100 sale:</p>
${comparisonTable(100, sameCategory(p), p.slug)}
<p class="links">${peers.map(o => `<a href="${url(`/compare/${pairSlug(p, o)}/`)}">${esc(p.name)} vs ${esc(o.name)}</a>`).join(' · ')}</p>` : ''}
${faqHtml(qa)}`,
    jsonld: faqLd(qa)
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
for (const f of ['style.css', 'app.js', 'favicon.svg']) fs.copyFileSync(path.join(__dirname, 'src', f), path.join(OUT, f));
fs.copyFileSync(path.join(__dirname, 'lib/fees.js'), path.join(OUT, 'fees.js'));
fs.writeFileSync(path.join(OUT, 'platforms.js'),
  `window.SITE=${JSON.stringify({ base: BASE, categories: data.categories, platforms: P.map(({ slug, name, category, components }) => ({ slug, name, category, components })) })};\n`);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(u => `<url><loc>${u}</loc><lastmod>${data.reviewed}</lastmod></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${ORIGIN}${BASE}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT, '.nojekyll'), '');
if (mon.adsenseClient) fs.writeFileSync(path.join(OUT, 'ads.txt'), `google.com, ${mon.adsenseClient.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);

console.log(`Built ${pages.length} pages to dist/`);
