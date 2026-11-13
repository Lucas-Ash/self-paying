/* Build-time definitions for the seller tools (everything that is not a per-platform fee page). */
const Tools = require('../lib/tools');

const INCOME_SLUGS = ['patreon', 'substack', 'ko-fi', 'buy-me-a-coffee', 'gumroad', 'lemon-squeezy'];

const LIST = [
  { path: '/profit-calculator/', name: 'Profit calculator', blurb: 'Fees, costs, profit and margin on one sale' },
  { path: '/price-list/', name: 'Price list tool', blurb: 'Paste your prices, compare platforms, export CSV' },
  { path: '/income-goal-calculator/', name: 'Income goal calculator', blurb: 'Supporters or sales needed to hit a monthly goal' },
  { path: '/freelance-rate-calculator/', name: 'Freelance rate calculator', blurb: 'The hourly rate that pays the salary you want' },
  { path: '/break-even-calculator/', name: 'Break-even calculator', blurb: 'Sales needed to cover your fixed costs' },
  { path: '/discount-calculator/', name: 'Discount impact calculator', blurb: 'What a sale price does to your profit' },
  { path: '/margin-markup-calculator/', name: 'Margin and markup calculator', blurb: 'Convert between margin, markup and price' },
  { path: '/invoice-generator/', name: 'Invoice generator', blurb: 'Make an invoice and save it as a PDF' },
  { path: '/compare/', name: 'Head-to-head', blurb: 'Any two platforms side by side' }
];

