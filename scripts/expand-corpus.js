// Expand the corpus by following citations: find every doc-number cited
// somewhere in the current corpus that's not yet in the DB, look it up in
// the cached vbpl.vn sitemaps, and add a placeholder DB entry pointing at
// the canonical URL. The placeholder bodies get filled by `node scripts/scrape-ids.js`
// in a separate step (so this script is fast and side-effect-light).
//
// Usage:
//   node scripts/expand-corpus.js [--max-new N] [--dry-run]
//
// Output: prints summary and writes /tmp/expansion-roundN.json with the list
// of new entries added (so the calling shell can pipe ids into scrape-ids.js).

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DOCS_PATH = path.join(ROOT, "data", "documents.js");
const SITEMAP_DIR = "/tmp/vbpl-sitemaps";

const NAMED_DOC_NUMBER_RE = /(Luật|Bộ\s*luật|Nghị\s*định|Thông\s*tư)\s+(?:[^.;\n\/]{1,80}?)\s+số\s+([0-9]+\/[0-9]+\/(?:QH[0-9]+|N[ĐD][- ]?CP|TT[- ]?[A-ZĐ]+))/giu;
const DOC_NUMBER_RE = /(Luật|Nghị\s*định|Thông\s*tư|Bộ\s*luật)(?:\s+số)?\s+([0-9]+\/[0-9]+\/(?:QH[0-9]+|N[ĐD][- ]?CP|TT[- ]?[A-ZĐ]+))/giu;

const TYPE_INFO = {
  luat: { type: "Luật", issuer: "Quốc hội" },
  "bo-luat": { type: "Bộ luật", issuer: "Quốc hội" },
  nghidinh: { type: "Nghị định", issuer: "Chính phủ" },
  thongtu: { type: "Thông tư", issuer: null },
};

const TT_ISSUER_MAP = {
  NHNN: "Ngân hàng Nhà nước Việt Nam",
  BTC: "Bộ Tài chính",
  BCT: "Bộ Công thương",
  BTNMT: "Bộ Tài nguyên và Môi trường",
  BXD: "Bộ Xây dựng",
  BTP: "Bộ Tư pháp",
  BCA: "Bộ Công an",
  BKHDT: "Bộ Kế hoạch và Đầu tư",
  BLDTBXH: "Bộ Lao động – Thương binh và Xã hội",
  BNV: "Bộ Nội vụ",
  BYT: "Bộ Y tế",
  BGDDT: "Bộ Giáo dục và Đào tạo",
  BTTTT: "Bộ Thông tin và Truyền thông",
  "BNN-PTNT": "Bộ Nông nghiệp và Phát triển nông thôn",
  BGTVT: "Bộ Giao thông vận tải",
};

const PREFIX_MAP = {
  luat: "luat-",
  "bo-luat": "bo-luat-",
  nghidinh: "nghi-dinh-",
  thongtu: "thong-tu-",
};

function normalizeDocNumber(raw) {
  return raw
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/ND-CP/gi, "NĐ-CP")
    .replace(/NĐ\s*-\s*CP/gi, "NĐ-CP")
    .replace(/TT\s*-\s*/gi, "TT-");
}

function loadDb() {
  const src = fs.readFileSync(DOCS_PATH, "utf8");
  const sandbox = { window: {} };
  // eslint-disable-next-line no-new-func
  new Function("window", src)(sandbox.window);
  return { src, db: sandbox.window.LEGAL_DB || {} };
}

function loadSitemap() {
  const urls = [];
  for (const f of fs.readdirSync(SITEMAP_DIR)) {
    const text = fs.readFileSync(path.join(SITEMAP_DIR, f), "utf8");
    for (const m of text.matchAll(/<loc>(https:\/\/vbpl\.vn\/van-ban\/chi-tiet\/[^<]+)<\/loc>/g)) {
      urls.push(m[1]);
    }
  }
  return urls;
}

