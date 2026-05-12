# VBPL Review — Session Handoff

Static editorial portal for reviewing Vietnamese legal documents anchored on **Luật Các tổ chức tín dụng số 32/2024/QH15** and **Luật Điện lực số 61/2024/QH15**.

**Live**: https://ttttthai.github.io/vbpl-review/
**Repo**: https://github.com/ttttthai/vbpl-review

---

## Workflow (read this first)

**One branch, direct push to `main`. No PRs by default. No worktrees.**

```bash
cd "/Users/hoangthai/Downloads/CLAUDECODE/LEGAL PLATFORM"
git status                     # always start clean
git fetch origin main && git rebase origin/main
# … make changes …
git add <files>
git commit -m "…"
git push origin main           # straight to main
```

GitHub Pages auto-deploys from `main / root` (legacy mode). Every push to `main` re-deploys the live site within ~1 min.

If a change is risky enough to want PR review, the user will explicitly say "PR this". Default is direct-to-main.

**Cache-bust**: bump `?v=N` on `<link>` / `<script>` tags in `index.html` after changing `css/styles.css`, `js/app.js`, or `data/documents.js`. Current: `?v=103`. Next bump: `?v=104`.

---

## Current state

**Corpus**: 465 docs / 26,366 articles loaded

| Type        | Count |
|-------------|-------|
| Luật        | 253   |
| Nghị định   | 120   |
| Thông tư    | 67    |
| Bộ luật     | 10    |
| Quyết định  | 15    |

Spotlight (`32/2024/QH15`): full 210/210 articles, 15 chapters.

Two main "spine" laws now have deep sub-sector coverage:
- **32/2024/QH15** (Các tổ chức tín dụng) — 16 NĐ + 2 QĐ + 58 TT across 12 banking sub-sectors
- **61/2024/QH15** (Điện lực) — 10 NĐ + 13 QĐ + 8 TT across 10 electricity sub-sectors

---

## What this app does

1. **Main page (Trang chủ)**: 12 industry cards under "Lĩnh vực pháp lý" — banking, energy, PDPD, land, corporate, civil, criminal, securities, insolvency, AML, planning, admin violations. Each card shows doc count + anchor doc; click to spotlight. Cards show **Luật/Bộ luật only** (sub-sector breakdown lives in the Hệ thống tab).
2. **Spotlight preview** (after clicking an industry card or any doc anywhere): card with type-coloured background (burgundy for Luật/Bộ luật, dental teal for Nghị định, navy for Thông tư, **purple `#7a3aa8` for Quyết định**) + 4 CTAs: **Xem văn bản** / **Lược đồ** / **Sơ đồ** / **Hệ thống**.
3. **Toàn văn (Xem văn bản)**: the full doc body, Source Serif 4 typography, line-height 1.55. Default font size **12px** (was 14.5px — user requested 4pt smaller); resizeable A− / A / A+, persisted in `localStorage.vbpl.readSize`.
4. **Lược đồ**: Gantt-style timeline of every related doc (predecessors, successors, citing, cited). Each row's left meta column shows the doc number on the link line + a descriptive subtitle below. Click any row → spotlight-preview that doc.
5. **Sơ đồ — Cây tiến hóa** (**fully rebuilt this session**): branching tree of evolution. Vertical (top-down) layout, time flows downward by year. Walks `replaces` / `replacedBy` / `amends` / `amendedBy` from the current doc. If the current doc is a Luật, the tree also includes **all implementing docs** (NĐ, TT, QĐ whose `implements[0]` lands on this Luật or one of its predecessors). Features:
   - **Card content** via SVG `<foreignObject>` so text wraps & line-clamps to 2 lines.
   - **Cluster-based column layout**: connected components of non-spine docs are assigned to side columns alternating outward from the spine.
   - **Multi-row years**: when a single year has too many docs, they stack alternating above/below the center line at a fixed 70px pitch.
   - **Zoom controls**: `+ / − / ⌂` buttons re-scale via CSS transform.
   - **Collapse by year**: click any year label (or the dashed placeholder rectangle) to collapse/expand all cards from that year. State persisted in `localStorage.vbpl.sodoCollapsed.<docId>` as a JSON array of year strings.
   - Edge colors distinguish replace (solid burgundy) / amend (dashed dental teal) / elevate (dotted navy).
