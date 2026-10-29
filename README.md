# Cortado, a retail demand planner prototype

A single-page planning tool for a coffee-bar network: store x SKU forecasts, order proposals per delivery, launches and phase-outs, and the KPIs to balance waste against availability. Built as a portfolio piece for the Retail Demand Planner role at Wakuli. All data is synthetic and generated in the browser on load.

## Files

- `index.html`: the whole app, self-contained (one file, no build step needed to host it). Fonts load from Google Fonts; everything else is inline.
- `how-it-works.html`: the method and process write-up, linked from the app header.
- `app.html`: the same app as a fragment (no `<html>`/`<head>` wrapper) for publishing as a Claude artifact.
- `src/`: the readable source. `data.js` (synthetic network and the as-is ordering simulation), `forecast.js` (cleaning, models, backtest, selection, overrides), `replen.js` (proposals, safety stock, newsvendor, KPIs, exceptions, lifecycle), `charts.js` (SVG charts), `ui.js` (views), `styles.css`, `shell.html`.
- `build.sh`: concatenates `src/` into `index.html` and `app.html`.

## Hosting

Any static host works: drop `index.html` and `how-it-works.html` in a folder on Netlify, Vercel, GitHub Pages or an S3 bucket. No server, no database, no API keys.

## Editing

Change files in `src/`, then run `./build.sh`. The simulation seed, bar list, SKU list, events and delivery calendar are at the top of `src/data.js`.
