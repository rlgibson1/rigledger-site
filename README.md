# rigledger-site

The RigLedger landing site, served by GitHub Pages at https://rigledger.gsa-company.com.

Plain HTML and one CSS file. No build step, no framework, no analytics. The only JavaScript is the
Kit form embeds and `ifta-calc.js` on the IFTA calculator page.

## Pages

| File | URL | Purpose |
|---|---|---|
| `index.html` | `/` | What RigLedger is, the three products with store links, the free Cost Per Mile Lite signup, About. |
| `ifta-calculator.html` | `/ifta-calculator` | Free, ungated IFTA calculator (miles and gallons by jurisdiction in; fleet MPG, per-state tax/credit, KY/VA surcharges, total out), the IFTA reminder opt-in, and an IFTA FAQ. **No store links, prices, or buy buttons** (same guard as `/free`, so it can be shared where store links are barred). Saves the visitor's lines in their own browser (localStorage). |
| `ifta-thanks.html` | `/ifta-thanks` | Where the IFTA reminder opt-in lands: confirm-your-email step (the confirmation email delivers the checklist), then one offer (listing b on Etsy, UTM-tagged, no price). Marked `noindex` and left out of the sitemap, like `/bonus`. |
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
`<form id="ifta-optin" ... data-kit-form="TODO">`. Replacing `TODO` with the Kit form's numeric id is the whole
swap: `ifta-calc.js` posts the email to `https://app.kit.com/forms/<id>/subscriptions` and sends the subscriber to
`/ifta-thanks` only when Kit answers with JSON `"status": "success"` (the same reply Kit's own embed script reads).
`"quarantined"` (Kit's bot check) and a network failure fall back to a plain form post, so Kit shows its own page; any
other answer shows Kit's error message under the form and keeps the visitor on the page. While it says `TODO`, a
submit only shows a "list opens soon" note and sends nothing. The form's box ships `hidden` and `ifta-calc.js`
reveals it, so a visitor without JavaScript never sees a form that would post to the page itself (a 405 on GitHub
Pages). Do not swap before every item in "Going live" below is done: the page and the thank-you page promise what
those items deliver.

## Going live (IFTA calculator)

The calculator is built on the local branch `ifta-calculator`.

**Status 2026-10-28:** with Ryan's OK, the calculator, the rates file and the app pages went live ahead of the Kit
pieces. The whole reminder box (`<section class="optin-box" ... hidden>`) ships hidden, so the live page promises
nothing that isn't set up yet. Items 2-7 below are still owed before the reminder box can turn on. At the swap in
item 7, also remove `hidden` from that section, then push.

**Status 2026-10-29:** Ryan re-approved the email copy. Item 4 is DONE: the four 2027 reminders are scheduled in Kit
(broadcasts 26687484, 26687485, 26687487, 26687488, 8:00 AM Central, to the tag alone; the tag now exists) by rigledger
`ledger/ifta_reminders_schedule.py 2027 --apply` on the NAS. Item 6 is DONE: timer `jarvis-rigledger-ifta-reminders`
(daily 12:45 UTC) is live, its first run passed, and `REMINDERS_LIVE_FROM` is set. Item 5's copy is drafted (email
README 3.1). Left: items 2-3 (the Kit form and its incentive email, which need Ryan's Kit login), then 7 and 8.

These are hard prerequisites, in this order, before the `TODO` swap:

1. Ryan's OK after a fresh review of the branch.
2. **Kit form**: a new form (not the Cost Per Mile Lite form), email only, tag `source:ifta-calculator`,
   after-subscribe redirect `https://rigledger.gsa-company.com/ifta-thanks`.
3. **Incentive email with the checklist**: the form's confirmation (incentive) email turned on, with
   `rigledger/products/ifta-checklist/RigLedger-IFTA-Quarter-End-Checklist.pdf` as the download. `/ifta-thanks` tells
   the subscriber the button in that email confirms them and downloads the checklist.
4. **All four 2027 reminder broadcasts, scheduled now**, each to the tag `source:ifta-calculator` alone (no second tag,
   segment or exclusion). A reminder's subject contains `IFTA` and `due` or `reminder`, never `rates` (the reminder
   check enforces both; the drafts in rigledger `marketing/emails/ifta-funnel/README.md` already comply). Each goes out
   10 days before the weekend-shifted due date (`python ledger/ifta_reminders_check.py plan 2027` in the rigledger repo
   prints these):

   | Return | Due | Send the reminder | Schedule by |
   |---|---|---|---|
   | 4th quarter 2026 | Mon Feb 1, 2027 | Fri Jan 22, 2027 | Fri Jan 8, 2027 |
   | 1st quarter 2027 | Fri Apr 30, 2027 | Tue Apr 20, 2027 | Tue Apr 6, 2027 |
   | 2nd quarter 2027 | Mon Aug 2, 2027 | Fri Jul 23, 2027 | Fri Jul 9, 2027 |
   | 3rd quarter 2027 | Mon Nov 1, 2027 | Fri Oct 22, 2027 | Fri Oct 8, 2027 |

   **Every December**, schedule the next year's four the same way: fill the next year's four in the email README
   (`plan 2028` gives the dates), then on the NAS `python3 ledger/ifta_reminders_schedule.py 2028` (dry run) and again
   with `--apply`. The opt-in promises a
   reminder every quarter, so a year with nothing scheduled breaks that promise.
5. **New-rates email, tied to the rate watcher's ping**: the Jarvis rate watcher (`jarvis nas/income/rigledger_check.py`)
   posts "IFTA <Q> tax matrix is posted" to Discord when a quarter's matrix appears (4th Quarter 2026: expected early
   December). Within 3 days of that ping: run the rates refresh below, push the site, then send a broadcast to
   `source:ifta-calculator` with `IFTA`, `rates` and the quarter in the subject (for example "New IFTA rates: 4th Quarter
   2026"). Draft its copy before go-live.
6. **Deploy the reminder check on the NAS** (`rigledger/ledger/ifta_reminders_check.py`, read-only Kit calls). It pages
   Discord when the next reminder isn't scheduled 14 days before its send date or isn't sent to the tag, and when the
   rates email hasn't gone out 3 days after the watcher's ping. Pull the rigledger checkout on the NAS, run it once
   with `--no-post` (it needs the Kit key the drip uses), then add a daily user timer. Unit, next to the drip's:

   ```
   [Service]
   Type=oneshot
   EnvironmentFile=-/etc/jarvis/jarvis.env
   Environment=RIGLEDGER_KIT_ENV=%h/.config/rigledger/kit.env
   ExecStart=/usr/bin/python3 %h/rigledger/ledger/ifta_reminders_check.py
   ```

   Then set `REMINDERS_LIVE_FROM = date(<go-live day>)` in jarvis `nas/income/rigledger_check.py`, commit, and pull it
   on the NAS. The 06:40 sentinel already reads `ifta-reminders-status.json`: it warns when the check goes stale (36 h)
   and, from that date on, every Monday it has never run. Left at `None`, a check that was never deployed stays silent.
7. Swap `TODO` for the form id on the branch and run **one real test signup** from the local server (see Local
   preview): the browser moves to `/ifta-thanks` (the local server 404s on that extension-less path; GitHub Pages
   serves it), the subscriber shows in Kit with the tag, the confirmation email arrives, and its button downloads the
   checklist. Keep DevTools > Network open for it: there must be **exactly one POST to `app.kit.com`**, answered with
   JSON `"status": "success"`, and **exactly one confirmation email** must arrive. The page leaves out the
   `X-CKJS-Version` header Kit's own embed script sends, so if Kit answered differently (a redirect, HTML), the page
   could fall back to a second, plain post without saying so. Then one bad address (for example `test@`) to see Kit's
   error message show under the form. If the real signup shows an error or lands on a Kit page instead, read the
   message and fix the form in Kit first.
8. Merge to `main` and push (the deploy), then repeat the real signup once on the live page, with the same one-POST,
   one-email check.

## IFTA rates (quarterly refresh)

`ifta-rates.json` is generated from the rigledger repo's harness model, never edited by hand:

```
python ledger/ifta_rates.py diff 4Q2026          # in the rigledger repo: retype changed rows in both tables
python marketing/site/export_ifta_rates.py       # writes ../rigledger-site/ifta-rates.json
python harness/ifta_calc_parity.py               # JS vs Python ifta(): must be 100 %
```

`return_due` in the JSON is the last day of the month after the quarter, moved off a Saturday or Sunday (R960.100;
weekends only, see the SHORTCUT note in the exporter).

The calculator, the rates box (quarter, period, due date with its weekday), and the footer's rates line read the
quarter from the JSON. Text that still names a quarter by hand in `ifta-calculator.html`: `<title>`, the meta and og
descriptions, the JSON-LD (WebApplication description, the surcharge, due-date and rates answers), the eyebrow
(`.kicker`), the rates box's "4th Quarter 2026 rates aren't final yet" sentence, the opt-in's "expected in early
December" bullet, and the "Why do Kentucky and Virginia cost more?", "When is IFTA due?" (worked dates) and "Which
rates" FAQ answers. Keep the visible FAQ and the JSON-LD answers word for word the same (the page test checks it).
Search for `3rd Quarter 2026`, `3Q 2026`, `4th Quarter 2026` and `2026`. If the surcharge states change, rewrite that FAQ
answer. The checklist PDF names the 3rd and 4th quarter 2026 due dates too: refresh it each January.

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
- `node --test harness/ifta_calc_page.test.js` (rigledger repo) passes: input parsing, headline and error text, Kit
  reply handling, the due date, and FAQ = JSON-LD.
- Both IFTA pages carry a Content-Security-Policy meta tag (self, plus `app.kit.com` for the opt-in post). Load
  `/ifta-calculator` and `/ifta-thanks` through the local server and check the browser console shows no CSP errors.
- Footer on every page carries the not-advice line, the AI-assisted line, the trademark line, and
  the Privacy link.
- Phone-width check (390 px) and the dark theme (`prefers-color-scheme: dark`).