6. **Hệ thống văn bản** (**new tab**): pyramid view showing all docs that implement (or are implemented by) the current Luật. Walks `implements[0]` upward to find the master Luật. Counts: tier 1 = Luật, tier 2 = NĐ, tier 3 = TT + QĐ. If a `SUB_SECTOR_TAXONOMY` entry exists for the master Luật, renders a **collapsible sub-sector tree** instead of the flat pyramid:
   - **Banking** (32/2024/QH15): 12+ sub-sectors — capital, bad-debt, lending, consumer-finance, debt-restructure, bond, license, payment, card, mobile-money, lc-trade-finance, aml, guarantee, sandbox, sanctions
   - **Electricity** (61/2024/QH15): 10+ sub-sectors — renewable, wind, tariff, dppa, market, vwem, planning, transmission, energy-saving, general
7. **Citation popups in body text** — three matchers, in priority:
   - Doc-number citations: "Luật số 32/2024/QH15", "Nghị định số 13/2023/NĐ-CP" etc.
   - Named-code (short-form law names): "Luật Các tổ chức tín dụng" → 32/2024/QH15, "Bộ luật Hình sự" → 100/2015/QH13, ~30 entries in `NAMED_CODE_PATTERNS`.
   - **Structured / article-level (rewritten this session)**: "khoản 1 Điều 156 của Luật này" → ONE hyperlink (not two). "khoản 2, 4, 6, 7, 8, 9, 10, 12, 13, 14 và 18 Điều 70 của Luật này" → ONE consolidated hyperlink with popup listing only the cited clauses. "Mục 3 Chương V của Luật này" / "Chương V" → ONE hyperlink. "Điều 143 của Luật này" → "Điều 143" as the visible link text.
8. **"Cập nhật" link in top utility bar**: clicking it re-indexes the corpus, counts citations + linkages, updates the date, and emits a toast like "Đã quét 465 văn bản, cập nhật 8,212 liên kết".
9. Hyperlinks now render as **bold burgundy `#b3261e` with underline** (was a thin grey accent). Popup window restyled: cream paper background, Source Serif 4 title + body, no Times New Roman, max-height 360px scroll. The "Xem văn bản" button inside the popup was removed.
10. **Top-of-page**: the dark `<nav class="topnav">` menu bar was removed entirely. "Trang chủ" now lives as `<a class="header-home" id="topnav-home">` in the top-left corner of the site-header.
11. **Compact doc header**: the old `<div class="props-wrap">` properties slab was folded into a 2-row inline `.dt-row1` / `.dt-row2` header (`.doc-titlebar`).

Bare "Điều X" with no following doc reference is **NOT** linked (per user request — was over-eager before).

---

## Architecture

```
index.html             single-page entry, links Inter + Source Serif 4 from Google Fonts
css/styles.css         all styles, IKIGAI cream + navy + dental teal + purple palette
js/app.js              ~2.4kloc, IIFE, all state in closure variables
data/documents.js      window.LEGAL_DB (object keyed by doc id) + LEGAL_DB_HELPERS

scripts/parse-articles.js   pure JS: rendered text → {chapters: [{title, subtitle, articles: [{id, number, heading, body}]}]}
scripts/scrape.js           Playwright per-doc scraper, writes data/scraped/{id}.json
scripts/scrape-ids.js       scrape only specific comma-separated ids
scripts/merge.js            surgical chapters[] span-replacement merge into documents.js
scripts/expand-corpus.js    discover unknown citation refs in DB, look up in cached vbpl.vn sitemaps, emit placeholder DB entries
scripts/expand-and-scrape.sh  orchestrator: discover → insert → scrape → merge across N rounds until convergence
scripts/postinstall.js      best-effort Playwright install (always exits 0 so static-site hosts don't fail npm install)

.github/workflows/scrape.yml   nightly cron + workflow_dispatch, opens a PR
```

### Theme
- **Palette**: cream `#f6f0e2` bg, ivory `#fbf7ec` paper, navy `#1a2c4a` headers, burgundy `#7d1d22` for Luật/Bộ luật, **dental teal-green `#15a884`** for NĐ accents, **purple `#7a3aa8` for Quyết định** (new this session).
- **Typography**: Source Serif 4 for body text + popup window, Inter for tabular numerals + UI chrome.

### Spotlight is parameterised
- `window.__spotlightDocId` selects which doc the spotlight represents. `showDocPreview(id)` updates this; `goHome()` resets to default `32/2024/QH15`.
- `fillSpotlight(doc)` re-templates the title / description / CTA `data-doc-id` attributes AND swaps the `.spotlight` element's `type-luat` / `type-bo-luat` / `type-nghidinh` / `type-thongtu` / `type-quyetdinh` modifier class to match the doc's type.

