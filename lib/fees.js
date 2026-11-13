/* Fee maths shared by the build script (Node) and the browser. All money in dollars, rounded to cents. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Fees = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  function round(n) { return Math.round((n + Number.EPSILON) * 100) / 100; }

  // A component is {label, pct, fixed} or {label, tiers:[{upTo, pct, fixed}, ..., {pct, fixed}]}.
  function tierFor(c, amount) {
    if (!c.tiers) return c;
    for (var i = 0; i < c.tiers.length; i++) {
      if (c.tiers[i].upTo == null || amount <= c.tiers[i].upTo) return c.tiers[i];
    }
    return c.tiers[c.tiers.length - 1];
  }

  function breakdown(platform, amount) {
    var total = 0;
    var lines = platform.components.map(function (c) {
      var t = tierFor(c, amount);
      var fee = round(amount * (t.pct || 0) / 100 + (t.fixed || 0));
      total += fee;
      return { label: c.label, pct: t.pct || 0, fixed: t.fixed || 0, fee: fee };
    });
    total = round(total);
    return {
      amount: round(amount), lines: lines, fee: total, net: round(amount - total),
      effectivePct: amount > 0 ? round(total / amount * 100) : 0
    };
  }

  // Smallest price (to the cent) that leaves at least `target` after fees.
  function chargeFor(platform, target) {
    var lo = Math.round(target * 100), hi = lo * 20 + 10000;
    if (breakdown(platform, hi / 100).net < target) return null;
    while (lo < hi) {
      var mid = Math.floor((lo + hi) / 2);
      if (breakdown(platform, mid / 100).net >= target) hi = mid; else lo = mid + 1;
    }
    return lo / 100;
  }

  // Combined headline rate, e.g. "9.5% + $0.45".
  function rateText(platform, amount) {
    var pct = 0, fixed = 0, parts = [];
    platform.components.forEach(function (c) {
      var t = tierFor(c, amount == null ? 100 : amount);
      pct += t.pct || 0; fixed += t.fixed || 0;
    });
    if (pct) parts.push(round(pct) + '%');
    if (fixed) parts.push(money(fixed));
    return parts.join(' + ');
  }

  function money(n) {
    var neg = n < 0, s = Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (neg ? '-$' : '$') + s;
  }

  // Profit on one sale. Platform fees are charged on what the buyer pays (price + shipping charged).
  // c = {price, shippingCharged, itemCost, shippingCost, otherCost}
  function profit(platform, c) {
    var revenue = round((c.price || 0) + (c.shippingCharged || 0));
    var b = breakdown(platform, revenue);
    var costs = round((c.itemCost || 0) + (c.shippingCost || 0) + (c.otherCost || 0));
    var p = round(revenue - b.fee - costs);
    return { revenue: revenue, fee: b.fee, costs: costs, profit: p, marginPct: revenue > 0 ? round(p / revenue * 100) : 0, lines: b.lines };
  }

  // Lowest item price (to the cent) that reaches the target profit margin, or null if no price can.
  function priceForMargin(platform, c, marginPct) {
    function ok(cents) {
      var r = profit(platform, { price: cents / 100, shippingCharged: c.shippingCharged, itemCost: c.itemCost, shippingCost: c.shippingCost, otherCost: c.otherCost });
      return r.revenue > 0 && r.profit / r.revenue * 100 >= marginPct;
    }
    var lo = 0, hi = 100000000;
    if (!ok(hi)) return null;
    while (lo < hi) { var mid = Math.floor((lo + hi) / 2); if (ok(mid)) hi = mid; else lo = mid + 1; }
    return lo / 100;
  }

  return { round: round, breakdown: breakdown, chargeFor: chargeFor, rateText: rateText, money: money, profit: profit, priceForMargin: priceForMargin };
});