function slugifyDocNumber(num) {
  return num
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[\/\s]+/g, "-");
}

function findCanonicalUrl(num, allUrls) {
  const slug = slugifyDocNumber(num);
  const escSlug = slug.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const containsRe = new RegExp(`-so-${escSlug}(?:-|--\\d+$)`);
  const candidates = allUrls.filter((u) => containsRe.test(u));
  if (!candidates.length) return null;
  const lastSoRe = /-so-([a-z0-9-]+?)--(\d+)$/;
  const ranked = candidates.map((u) => {
    const slugPart = u.split("/chi-tiet/")[1] || "";
    const typeMatch = Object.entries(PREFIX_MAP).find(([, p]) => slugPart.startsWith(p));
    const m = u.match(lastSoRe);
    const lastSlug = m ? m[1] : "";
    return {
      url: u,
      typeKey: typeMatch ? typeMatch[0] : null,
      isOurType: typeMatch ? 0 : 1,
      isCanonical: lastSlug === slug ? 0 : 1,
      soCount: (u.match(/-so-/g) || []).length,
      len: u.length,
    };
  });
  ranked.sort(
    (a, b) =>
      a.isOurType - b.isOurType ||
      a.isCanonical - b.isCanonical ||
      a.soCount - b.soCount ||
      a.len - b.len
  );
  return ranked[0];
}

function discoverRefs(db) {
  const knownIds = new Set();
  for (const id of Object.keys(db)) {
    knownIds.add(id);
    knownIds.add(id.replace("NĐ-CP", "ND-CP"));
    knownIds.add(id.replace("ND-CP", "NĐ-CP"));
  }
  const refCounts = new Map();
  for (const [id, doc] of Object.entries(db)) {
    let body = "";
    for (const ch of doc.chapters || []) {
      for (const a of ch.articles || []) body += "\n" + (a.body || "");
    }
    const local = new Set();
    for (const re of [NAMED_DOC_NUMBER_RE, DOC_NUMBER_RE]) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(body)) !== null) {
        const norm = normalizeDocNumber(m[2]);
        if (norm === id) continue;
        local.add(norm);
      }
    }
    for (const ref of local) {
      const variant = ref.replace("NĐ-CP", "ND-CP");
      if (!knownIds.has(ref) && !knownIds.has(variant)) {
        refCounts.set(ref, (refCounts.get(ref) || 0) + 1);
      }
    }
  }
  return [...refCounts.entries()].sort((a, b) => b[1] - a[1]);
}

function ttIssuer(id) {
  const m = id.match(/TT-([A-ZĐ-]+)$/i);
  if (!m) return "Bộ ngành";
  const code = m[1].toUpperCase();
  return TT_ISSUER_MAP[code] || `Bộ ngành (${code})`;
}

