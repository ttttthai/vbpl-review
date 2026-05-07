// Playwright-based scraper for Vietnamese legal documents.
//
// For each doc with a sourceUrl in data/documents.js, this script:
//   1. Loads the URL with a real headless Chromium (handles SPAs, JS rendering)
//   2. Waits for content to appear (heuristics: "Điều 1" or "CHƯƠNG" visible)
//   3. Extracts the rendered body text
//   4. Parses it with scripts/parse-articles.js into chapter/article structure
//   5. Writes the result to data/scraped/{safe-id}.json
//
// scripts/merge.js then takes those JSON files and merges them into the
// canonical data/documents.js (preserving the existing curated metadata).
//
// Usage:
//   node scripts/scrape.js                # scrape every doc
//   node scripts/scrape.js --id 32/2024/QH15   # scrape one
//   node scripts/scrape.js --since 14d    # only docs without a fresh cache file
//
// Failure modes handled:
//   - 404 / wrong page: logs "skipped (no content found)" and continues
//   - Slow JS render: 15s timeout per doc, configurable via SCRAPE_TIMEOUT
//   - Navigation error: caught and logged, doesn't abort the whole run

"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { parseLegalText } = require("./parse-articles");

const ROOT = path.resolve(__dirname, "..");
const SCRAPED_DIR = path.join(ROOT, "data", "scraped");
const TIMEOUT_MS = parseInt(process.env.SCRAPE_TIMEOUT || "30000", 10);
// Many short amendment laws ("Luật sửa đổi...") have only 1 article — keep them.
const MIN_ARTICLES_OK = 1;

// Cheap & cheerful loader — reads data/documents.js by evaluating it in a
// stripped-down context that exposes window.LEGAL_DB. Avoids pulling in
// a real bundler or rewriting documents.js as JSON.
function loadDocsList() {
  const src = fs.readFileSync(path.join(ROOT, "data", "documents.js"), "utf8");
  const sandbox = { window: {} };
  // eslint-disable-next-line no-new-func
  new Function("window", src)(sandbox.window);
  const db = sandbox.window.LEGAL_DB || {};
  return Object.values(db);
}

function safeId(id) {
  return id.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}

function log(msg, ...rest) {
  process.stdout.write(`[scrape] ${msg}` + (rest.length ? " " + rest.join(" ") : "") + "\n");
}

async function extractRenderedText(page) {
  // Prefer obvious content containers. New vbpl.vn (Next.js + Ant Design) renders
  // article body inside `.ant-tabs-content-holder`. Old vbpl.vn / vanban.chinhphu.vn /
  // thuvienphapluat used `#toanvancontent`, `#noidung`, `#tab1.contentDoc` etc.
  const selectors = [
    "#toanvancontent",
    "#noidung",
    "#fulltext",
    "#tab1",
    ".contentDoc",
    ".document-content",
    "[class*=ant-tabs-content-holder]",
    "[class*=toanvan]",
    "[class*=ContentBody]",
    "[class*=DocumentBody]",
    "main",
    "article",
  ];
  for (const sel of selectors) {
    const el = await page.$(sel);
    if (el) {
      const text = (await el.innerText()).trim();
      if (text.length > 500 && /Điều\s+\d+/.test(text)) return { text, via: sel };
    }
  }
  // Fallback: full body innerText
  const text = (await page.locator("body").innerText()).trim();
  return { text, via: "body" };
}

async function scrapeOne(browser, doc) {
  if (!doc.sourceUrl) return { id: doc.id, status: "no-source" };
  let context;
  try {
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      locale: "vi-VN",
      viewport: { width: 1280, height: 1800 },
    });
    const page = await context.newPage();

    log(`fetch ${doc.id} -> ${doc.sourceUrl}`);
    const response = await page.goto(doc.sourceUrl, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_MS,
    });
    if (!response) return { id: doc.id, status: "no-response" };
    const httpStatus = response.status();

    // Wait for an article-like marker, but don't fail the whole run if it never
    // appears — vbpl.vn renders 404 pages too, we just want to detect that.
    try {
      await page.waitForFunction(
        () => /Điều\s+\d+/.test(document.body.innerText || ""),
        { timeout: TIMEOUT_MS }
      );
    } catch {
      log(`  ${doc.id}: no article markers within timeout (HTTP ${httpStatus})`);
    }

    const { text, via } = await extractRenderedText(page);
    const parsed = parseLegalText(text, { title: doc.title });
    const articleCount = parsed.chapters.reduce((s, ch) => s + ch.articles.length, 0);

    if (articleCount < MIN_ARTICLES_OK) {
      log(`  ${doc.id}: parsed ${articleCount} articles — treating as miss (HTTP ${httpStatus}, via ${via})`);
      return { id: doc.id, status: "no-content", httpStatus, via };
    }

    const out = {
      id: doc.id,
      sourceUrl: doc.sourceUrl,
      scrapedAt: new Date().toISOString(),
      httpStatus,
      via,
      chapters: parsed.chapters,
    };
    const outPath = path.join(SCRAPED_DIR, `${safeId(doc.id)}.json`);
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
    log(`  ${doc.id}: parsed ${articleCount} articles across ${parsed.chapters.length} chapters -> ${path.relative(ROOT, outPath)}`);
    return { id: doc.id, status: "ok", articleCount };
  } catch (err) {
    log(`  ${doc.id}: error — ${err.message}`);
    return { id: doc.id, status: "error", error: err.message };
  } finally {
    if (context) await context.close().catch(() => {});
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const idIdx = argv.indexOf("--id");
  const onlyId = idIdx >= 0 ? argv[idIdx + 1] : null;

  if (!fs.existsSync(SCRAPED_DIR)) fs.mkdirSync(SCRAPED_DIR, { recursive: true });

  const docs = loadDocsList().filter((d) => !onlyId || d.id === onlyId);
  log(`scraping ${docs.length} doc(s)`);

  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const doc of docs) {
      const r = await scrapeOne(browser, doc);
      results.push(r);
    }
  } finally {
    await browser.close();
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const skipped = results.length - ok;
  log(`done: ${ok} ok, ${skipped} skipped`);
  fs.writeFileSync(
    path.join(SCRAPED_DIR, "_run.json"),
    JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2)
  );
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { extractRenderedText, scrapeOne };
