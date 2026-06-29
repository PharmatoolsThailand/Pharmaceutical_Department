/* utils.js — ตัวช่วยทั่วไป (ไม่มี state, ไม่แตะ DOM นอกจากที่ส่งเข้ามา) */

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

// ปุ่มสลับการมองเห็นสาธารณะ (ใช้ทั้งแอพ + เอกสารในหน้าจัดการ)
function pubPill(item) {
  return item.public
    ? '<button class="pill-btn pill-btn--public" data-toggle="' + escapeHtml(item.id) +
        '" title="กำลังโชว์สาธารณะ — คลิกเพื่อซ่อน">🌐 สาธารณะ</button>'
    : '<button class="pill-btn pill-btn--staff" data-toggle="' + escapeHtml(item.id) +
        '" title="เฉพาะเจ้าหน้าที่ — คลิกเพื่อโชว์สาธารณะ">🔒 เจ้าหน้าที่</button>';
}

// แยกสตริงแท็ก "a, b , c" → ["a","b","c"]
function parseTags(raw) {
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return String(raw || "")
    .split(/[,;]/)
    .map(function (t) { return t.trim(); })
    .filter(Boolean);
}

function normalize(s) {
  return String(s || "").toLowerCase().trim();
}

// ไฮไลต์คำค้นในข้อความ (escape ก่อน แล้วค่อยใส่ <mark>)
function highlight(text, query) {
  var safe = escapeHtml(text);
  var q = normalize(query);
  if (!q) return safe;
  var idx = normalize(safe).indexOf(q);
  if (idx === -1) return safe;
  return safe.slice(0, idx) + '<mark class="hit">' + safe.slice(idx, idx + q.length) + "</mark>" + safe.slice(idx + q.length);
}

function debounce(fn, ms) {
  var t;
  return function () {
    var args = arguments, self = this;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(self, args); }, ms);
  };
}

// ดึง array จาก response ของ Apps Script (รองรับทั้ง array เดิม และ object {apps,docs,cats})
function pickList(data, key) {
  if (Array.isArray(data)) return key === "apps" ? data : [];
  if (data && Array.isArray(data[key])) return data[key];
  return [];
}

// หมวดหมู่ปัจจุบัน — จากระบบ (HubState.cats) ถ้าว่างใช้ค่าตั้งต้น CATS_SEED
function getCats() {
  if (window.HubState && HubState.cats && HubState.cats.length) return HubState.cats;
  return window.CATS_SEED || [];
}

// ปรับ record หมวดหมู่ (ชีท Categories) ให้ครบฟิลด์
function normalizeCat(raw, i) {
  return {
    id: String(raw.id || ("cat-" + i)).trim(),
    name: String(raw.name || "ไม่มีชื่อ").trim(),
    icon: String(raw.icon || "📦").trim(),
    order: Number(raw.order) || 999
  };
}

// แปลงค่า public จากชีท/seed → boolean (def = ค่าเริ่มต้นถ้าเว้นว่าง)
function parsePublic(raw, def) {
  if (raw === true) return true;
  if (raw === false) return false;
  var s = String(raw == null ? "" : raw).trim().toLowerCase();
  if (s === "") return def;
  if (["1", "true", "yes", "y", "public", "สาธารณะ", "ใช่"].indexOf(s) !== -1) return true;
  if (["0", "false", "no", "n", "staff", "private", "ไม่"].indexOf(s) !== -1) return false;
  return def;
}

// ปรับ record ลิงก์เอกสาร (ชีท Docs) ให้ครบฟิลด์
function normalizeDoc(raw, i) {
  return {
    id: String(raw.id || ("doc-" + i)).trim(),
    title: String(raw.title || raw.name || "ไม่มีชื่อ").trim(),
    url: String(raw.url || raw.path || "").trim(),
    note: String(raw.note || raw.desc || "").trim(),
    public: parsePublic(raw.public, false),   // เอกสาร: ค่าเริ่มต้น = เฉพาะเจ้าหน้าที่
    order: Number(raw.order) || 999
  };
}

// ปรับ record ดิบ (จากชีท/seed) ให้ครบฟิลด์และชนิดถูกต้อง
function normalizeApp(raw, i) {
  return {
    id: String(raw.id || ("app-" + i)).trim(),
    name: String(raw.name || "ไม่มีชื่อ").trim(),
    desc: String(raw.desc || "").trim(),
    category: String(raw.category || "other").trim().toLowerCase(),
    icon: String(raw.icon || "📦").trim(),
    path: String(raw.path || "").trim(),
    tags: parseTags(raw.tags),
    status: String(raw.status || "active").trim().toLowerCase(),
    public: parsePublic(raw.public, true),    // แอพ: ค่าเริ่มต้น = สาธารณะ
    order: Number(raw.order) || 999
  };
}
