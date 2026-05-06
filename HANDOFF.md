# VBPL Review — Session Handoff

Static editorial portal for reviewing Vietnamese legal documents anchored on **Luật Các tổ chức tín dụng số 32/2024/QH15**.

**Live**: https://ttttthai.github.io/vbpl-review/
**Repo**: https://github.com/ttttthai/vbpl-review

---

## What this app does

1. Landing page: **spotlight card** for the featured doc (`32/2024/QH15`), with a horizontal `Văn bản liên quan` stat bar (Bộ luật / Luật / NĐ / TT / Hết hiệu lực / Đang thảo luận).
2. **Lược đồ** (Gantt chart): timeline of the spotlight + every related doc, coloured by type, with relationship label below each bar.
3. **Doc-preview flow**: clicking any row in the Lược đồ does NOT open Toàn-văn — it lands on a fresh spotlight-card preview of that doc. The user can then `Xem văn bản` or re-enter `Lược đồ` for the new doc. This lets users walk the citation graph spotlight → Gantt → spotlight → Gantt without entering the reading view.
4. **Reference detection**: every `Điều X` / `Luật N/Y/QH..` / `Bộ luật Hình sự` mention in body text is parsed at render time and turned into a hover popup that resolves to the cited article excerpt.
5. **Lĩnh vực dropdown**: 5 sectors + "+ Thêm lĩnh vực mới" modal. Custom user fields persist in `localStorage["vbpl.userFields"]` and queue new docs for the scraper via `localStorage["vbpl.scrapeQueue"]`.

## Architecture

```
index.html             single-page entry, links Inter + Source Serif 4 from Google Fonts
css/styles.css         all styles, IKIGAI cream + navy + dental teal-green palette
js/app.js              ~1.6kloc, IIFE, all state in closure variables
data/documents.js      window.LEGAL_DB (object keyed by doc id) + LEGAL_DB_HELPERS

scripts/parse-articles.js   pure JS: rendered text → {chapters: [{title, subtitle, articles: [{id, number, heading, body}]}]}
scripts/scrape.js           Playwright-based per-doc scraper, writes data/scraped/{id}.json
scripts/merge.js            merges scraped JSON into documents.js, preserves curated metadata

.github/workflows/scrape.yml   nightly cron + workflow_dispatch, uses peter-evans/create-pull-request
```

### Theme
- **Palette**: cream `#f6f0e2` bg, ivory `#fbf7ec` paper, navy `#1a2c4a` headers, burgundy `#7d1d22` for Luật/Bộ-luật pills, **dental teal-green `#15a884`** for accents (CTA buttons, search button, active topnav, back button hover, summary bar borders).
- **Typography**: Georgia serif body throughout. Inter sans-serif retained for tabular numerals (`.lt-num`, `.ss-num`, `.ls-num`), legend, type pills, and modal forms.

### Navigation stack
- Internal `_navHistory` array + `_currentNav` track home / doc / preview states.
- `Quay lại` button at the top of the viewer pops the stack and replays the previous state via the `_suppressNav` flag.
- Each top-level transition (`goHome`, `openDoc`, `showDocPreview`) records to the stack unless `_suppressNav` is set.

### Spotlight is parameterised
- `window.__spotlightDocId` selects which doc the spotlight + statbar represents. Default `32/2024/QH15`. `showDocPreview(id)` updates this; `goHome()` resets to null.
- `fillSpotlight(doc)` re-templates the title / description / CTA `data-doc-id` attributes.

### Lược đồ
- Drag-resizable meta column via `--lt-meta-width` CSS var, persisted to `localStorage["vbpl.lt.metaW"]`.
- Bars coloured by type (`type-luat / type-bo-luat / type-nghidinh / type-thongtu`), expired bars get diagonal hatching, current doc gets an inset white ring.
- Year axis labels every 1/2/5 years depending on range span.
- Hover row → green tint + bar brightness lift + title underline.

## Known constraints (non-trivial)

