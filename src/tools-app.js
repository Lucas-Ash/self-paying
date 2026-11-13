/* Interactivity for the seller tools. */
(function () {
  var F = window.Fees, T = window.Tools, S = window.SITE;
  if (!F || !T || !S) return;
  var money = F.money, bySlug = {};
  S.platforms.forEach(function (p) { bySlug[p.slug] = p; });
  function n(x) { return x.toLocaleString('en-US'); }
  function get(root, name) { var el = root.querySelector('[data-in="' + name + '"]'); return el ? el.value : ''; }
  function val(root, name) { var v = parseFloat(get(root, name)); return isFinite(v) && v >= 0 ? v : 0; }
  function set(root, name, text) { var el = root.querySelector('[data-out="' + name + '"]'); if (el) el.textContent = text; }
  function platform(root) { return bySlug[get(root, 'platform')] || null; }
  function pname(root) { var p = platform(root); return p ? p.name : 'no platform'; }

  var tools = {
    income: function (r) {
      var p = platform(r), price = val(r, 'price'), goal = val(r, 'goal'), x = T.supportersNeeded(p, price, goal);
      if (!x) { set(r, 'supporters', 'n/a'); set(r, 'each', money(0)); set(r, 'fees', 'n/a'); set(r, 'summary', 'At that price the fees take the whole payment.'); return; }
      set(r, 'supporters', n(x.supporters)); set(r, 'each', money(x.perSupporter)); set(r, 'fees', money(x.fees));
      set(r, 'summary', n(x.supporters) + ' supporters paying ' + money(price) + ' bring in ' + money(x.gross) + ' a month. ' + p.name + ' and payment fees take ' + money(x.fees) + ', leaving ' + money(x.takeHome) + '.');
    },
    freelance: function (r) {
      var x = T.freelanceRate({ income: val(r, 'income'), expenses: val(r, 'expenses'), taxPct: val(r, 'taxPct'), weeksOff: val(r, 'weeksOff'), hoursPerWeek: val(r, 'hoursPerWeek'), billablePct: val(r, 'billablePct'), feePct: val(r, 'feePct') });
      if (!x) { ['hourly', 'daily', 'revenue'].forEach(function (k) { set(r, k, 'n/a'); }); set(r, 'summary', 'Check the hours and percentages: there are no billable hours to divide by.'); return; }
      set(r, 'hourly', money(x.hourly)); set(r, 'daily', money(x.daily)); set(r, 'revenue', money(x.revenue));
      set(r, 'summary', 'That is ' + n(x.billableHours) + ' billable hours a year, or about ' + money(x.monthly) + ' of invoices a month.');
    },
    breakeven: function (r) {
      var x = T.breakEven(platform(r), { fixed: val(r, 'fixed'), price: val(r, 'price'), unitCost: val(r, 'unitCost') });
      set(r, 'contribution', money(x.contribution));
      set(r, 'units', x.units == null ? 'never' : n(x.units)); set(r, 'revenue', x.revenue == null ? 'n/a' : money(x.revenue));
      set(r, 'summary', x.units == null ? 'Each sale loses money at this price once fees and costs come off, so fixed costs are never covered. Raise the price or cut the unit cost.'
        : 'After ' + n(x.units) + ' sales on ' + pname(r) + ' your fixed costs are covered, and each further sale earns ' + money(x.contribution) + '.');
    },
    discount: function (r) {
      var x = T.discount(platform(r), { price: val(r, 'price'), unitCost: val(r, 'unitCost'), discountPct: val(r, 'discountPct') });
      set(r, 'before', money(x.before)); set(r, 'after', money(x.after));
      set(r, 'multiple', x.salesMultiple == null ? 'n/a' : x.salesMultiple + '×');
      var drop = x.before > 0 ? Math.round((1 - x.after / x.before) * 100) : null;
      set(r, 'summary', x.after <= 0 ? 'At ' + money(x.salePrice) + ' you make no profit on a sale.'
        : x.salesMultiple == null ? '' : 'At ' + money(x.salePrice) + ' your profit per sale falls by ' + drop + '%. You need ' + x.salesMultiple + ' times as many sales to earn what you do at full price.');
    },
    margin: function (r) {
      var cost = val(r, 'cost'), x = T.marginMarkup(cost, val(r, 'price'));
      set(r, 'profit', money(x.profit)); set(r, 'margin', x.marginPct + '%'); set(r, 'markup', x.markupPct + '%');
      var pm = T.priceFromMargin(cost, val(r, 'targetMargin'));
      set(r, 'priceMargin', pm == null ? 'not possible' : money(pm)); set(r, 'priceMarkup', money(T.priceFromMarkup(cost, val(r, 'targetMarkup'))));
    }
  };

  Array.prototype.forEach.call(document.querySelectorAll('[data-tool]'), function (root) {
    var fn = tools[root.getAttribute('data-tool')];
    if (!fn) return;
    function update() { fn(root); }
    root.addEventListener('input', update);
    update();
  });

  /* Invoice */
  var inv = document.querySelector('[data-invoice]');
  if (inv) {
    var body = inv.querySelector('[data-out="items"]');
    var store = { get: function (k) { try { return localStorage.getItem('inv:' + k); } catch (e) { return null; } }, set: function (k, v) { try { localStorage.setItem('inv:' + k, v); } catch (e) {} } };
    function addRow(desc, qty, rate) {
      var tr = document.createElement('tr');
      tr.innerHTML = '<td><input data-f="desc" placeholder="Description" aria-label="Description"></td><td class="num"><input data-f="qty" type="number" min="0" step="any" aria-label="Quantity"></td>' +
        '<td class="num"><input data-f="rate" type="number" min="0" step="any" aria-label="Rate"></td><td class="num" data-f="amount"></td>' +
        '<td class="no-print"><button type="button" class="x" data-remove aria-label="Remove line">×</button></td>';
      tr.querySelector('[data-f="desc"]').value = desc || '';
      tr.querySelector('[data-f="qty"]').value = qty == null ? 1 : qty;
      tr.querySelector('[data-f="rate"]').value = rate == null ? '' : rate;
      body.appendChild(tr);
    }
    function update() {
      var items = Array.prototype.map.call(body.children, function (tr) {
        var i = { qty: parseFloat(tr.querySelector('[data-f="qty"]').value) || 0, rate: parseFloat(tr.querySelector('[data-f="rate"]').value) || 0 };
        tr.querySelector('[data-f="amount"]').textContent = money(F.round(i.qty * i.rate));
        return i;
      });
      var taxPct = val(inv, 'taxPct'), t = T.invoice(items, taxPct, platform(inv));
      set(inv, 'subtotal', money(t.subtotal)); set(inv, 'tax', money(t.tax)); set(inv, 'taxLabel', 'Tax (' + taxPct + '%)');
      set(inv, 'fee', money(t.fee)); set(inv, 'total', money(t.total));
      inv.querySelector('[data-row="tax"]').hidden = !t.tax;
      inv.querySelector('[data-row="fee"]').hidden = !t.fee;
    }
    var today = new Date(), due = new Date(today.getTime() + 30 * 864e5);
    function iso(d) { return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2); }
    inv.querySelector('[data-in="date"]').value = iso(today);
    inv.querySelector('[data-in="due"]').value = iso(due);
    Array.prototype.forEach.call(inv.querySelectorAll('[data-keep]'), function (el) {
      var k = el.getAttribute('data-keep'), saved = store.get(k);
      if (saved != null) el.value = saved;
      el.addEventListener('input', function () { store.set(k, el.value); });
    });
    addRow('', 1, '');
    inv.addEventListener('input', update);
    inv.addEventListener('click', function (e) {
      if (e.target.hasAttribute('data-add')) { addRow('', 1, ''); update(); }
      if (e.target.hasAttribute('data-remove') && body.children.length > 1) { e.target.closest('tr').remove(); update(); }
    });
    document.querySelector('[data-print]').addEventListener('click', function () { window.print(); });
    update();
  }
})();
