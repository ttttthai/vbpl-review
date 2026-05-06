# VBPL Review

Cổng tra cứu, rà soát văn bản pháp luật Việt Nam — tập trung vào **Luật Các tổ chức tín dụng số 32/2024/QH15** và các văn bản liên quan.

**Live**: https://ttttthai.github.io/vbpl-review/

## Front-end

Static site served from the repo root by GitHub Pages. No build step.

```
index.html         landing + viewer markup
css/styles.css     all styles
js/app.js          search, viewer, references, lược đồ Gantt
data/documents.js  local DB (curated metadata + article bodies)
```

Open `index.html` directly or run `python3 -m http.server 8765` for a local preview.

## Local DB

`data/documents.js` exports `window.LEGAL_DB`, a map keyed by document number. Each entry carries metadata (`type`, `number`, `issuedDate`, `effectiveDate`, `expiryDate`, `status`, `replaces`, `articleTotal`, `sourceUrl`) plus a `chapters` array of articles.

Documents are loaded into the user's browser cache as they navigate (`localStorage["vbpl.localdb.cache"]`), so the local DB grows organically with usage.

## Scraping pipeline

The scraper fills in full article bodies from the official sources (`vbpl.vn`, `vanban.chinhphu.vn`). It runs nightly via GitHub Actions and can be triggered manually.

```bash
npm install                          # installs Playwright + Chromium
npm run scrape                       # render every sourceUrl, parse, write data/scraped/*.json
npm run scrape:one -- --id 32/2024/QH15
npm run merge                        # merge scraped JSON into data/documents.js
npm run scrape:all                   # both, in sequence
```

### How it works

1. `scripts/scrape.js` opens each `sourceUrl` in headless Chromium (handles Next.js / SPA pages), waits for `Điều \d+` markers to appear, extracts the rendered text.
2. `scripts/parse-articles.js` splits the text by `CHƯƠNG` and `Điều X.` markers into chapters and articles.
3. Per-doc JSON is written to `data/scraped/{safe-id}.json`.
4. `scripts/merge.js` merges the scraped articles into `data/documents.js`, **preserving curated metadata** (id, type, dates, status, etc.). Bad scrapes (fewer than 3 articles parsed) are ignored — your hand-written content can't be wiped by a flaky run.

### GitHub Action

`.github/workflows/scrape.yml` runs at 02:00 UTC daily and opens a PR (`peter-evans/create-pull-request`) with the diff. Manual runs use the **Run workflow** button on the Actions tab and accept an optional `doc_id` input.

If a `sourceUrl` is broken upstream, the corresponding doc's chapters stay untouched. Update the URL in `data/documents.js` and re-run.

## Adding a new document by hand

1. Append a new entry to `data/documents.js` with `id`, `type`, `typeKey`, `number`, `shortTitle`, `title`, `issuer`, `issuedDate`, `effectiveDate`, `status`, `articleTotal`, `sourceUrl`, and at least a stub `chapters` array.
2. Bump the `?v=` query string on the `<script>` and `<link>` tags in `index.html` so visitors get the new version.
3. Commit + push — GitHub Pages picks it up automatically.

The next scheduled scraper run will fill in the article bodies.
