/* RigLedger IFTA calculator.
   The first module is DOM-free: computeIfta() is the fleet-MPG method from the Owner-Operator Business Workbook,
   plus the page's input rules (parseAmount), its headline (summarize) and its reading of Kit's reply (kitResult).
   The parity harness (rigledger/harness/ifta_calc_parity.py) runs computeIfta under Node against the Python model it
   mirrors (harness/models/trucking.py, ifta()); rigledger/harness/ifta_calc_page.test.js covers the rest.
   Browser: window.RigLedgerIfta. Node: require("./ifta-calc.js"). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RigLedgerIfta = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var MAX_AMOUNT = 1000000;
  // Digits with an optional decimal point. Thousands commas only in full groups of three: 6,500 yes, 6,5 no.
  var PLAIN = /^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?$|^\.\d+$/;
  var MPG_LOW = 3, MPG_HIGH = 15;
  var LINE_NAMES = { miles: "Miles", gallons: "Tax-paid gallons" };
  var TOTAL_NAMES = { miles: "Total miles", gallons: "Total gallons" };

  var money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  var dec2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function cents(x) { return Math.abs(x) < 0.005 ? 0 : x; } // no "-$0.00"
  function usd(x) { return money.format(cents(x)); }

  /* Dollars -> whole cents, half away from zero (a credit rounds like an amount due), as Excel's ROUND(x, 2) does.
     |x| is read at 15 significant digits first, as Excel reads a double, so float noise can't flip a half cent:
     13 x 0.105 is 1.365 on paper but 1.36499... as a double. The second read undoes the float error of the x 100.
     Twin of to_cents() in the Python model (rigledger harness/models/trucking.py). */
  function toCents(x) {
    var d = Number(Math.abs(x).toPrecision(15));
    var c = Math.round(Number((d * 100).toPrecision(15)));
    return x < 0 && c ? -c : c;
  }

  function blank(v) {
    return v === undefined || v === null || (typeof v === "string" && v.trim() === "");
  }

  /* A typed amount (or a number) -> {value} or {error}; blank is 0. The error reads after the field's name
     ("Miles can't be negative."). Plain numbers only, so 1e3, 0x10 and 6,5 are refused instead of being read as
     1000, 16 and 65. */
  function parseAmount(v) {
    if (blank(v)) return { value: 0 };
    var n;
    if (typeof v === "number") n = v;
    else {
      var s = String(v).trim(), neg = s.charAt(0) === "-";
      if (neg) s = s.slice(1).trim();
      if (!PLAIN.test(s)) {
        return { error: /^\d+,\d{1,2}$/.test(s) ? "need a period for decimals, like 6.5." : "must be digits only, like 6500 or 6,500." };
      }
      n = Number(s.replace(/,/g, ""));
      if (neg && n) n = -n;
    }
    if (!isFinite(n)) return { error: "must be a number." };
    if (n < 0) return { error: "can't be negative." };
    if (n > MAX_AMOUNT) return { error: "can't be over 1,000,000. Check the number." };
    return { value: n };
  }

  function checkAmount(v, where, field, errors) {
    var p = parseAmount(v);
    if (p.error === undefined) return p.value;
    errors.push({ row: where, field: field, message: (where === "totals" ? TOTAL_NAMES : LINE_NAMES)[field] + " " + p.error });
    return 0;
  }

  /* rates:  the ifta-rates.json object (or its rows array): [{code, name, diesel, surcharge}]
     rows:   [{code, miles, gallons}], one per line the driver typed; amounts are numbers or typed text, blank is 0
     totals: optional {miles, gallons}; a blank field means "add up the rows" (an override covers non-IFTA miles,
             exempt miles and fuel bought without the tax)
     Returns {ok, errors, warnings, rows, totalMiles, totalGallons, fleetMpg, taxTotal, surchargeTotal, netTotal,
     jurisdictions}. Each row's tax and surcharge are whole cents and every total is the sum of its rows' cents, so the
     shown lines always add up to the shown totals. Negative totals are credits. Rows with no jurisdiction and no amounts are skipped, and a
     jurisdiction with no miles or gallons isn't counted. */
  function computeIfta(rates, rows, totals) {
    var list = Array.isArray(rates) ? rates : rates.rows;
    var byCode = {};
    list.forEach(function (r) { byCode[r.code] = r; });
    totals = totals || {};

    var errors = [], warnings = [], clean = [];
    rows.forEach(function (row, i) {
      var miles = checkAmount(row.miles, i, "miles", errors);
      var gallons = checkAmount(row.gallons, i, "gallons", errors);
      if (blank(row.code)) {
        if (miles || gallons) errors.push({ row: i, field: "code", message: "Pick a state or province." });
        clean.push(null);
      } else if (!byCode[row.code]) {
        errors.push({ row: i, field: "code", message: "Unknown jurisdiction " + row.code + "." });
        clean.push(null);
      } else {
        clean.push({ code: row.code, miles: miles, gallons: gallons });
      }
    });
    var overrideMiles = !blank(totals.miles), overrideGallons = !blank(totals.gallons);
    var tmOver = checkAmount(totals.miles, "totals", "miles", errors);
    var tgOver = checkAmount(totals.gallons, "totals", "gallons", errors);
    if (errors.length) return { ok: false, errors: errors, warnings: warnings };

    var sumMiles = 0, sumGallons = 0, codes = {};
    clean.forEach(function (r) {
      if (!r) return;
      sumMiles += r.miles;
      sumGallons += r.gallons;
      if (r.miles || r.gallons) codes[r.code] = true;
    });
    var tm = overrideMiles ? tmOver : sumMiles;
    var tg = overrideGallons ? tgOver : sumGallons;
    var mpg = tg ? tm / tg : 0;

    if (overrideMiles && tm < sumMiles) warnings.push("Your total miles are less than the miles you entered by state.");
    if (overrideGallons && tg < sumGallons) warnings.push("Your total gallons are less than the gallons you entered by state.");
    if (mpg && (mpg < MPG_LOW || mpg > MPG_HIGH)) warnings.push("That's " + dec2.format(mpg) + " MPG. Most trucks run 5-8. Check your gallons.");

    // Tax and surcharge round to the cent on each line; the totals add the rounded lines, in whole cents.
    var taxCents = 0, surchargeCents = 0;
    var out = clean.map(function (r) {
      if (!r) return null;
      var rate = byCode[r.code];
      var taxable = mpg > 0 ? r.miles / mpg : 0;
      var netGallons = taxable - r.gallons;
      var tax = toCents(netGallons * rate.diesel);
      var surcharge = toCents(taxable * rate.surcharge); // on gallons burned in the state; buying there earns no credit
      taxCents += tax;
      surchargeCents += surcharge;
      return {
        code: r.code, name: rate.name, miles: r.miles, gallons: r.gallons,
        rate: rate.diesel, surchargeRate: rate.surcharge,
        taxable: taxable, netGallons: netGallons, tax: tax / 100, surcharge: surcharge / 100,
        total: (tax + surcharge) / 100
      };
    });

    return {
      ok: true, errors: errors, warnings: warnings, rows: out,
      totalMiles: tm, totalGallons: tg, fleetMpg: mpg,
      taxTotal: taxCents / 100, surchargeTotal: surchargeCents / 100, netTotal: (taxCents + surchargeCents) / 100,
      jurisdictions: Object.keys(codes).length
    };
  }

  /* The headline for a computeIfta() result: {text, sub, notes, detail}. detail is false while there is nothing
     worth tabling (no input yet, miles without gallons or the reverse, no miles on any state line, or an error).
     rows: the rows computeIfta got, so an error can name its line ("Line 2, Texas: ..."). */
  function summarize(res, rates, rows) {
    var list = Array.isArray(rates) ? rates : rates.rows, byCode = {};
    list.forEach(function (r) { byCode[r.code] = r; });
    function waiting(text) { return { text: text, sub: "", notes: [], detail: false }; }

    if (!res.ok) {
      var order = [], byLine = {};
      res.errors.forEach(function (e) {
        var key = String(e.row);
        if (!byLine[key]) {
          var r = e.row === "totals" ? null : byCode[rows[e.row] && rows[e.row].code];
          byLine[key] = [e.row === "totals" ? "Totals box:" : "Line " + (e.row + 1) + (r ? ", " + r.name : "") + ":"];
          order.push(key);
        }
        byLine[key].push(e.message);
      });
      var parts = order.slice(0, 3).map(function (k) { return byLine[k].join(" "); });
      if (order.length > 3) parts.push("And " + (order.length - 3) + " more lines to fix.");
      return waiting(parts.join(" "));
    }

    var lines = res.rows.filter(function (l) { return l && (l.miles || l.gallons); });
    if (!res.totalMiles && !res.totalGallons) return waiting("Your numbers show up here as you type.");
    if (!res.totalGallons) return waiting("Add your gallons to see your numbers.");
    if (!res.totalMiles) return waiting("Add your miles to see your numbers.");
    if (!lines.length) return waiting("Add your miles and gallons by state to see your numbers.");
    // A typed total can stand in for missing state miles; then every line would show as credit. Wait instead.
    if (!lines.some(function (l) { return l.miles; })) return waiting("Add your miles by state to see your numbers.");

    var n = res.jurisdictions;
    var province = lines.some(function (l) { return byCode[l.code].country === "CA"; });
    var noun = province ? (n === 1 ? "jurisdiction" : "jurisdictions") : (n === 1 ? "state" : "states");
    var where = (n === 1 ? " in 1 " : " across " + n + " ") + noun + ".";
    var text;
    if (res.netTotal >= 0.005) text = "You owe about " + usd(res.netTotal) + where;
    else if (res.netTotal <= -0.005) text = "You have about " + usd(-res.netTotal) + " in credit" + where;
    else text = "You come out about even" + where;

    var surNames = [];
    lines.forEach(function (l) { if (l.surcharge >= 0.005 && surNames.indexOf(l.name) < 0) surNames.push(l.name); });
    var sub = surNames.length ? "That includes " + usd(res.surchargeTotal) + " in " + surNames.join(" and ") +
      " surcharge" + (surNames.length > 1 ? "s" : "") + ", owed on every gallon burned there." : "";
    return { text: text, sub: sub, notes: res.warnings.slice(), detail: true };
  }

  /* What to do with Kit's reply to the form post. Kit's own embed script (ck.5.js) reads the same JSON: status
     "success" is a subscriber, "quarantined" means Kit wants its bot check, anything else carries errors.messages.
     -> {action: "thanks"} | {action: "post"} (plain form post, so Kit runs its own check) | {action: "error", message} */
  function kitResult(httpOk, data) {
    var status = data && data.status;
    if (httpOk && status === "success") return { action: "thanks" };
    if (httpOk && status === "quarantined") return { action: "post" };
    var msgs = data && data.errors && Array.isArray(data.errors.messages) ?
      data.errors.messages.filter(function (m) { return typeof m === "string" && m.trim(); }) : [];
    return { action: "error", message: msgs.length ? msgs.join(" ") : "That didn't go through. Check the address and try again." };
  }

  return { computeIfta: computeIfta, parseAmount: parseAmount, summarize: summarize, kitResult: kitResult, usd: usd };
});

