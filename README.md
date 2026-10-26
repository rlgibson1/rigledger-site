# rigledger-site

The RigLedger landing site, served by GitHub Pages at https://rigledger.gsa-company.com.

Plain HTML and one CSS file. No build step, no framework, no analytics. The only JavaScript is the
Kit form embeds and `ifta-calc.js` on the IFTA calculator page.

## Pages

| File | URL | Purpose |
|---|---|---|
| `index.html` | `/` | What RigLedger is, the three products with store links, the free Cost Per Mile Lite signup, About. |
| `ifta-calculator.html` | `/ifta-calculator` | Free, ungated IFTA calculator (miles and gallons by jurisdiction in; fleet MPG, per-state tax/credit, KY/VA surcharges, total out), the IFTA reminder opt-in, and an IFTA FAQ. **No store links, prices, or buy buttons** (same guard as `/free`, so it can be shared where store links are barred). Saves the visitor's lines in their own browser (localStorage). |
| `ifta-thanks.html` | `/ifta-thanks` | Where the IFTA reminder opt-in lands: acknowledgment, then one offer (listing b on Etsy, UTM-tagged, no price). Marked `noindex` and left out of the sitemap, like `/bonus`. |
| `bonus.html` | `/bonus` | Bonus pack claim page linked from the last page of every delivery PDF. **No store links, prices, or buy buttons on this page** (Etsy policy: buyers reach it from a purchased file, so it must not read as a way around Etsy fees). Marked `noindex`. |
| `privacy.html` | `/privacy` | Plain privacy notice. |
| `404.html` | any missing path | GitHub Pages serves this automatically. |

Supporting files: `style.css`, `favicon.svg`, `ifta-calc.js` (calculator math + page wiring),
`ifta-rates.json` (the quarter's IFTA rate table, generated: see below), `img/` (real product screenshots, resized only),
`CNAME` (custom domain), `robots.txt`, `sitemap.xml`, `.nojekyll` (tells Pages to serve files as-is).

## Deploy

Push to `main`. GitHub Pages is configured to serve the root of `main`; the `CNAME` file keeps the
custom domain attached. There is nothing to build. Changes are live within a minute or two.

## Kit form placeholders

Two HTML comments mark where the Kit embed scripts go. Replace each comment with the embed
script Kit gives you for that form, and delete the `form loads here` paragraph beneath it.

| Placeholder | File | Kit form |
|---|---|---|
| `<!-- KIT_FORM_CPM_LITE -->` | `index.html`, inside `<div class="signup" id="cpm-lite-form">` | `cpm-lite` (incentive: `RigLedger-Cost-Per-Mile-Lite.zip`, tag `source:cpm-lite`) |
| `<!-- KIT_FORM_BONUS -->` | `bonus.html`, inside `<div class="signup" id="bonus-form">` | `bonus-pack` (incentive: `RigLedger-Bonus-Pack.zip`, tag `source:bonus`) |

The yellow dashed box (`.signup`) stays; the Kit form renders inside it.

The IFTA reminder form works differently: `ifta-calculator.html` carries its own email form,
`<form id="ifta-optin" ... data-kit-form="TODO">`. Create a new Kit form for it (email only, tag
`source:ifta-calculator`, incentive = the one-page quarter-end IFTA filing checklist, after-subscribe redirect to
`https://rigledger.gsa-company.com/ifta-thanks`), then replace `TODO` with that form's numeric id. That one attribute
is the whole swap: `ifta-calc.js` posts the email to `https://app.kit.com/forms/<id>/subscriptions` and sends the
subscriber to `/ifta-thanks`. While it says `TODO`, a submit only shows a "list opens soon" note and sends nothing.
Test with a real address once after the swap (lands on `/ifta-thanks`, subscriber shows in Kit).

## IFTA rates (quarterly refresh)

`ifta-rates.json` is generated from the rigledger repo's harness model, never edited by hand:

```
python ledger/ifta_rates.py diff 4Q2026          # in the rigledger repo: retype changed rows in both tables
python marketing/site/export_ifta_rates.py       # writes ../rigledger-site/ifta-rates.json
python harness/ifta_calc_parity.py               # JS vs Python ifta(): must be 100 %
```

The calculator, the rates box, and the footer's rates line read the quarter from the JSON. Text that still names the
quarter by hand in `ifta-calculator.html`: `<title>`, the meta and og descriptions, the JSON-LD (WebApplication
description, the surcharge and rates answers), the eyebrow (`.kicker`), and the "Why do Kentucky and Virginia cost
more?" and "Which rates" FAQ answers (keep the visible FAQ and the JSON-LD answers word for word the same). Search
for `3rd Quarter 2026` and `3Q 2026`. If the surcharge states change, rewrite that FAQ answer.

## Gumroad URL

The three "Buy on Gumroad" buttons in `index.html` point at the placeholder
`https://rigledger.gumroad.com` and each carries `data-store="gumroad"`. Search and replace that
URL once the store exists. Per-product slugs (from `rigledger/gumroad/products.md`) if you want
deep links: `/l/owner-operator-workbook`, `/l/rv-maintenance-binder`, `/l/camping-rv-checklists`.

The "Buy on Etsy" buttons point at `https://rigledger.etsy.com`.

## Images

Everything in `img/` is a real render copied from `rigledger/products/*/screenshots/` and resized
to 1100 px wide. Nothing is cropped, retouched, or fabricated. If a product changes, re-export the
screenshot in the product repo and copy it over.

## Local preview

Links are root-relative (`/style.css`, `/bonus`), so open the site through a local server rather
than `file://`. From this directory:

```
python -m http.server 8000
```

Then browse to http://localhost:8000/ (use `/bonus.html`, `/privacy.html` and `/ifta-calculator.html` locally;
GitHub Pages resolves the extension-less paths on its own). The calculator fetches `/ifta-rates.json`, so it needs
the server too.

## Checks before pushing

- Every internal link resolves to a file in this repo.
- `bonus.html`, `free.html`, and `ifta-calculator.html` still have no store links, prices, or buy buttons.
- `ifta-thanks.html` names no price.
- `python harness/ifta_calc_parity.py` (rigledger repo) passes 100 % after any change to `ifta-calc.js` or the rates.
- Footer on every page carries the not-advice line, the AI-assisted line, the trademark line, and
  the Privacy link.
- Phone-width check (390 px) and the dark theme (`prefers-color-scheme: dark`).
