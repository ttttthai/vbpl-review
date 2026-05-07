// Scrape only the doc ids passed as a comma-separated argument.
// Used for incremental expansion: scrape just the newly-added placeholders.
// Usage: node scripts/scrape-ids.js "id1,id2,id3"

"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { scrapeOne } = require("./scrape");

(async () => {
  const ids = (process.argv[2] || "").split(",").filter(Boolean);
  if (!ids.length) {
    console.error("usage: node scripts/scrape-ids.js id1,id2,id3");
    process.exit(2);
  }
  const ROOT = path.resolve(__dirname, "..");
  const src = fs.readFileSync(path.join(ROOT, "data", "documents.js"), "utf8");
  const sandbox = { window: {} };
  // eslint-disable-next-line no-new-func
  new Function("window", src)(sandbox.window);
  const db = sandbox.window.LEGAL_DB;
  const docs = ids.map((id) => db[id]).filter(Boolean);
  if (docs.length !== ids.length) {
    console.warn(`warn: ${ids.length - docs.length} ids not found in DB; scraping ${docs.length}`);
  }

  const SCRAPED_DIR = path.join(ROOT, "data", "scraped");
  if (!fs.existsSync(SCRAPED_DIR)) fs.mkdirSync(SCRAPED_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  let ok = 0,
    fail = 0;
  try {
    for (let i = 0; i < docs.length; i++) {
      const r = await scrapeOne(browser, docs[i]);
      if (r.status === "ok") ok++;
      else fail++;
      if ((i + 1) % 10 === 0) {
        console.log(`[progress] ${i + 1}/${docs.length} (ok=${ok} fail=${fail})`);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`done: ok=${ok} fail=${fail}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