### Every doc click goes through the spotlight first
Clicks on doc lists, search results, Lược đồ rows, Sơ đồ nodes, related-docs sidebar — ALL call `showDocPreview(id)` instead of `openDoc`. The user explicitly chooses to enter the viewer via the spotlight's four CTAs. Intentional `openDoc` callers:
- `_navBack` (restoring prior viewer state)
- Spotlight CTA buttons (`#sp-cta-open` / `#sp-cta-luocdo` / `#sp-cta-sodo` / `#sp-cta-hethong`)
- Citation popup's "Xem văn bản →" button (removed in this session — keep this in mind if you reintroduce it)

### New `implements` field on docs
NĐ / TT / QĐ may carry `implements: ["32/2024/QH15"]` (or multiple ids when the doc cites multiple parent Luật). The first element is treated as the **primary master Luật** for pyramid / tree placement. Populated for 100+ docs this session via `/tmp/populate-implements.js` (heuristic by issuer + URL slug + body text scan).

### New `quyetdinh` typeKey
Prime-Minister and ministerial decisions (QĐ-TTg, QĐ-BCT, QĐ-NHNN). Rendered with purple pill chip. Counted in tier 3 of the Hệ thống pyramid alongside Thông tư.

---

## Files of note (rewritten or significantly extended this session)

### `js/app.js`
- `renderSodo(doc)` — fully rewritten (~line 1846) as evolution tree. Direction hardcoded to `'v'` (vertical) after user explicitly requested "revert to top down view". Walker now includes ALL implementing docs when the spotlight is a Luật, not just chain-linked ones.
- `renderHeThong(doc)` — new pyramid renderer. Walks `implements[0]` upward to master Luật, counts NĐ + TT + QĐ. Branches into `SUB_SECTOR_TAXONOMY` tree if present.
- `SUB_SECTOR_TAXONOMY` — new constant. Hand-curated banking + electricity sub-sector buckets keyed by master Luật id.
- `findStructuredRefs(text, ctx)` — emits ONE consolidated ref per "khoản X Điều Y" / multi-clause lists / "điểm a khoản 1 Điều này".
- `findSectionRefs(text, ctx)` — new matcher for "Mục N Chương X" and standalone "Chương V".
- `findArticleListRefs` — handles "Điều X đến Điều Y" ranges with explicit doc target.
- `runRefreshIndex()` — wires `#util-refresh` (the "Cập nhật" label) to scan corpus, count refs, toast counts.

### `data/documents.js`
- Replaced fake `DT-LCTCTD-2026` with real **91/2025/QH15** PDPD (39 articles full body).
- Added **96/2025/QH15** TCTD amendment stub.
- Banking decree replacement chain wired: NĐ 20/2000 → 202/2004 → 96/2014 → 88/2019 (VPHC NH); 101/2012 → 222/2013 (payment).
- Electricity predecessors: 28/2004/QH11 + 24/2012/QH13 → 61/2024/QH15 (via `replaces` / `amends`).
- Added ~28 new docs across 3 expansion waves: DPPA (NĐ 57/2025, NĐ 80/2024), tariff caps (QĐ 988/982/983/1279/1824/QĐ-BCT), PDP8 (QĐ 500/QĐ-TTg, QĐ 262/QĐ-TTg, QĐ 768/QĐ-TTg), VWEM (TT 16/2025, 36/2025, 45/2018), Mobile Money pilot, AML circulars, card / payment / LC circulars.

### `css/styles.css`
- `.legal-ref` — bold burgundy `#b3261e` + underline.
- `.ref-popup` — cream paper background, Source Serif 4 title/body, no Times New Roman, max-height 360px scroll.
- `.doc-titlebar .dt-row1` / `.dt-row2` — compact 2-row inline header.
- `.header-home` — top-left "Trang chủ" link replacing the deleted topnav.
- `.evt-*` — evolution tree styles (foreignObject cards, edge colors, zoom controls).
- `.evt-collapsed-rect` — dashed rectangle placeholder for collapsed-year stacks.
- `.st-*` — sub-sector tree (groups, leaves, type pills).
- `.ht-*` — Hệ thống pyramid (tiers, cards lg/md/sm).
- `.spotlight.type-quyetdinh` — purple background variant.

### `index.html`
- Removed `<nav class="topnav">` block entirely.
- Added `<a class="header-home" id="topnav-home">Trang chủ</a>` in site-header.
- Added `<a id="util-refresh" class="util-refresh">` wrapping the "Cập nhật" label.
- Added `<section data-panel="hethong">` panel + `#sp-cta-hethong` spotlight CTA.
- Removed `<div class="props-wrap">` (folded into compact header).
- Cache-bust now `?v=103`.

