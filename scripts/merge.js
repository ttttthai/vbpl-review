// Merge scraped article content into data/documents.js.
//
// Strategy (preserve curated work, prefer official source):
//   - Top-level metadata (id, type, number, shortTitle, issuedDate,
//     replaces, articleTotal, sourceUrl, status, etc.) is NEVER touched.
//   - Chapters/articles are replaced wholesale with the scraped version
//     IF the scrape parsed at least MIN_OK articles. Otherwise the existing
//     chapters/articles are kept untouched (so a bad scrape can't wipe data).
//   - For docs with no scrape file, nothing changes.
//
// The output is rewritten as documents.js using JSON.stringify with light
// post-processing so the diff stays readable on review.

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DOCS_PATH = path.join(ROOT, "data", "documents.js");
const SCRAPED_DIR = path.join(ROOT, "data", "scraped");
const MIN_OK = 3;

function loadDb() {
  const src = fs.readFileSync(DOCS_PATH, "utf8");
  const sandbox = { window: {} };
  // eslint-disable-next-line no-new-func
  new Function("window", src)(sandbox.window);
  return {
    db: sandbox.window.LEGAL_DB || {},
    helpersBlock: extractHelpersBlock(src),
  };
}

// Pull the LEGAL_DB_HELPERS block out of the original file verbatim so we
// don't lose its hand-tuned implementation when re-serialising.
function extractHelpersBlock(src) {
  const m = src.match(/\n\/\/ Lookup helpers used by app\.js[\s\S]+$/);
  return m ? m[0] : "";
}

function readScraped() {
  if (!fs.existsSync(SCRAPED_DIR)) return {};
  const files = fs
    .readdirSync(SCRAPED_DIR)
    .filter((f) => f.endsWith(".json") && !f.startsWith("_"));
  const map = {};
  for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(SCRAPED_DIR, f), "utf8"));
    if (data && data.id) map[data.id] = data;
  }
  return map;
}

function mergeDoc(doc, scraped) {
  if (!scraped) return doc;
  const articleCount = (scraped.chapters || []).reduce((s, ch) => s + ch.articles.length, 0);
  if (articleCount < MIN_OK) return doc;
  const next = { ...doc };
  next.chapters = scraped.chapters;
  next.lastScrapedAt = scraped.scrapedAt;
  return next;
}

function serialise(db, helpersBlock) {
  const lines = [];
  lines.push("// Local database of Vietnamese legal documents.");
  lines.push("// Sources modeled after vanban.chinhphu.vn and vbpl.vn.");
  lines.push("// Article bodies are populated either by hand or by scripts/scrape.js.");
  lines.push("// Each article has an id like \"art-3\" usable as anchor.");
  lines.push("");
  lines.push("window.LEGAL_DB = {");
  const ids = Object.keys(db);
  ids.forEach((id, idx) => {
    const json = JSON.stringify(db[id], null, 2);
    // Quote the key (handles slashes/digits)
    lines.push(`  ${JSON.stringify(id)}: ${indent(json, 2).trimStart()}${idx === ids.length - 1 ? "" : ","}`);
    lines.push("");
  });
  lines.push("};");
  lines.push(helpersBlock || "");
  return lines.join("\n");
}

function indent(s, n) {
  const pad = " ".repeat(n);
  return s
    .split("\n")
    .map((line, i) => (i === 0 ? line : pad + line))
    .join("\n");
}

function main() {
  const { db, helpersBlock } = loadDb();
  const scraped = readScraped();
  const ids = Object.keys(db);
  const summary = { merged: [], unchanged: [], missing: [] };

  for (const id of ids) {
    if (scraped[id]) {
      const before = (db[id].chapters || []).reduce((s, ch) => s + ch.articles.length, 0);
      db[id] = mergeDoc(db[id], scraped[id]);
      const after = (db[id].chapters || []).reduce((s, ch) => s + ch.articles.length, 0);
      if (after !== before) summary.merged.push({ id, before, after });
      else summary.unchanged.push({ id, articles: after });
    } else {
      summary.missing.push(id);
    }
  }

  fs.writeFileSync(DOCS_PATH, serialise(db, helpersBlock));
  console.log("[merge] documents.js updated.");
  console.log("[merge] merged:", summary.merged.length ? summary.merged : "none");
  console.log("[merge] unchanged:", summary.unchanged.length);
  console.log("[merge] no scrape data for:", summary.missing);
}

if (require.main === module) main();

module.exports = { mergeDoc };
