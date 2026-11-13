/* Makes the calculators interactive. Pages are fully rendered at build time, so this is progressive enhancement. */
(function () {
  var F = window.Fees, S = window.SITE;
  if (!F || !S) return;
  var money = F.money;
  var bySlug = {};
  S.platforms.forEach(function (p) { bySlug[p.slug] = p; });

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function val(root, name) { var v = parseFloat(root.querySelector('[data-in="' + name + '"]').value); return isFinite(v) && v >= 0 ? v : 0; }
  function out(root, name, text) { var el = root.querySelector('[data-out="' + name + '"]'); if (el) el.textContent = text; }
  function charge(p, target) { var c = F.chargeFor(p, target); return c == null ? 'n/a' : money(c); }
  function each(sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }

  each('[data-calc]', function (root) {
    var p = bySlug[root.getAttribute('data-calc')];
    function update() {
      var b = F.breakdown(p, val(root, 'amount'));
      out(root, 'fee', money(b.fee));
      out(root, 'net', money(b.net));
      out(root, 'charge', charge(p, val(root, 'target')));
      root.querySelector('[data-out="lines"]').innerHTML = b.lines.length > 1
        ? '<ul class="lines">' + b.lines.map(function (l) { return '<li><span>' + esc(l.label) + '</span><span>' + money(l.fee) + '</span></li>'; }).join('') + '</ul>'
        : '';
    }
    root.addEventListener('input', update);
    update();
  });

  each('[data-compare]', function (root) {
    function update() {
      var amount = val(root, 'amount'), cat = root.querySelector('[data-in="category"]').value;
      var rows = S.platforms.filter(function (p) { return !cat || p.category === cat; })
        .map(function (p) { return { p: p, b: F.breakdown(p, amount) }; })
        .sort(function (x, y) { return y.b.net - x.b.net; });
      root.querySelector('[data-out="table"]').innerHTML =
        '<table class="tbl"><thead><tr><th>Platform</th><th class="rate">Standard rate</th><th class="num">Fee</th><th class="num">You keep</th></tr></thead><tbody>' +
        rows.map(function (r) {
          return '<tr><td><a href="' + S.base + '/' + r.p.slug + '-fee-calculator/">' + esc(r.p.name) + '</a></td><td class="rate">' + esc(F.rateText(r.p, amount)) +
            '</td><td class="num">' + money(r.b.fee) + '</td><td class="num">' + money(r.b.net) + '</td></tr>';
        }).join('') + '</tbody></table>';
    }
    root.addEventListener('input', update);
    update();
  });

  each('[data-custom]', function (root) {
    function update() {
      var p = { components: [{ label: 'Fee', pct: val(root, 'pct'), fixed: val(root, 'fixed') }] };
      var amount = val(root, 'amount'), b = F.breakdown(p, amount);
      out(root, 'fee', money(b.fee));
      out(root, 'net', money(b.net));
      out(root, 'charge', charge(p, amount));
    }
    root.addEventListener('input', update);
    update();
  });
})();
