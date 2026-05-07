// Merge scraped article content into data/documents.js.
//
// Strategy (preserve curated work, prefer official source):
//   - Top-level metadata (id, type, number, shortTitle, issuedDate,
//     replaces, articleTotal, sourceUrl, status, etc.) is NEVER touched.
//   - Only the `chapters: [...]` array of each doc is replaced in-place,
//     so cluster comments, formatting, and unquoted-key style all survive.
//   - A scraped doc is merged only if it parsed at least MIN_OK articles —
//     a bad scrape can't wipe data.
//   - Docs with no scrape file are left alone.
//
// This used to do a full re-serialise via JSON.stringify, which destroyed
// the hand-authored cluster headers (// ===== Foo cluster =====) and
// switched all keys to quoted-string form. The current implementation does
// surgical span-replacement using a brace-aware walker, so the diff after
// merge contains only the chapters arrays that actually changed.

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DOCS_PATH = path.join(ROOT, "data", "documents.js");
const SCRAPED_DIR = path.join(ROOT, "data", "scraped");
const MIN_OK = 1;

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

// Locate the `chapters: [ ... ]` span for the given doc id in src.
// Returns { start, end, indent } where [start, end) covers the literal
// "chapters: [...]" (including the closing bracket). `indent` is the
// indentation prefix of the doc-level field line (e.g. "    ").
function findChaptersSpan(src, docId) {
  const escId = docId.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const idRe = new RegExp(`(\\n[ \\t]*)id:\\s*"${escId}"`);
  const m = idRe.exec(src);
  if (!m) return null;
  const indent = m[1].slice(1);

  const chRe = /chapters:\s*\[/g;
  chRe.lastIndex = m.index;
  const chMatch = chRe.exec(src);
  if (!chMatch) return null;

  const bracketAt = chMatch.index + chMatch[0].length - 1;
  let depth = 1;
  let i = bracketAt + 1;
  let stringChar = null;
  let escape = false;
  while (i < src.length && depth > 0) {
    const c = src[i];
    if (stringChar) {
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === stringChar) stringChar = null;
    } else if (c === '"' || c === "'" || c === "`") {
      stringChar = c;
    } else if (c === "[") {
      depth++;
    } else if (c === "]") {
      depth--;
    }
    i++;
  }
  return { start: chMatch.index, end: i, indent };
}

// Render `chapters` as JSON, then convert simple-identifier keys to
// unquoted form so the output matches the file's hand-edited style.
function formatChaptersValue(chapters, baseIndent) {
  const json = JSON.stringify(chapters, null, 2);
  // "key": → key:
  const unquoted = json.replace(/^(\s*)"([a-zA-Z_$][a-zA-Z0-9_$]*)":/gm, "$1$2:");
  // Indent every line except the first by baseIndent
  return unquoted.replace(/\n/g, "\n" + baseIndent);
}

function main() {
  let src = fs.readFileSync(DOCS_PATH, "utf8");
  const scraped = readScraped();
  const summary = { merged: [], skipped: [], missing: [] };

  for (const [id, data] of Object.entries(scraped)) {
    const articleCount = (data.chapters || []).reduce(
      (s, ch) => s + ch.articles.length,
      0
    );
    if (articleCount < MIN_OK) {
      summary.skipped.push({ id, reason: `only ${articleCount} articles` });
      continue;
    }
    const span = findChaptersSpan(src, id);
    if (!span) {
      summary.missing.push({ id, reason: "no chapters span found" });
      continue;
    }
    const replacement = `chapters: ${formatChaptersValue(data.chapters, span.indent)}`;
    src = src.slice(0, span.start) + replacement + src.slice(span.end);
    summary.merged.push({ id, articles: articleCount });
  }

  fs.writeFileSync(DOCS_PATH, src);
  console.log(`[merge] documents.js updated — ${summary.merged.length} docs merged`);
  for (const m of summary.merged) console.log(`  ${m.id.padEnd(20)} ${m.articles} articles`);
  if (summary.skipped.length) {
    console.log(`[merge] skipped (low quality): ${summary.skipped.length}`);
    for (const s of summary.skipped) console.log(`  ${s.id}: ${s.reason}`);
  }
  if (summary.missing.length) {
    console.log(`[merge] skipped (no match in documents.js): ${summary.missing.length}`);
    for (const s of summary.missing) console.log(`  ${s.id}: ${s.reason}`);
  }
}

if (require.main === module) main();

module.exports = { findChaptersSpan, formatChaptersValue };