- **vbpl.vn migrated to Next.js SPA** — every old `Pages/vbpq-toanvan.aspx?ItemID=…` URL returns 404 over plain HTTP. The Playwright scraper is set up to render with JS, but the stored `sourceUrl` values for older docs all need updating to current URLs before they'll yield content.
- **Coverage is 4%** of the actual legal corpus (~190 articles loaded out of ~4,550 total across the 41 docs in DB). Hand-authoring is asymptotic; the realistic path to fuller coverage is either (a) user uploads PDFs, (b) the scraper runs against fixed URLs, or (c) accept the current state which is dense enough for the lượchế đồ + popup-citation workflow.
- **CORS**: a static GitHub Pages site cannot fetch vbpl.vn from the browser, which is why scraping is server-side via the GitHub Action.
- **Vietnamese law citations are asymmetric**: a Thông tư always cites its parent Luật in its preamble, but a Luật rarely names specific Thông tư (Luật uỷ quyền NHNN ban hành Thông tư hướng dẫn chung). In our DB I added some manual upward references (Luật → TT) for visibility in the lượchế đồ — these are interpretive, not legally normative.

## DB state (current)

| ID | Doc | Loaded / Total |
|---|---|---|
| `32/2024/QH15` | Luật Các TCTD 2024 (spotlight) | 53 / 209 |
| `100/2015/QH13` | BLHS 2015 | 16 / 426 |
| `91/2015/QH13` | BLDS 2015 | 8 / 689 |
| `46/2010/QH12` | Luật NHNN | 9 / 66 |
| `06/2012/QH13` | Luật BHTG | 5 / 39 |
| `47/2010/QH12` | Luật TCTD 2010 (expired) | 4 / 163 |
| `17/2017/QH14` | Luật sửa đổi TCTD (expired) | 4 / 4 |
| `61/2024/QH15` | Luật Điện lực | 6 / 130 |
| `50/2010/QH12` | Luật SD năng lượng tiết kiệm | 4 / 48 |
| `14/2022/QH15` | Luật PCRT | 3 / 66 |
| `51/2014/QH13` | Luật Phá sản | 3 / 133 |
| `54/2019/QH14` | Luật Chứng khoán | 2 / 135 |
| `15/2012/QH13` | Luật XLVPHC | 3 / 142 |
| `21/2017/QH14` | Luật Quy hoạch | 2 / 72 |
| `12/2017/QH14` | Luật sửa đổi BLHS 2017 | 2 / 3 |
| `92/2015/QH13` | BL Tố tụng dân sự | 2 / 517 |
| `101/2015/QH13` | BL Tố tụng hình sự | 2 / 510 |
| `28/2004/QH11`, `24/2012/QH13`, `28/2018/QH14`, `03/2022/QH15` | predecessors of Luật Điện lực (all expired) | 1 / each |
| `31/2024/QH15` | Luật Đất đai | 3 / 260 |
| `59/2020/QH14` | Luật Doanh nghiệp | 3 / 218 |
| `88/2019/NĐ-CP` | NĐ xử phạt VPHC tiền tệ NH | 6 / 58 |
| `86/2024/NĐ-CP` | NĐ về dự phòng rủi ro TCTD | 2 / 16 |
| `155/2020/NĐ-CP` | NĐ chi tiết Luật Chứng khoán | 2 / 322 |
| `80/2024/NĐ-CP` | NĐ về DPPA | 4 / 30 |
| `135/2024/NĐ-CP` | NĐ về điện mặt trời mái nhà | 4 / 18 |
| `86/2019/NĐ-CP` | NĐ về vốn pháp định TCTD | 2 / 7 |
| `53/2013/NĐ-CP` | NĐ về VAMC | 3 / 35 |
| `13/2023/NĐ-CP` | NĐ bảo vệ dữ liệu cá nhân | 5 / 44 |
| `39/2014/NĐ-CP` | NĐ về công ty tài chính | 3 / 27 |
| `50/2018/TT-NHNN` | TT về thay đổi NHTM | 5 / 30 |
| `22/2019/TT-NHNN` | TT về tỷ lệ an toàn | 6 / 24 |
| `41/2016/TT-NHNN` | TT về CAR (Basel II) | 2 / 21 |
| `11/2021/TT-NHNN` | TT về phân loại nợ | 2 / 18 |
| `16/2021/TT-NHNN` | TT về mua TPDN | 2 / 19 |
| `39/2016/TT-NHNN` | TT về cho vay | 3 / 35 |
| `43/2016/TT-NHNN` | TT cho vay tiêu dùng (CTTC) | 4 / 16 |
| `18/2019/TT-NHNN` | TT sửa đổi 43/2016 | 2 / 4 |
| `DT-LCTCTD-2026` | Dự thảo sửa đổi Luật TCTD | 1 / 1 |

