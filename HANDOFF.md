# VBPL Review — Session Handoff

Static editorial portal for reviewing Vietnamese legal documents anchored on **Luật Các tổ chức tín dụng số 32/2024/QH15**.

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

**Cache-bust**: bump `?v=N` on `<link>` / `<script>` tags in `index.html` after changing `css/styles.css`, `js/app.js`, or `data/documents.js`. Current: `?v=72`.

---

## Current state

**Corpus**: 412 docs / 26,325 articles loaded

| Type     | Count |
|----------|-------|
| Luật     | 252   |
| Nghị định| 111   |
| Thông tư | 39    |
| Bộ luật  | 10    |

Spotlight (`32/2024/QH15`): full 210/210 articles, 15 chapters.

---

## What this app does

1. **Main page (Trang chủ)**: 12 industry cards under "Lĩnh vực pháp lý" — banking, energy, PDPD, land, corporate, civil, criminal, securities, insolvency, AML, planning, admin violations. Each card shows doc count + anchor doc; click to spotlight.
2. **Spotlight preview** (after clicking an industry card or any doc anywhere): card with type-coloured background (burgundy for Luật/Bộ luật, dental teal for Nghị định, navy for Thông tư) + 3 CTAs: **Xem văn bản** / **Lược đồ** / **Sơ đồ**.
3. **Toàn văn (Xem văn bản)**: the full doc body, Source Serif 4 typography, line-height 1.55, font 14.5px (resizeable A− / A / A+).
4. **Lược đồ**: Gantt-style timeline of every related doc (predecessors, successors, citing, cited). Each row's left meta column shows the doc number on the link line + a descriptive subtitle below. Click any row → spotlight-preview that doc.
5. **Sơ đồ**: force-directed network diagram showing inter-doc citation edges (not just hub-and-spoke). Wheel-zoom, click-drag pan, +/−/⌂ on-canvas buttons. Click any node → spotlight that doc.
6. **Citation popups in body text** — three matchers, in priority:
   - Doc-number citations: "Luật số 32/2024/QH15", "Nghị định số 13/2023/NĐ-CP" etc.
   - Named-code (short-form law names): "Luật Các tổ chức tín dụng" → 32/2024/QH15, "Bộ luật Hình sự" → 100/2015/QH13, ~30 entries in `NAMED_CODE_PATTERNS`.
   - Structured / article-level: "điểm a, b khoản 1 Điều này", "khoản 1 Điều 5 của Luật ABC", "Điều 24 đến Điều 28 Luật các Tổ chức tín dụng" → each letter / number / "này" becomes its own hover ref.
7. Bare "Điều X" with no following doc reference is **NOT** linked (per user request — was over-eager before).

---

## Architecture

```
index.html             single-page entry, links Inter + Source Serif 4 from Google Fonts
css/styles.css         all styles, IKIGAI cream + navy + dental teal-green palette
js/app.js              ~2.4kloc, IIFE, all state in closure variables
data/documents.js      window.LEGAL_DB (object keyed by doc id) + LEGAL_DB_HELPERS

scripts/parse-articles.js   pure JS: rendered text → {chapters: [{title, subtitle, articles: [{id, number, heading, body}]}]}
scripts/scrape.js           Playwright per-doc scraper, writes data/scraped/{id}.json
scripts/scrape-ids.js       scrape only specific comma-separated ids
scripts/merge.js            surgical chapters[] span-replacement merge into documents.js (preserves cluster comments + unquoted-key style)
scripts/expand-corpus.js    discover unknown citation refs in DB, look up in cached vbpl.vn sitemaps, emit placeholder DB entries
scripts/expand-and-scrape.sh  orchestrator: discover → insert → scrape → merge across N rounds until convergence
scripts/postinstall.js      best-effort Playwright install (always exits 0 so static-site hosts don't fail npm install)

.github/workflows/scrape.yml   nightly cron + workflow_dispatch, opens a PR
```

### Theme
- **Palette**: cream `#f6f0e2` bg, ivory `#fbf7ec` paper, navy `#1a2c4a` headers, burgundy `#7d1d22` for Luật/Bộ luật, **dental teal-green `#15a884`** (var: `--orange`) for accents.
- **Typography**: Source Serif 4 for body text (loaded from Google Fonts), Inter for tabular numerals + UI chrome.

### Spotlight is parameterised
- `window.__spotlightDocId` selects which doc the spotlight represents. `showDocPreview(id)` updates this; `goHome()` resets to default `32/2024/QH15`.
- `fillSpotlight(doc)` re-templates the title / description / CTA `data-doc-id` attributes AND swaps the `.spotlight` element's `type-luat` / `type-bo-luat` / `type-nghidinh` / `type-thongtu` modifier class to match the doc's type.

### Every doc click goes through the spotlight first
Clicks on doc lists, search results, Lược đồ rows, Sơ đồ nodes, related-docs sidebar — ALL call `showDocPreview(id)` instead of `openDoc`. The user explicitly chooses to enter the viewer via the spotlight's three CTAs. Three intentional `openDoc` callers remain:
- `_navBack` (restoring prior viewer state)
- Spotlight CTA buttons (`#sp-cta-open` / `#sp-cta-luocdo` / `#sp-cta-sodo`)
- Citation popup's "Xem văn bản →" button

---

## Recent changes this session

(Most recent first.)

