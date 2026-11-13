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

  each('[data-profit]', function (root) {
    function update() {
      var p = bySlug[root.querySelector('[data-in="platform"]').value];
      var c = { price: val(root, 'price'), shippingCharged: val(root, 'shippingCharged'), itemCost: val(root, 'itemCost'), shippingCost: val(root, 'shippingCost'), otherCost: val(root, 'otherCost') };
      var r = F.profit(p, c), target = F.priceForMargin(p, c, val(root, 'margin'));
      out(root, 'fee', money(r.fee));
      out(root, 'profit', money(r.profit));
      out(root, 'margin', r.marginPct + '%');
      out(root, 'price', target == null ? 'not reachable at these rates' : money(target));
      root.querySelector('[data-out="profit"]').className = r.profit < 0 ? 'neg' : '';
    }
    root.addEventListener('input', update);
    update();
  });

  each('[data-pricelist]', function (root) {
    var rows = [], chosen = [];
    function update() {
      var prices = root.querySelector('[data-in="prices"]').value.split(/[\s,;]+/)
        .map(function (s) { return parseFloat(s.replace(/[^0-9.]/g, '')); })
        .filter(function (n) { return isFinite(n) && n > 0; }).slice(0, 2000);
      chosen = Array.prototype.filter.call(root.querySelectorAll('input[type=checkbox]'), function (c) { return c.checked; })
        .map(function (c) { return bySlug[c.value]; });
      rows = prices.map(function (n) { return { price: n, cells: chosen.map(function (p) { return F.breakdown(p, n); }) }; });
      out(root, 'count', rows.length + (rows.length === 1 ? ' price, ' : ' prices, ') + chosen.length + (chosen.length === 1 ? ' platform' : ' platforms'));
      var shown = rows.slice(0, 200);
      root.querySelector('[data-out="table"]').innerHTML = !rows.length || !chosen.length ? '<p class="note">Enter at least one price and tick at least one platform.</p>' :
        '<table class="tbl"><thead><tr><th>Price</th>' + chosen.map(function (p) { return '<th class="num">Keep on ' + esc(p.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
        shown.map(function (r) {
          var best = Math.max.apply(null, r.cells.map(function (b) { return b.net; }));
          return '<tr><td>' + money(r.price) + '</td>' + r.cells.map(function (b) {
            return '<td class="num' + (chosen.length > 1 && b.net === best ? ' win' : '') + '">' + money(b.net) + '</td>';
          }).join('') + '</tr>';
        }).join('') + '</tbody></table>' + (rows.length > shown.length ? '<p class="src">Showing the first 200 rows. The CSV has all ' + rows.length + '.</p>' : '');
    }
    root.querySelector('[data-csv]').addEventListener('click', function () {
      if (!rows.length || !chosen.length) return;
      var head = ['Price'].concat.apply(['Price'], chosen.map(function (p) { return [p.name + ' fee', p.name + ' keep']; }));
      var lines = [head].concat(rows.map(function (r) {
        return [r.price.toFixed(2)].concat.apply([r.price.toFixed(2)], r.cells.map(function (b) { return [b.fee.toFixed(2), b.net.toFixed(2)]; }));
      }));
      var csv = lines.map(function (l) { return l.map(function (v) { return /[",]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      a.download = 'fees-by-platform.csv';
      document.body.appendChild(a); a.click(); a.remove();
    });
    root.addEventListener('input', update);
    update();
  });

  each('[data-copy-btn]', function (btn) {
    btn.addEventListener('click', function () {
      var ta = btn.closest('details').querySelector('[data-copy]');
      ta.select();
      (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).catch(function () { document.execCommand('copy'); });
      btn.textContent = 'Copied';
    });
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