Total: **41 docs**, ~190 articles loaded.

## Sectors in dropdown

- `ngan-hang` — Tài chính – Ngân hàng (matcher: tổ chức tín dụng / ngân hàng / tiền tệ / tín dụng / tài chính)
- `nang-luong` — Phát triển năng lượng tái tạo (matcher: năng lượng / điện lực / điện gió / điện mặt trời / tái tạo / dppa / mua bán điện)
- `du-lieu-ca-nhan` — Luật Bảo vệ dữ liệu cá nhân (matcher: dữ liệu cá nhân / bảo vệ dữ liệu / thông tin cá nhân / pdpd)
- `dien-luc` — Luật Điện lực (matcher: điện lực)
- `__add` — opens "Thêm lĩnh vực mới" modal

## How to continue

### Run locally
```bash
cd "LEGAL PLATFORM"
python3 -m http.server 8765   # or any static server
# http://localhost:8765
```

### Run the scraper
```bash
npm install                     # also runs `playwright install --with-deps chromium` postinstall
npm run scrape                  # scrape every sourceUrl, writes data/scraped/*.json
npm run scrape:one -- --id 32/2024/QH15
npm run merge                   # merge scraped JSON back into data/documents.js
npm run scrape:all              # both, in sequence
```

The bundled GitHub Action (`.github/workflows/scrape.yml`) does the same nightly and opens a PR.

### Add a new doc by hand
1. Append entry to `window.LEGAL_DB` in `data/documents.js` (model after an existing one — `id`, `type`, `typeKey`, `number`, `shortTitle`, `title`, `issuer`, `issuedDate`, `effectiveDate`, `status`, `articleTotal`, `sourceUrl`, `chapters`).
2. Wire references in body text of related docs so the lượchế đồ picks up the relationship.
3. Bump `?v=…` query string on the `<script>`/`<link>` tags in `index.html`.
4. Commit + push.

### What's pending / open

- **Search bar removed** in the latest commit. The `wireSearch` plumbing is null-safe so re-enabling is just restoring the `<div class="header-search">…</div>` block in `index.html`.
- **Add-field modal**: writes to `localStorage["vbpl.scrapeQueue"]`. The scraper script does NOT yet read that queue — needs `scripts/scrape.js` to optionally consume queued doc numbers. This is a small follow-up.
- **Coverage gap**: 96% of articles are not yet hand-authored. The scraper is the right path here, but stored `sourceUrl` values for older docs need updating to current vbpl.vn URLs.
- **Vietnamese law citations are asymmetric**: see "Known constraints" above — Luật → TT references in our DB are interpretive.

## Conversation notes

This handoff is from a long-running session that started with "let's create a web page for legal docs review for Vietnam" and accumulated incremental requests:
1. Build the basic landing + viewer + lược đồ
2. Strip down the chrome (footer, breadcrumb, tab bar items, brand title)
3. Apply IKIGAI editorial theme + abbreviations
4. Switch to dental teal-green accent
5. Add doc-preview flow (Gantt row click → spotlight)
6. Add `+ Thêm lĩnh vực mới` modal + scrape queue
7. Add consumer-finance cluster (TT 43/2016, TT 18/2019, NĐ 39/2014)
8. Remove search bar (current commit)

The user is comfortable with incremental UI tweaks and direct rewrites. They asked multiple times for "complete" doc text — the realistic answer is that hand-authoring 4,000+ articles is asymptotic, and the scraper is the right tool. They've been tolerant of that constraint.

Cache-bust query strings: bump the `?v=…` on `<link>`/`<script>` every time you change `css/styles.css`, `js/app.js`, or `data/documents.js`.