### Scratch scripts (not committed, in `/tmp/`)
- `populate-implements.js` — bulk script to inject `implements` per heuristic.
- `new-doc-stubs.js`, `expand-docs.js`, `expand-wave-2.js`, `expand-wave-3.js`, `expand-dppa-tariff.js` — stub-add scripts.
- `add-linkages.js` — bulk inject `replaces` / `replacedBy` / `amends` fields.

---

## Recent changes this session

(Most recent first.)

- `748c0dc` Sơ đồ: revert to top-down view as the only default
- `bb97982` Sơ đồ: fix box overlaps + collapse-by-year toggle
- `5bfb922` Sơ đồ: horizontal/transposed layout + direction toggle *(later reverted)*
- `991c6c5` Fix Sơ đồ-Hệ thống doc-count mismatch: merge NĐ 39/2014 duplicate
- `4c98286` Sơ đồ: include all implementing docs + zoom controls + multi-row years
- `0df164e` Cây tiến hóa: compact view — fits whole tree on one screen
- `5c35cad` Cây tiến hóa: wrap card text via foreignObject; clear year-label area
- `fb66ada` Sơ đồ: expand evolution tree with implementing-doc chains
- `938fd9a` Add replaces/replacedBy/amends linkages for banking + electricity
- `7533919` Wave 3: PDP8 adjustment + 9 banking circulars (cards, AML, payments, LC)
- `d38889c` Wave 2: PDP8, VWEM market rules, Mobile Money pilot
- `3113383` Electricity coverage: DPPA + 2025 tariff cap decisions (QĐ-BCT)
- `b3738fd` Expand banking + electricity coverage; add Quyết định (QĐ) doc type
- `d6fc699` Sub-sector tree integrated into Hệ thống tab (per-Luật)
- `e6b77d8` Main page = Laws only; expand banking + electricity doc DB
- `b960e59` Add collapsible sub-sector tree on home page
- `d96c2ed` Expand implements coverage to 6 more domains (50 docs)
- `64e5553` Add Hệ thống văn bản pyramid view + implements field
- `e3d711c` Sơ đồ → branching tree of evolution; citation parser overhaul
- `2491e28` Refresh HANDOFF.md *(previous session's handoff)*

---

## Known constraints / open issues

### Scraping
- **vbpl.vn is rate-limiting our IP** (Playwright probes return "Web Page Blocked"). Future re-scrapes from this machine may need a different IP or coordinated retries.
- New URL pattern: `https://vbpl.vn/van-ban/chi-tiet/{slug}--{ItemID}`. Old `Pages/vbpq-toanvan.aspx?ItemID=…` form returns 404.
- vbpl.vn does **server-side truncate** very long docs at ~150 articles (e.g. NĐ 155/2020 stops at Điều 149 of 322). Not a parser bug — upstream limit.
- 4 docs still don't scrape (parser sees no article markers): `03/2007/TT-NHNN`, `50/2019/QH14`, `47/2019/QH14`, `35/2002/QH10`. All are short amendment laws.

### Placeholder doc metadata
~290 of 465 docs are placeholder entries auto-generated by `scripts/expand-corpus.js`. Their `shortTitle` is just `"${type} ${id}"` and their `title` is a humanised URL slug missing Vietnamese diacritics. `getRowSubtitle()` in `js/app.js` runs a 250-entry reaccent dictionary over them so the Lược đồ menu reads as "Về tổ chức hoạt động..." instead of "Ve to chuc hoat dong...". When you spot a missing word, add a row to `REACCENT` in `js/app.js`.

### Sub-sector taxonomy is hand-curated
`SUB_SECTOR_TAXONOMY` only covers `32/2024/QH15` and `61/2024/QH15`. Adding a third spine Luật means hand-curating its sub-sector buckets (or it falls back to flat pyramid). The 28 new docs added this session are categorised; new docs going forward need their sub-sector assigned manually.

### Citation parsing — what's NOT linked
- Bare "Điều X" with no following doc reference (intentional).
- "Điểm a" / "khoản 1" without surrounding "khoản"/"Điều" anchors.
- Citations using purely English ("Article 5") — Vietnamese only.

### UI / layout
- The `<title>` of a placeholder doc viewer ("Nghị định So 13 1999 nd cp ve to chuc...") is ugly. Spotlight + Lược đồ use `getRowSubtitle()` to reaccent, but the doc viewer's internal H1 still uses raw title.
- Mobile breakpoint not validated against the new evolution tree zoom + collapse UI.

### Duplicates audit
One duplicate caught + fixed this session (`39/2014/ND-CP` vs `39/2014/NĐ-CP`). An audit script across 465 entries found no other dupes, but worth re-running after bulk imports:
```bash
node -e "const fs=require('fs'); global.window={}; eval(fs.readFileSync('data/documents.js','utf8'));
const keys=Object.keys(window.LEGAL_DB); const norm=k=>k.replace(/Đ/g,'D').toUpperCase();
const seen={}; for(const k of keys){const n=norm(k); if(seen[n]&&seen[n]!==k) console.log('DUP:',seen[n],'vs',k); seen[n]=k;}"
```

---

## Cache-bust + deploy

- **Auto-deploy**: GitHub Pages legacy mode, branch `main / root`. Every push to `main` redeploys within ~1 min.
- **Cache-bust**: bump `?v=N` on `<link>` and `<script>` tags in `index.html` whenever you change `css/styles.css`, `js/app.js`, or `data/documents.js`. Current: `?v=103`. Next bump: `?v=104`.
- The user occasionally also runs Render (Vercel-style host) — postinstall is null-safe so npm install won't fail there.

---

## Quick start (next session)

```bash
cd "/Users/hoangthai/Downloads/CLAUDECODE/LEGAL PLATFORM"
git fetch origin main && git rebase origin/main   # ensure latest
python3 -m http.server 8765                       # local preview at http://localhost:8765
```

Make changes → bump cache-bust → commit → push:

```bash
git add <files>
git commit -m "<short imperative summary>"
git push origin main
```

The user prefers direct-to-main. Don't open PRs unless they explicitly ask.

---

## Add a new doc by hand

1. Append entry to `window.LEGAL_DB` in `data/documents.js` (model after an existing one — `id`, `type`, `typeKey`, `number`, `shortTitle`, `title`, `issuer`, `issuedDate`, `effectiveDate`, `status`, `articleTotal`, `sourceUrl`, `chapters`).
2. If it's a NĐ/TT/QĐ implementing a Luật, add `implements: ["<luat-id>"]`.
3. If it replaces or amends an older doc, add `replaces: ["<old-id>"]` and `amends: ["<old-id>"]`. Add the reverse `replacedBy` / `amendedBy` on the older doc.
4. If it's a Quyết định, set `typeKey: "quyetdinh"`.
5. For new sub-sectors under banking/electricity, add an entry to `SUB_SECTOR_TAXONOMY` in `js/app.js`.
6. Wire references in body text of related docs so Lược đồ + Sơ đồ pick up the relationship.
7. Bump `?v=…` cache-bust.
8. Commit + push.

For bulk additions, prefer the recursive expander:

```bash
./scripts/expand-and-scrape.sh round-name 200    # capped at 200 new docs per round
```

---

## Conversation notes for context

This session was a massive expansion of structure + coverage on top of the previous session's 412-doc corpus. Key arcs:

1. **Citation parser overhaul** — consolidated multi-element refs into single hyperlinks ("khoản 1 Điều 156", "khoản 2, 4, 6 và 18 Điều 70", "Mục 3 Chương V", "Điều 143").
2. **Visual polish** — bold burgundy underlined hyperlinks, restyled popup (Source Serif 4, cream paper, no "Xem văn bản" button), compact 2-row doc header, smaller default reading font, removed dark menu bar, "Trang chủ" top-left.
3. **"Cập nhật" link** — clicking re-indexes corpus and toasts counts.
4. **Sơ đồ rebuild** — replaced force-directed network with branching tree of evolution. Iterated through: SVG `<text>` → `<foreignObject>` (text overflow fix), compact view, all-implementing-docs walker, zoom controls, multi-row years (alternating above/below center), horizontal transpose experiment (reverted), collapse-by-year toggle.
5. **Hệ thống văn bản** — new tab with pyramid view + per-Luật sub-sector tree (banking 12 buckets, electricity 10 buckets).
6. **Doc-DB expansion** — 28+ new docs in 3 waves covering DPPA, tariff caps, PDP8, VWEM, Mobile Money, AML, cards, payments, LC. Added new `quyetdinh` typeKey for QĐ-TTg / QĐ-BCT / QĐ-NHNN.
7. **Linkages** — bulk-added `replaces` / `replacedBy` / `amends` / `amendedBy` across banking + electricity decree chains.

The user iterates fast: "fix this", "smaller font", "missing many docs", "revert to top down". Match their cadence — short turnarounds, bump cache-bust, push to main. Verify in the browser preview when changes are observable; skip verification when changes are scraper-only / data-only.

When the user says "do what's best" or "c", interpret as "proceed with your proposed plan." They prefer concrete delivery over more questions.
