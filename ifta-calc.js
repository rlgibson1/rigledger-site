/* RigLedger IFTA calculator.
   computeIfta() is the fleet-MPG method from the Owner-Operator Business Workbook, kept pure so the parity
   harness (rigledger/harness/ifta_calc_parity.py) can run it under Node against the Python model it mirrors
   (harness/models/trucking.py, ifta()). Browser: window.RigLedgerIfta. Node: require("./ifta-calc.js"). */
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RigLedgerIfta = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function blank(v) {
    return v === undefined || v === null || v === "";
  }

  // Blank counts as 0; anything else must be a finite number of 0 or more.
  function checkAmount(v, where, field, errors) {
    if (blank(v)) return 0;
    var n = typeof v === "number" ? v : Number(v);
    if (!isFinite(n)) errors.push({ row: where, field: field, message: "Enter a number." });
    else if (n < 0) errors.push({ row: where, field: field, message: "Can't be negative." });
    else return n;
    return 0;
  }

  /* rates:  the ifta-rates.json object (or its rows array): [{code, name, diesel, surcharge}]
     rows:   [{code, miles, gallons}], one per line the driver typed; blank amounts count as 0
     totals: optional {miles, gallons}; a blank field means "add up the rows" (an override covers non-IFTA miles)
     Returns {ok, errors, warnings, rows, totalMiles, totalGallons, fleetMpg, taxTotal, surchargeTotal, netTotal,
     jurisdictions}. Negative totals are credits. Rows with no jurisdiction and no amounts are skipped. */
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
      codes[r.code] = true;
    });
    var tm = overrideMiles ? tmOver : sumMiles;
    var tg = overrideGallons ? tgOver : sumGallons;
    var mpg = tg ? tm / tg : 0;

    if (overrideMiles && tm < sumMiles) warnings.push("Your total miles are less than the miles you entered by state.");
    if (overrideGallons && tg < sumGallons) warnings.push("Your total gallons are less than the gallons you entered by state.");
    if (!tg && tm) warnings.push("With no gallons there is no fleet MPG, so every state shows $0. Add the gallons you bought.");
    if (!tm && tg) warnings.push("With no miles there is no fleet MPG, so the fuel you bought shows as credit. Add your miles.");

    var taxTotal = 0, surchargeTotal = 0;
    var out = clean.map(function (r) {
      if (!r) return null;
      var rate = byCode[r.code];
      var taxable = mpg > 0 ? r.miles / mpg : 0;
      var netGallons = taxable - r.gallons;
      var tax = netGallons * rate.diesel;
      var surcharge = taxable * rate.surcharge; // on gallons burned in the state; buying there earns no credit
      taxTotal += tax;
      surchargeTotal += surcharge;
      return {
        code: r.code, name: rate.name, miles: r.miles, gallons: r.gallons,
        rate: rate.diesel, surchargeRate: rate.surcharge,
        taxable: taxable, netGallons: netGallons, tax: tax, surcharge: surcharge, total: tax + surcharge
      };
    });

    return {
      ok: true, errors: errors, warnings: warnings, rows: out,
      totalMiles: tm, totalGallons: tg, fleetMpg: mpg,
      taxTotal: taxTotal, surchargeTotal: surchargeTotal, netTotal: taxTotal + surchargeTotal,
      jurisdictions: Object.keys(codes).length
    };
  }

  return { computeIfta: computeIfta };
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
  var rates = null, state = null;

  var money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
  var dec2 = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  var whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  var longDate = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

  function cents(x) { return Math.abs(x) < 0.005 ? 0 : x; } // no "-$0.00"
  function usd(x) { return money.format(cents(x)); }
  function gal(x) { return dec2.format(cents(x)); }
  function isoDate(s) { var p = s.split("-"); return longDate.format(new Date(Date.UTC(+p[0], p[1] - 1, +p[2]))); }
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

  // Typed text -> what computeIfta expects: "" stays blank, commas and spaces are ignored, junk becomes NaN.
  function amount(s) {
    s = s.trim().replace(/[,\s]/g, "");
    return s === "" ? "" : Number(s);
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
      [["code", "State or province", "select"], ["miles", "Miles", "input"], ["gallons", "Gallons bought", "input"]]
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
        var what = e.field === "code" ? "" : (e.field === "miles" ? "Miles: " : "Gallons: ");
        msg.textContent = (msg.textContent ? msg.textContent + " " : "") + what + e.message;
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

  function show(res) {
    var detail = document.getElementById("ifta-detail");
    var notes = document.getElementById("ifta-notes");
    setText("ifta-summary-sub", "");
    notes.textContent = "";
    if (!res.ok) {
      summary.textContent = "Fix the highlighted box" + (res.errors.length > 1 ? "es" : "") + " to see your numbers.";
      detail.hidden = true;
      return;
    }
    var lines = res.rows.filter(Boolean);
    if (!lines.length || (!res.totalMiles && !res.totalGallons)) {
      summary.textContent = "Your numbers show up here as you type.";
      detail.hidden = true;
      return;
    }
    var n = res.jurisdictions;
    var province = lines.some(function (l) { return rates.rows.some(function (r) { return r.code === l.code && r.country === "CA"; }); });
    var noun = province ? (n === 1 ? "jurisdiction" : "jurisdictions") : (n === 1 ? "state" : "states");
    var where = (n === 1 ? " in 1 " : " across " + n + " ") + noun + ".";
    if (res.netTotal >= 0.005) summary.textContent = "You owe about " + usd(res.netTotal) + where;
    else if (res.netTotal <= -0.005) summary.textContent = "You have about " + usd(-res.netTotal) + " in credit" + where;
    else summary.textContent = "You come out about even" + where;

    var surNames = [];
    lines.forEach(function (l) { if (l.surcharge >= 0.005 && surNames.indexOf(l.name) < 0) surNames.push(l.name); });
    if (surNames.length) {
      setText("ifta-summary-sub", "That includes " + usd(res.surchargeTotal) + " in " + surNames.join(" and ") +
        " surcharge" + (surNames.length > 1 ? "s" : "") + ", owed on every gallon burned there.");
    }
    res.warnings.forEach(function (w) { notes.appendChild(el("li", {}, w)); });

    setText("ifta-mpg", res.fleetMpg ? dec2.format(res.fleetMpg) : "n/a");
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
    detail.hidden = false;
  }

  function recalc() {
    var res = RigLedgerIfta.computeIfta(rates,
      state.lines.map(function (l) { return { code: l.code, miles: amount(l.miles), gallons: amount(l.gallons) }; }),
      { miles: amount(state.totals.miles), gallons: amount(state.totals.gallons) });
    markErrors(res.errors);
    show(res);
  }
  function changed() { save(); recalc(); }

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
  form.addEventListener("submit", function (e) { e.preventDefault(); recalc(); summary.focus(); });
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
      return_due: isoDate(rates.return_due),
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
      recalc();
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
   opens soon and nothing is sent anywhere. */
(function () {
  "use strict";
  if (typeof document === "undefined") return;
  var optin = document.getElementById("ifta-optin");
  if (!optin) return;
  optin.addEventListener("submit", function (e) {
    e.preventDefault();
    var id = optin.getAttribute("data-kit-form"), note = document.getElementById("ifta-optin-note");
    if (!/^\d+$/.test(id)) {
      note.textContent = "Thanks! The reminder list isn't switched on yet, so nothing was sent and your email wasn't saved. It opens soon.";
      note.hidden = false;
      return;
    }
    var button = optin.querySelector("button");
    optin.action = "https://app.kit.com/forms/" + id + "/subscriptions";
    button.disabled = true;
    button.textContent = "Sending...";
    fetch(optin.action, { method: "POST", body: new FormData(optin), headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); window.location.href = "/ifta-thanks"; })
      .catch(function () { optin.submit(); }); // plain post: Kit then shows its own confirmation or redirect
  });
})();