module.exports = function (ctx) {
  const { page, url, esc, P, bySlug, cfg, money, rateText, calcUrl, faqHtml, faqLd, affiliateCta, reviewed } = ctx;
  const num = (label, name, value, extra = '') => `<label>${label}<input type="number" inputmode="decimal" min="0" step="any" value="${value}" data-in="${name}"${extra}></label>`;
  const platformSelect = (selected, list = P, none = 'No platform fees') =>
    `<label>Platform<select data-in="platform">${none ? `<option value="">${none}</option>` : ''}${list.map(p => `<option value="${p.slug}"${p.slug === selected ? ' selected' : ''}>${esc(p.name)} (${esc(rateText(p))})</option>`).join('')}</select></label>`;
  const stat = (label, name) => `<div class="stat"><span>${label}</span><b data-out="${name}"></b></div>`;
  const noscript = `<noscript><p class="note">This tool needs JavaScript.</p></noscript>`;
  const cards = (list = LIST) => `<ul class="cards">${list.map(t => `<li><a href="${url(t.path)}"><b>${esc(t.name)}</b><span>${esc(t.blurb)}</span></a></li>`).join('')}</ul>`;
  const others = path => `<h2>More tools</h2>\n${cards(LIST.filter(t => t.path !== path))}`;
  const n = x => x.toLocaleString('en-US');

  function build() {
    page({
      file: 'tools/index.html',
      title: `Free Tools for Online Sellers, Creators and Freelancers | ${cfg.siteName}`,
      description: `Free calculators for people who sell online: profit, break-even, discounts, margin and markup, income goals, freelance rates and an invoice generator.`,
      body: `<h1>Tools</h1>
<p class="lede">Free calculators for people who sell online. Everything runs in your browser; nothing you type is sent anywhere.</p>
${cards()}
<h2>Fee calculators</h2>
<ul class="cards">${P.map(p => `<li><a href="${calcUrl(p)}"><b>${esc(p.name)}</b><span>${esc(rateText(p))}</span></a></li>`).join('')}</ul>`
    });

    /* ----- income goal ----- */
    const incomeList = INCOME_SLUGS.map(s => bySlug[s]);
    const incomeCalc = selected => `<section class="calc" data-tool="income">
  <div class="fields three">
    ${platformSelect(selected, incomeList, '')}
    ${num('Monthly take-home goal (USD)', 'goal', 2000)}
    ${num('Price per supporter per month (USD)', 'price', 5)}
  </div>
  <div class="results">${stat('Paying supporters needed', 'supporters')}${stat('You keep per supporter', 'each')}${stat('Fees per month', 'fees')}</div>
  <p class="src" data-out="summary"></p>${noscript}
</section>`;
    const incomeTable = p => `<table class="tbl">
<thead><tr><th>Monthly goal</th>${[3, 5, 10, 25].map(x => `<th class="num">At $${x} a month</th>`).join('')}</tr></thead>
<tbody>${[500, 1000, 2500, 5000, 10000].map(g => `<tr><td>$${n(g)}</td>${[3, 5, 10, 25].map(x => `<td class="num">${n(Tools.supportersNeeded(p, x, g).supporters)}</td>`).join('')}</tr>`).join('\n')}</tbody></table>`;
    page({
      file: 'income-goal-calculator/index.html',
      title: `Creator Income Goal Calculator: Supporters Needed After Fees | ${cfg.siteName}`,
      description: `How many paying subscribers, members or customers you need to take home a monthly income after platform fees on Patreon, Substack, Ko-fi, Gumroad and more.`,
      body: `<h1>Income goal calculator</h1>
<p class="lede">Set a monthly take-home goal and a price, and see how many paying supporters you need once the platform has taken its fees.</p>
${incomeCalc('patreon')}
<h2>By platform</h2>
<ul class="cards">${incomeList.map(p => `<li><a href="${url(`/${p.slug}-income-calculator/`)}"><b>${esc(p.name)} income calculator</b><span>${esc(rateText(p, 5))}</span></a></li>`).join('')}</ul>
<h2>Why small prices need more supporters than you would expect</h2>
<p>Most platforms charge a fixed amount per payment as well as a percentage. On a $3 pledge the fixed part is a large share of the price; on a $25 pledge it barely matters. Raising your lowest tier by a dollar or two often does more for your income than finding more supporters.</p>
${others('/income-goal-calculator/')}`
    });
    for (const p of incomeList) {
      const ex = Tools.supportersNeeded(p, 5, 1000);
      const qa = [
        [`How many ${p.name} supporters do I need to make $1,000 a month?`, `At $5 a month each you need ${n(ex.supporters)} paying supporters. ${p.name} and payment processing take ${money(5 - ex.perSupporter)} of each $5, so you keep ${money(ex.perSupporter)}.`],
        [`How much do I keep from a $10 ${p.name} payment?`, `${money(Tools.supportersNeeded(p, 10, 1000).perSupporter)} at the standard US rate (${rateText(p, 10)}).`],
        [`Does this include tax?`, `No. The figures are after platform and payment fees but before income tax, and before any sales tax or VAT the platform collects from buyers.`]
      ];
      page({
        file: `${p.slug}-income-calculator/index.html`,
        title: `${p.name} Income Calculator: How Many Supporters You Need | ${cfg.siteName}`,
        description: `See how many paying ${p.name} supporters you need for a monthly income goal after fees (${rateText(p, 5)}). $1,000 a month at $5 each takes ${n(ex.supporters)}.`,
        body: `<p class="crumb"><a href="${url('/tools/')}">Tools</a> › <a href="${url('/income-goal-calculator/')}">Income goal</a> › ${esc(p.name)}</p>
<h1>${esc(p.name)} income calculator</h1>
<p class="lede">${esc(p.summary)} Set a goal and a price to see how many paying supporters that takes.</p>
${incomeCalc(p.slug)}
${affiliateCta(p)}
<h2>Supporters needed on ${esc(p.name)}</h2>
${incomeTable(p)}
<ul>${p.notes.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
<p class="links"><a href="${calcUrl(p)}">${esc(p.name)} fee calculator</a> · <a href="${url('/income-goal-calculator/')}">Compare other platforms</a></p>
<p class="src">Source: <a href="${esc(p.source)}" rel="noopener nofollow">${esc(p.name)}'s published fees</a>. Reviewed ${reviewed}.</p>
${faqHtml(qa)}`,
        jsonld: faqLd(qa)
      });
    }

    /* ----- freelance rate ----- */
    const fr = Tools.freelanceRate({ income: 70000, expenses: 6000, taxPct: 25, weeksOff: 6, hoursPerWeek: 40, billablePct: 60, feePct: 0 });
    const frQa = [
      [`How do I work out a freelance hourly rate?`, `Start from the income you want to take home, add tax and business expenses to get the revenue you need, then divide by the hours you can actually bill. For $70,000 take-home, $6,000 of expenses, 25% set aside for tax, 6 weeks off and 60% of a 40-hour week billable, that is ${money(fr.hourly)} an hour.`],
      [`Why is the rate so much higher than a salary divided by 2,080 hours?`, `An employee is paid for every hour, including holidays, admin and quiet weeks. A freelancer is paid only for billable hours and also covers tax, equipment, software and insurance.`],
      [`What should I enter for platform fee?`, `The share a marketplace keeps from what the client pays you: 20% on Fiverr, typically 10% on Upwork, and 0% if clients pay you directly.`]
    ];
    page({
      file: 'freelance-rate-calculator/index.html',
      title: `Freelance Hourly Rate Calculator | ${cfg.siteName}`,
      description: `Work out the hourly and day rate you need to charge as a freelancer to take home the income you want, after tax, expenses, time off, unbilled hours and platform fees.`,
      body: `<h1>Freelance rate calculator</h1>
<p class="lede">Enter the income you want to take home. The calculator works back through tax, expenses, time off and unbilled hours to the rate you need to charge.</p>
<section class="calc" data-tool="freelance">
  <div class="fields three">
    ${num('Take-home income you want per year (USD)', 'income', 70000)}
    ${num('Business expenses per year (USD)', 'expenses', 6000)}
    ${num('Set aside for tax (%)', 'taxPct', 25, ' max="95"')}
    ${num('Weeks off per year', 'weeksOff', 6, ' max="51"')}
    ${num('Working hours per week', 'hoursPerWeek', 40)}
    ${num('Share of hours you can bill (%)', 'billablePct', 60, ' max="100"')}
    <label>Platform fee<select data-in="feePct"><option value="0">None, clients pay me directly</option><option value="10">Upwork (typically 10%)</option><option value="20">Fiverr (20%)</option></select></label>
  </div>
  <div class="results">${stat('Hourly rate to charge', 'hourly')}${stat('Day rate (8 hours)', 'daily')}${stat('Revenue needed per year', 'revenue')}</div>
  <p class="src" data-out="summary"></p>${noscript}
</section>
<p>The tax figure is a rough set-aside, not a tax calculation. Rates depend on where you live and how your business is set up, so ask an accountant for your own number.</p>
${faqHtml(frQa)}
${others('/freelance-rate-calculator/')}`,
      jsonld: faqLd(frQa)
    });

    /* ----- break-even ----- */
    page({
      file: 'break-even-calculator/index.html',
      title: `Break-Even Calculator for Online Sellers | ${cfg.siteName}`,
      description: `Find how many sales you need to cover your fixed costs, with selling fees on Etsy, eBay, Shopify, Gumroad and other platforms included automatically.`,
      body: `<h1>Break-even calculator</h1>
<p class="lede">How many sales before you have covered your fixed costs? Platform fees are taken off each sale for you.</p>
<section class="calc" data-tool="breakeven">
  <div class="fields">
    ${platformSelect('etsy')}
    ${num('Fixed costs to cover (USD)', 'fixed', 1500)}
    ${num('Selling price per unit (USD)', 'price', 30)}
    ${num('Cost per unit, including shipping (USD)', 'unitCost', 10)}
  </div>
  <div class="results">${stat('Sales to break even', 'units')}${stat('Earned per sale after fees and cost', 'contribution')}${stat('Revenue at break-even', 'revenue')}</div>
  <p class="src" data-out="summary"></p>${noscript}
</section>
<h2>How it works</h2>
<p>Each sale contributes its price, minus the platform's fees, minus what the unit costs you. Divide your fixed costs (equipment, a course, a stall fee, a month of software) by that contribution, and round up. If the contribution is zero or negative you lose money on every sale and can never break even at that price.</p>
${others('/break-even-calculator/')}`
    });

    /* ----- discount ----- */
    page({
      file: 'discount-calculator/index.html',
      title: `Discount Impact Calculator: What a Sale Does to Profit | ${cfg.siteName}`,
      description: `See how a discount changes your profit per sale after platform fees, and how many extra sales you need to earn the same as at full price.`,
      body: `<h1>Discount impact calculator</h1>
<p class="lede">A 20% discount usually cuts profit by far more than 20%. See what a sale price does to your profit per order and how many more orders you need to make up for it.</p>
<section class="calc" data-tool="discount">
  <div class="fields">
    ${platformSelect('etsy')}
    ${num('Full price (USD)', 'price', 30)}
    ${num('Cost per unit, including shipping (USD)', 'unitCost', 10)}
    ${num('Discount (%)', 'discountPct', 20, ' max="100"')}
  </div>
  <div class="results">${stat('Profit at full price', 'before')}${stat('Profit at sale price', 'after')}${stat('Sales needed to earn the same', 'multiple')}</div>
  <p class="src" data-out="summary"></p>${noscript}
</section>
<h2>Why discounts cost more than they look</h2>
<p>A discount comes straight out of your profit, because the unit cost and the fixed part of the platform fee stay the same. If you make $16 on a $30 item, taking $6 off the price removes about a third of your profit, not a fifth.</p>
${others('/discount-calculator/')}`
    });

    /* ----- margin / markup ----- */
    const mmQa = [
      [`What is the difference between margin and markup?`, `Both describe the same profit against a different base. Margin is profit divided by the selling price; markup is profit divided by the cost. An item that costs $10 and sells for $25 has a $15 profit, a 60% margin and a 150% markup.`],
      [`How do I price for a 50% margin?`, `Divide the cost by 0.5. An item costing $10 needs to sell for $20. In general, price = cost ÷ (1 − margin).`],
      [`Does this include platform fees?`, `No, this is the plain conversion. To include selling fees, use the profit calculator.`]
    ];
    page({
      file: 'margin-markup-calculator/index.html',
      title: `Margin and Markup Calculator | ${cfg.siteName}`,
      description: `Convert between profit margin and markup, and find the selling price for a target margin or markup from your cost.`,
      body: `<h1>Margin and markup calculator</h1>
<p class="lede">Enter a cost and a price to get the margin and markup, or enter a target to get the price.</p>
<section class="calc" data-tool="margin">
  <div class="fields">${num('Cost (USD)', 'cost', 10)}${num('Selling price (USD)', 'price', 25)}</div>
  <div class="results">${stat('Profit', 'profit')}${stat('Margin', 'margin')}${stat('Markup', 'markup')}</div>
  <div class="target two-up">
    <div>${num('Target margin (%)', 'targetMargin', 50, ' max="99"')}<p>Price for that margin: <b data-out="priceMargin"></b></p></div>
    <div>${num('Target markup (%)', 'targetMarkup', 100)}<p>Price for that markup: <b data-out="priceMarkup"></b></p></div>
  </div>${noscript}
</section>
<p class="links">Selling on a platform? The <a href="${url('/profit-calculator/')}">profit calculator</a> takes the fees off as well.</p>
${faqHtml(mmQa)}
${others('/margin-markup-calculator/')}`,
      jsonld: faqLd(mmQa)
    });

    /* ----- invoice ----- */
    const payers = ['stripe', 'paypal', 'square'].map(s => bySlug[s]);
    page({
      file: 'invoice-generator/index.html',
      title: `Free Invoice Generator: No Sign-Up, Save as PDF | ${cfg.siteName}`,
      description: `Fill in a simple invoice in your browser and save it as a PDF. No account, no watermark, and nothing you type is uploaded. Optionally add the card processing fee.`,
      body: `<div class="no-print"><h1>Invoice generator</h1>
<p class="lede">Fill in the invoice below and save it as a PDF. There is no account and no watermark, and nothing you type leaves your browser.</p></div>
<section class="invoice" data-invoice>
  <div class="inv-head">
    <div><input class="inv-title" data-keep="from" placeholder="Your name or business" aria-label="Your name or business">
      <textarea rows="3" data-keep="fromDetails" placeholder="Your address, email, tax number" aria-label="Your details"></textarea></div>
    <div class="inv-meta"><b>INVOICE</b>
      <label>Number<input data-keep="number" value="001"></label>
      <label>Date<input type="date" data-in="date"></label>
      <label>Due<input type="date" data-in="due"></label></div>
  </div>
  <label class="inv-to">Bill to<textarea rows="3" placeholder="Client name and address"></textarea></label>
  <table class="inv-items"><thead><tr><th>Description</th><th class="num">Qty</th><th class="num">Rate</th><th class="num">Amount</th><th class="no-print"></th></tr></thead><tbody data-out="items"></tbody></table>
  <p class="no-print"><button class="btn small" type="button" data-add>Add line</button></p>
  <div class="inv-foot">
    <div class="no-print inv-opts">
      ${num('Tax (%)', 'taxPct', 0)}
      <label>Add card processing fee<select data-in="platform"><option value="">No</option>${payers.map(p => `<option value="${p.slug}">${esc(p.name)} (${esc(rateText(p))})</option>`).join('')}</select></label>
    </div>
    <table class="inv-totals"><tbody>
      <tr><td>Subtotal</td><td class="num" data-out="subtotal"></td></tr>
      <tr data-row="tax"><td data-out="taxLabel">Tax</td><td class="num" data-out="tax"></td></tr>
      <tr data-row="fee"><td>Card processing fee</td><td class="num" data-out="fee"></td></tr>
      <tr class="total"><td>Total due</td><td class="num" data-out="total"></td></tr>
    </tbody></table>
  </div>
  <label class="inv-notes">Notes<textarea rows="2" data-keep="notes" placeholder="Payment details, terms, thank-you"></textarea></label>
</section>
<div class="no-print">
<p><button class="btn" type="button" data-print>Print or save as PDF</button> <small>Choose "Save as PDF" as the printer.</small></p>
<noscript><p class="note">This tool needs JavaScript.</p></noscript>
<h2>Passing on the card fee</h2>
<p>If a client pays by card, the processor takes its fee out of what you receive. Choosing a processor above adds a line so that, after the fee, you receive the full invoice amount. Rules on charging clients a card fee vary by country and state, and some card networks restrict it, so check what applies to you before using it.</p>
${others('/invoice-generator/')}</div>`
    });
  }

  return { cards, build, LIST };
};