/* Page wiring for /ifta-calculator. Does nothing under Node or on a page without the calculator. */
(function () {
  "use strict";
  if (typeof document === "undefined") return;
  var form = document.getElementById("ifta-form");
  if (!form) return;

  var STORE = "rigledger-ifta-calc-v1";
  var EXAMPLE = [{ code: "TX", miles: "6000", gallons: "1200" }, { code: "OK", miles: "4000", gallons: "400" }];
  var linesEl = document.getElementById("ifta-lines");
  var totalMilesEl = document.getElementById("ifta-total-miles");
  var totalGallonsEl = document.getElementById("ifta-total-gallons");
  var totalsBox = document.getElementById("ifta-totals");
  var results = document.getElementById("ifta-results");
  var summary = document.getElementById("ifta-summary");
  var live = document.getElementById("ifta-live");
  var rates = null, state = null, liveTimer = null;

  var usd = RigLedgerIfta.usd;
  var dec2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  var longDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  var dayDate = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

  function gal(x) { return dec2.format(Math.abs(x) < 0.005 ? 0 : x); }
  function utc(s) { var p = s.split("-"); return new Date(Date.UTC(+p[0], p[1] - 1, +p[2])); }
  function isoDate(s) { return longDate.format(utc(s)); }
  function blankLine() { return { code: "", miles: "", gallons: "" }; }
  function fresh() { return { lines: [blankLine(), blankLine(), blankLine()], totals: { miles: "", gallons: "" }, totalsOpen: false }; }
  function str(v) { return typeof v === "string" ? v : ""; }
  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function load() {
    try {
      var s = JSON.parse(localStorage.getItem(STORE));
      if (s && Array.isArray(s.lines) && s.lines.length) {
        return {
          lines: s.lines.map(function (l) { return { code: str(l && l.code), miles: str(l && l.miles), gallons: str(l && l.gallons) }; }),
          totals: { miles: str(s.totals && s.totals.miles), gallons: str(s.totals && s.totals.gallons) },
          totalsOpen: !!s.totalsOpen
        };
      }
    } catch (e) { /* private window or blocked storage: start fresh */ }
    return fresh();
  }
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) { /* still works, just not remembered */ }
  }
  function hasData() {
    return state.lines.some(function (l) { return l.code || l.miles.trim() || l.gallons.trim(); }) ||
      !!(state.totals.miles.trim() || state.totals.gallons.trim());
  }

  function options(select) {
    select.appendChild(el("option", { value: "" }, "Choose..."));
    [["US", "U.S. states"], ["CA", "Canadian provinces"]].forEach(function (g) {
      var group = el("optgroup", { label: g[1] });
      rates.rows.filter(function (r) { return r.country === g[0]; })
        .sort(function (a, b) { return a.name < b.name ? -1 : 1; })
        .forEach(function (r) { group.appendChild(el("option", { value: r.code }, r.name + " (" + r.code + ")")); });
      select.appendChild(group);
    });
  }

  function renderLines(focusIndex) {
    linesEl.textContent = "";
    state.lines.forEach(function (line, i) {
      var n = i + 1, id = "ifta-line-" + n;
      var row = el("div", { "class": "ifta-line", role: "group", "aria-labelledby": id + "-name", "data-index": i });
      row.appendChild(el("span", { "class": "vh", id: id + "-name" }, "Line " + n));
      [["code", "State or province", "select"], ["miles", "Miles", "input"], ["gallons", "Tax-paid gallons bought", "input"]]
        .forEach(function (f) {
          var label = el("label", { "class": "ifta-field ifta-field-" + f[0] });
          label.appendChild(el("span", { "class": "lbl" }, f[1]));
          var input = el(f[2], { id: id + "-" + f[0], "data-field": f[0], "aria-describedby": id + "-err" });
          if (f[2] === "select") options(input);
          else {
            input.setAttribute("type", "text");
            input.setAttribute("inputmode", "decimal");
            input.setAttribute("autocomplete", "off");
          }
          input.value = line[f[0]];
          label.appendChild(input);
          row.appendChild(label);
        });
      row.appendChild(el("button", { type: "button", "class": "ifta-remove", "data-remove": i, "aria-label": "Remove line " + n }, "Remove"));
      row.appendChild(el("p", { "class": "ifta-err", id: id + "-err", hidden: "" }));
      linesEl.appendChild(row);
    });
    if (focusIndex !== undefined) {
      var target = document.getElementById("ifta-line-" + (focusIndex + 1) + "-code");
      (target || document.getElementById("ifta-add")).focus();
    }
  }

  function markErrors(errors) {
    Array.prototype.forEach.call(form.querySelectorAll("[aria-invalid]"), function (n) { n.removeAttribute("aria-invalid"); });
    Array.prototype.forEach.call(form.querySelectorAll(".ifta-err"), function (p) { p.hidden = true; p.textContent = ""; });
    errors.forEach(function (e) {
      var input, msg;
      if (e.row === "totals") {
        input = e.field === "miles" ? totalMilesEl : totalGallonsEl;
        msg = document.getElementById("ifta-totals-err");
        totalsBox.open = true;
      } else {
        input = document.getElementById("ifta-line-" + (e.row + 1) + "-" + e.field);
        msg = document.getElementById("ifta-line-" + (e.row + 1) + "-err");
      }
      if (input) input.setAttribute("aria-invalid", "true");
      if (msg) {
        msg.textContent = (msg.textContent ? msg.textContent + " " : "") + e.message;
        msg.hidden = false;
      }
    });
  }

  function cell(tag, label, text, cls) {
    var c = el(tag, { role: tag === "th" ? "rowheader" : "cell", "data-label": label }, text);
    if (cls) c.className = cls;
    return c;
  }
  function setText(id, text) { document.getElementById(id).textContent = text; }

  // The visible summary changes as you type; the screen-reader copy waits until typing stops, so it reads once.
  function announce(text) {
    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () { live.textContent = text; }, 600);
  }

  function show(res, rows, speak) {
    var detail = document.getElementById("ifta-detail");
    var notes = document.getElementById("ifta-notes");
    var s = RigLedgerIfta.summarize(res, rates, rows);
    summary.textContent = s.text;
    setText("ifta-summary-sub", s.sub);
    notes.textContent = "";
    s.notes.forEach(function (w) { notes.appendChild(el("li", {}, w)); });
    detail.hidden = !s.detail;
    if (speak) announce([s.text, s.sub].concat(s.notes).filter(Boolean).join(" "));
    if (!s.detail) return;
    var lines = res.rows.filter(function (l) { return l && (l.miles || l.gallons); });

    setText("ifta-mpg", dec2.format(res.fleetMpg));
    setText("ifta-miles", whole.format(res.totalMiles));
    setText("ifta-gallons", whole.format(res.totalGallons));
    setText("ifta-tax", usd(res.taxTotal));
    setText("ifta-sur", usd(res.surchargeTotal));
    setText("ifta-net", usd(res.netTotal) + (res.netTotal <= -0.005 ? " credit" : ""));

    var body = document.getElementById("ifta-rows");
    body.textContent = "";
    lines.forEach(function (l) {
      var tr = el("tr", { role: "row" });
      tr.appendChild(cell("th", "State", l.name));
      tr.appendChild(cell("td", "Taxable gallons", gal(l.taxable)));
      tr.appendChild(cell("td", "Net gallons", gal(l.netGallons)));
      tr.appendChild(cell("td", "Fuel tax", usd(l.tax), l.tax <= -0.005 ? "credit" : ""));
      tr.appendChild(cell("td", "Surcharge", usd(l.surcharge)));
      tr.appendChild(cell("td", "Total", usd(l.total), l.total <= -0.005 ? "credit" : ""));
      body.appendChild(tr);
    });
    setText("ifta-foot-tax", usd(res.taxTotal));
    setText("ifta-foot-sur", usd(res.surchargeTotal));
    setText("ifta-foot-net", usd(res.netTotal));
  }

  function recalc(speak) {
    var rows = state.lines.map(function (l) { return { code: l.code, miles: l.miles, gallons: l.gallons }; });
    var res = RigLedgerIfta.computeIfta(rates, rows, { miles: state.totals.miles, gallons: state.totals.gallons });
    markErrors(res.errors);
    show(res, rows, speak);
  }
  function changed() { save(); recalc(true); }

  function onEdit(e) {
    var t = e.target, row = t.closest(".ifta-line");
    if (row && t.getAttribute("data-field")) state.lines[+row.getAttribute("data-index")][t.getAttribute("data-field")] = t.value;
    else if (t === totalMilesEl) state.totals.miles = t.value;
    else if (t === totalGallonsEl) state.totals.gallons = t.value;
    else return;
    changed();
  }
  form.addEventListener("input", onEdit);
  form.addEventListener("change", onEdit);
  form.addEventListener("submit", function (e) { e.preventDefault(); clearTimeout(liveTimer); recalc(false); summary.focus(); });
  form.addEventListener("click", function (e) {
    var t = e.target.closest("button");
    if (!t) return;
    if (t.hasAttribute("data-remove")) {
      var i = +t.getAttribute("data-remove");
      if (state.lines.length > 1) state.lines.splice(i, 1);
      else state.lines[0] = blankLine();
      renderLines(Math.min(i, state.lines.length - 1));
    } else if (t.id === "ifta-add") {
      state.lines.push(blankLine());
      renderLines(state.lines.length - 1);
    } else if (t.id === "ifta-example") {
      if (hasData() && !window.confirm("Replace your lines with the example?")) return;
      state.lines = EXAMPLE.map(function (l) { return { code: l.code, miles: l.miles, gallons: l.gallons }; });
      state.totals = { miles: "", gallons: "" };
      totalMilesEl.value = totalGallonsEl.value = "";
      renderLines(0);
    } else if (t.id === "ifta-clear") {
      if (hasData() && !window.confirm("Clear every line?")) return;
      state = fresh();
      totalMilesEl.value = totalGallonsEl.value = "";
      totalsBox.open = false;
      renderLines(0);
    } else {
      return;
    }
    changed();
  });
  totalsBox.addEventListener("toggle", function () { state.totalsOpen = totalsBox.open; save(); });

  // The page carries the current quarter's dates as text; refresh them from the JSON so a re-export is all the
  // body needs at the quarterly refresh (the <head>, JSON-LD and FAQ still name the quarter: see README).
  function fillRates() {
    var fill = {
      quarter_label: rates.quarter_label,
      period: isoDate(rates.period_start).replace(/, \d{4}$/, "") + " to " + isoDate(rates.period_end),
      return_due: dayDate.format(utc(rates.return_due)),
      retrieved: isoDate(rates.retrieved)
    };
    Array.prototype.forEach.call(document.querySelectorAll("[data-rates]"), function (n) {
      var v = fill[n.getAttribute("data-rates")];
      if (v) n.textContent = v;
    });
  }

  fetch("/ifta-rates.json", { cache: "no-cache" })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) {
      rates = data;
      state = load();
      fillRates();
      totalMilesEl.value = state.totals.miles;
      totalGallonsEl.value = state.totals.gallons;
      totalsBox.open = state.totalsOpen;
      renderLines();
      recalc(false);
      form.hidden = false;
      results.hidden = false;
      document.getElementById("ifta-loading").hidden = true;
    })
    .catch(function () {
      document.getElementById("ifta-loading").textContent =
        "The rate table didn't load, so the calculator can't run. Check your connection and reload the page.";
    });
})();

