# rigledger-site

The RigLedger landing site, served by GitHub Pages at https://rigledger.gsa-company.com.

Plain HTML and one CSS file. No build step, no framework, no analytics, no JavaScript except
the Kit form embeds once they are pasted in.

## Pages

| File | URL | Purpose |
|---|---|---|
| `index.html` | `/` | What RigLedger is, the three products with store links, the free Cost Per Mile Lite signup, About. |
| `bonus.html` | `/bonus` | Bonus pack claim page linked from the last page of every delivery PDF. **No store links, prices, or buy buttons on this page** (Etsy policy: buyers reach it from a purchased file, so it must not read as a way around Etsy fees). Marked `noindex`. |
| `privacy.html` | `/privacy` | Plain privacy notice. |
| `404.html` | any missing path | GitHub Pages serves this automatically. |

Supporting files: `style.css`, `favicon.svg`, `img/` (real product screenshots, resized only),
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

Then browse to http://localhost:8000/ (use `/bonus.html` and `/privacy.html` locally; GitHub Pages
resolves the extension-less `/bonus` and `/privacy` on its own).

## Checks before pushing

- Every internal link resolves to a file in this repo.
- `bonus.html` still has no store links, prices, or buy buttons.
- Footer on every page carries the not-advice line, the AI-assisted line, the trademark line, and
  the Privacy link.
- Phone-width check (390 px) and the dark theme (`prefers-color-scheme: dark`).