- `90f50ba` Article-list refs with explicit doc target ("Điều X đến Điều Y Luật ...")
- `8c12931` Lược đồ rows: shrink description font 9px → 8px
- `08afc50` Lược đồ rows: shrink description font 10.5px → 9px
- `6c6d87e` Reaccent placeholder doc subtitles (~250-entry Vietnamese reaccent dictionary)
- `32f7455` Lược đồ rows: descriptive subtitle + link styling on the number line
- `bd1b10d` Home page: industries-only; spotlight moves to dedicated preview view
- `75ddc42` Add "Lĩnh vực pháp lý" main-page overview (12 industry cards)
- `4a7e446` Fix structured citation parser (khoản-only, multi-segment, conjunction false-positives)
- `7329c45` Drop in-viewer tab bar + tighten article body typography
- `a4e7cb1` Route every doc click through the spotlight preview
- `aa2c99f` Sơ đồ: zoom + pan with wheel, drag, and on-canvas controls
- `600ca83` Sơ đồ: show direct inter-doc citations + force-directed layout
- `573124c` Match spotlight bg colour to the doc-type chip
- `e592f9f` Add Sơ đồ tab
- `553e8e8` Make postinstall safe for static-site hosts (Render etc.)
- `56957d5` Refresh corpus to 412 docs / 26,325 articles + bump cache-bust
- `c3b988a` Drop bare Điều X links + add structured & named-code citation refs
- `1ae87da` Add recursive corpus-expansion tooling
- `fcb71da` Rebuild scraper for new vbpl.vn Next.js URLs

---

## Known constraints / open issues

### Scraping
- **vbpl.vn is currently rate-limiting our IP** (Playwright probes return "Web Page Blocked"). Future re-scrapes from this machine may need a different IP or coordinated retries.
- New URL pattern: `https://vbpl.vn/van-ban/chi-tiet/{slug}--{ItemID}`. The old `Pages/vbpq-toanvan.aspx?ItemID=…` form returns 404.
- vbpl.vn does **server-side truncate** very long docs at ~150 articles (e.g. NĐ 155/2020 stops at Điều 149 of 322). Not a parser bug — upstream limit.
- 4 docs still don't scrape (parser sees no article markers): `03/2007/TT-NHNN`, `50/2019/QH14`, `47/2019/QH14`, `35/2002/QH10`. All are short amendment laws.

### Placeholder doc metadata
~290 of 412 docs are placeholder entries auto-generated by `scripts/expand-corpus.js`. Their `shortTitle` is just `"${type} ${id}"` and their `title` is a humanised URL slug missing Vietnamese diacritics. `getRowSubtitle()` in `js/app.js` runs a 250-entry reaccent dictionary over them so the Lược đồ menu reads as "Về tổ chức hoạt động..." instead of "Ve to chuc hoat dong...". The dictionary covers most legal terminology but isn't exhaustive — when you spot a missing word, add a row to `REACCENT` in `js/app.js`.

A future scrape pass with header extraction would give us the canonical Vietnamese titles (the dict would become a fallback). The scraper currently only captures chapters/articles, not the page header.

### Citation parsing — what's NOT linked
- Bare "Điều X" with no following doc reference (intentional — was over-eager before).
- "Điểm a" / "khoản 1" without surrounding "khoản"/"Điều" anchors.
- Citations using purely English ("Article 5") — Vietnamese only.

### UI / layout
- The `<title>` of a placeholder doc viewer ("Nghị định So 13 1999 nd cp ve to chuc...") is ugly. The spotlight + Lược đồ display use `getRowSubtitle()` which reaccents, but the doc viewer's internal H1 still uses the raw title. Could pass through `getRowSubtitle()` there too.
- One PR (`#3`) is closed-not-merged on GitHub (the typography fix was cherry-picked direct to main). Lives in PR history; can't be deleted.

---

## Cache-bust + deploy

- **Auto-deploy**: GitHub Pages legacy mode, branch `main / root`. Every push to `main` redeploys.
- **Cache-bust**: bump `?v=N` on `<link>` and `<script>` tags in `index.html` whenever you change `css/styles.css`, `js/app.js`, or `data/documents.js`. Current: `?v=72`. Next bump: `?v=73`.
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
2. Wire references in body text of related docs so the Lược đồ + Sơ đồ pick up the relationship.
3. Bump `?v=…` cache-bust.
4. Commit + push.

For bulk additions, prefer the recursive expander:

```bash
./scripts/expand-and-scrape.sh round-name 200    # capped at 200 new docs per round
```

---

## Conversation notes for context

The current session (the one wrapping up now) started from the previous handoff's "fix scraper URLs" item and grew into:
- Rebuild the scraper for vbpl.vn's Next.js migration
- Recursive corpus expansion (5 rounds → 41 → 412 docs)
- Sơ đồ tab (force-directed inter-doc network with zoom/pan)
- Spotlight type-coloured background
- Always-spotlight-first navigation
- Industries grid as the new home page
- Structured citation parser overhaul (điểm/khoản/Điều ranges)
- Vietnamese accent restoration dictionary
- Workflow consolidation: single branch, direct push to `main`, no worktrees

The user iterates fast: "fix this", "smaller font", "bigger network", "more industries". Match their cadence — short turnarounds, bump cache-bust, push to main. Verify in the browser preview when changes are observable; skip verification when changes are scraper-only / data-only.
