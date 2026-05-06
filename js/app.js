(function () {
  "use strict";

  const DB = window.LEGAL_DB;
  const H = window.LEGAL_DB_HELPERS;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // ===== DOM =====
  const landing = $("#landing");
  const viewer = $("#viewer");

  const searchInput = $("#search-input");
  const searchClear = $("#search-clear");
  const searchDo = $("#search-do");
  const suggestions = $("#suggestions");
  const sideSearchInput = $("#side-search-input");
  const sideSuggestions = $("#side-suggestions");

  const docTitlebar = $("#doc-titlebar");
  const propsTable = $("#props-table");
  const docBody = $("#doc-body");
  const tocEl = $("#toc");
  const tocCount = $("#toc-count");
  const relatedDocsEl = $("#related-docs");
  const relatedCount = $("#related-count");
  const luocdoEl = $("#luocdo");
  const luocdoBadge = $("#luocdo-badge");
  const crumbs = $("#crumbs");

  const readingInfo = $("#reading-info");
  const tabbar = $("#tabbar");
  const backTop = $("#back-top");

  const newdocsList = $("#newdocs-list");
  const newdocsTabs = $("#newdocs-tabs");
  const expiredList = $("#expired-list");
  const hotListSide = $("#hot-list-side");

  const refPopup = $("#ref-popup");
  const toast = $("#toast");

  const navHome = $("#nav-home");
  const navSearch = $("#nav-search");
  const brandHome = $("#brand-home");
  const backHome = $("#back-home");
  const ctaSearchBtn = $("#cta-search-btn");
  const bcHome = $("#bc-home");

  // ===== State =====
  let currentDoc = null;
  let activeSuggestionIdx = -1;
  let popupPinned = false;
  let popupTarget = null;
  let popupHideTimer = null;
  let scrollSpyArticles = [];
  let readSize = parseFloat(localStorage.getItem("vbpl.readSize")) || 16;
  let wideMode = localStorage.getItem("vbpl.wide") === "1";
  let newdocsFilter = "all";

  // ===== Utilities =====
  function stripAccents(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function formatDate(d) {
    if (!d) return "—";
    const p = d.split("-");
    if (p.length !== 3) return d;
    return `${p[2]}/${p[1]}/${p[0]}`;
  }
  // Abbreviate document-type labels for tight UI surfaces (Gantt pills,
  // sidebar lists). The full word is kept in the title attribute for hover.
  function abbrevType(type) {
    const map = {
      "Thông tư": "TT",
      "Nghị định": "NĐ",
      "Bộ luật": "BL"
    };
    return map[type] || type;
  }

  function statusClass(status) {
    if (!status) return "";
    if (/Hết hiệu lực/i.test(status)) return "expired";
    if (/Có hiệu lực/i.test(status)) return "ok";
    return "warn";
  }
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch {}
    document.body.removeChild(ta);
  }

  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 1800);
  }

  // ===== Search index =====
  function buildIndex() {
    return Object.values(DB).map(doc => ({
      id: doc.id, type: doc.type, typeKey: doc.typeKey,
      number: doc.number, shortTitle: doc.shortTitle, title: doc.title,
      issuer: doc.issuer, status: doc.status,
      issuedDate: doc.issuedDate, effectiveDate: doc.effectiveDate,
      haystack: stripAccents([doc.number, doc.shortTitle, doc.title, doc.type, doc.issuer].join(" "))
    }));
  }
  const SEARCH_INDEX = buildIndex();

  function score(query, item) {
    const q = stripAccents(query.trim());
    if (!q) return 0;
    let s = 0;
    for (const t of q.split(/\s+/).filter(Boolean)) {
      if (item.haystack.includes(t)) s += 10;
      if (stripAccents(item.number).includes(t)) s += 25;
    }
    if (stripAccents(item.id).includes(q)) s += 15;
    return s;
  }

  function suggest(query, limit = 7) {
    if (!query || !query.trim()) return [];
    return SEARCH_INDEX
      .map(item => ({ item, s: score(query, item) }))
      .filter(x => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, limit)
      .map(x => x.item);
  }

  function highlightMatch(text, query) {
    if (!query) return escapeHtml(text);
    const idx = stripAccents(text).indexOf(stripAccents(query.trim()));
    if (idx < 0) return escapeHtml(text);
    const q = query.trim();
    return escapeHtml(text.slice(0, idx)) +
      "<mark>" + escapeHtml(text.slice(idx, idx + q.length)) + "</mark>" +
      escapeHtml(text.slice(idx + q.length));
  }

  // ===== Recent =====
  function getRecent() {
    try { return JSON.parse(localStorage.getItem("vbpl.recent") || "[]"); }
    catch { return []; }
  }
  function pushRecent(docId) {
    let r = getRecent().filter(id => id !== docId);
    r.unshift(docId); r = r.slice(0, 5);
    localStorage.setItem("vbpl.recent", JSON.stringify(r));
  }

  // ===== Suggestions =====
  function renderSuggestions(listEl, query) {
    listEl.innerHTML = "";
    activeSuggestionIdx = -1;
    const q = (query || "").trim();
    if (!q) {
      const recent = getRecent().map(id => SEARCH_INDEX.find(it => it.id === id)).filter(Boolean);
      if (recent.length) {
        listEl.appendChild(makeSection("Đã xem gần đây"));
        recent.forEach(it => listEl.appendChild(makeSuggestionItem(it, "")));
      }
      return;
    }
    const items = suggest(q);
    if (!items.length) {
      const empty = document.createElement("li");
      empty.className = "suggestion-empty";
      empty.innerHTML = `<strong>Không tìm thấy văn bản phù hợp</strong>Thử tìm theo số hiệu (ví dụ 32/2024/QH15) hoặc tên rút gọn.`;
      listEl.appendChild(empty);
      return;
    }
    listEl.appendChild(makeSection(`${items.length} kết quả phù hợp`));
    items.forEach(it => listEl.appendChild(makeSuggestionItem(it, q)));
  }

  function makeSection(label) {
    const li = document.createElement("li");
    li.className = "suggestions-section";
    li.textContent = label;
    return li;
  }
  function makeSuggestionItem(item, query) {
    const li = document.createElement("li");
    li.className = "suggestion";
    li.dataset.docId = item.id;
    li.setAttribute("role", "option");
    li.innerHTML = `
      <span class="suggestion-type ${item.typeKey}">${escapeHtml(item.type)}</span>
      <div class="suggestion-body">
        <div class="suggestion-title">${highlightMatch(item.shortTitle, query)}</div>
        <div class="suggestion-meta">${highlightMatch(item.number, query)} · ${escapeHtml(item.issuer)}</div>
      </div>
    `;
    li.addEventListener("mousedown", (e) => { e.preventDefault(); openDoc(item.id); });
    li.addEventListener("mouseenter", () => setActiveSuggestion(li));
    return li;
  }
  function setActiveSuggestion(el) {
    const items = $$(".suggestion", el.parentNode);
    items.forEach(i => i.classList.remove("active"));
    el.classList.add("active");
    activeSuggestionIdx = items.indexOf(el);
  }
  function moveActiveSuggestion(listEl, dir) {
    const items = $$(".suggestion", listEl);
    if (!items.length) return;
    activeSuggestionIdx = (activeSuggestionIdx + dir + items.length) % items.length;
    items.forEach(i => i.classList.remove("active"));
    items[activeSuggestionIdx].classList.add("active");
    items[activeSuggestionIdx].scrollIntoView({ block: "nearest" });
  }

  function wireSearch(input, list, onSelect) {
    input.addEventListener("input", () => {
      if (input === searchInput) searchClear.classList.toggle("visible", !!input.value);
      renderSuggestions(list, input.value);
    });
    input.addEventListener("focus", () => {
      if (!input.value.trim()) renderSuggestions(list, "");
    });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { e.preventDefault(); moveActiveSuggestion(list, 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveActiveSuggestion(list, -1); }
      else if (e.key === "Enter") {
        const items = $$(".suggestion", list);
        if (activeSuggestionIdx >= 0 && items[activeSuggestionIdx]) onSelect(items[activeSuggestionIdx].dataset.docId);
        else { const top = suggest(input.value)[0]; if (top) onSelect(top.id); }
      } else if (e.key === "Escape") {
        list.innerHTML = ""; input.blur();
      }
    });
  }

  wireSearch(searchInput, suggestions, openDoc);
  wireSearch(sideSearchInput, sideSuggestions, (id) => {
    openDoc(id);
    sideSearchInput.value = "";
    sideSuggestions.innerHTML = "";
  });

  searchDo.addEventListener("click", () => {
    const top = suggest(searchInput.value)[0];
    if (top) openDoc(top.id);
    else if (searchInput.value.trim()) showToast("Không tìm thấy văn bản phù hợp");
    else searchInput.focus();
  });

  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    searchClear.classList.remove("visible");
    suggestions.innerHTML = "";
    searchInput.focus();
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap") && !e.target.closest(".header-search")) suggestions.innerHTML = "";
    if (!e.target.closest(".side-search")) sideSuggestions.innerHTML = "";
  });

  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      if (!viewer.classList.contains("hidden")) sideSearchInput.focus();
      else { searchInput.focus(); searchInput.scrollIntoView({ behavior: "smooth", block: "center" }); }
    } else if (e.key === "Escape" && popupPinned) {
      hidePopup(true);
    }
  });

  // ===== Navigation stack (drives the "Quay lại" button) =====
  const _navHistory = [];
  let _currentNav = null;
  let _suppressNav = false;
  function _recordNav(state) {
    if (_suppressNav) return;
    if (_currentNav) _navHistory.push(_currentNav);
    _currentNav = state;
  }
  function _navBack() {
    if (!_navHistory.length) {
      // Already on the first page — fall back to home
      _suppressNav = true; try { goHome(); } finally { _suppressNav = false; }
      return;
    }
    const prev = _navHistory.pop();
    _suppressNav = true;
    try {
      if (prev.type === "doc") openDoc(prev.docId, prev.opts || {});
      else goHome();
    } finally {
      _suppressNav = false;
      _currentNav = prev;
    }
  }
  const btnBack = $("#btn-back");
  if (btnBack) btnBack.addEventListener("click", (e) => { e.preventDefault(); _navBack(); });

  // Header / nav buttons
  if (brandHome) brandHome.addEventListener("click", (e) => { e.preventDefault(); goHome(); });
  if (navHome) navHome.addEventListener("click", (e) => { e.preventDefault(); goHome(); });
  if (navSearch) navSearch.addEventListener("click", (e) => { e.preventDefault(); goHome(); setTimeout(() => searchInput.focus(), 100); });
  if (backHome) backHome.addEventListener("click", (e) => { e.preventDefault(); goHome(); });
  if (bcHome) bcHome.addEventListener("click", (e) => { e.preventDefault(); goHome(); });
  if (ctaSearchBtn) ctaSearchBtn.addEventListener("click", () => searchInput.focus());

  // Top nav (Home + Văn bản theo lĩnh vực dropdown + field menu items)
  const topnavHome = $("#topnav-home");
  if (topnavHome) topnavHome.addEventListener("click", (e) => { e.preventDefault(); goHome(); });
  const topnavFieldsBtn = $("#topnav-fields-btn");
  const topnavFieldsItem = topnavFieldsBtn ? topnavFieldsBtn.closest(".topnav-dropdown") : null;
  if (topnavFieldsBtn && topnavFieldsItem) {
    topnavFieldsBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const open = topnavFieldsItem.classList.toggle("open");
      topnavFieldsBtn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".topnav-dropdown")) {
        topnavFieldsItem.classList.remove("open");
        topnavFieldsBtn.setAttribute("aria-expanded", "false");
      }
    });
  }
  $$(".topnav-menu-item").forEach(item => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const f = item.dataset.field;
      if (topnavFieldsItem) topnavFieldsItem.classList.remove("open");
      handleFieldClick(f);
    });
  });

  function handleFieldClick(f) {
    const labels = {
      "ngan-hang": "Tài chính – Ngân hàng",
      "dau-tu": "Đầu tư – Doanh nghiệp",
      "lao-dong": "Lao động – BHXH",
      "thue": "Thuế – Phí – Lệ phí",
      "dat-dai": "Đất đai – Xây dựng",
      "hinh-su": "Hình sự – Tố tụng",
      "dan-su": "Dân sự – Hợp đồng",
      "nang-luong": "Phát triển năng lượng tái tạo",
      "khac": "Lĩnh vực khác"
    };
    const fieldMatchers = {
      "ngan-hang": /(tổ chức tín dụng|ngân hàng|tiền tệ|tín dụng|tài chính)/,
      "hinh-su": /(hình sự|tội phạm)/,
      "nang-luong": /(năng lượng|điện lực|điện gió|điện mặt trời|tái tạo|dppa|mua bán điện)/
    };
    const lbl = labels[f] || "lĩnh vực này";
    const matcher = fieldMatchers[f];
    if (matcher) {
      // Filter newdocs list by docs whose title/shortTitle matches
      const ids = Object.values(DB)
        .filter(d => matcher.test((d.title + " " + d.shortTitle).toLowerCase()))
        .map(d => d.id);
      window.__fieldFilterIds = new Set(ids);
      newdocsFilter = "all";
      $$(".tab", newdocsTabs).forEach(x => x.classList.toggle("active", x.dataset.filter === "all"));
      renderNewdocs();
      showToast(`Đang lọc theo lĩnh vực ${lbl} — ${ids.length} văn bản`);
      const sec = $("#newdocs"); if (sec) sec.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      showToast(`Lĩnh vực ${lbl} đang cập nhật`);
    }
  }

  // Spotlight CTAs (Mở văn bản + Lược đồ)
  $$("[data-doc-id]").forEach(el => {
    if (el.tagName === "BUTTON" || (el.classList && (el.classList.contains("btn-cta") || el.classList.contains("btn-cta-secondary")))) {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        const tab = el.dataset.tab;
        openDoc(el.dataset.docId, { tab, luocdoOnly: tab === "luocdo" });
      });
    }
  });

  function setLuocdoOnlyMode(on) {
    document.body.classList.toggle("luocdo-only", !!on);
  }

  // Trending ticker links
  $$(".trending-row .ticker a").forEach(a => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      if (a.dataset.docId) openDoc(a.dataset.docId);
    });
  });

  function goHome() {
    _recordNav({ type: "home" });
    setLuocdoOnlyMode(false);
    viewer.classList.add("hidden");
    landing.classList.remove("hidden");
    searchInput.value = "";
    searchClear.classList.remove("visible");
    suggestions.innerHTML = "";
    if (navHome) navHome.classList.add("active");
    setCrumbs([{ label: "Trang chủ", action: goHome }, { label: "Tra cứu văn bản pháp luật", current: true }]);
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderLandingContent();
  }

  function setCrumbs(items) {
    if (!crumbs) return; // breadcrumb bar removed from layout
    crumbs.innerHTML = "";
    items.forEach((it, idx) => {
      if (idx > 0) {
        const sep = document.createElement("span");
        sep.className = "sep";
        sep.textContent = "›";
        crumbs.appendChild(sep);
      }
      if (it.current) {
        const span = document.createElement("span");
        span.className = "current";
        span.textContent = it.label;
        crumbs.appendChild(span);
      } else {
        const a = document.createElement("a");
        a.textContent = it.label;
        a.addEventListener("click", (e) => { e.preventDefault(); if (it.action) it.action(); });
        crumbs.appendChild(a);
      }
    });
  }

  // ===== Landing rendering =====
  function renderLandingContent() {
    renderStats();
    renderNewdocs();
    renderExpired();
    renderHot();
  }

  function renderStats() {
    const docs = Object.values(DB);
    const counts = { Luật: 0, "Nghị định": 0, "Thông tư": 0, "Bộ luật": 0 };
    let bankingCount = 0, criminalCount = 0, energyCount = 0;
    for (const d of docs) {
      if (counts[d.type] !== undefined) counts[d.type]++;
      const txt = (d.title + " " + d.shortTitle).toLowerCase();
      if (/(tổ chức tín dụng|ngân hàng|tiền tệ|tín dụng|tài chính)/.test(txt)) bankingCount++;
      if (/(hình sự|tội phạm)/.test(txt)) criminalCount++;
      if (/(năng lượng|điện lực|điện gió|điện mặt trời|tái tạo|dppa|mua bán điện)/.test(txt)) energyCount++;
    }

    const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };

    // === Spotlight: counts of docs RELATED to the featured doc (32/2024/QH15) ===
    const SPOTLIGHT_ID = "32/2024/QH15";
    const spotlight = H.findDoc(SPOTLIGHT_ID);
    const sp = { boluat: 0, luat: 0, nghidinh: 0, thongtu: 0, expired: 0, draft: 0 };
    if (spotlight) {
      const related = new Set();
      // Outgoing refs — use the same resolver as the popup so named codes (e.g. Bộ luật Hình sự) are caught
      const refs = collectAllRefsInDoc(spotlight);
      for (const r of refs) {
        if (r.docId && r.docId !== spotlight.id) related.add(r.docId);
      }
      // explicit replaces relations
      for (const id of (spotlight.replaces || [])) related.add(id);
      // anything that says it's been replaced by us, or that we replace
      for (const other of docs) {
        if (other.id === spotlight.id) continue;
        const oReplaces = Array.isArray(other.replaces) ? other.replaces : [];
        if (oReplaces.includes(spotlight.id) || (other.status && other.status.includes(spotlight.id))) related.add(other.id);
        if (spotlight.status && spotlight.status.includes(other.id)) related.add(other.id);
      }
      // any draft / under-discussion doc that targets or amends the spotlight
      for (const other of docs) {
        if (other.id === spotlight.id) continue;
        if (/Dự thảo|Đang thảo luận/i.test(other.status || "")) {
          const txt = (other.title + " " + other.shortTitle).toLowerCase();
          if (txt.includes(spotlight.id.toLowerCase()) || txt.includes("tổ chức tín dụng")) related.add(other.id);
        }
      }
      // Any other doc whose body cites the spotlight (incoming refs)
      for (const other of docs) {
        if (other.id === spotlight.id) continue;
        const otherRefs = collectAllRefsInDoc(other);
        if (otherRefs.some(r => r.docId === spotlight.id)) related.add(other.id);
      }

      // Dedupe by canonical doc id (the related Set may contain both
      // "NĐ-CP" and "ND-CP" variants of the same id)
      const seenCanonical = new Set();
      for (const id of related) {
        const d = H.findDoc(id);
        if (!d || seenCanonical.has(d.id)) continue;
        seenCanonical.add(d.id);
        const isDraft = /Dự thảo|Đang thảo luận/i.test(d.status || "");
        const isExpired = /Hết hiệu lực/i.test(d.status || "") || !!d.expiryDate;
        if (isDraft) sp.draft++;
        else if (isExpired) sp.expired++;
        else if (d.type === "Bộ luật") sp.boluat++;
        else if (d.type === "Luật") sp.luat++;
        else if (d.type === "Nghị định") sp.nghidinh++;
        else if (d.type === "Thông tư") sp.thongtu++;
      }
    }
    setText("#sp-cnt-boluat", sp.boluat);
    setText("#sp-cnt-luat", sp.luat);
    setText("#sp-cnt-nghidinh", sp.nghidinh);
    setText("#sp-cnt-thongtu", sp.thongtu);
    setText("#sp-cnt-expired", sp.expired);
    setText("#sp-cnt-draft", sp.draft);

    // === Sidebar Stats — total counts in DB ===
    setText("#ast-total", docs.length);
    setText("#ast-luat", counts["Luật"] + counts["Bộ luật"]);
    setText("#ast-nd", counts["Nghị định"]);
    setText("#ast-tt", counts["Thông tư"]);

    // === "Văn bản mới" tab counts ===
    setText("#cnt-all", docs.length);
    setText("#cnt-luat", counts["Luật"]);
    setText("#cnt-nghidinh", counts["Nghị định"]);
    setText("#cnt-thongtu", counts["Thông tư"]);
    setText("#cnt-boluat", counts["Bộ luật"]);

    // === Field counts (top nav dropdown) ===
    setText("#tn-fc-banking", bankingCount + " văn bản");
    setText("#tn-fc-criminal", criminalCount + " văn bản");
    setText("#tn-fc-energy", energyCount + " văn bản");
  }

  // Văn bản mới — sorted by issuedDate desc
  function renderNewdocs() {
    if (!newdocsList) return; // panel removed from landing
    let docs = Object.values(DB).slice();
    docs.sort((a, b) => (b.issuedDate || "").localeCompare(a.issuedDate || ""));
    if (newdocsFilter !== "all") docs = docs.filter(d => d.type === newdocsFilter);
    if (window.__fieldFilterIds) docs = docs.filter(d => window.__fieldFilterIds.has(d.id));

    if (!docs.length) {
      newdocsList.innerHTML = `<li style="grid-template-columns: 1fr; cursor: default; color: var(--ink-mute); padding: 20px 0; text-align: center;">Không có văn bản loại này.</li>`;
      return;
    }

    newdocsList.innerHTML = docs.map(d => {
      const isHot = /Có hiệu lực/i.test(d.status) && new Date(d.issuedDate) >= new Date("2020-01-01");
      const isNew = new Date(d.issuedDate) >= new Date("2023-01-01");
      let badge = "";
      if (isNew) badge = `<span class="status new">Mới</span>`;
      else if (isHot) badge = `<span class="status hot">Hot</span>`;
      return `
        <li data-doc-id="${escapeHtml(d.id)}">
          <span class="dl-type ${d.typeKey}">${escapeHtml(d.type)}</span>
          <div class="dl-body">
            <div class="dl-title">${escapeHtml(d.shortTitle)}</div>
            <div class="dl-meta">
              <span class="dl-num">${escapeHtml(d.number)}</span>
              <span><strong>Cơ quan:</strong> ${escapeHtml(d.issuer)}</span>
              <span><strong>Hiệu lực:</strong> ${formatDate(d.effectiveDate)}</span>
            </div>
          </div>
          <div class="dl-side">
            ${badge}
            <span class="dl-date" style="margin-top:4px;">Ban hành ${formatDate(d.issuedDate)}</span>
          </div>
        </li>
      `;
    }).join("");

    $$("li[data-doc-id]", newdocsList).forEach(li => {
      li.addEventListener("click", () => openDoc(li.dataset.docId));
    });
  }

  // Tab strip — set filter (clears any active field filter)
  if (newdocsTabs) {
    $$(".tab", newdocsTabs).forEach(t => {
      t.addEventListener("click", () => {
        $$(".tab", newdocsTabs).forEach(x => x.classList.remove("active"));
        t.classList.add("active");
        newdocsFilter = t.dataset.filter;
        window.__fieldFilterIds = null;
        renderNewdocs();
      });
    });
  }

  function renderExpired() {
    if (!expiredList) return; // panel removed from landing
    const docs = Object.values(DB).filter(d => /Hết hiệu lực/i.test(d.status));
    if (!docs.length) {
      expiredList.innerHTML = `<li style="grid-template-columns: 1fr; cursor: default; color: var(--ink-mute); padding: 16px 0; text-align: center;">Chưa có văn bản hết hiệu lực trong CSDL.</li>`;
      return;
    }
    expiredList.innerHTML = docs.map(d => `
      <li data-doc-id="${escapeHtml(d.id)}">
        <span class="dl-type ${d.typeKey}">${escapeHtml(d.type)}</span>
        <div class="dl-body">
          <div class="dl-title">${escapeHtml(d.shortTitle)}</div>
          <div class="dl-meta">
            <span class="dl-num">${escapeHtml(d.number)}</span>
            <span><strong>Tình trạng:</strong> ${escapeHtml(d.status)}</span>
          </div>
        </div>
        <div class="dl-side">
          <span class="status expired">Hết HL</span>
          <span class="dl-date" style="margin-top:4px;">${formatDate(d.issuedDate)}</span>
        </div>
      </li>
    `).join("");
    $$("li[data-doc-id]", expiredList).forEach(li => {
      li.addEventListener("click", () => openDoc(li.dataset.docId));
    });
  }

  // Hot docs — top 5 by ref count (computed) or featured
  function renderHot() {
    const docs = Object.values(DB).filter(d => /Có hiệu lực/i.test(d.status));
    docs.sort((a, b) => (b.issuedDate || "").localeCompare(a.issuedDate || ""));
    const top = docs.slice(0, 5);

    const html = top.map(d => `
      <li data-doc-id="${escapeHtml(d.id)}">
        <div style="flex:1; min-width:0;">
          <div class="h-title">${escapeHtml(d.shortTitle)}</div>
          <span class="h-num">${escapeHtml(d.number)}</span>
        </div>
      </li>
    `).join("");

    if (hotListSide) {
      hotListSide.innerHTML = html;
      $$("li[data-doc-id]", hotListSide).forEach(li => li.addEventListener("click", () => openDoc(li.dataset.docId)));
    }
  }

  // ===== Open / render document =====
  function openDoc(id, opts = {}) {
    const doc = H.findDoc(id);
    if (!doc) return;
    _recordNav({ type: "doc", docId: id, opts });
    // Default: reset luocdo-only. Caller can opt back in via opts.luocdoOnly
    // (the spotlight Lược-đồ button does this) or by setting it AFTER openDoc.
    setLuocdoOnlyMode(!!opts.luocdoOnly);
    currentDoc = doc;
    pushRecent(doc.id);
    autoCacheDoc(doc);

    landing.classList.add("hidden");
    viewer.classList.remove("hidden");
    suggestions.innerHTML = "";
    sideSuggestions.innerHTML = "";

    if (navHome) navHome.classList.remove("active");
    setCrumbs([
      { label: "Trang chủ", action: goHome },
      { label: doc.type, action: goHome },
      { label: doc.shortTitle, current: true }
    ]);

    renderTitlebar(doc);
    renderProps(doc);
    renderBody(doc);
    renderToc(doc);
    renderRelated(doc);
    renderLuocdo(doc);
    renderHot(); // refresh side hot list
    activateTab(opts.tab || "toanvan");
    applyReadSettings();

    window.scrollTo({ top: 0 });
  }

  function renderTitlebar(doc) {
    const loaded = (doc.chapters || []).reduce((s, ch) => s + ch.articles.length, 0);
    const total = doc.articleTotal || loaded;
    const partial = loaded < total;
    const coverageHtml = `
      <div class="doc-coverage ${partial ? "partial" : "full"}">
        <span class="cov-label">Đã tải <strong>${loaded}</strong> trong tổng <strong>${total}</strong> điều</span>
        ${partial && doc.sourceUrl ? `<a class="cov-source" href="${escapeHtml(doc.sourceUrl)}" target="_blank" rel="noopener">Mở bản gốc tại nguồn →</a>` : ""}
      </div>
    `;
    docTitlebar.innerHTML = `
      <span class="type-pill">${escapeHtml(doc.type)} · ${escapeHtml(doc.number)}</span>
      <h1>${escapeHtml(doc.title)}</h1>
      <div class="doc-issuer">${escapeHtml(doc.issuer)}${doc.signedBy ? " · Người ký: " + escapeHtml(doc.signedBy) : ""}</div>
      ${coverageHtml}
    `;
  }

  function renderProps(doc) {
    const cls = statusClass(doc.status);
    const compact = `
      <tr><th>Số/Ký hiệu</th><td><span class="num">${escapeHtml(doc.number)}</span></td>
          <th>Ngày ban hành</th><td>${formatDate(doc.issuedDate)}</td></tr>
      <tr><th>Loại văn bản</th><td>${escapeHtml(doc.type)}</td>
          <th>Ngày hiệu lực</th><td>${formatDate(doc.effectiveDate)}</td></tr>
      <tr><th>Cơ quan ban hành</th><td>${escapeHtml(doc.issuer)}</td>
          <th>Tình trạng</th><td><span class="status ${cls}">${escapeHtml(doc.status)}</span></td></tr>
    `;
    propsTable.innerHTML = compact;

    // Thuộc tính tab was removed; the compact props table on top covers
    // everything users need at a glance.
  }

  function renderBody(doc) {
    let html = "";
    let articleCount = 0;
    for (const ch of doc.chapters || []) {
      html += `<h2 class="chapter">${escapeHtml(ch.title)}</h2>`;
      if (ch.subtitle) html += `<div class="chapter-title">${escapeHtml(ch.subtitle)}</div>`;
      for (const a of ch.articles) {
        articleCount++;
        html += `<h3 class="article" id="${a.id}">
          <span>${escapeHtml(a.number)}. ${escapeHtml(a.heading)}</span>
          <a class="anchor-link" data-anchor="${a.id}" title="Chép liên kết điều này">#</a>
        </h3>`;
        html += renderArticleBody(a.body);
      }
    }
    docBody.innerHTML = html;
    annotateReferences(docBody, doc);
    if (readingInfo) readingInfo.textContent = `${articleCount} điều · ${doc.chapters.length} chương`;

    $$(".anchor-link", docBody).forEach(a => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        const id = a.dataset.anchor;
        const url = `${location.origin}${location.pathname}#${doc.id}/${id}`;
        copyText(url);
        showToast("Đã chép liên kết điều");
      });
    });

    scrollSpyArticles = $$("h3.article", docBody).map(el => ({
      id: el.id, el,
      link: tocEl.querySelector(`a[data-anchor="${el.id}"]`)
    }));
  }

  function renderArticleBody(body) {
    const lines = body.split(/\r?\n/);
    let html = "";
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      if (/^[a-zđ]\)/i.test(t)) html += `<p class="point">${escapeHtml(t)}</p>`;
      else if (/^\d+\./.test(t)) html += `<p class="clause">${escapeHtml(t)}</p>`;
      else html += `<p>${escapeHtml(t)}</p>`;
    }
    return html;
  }

  function renderToc(doc) {
    let html = "";
    let n = 0;
    for (const ch of doc.chapters || []) {
      html += `<a class="chapter">${escapeHtml(ch.title)}${ch.subtitle ? " · " + escapeHtml(ch.subtitle) : ""}</a>`;
      for (const a of ch.articles) {
        n++;
        html += `<a class="article" data-anchor="${a.id}">${escapeHtml(a.number)} · ${escapeHtml(a.heading)}</a>`;
      }
    }
    tocEl.innerHTML = html;
    if (tocCount) tocCount.textContent = n;
    tocEl.querySelectorAll("a[data-anchor]").forEach(link => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        if (!isTabActive("toanvan")) activateTab("toanvan");
        const el = document.getElementById(link.dataset.anchor);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
          el.classList.remove("flash");
          void el.offsetWidth;
          el.classList.add("flash");
        }
      });
    });
  }

  function renderRelated(doc) {
    const refs = collectAllRefsInDoc(doc);
    const seen = new Map();
    for (const r of refs) {
      if (!r.docId || r.docId === doc.id) continue;
      if (!seen.has(r.docId)) seen.set(r.docId, r);
    }
    const items = [];
    for (const r of seen.values()) {
      const t = H.findDoc(r.docId);
      if (t) items.push({ id: t.id, num: t.number, title: t.shortTitle });
      else items.push({ id: null, num: r.docId, title: "Chưa có trong CSDL" });
    }
    if (relatedCount) relatedCount.textContent = items.length;
    if (!items.length) {
      relatedDocsEl.innerHTML = `<li data-disabled>Không có viện dẫn ngoài.</li>`;
      return;
    }
    relatedDocsEl.innerHTML = items.map(it => `
      <li ${it.id ? `data-doc-id="${escapeHtml(it.id)}"` : 'data-disabled'}>
        <span class="related-num">${escapeHtml(it.num)}</span>
        <span class="related-title">${escapeHtml(it.title)}</span>
      </li>
    `).join("");
    relatedDocsEl.querySelectorAll("li[data-doc-id]").forEach(li => {
      li.addEventListener("click", () => openDoc(li.dataset.docId));
    });
  }

  function renderLuocdo(doc) {
    // Outgoing citations — docs cited from inside this doc's body
    const refs = collectAllRefsInDoc(doc);
    const cited = new Map();
    for (const r of refs) {
      if (!r.docId || r.docId === doc.id) continue;
      if (!cited.has(r.docId)) cited.set(r.docId, H.findDoc(r.docId));
    }
    // Incoming citations — docs in the corpus whose body references this doc
    const citedBy = new Map();
    for (const other of Object.values(DB)) {
      if (other.id === doc.id) continue;
      const otherRefs = collectAllRefsInDoc(other);
      if (otherRefs.some(r => r.docId === doc.id)) citedBy.set(other.id, other);
    }
    // replaces = older docs that this doc replaced (predecessors)
    // replacedBy = newer docs that have replaced this doc (successors)
    const replacedBy = [];
    const replaces = [];
    const docReplaces = Array.isArray(doc.replaces) ? doc.replaces : [];
    for (const other of Object.values(DB)) {
      if (other.id === doc.id) continue;
      const otherReplaces = Array.isArray(other.replaces) ? other.replaces : [];
      if (docReplaces.includes(other.id) || (doc.status && doc.status.includes(other.id))) replaces.push(other);
      if (otherReplaces.includes(doc.id) || (other.status && other.status.includes(doc.id))) replacedBy.push(other);
    }
    if (luocdoBadge) luocdoBadge.textContent = cited.size + citedBy.size + replaces.length + replacedBy.length;

    // Strict relationship view — only include docs that have a direct relationship to current.
    // Priority: current > replaced/successor (structural) > cited/cites (textual reference)
    const onTimeline = new Map();
    onTimeline.set(doc.id, { doc, role: "current", relLabel: "Văn bản đang xem" });
    for (const d of replaces) if (d && !onTimeline.has(d.id)) onTimeline.set(d.id, { doc: d, role: "replaced", relLabel: "Bị thay thế bởi văn bản đang xem" });
    for (const d of replacedBy) if (d && !onTimeline.has(d.id)) onTimeline.set(d.id, { doc: d, role: "successor", relLabel: "Văn bản đã thay thế văn bản đang xem" });
    for (const [, d] of cited) if (d && !onTimeline.has(d.id)) onTimeline.set(d.id, { doc: d, role: "cited", relLabel: "Được dẫn chiếu trong văn bản này" });
    for (const [, d] of citedBy) if (d && !onTimeline.has(d.id)) onTimeline.set(d.id, { doc: d, role: "cites", relLabel: "Văn bản này được viện dẫn ở đây" });

    const today = new Date().toISOString().slice(0, 10);
    const items = Array.from(onTimeline.values()).map(({ doc: d, role, relLabel }) => {
      const start = d.effectiveDate || d.issuedDate;
      const end = d.expiryDate || (/Hết hiệu lực/i.test(d.status || "") ? null : today);
      return { doc: d, role, relLabel, start, end: end || start };
    }).filter(it => it.start);

    // Sort: current first, then by start asc
    items.sort((a, b) => {
      if (a.role === "current") return -1;
      if (b.role === "current") return 1;
      return (a.start || "").localeCompare(b.start || "");
    });

    let html = `<h2>Lược đồ văn bản — ${escapeHtml(doc.shortTitle)}</h2>`;

    if (items.length === 0) {
      html += `<div class="ld-empty">Không có văn bản liên quan để hiển thị trên lược đồ.</div>`;
      luocdoEl.innerHTML = html;
      return;
    }

    // Compute timeline range
    const allDates = items.flatMap(it => [it.start, it.end]).filter(Boolean);
    let minDate = allDates.reduce((a, b) => a < b ? a : b);
    let maxDate = allDates.reduce((a, b) => a > b ? a : b);
    // Pad 6 months before and after
    const minY = parseInt(minDate.slice(0, 4), 10) - 1;
    const maxY = parseInt(maxDate.slice(0, 4), 10) + 1;
    const rangeStart = `${minY}-01-01`;
    const rangeEnd = `${maxY}-12-31`;
    const rangeMs = new Date(rangeEnd) - new Date(rangeStart);

    const pct = (d) => {
      const ms = new Date(d) - new Date(rangeStart);
      return Math.max(0, Math.min(100, (ms / rangeMs) * 100));
    };

    // Year tick marks. To avoid the labels cramming together when the range
    // spans many years, we draw a gridline for every year but only label
    // every 2nd year (or every 5th when the range is very long).
    const span = maxY - minY;
    const labelStep = span > 30 ? 5 : span > 15 ? 2 : 1;
    const ticks = [];
    for (let y = minY; y <= maxY; y++) ticks.push(y);
    const tickHtml = ticks.map(y => {
      const showLabel = (y - minY) % labelStep === 0;
      return `<div class="lt-tick${showLabel ? "" : " lt-tick-minor"}" style="left:${pct(`${y}-01-01`)}%">${showLabel ? y : ""}</div>`;
    }).join("");

    // "Today" marker
    const todayPct = pct(today);
    const todayMarker = (todayPct >= 0 && todayPct <= 100)
      ? `<div class="lt-today" style="left:${todayPct}%" title="Hôm nay"><span>Hôm nay</span></div>`
      : "";

    const roleLabel = { current: "Văn bản hiện tại", cited: "Văn bản được dẫn chiếu", replaced: "Bị thay thế bởi văn bản này", successor: "Thay thế văn bản này" };

    const rowsHtml = items.map(it => {
      const d = it.doc;
      const startPct = pct(it.start);
      const endPct = pct(it.end);
      const widthPct = Math.max(1.2, endPct - startPct);
      const isExpired = !!d.expiryDate || /Hết hiệu lực/i.test(d.status || "");
      // Bar colour comes from the document type pill (Luật/Bộ luật/Nghị định/
      // Thông tư) rather than the role, so the bar visually matches the type
      // chip on the left. Role is still on the bar for the dotted/hatched
      // overlays (current = ring, expired = stripes).
      const barCls = ["lt-bar", `type-${d.typeKey || "luat"}`, `role-${it.role}`, isExpired ? "expired" : "active"].join(" ");
      const typeLabel = abbrevType(d.type);
      // Pin the rel-label to the right edge of the bar so it stays close
      // to the timeline event without clipping the track for distant docs.
      const relLeftPct = Math.max(0, Math.min(86, startPct));
      return `
        <div class="lt-row role-${it.role}" data-doc-id="${escapeHtml(d.id)}">
          <div class="lt-meta">
            <span class="lt-type ${d.typeKey}" title="${escapeHtml(d.type)}">${escapeHtml(typeLabel)}</span>
            <div class="lt-meta-text">
              <div class="lt-num">${escapeHtml(d.number)}</div>
              <div class="lt-title" title="${escapeHtml(d.shortTitle)}">${escapeHtml(d.shortTitle)}</div>
            </div>
          </div>
          <div class="lt-splitter" aria-hidden="true"></div>
          <div class="lt-track">
            <div class="${barCls}" style="left:${startPct}%; width:${widthPct}%" title="${escapeHtml(formatDate(it.start))} → ${isExpired ? escapeHtml(formatDate(d.expiryDate || it.end)) : "hiện tại"}">
              <span class="lt-bar-label">${escapeHtml(formatDate(it.start))}${isExpired ? " → " + escapeHtml(formatDate(d.expiryDate || it.end)) : ""}</span>
            </div>
            <div class="lt-rel" style="left:${relLeftPct}%">${escapeHtml(it.relLabel)}</div>
          </div>
        </div>
      `;
    }).join("");

    html += `
      <div class="lt-legend">
        <span class="lt-legend-item"><span class="lt-swatch type-luat"></span>Luật / Bộ luật</span>
        <span class="lt-legend-item"><span class="lt-swatch type-nghidinh"></span>Nghị định</span>
        <span class="lt-legend-item"><span class="lt-swatch type-thongtu"></span>Thông tư</span>
        <span class="lt-legend-item"><span class="lt-swatch type-luat ring"></span>Văn bản đang xem</span>
        <span class="lt-legend-item"><span class="lt-swatch expired"></span>Hết hiệu lực</span>
      </div>
      <div class="lt-wrap">
        <div class="lt-axis-row">
          <div class="lt-axis-spacer" aria-hidden="true"></div>
          <div class="lt-splitter" aria-hidden="true"></div>
          <div class="lt-axis">${tickHtml}${todayMarker}</div>
        </div>
        <div class="lt-rows">${rowsHtml}</div>
      </div>
      <div class="lt-summary-bar" role="list">
        <div class="ls-item" role="listitem"><span class="ls-num">${cited.size}</span><span class="ls-lbl">Dẫn chiếu (đi)</span></div>
        <div class="ls-item" role="listitem"><span class="ls-num">${citedBy.size}</span><span class="ls-lbl">Được viện dẫn (đến)</span></div>
        <div class="ls-item" role="listitem"><span class="ls-num">${replaces.length}</span><span class="ls-lbl">Bị thay thế bởi VB này</span></div>
        <div class="ls-item" role="listitem"><span class="ls-num">${replacedBy.length}</span><span class="ls-lbl">VB thay thế</span></div>
      </div>
    `;

    luocdoEl.innerHTML = html;
    // Every row is clickable — including the current one. Clicking the
    // current row exits luocdo-only mode (openDoc resets it) and shows the
    // full Toàn-văn viewer for that doc.
    luocdoEl.querySelectorAll(".lt-row[data-doc-id]").forEach(row => {
      const id = row.dataset.docId;
      row.style.cursor = "pointer";
      row.addEventListener("click", (e) => {
        if (e.target.classList.contains("lt-splitter")) return;
        openDoc(id);
      });
    });
    wireMetaSplitter(luocdoEl.querySelector(".lt-wrap"));
    // Restore persisted column width
    const wrap = luocdoEl.querySelector(".lt-wrap");
    if (wrap) {
      const stored = parseInt(localStorage.getItem("vbpl.lt.metaW") || "0", 10);
      if (stored >= 120 && stored <= 400) wrap.style.setProperty("--lt-meta-width", stored + "px");
    }
  }

  function wireMetaSplitter(wrap) {
    if (!wrap || wrap.dataset.splitterBound) return;
    wrap.dataset.splitterBound = "1";
    let dragging = null;
    function onDown(e) {
      const handle = e.target.closest(".lt-splitter");
      if (!handle || !wrap.contains(handle)) return;
      e.preventDefault();
      e.stopPropagation();
      const cs = getComputedStyle(wrap).getPropertyValue("--lt-meta-width") || "200";
      dragging = { startX: e.clientX, startW: parseInt(cs, 10) || 200 };
      document.body.classList.add("lt-resizing");
    }
    function onMove(e) {
      if (!dragging) return;
      const dx = e.clientX - dragging.startX;
      const w = Math.max(120, Math.min(400, dragging.startW + dx));
      wrap.style.setProperty("--lt-meta-width", w + "px");
    }
    function onUp() {
      if (!dragging) return;
      const w = parseInt(getComputedStyle(wrap).getPropertyValue("--lt-meta-width"), 10);
      try { localStorage.setItem("vbpl.lt.metaW", String(w)); } catch {}
      dragging = null;
      document.body.classList.remove("lt-resizing");
    }
    wrap.addEventListener("mousedown", onDown);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // Auto-cache: every time the user opens a doc, persist its full payload to
  // localStorage. The local "DB" grows organically as the user actually uses
  // the system — no manual download step needed.
  function autoCacheDoc(d) {
    if (!d || !d.id) return;
    try {
      const cacheKey = "vbpl.localdb.cache";
      const existing = JSON.parse(localStorage.getItem(cacheKey) || "{}");
      existing[d.id] = {
        id: d.id, type: d.type, typeKey: d.typeKey, number: d.number,
        shortTitle: d.shortTitle, title: d.title,
        issuer: d.issuer, signedBy: d.signedBy || null,
        issuedDate: d.issuedDate, effectiveDate: d.effectiveDate,
        expiryDate: d.expiryDate || null,
        status: d.status,
        replaces: d.replaces || null,
        sourceUrl: d.sourceUrl || null,
        articleTotal: d.articleTotal || null,
        chapters: d.chapters || [],
        cachedAt: new Date().toISOString()
      };
      localStorage.setItem(cacheKey, JSON.stringify(existing));
    } catch (err) { /* quota/disabled — silent */ }
  }

  // ===== Tabs =====
  function activateTab(name) {
    $$(".tab", tabbar).forEach(t => {
      if (!t.dataset.tab) return;
      t.classList.toggle("active", t.dataset.tab === name);
    });
    $$(".tab-panel").forEach(p => {
      p.classList.toggle("active", p.dataset.panel === name);
    });
    const rt = $("#read-toolbar");
    if (rt) rt.style.display = (name === "toanvan") ? "" : "none";
  }
  function isTabActive(name) {
    return !!$(`.tab.active[data-tab="${name}"]`, tabbar);
  }
  $$(".tab[data-tab]", tabbar).forEach(t => {
    t.addEventListener("click", () => activateTab(t.dataset.tab));
  });


  // Reading toolbar
  $("#size-down").addEventListener("click", () => setReadSize(readSize - 1));
  $("#size-up").addEventListener("click", () => setReadSize(readSize + 1));
  $("#size-reset").addEventListener("click", () => setReadSize(16));
  $("#width-narrow").addEventListener("click", () => setWide(false));
  $("#width-wide").addEventListener("click", () => setWide(true));

  function setReadSize(px) {
    readSize = Math.max(13, Math.min(20, px));
    localStorage.setItem("vbpl.readSize", String(readSize));
    applyReadSettings();
  }
  function setWide(on) {
    wideMode = !!on;
    localStorage.setItem("vbpl.wide", wideMode ? "1" : "0");
    applyReadSettings();
  }
  function applyReadSettings() {
    docBody.style.setProperty("--read-size", readSize + "px");
    docBody.classList.toggle("wide", wideMode);
    const wn = $("#width-narrow"), ww = $("#width-wide");
    if (wn && ww) {
      wn.classList.toggle("active", !wideMode);
      ww.classList.toggle("active", wideMode);
    }
  }

  // ===== References =====
  const DOC_NUMBER_RE = /(Luật|Nghị\s*định|Thông\s*tư|Bộ\s*luật)(?:\s+số)?\s+([0-9]+\/[0-9]+\/(?:QH[0-9]+|N[ĐD][- ]?CP|TT[- ]?[A-ZĐ]+))/giu;
  // Allow commas inside the document name segment — Vietnamese laws often have
  // them (e.g. "Luật Phòng, chống rửa tiền số 14/2022/QH15").
  const NAMED_DOC_NUMBER_RE = /(Luật|Bộ\s*luật|Nghị\s*định|Thông\s*tư)\s+(?:[^.;\n\/]{1,80}?)\s+số\s+([0-9]+\/[0-9]+\/(?:QH[0-9]+|N[ĐD][- ]?CP|TT[- ]?[A-ZĐ]+))/giu;
  const NAMED_CODE_RE = /Bộ\s*luật\s+Hình\s+sự(?!\s+số)/giu;
  const INNER_REF_RE = /(?:điểm\s+([a-zđ])\s+)?(?:khoản\s+(\d+)\s+)?Điều\s+(\d+)(?:\s+của\s+(Luật\s+này|Luật\s+số\s+[0-9]+\/[0-9]+\/QH[0-9]+|Nghị\s*định\s+số\s+[0-9]+\/[0-9]+\/N[ĐD]-CP|Thông\s*tư\s+số\s+[0-9]+\/[0-9]+\/TT-[A-ZĐ]+))?/giu;

  function normalizeDocNumber(raw) {
    return raw.toUpperCase().replace(/\s+/g, "")
      .replace(/ND-CP/gi, "NĐ-CP")
      .replace(/NĐ\s*-\s*CP/gi, "NĐ-CP")
      .replace(/TT\s*-\s*/gi, "TT-");
  }

  function annotateReferences(rootEl, contextDoc) {
    walkTextNodes(rootEl, (textNode) => {
      const text = textNode.nodeValue;
      if (!text || text.length < 4) return;
      const matches = findReferencesInText(text);
      if (!matches.length) return;
      const frag = document.createDocumentFragment();
      let cursor = 0;
      for (const m of matches) {
        if (m.start < cursor) continue;
        if (m.start > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));
        const span = document.createElement("span");
        span.className = "legal-ref";
        span.dataset.kind = m.kind;
        if (m.docId) span.dataset.docId = m.docId;
        if (m.articleNumber) span.dataset.article = m.articleNumber;
        if (m.clause) span.dataset.clause = m.clause;
        if (m.point) span.dataset.point = m.point;
        span.dataset.raw = m.raw;
        const resolved = resolveReference(m, contextDoc);
        if (!resolved.found) span.classList.add("missing");
        span.textContent = m.raw;
        frag.appendChild(span);
        cursor = m.end;
      }
      if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
      textNode.parentNode.replaceChild(frag, textNode);
    });
  }

  function findReferencesInText(text) {
    const found = [];
    let m;
    NAMED_DOC_NUMBER_RE.lastIndex = 0;
    while ((m = NAMED_DOC_NUMBER_RE.exec(text)) !== null) {
      found.push({ kind: "doc", docId: normalizeDocNumber(m[2]), articleNumber: null, clause: null, point: null, raw: m[0], start: m.index, end: m.index + m[0].length });
    }
    DOC_NUMBER_RE.lastIndex = 0;
    while ((m = DOC_NUMBER_RE.exec(text)) !== null) {
      if (found.some(r => !(r.end <= m.index || r.start >= m.index + m[0].length))) continue;
      found.push({ kind: "doc", docId: normalizeDocNumber(m[2]), articleNumber: null, clause: null, point: null, raw: m[0], start: m.index, end: m.index + m[0].length });
    }
    NAMED_CODE_RE.lastIndex = 0;
    while ((m = NAMED_CODE_RE.exec(text)) !== null) {
      if (found.some(r => r.start <= m.index && r.end >= m.index + m[0].length)) continue;
      found.push({ kind: "named-code", docId: "100/2015/QH13", articleNumber: null, clause: null, point: null, raw: m[0], start: m.index, end: m.index + m[0].length });
    }
    INNER_REF_RE.lastIndex = 0;
    while ((m = INNER_REF_RE.exec(text)) !== null) {
      const point = m[1] || null, clause = m[2] || null, article = m[3];
      const targetPhrase = m[4] || null;
      let docId = null;
      if (!targetPhrase || /Luật\s+này/i.test(targetPhrase)) docId = null;
      else {
        const nm = targetPhrase.match(/[0-9]+\/[0-9]+\/[A-ZĐ\-]+/i);
        if (nm) docId = normalizeDocNumber(nm[0]);
      }
      if (found.some(r => !(r.end <= m.index || r.start >= m.index + m[0].length))) continue;
      found.push({ kind: "article", docId, articleNumber: article, clause, point, raw: m[0], start: m.index, end: m.index + m[0].length });
    }
    found.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
    const filtered = []; let lastEnd = -1;
    for (const r of found) {
      if (r.start >= lastEnd) { filtered.push(r); lastEnd = r.end; }
    }
    return filtered;
  }

  function resolveReference(ref, contextDoc) {
    const targetDocId = ref.docId || (contextDoc ? contextDoc.id : null);
    const targetDoc = targetDocId ? H.findDoc(targetDocId) : null;
    if (ref.kind === "doc" || ref.kind === "named-code") {
      return { found: !!targetDoc, doc: targetDoc, article: null };
    }
    if (ref.kind === "article") {
      if (!targetDoc) return { found: false, doc: null, article: null };
      const art = H.findArticle(targetDoc, ref.articleNumber);
      return { found: !!art, doc: targetDoc, article: art };
    }
    return { found: false };
  }

  function collectAllRefsInDoc(doc) {
    const out = [];
    for (const ch of doc.chapters || []) {
      for (const a of ch.articles) {
        const refs = findReferencesInText(a.body);
        for (const r of refs) if (r.kind === "doc" || r.kind === "named-code") out.push(r);
      }
    }
    return out;
  }

  // ===== Popup =====
  document.addEventListener("mouseover", (e) => {
    const refEl = e.target.closest(".legal-ref");
    if (!refEl) return;
    if (popupPinned) return;
    if (refEl === popupTarget) { clearTimeout(popupHideTimer); return; }
    popupTarget = refEl;
    clearTimeout(popupHideTimer);
    showPopupForRef(refEl, false);
  });
  document.addEventListener("mouseout", (e) => {
    const refEl = e.target.closest(".legal-ref");
    if (!refEl || popupPinned) return;
    popupHideTimer = setTimeout(() => hidePopup(false), 220);
  });
  document.addEventListener("click", (e) => {
    const refEl = e.target.closest(".legal-ref");
    if (refEl) {
      popupPinned = true;
      popupTarget = refEl;
      showPopupForRef(refEl, true);
      e.stopPropagation();
      return;
    }
    if (popupPinned && !e.target.closest(".ref-popup")) hidePopup(true);
  });
  refPopup.addEventListener("mouseenter", () => clearTimeout(popupHideTimer));
  refPopup.addEventListener("mouseleave", () => {
    if (popupPinned) return;
    popupHideTimer = setTimeout(() => hidePopup(false), 150);
  });

  function hidePopup(unpin) {
    if (unpin) popupPinned = false;
    refPopup.classList.add("hidden");
    refPopup.classList.remove("missing", "pinned");
    popupTarget = null;
  }

  function showPopupForRef(el, pinned) {
    const ref = {
      kind: el.dataset.kind, docId: el.dataset.docId || null,
      articleNumber: el.dataset.article || null,
      clause: el.dataset.clause || null,
      point: el.dataset.point || null,
      raw: el.dataset.raw || el.textContent
    };
    const resolved = resolveReference(ref, currentDoc);
    let sourceLabel = "", title = "", body = "", metaLeft = "", canOpenDoc = false, openDocId = null;
    let citation = ref.raw;

    if (!resolved.found) {
      refPopup.classList.add("missing");
      const sameDocArticle = ref.kind === "article" && (!ref.docId || (currentDoc && ref.docId === currentDoc.id));
      if (sameDocArticle && currentDoc) {
        sourceLabel = `${currentDoc.type} ${currentDoc.number}`;
        const parts = [`Điều ${ref.articleNumber}`];
        if (ref.clause) parts.push(`khoản ${ref.clause}`);
        if (ref.point) parts.push(`điểm ${ref.point}`);
        title = parts.join(", ");
        body = `Nội dung Điều ${ref.articleNumber} của ${currentDoc.shortTitle} chưa được tải đầy đủ vào CSDL nội bộ. Tham khảo bản gốc tại nguồn để xem nội dung chi tiết.`;
        metaLeft = currentDoc.shortTitle;
        citation = `Điều ${ref.articleNumber} ${currentDoc.type} ${currentDoc.number}`;
      } else {
        sourceLabel = "Tham chiếu";
        title = ref.raw;
        body = "Văn bản hoặc điều khoản này chưa có trong CSDL nội bộ. Vui lòng tra cứu trên vbpl.vn hoặc vanban.chinhphu.vn.";
        metaLeft = "Chưa có dữ liệu";
      }
    } else {
      refPopup.classList.remove("missing");
      const tdoc = resolved.doc;
      sourceLabel = `${tdoc.type} ${tdoc.number}`;
      canOpenDoc = true; openDocId = tdoc.id;
      if (ref.kind === "article" && resolved.article) {
        const art = resolved.article;
        title = `${art.number}. ${art.heading}`;
        body = formatArticleExcerpt(art, ref);
        const parts = [tdoc.shortTitle];
        if (ref.clause) parts.push(`Khoản ${ref.clause}`);
        if (ref.point) parts.push(`Điểm ${ref.point}`);
        metaLeft = parts.join(" · ");
        citation = `${art.number} ${tdoc.type} ${tdoc.number}`;
      } else {
        title = tdoc.title;
        body = `${tdoc.shortTitle} — ${tdoc.issuer}.\nBan hành: ${formatDate(tdoc.issuedDate)} · Hiệu lực: ${formatDate(tdoc.effectiveDate)}\nTình trạng: ${tdoc.status}`;
        metaLeft = tdoc.shortTitle;
        citation = `${tdoc.type} ${tdoc.number} — ${tdoc.shortTitle}`;
      }
    }

    refPopup.classList.toggle("pinned", !!pinned);
    refPopup.innerHTML = `
      <div class="pop-head">
        <div class="pop-source">${escapeHtml(sourceLabel)}</div>
        <div class="pop-actions">
          <button class="pop-icon-btn ${pinned ? "on" : ""}" data-action="pin" title="${pinned ? "Bỏ ghim" : "Ghim popup"}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14V9a3 3 0 0 0-3-3h-1V2H9v4H8a3 3 0 0 0-3 3v8z"/></svg>
          </button>
          <button class="pop-icon-btn" data-action="copy" title="Chép trích dẫn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          </button>
          <button class="pop-icon-btn" data-action="close" title="Đóng">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="pop-title">${escapeHtml(title)}</div>
      <div class="pop-body">${escapeHtml(body)}</div>
      <div class="pop-meta">
        <span>${escapeHtml(metaLeft)}</span>
        ${canOpenDoc ? `<button class="pop-link" data-open="${escapeHtml(openDocId)}" data-anchor="${ref.kind === "article" && resolved.article ? "art-" + ref.articleNumber : ""}">Mở văn bản →</button>` : ""}
      </div>
    `;
    refPopup.classList.remove("hidden");
    positionPopup(el);

    refPopup.querySelector('[data-action="pin"]').addEventListener("click", (e) => {
      e.stopPropagation();
      popupPinned = !popupPinned;
      showPopupForRef(el, popupPinned);
    });
    refPopup.querySelector('[data-action="copy"]').addEventListener("click", (e) => {
      e.stopPropagation();
      copyText(citation);
      showToast("Đã chép trích dẫn");
    });
    refPopup.querySelector('[data-action="close"]').addEventListener("click", (e) => {
      e.stopPropagation();
      hidePopup(true);
    });
    const openBtn = refPopup.querySelector("[data-open]");
    if (openBtn) {
      openBtn.addEventListener("click", () => {
        const id = openBtn.dataset.open;
        const anchor = openBtn.dataset.anchor;
        hidePopup(true);
        openDoc(id);
        if (anchor) {
          setTimeout(() => {
            const el = document.getElementById(anchor);
            if (el) {
              el.scrollIntoView({ behavior: "smooth", block: "start" });
              el.classList.remove("flash");
              void el.offsetWidth;
              el.classList.add("flash");
            }
          }, 100);
        }
      });
    }
  }

  function formatArticleExcerpt(article, ref) {
    if (ref.clause) {
      const lines = article.body.split(/\r?\n/);
      const matchIdx = lines.findIndex(l => new RegExp("^" + ref.clause + "\\.").test(l.trim()));
      if (matchIdx >= 0) {
        const buf = [lines[matchIdx]];
        for (let i = matchIdx + 1; i < lines.length; i++) {
          if (/^\d+\./.test(lines[i].trim())) break;
          buf.push(lines[i]);
        }
        let excerpt = buf.join("\n").trim();
        if (ref.point) {
          const m = excerpt.match(new RegExp("(^|\\n)\\s*" + ref.point + "\\)[^\\n]*", "i"));
          if (m) return m[0].trim();
        }
        return excerpt;
      }
    }
    const text = article.body.replace(/\s+/g, " ").trim();
    return text.length > 480 ? text.slice(0, 480) + "…" : text;
  }

  function positionPopup(anchorEl) {
    const r = anchorEl.getBoundingClientRect();
    const pr = refPopup.getBoundingClientRect();
    const margin = 8;
    let top = r.bottom + margin;
    let left = r.left;
    if (left + pr.width + margin > window.innerWidth)
      left = Math.max(margin, window.innerWidth - pr.width - margin);
    if (top + pr.height + margin > window.innerHeight) {
      top = r.top - pr.height - margin;
      if (top < margin) top = margin;
    }
    refPopup.style.top = top + "px";
    refPopup.style.left = left + "px";
  }

  // ===== Scroll =====
  let scrollTicking = false;
  window.addEventListener("scroll", () => {
    if (!scrollTicking) { requestAnimationFrame(handleScroll); scrollTicking = true; }
  }, { passive: true });

  function handleScroll() {
    scrollTicking = false;
    const top = window.scrollY;
    backTop.classList.toggle("visible", top > 600);

    if (scrollSpyArticles.length && isTabActive("toanvan")) {
      const probe = top + 160;
      let active = scrollSpyArticles[0];
      for (const a of scrollSpyArticles) {
        if (a.el.getBoundingClientRect().top + window.scrollY <= probe) active = a;
        else break;
      }
      $$("a.article.active", tocEl).forEach(a => a.classList.remove("active"));
      if (active.link) active.link.classList.add("active");
    }

    if (!popupPinned) hidePopup(false);
  }

  backTop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  // ===== Walk text nodes =====
  function walkTextNodes(root, fn) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(n) {
        if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        const p = n.parentNode;
        if (p && p.classList && (p.classList.contains("legal-ref") || p.classList.contains("anchor-link"))) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = []; let node;
    while ((node = walker.nextNode())) nodes.push(node);
    nodes.forEach(fn);
  }

  // ===== Boot =====
  const utilDate = $("#util-date");
  if (utilDate) utilDate.textContent = formatDate(new Date().toISOString().slice(0, 10));
  const utilStatus = $("#util-status");
  if (utilStatus) utilStatus.textContent = `Đã kết nối · ${formatDate(new Date().toISOString().slice(0, 10))}`;

  renderLandingContent();
})();
