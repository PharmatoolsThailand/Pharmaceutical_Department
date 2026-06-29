/* ui-handler.js — วาด DOM, ค้นหา, สถานะ (อ่าน HubState, ไม่ fetch เอง) */

window.HubUI = { query: "" };

function _categoryMeta(id) {
  var found = getCats().find(function (c) { return c.id === id; });
  return found || { id: id, name: id || "อื่น ๆ", icon: "📦" };
}

function _matches(app, q) {
  if (!q) return true;
  var hay = normalize([app.name, app.desc, app.tags.join(" ")].join(" "));
  return hay.indexOf(q) !== -1;
}

// แถว launcher (คลิกเปิดแอพ) — สไตล์เดียวกับลิสต์หน้า Admin
function _rowHTML(app, q) {
  var meta = _categoryMeta(app.category);
  var statusPill = app.status === "beta" ? '<span class="pill pill--beta">BETA</span>'
    : app.status === "soon" ? '<span class="pill pill--soon">เร็ว ๆ นี้</span>' : "";
  var clickable = app.status !== "soon" && !!app.path;
  var href = clickable ? escapeHtml(app.path) : "#";
  // ไม่มี target=_blank → คลิกซ้ายเปิดใน iframe (app.js ดักไว้), ctrl/กลางคลิกเปิดแท็บใหม่ตามปกติ
  return '<a class="item-row item-row--link" href="' + href + '"' +
    (clickable ? ' data-app-id="' + escapeHtml(app.id) + '"' : "") +
    ' data-status="' + escapeHtml(app.status) + '" data-id="' + escapeHtml(app.id) + '">' +
    '<div class="item-row__icon">' + escapeHtml(app.icon) + "</div>" +
    '<div class="item-row__main">' +
      '<div class="item-row__name">' + highlight(app.name, q) + "</div>" +
      (app.desc ? '<div class="item-row__sub">' + highlight(app.desc, q) + "</div>" : "") +
    "</div>" +
    '<div class="item-row__meta">' +
      '<span class="pill pill--cat">' + escapeHtml(meta.icon + " " + meta.name) + "</span>" +
      statusPill +
      (clickable ? '<span class="item-row__open">เปิด ↗</span>' : "") +
    "</div>" +
  "</a>";
}

function renderGrid() {
  var grid = document.getElementById("grid");
  var q = normalize(HubUI.query);
  var order = getCats().map(function (c) { return c.id; });
  var showAll = !!(window.Auth && Auth.isLoggedIn());

  var visible = HubState.apps.filter(function (a) { return (showAll || a.public) && _matches(a, q); })
    .sort(function (a, b) {
      var ia = order.indexOf(a.category), ib = order.indexOf(b.category);
      ia = ia === -1 ? 99 : ia; ib = ib === -1 ? 99 : ib;
      return (ia - ib) || (a.order - b.order) || a.name.localeCompare(b.name, "th");
    });

  if (!visible.length) {
    grid.innerHTML = '<div class="hub-empty">' +
      (q ? 'ไม่พบแอปที่ตรงกับ “' + escapeHtml(HubUI.query) + '”'
         : 'ยังไม่มีแอปพลิเคชัน — เพิ่มได้ที่เมนู “จัดการ”') + "</div>";
    _renderFooter();
    return;
  }

  grid.innerHTML = '<div class="item-list">' +
    visible.map(function (a) { return _rowHTML(a, q); }).join("") +
  "</div>";

  _renderFooter();
}

// launcher เอกสาร (ดูอย่างเดียว · คลิกเปิดลิงก์) — สไตล์เดียวกับ launcher แอพ
function renderDocsGrid() {
  var el = document.getElementById("docsLauncher");
  if (!el) return;
  var showAll = !!(window.Auth && Auth.isLoggedIn());
  var docs = (HubState.docs || []).filter(function (d) { return showAll || d.public; })
    .sort(function (a, b) {
      return (a.order - b.order) || a.title.localeCompare(b.title, "th");
    });
  if (!docs.length) {
    el.innerHTML = '<div class="hub-empty">' +
      (showAll ? "ยังไม่มีรายการ — เพิ่มได้ที่เมนู “จัดการ”" : "ยังไม่มีรายการสาธารณะ") + "</div>";
    return;
  }
  el.innerHTML = '<div class="item-list">' + docs.map(function (d) {
    var clickable = !!d.url;
    return '<a class="item-row item-row--link" href="' + (clickable ? escapeHtml(d.url) : "#") +
      '" target="_blank" rel="noopener">' +
      '<div class="item-row__icon">🔗</div>' +
      '<div class="item-row__main">' +
        '<div class="item-row__name">' + escapeHtml(d.title) + "</div>" +
        (d.note ? '<div class="item-row__sub">' + escapeHtml(d.note) + "</div>" : "") +
      "</div>" +
      '<div class="item-row__meta">' +
        (clickable ? '<span class="item-row__open">เปิด ↗</span>' : "") +
      "</div>" +
    "</a>";
  }).join("") + "</div>";
}

function _renderFooter() {
  var labels = { online: "ซิงก์จาก Google Sheet", cache: "จากแคช (offline)", seed: "ข้อมูลตั้งต้น" };
  var foot = document.getElementById("footerMeta");
  var time = HubState.fetchedAt ? new Date(HubState.fetchedAt).toLocaleString("th-TH") : "—";
  foot.textContent = "ทั้งหมด " + HubState.apps.length + " แอพ · " +
    (labels[HubState.source] || HubState.source) + " · อัปเดต " + time;
}

function showStatus(msg, kind) {
  var bar = document.getElementById("statusBar");
  if (!msg) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.textContent = msg;
  if (kind) bar.setAttribute("data-kind", kind); else bar.removeAttribute("data-kind");
}

function showSkeleton() {
  var grid = document.getElementById("grid");
  var rows = new Array(5).fill('<div class="skel-row"></div>').join("");
  grid.innerHTML = '<div class="hub-skeleton">กำลังโหลดรายการแอพ…<div class="item-list">' + rows + "</div></div>";
}
