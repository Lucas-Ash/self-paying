/* Maths for the seller tools, shared by tests and the browser. Depends on fees.js. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./fees'));
  else root.Tools = factory(root.Fees);
})(typeof self !== 'undefined' ? self : this, function (F) {
  var round = F.round;
  var NONE = { components: [] };
  function net(platform, price) { return F.breakdown(platform || NONE, price).net; }

  // How many paying supporters at `price` a month are needed to take home `goal` a month.
  function supportersNeeded(platform, price, goal) {
    var each = net(platform, price);
    if (each <= 0) return null;
    var n = Math.ceil(round(goal / each));
    return { perSupporter: each, supporters: n, gross: round(n * price), fees: round(n * (price - each)), takeHome: round(n * each) };
  }

  // Hourly rate needed to take home `income` a year.
  // o = {income, expenses, taxPct, weeksOff, hoursPerWeek, billablePct, feePct}
  function freelanceRate(o) {
    var tax = (o.taxPct || 0) / 100, fee = (o.feePct || 0) / 100;
    if (tax >= 1 || fee >= 1) return null;
    var hours = Math.max(0, 52 - (o.weeksOff || 0)) * (o.hoursPerWeek || 0) * (o.billablePct || 0) / 100;
    if (hours <= 0) return null;
    var revenue = ((o.income || 0) / (1 - tax) + (o.expenses || 0)) / (1 - fee);
    return { billableHours: Math.round(hours), revenue: round(revenue), hourly: round(revenue / hours), daily: round(revenue / hours * 8), monthly: round(revenue / 12) };
  }

  // Units to sell before fixed costs are covered.
  function breakEven(platform, o) {
    var contribution = round(net(platform, o.price || 0) - (o.unitCost || 0));
    if (contribution <= 0) return { contribution: contribution, units: null, revenue: null };
    var units = Math.ceil(round((o.fixed || 0) / contribution));
    return { contribution: contribution, units: units, revenue: round(units * o.price) };
  }

  // What a discount does to profit per sale, and how many more sales are needed to earn the same.
  function discount(platform, o) {
    var sale = round((o.price || 0) * (1 - (o.discountPct || 0) / 100));
    var before = round(net(platform, o.price || 0) - (o.unitCost || 0));
    var after = round(net(platform, sale) - (o.unitCost || 0));
    return { salePrice: sale, before: before, after: after, salesMultiple: before > 0 && after > 0 ? round(before / after) : null };
  }

  function marginMarkup(cost, price) {
    var p = round(price - cost);
    return { profit: p, marginPct: price > 0 ? round(p / price * 100) : 0, markupPct: cost > 0 ? round(p / cost * 100) : 0 };
  }
  function priceFromMargin(cost, marginPct) { return marginPct >= 100 ? null : round(cost / (1 - marginPct / 100)); }
  function priceFromMarkup(cost, markupPct) { return round(cost * (1 + markupPct / 100)); }

  // Invoice totals. `platform` set means the processing fee is passed on to the client.
  function invoice(items, taxPct, platform) {
    var subtotal = round(items.reduce(function (s, i) { return s + (i.qty || 0) * (i.rate || 0); }, 0));
    var tax = round(subtotal * (taxPct || 0) / 100);
    var base = round(subtotal + tax), total = base, fee = 0;
    if (platform && base > 0) { var c = F.chargeFor(platform, base); if (c != null) { total = c; fee = round(c - base); } }
    return { subtotal: subtotal, tax: tax, fee: fee, total: total };
  }

  return { supportersNeeded: supportersNeeded, freelanceRate: freelanceRate, breakEven: breakEven, discount: discount,
    marginMarkup: marginMarkup, priceFromMargin: priceFromMargin, priceFromMarkup: priceFromMarkup, invoice: invoice };
});