/* Reminder sign-up. data-kit-form holds the Kit form's numeric id; until it does, a submit only says the list
   opens soon and nothing is sent anywhere. Only Kit's JSON "success" goes on to /ifta-thanks (kitResult).
   The form ships hidden: without this script it would post to the page itself and get a 405. */
(function () {
  "use strict";
  if (typeof document === "undefined") return;
  var optin = document.getElementById("ifta-optin");
  if (!optin) return;
  document.getElementById("ifta-reminder-form").hidden = false;
  optin.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = optin.getAttribute("data-kit-form"), note = document.getElementById("ifta-optin-note");
    note.hidden = true;
    if (!/^\d+$/.test(id)) {
      note.textContent = "Thanks! The reminder list isn't switched on yet, so nothing was sent and your email wasn't saved. It opens soon.";
      note.hidden = false;
      return;
    }
    var button = optin.querySelector("button"), label = button.textContent;
    optin.action = "https://app.kit.com/forms/" + id + "/subscriptions";
    button.disabled = true;
    button.textContent = "Sending...";
    fetch(optin.action, { method: "POST", body: new FormData(optin), headers: { Accept: "application/json" } })
      .then(function (r) {
        return r.json().catch(function () { return null; })
          .then(function (data) { return RigLedgerIfta.kitResult(r.ok, data); });
      }, function () { return { action: "post" }; }) // network or CORS failure: plain post, Kit shows its own page
      .then(function (out) {
        if (out.action === "thanks") { window.location.href = "/ifta-thanks"; return; }
        if (out.action === "post") { optin.submit(); return; }
        note.textContent = out.message;
        note.hidden = false;
        button.disabled = false;
        button.textContent = label;
      });
  });
})();
