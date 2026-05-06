// Parse a flat string of Vietnamese legal-document text into the
// chapter / article structure used by data/documents.js.
//
// Inputs are expected to look like:
//
//   CHƯƠNG I
//   NHỮNG QUY ĐỊNH CHUNG
//   Điều 1. Phạm vi điều chỉnh
//   Luật này quy định về việc thành lập...
//   Điều 2. Đối tượng áp dụng
//   1. Tổ chức tín dụng.
//   ...
//   CHƯƠNG II
//   GIẤY PHÉP
//   Điều 27. ...
//
// Real legal documents on vbpl.vn / chinhphu.vn often have extra whitespace,
// numbered footers, page breaks, and table-of-contents links. This parser is
// deliberately lenient: it ignores anything that doesn't match the chapter
// or article markers, and keeps walking until it finds the next one.
//
// Output shape matches documents.js exactly:
//   { chapters: [{ title, subtitle, articles: [{ id, number, heading, body }] }] }

"use strict";

const CHAPTER_RE = /^\s*(CHƯƠNG|PHẦN)\s+([IVXLCDM]+|\d+|MỞ\s+ĐẦU|THỨ\s+NHẤT|THỨ\s+HAI|THỨ\s+BA|THỨ\s+TƯ|THỨ\s+NĂM)\s*$/i;
const ARTICLE_RE = /^\s*Điều\s+(\d+)\.?\s*(.*)$/;
// Patterns we strip out as noise (header chrome, footer links, page numbers)
const NOISE_RE = [
  /^\s*\d+\s*$/,                              // bare page numbers
  /^trang\s+\d+/i,                            // "Trang 5"
  /^\s*-\s*\d+\s*-\s*$/,                      // " - 5 - "
  /^(in|chia sẻ|tải về|nguồn|lưu|xem thêm)/i, // UI chrome
  /vbpl\.vn|chinhphu\.vn|thuvienphapluat/i,   // breadcrumb URLs
];

function isNoise(line) {
  const t = line.trim();
  if (!t) return true;
  return NOISE_RE.some((re) => re.test(t));
}

function normaliseLines(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/ /g, " ") // nbsp
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter((l) => !isNoise(l));
}

/**
 * @param {string} text Raw text extracted from a rendered legal document page.
 * @param {{ title?: string }} [opts]
 * @returns {{ chapters: Array<{ title: string, subtitle: string, articles: Array<{ id: string, number: string, heading: string, body: string }> }> }}
 */
function parseLegalText(text, opts = {}) {
  const lines = normaliseLines(text);
  const chapters = [];

  let currentChapter = null;
  let currentArticle = null;
  let bodyBuffer = [];

  function flushArticle() {
    if (!currentArticle || !currentChapter) return;
    currentArticle.body = bodyBuffer.join("\n").trim();
    currentChapter.articles.push(currentArticle);
    currentArticle = null;
    bodyBuffer = [];
  }
  function flushChapter() {
    flushArticle();
    if (currentChapter && currentChapter.articles.length) chapters.push(currentChapter);
    currentChapter = null;
  }
  function ensureChapter() {
    if (currentChapter) return;
    // Some short docs (e.g. amendment laws) skip the CHƯƠNG header entirely —
    // synthesise a single fallback chapter so articles still get attached.
    currentChapter = { title: "PHẦN MỞ ĐẦU", subtitle: "", articles: [] };
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Chapter heading?
    const chMatch = line.match(CHAPTER_RE);
    if (chMatch) {
      flushChapter();
      const title = `${chMatch[1].toUpperCase()} ${chMatch[2].toUpperCase()}`.trim();
      // Subtitle is the next non-empty line if it's all-caps short text
      let subtitle = "";
      const next = lines[i + 1];
      if (next && next === next.toUpperCase() && next.length < 120 && !ARTICLE_RE.test(next)) {
        subtitle = next;
        i += 1;
      }
      currentChapter = { title, subtitle, articles: [] };
      continue;
    }

    // Article heading?
    const artMatch = line.match(ARTICLE_RE);
    if (artMatch) {
      flushArticle();
      ensureChapter();
      const num = artMatch[1];
      let heading = (artMatch[2] || "").trim();
      // If the heading was on the next line (rare formatting), pull it
      if (!heading) {
        const next = lines[i + 1];
        if (next && !ARTICLE_RE.test(next) && !CHAPTER_RE.test(next)) {
          heading = next;
          i += 1;
        }
      }
      currentArticle = {
        id: `art-${num}`,
        number: `Điều ${num}`,
        heading: heading.replace(/^[\s.\-—]+/, "").trim(),
        body: "",
      };
      continue;
    }

    // Anything else is article body — but only if we're inside an article
    if (currentArticle) bodyBuffer.push(line);
  }

  flushChapter();

  return { chapters };
}

module.exports = { parseLegalText, normaliseLines };
