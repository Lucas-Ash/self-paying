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

  return { round: round, breakdown: breakdown, chargeFor: chargeFor, rateText: rateText, money: money };
});