function humanizeTitle(slugPart, typeKey) {
  const prefix = PREFIX_MAP[typeKey];
  let s = slugPart.startsWith(prefix) ? slugPart.slice(prefix.length) : slugPart;
  s = s.replace(/-so-[0-9].*$/, "");
  s = s.replace(/-/g, " ").trim();
  if (!s) return null;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildEntry(id, found) {
  const info = TYPE_INFO[found.typeKey];
  const issuer = info.issuer || ttIssuer(id);
  const slugPart = found.url.split("/chi-tiet/")[1] || "";
  let title = humanizeTitle(slugPart, found.typeKey);
  if (!title) title = `${info.type} ${id}`;
  const fullTitle = `${info.type} ${title}`;
  const yearMatch = id.match(/\/([0-9]{4})\//);
  const year = yearMatch ? yearMatch[1] : "2000";
  return {
    id,
    type: info.type,
    typeKey: found.typeKey,
    number: id,
    shortTitle: `${info.type} ${id}`,
    title: fullTitle,
    issuer,
    issuedDate: `${year}-01-01`,
    effectiveDate: "",
    status: "Có hiệu lực",
    articleTotal: 0,
    sourceUrl: found.url,
    chapters: [],
  };
}

function formatEntry(obj) {
  const json = JSON.stringify(obj, null, 2);
  const unquoted = json.replace(/^(\s*)"([a-zA-Z_$][a-zA-Z0-9_$]*)":/gm, "$1$2:");
  return unquoted.replace(/\n/g, "\n  ");
}

function insertEntries(src, entries, roundLabel) {
  const lines = [];
  lines.push(`  // ===== Auto-discovered citation graph (${roundLabel}) =====`);
  lines.push(`  // Placeholder metadata derived from URL slug; bodies populated by scraper.`);
  for (const e of entries) {
    lines.push(`  ${JSON.stringify(e.id)}: ${formatEntry(e)},`);
    lines.push("");
  }
  const block = lines.join("\n");

  // Insert before the DT-LCTCTD-2026 entry's preceding comment block
  const dtRe = /(\n[ \t]*\/\/ Draft \/ under-discussion document)/;
  if (dtRe.test(src)) return src.replace(dtRe, "\n" + block + "\n$1");
  // Fallback: insert before the closing `};` of LEGAL_DB
  const closeRe = /(\n};\s*\n\/\/ Lookup helpers)/;
  if (closeRe.test(src)) return src.replace(closeRe, "\n" + block + "\n$1");
  throw new Error("could not find insertion point in documents.js");
}

function main() {
  const argv = process.argv.slice(2);
  const maxNewIdx = argv.indexOf("--max-new");
  const maxNew = maxNewIdx >= 0 ? parseInt(argv[maxNewIdx + 1], 10) : Infinity;
  const dryRun = argv.includes("--dry-run");
  const roundLabel = argv[argv.indexOf("--label") + 1] || `round ${new Date().toISOString().slice(0, 10)}`;

  const { src, db } = loadDb();
  console.log(`current docs: ${Object.keys(db).length}`);

  const refs = discoverRefs(db);
  console.log(`unknown citations: ${refs.length}`);
  if (!refs.length) {
    console.log("no new docs to add — corpus is closed.");
    return;
  }

  const sitemap = loadSitemap();
  console.log(`sitemap urls cached: ${sitemap.length}`);

  const found = [];
  const noUrl = [];
  const nonTarget = [];
  for (const [id, count] of refs) {
    const r = findCanonicalUrl(id, sitemap);
    if (!r) noUrl.push({ id, count });
    else if (!r.typeKey) nonTarget.push({ id, count, url: r.url });
    else found.push({ id, count, ...r });
  }
  console.log(`URL found in target type: ${found.length}`);
  console.log(`non-target type (skipped): ${nonTarget.length}`);
  console.log(`no URL in sitemap: ${noUrl.length}`);

  const cap = found.slice(0, maxNew);
  if (cap.length < found.length) {
    console.log(`capping at --max-new=${maxNew}`);
  }

  const entries = cap.map((f) => buildEntry(f.id, f));
  const outFile = `/tmp/expansion-${roundLabel.replace(/[^a-z0-9]+/gi, "-")}.json`;
  fs.writeFileSync(outFile, JSON.stringify({ found: cap, noUrl, nonTarget, entries }, null, 2));
  console.log(`wrote ${outFile}`);

  if (dryRun) {
    console.log("(dry-run; documents.js untouched)");
    return;
  }
  if (!entries.length) return;

  const next = insertEntries(src, entries, roundLabel);
  fs.writeFileSync(DOCS_PATH, next);
  console.log(`inserted ${entries.length} placeholder entries`);
  console.log(`new ids: ${entries.map((e) => e.id).join(",")}`);
}

if (require.main === module) main();

module.exports = {
  discoverRefs,
  findCanonicalUrl,
  buildEntry,
  formatEntry,
  loadSitemap,
};
