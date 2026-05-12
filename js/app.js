(function () {
  "use strict";

  const DB = window.LEGAL_DB;
  const H = window.LEGAL_DB_HELPERS;

  // Vietnamese point-letters used in legal docs ("a) b) c) đ) e) ...").
  // Declared early so any function that uses it via closure can resolve
  // it the moment the IIFE begins evaluating function bodies on demand.
  const VN_LETTER = "a-zđêôơư";

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
  const docBody = $("#doc-body");
  const tocEl = $("#toc");
  const tocCount = $("#toc-count");
  const relatedDocsEl = $("#related-docs");
  const relatedCount = $("#related-count");
  const luocdoEl = $("#luocdo");
  const luocdoBadge = $("#luocdo-badge");
  const sodoEl = $("#sodo");
  const sodoBadge = $("#sodo-badge");
  const hethongEl = $("#hethong");
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
  let readSize = parseFloat(localStorage.getItem("vbpl.readSize")) || 12;
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

  // Vietnamese-legal-term reaccent dictionary. Placeholder doc titles come
  // from URL slugs which had all diacritics stripped, so a row reads
  // "Ve to chuc hoat dong cua to chuc tin dung" instead of the proper
  // "Về tổ chức hoạt động của tổ chức tín dụng". Match longest phrase
  // first so multi-word terms beat their constituent words.
  const REACCENT = [
    // Multi-word phrases (most specific first)
    ["to chuc tin dung", "tổ chức tín dụng"],
    ["chi nhanh ngan hang nuoc ngoai", "chi nhánh ngân hàng nước ngoài"],
    ["van phong dai dien", "văn phòng đại diện"],
    ["ngan hang thuong mai", "ngân hàng thương mại"],
    ["ngan hang nha nuoc", "Ngân hàng Nhà nước"],
    ["ngan hang lien doanh", "ngân hàng liên doanh"],
    ["ngan hang chinh sach", "ngân hàng chính sách"],
    ["ngan hang hop tac xa", "ngân hàng hợp tác xã"],
    ["bao hiem tien gui", "bảo hiểm tiền gửi"],
    ["bao hiem xa hoi", "bảo hiểm xã hội"],
    ["bao hiem y te", "bảo hiểm y tế"],
    ["vi pham hanh chinh", "vi phạm hành chính"],
    ["xu phat vi pham", "xử phạt vi phạm"],
    ["xu ly vi pham", "xử lý vi phạm"],
    ["tien te va hoat dong", "tiền tệ và hoạt động"],
    ["cong ty tai chinh", "công ty tài chính"],
    ["cong ty cho thue tai chinh", "công ty cho thuê tài chính"],
    ["cong ty co phan", "công ty cổ phần"],
    ["cong ty quan ly tai san", "công ty quản lý tài sản"],
    ["bat dong san", "bất động sản"],
    ["du lieu ca nhan", "dữ liệu cá nhân"],
    ["bao ve du lieu", "bảo vệ dữ liệu"],
    ["dien mat troi", "điện mặt trời"],
    ["dien gio", "điện gió"],
    ["nang luong tai tao", "năng lượng tái tạo"],
    ["nang luong tiet kiem", "năng lượng tiết kiệm"],
    ["mua ban dien", "mua bán điện"],
    ["mai nha", "mái nhà"],
    ["tu san xuat", "tự sản xuất"],
    ["tu tieu thu", "tự tiêu thụ"],
    ["du phong rui ro", "dự phòng rủi ro"],
    ["xu ly rui ro", "xử lý rủi ro"],
    ["phan loai no", "phân loại nợ"],
    ["no xau", "nợ xấu"],
    ["tai san bao dam", "tài sản bảo đảm"],
    ["khoan no", "khoản nợ"],
    ["ty le an toan", "tỷ lệ an toàn"],
    ["bao dam an toan", "bảo đảm an toàn"],
    ["muc von phap dinh", "mức vốn pháp định"],
    ["von phap dinh", "vốn pháp định"],
    ["von dieu le", "vốn điều lệ"],
    ["chuyen nhuong co phan", "chuyển nhượng cổ phần"],
    ["co phan", "cổ phần"],
    ["dau tu cong", "đầu tư công"],
    ["dau tu phap luat", "đầu tư pháp luật"],
    ["doi tac cong tu", "đối tác công tư"],
    ["phuong thuc", "phương thức"],
    ["dau tu", "đầu tư"],
    ["chung khoan", "chứng khoán"],
    ["trai phieu", "trái phiếu"],
    ["chao ban", "chào bán"],
    ["phat hanh", "phát hành"],
    ["niem yet", "niêm yết"],
    ["thi truong", "thị trường"],
    ["phong chong rua tien", "phòng, chống rửa tiền"],
    ["phong chong tham nhung", "phòng, chống tham nhũng"],
    ["rua tien", "rửa tiền"],
    ["tham nhung", "tham nhũng"],
    ["pha san", "phá sản"],
    ["sua doi bo sung", "sửa đổi, bổ sung"],
    ["sua doi", "sửa đổi"],
    ["bo sung", "bổ sung"],
    ["bai bo", "bãi bỏ"],
    ["thi hanh", "thi hành"],
    ["thay the", "thay thế"],
    ["mot so dieu", "một số điều"],
    ["mot so", "một số"],
    ["quy dinh chi tiet", "quy định chi tiết"],
    ["quy dinh", "quy định"],
    ["huong dan", "hướng dẫn"],
    ["co quan", "cơ quan"],
    ["dieu chinh", "điều chỉnh"],
    ["dieu kien", "điều kiện"],
    ["dieu le", "điều lệ"],
    ["thu tuc", "thủ tục"],
    ["chinh sach", "chính sách"],
    ["co che", "cơ chế"],
    ["khuyen khich", "khuyến khích"],
    ["phat trien", "phát triển"],
    ["bao ve", "bảo vệ"],
    ["bao dam", "bảo đảm"],
    ["bao gom", "bao gồm"],
    ["thanh lap", "thành lập"],
    ["hoat dong", "hoạt động"],
    ["to chuc", "tổ chức"],
    ["lien quan", "liên quan"],
    ["nuoc ngoai", "nước ngoài"],
    ["van phong", "văn phòng"],
    ["dai dien", "đại diện"],
    ["tin dung", "tín dụng"],
    ["tien te", "tiền tệ"],
    ["ngan hang", "ngân hàng"],
    ["tai chinh", "tài chính"],
    ["tai san", "tài sản"],
    ["chi nhanh", "chi nhánh"],
    ["lien doanh", "liên doanh"],
    ["doanh nghiep", "doanh nghiệp"],
    ["thuong mai", "thương mại"],
    ["dien luc", "điện lực"],
    ["nang luong", "năng lượng"],
    ["tai tao", "tái tạo"],
    ["tiet kiem", "tiết kiệm"],
    ["hieu qua", "hiệu quả"],
    ["su dung", "sử dụng"],
    ["mua ban", "mua bán"],
    ["cho vay", "cho vay"],
    ["tieu dung", "tiêu dùng"],
    ["bao lanh", "bảo lãnh"],
    ["thanh toan", "thanh toán"],
    ["luu ky", "lưu ký"],
    ["bu tru", "bù trừ"],
    ["dang ky", "đăng ký"],
    ["kinh doanh", "kinh doanh"],
    ["lao dong", "lao động"],
    ["luat su", "luật sư"],
    ["cu tru", "cư trú"],
    ["cong an", "công an"],
    ["nhan dan", "nhân dân"],
    ["quoc hoi", "Quốc hội"],
    ["chinh phu", "Chính phủ"],
    ["bo truong", "Bộ trưởng"],
    ["tham quyen", "thẩm quyền"],
    ["hop tac xa", "hợp tác xã"],
    ["xay dung", "xây dựng"],
    ["quy hoach", "quy hoạch"],
    ["thuy loi", "thủy lợi"],
    ["duong sat", "đường sắt"],
    ["dat dai", "đất đai"],
    ["nha o", "nhà ở"],
    ["thue", "thuế"],
    ["hinh su", "hình sự"],
    ["dan su", "dân sự"],
    ["to tung", "tố tụng"],
    ["hanh chinh", "hành chính"],
    ["hinh thuc", "hình thức"],
    ["xu phat", "xử phạt"],
    ["xu ly", "xử lý"],
    ["dac biet", "đặc biệt"],
    ["kiem soat", "kiểm soát"],
    ["thanh tra", "thanh tra"],
    ["kiem toan", "kiểm toán"],
    ["ke toan", "kế toán"],
    ["quan ly", "quản lý"],
    ["dieu hanh", "điều hành"],
    ["thong tin", "thông tin"],
    ["bao cao", "báo cáo"],
    ["nguoi tieu dung", "người tiêu dùng"],
    ["nguoi su dung", "người sử dụng"],
    ["khach hang", "khách hàng"],
    ["da hieu luc", "đã hiệu lực"],
    ["het hieu luc", "hết hiệu lực"],
    ["co hieu luc", "có hiệu lực"],
    ["viet nam", "Việt Nam"],
    ["tai", "tại"],
    ["cua", "của"],
    ["va", "và"],
    ["voi", "với"],
    ["ve", "về"],
    ["tu", "từ"],
    ["den", "đến"],
    ["theo", "theo"],
    ["mot", "một"],
    ["dieu", "điều"],
    ["khoan", "khoản"],
    ["diem", "điểm"],
    ["chuong", "chương"],
    ["phan", "phần"],
    ["luat", "luật"],
    ["nghi dinh", "nghị định"],
    ["thong tu", "thông tư"],
    ["bo luat", "bộ luật"],
    ["nghi quyet", "nghị quyết"],
    ["phu luc", "phụ lục"],
    // Round 2 — terms still missing after first pass
    ["linh vuc", "lĩnh vực"],
    ["xuat khau", "xuất khẩu"],
    ["nhap khau", "nhập khẩu"],
    ["bao hiem", "bảo hiểm"],
    ["bao mat", "bảo mật"],
    ["bao tro", "bảo trợ"],
    ["bao tang", "bảo tàng"],
    ["bao tin", "bảo tin"],
    ["von", "vốn"],
    ["co dong", "cổ đông"],
    ["co ban", "cơ bản"],
    ["co cau", "cơ cấu"],
    ["co quan", "cơ quan"],
    ["co so", "cơ sở"],
    ["dau dau", "đầu"],
    ["thu tu", "thứ tự"],
    ["co quan dieu tra", "cơ quan điều tra"],
    ["dieu tra", "điều tra"],
    ["xet xu", "xét xử"],
    ["thi hanh an", "thi hành án"],
    ["thanh nien", "thanh niên"],
    ["nguoi cao tuoi", "người cao tuổi"],
    ["nguoi co cong", "người có công"],
    ["binh dang gioi", "bình đẳng giới"],
    ["bao luc gia dinh", "bạo lực gia đình"],
    ["hon nhan", "hôn nhân"],
    ["gia dinh", "gia đình"],
    ["tre em", "trẻ em"],
    ["nhan dao", "nhân đạo"],
    ["xa hoi", "xã hội"],
    ["van hoa", "văn hóa"],
    ["du lich", "du lịch"],
    ["the thao", "thể thao"],
    ["bao chi", "báo chí"],
    ["xuat ban", "xuất bản"],
    ["thong tin truyen thong", "thông tin truyền thông"],
    ["khoa hoc cong nghe", "khoa học công nghệ"],
    ["khoa hoc", "khoa học"],
    ["cong nghe", "công nghệ"],
    ["so huu tri tue", "sở hữu trí tuệ"],
    ["chuyen giao", "chuyển giao"],
    ["sang che", "sáng chế"],
    ["nhan hieu", "nhãn hiệu"],
    ["thuong hieu", "thương hiệu"],
    ["bao mat thong tin", "bảo mật thông tin"],
    ["an toan thong tin", "an toàn thông tin"],
    ["an ninh mang", "an ninh mạng"],
    ["thuong mai dien tu", "thương mại điện tử"],
    ["giao dich dien tu", "giao dịch điện tử"],
    ["khong mat", "không mất"],
    ["mat khau", "mật khẩu"],
    ["du an", "dự án"],
    ["dau thau", "đấu thầu"],
    ["dau gia", "đấu giá"],
    ["mua sam cong", "mua sắm công"],
    ["ngan sach", "ngân sách"],
    ["ngan sach nha nuoc", "ngân sách nhà nước"],
    ["thu chi", "thu chi"],
    ["chi tieu", "chi tiêu"],
    ["nguoi ky", "người ký"],
    ["nguoi nhan", "người nhận"],
    ["nguoi gui", "người gửi"],
    ["nguoi dai dien", "người đại diện"],
    ["nguoi co quyen", "người có quyền"],
    ["nguoi quan ly", "người quản lý"],
    ["nguoi", "người"],
    ["co ke hoach", "có kế hoạch"],
    ["ke hoach", "kế hoạch"],
    ["chinh thuc", "chính thức"],
    ["chinh phu", "Chính phủ"],
    ["chinh quyen", "chính quyền"],
    ["dia phuong", "địa phương"],
    ["trung uong", "trung ương"],
    ["nhan dan", "nhân dân"],
    ["doan", "đoàn"],
    ["hoi dong", "hội đồng"],
    ["thanh vien", "thành viên"],
    ["chu tich", "chủ tịch"],
    ["pho chu tich", "phó chủ tịch"],
    ["uy ban", "ủy ban"],
    ["bo nganh", "bộ ngành"],
    ["bo", "bộ"],
    ["tinh", "tỉnh"],
    ["thanh pho", "thành phố"],
    ["huyen", "huyện"],
    ["xa", "xã"],
    ["phuong", "phường"],
    ["thi tran", "thị trấn"],
    ["khu vuc", "khu vực"],
    ["khu cong nghiep", "khu công nghiệp"],
    ["khu kinh te", "khu kinh tế"],
    ["khu che xuat", "khu chế xuất"],
    ["doanh thu", "doanh thu"],
    ["loi nhuan", "lợi nhuận"],
    ["chi phi", "chi phí"],
    ["gia tri", "giá trị"],
    ["gia tri gia tang", "giá trị gia tăng"],
    ["thu nhap", "thu nhập"],
    ["thu nhap ca nhan", "thu nhập cá nhân"],
    ["thu nhap doanh nghiep", "thu nhập doanh nghiệp"],
    ["tieu thu", "tiêu thụ"],
    ["dac biet", "đặc biệt"],
    ["mon", "môn"],
    ["thi", "thi"],
    ["bang", "bằng"],
    ["chung chi", "chứng chỉ"],
    ["chung nhan", "chứng nhận"],
    ["the", "thẻ"],
    ["the can cuoc", "thẻ căn cước"],
    ["can cuoc cong dan", "căn cước công dân"],
    ["ho chieu", "hộ chiếu"],
    ["visa", "visa"],
    ["nhap canh", "nhập cảnh"],
    ["xuat canh", "xuất cảnh"],
    ["qua canh", "quá cảnh"],
    ["cu tru", "cư trú"],
    ["thuong tru", "thường trú"],
    ["tam tru", "tạm trú"],
    ["khai sinh", "khai sinh"],
    ["khai tu", "khai tử"],
    ["ket hon", "kết hôn"],
    ["ly hon", "ly hôn"],
    ["nuoi con nuoi", "nuôi con nuôi"],
    ["giam ho", "giám hộ"],
    ["di chuc", "di chúc"],
    ["tha ke", "thừa kế"],
    ["thua ke", "thừa kế"],
    ["dat dai", "đất đai"],
    ["nha o xa hoi", "nhà ở xã hội"],
    ["nha tap the", "nhà tập thể"],
    ["chung cu", "chung cư"],
    ["dat trong cay", "đất trồng cây"],
    ["dat trong lua", "đất trồng lúa"],
    ["dat o", "đất ở"],
    ["dat thuong mai", "đất thương mại"],
    ["dat cong", "đất công"],
    ["dat nong nghiep", "đất nông nghiệp"],
    ["dat lam nghiep", "đất lâm nghiệp"],
    ["khoang san", "khoáng sản"],
    ["dau khi", "dầu khí"],
    ["khi dot", "khí đốt"],
    ["khi tu nhien", "khí tự nhiên"],
    ["nuoc sach", "nước sạch"],
    ["nuoc thai", "nước thải"],
    ["chat thai", "chất thải"],
    ["o nhiem", "ô nhiễm"],
    ["moi truong", "môi trường"],
    ["bao ve moi truong", "bảo vệ môi trường"],
    ["da dang sinh hoc", "đa dạng sinh học"],
    ["sinh hoc", "sinh học"],
    ["rung", "rừng"],
    ["bien", "biển"],
    ["dao", "đảo"],
    ["bien dao", "biển đảo"],
    ["thuy san", "thủy sản"],
    ["nong nghiep", "nông nghiệp"],
    ["lam nghiep", "lâm nghiệp"],
    ["chan nuoi", "chăn nuôi"],
    ["trong trot", "trồng trọt"],
    ["thuy loi nho", "thủy lợi nhỏ"],
    ["nuoc sinh hoat", "nước sinh hoạt"],
    ["mua ban dien truc tiep", "mua bán điện trực tiếp"],
    ["truc tiep", "trực tiếp"],
    ["gian tiep", "gián tiếp"],
    ["su kien", "sự kiện"],
    ["su co", "sự cố"],
    ["thien tai", "thiên tai"],
    ["dich benh", "dịch bệnh"],
    ["phong chong", "phòng, chống"],
    ["khan cap", "khẩn cấp"],
    ["du phong", "dự phòng"],
    ["lap du phong", "lập dự phòng"],
    ["trich lap", "trích lập"],
    ["phuong phap trich", "phương pháp trích"],
    ["hach toan", "hạch toán"],
    ["tai chinh ke toan", "tài chính kế toán"],
    ["bang can doi ke toan", "bảng cân đối kế toán"],
    ["bao cao tai chinh", "báo cáo tài chính"],
    ["chinh sach tien te", "chính sách tiền tệ"],
    ["lai suat", "lãi suất"],
    ["ty gia", "tỷ giá"],
    ["dong viet nam", "đồng Việt Nam"],
    ["ngoai te", "ngoại tệ"],
    ["vay", "vay"],
    ["cho vay ngan han", "cho vay ngắn hạn"],
    ["cho vay trung han", "cho vay trung hạn"],
    ["cho vay dai han", "cho vay dài hạn"],
    ["nguon von", "nguồn vốn"],
    ["nguon", "nguồn"],
    ["su dung von", "sử dụng vốn"],
    ["dieu hoa von", "điều hòa vốn"],
    ["thanh khoan", "thanh khoản"],
    ["cap tin dung", "cấp tín dụng"],
    ["bao mat", "bảo mật"],
    ["bao kê", "bảo kê"],
    ["mua co phan", "mua cổ phần"],
    ["ban co phan", "bán cổ phần"],
    ["co phieu", "cổ phiếu"],
    ["chung quyen", "chứng quyền"],
    ["chung chi quy", "chứng chỉ quỹ"],
    ["quy dau tu", "quỹ đầu tư"],
    ["quy", "quỹ"],
    ["hop nhat", "hợp nhất"],
    ["sap nhap", "sáp nhập"],
    ["chia tach", "chia tách"],
    ["thanh ly", "thanh lý"],
    ["giai the", "giải thể"],
    ["chung khoan ho phai sinh", "chứng khoán phái sinh"],
    ["phai sinh", "phái sinh"],
    ["chinh chu", "chính chủ"],
    ["doanh thu thuan", "doanh thu thuần"],
    ["thuan", "thuần"],
    ["co cau lai", "cơ cấu lại"],
    ["tai co cau", "tái cơ cấu"],
    ["nhan vien", "nhân viên"],
    ["can bo", "cán bộ"],
    ["cong chuc", "công chức"],
    ["vien chuc", "viên chức"],
    ["nguoi lao dong", "người lao động"],
    ["nguoi su dung lao dong", "người sử dụng lao động"],
    ["tien luong", "tiền lương"],
    ["luong", "lương"],
    ["thuong", "thưởng"],
    ["nghi phep", "nghỉ phép"],
    ["nghi om", "nghỉ ốm"],
    ["thai san", "thai sản"],
    ["bao hiem that nghiep", "bảo hiểm thất nghiệp"],
    ["that nghiep", "thất nghiệp"],
    ["tro cap", "trợ cấp"],
    ["huu tri", "hưu trí"],
    ["mau", "mẫu"],
  ];
  // Compile each entry to a regex with word boundaries (case-insensitive,
  // Unicode-aware) for safe in-place replacement. Sorted longest-first so
  // multi-word phrases win over their components.
  const REACCENT_RULES = REACCENT
    .slice()
    .sort((a, b) => b[0].length - a[0].length)
    .map(([from, to]) => ({
      re: new RegExp("(?<![\\p{L}\\p{N}])" + from.replace(/\s+/g, "\\s+") + "(?![\\p{L}\\p{N}])", "giu"),
      to,
    }));

  function reaccentVietnamese(text) {
    let s = text;
    for (const { re, to } of REACCENT_RULES) s = s.replace(re, to);
    return s;
  }

  // Subtitle for the Lược đồ row's lower line. Hand-curated docs have a
  // meaningful shortTitle (e.g. "Luật Các TCTD 2024", "BLHS 2015") — keep
  // those verbatim. Auto-discovered placeholder docs default their
  // shortTitle to "${type} ${id}" (just repeating the number); for those we
  // pull the descriptive part out of the longer auto-generated title,
  // strip the slug-junk prefix/suffix, and run a Vietnamese reaccent dict
  // over it so common legal phrases recover their diacritics.
  function getRowSubtitle(d) {
    const placeholderShort = `${d.type} ${d.number}`;
    if (d.shortTitle && d.shortTitle !== placeholderShort) return d.shortTitle;
    let s = (d.title || "").trim();
    const typeRe = new RegExp("^" + d.type.replace(/[.+?^${}()|[\]\\]/g, "\\$&") + "\\s+", "i");
    s = s.replace(typeRe, "");
    // Strip a leading "So 13 1999 nd cp" / "So 32 2024 qh15" tail
    s = s.replace(/^so\s+\d+\s+\d+\s+[a-z][a-z0-9-]+(?:\s+[a-z][a-z0-9-]+)?\s+/i, "");
    // Strip trailing ItemID (4+ digits)
    s = s.replace(/\s+\d{4,}\s*$/, "");
    s = s.trim();
    if (!s) return placeholderShort;
    s = reaccentVietnamese(s);
    return s.charAt(0).toUpperCase() + s.slice(1);
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
    li.addEventListener("mousedown", (e) => { e.preventDefault(); showDocPreview(item.id); });
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

  if (searchInput && suggestions) wireSearch(searchInput, suggestions, showDocPreview);
  wireSearch(sideSearchInput, sideSuggestions, (id) => {
    showDocPreview(id);
    sideSearchInput.value = "";
    sideSuggestions.innerHTML = "";
  });

  if (searchDo) searchDo.addEventListener("click", () => {
    const top = suggest(searchInput.value)[0];
    if (top) showDocPreview(top.id);
    else if (searchInput.value.trim()) showToast("Không tìm thấy văn bản phù hợp");
    else searchInput.focus();
  });

  if (searchClear) searchClear.addEventListener("click", () => {
    searchInput.value = "";
    searchClear.classList.remove("visible");
    suggestions.innerHTML = "";
    searchInput.focus();
  });

  document.addEventListener("click", (e) => {
    if (suggestions && !e.target.closest(".search-wrap") && !e.target.closest(".header-search")) suggestions.innerHTML = "";
    if (!e.target.closest(".side-search")) sideSuggestions.innerHTML = "";
  });

  document.addEventListener("keydown", (e) => {
    const tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (e.key === "/" && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      if (!viewer.classList.contains("hidden")) sideSearchInput.focus();
      else if (searchInput) { searchInput.focus(); searchInput.scrollIntoView({ behavior: "smooth", block: "center" }); }
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
      else if (prev.type === "preview") showDocPreview(prev.docId);
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
  if (navSearch) navSearch.addEventListener("click", (e) => { e.preventDefault(); goHome(); if (searchInput) setTimeout(() => searchInput.focus(), 100); });
  if (backHome) backHome.addEventListener("click", (e) => { e.preventDefault(); goHome(); });
  if (bcHome) bcHome.addEventListener("click", (e) => { e.preventDefault(); goHome(); });
  if (ctaSearchBtn) ctaSearchBtn.addEventListener("click", () => searchInput && searchInput.focus());

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
      const f = item.dataset.field;
      // Special slots handled elsewhere: "__add" → modal trigger,
      // "user:..." → custom user field click handler in renderUserFieldsMenu.
      if (f === "__add" || (f && f.startsWith("user:"))) return;
      e.preventDefault();
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
      "du-lieu-ca-nhan": "Luật Bảo vệ dữ liệu cá nhân",
      "dien-luc": "Luật Điện lực",
      "khac": "Lĩnh vực khác"
    };
    const fieldMatchers = {
      "ngan-hang": /(tổ chức tín dụng|ngân hàng|tiền tệ|tín dụng|tài chính)/,
      "hinh-su": /(hình sự|tội phạm)/,
      "nang-luong": /(năng lượng|điện lực|điện gió|điện mặt trời|tái tạo|dppa|mua bán điện)/,
      "du-lieu-ca-nhan": /(dữ liệu cá nhân|bảo vệ dữ liệu|thông tin cá nhân|pdpd)/,
      "dien-luc": /(điện lực)/
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
      if (a.dataset.docId) showDocPreview(a.dataset.docId);
    });
  });

  function goHome() {
    _recordNav({ type: "home" });
    window.__spotlightDocId = null;
    setLuocdoOnlyMode(false);
    document.body.classList.remove("preview-mode");
    viewer.classList.add("hidden");
    landing.classList.remove("hidden");
    if (searchInput) searchInput.value = "";
    if (searchClear) searchClear.classList.remove("visible");
    if (suggestions) suggestions.innerHTML = "";
    if (navHome) navHome.classList.add("active");
    setCrumbs([{ label: "Trang chủ", action: goHome }, { label: "Tra cứu văn bản pháp luật", current: true }]);
    window.scrollTo({ top: 0, behavior: "smooth" });
    renderLandingContent();
  }

  // Re-populate the spotlight card with a given doc — used when the user
  // clicks a row in the Lược đồ Gantt: instead of opening the full Toàn-văn
  // viewer, take them back to a spotlight-card view of that doc.
  function showDocPreview(docId) {
    const doc = H.findDoc(docId);
    if (!doc) return;
    _recordNav({ type: "preview", docId });
    window.__spotlightDocId = docId;
    setLuocdoOnlyMode(false);
    document.body.classList.add("preview-mode");
    viewer.classList.add("hidden");
    landing.classList.remove("hidden");
    fillSpotlight(doc);
    renderLandingContent();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Update the spotlight card DOM (eyebrow, title, description, CTA targets)
  // for the given doc. Pure DOM mutation; doesn't change view state.
  function fillSpotlight(doc) {
    if (!doc) return;
    const card = $(".spotlight");
    if (card) {
      card.classList.remove("type-luat", "type-bo-luat", "type-nghidinh", "type-thongtu");
      if (doc.typeKey) card.classList.add("type-" + doc.typeKey);
    }
    const eyebrow = $("#sp-eyebrow");
    const title = $("#sp-title");
    const desc = $("#sp-desc");
    const ctaOpen = $("#sp-cta-open");
    const ctaLuocdo = $("#sp-cta-luocdo");
    const isFeatured = doc.id === "32/2024/QH15";
    if (eyebrow) eyebrow.textContent = isFeatured ? "Văn bản tâm điểm" : "Văn bản đã chọn";
    if (title) title.textContent = `${doc.title} ${doc.number ? "số " + doc.number : ""}`.trim();
    if (desc) {
      const eff = doc.effectiveDate ? formatDate(doc.effectiveDate) : null;
      const total = doc.articleTotal || (doc.chapters || []).reduce((s, ch) => s + ch.articles.length, 0);
      const status = doc.status || "";
      let parts = [];
      if (eff) parts.push(`Có hiệu lực từ ${eff}`);
      if (total) parts.push(`bao gồm ${total} điều`);
      let descText = parts.join(" — ");
      if (doc.shortTitle && doc.shortTitle !== doc.title) {
        descText += ". " + doc.shortTitle + ".";
      } else {
        descText += ".";
      }
      if (/Hết hiệu lực/i.test(status)) descText += ` Tình trạng: ${status}.`;
      if (/Dự thảo|Đang thảo luận/i.test(status)) descText = `Tình trạng: ${status}. ` + (doc.shortTitle || doc.title) + ".";
      desc.textContent = descText;
    }
    if (ctaOpen) ctaOpen.dataset.docId = doc.id;
    if (ctaLuocdo) ctaLuocdo.dataset.docId = doc.id;
    const ctaSodo = $("#sp-cta-sodo");
    if (ctaSodo) ctaSodo.dataset.docId = doc.id;
    const ctaHethong = $("#sp-cta-hethong");
    if (ctaHethong) ctaHethong.dataset.docId = doc.id;
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
    renderIndustries();
    renderNewdocs();
    renderExpired();
    renderHot();
  }

  // Industries / Lĩnh vực pháp lý — landing-page overview of every legal area
  // covered in the corpus. Each card carries a regex matcher for counting,
  // the canonical anchor doc id (the primary law for that area), and an SVG
  // icon. Clicking a card lands on the spotlight preview of that anchor doc.
  const INDUSTRIES = [
    {
      key: "ngan-hang", label: "Tài chính – Ngân hàng",
      anchor: "32/2024/QH15",
      typeKey: "luat",
      matcher: /(tổ chức tín dụng|ngân hàng|tiền tệ|tín dụng|tài chính|bảo hiểm tiền gửi|công ty tài chính|cho vay|trái phiếu|chứng khoán)/,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="5 6 12 3 19 6"/><line x1="6" y1="14" x2="6" y2="18"/><line x1="10" y1="14" x2="10" y2="18"/><line x1="14" y1="14" x2="14" y2="18"/><line x1="18" y1="14" x2="18" y2="18"/></svg>',
    },
    {
      key: "dien-luc", label: "Điện lực & Năng lượng",
      anchor: "61/2024/QH15",
      typeKey: "luat",
      matcher: /(năng lượng|điện lực|điện gió|điện mặt trời|tái tạo|dppa|mua bán điện|tiết kiệm)/,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    },
    {
      key: "du-lieu-ca-nhan", label: "Bảo vệ dữ liệu cá nhân",
      anchor: "13/2023/ND-CP",
      typeKey: "nghidinh",
      matcher: /(dữ liệu cá nhân|bảo vệ dữ liệu|thông tin cá nhân|pdpd)/,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
    },
    {
      key: "dat-dai", label: "Đất đai – Bất động sản",
      anchor: "31/2024/QH15",
      typeKey: "luat",
      matcher: /(đất đai|nhà ở|kinh doanh bất động sản|quy hoạch sử dụng đất)/,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
    },
    {
      key: "doanh-nghiep", label: "Doanh nghiệp – Đầu tư",
      anchor: "59/2020/QH14",
      typeKey: "luat",
      matcher: /(doanh nghiệp|đầu tư|cạnh tranh|công ty cổ phần|hợp tác xã)/,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>',
    },
    {
      key: "hinh-su", label: "Hình sự – Tố tụng hình sự",
      anchor: "100/2015/QH13",
      typeKey: "bo-luat",
      matcher: /(hình sự|tội phạm|tố tụng hình sự|công an nhân dân|phòng chống tham nhũng)/,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l9-4 9 4v6c0 5-3.5 9-9 11-5.5-2-9-6-9-11z"/></svg>',
    },
    {
      key: "dan-su", label: "Dân sự – Hợp đồng",
      anchor: "91/2015/QH13",
      typeKey: "bo-luat",
      matcher: /(dân sự|hợp đồng|tố tụng dân sự|trách nhiệm dân sự|bảo lãnh)/,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/></svg>',
    },
    {
      key: "chung-khoan", label: "Chứng khoán",
      anchor: "54/2019/QH14",
      typeKey: "luat",
      matcher: /(chứng khoán|cổ phiếu|trái phiếu doanh nghiệp|chứng chỉ quỹ|niêm yết)/,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="14 7 21 7 21 14"/></svg>',
    },
    {
      key: "pha-san", label: "Phá sản – Phục hồi",
      anchor: "51/2014/QH13",
      typeKey: "luat",
      matcher: /(phá sản|kiểm soát đặc biệt|phục hồi khả năng thanh toán)/,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13c0 4-4 8-9 8s-9-4-9-8a9 9 0 0 1 4-7"/><polyline points="3 6 7 2 11 6"/><line x1="7" y1="2" x2="7" y2="14"/></svg>',
    },
    {
      key: "pcrt", label: "Phòng chống rửa tiền",
      anchor: "14/2022/QH15",
      typeKey: "luat",
      matcher: /(rửa tiền|chống rửa tiền|báo cáo giao dịch đáng ngờ|aml)/,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
    },
    {
      key: "quy-hoach", label: "Quy hoạch – Xây dựng",
      anchor: "21/2017/QH14",
      typeKey: "luat",
      matcher: /(quy hoạch|xây dựng|đô thị|hạ tầng|đường sắt|thủy lợi)/,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l9-7 9 7v12"/><polyline points="9 21 9 13 15 13 15 21"/></svg>',
    },
    {
      key: "vphc", label: "Xử lý vi phạm hành chính",
      anchor: "15/2012/QH13",
      typeKey: "luat",
      matcher: /(vi phạm hành chính|xử phạt|xử lý vi phạm|thẩm quyền xử phạt)/,
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',
    },
  ];

  function renderIndustries() {
    const grid = $("#industry-grid");
    if (!grid) return;
    const docs = Object.values(DB);

    // Precompute outgoing-ref Sets per doc once — same trick as renderSodo —
    // so the per-industry "related docs" count is fast.
    const outgoingByDoc = new Map();
    for (const d of docs) {
      const refs = collectAllRefsInDoc(d);
      const set = new Set();
      for (const r of refs) if (r.docId) set.add(r.docId);
      outgoingByDoc.set(d.id, set);
    }

    function relatedCount(anchorId) {
      const anchor = H.findDoc(anchorId);
      if (!anchor) return 0;
      const related = new Set();
      // outgoing — anchor cites these
      for (const id of outgoingByDoc.get(anchor.id) || []) {
        if (id !== anchor.id) related.add(id);
      }
      // incoming — docs whose body cites the anchor
      for (const d of docs) {
        if (d.id === anchor.id) continue;
        if ((outgoingByDoc.get(d.id) || new Set()).has(anchor.id)) related.add(d.id);
      }
      // structural — replaces / replacedBy
      const aReplaces = Array.isArray(anchor.replaces) ? anchor.replaces : [];
      for (const id of aReplaces) if (id !== anchor.id) related.add(id);
      for (const d of docs) {
        if (d.id === anchor.id) continue;
        const dReplaces = Array.isArray(d.replaces) ? d.replaces : [];
        if (dReplaces.includes(anchor.id)) related.add(d.id);
      }
      return related.size;
    }

    const html = INDUSTRIES.map((ind) => {
      const count = relatedCount(ind.anchor);
      const anchor = H.findDoc(ind.anchor);
      const anchorTitle = anchor ? anchor.shortTitle : ind.anchor;
      return `
        <button class="industry-card type-${escapeHtml(ind.typeKey)}" data-anchor="${escapeHtml(ind.anchor)}" type="button">
          <span class="ind-icon">${ind.icon}</span>
          <div class="ind-body">
            <div class="ind-name">${escapeHtml(ind.label)}</div>
            <div class="ind-anchor">${escapeHtml(anchorTitle)}</div>
          </div>
          <div class="ind-count">
            <span class="ind-count-num">${count}</span>
            <span class="ind-count-lbl">liên quan</span>
          </div>
        </button>`;
    }).join("");
    grid.innerHTML = html;
    grid.querySelectorAll(".industry-card[data-anchor]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.anchor;
        if (H.findDoc(id)) showDocPreview(id);
      });
    });
  }

  function renderStats() {
    const docs = Object.values(DB);
    const counts = { Luật: 0, "Nghị định": 0, "Thông tư": 0, "Bộ luật": 0 };
    let bankingCount = 0, criminalCount = 0, energyCount = 0, pdpCount = 0, dienLucCount = 0;
    for (const d of docs) {
      if (counts[d.type] !== undefined) counts[d.type]++;
      const txt = (d.title + " " + d.shortTitle).toLowerCase();
      if (/(tổ chức tín dụng|ngân hàng|tiền tệ|tín dụng|tài chính)/.test(txt)) bankingCount++;
      if (/(hình sự|tội phạm)/.test(txt)) criminalCount++;
      if (/(năng lượng|điện lực|điện gió|điện mặt trời|tái tạo|dppa|mua bán điện)/.test(txt)) energyCount++;
      if (/(dữ liệu cá nhân|bảo vệ dữ liệu|thông tin cá nhân|pdpd)/.test(txt)) pdpCount++;
      if (/(điện lực)/.test(txt)) dienLucCount++;
    }

    const setText = (id, v) => { const el = $(id); if (el) el.textContent = v; };

    // === Spotlight: counts of docs RELATED to the featured doc ===
    // The currently-featured doc id is settable via showDocPreview().
    const SPOTLIGHT_ID = window.__spotlightDocId || "32/2024/QH15";
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
    setText("#tn-fc-pdp", pdpCount + " văn bản");
    setText("#tn-fc-dienluc", dienLucCount + " văn bản");

    // Update counts for any user-added fields too
    updateUserFieldCounts(docs);
  }

  // ===== User-added "Lĩnh vực" sectors =====
  // Persist a list of {key, label, anchorDocId, matcher} in localStorage so
  // the dropdown remembers fields added across visits. The anchor doc is also
  // stored to a queue file so the GitHub Action scraper picks it up next run.
  const USER_FIELDS_KEY = "vbpl.userFields";
  const SCRAPE_QUEUE_KEY = "vbpl.scrapeQueue";

  function loadUserFields() {
    try { return JSON.parse(localStorage.getItem(USER_FIELDS_KEY) || "[]"); }
    catch { return []; }
  }
  function saveUserFields(list) {
    try { localStorage.setItem(USER_FIELDS_KEY, JSON.stringify(list)); } catch {}
  }
  function loadScrapeQueue() {
    try { return JSON.parse(localStorage.getItem(SCRAPE_QUEUE_KEY) || "[]"); }
    catch { return []; }
  }
  function saveScrapeQueue(list) {
    try { localStorage.setItem(SCRAPE_QUEUE_KEY, JSON.stringify(list)); } catch {}
  }

  function updateUserFieldCounts(docs) {
    const fields = loadUserFields();
    for (const f of fields) {
      const cnt = docs.filter(d => d.id === f.anchorDocId).length;
      const el = document.getElementById("tn-fc-user-" + f.key);
      if (el) el.textContent = cnt + " văn bản (chờ tải toàn văn)";
    }
  }

  function renderUserFieldsMenu() {
    const wrap = $("#topnav-user-fields");
    if (!wrap) return;
    const fields = loadUserFields();
    if (!fields.length) { wrap.innerHTML = ""; return; }
    wrap.innerHTML = fields.map(f => `
      <a class="topnav-menu-item" data-field="user:${escapeHtml(f.key)}" role="menuitem">
        <span class="tn-ico r1"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></span>
        <span class="tn-text"><span class="tn-name">${escapeHtml(f.label)}</span><span class="tn-cnt" id="tn-fc-user-${escapeHtml(f.key)}">0 văn bản</span></span>
      </a>
    `).join("");
    // Wire click handlers for user fields
    wrap.querySelectorAll(".topnav-menu-item").forEach(item => {
      item.addEventListener("click", (e) => {
        e.preventDefault();
        const key = item.dataset.field.replace(/^user:/, "");
        const f = loadUserFields().find(x => x.key === key);
        if (!f) return;
        const topnavFieldsItem2 = $("#topnav-fields-btn")?.closest(".topnav-dropdown");
        if (topnavFieldsItem2) topnavFieldsItem2.classList.remove("open");
        // Open the anchor doc as a preview
        if (H.findDoc(f.anchorDocId)) {
          showDocPreview(f.anchorDocId);
          showToast(`Lĩnh vực "${f.label}" — đang xem ${f.anchorDocId}`);
        } else {
          showToast(`Lĩnh vực "${f.label}" đã được xếp hàng. Văn bản sẽ xuất hiện sau khi scraper chạy.`);
        }
      });
    });
  }

  // ===== "Thêm lĩnh vực mới" modal =====
  (function wireAddFieldModal() {
    const trigger = $("#topnav-add-field-btn");
    const modal = $("#add-field-modal");
    const form = $("#add-field-form");
    const closeBtn = $("#add-field-close");
    const cancelBtn = $("#add-field-cancel");
    if (!trigger || !modal || !form) return;

    function open() { modal.hidden = false; setTimeout(() => $("#af-field-name")?.focus(), 30); }
    function close() { modal.hidden = true; form.reset(); }

    trigger.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      // Close the dropdown
      const dd = trigger.closest(".topnav-dropdown");
      if (dd) dd.classList.remove("open");
      open();
    });
    closeBtn.addEventListener("click", close);
    cancelBtn.addEventListener("click", close);
    modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !modal.hidden) close(); });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const fieldName = $("#af-field-name").value.trim();
      const docNumber = $("#af-doc-number").value.trim();
      const docTitle = $("#af-doc-title").value.trim();
      const sourceUrl = $("#af-source-url").value.trim();
      if (!/^[0-9]+\/[0-9]+\/QH[0-9]+$/.test(docNumber)) {
        showToast("Số hiệu Luật phải có dạng NN/YYYY/QHXX (ví dụ 58/2014/QH13)");
        return;
      }
      if (H.findDoc(docNumber)) {
        showToast(`Văn bản ${docNumber} đã có trong CSDL. Hãy mở từ ô tìm kiếm.`);
        close();
        return;
      }
      const yearMatch = docNumber.match(/^[0-9]+\/([0-9]{4})\//);
      const year = yearMatch ? yearMatch[1] : null;
      // Add stub doc to in-memory DB (so search finds it immediately)
      const stub = {
        id: docNumber,
        type: "Luật",
        typeKey: "luat",
        number: docNumber,
        shortTitle: docTitle.length > 60 ? docTitle.slice(0, 57) + "…" : docTitle,
        title: docTitle,
        issuer: "Quốc hội",
        signedBy: null,
        issuedDate: year ? `${year}-01-01` : null,
        effectiveDate: null,
        status: "Chờ tải toàn văn",
        articleTotal: null,
        sourceUrl: sourceUrl || null,
        chapters: [{
          title: "TOÀN VĂN", subtitle: "",
          articles: [{
            id: "art-pending",
            number: "Toàn văn",
            heading: "Đang chờ scraper tải nội dung",
            body: `Văn bản này vừa được người dùng thêm vào CSDL nội bộ qua chức năng "Thêm lĩnh vực mới". Toàn văn và các văn bản liên quan sẽ được scraper (.github/workflows/scrape.yml) tải về trong lần chạy kế tiếp.\n\nSố hiệu: ${docNumber}\nTên: ${docTitle}\n${sourceUrl ? "Nguồn: " + sourceUrl : "Nguồn: scraper sẽ tìm trên vbpl.vn theo số hiệu."}`
          }]
        }]
      };
      window.LEGAL_DB[docNumber] = stub;

      // Persist user field
      const fields = loadUserFields();
      const key = "f-" + Date.now().toString(36);
      fields.push({ key, label: fieldName, anchorDocId: docNumber, createdAt: new Date().toISOString() });
      saveUserFields(fields);

      // Append to scraper queue
      const queue = loadScrapeQueue();
      queue.push({ docNumber, docTitle, sourceUrl: sourceUrl || null, queuedAt: new Date().toISOString() });
      saveScrapeQueue(queue);

      // Re-render menu + counts
      renderUserFieldsMenu();
      renderLandingContent();

      close();
      showToast(`Đã thêm "${fieldName}" và xếp ${docNumber} vào hàng đợi scraper.`);
    });

    // On boot, render any persisted user fields
    renderUserFieldsMenu();
  })();

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
      li.addEventListener("click", () => showDocPreview(li.dataset.docId));
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
      li.addEventListener("click", () => showDocPreview(li.dataset.docId));
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
      $$("li[data-doc-id]", hotListSide).forEach(li => li.addEventListener("click", () => showDocPreview(li.dataset.docId)));
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
    if (suggestions) suggestions.innerHTML = "";
    sideSuggestions.innerHTML = "";

    if (navHome) navHome.classList.remove("active");
    setCrumbs([
      { label: "Trang chủ", action: goHome },
      { label: doc.type, action: goHome },
      { label: doc.shortTitle, current: true }
    ]);

    renderTitlebar(doc);
    renderBody(doc);
    renderToc(doc);
    renderRelated(doc);
    renderLuocdo(doc);
    renderSodo(doc);
    renderHeThong(doc);
    renderHot(); // refresh side hot list
    activateTab(opts.tab || "toanvan");
    applyReadSettings();

    window.scrollTo({ top: 0 });
  }

  function renderTitlebar(doc) {
    const loaded = (doc.chapters || []).reduce((s, ch) => s + ch.articles.length, 0);
    const total = doc.articleTotal || loaded;
    const partial = loaded < total;
    const cls = statusClass(doc.status);
    const meta = [];
    meta.push(`<span class="dt-issuer">${escapeHtml(doc.issuer)}</span>`);
    if (doc.signedBy) meta.push(`Người ký <strong>${escapeHtml(doc.signedBy)}</strong>`);
    meta.push(`Ban hành <strong>${escapeHtml(formatDate(doc.issuedDate))}</strong>`);
    meta.push(`Hiệu lực <strong>${escapeHtml(formatDate(doc.effectiveDate))}</strong>`);
    meta.push(`<span class="dt-coverage ${partial ? "partial" : "full"}">${loaded}/${total} điều</span>`);

    docTitlebar.innerHTML = `
      <div class="dt-row1">
        <span class="type-pill">${escapeHtml(doc.type)} · ${escapeHtml(doc.number)}</span>
        <h1>${escapeHtml(doc.title)}</h1>
        <span class="status ${cls}">${escapeHtml(doc.status)}</span>
      </div>
      <div class="dt-row2">${meta.join('<span class="dt-sep">·</span>')}</div>
      ${partial && doc.sourceUrl ? `<a class="dt-source" href="${escapeHtml(doc.sourceUrl)}" target="_blank" rel="noopener">Mở bản gốc tại nguồn →</a>` : ""}
    `;
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
      li.addEventListener("click", () => showDocPreview(li.dataset.docId));
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
              <div class="lt-num" title="${escapeHtml(d.shortTitle || d.number)}">${escapeHtml(d.number)}</div>
              <div class="lt-title">${escapeHtml(getRowSubtitle(d))}</div>
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
        <span class="lt-legend-item"><span class="lt-swatch type-luat"></span>Luật / BL</span>
        <span class="lt-legend-item"><span class="lt-swatch type-nghidinh"></span>NĐ</span>
        <span class="lt-legend-item"><span class="lt-swatch type-thongtu"></span>TT</span>
        <span class="lt-legend-item"><span class="lt-swatch type-luat ring"></span>VB đang xem</span>
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
    // Row click behaviour
    //   - If we entered the Lược-đồ from the spotlight ("Lược đồ" CTA) —
    //   Per the UX spec, every doc click anywhere lands on the spotlight
    //   first (with the type-coloured background) so the user explicitly
    //   chooses to enter the viewer. Both luocdo-only and embedded-tab
    //   modes route the click through showDocPreview now.
    luocdoEl.querySelectorAll(".lt-row[data-doc-id]").forEach(row => {
      const id = row.dataset.docId;
      row.style.cursor = "pointer";
      row.addEventListener("click", (e) => {
        if (e.target.classList.contains("lt-splitter")) return;
        showDocPreview(id);
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

  // Sơ đồ — branching evolution tree. Walks the `replaces` graph upward
  // (ancestors) and downward (any other doc whose `replaces` includes this
  // one) to build a chronological tree. Edges are classified as replace /
  // amend / elevate based on the child doc's title and the tier change.
  function renderSodo(doc) {
    if (!sodoEl) return;

    // Build reverse maps: parentId → [child docs] for both replaces and amends.
    const replacedByMap = new Map();
    const amendedByMap = new Map();
    for (const other of Object.values(DB)) {
      for (const pid of (other.replaces || [])) {
        if (!replacedByMap.has(pid)) replacedByMap.set(pid, []);
        replacedByMap.get(pid).push(other);
      }
      for (const pid of (other.amends || [])) {
        if (!amendedByMap.has(pid)) amendedByMap.set(pid, []);
        amendedByMap.get(pid).push(other);
      }
    }

    const isLawTier = (tk) => tk === 'luat' || tk === 'bo-luat';
    const classifyReplace = (parentDoc, childDoc) => {
      if (!isLawTier(parentDoc.typeKey) && isLawTier(childDoc.typeKey)) return 'elevate';
      return 'replace';
    };

    const nodes = new Map(); // id → { doc, isCurrent }
    const edges = [];        // { from, to, type }
    const visited = new Set();
    (function visit(id) {
      if (visited.has(id)) return;
      visited.add(id);
      const d = H.findDoc(id);
      if (!d) return;
      nodes.set(id, { doc: d, isCurrent: id === doc.id });
      // Upward: this doc REPLACES some older docs (full replacement / consolidation)
      for (const pid of (d.replaces || [])) {
        const pd = H.findDoc(pid);
        if (pd) edges.push({ from: pid, to: id, type: classifyReplace(pd, d) });
        visit(pid);
      }
      // Upward: this doc AMENDS some older docs (in-place modification)
      for (const pid of (d.amends || [])) {
        const pd = H.findDoc(pid);
        if (pd) edges.push({ from: pid, to: id, type: 'amend' });
        visit(pid);
      }
      // Downward: docs that REPLACE this one
      for (const child of (replacedByMap.get(id) || [])) {
        edges.push({ from: id, to: child.id, type: classifyReplace(d, child) });
        visit(child.id);
      }
      // Downward: docs that AMEND this one
      for (const child of (amendedByMap.get(id) || [])) {
        edges.push({ from: id, to: child.id, type: 'amend' });
        visit(child.id);
      }
    })(doc.id);

    const seenEdges = new Set();
    const uniqEdges = edges.filter(e => {
      const k = `${e.from}:${e.to}`;
      if (seenEdges.has(k)) return false;
      seenEdges.add(k);
      return true;
    });

    if (sodoBadge) sodoBadge.textContent = nodes.size - 1;

    if (nodes.size <= 1) {
      sodoEl.innerHTML = `
        <h2>Cây tiến hóa — ${escapeHtml(doc.shortTitle)}</h2>
        <div class="ld-empty">
          Văn bản này hiện chưa có dữ liệu tiền nhiệm hoặc kế nhiệm.<br>
          Cây tiến hóa được dựng từ trường <code>replaces</code> trong CSDL — sẽ xuất hiện khi liên kết cấu trúc được bổ sung.
        </div>
      `;
      return;
    }

    // Sort nodes chronologically by issuedDate
    const nodeList = [...nodes.values()].sort((a, b) =>
      (a.doc.issuedDate || '9999').localeCompare(b.doc.issuedDate || '9999')
    );

    // Group by year
    const byYear = new Map();
    for (const n of nodeList) {
      const yr = (n.doc.issuedDate || '').slice(0, 4) || '?';
      if (!byYear.has(yr)) byYear.set(yr, []);
      byYear.get(yr).push(n);
    }
    const years = [...byYear.keys()].sort();

    // Layout dimensions
    const NODE_W = 200, NODE_H = 70;
    const Y_GAP = 130;
    const X_LEFT = 150, X_CENTER = 380, X_RIGHT = 610;
    const SVG_W = 760;
    const yearY = new Map();
    years.forEach((yr, i) => yearY.set(yr, 90 + i * Y_GAP));
    const SVG_H = years.length * Y_GAP + 90;

    // A doc is an "amendment branch" if it has any amends edge (incoming to it).
    const isAmendNode = new Map();
    for (const e of edges) {
      if (e.type === 'amend') isAmendNode.set(e.to, true);
    }

    // Assign columns: current → center; amendments → right; everyone else → center.
    // Resolve overlaps by spreading nodes at the same year across L/C/R.
    for (const n of nodeList) {
      const yr = (n.doc.issuedDate || '').slice(0, 4) || '?';
      n.y = yearY.get(yr);
      if (n.isCurrent) n.x = X_CENTER;
      else if (isAmendNode.get(n.doc.id)) n.x = X_RIGHT;
      else n.x = X_CENTER;
    }
    for (const [yr, group] of byYear) {
      if (group.length <= 1) continue;
      const cols = [X_LEFT, X_CENTER, X_RIGHT];
      const used = new Set();
      // current keeps center
      for (const n of group) if (n.isCurrent) used.add(n.x);
      // amendments keep right (if not taken)
      for (const n of group) {
        if (n.isCurrent) continue;
        if (isAmendNode.get(n.doc.id) && !used.has(X_RIGHT)) { n.x = X_RIGHT; used.add(X_RIGHT); }
      }
      // remaining nodes pick first free column
      for (const n of group) {
        if (n.isCurrent || used.has(n.x)) continue;
        const free = cols.find(c => !used.has(c));
        if (free !== undefined) { n.x = free; used.add(free); }
      }
    }

    // Count parents per child to detect merges (multi-parent → "HỢP NHẤT")
    const parentCount = new Map();
    for (const e of uniqEdges) parentCount.set(e.to, (parentCount.get(e.to) || 0) + 1);

    const labelFor = (e) => {
      if (e.type === 'amend') return 'SỬA ĐỔI';
      if (e.type === 'elevate') return 'NÂNG CẤP';
      return parentCount.get(e.to) > 1 ? 'HỢP NHẤT' : 'THAY THẾ';
    };

    // === Build SVG ===
    let edgeMarkup = '';
    for (const e of uniqEdges) {
      const f = nodes.get(e.from), t = nodes.get(e.to);
      if (!f || !t || f.x === undefined) continue;
      const x1 = f.x, y1 = f.y + NODE_H / 2;
      const x2 = t.x, y2 = t.y - NODE_H / 2;
      let path;
      if (x1 === x2) {
        path = `M ${x1} ${y1} V ${y2}`;
      } else {
        // Orthogonal step: down half, across, down to target
        const midY = y1 + (y2 - y1) * 0.55;
        path = `M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`;
      }
      edgeMarkup += `<path class="evt-edge evt-edge-${e.type}" d="${path}" marker-end="url(#evt-arr-${e.type})"/>`;
      const lx = (x1 + x2) / 2, ly = y1 + (y2 - y1) * 0.55;
      const labelText = labelFor(e);
      const labelW = Math.max(48, labelText.length * 6 + 14);
      edgeMarkup += `<g transform="translate(${lx} ${ly})">
        <rect class="evt-edge-label-bg" x="${-labelW / 2}" y="-9" width="${labelW}" height="16" rx="3"/>
        <text class="evt-edge-label" x="0" y="3" text-anchor="middle">${escapeHtml(labelText)}</text>
      </g>`;
    }

    let nodeMarkup = '';
    for (const n of nodeList) {
      const tk = n.doc.typeKey || '';
      const cls = `evt-node-rect ${tk}${n.isCurrent ? ' current' : ''}`;
      const numCls = `evt-node-num${n.isCurrent ? ' current' : ''}`;
      const x = n.x - NODE_W / 2;
      const y = n.y - NODE_H / 2;
      const titleText = (n.doc.shortTitle || n.doc.title || n.doc.number || '').replace(/\s+/g, ' ').slice(0, 36);
      nodeMarkup += `
        <g class="evt-node-group" data-doc-id="${escapeHtml(n.doc.id)}" style="cursor: pointer;">
          <rect class="${cls}" x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="5"/>
          <text class="${numCls}" x="${n.x}" y="${n.y - 18}" text-anchor="middle">${n.isCurrent ? '★ ' : ''}${escapeHtml(n.doc.type)} · ${escapeHtml(n.doc.number)}</text>
          <text class="evt-node-title" x="${n.x}" y="${n.y - 2}" text-anchor="middle">${escapeHtml(titleText)}</text>
          <text class="evt-node-sub" x="${n.x}" y="${n.y + 18}" text-anchor="middle">${escapeHtml(n.doc.issuedDate ? formatDate(n.doc.issuedDate) : '')}</text>
        </g>
      `;
    }

    let axisMarkup = '';
    for (const yr of years) {
      const y = yearY.get(yr);
      axisMarkup += `<text class="evt-axis-label" x="14" y="${y + 5}">${escapeHtml(yr)}</text>`;
      axisMarkup += `<line class="evt-axis-line" x1="58" y1="${y}" x2="${SVG_W - 20}" y2="${y}"/>`;
    }

    sodoEl.innerHTML = `
      <h2>Cây tiến hóa — ${escapeHtml(doc.shortTitle)}</h2>
      <div class="evt-meta">
        <span><strong>${nodes.size - 1}</strong> văn bản trong nhánh</span>
        <span class="evt-meta-sep">·</span>
        <span><strong>${uniqEdges.length}</strong> liên kết</span>
      </div>
      <div class="evt-wrap">
        <svg class="evt-svg" viewBox="0 0 ${SVG_W} ${SVG_H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="evt-arr-replace" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="#7d1d22"/></marker>
            <marker id="evt-arr-amend" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="#b78a3e"/></marker>
            <marker id="evt-arr-elevate" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="#15a884"/></marker>
          </defs>
          <g class="evt-axis">${axisMarkup}</g>
          <g class="evt-edges">${edgeMarkup}</g>
          <g class="evt-nodes">${nodeMarkup}</g>
        </svg>
        <div class="evt-legend">
          <span><i class="evt-legend-line replace"></i> Thay thế / Hợp nhất</span>
          <span><i class="evt-legend-line amend"></i> Sửa đổi, bổ sung</span>
          <span><i class="evt-legend-line elevate"></i> Nâng cấp tier (NĐ → Luật)</span>
        </div>
      </div>
    `;

    sodoEl.querySelectorAll('.evt-node-group[data-doc-id]').forEach(g => {
      g.addEventListener('click', () => {
        const id = g.dataset.docId;
        if (id !== doc.id) showDocPreview(id);
      });
    });
  }

  // Hệ thống văn bản — hierarchical pyramid view. Walks the `implements`
  // field upward to find the master Luật/Bộ luật, then groups all docs
  // that implement that master (or any of its evolution chain) by tier:
  //   Tier 1 — Luật / Bộ luật (master)
  //   Tier 2 — Nghị định (implementing decrees)
  //   Tier 3 — Thông tư (implementing circulars)
  // Tier 0 — Hiến pháp — shown as a static placeholder above the master.
  function renderHeThong(doc) {
    if (!hethongEl) return;

    // Find the master Luật for this doc:
    //   - If doc is Luật/Bộ luật, doc itself is the master (or, if it has
    //     `replaces`, the oldest in its lineage is the lineage root — but
    //     we want the CURRENT effective master, so we just use `doc`).
    //   - If doc is NĐ/TT, follow `implements` upward.
    let master = doc;
    const seen = new Set();
    while (master && master.typeKey !== 'luat' && master.typeKey !== 'bo-luat') {
      if (seen.has(master.id)) break;
      seen.add(master.id);
      const imp = (master.implements || [])[0];
      const next = imp ? H.findDoc(imp) : null;
      if (!next) break;
      master = next;
    }

    if (!master || (master.typeKey !== 'luat' && master.typeKey !== 'bo-luat')) {
      hethongEl.innerHTML = `
        <h2>Hệ thống văn bản — ${escapeHtml(doc.shortTitle)}</h2>
        <div class="ld-empty">
          Văn bản này chưa được liên kết đến văn bản cấp Luật/Bộ luật chủ quản.<br>
          Trường <code>implements</code> trong CSDL chưa được khai báo cho văn bản này.
        </div>
      `;
      return;
    }

    // Build the evolution chain of the master (so a TT issued in 2014 under
    // 47/2010 still appears under the current 32/2024 pyramid).
    const masterChain = new Set([master.id]);
    (function walkChain(id) {
      const d = H.findDoc(id);
      if (!d) return;
      for (const pid of (d.replaces || [])) {
        if (!masterChain.has(pid)) { masterChain.add(pid); walkChain(pid); }
      }
    })(master.id);
    // Also walk forward — newer amendments of the master share the same pyramid.
    for (const other of Object.values(DB)) {
      if (masterChain.has(other.id)) continue;
      for (const pid of (other.replaces || [])) {
        if (masterChain.has(pid)) { masterChain.add(other.id); break; }
      }
      for (const pid of (other.amends || [])) {
        if (masterChain.has(pid)) { masterChain.add(other.id); break; }
      }
    }

    // Collect implementing decrees and circulars
    const decrees = [], circulars = [];
    for (const other of Object.values(DB)) {
      const imps = other.implements || [];
      if (!imps.some(id => masterChain.has(id))) continue;
      if (other.typeKey === 'nghidinh') decrees.push(other);
      else if (other.typeKey === 'thongtu') circulars.push(other);
    }
    decrees.sort((a, b) => (b.issuedDate || '').localeCompare(a.issuedDate || ''));
    circulars.sort((a, b) => (b.issuedDate || '').localeCompare(a.issuedDate || ''));

    const totalImpl = decrees.length + circulars.length;

    const cardHTML = (d, size) => {
      const tk = d.typeKey || '';
      const cls = `ht-card type-${escapeHtml(tk)} ht-card-${size}`;
      const subtitle = d.shortTitle || d.title || d.number;
      return `
        <button class="${cls}" data-doc-id="${escapeHtml(d.id)}" type="button">
          <span class="ht-card-pill">${escapeHtml(d.type)} · ${escapeHtml(d.number)}</span>
          <span class="ht-card-title">${escapeHtml(subtitle)}</span>
          ${d.issuedDate ? `<span class="ht-card-date">${escapeHtml(formatDate(d.issuedDate))}</span>` : ''}
        </button>
      `;
    };

    const masterIsCurrent = master.id === doc.id;

    hethongEl.innerHTML = `
      <h2>Hệ thống văn bản — ${escapeHtml(master.shortTitle)}</h2>
      <div class="ht-meta">
        <span><strong>${decrees.length}</strong> nghị định</span>
        <span class="ht-meta-sep">·</span>
        <span><strong>${circulars.length}</strong> thông tư</span>
        ${totalImpl ? '' : '<span class="ht-meta-sep">·</span><span class="ht-meta-empty">chưa có dữ liệu trong CSDL</span>'}
      </div>

      <div class="ht-pyramid">
        <div class="ht-tier ht-tier-1">
          <div class="ht-tier-label">CẤP LUẬT</div>
          ${cardHTML(master, 'lg') /* size lg for master */}
          ${masterIsCurrent ? '' : `<div class="ht-master-hint">★ Văn bản đang xem nằm dưới văn bản cấp Luật này</div>`}
        </div>

        ${decrees.length ? `
        <div class="ht-tier ht-tier-2">
          <div class="ht-tier-label">CẤP NGHỊ ĐỊNH · ${decrees.length}</div>
          <div class="ht-grid ht-grid-nghidinh">
            ${decrees.map(d => cardHTML(d, d.id === doc.id ? 'md current' : 'md')).join('')}
          </div>
        </div>` : ''}

        ${circulars.length ? `
        <div class="ht-tier ht-tier-3">
          <div class="ht-tier-label">CẤP THÔNG TƯ · ${circulars.length}</div>
          <div class="ht-grid ht-grid-thongtu">
            ${circulars.map(d => cardHTML(d, d.id === doc.id ? 'sm current' : 'sm')).join('')}
          </div>
        </div>` : ''}

        ${totalImpl === 0 ? `
        <div class="ld-empty" style="margin-top: 18px;">
          Chưa có nghị định / thông tư nào trong CSDL khai báo <code>implements: ["${escapeHtml(master.id)}"]</code>.
        </div>` : ''}
      </div>
    `;

    hethongEl.querySelectorAll('.ht-card[data-doc-id]').forEach(b => {
      b.addEventListener('click', () => {
        const id = b.dataset.docId;
        if (id !== doc.id) showDocPreview(id);
      });
    });
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
  // The tab bar was removed from the viewer (every view is reached from the
  // spotlight CTAs now), so `tabbar` is null. Guard everything that touched
  // it; activateTab still works because we only need the panel-class swap,
  // and the reading toolbar visibility toggle lookups are id-based.
  function activateTab(name) {
    if (tabbar) {
      $$(".tab", tabbar).forEach(t => {
        if (!t.dataset.tab) return;
        t.classList.toggle("active", t.dataset.tab === name);
      });
    }
    $$(".tab-panel").forEach(p => {
      p.classList.toggle("active", p.dataset.panel === name);
    });
    const rt = $("#read-toolbar");
    if (rt) rt.style.display = (name === "toanvan") ? "" : "none";
  }
  function isTabActive(name) {
    if (!tabbar) return name === "toanvan"; // default panel when tabbar is gone
    return !!$(`.tab.active[data-tab="${name}"]`, tabbar);
  }
  if (tabbar) {
    $$(".tab[data-tab]", tabbar).forEach(t => {
      t.addEventListener("click", () => activateTab(t.dataset.tab));
    });
  }


  // Reading toolbar
  $("#size-down").addEventListener("click", () => setReadSize(readSize - 1));
  $("#size-up").addEventListener("click", () => setReadSize(readSize + 1));
  $("#size-reset").addEventListener("click", () => setReadSize(12));
  $("#width-narrow").addEventListener("click", () => setWide(false));
  $("#width-wide").addEventListener("click", () => setWide(true));

  function setReadSize(px) {
    readSize = Math.max(10, Math.min(20, px));
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
  // Short-form law names → current canonical doc id. Vietnamese legal text
  // commonly cites laws by short name only ("theo quy định của Luật Các tổ
  // chức tín dụng") instead of by number, so we keep an ordered table from
  // most-specific to least-specific name (e.g. "Bộ luật Tố tụng dân sự" must
  // come before "Bộ luật Dân sự") with a negative lookahead that skips the
  // long-form "Luật X số …" cases (those are caught by NAMED_DOC_NUMBER_RE).
  const NAMED_CODE_PATTERNS = [
    // Bộ luật family — longer phrases first
    { re: /Bộ\s*luật\s+Tố\s+tụng\s+dân\s+sự(?!\s+số\s+\d)/giu, docId: "92/2015/QH13" },
    { re: /Bộ\s*luật\s+Tố\s+tụng\s+hình\s+sự(?!\s+số\s+\d)/giu, docId: "101/2015/QH13" },
    { re: /Bộ\s*luật\s+Hình\s+sự(?!\s+số\s+\d)/giu, docId: "100/2015/QH13" },
    { re: /Bộ\s*luật\s+Dân\s+sự(?!\s+số\s+\d)/giu, docId: "91/2015/QH13" },
    // Luật family — long descriptive names first
    { re: /Luật\s+Sử\s+dụng\s+năng\s+lượng\s+tiết\s+kiệm\s+và\s+hiệu\s+quả(?!\s+số\s+\d)/giu, docId: "50/2010/QH12" },
    { re: /Luật\s+Đầu\s+tư\s+theo\s+phương\s+thức\s+đối\s+tác\s+công\s+tư(?!\s+số\s+\d)/giu, docId: "64/2020/QH14" },
    { re: /Luật\s+Bảo\s+vệ\s+quyền\s+lợi\s+người\s+tiêu\s+dùng(?!\s+số\s+\d)/giu, docId: "59/2010/QH12" },
    { re: /Luật\s+Phòng[, ]+chống\s+rửa\s+tiền(?!\s+số\s+\d)/giu, docId: "14/2022/QH15" },
    { re: /Luật\s+Ngân\s+hàng\s+Nhà\s+nước(?:\s+Việt\s+Nam)?(?!\s+số\s+\d)/giu, docId: "46/2010/QH12" },
    { re: /Luật\s+Bảo\s+hiểm\s+tiền\s+gửi(?!\s+số\s+\d)/giu, docId: "06/2012/QH13" },
    { re: /Luật\s+Bảo\s+vệ\s+môi\s+trường(?!\s+số\s+\d)/giu, docId: "72/2020/QH14" },
    { re: /Luật\s+Xử\s+lý\s+vi\s+phạm\s+hành\s+chính(?!\s+số\s+\d)/giu, docId: "15/2012/QH13" },
    { re: /Luật\s+Quản\s+lý\s+thuế(?!\s+số\s+\d)/giu, docId: "38/2019/QH14" },
    { re: /Luật\s+Đầu\s+tư\s+công(?!\s+số\s+\d)/giu, docId: "39/2019/QH14" },
    { re: /Luật\s+Ngân\s+sách\s+nhà\s+nước(?!\s+số\s+\d)/giu, docId: "83/2015/QH13" },
    { re: /Luật\s+Các\s+tổ\s+chức\s+tín\s+dụng(?!\s+số\s+\d)/giu, docId: "32/2024/QH15" },
    { re: /Luật\s+Tổ\s+chức\s+Tòa\s+án\s+nhân\s+dân(?!\s+số\s+\d)/giu, docId: "33/2002/QH10" },
    { re: /Luật\s+Phá\s+sản(?!\s+số\s+\d)/giu, docId: "51/2014/QH13" },
    { re: /Luật\s+Doanh\s+nghiệp(?!\s+số\s+\d)/giu, docId: "59/2020/QH14" },
    { re: /Luật\s+Đất\s+đai(?!\s+số\s+\d)/giu, docId: "31/2024/QH15" },
    { re: /Luật\s+Chứng\s+khoán(?!\s+số\s+\d)/giu, docId: "54/2019/QH14" },
    { re: /Luật\s+Đầu\s+tư(?!\s+(?:công|theo|số\s+\d))/giu, docId: "61/2020/QH14" },
    { re: /Luật\s+Đường\s+sắt(?!\s+số\s+\d)/giu, docId: "06/2017/QH14" },
    { re: /Luật\s+Thủy\s+lợi(?!\s+số\s+\d)/giu, docId: "08/2017/QH14" },
    { re: /Luật\s+Quy\s+hoạch(?!\s+số\s+\d)/giu, docId: "21/2017/QH14" },
    { re: /Luật\s+Điện\s+lực(?!\s+số\s+\d)/giu, docId: "61/2024/QH15" },
    { re: /Luật\s+Xây\s+dựng(?!\s+số\s+\d)/giu, docId: "50/2014/QH13" },
    { re: /Luật\s+Cạnh\s+tranh(?!\s+số\s+\d)/giu, docId: "23/2018/QH14" },
    { re: /Luật\s+Giá(?!\s+số\s+\d)/giu, docId: "16/2023/QH15" },
    { re: /Luật\s+Kinh\s+doanh\s+bất\s+động\s+sản(?!\s+số\s+\d)/giu, docId: "29/2023/QH15" },
    { re: /Luật\s+Nhà\s+ở(?!\s+số\s+\d)/giu, docId: "27/2023/QH15" },
  ];
  // Structured citation phrase. Matches phrases like:
  //   "điểm a khoản 1 Điều này"
  //   "các điểm a, b, c, d và đ khoản này"
  //   "khoản 1 Điều 5 của Luật số 32/2024/QH15"
  //   "khoản 1 Điều này"
  // The regex requires "khoản X" as the anchor (so bare "Điều X" without a
  // preceding khoản won't match — that's by design after the user asked us
  // to drop standalone Điều linking). For chained phrases like
  // "khoản 1 và khoản 2 Điều này" the global flag yields two separate
  // matches, each carrying the trailing "Điều này" if present.
  // Section / chapter citation phrase. Matches:
  //   "Mục 3 Chương V"
  //   "Mục 3 Chương V của Luật này"
  //   "Chương V của Luật số 32/2024/QH15"
  //   "Chương V" (alone)
  // Roman numeral is uppercase-only to avoid false positives like "Chương vi
  // phạm". Trailing doc phrase is excluded from the visible span — the
  // doc-number / named-code matchers wrap it separately.
  const SECTION_REF_RE = new RegExp(
    "(?:(M[ụu]c)\\s+(\\d+)\\s+)?" +
    "(Ch[ưu]ơng)\\s+([IVXLCDM]+|\\d+)(?![\\p{L}\\d])" +
    "(?:\\s+(?:của\\s+)?(Luật\\s+này|Luật\\s+số\\s+[0-9]+\\/[0-9]+\\/QH[0-9]+|Nghị\\s*định\\s+số\\s+[0-9]+\\/[0-9]+\\/N[ĐD]-CP|Thông\\s*tư\\s+số\\s+[0-9]+\\/[0-9]+\\/TT-[A-ZĐ]+|Bộ\\s*luật\\s+(?:Hình\\s+sự|Dân\\s+sự|Tố\\s+tụng\\s+(?:dân|hình)\\s+sự|Lao\\s+động)))?",
    "gu"
  );

  const STRUCT_REF_RE = new RegExp(
    // Optional "[các] điểm L1, L2, ... [và Lk]" prefix
    "(?:(các\\s+)?(điểm)\\s+(" +
      "[" + VN_LETTER + "](?:\\s*,\\s*[" + VN_LETTER + "])*(?:\\s+(?:và|hoặc)\\s+[" + VN_LETTER + "])?" +
    ")\\s+)?" +
    // Required "khoản N[, N, ... và N]" or "khoản này". Optional "các" before "khoản".
    "(?:các\\s+)?(khoản)\\s+(" +
      "\\d+(?:\\s*,\\s*\\d+)*(?:\\s+(?:và|hoặc)\\s+\\d+)?|này" +
    ")" +
    // Optional " Điều M" or " Điều này"
    "(?:\\s+(Điều)\\s+(\\d+|này))?" +
    // Optional " [của ]<doc-phrase>"
    "(?:\\s+(?:của\\s+)?(Luật\\s+này|Luật\\s+số\\s+[0-9]+\\/[0-9]+\\/QH[0-9]+|Nghị\\s*định\\s+số\\s+[0-9]+\\/[0-9]+\\/N[ĐD]-CP|Thông\\s*tư\\s+số\\s+[0-9]+\\/[0-9]+\\/TT-[A-ZĐ]+|Bộ\\s*luật\\s+(?:Hình\\s+sự|Dân\\s+sự|Tố\\s+tụng\\s+(?:dân|hình)\\s+sự|Lao\\s+động)))?",
    "giu"
  );

  function normalizeDocNumber(raw) {
    return raw.toUpperCase().replace(/\s+/g, "")
      .replace(/ND-CP/gi, "NĐ-CP")
      .replace(/NĐ\s*-\s*CP/gi, "NĐ-CP")
      .replace(/TT\s*-\s*/gi, "TT-");
  }

  // Parse an article body into { intro, clauses: [{ number, text, points: [{ letter, text }] }] }.
  // Vietnamese legal articles use "1." for clauses and "a)" for points.
  function parseArticleStructure(body) {
    if (!body) return { intro: "", clauses: [] };
    const lines = body.split(/\r?\n/);
    const clauses = [];
    let curClause = null, curPoint = null;
    const intro = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      const cMatch = line.match(/^(\d+)\.\s*(.*)$/);
      const pMatch = line.match(new RegExp("^([" + VN_LETTER + "])\\)\\s*(.*)$", "i"));
      if (cMatch) {
        curClause = { number: cMatch[1], text: cMatch[2], points: [] };
        curPoint = null;
        clauses.push(curClause);
      } else if (pMatch && curClause) {
        curPoint = { letter: pMatch[1].toLowerCase(), text: pMatch[2] };
        curClause.points.push(curPoint);
      } else if (curPoint) {
        curPoint.text += "\n" + line;
      } else if (curClause) {
        curClause.text += "\n" + line;
      } else {
        intro.push(line);
      }
    }
    return { intro: intro.join("\n"), clauses };
  }

  const _structCache = new Map();
  function getArticleStructure(doc, articleNumber) {
    if (!doc || !articleNumber) return null;
    const key = doc.id + "#" + articleNumber;
    if (_structCache.has(key)) return _structCache.get(key);
    const art = H.findArticle(doc, articleNumber);
    if (!art) { _structCache.set(key, null); return null; }
    const struct = parseArticleStructure(art.body);
    _structCache.set(key, struct);
    return struct;
  }

  // Resolve a doc-name phrase ("Luật này" / "Luật số ..." / "Bộ luật Hình sự") to a docId.
  function resolveDocPhrase(phrase, contextDocId) {
    if (!phrase) return contextDocId;
    if (/Luật\s+này/i.test(phrase)) return contextDocId;
    const numMatch = phrase.match(/[0-9]+\/[0-9]+\/[A-ZĐ\-]+/i);
    if (numMatch) return normalizeDocNumber(numMatch[0]);
    if (/Bộ\s*luật\s+Tố\s+tụng\s+dân\s+sự/i.test(phrase)) return "92/2015/QH13";
    if (/Bộ\s*luật\s+Tố\s+tụng\s+hình\s+sự/i.test(phrase)) return "101/2015/QH13";
    if (/Bộ\s*luật\s+Hình\s+sự/i.test(phrase)) return "100/2015/QH13";
    if (/Bộ\s*luật\s+Dân\s+sự/i.test(phrase)) return "91/2015/QH13";
    return contextDocId;
  }

  // Find structured citation phrases ("điểm a, b khoản 1 Điều này", etc.) and
  // emit one ref per individual identifier (each letter, each number).
  // Helper used by findArticleListRefs: does `text` START with a recognised
  // doc phrase? Returns { docId, raw, length } if so, else null. Tries the
  // same patterns the rest of the parser uses, in priority order: named
  // doc-number ("Luật ... số 32/2024/QH15"), bare doc-number ("Luật số 32/...").
  // every NAMED_CODE_PATTERNS entry ("Luật Các tổ chức tín dụng" → 32/2024),
  // and finally "Luật này" → contextDoc.
  function matchLeadingDocPhrase(text, ctx) {
    let m = text.match(/^(Luật|Bộ\s*luật|Nghị\s*định|Thông\s*tư)\s+(?:[^.;\n\/]{1,80}?)\s+số\s+([0-9]+\/[0-9]+\/(?:QH[0-9]+|N[ĐD][- ]?CP|TT[- ]?[A-ZĐ]+))/iu);
    if (m) return { docId: normalizeDocNumber(m[2]), raw: m[0], length: m[0].length };
    m = text.match(/^(Luật|Nghị\s*định|Thông\s*tư|Bộ\s*luật)(?:\s+số)?\s+([0-9]+\/[0-9]+\/(?:QH[0-9]+|N[ĐD][- ]?CP|TT[- ]?[A-ZĐ]+))/iu);
    if (m) return { docId: normalizeDocNumber(m[2]), raw: m[0], length: m[0].length };
    for (const { re, docId } of NAMED_CODE_PATTERNS) {
      const anchored = new RegExp("^" + re.source, "iu");
      m = text.match(anchored);
      if (m) return { docId, raw: m[0], length: m[0].length };
    }
    // "Luật này" / "Bộ luật này" / "Nghị định này" / "Thông tư này" —
    // context-relative reference back to the document being read.
    m = text.match(/^(?:Luật|Bộ\s*luật|Nghị\s*định|Thông\s*tư)\s+này\b/iu);
    if (m && ctx && ctx.docId) {
      return { docId: ctx.docId, raw: m[0], length: m[0].length };
    }
    return null;
  }

  // Match phrases like "Điều 24 Luật Các tổ chức tín dụng",
  // "Điều 24 đến Điều 28 Luật các tổ chức tín dụng",
  // "Điều 5 và Điều 6 Luật Doanh nghiệp",
  // "Điều 100 Bộ luật Hình sự",
  // "Điều 5 của Luật số 32/2024/QH15".
  // Each article number gets its own hover span pointing at that article in
  // the resolved doc. The doc phrase itself is left for the existing
  // doc-level matchers (overlap-skip drops duplicates).
  function findArticleListRefs(text, ctx) {
    const out = [];
    const ANCHOR_RE = /Điều\s+(\d+)((?:\s*(?:,|\s+(?:và|hoặc|đến|tới)\s+)\s*(?:Điều\s+)?\d+)*)/giu;
    let m;
    ANCHOR_RE.lastIndex = 0;
    while ((m = ANCHOR_RE.exec(text)) !== null) {
      const anchorStart = m.index;
      const anchorEnd = m.index + m[0].length;
      const tail = text.slice(anchorEnd);
      const lead = tail.match(/^(\s+(?:của\s+)?)/);
      if (!lead) continue;
      const docPhraseText = tail.slice(lead[0].length);
      const docInfo = matchLeadingDocPhrase(docPhraseText, ctx);
      if (!docInfo) continue;
      // Emit one ref per "[Điều ]N" chunk. The span covers "Điều N" wherever
      // the source spells out "Điều", and just the number where it doesn't
      // (e.g. "Điều 5, 6, 7 Luật ABC" yields "Điều 5", "6", "7").
      const PIECE_RE = /(Điều\s+)?(\d+)/giu;
      let pm;
      PIECE_RE.lastIndex = 0;
      while ((pm = PIECE_RE.exec(m[0])) !== null) {
        const startInMatch = pm.index;
        const endInMatch = pm.index + pm[0].length;
        out.push({
          kind: "article",
          docId: docInfo.docId,
          articleNumber: pm[2],
          clause: null,
          point: null,
          raw: m[0].slice(startInMatch, endInMatch),
          start: anchorStart + startInMatch,
          end: anchorStart + endInMatch,
        });
      }
    }
    return out;
  }

  // Find "[Mục N] Chương X [của <doc>]" phrases and emit a single span per
  // match. Span covers from "Mục" (or "Chương" if section is omitted) through
  // the chapter id; the trailing doc phrase is left for the doc-level
  // matchers.
  function findSectionRefs(text, ctx) {
    const out = [];
    if (!ctx) ctx = {};
    SECTION_REF_RE.lastIndex = 0;
    let m;
    while ((m = SECTION_REF_RE.exec(text)) !== null) {
      // m[1] = "Mục" (optional), m[2] = section id (digits)
      // m[3] = "Chương",          m[4] = chapter id (Roman or digits)
      // m[5] = doc phrase
      if (m[0].length === 0) { SECTION_REF_RE.lastIndex++; continue; }
      const hasSection = !!m[1];
      const phraseStart = m.index;
      const fullMatch = m[0];
      const docId = resolveDocPhrase(m[5], ctx.docId);

      const startRe = hasSection ? /M[ụu]c/u : /Ch[ưu]ơng/u;
      const startSearch = fullMatch.match(startRe);
      const spanStartInMatch = startSearch ? startSearch.index : 0;

      const escape = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
      const endRe = new RegExp("Ch[ưu]ơng\\s+" + escape(m[4]), "u");
      const endSearch = fullMatch.match(endRe);
      const spanEndInMatch = endSearch
        ? endSearch.index + endSearch[0].length
        : fullMatch.length;

      const absStart = phraseStart + spanStartInMatch;
      const absEnd = phraseStart + spanEndInMatch;
      if (absEnd <= absStart) continue;

      out.push({
        kind: "section",
        docId,
        chapter: m[4].toUpperCase(),
        section: hasSection ? m[2] : null,
        articleNumber: null,
        clause: null,
        point: null,
        raw: text.slice(absStart, absEnd),
        start: absStart,
        end: absEnd,
      });
    }
    return out;
  }

  function findStructuredRefs(text, ctx) {
    const out = [];
    if (!ctx) ctx = {};
    STRUCT_REF_RE.lastIndex = 0;
    let m;
    while ((m = STRUCT_REF_RE.exec(text)) !== null) {
      // m[1] = "các"        m[2] = "điểm" keyword     m[3] = letters string
      // m[4] = "khoản"      m[5] = clause id (\d+|này)
      // m[6] = "Điều"       m[7] = article id (\d+|này)
      // m[8] = doc phrase
      const hasPoint = !!m[2];
      const hasClause = !!m[4]; // always true with the new anchor regex
      const hasArticle = !!m[6];
      if (!hasClause) {
        if (m[0].length === 0) STRUCT_REF_RE.lastIndex++;
        continue;
      }

      const phraseStart = m.index;
      const fullMatch = m[0];
      const docId = resolveDocPhrase(m[8], ctx.docId);
      const resolvedArt = hasArticle
        ? (m[7] === "này" ? ctx.article : m[7])
        : ctx.article;

      // Parse the clause group, which may be a list ("2, 4, 6 và 18") or "này".
      let clauseList;
      if (m[5] === "này") {
        clauseList = ctx.clause ? [String(ctx.clause)] : null;
      } else {
        clauseList = m[5].match(/\d+/g);
      }
      if (!clauseList || !clauseList.length) continue;

      // Emit ONE consolidated span covering the full structured phrase
      // ("[các] [điểm a, b] khoản 2, 4, 6, 7, 8, 9, 10, 12, 13, 14 và 18 Điều 70").
      // The trailing doc phrase ("của Luật này", "của Luật số 32/2024/QH15") is
      // deliberately excluded — it already gets its own hover via the
      // doc-number / named-code matchers.
      const startRe = hasPoint
        ? (m[1] ? /(?:các\s+)?điểm/iu : /điểm/iu)
        : /(?:các\s+)?khoản/iu;
      const startSearch = fullMatch.match(startRe);
      const spanStartInMatch = startSearch ? startSearch.index : 0;

      const escape = (s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
      let spanEndInMatch;
      if (hasArticle) {
        const endRe = new RegExp("Điều\\s+" + escape(m[7]), "iu");
        const endSearch = fullMatch.match(endRe);
        spanEndInMatch = endSearch ? endSearch.index + endSearch[0].length : fullMatch.length;
      } else {
        // No "Điều X" suffix — span ends at the last clause id (or "này")
        const tail = m[5];
        const idx = fullMatch.lastIndexOf(tail);
        spanEndInMatch = idx >= 0 ? idx + tail.length : fullMatch.length;
      }

      const absStart = phraseStart + spanStartInMatch;
      const absEnd = phraseStart + spanEndInMatch;
      if (absEnd <= absStart) continue;

      // Carry the point letter only when exactly one is named ("điểm a").
      // For lists like "điểm a, b" we keep the consolidated span but drop the
      // point qualifier so the popup shows clause + article only.
      let point = null;
      if (hasPoint) {
        const letterRe = new RegExp("(?<!\\p{L})[" + VN_LETTER + "](?!\\p{L})", "giu");
        const letters = (m[3] || "").match(letterRe) || [];
        if (letters.length === 1) point = letters[0].toLowerCase();
      }

      out.push({
        kind: "article",
        docId,
        articleNumber: resolvedArt,
        clause: clauseList[0],
        clauses: clauseList,
        point,
        raw: text.slice(absStart, absEnd),
        start: absStart,
        end: absEnd,
      });
    }
    return out;
  }

  function annotateReferences(rootEl, contextDoc) {
    // Walk paragraphs in document order, tracking the current article /
    // clause / point context for "Điều này" / "khoản này" / "điểm này"
    // resolution. For nested structure: <h3.article id="art-N"> starts an
    // article; subsequent <p.clause> sets the active clause and resets the
    // point; <p.point> sets the active point.
    let curArticle = null, curClause = null, curPoint = null;
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_ELEMENT, null);
    const targets = [];
    let node;
    while ((node = walker.nextNode())) {
      if (node.matches && node.matches("h3.article")) {
        const m = (node.id || "").match(/^art-(\d+)/);
        curArticle = m ? m[1] : null;
        curClause = null;
        curPoint = null;
        continue;
      }
      if (node.tagName === "P") {
        if (node.classList.contains("clause")) {
          const m = (node.textContent || "").match(/^(\d+)\./);
          curClause = m ? m[1] : curClause;
          curPoint = null;
        } else if (node.classList.contains("point")) {
          const m = (node.textContent || "").match(new RegExp("^([" + VN_LETTER + "])\\)", "i"));
          curPoint = m ? m[1].toLowerCase() : curPoint;
        }
        targets.push({ el: node, ctx: { docId: contextDoc ? contextDoc.id : null, article: curArticle, clause: curClause, point: curPoint } });
      }
    }

    for (const { el, ctx } of targets) annotateElement(el, contextDoc, ctx);
  }

  function annotateElement(el, contextDoc, ctx) {
    walkTextNodes(el, (textNode) => {
      const text = textNode.nodeValue;
      if (!text || text.length < 4) return;
      const matches = findReferencesInText(text, ctx);
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
        if (m.clauses && m.clauses.length > 1) span.dataset.clauses = m.clauses.join(",");
        if (m.point) span.dataset.point = m.point;
        if (m.chapter) span.dataset.chapter = m.chapter;
        if (m.section) span.dataset.section = m.section;
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

  function findReferencesInText(text, ctx) {
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
    for (const { re, docId } of NAMED_CODE_PATTERNS) {
      re.lastIndex = 0;
      while ((m = re.exec(text)) !== null) {
        if (found.some(r => !(r.end <= m.index || r.start >= m.index + m[0].length))) continue;
        found.push({ kind: "named-code", docId, articleNumber: null, clause: null, point: null, raw: m[0], start: m.index, end: m.index + m[0].length });
      }
    }
    // Structured citations (điểm a, b khoản N Điều X) — emit one ref per
    // letter / number so each identifier is independently hoverable.
    for (const r of findStructuredRefs(text, ctx || {})) {
      if (found.some(other => !(other.end <= r.start || other.start >= r.end))) continue;
      found.push(r);
    }
    // Article-list references with explicit doc target ("Điều 24 đến Điều 28
    // Luật các Tổ chức tín dụng", "Điều 5 và Điều 6 Luật Doanh nghiệp", etc.)
    // The doc phrase itself was already wrapped above; we only emit the
    // article-number spans here. Overlap-skip drops anything already handled
    // by findStructuredRefs (the khoản-anchored variant).
    for (const r of findArticleListRefs(text, ctx || {})) {
      if (found.some(other => !(other.end <= r.start || other.start >= r.end))) continue;
      found.push(r);
    }
    // Section / chapter citations ("Mục 3 Chương V", "Chương XV của Luật số ...").
    for (const r of findSectionRefs(text, ctx || {})) {
      if (found.some(other => !(other.end <= r.start || other.start >= r.end))) continue;
      found.push(r);
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
    if (ref.kind === "section") {
      if (!targetDoc) return { found: false, doc: null, chapter: null, anchorArticle: null };
      const wantCh = String(ref.chapter || "").toUpperCase();
      const chapter = (targetDoc.chapters || []).find(ch => {
        const mm = String(ch.title || "").toUpperCase().match(/CH[ƯU]ƠNG\s+([IVXLCDM]+|\d+)\b/u);
        return mm && mm[1] === wantCh;
      });
      if (!chapter) return { found: false, doc: targetDoc, chapter: null, anchorArticle: null };
      const arts = chapter.articles || [];
      if (!ref.section) {
        return {
          found: true,
          doc: targetDoc,
          chapter,
          anchorArticle: arts[0] || null,
          sectionSubtitle: null,
        };
      }
      // Mục headers are emitted by the upstream parser as a line like
      // "Mục N ..." that gets glued onto the END of the body of the LAST
      // article of the PREVIOUS section. So scanning chapter article bodies
      // for the marker "Mục N" tells us which article precedes the section,
      // and the section's first article is the NEXT one in the list. Mục 1
      // typically has no marker — fall back to the chapter's first article.
      const sectId = String(ref.section);
      const secRe = new RegExp("(?:^|\\n)\\s*M[ụu]c\\s+" + sectId + "\\b[^\\n]*", "u");
      const anyMarkerRe = /(?:^|\n)\s*M[ụu]c\s+\d+\b/u;
      let preIdx = -1;
      let sectionSubtitle = null;
      for (let i = 0; i < arts.length; i++) {
        const mm = (arts[i].body || "").match(secRe);
        if (mm) {
          sectionSubtitle = mm[0].replace(/^\s*M[ụu]c\s+\d+\.?\s*/u, "").trim();
          preIdx = i;
          break;
        }
      }
      let firstIdx, lastIdx;
      if (preIdx >= 0) {
        firstIdx = preIdx + 1;
      } else if (sectId === "1") {
        firstIdx = 0;
      } else {
        return { found: false, doc: targetDoc, chapter, anchorArticle: null };
      }
      // Section ends at the article just before the NEXT Mục marker.
      lastIdx = arts.length - 1;
      for (let j = firstIdx; j < arts.length; j++) {
        if (anyMarkerRe.test(arts[j].body || "")) { lastIdx = j; break; }
      }
      const anchor = arts[firstIdx] || null;
      if (!anchor) return { found: false, doc: targetDoc, chapter, anchorArticle: null };
      return {
        found: true,
        doc: targetDoc,
        chapter,
        anchorArticle: anchor,
        sectionSubtitle,
        sectionFirst: arts[firstIdx] || null,
        sectionLast: arts[lastIdx] || null,
        sectionCount: lastIdx - firstIdx + 1,
      };
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
      clauses: el.dataset.clauses ? el.dataset.clauses.split(",") : null,
      point: el.dataset.point || null,
      chapter: el.dataset.chapter || null,
      section: el.dataset.section || null,
      raw: el.dataset.raw || el.textContent
    };
    const resolved = resolveReference(ref, currentDoc);
    let sourceLabel = "", title = "", body = "", metaLeft = "", canOpenDoc = false, openDocId = null, openAnchor = "";
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
        if (ref.clauses && ref.clauses.length > 1) parts.push(`Khoản ${ref.clauses.join(", ")}`);
        else if (ref.clause) parts.push(`Khoản ${ref.clause}`);
        if (ref.point) parts.push(`Điểm ${ref.point}`);
        metaLeft = parts.join(" · ");
        citation = `${art.number} ${tdoc.type} ${tdoc.number}`;
        openAnchor = "art-" + ref.articleNumber;
      } else if (ref.kind === "section" && resolved.chapter) {
        const titleParts = [];
        if (ref.section) titleParts.push(`Mục ${ref.section}`);
        titleParts.push(`Chương ${ref.chapter}`);
        title = titleParts.join(" ");
        const subtitle = (ref.section ? resolved.sectionSubtitle : resolved.chapter.subtitle) || resolved.chapter.subtitle || "";
        const allArts = resolved.chapter.articles || [];
        const first = ref.section ? resolved.sectionFirst : allArts[0];
        const last = ref.section ? resolved.sectionLast : allArts[allArts.length - 1];
        const count = ref.section ? resolved.sectionCount : allArts.length;
        const range = (first && last) ? `${first.number} – ${last.number}` : "";
        body = subtitle + (range ? `\n${range} (${count} điều)` : "");
        metaLeft = tdoc.shortTitle;
        citation = `${title} ${tdoc.type} ${tdoc.number}`;
        if (resolved.anchorArticle) openAnchor = resolved.anchorArticle.id;
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
  }

  function formatArticleExcerpt(article, ref) {
    const clauses = (ref.clauses && ref.clauses.length) ? ref.clauses : (ref.clause ? [ref.clause] : []);
    if (clauses.length) {
      const lines = article.body.split(/\r?\n/);
      const chunks = [];
      for (const cl of clauses) {
        const matchIdx = lines.findIndex(l => new RegExp("^" + cl + "\\.").test(l.trim()));
        if (matchIdx < 0) continue;
        const buf = [lines[matchIdx]];
        for (let i = matchIdx + 1; i < lines.length; i++) {
          if (/^\d+\./.test(lines[i].trim())) break;
          buf.push(lines[i]);
        }
        let excerpt = buf.join("\n").trim();
        if (clauses.length === 1 && ref.point) {
          const pm = excerpt.match(new RegExp("(^|\\n)\\s*" + ref.point + "\\)[^\\n]*", "i"));
          if (pm) { chunks.push(pm[0].trim()); continue; }
        }
        // Cap each clause to keep multi-clause popups readable.
        if (clauses.length > 1 && excerpt.length > 240) excerpt = excerpt.slice(0, 240) + "…";
        chunks.push(excerpt);
      }
      if (chunks.length) return chunks.join("\n\n");
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

  // Re-scan the corpus and refresh the cross-reference index. Walks every
  // article body, runs the citation parser, counts resolved/missing refs,
  // re-renders the landing UI, and shows a toast with the totals.
  function runRefreshIndex() {
    let totalRefs = 0, resolvedRefs = 0, missingRefs = 0;
    const docsWithRefs = new Set();
    for (const id of Object.keys(window.LEGAL_DB)) {
      const doc = window.LEGAL_DB[id];
      let docHasRef = false;
      for (const ch of doc.chapters || []) {
        for (const a of ch.articles || []) {
          const refs = findReferencesInText(a.body || "", { docId: doc.id });
          if (refs.length) docHasRef = true;
          totalRefs += refs.length;
          for (const r of refs) {
            const res = resolveReference(r, doc);
            if (res.found) resolvedRefs++; else missingRefs++;
          }
        }
      }
      if (docHasRef) docsWithRefs.add(doc.id);
    }
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    if (utilDate) utilDate.textContent = `${formatDate(now.toISOString().slice(0, 10))} · ${hh}:${mm}`;
    renderLandingContent();
    const tail = missingRefs ? ` · ${missingRefs} chưa khớp` : "";
    showToast(`Đã cập nhật ${docsWithRefs.size} văn bản · ${totalRefs} liên kết${tail}`);
  }
  const utilRefresh = $("#util-refresh");
  if (utilRefresh) {
    utilRefresh.addEventListener("click", (e) => {
      e.preventDefault();
      runRefreshIndex();
    });
  }

  renderLandingContent();
})();
