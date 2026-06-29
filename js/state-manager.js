/* state-manager.js — โหลด/เก็บ registry (apps + docs + cats)
 * ลำดับความพยายาม: fetch จาก Apps Script → cache (localStorage) → seed
 * cache ช่วยให้เปิดได้แม้ออฟไลน์ และโหลดไวในครั้งถัดไป */

window.HubState = {
  apps: [],
  docs: [],
  cats: [],
  source: "seed",      // "online" | "cache" | "seed"
  fetchedAt: 0
};

function _readCache() {
  try {
    var raw = localStorage.getItem(HUB_CONFIG.CACHE_KEY);
    if (!raw) return null;
    var obj = JSON.parse(raw);
    if (!obj || !Array.isArray(obj.apps)) return null;
    if (!Array.isArray(obj.docs)) obj.docs = [];
    if (!Array.isArray(obj.cats)) obj.cats = [];
    return obj;
  } catch (e) { return null; }
}

function _writeCache(apps, docs, cats) {
  try {
    localStorage.setItem(HUB_CONFIG.CACHE_KEY,
      JSON.stringify({ apps: apps, docs: docs, cats: cats, at: Date.now() }));
  } catch (e) { /* โควต้าเต็ม/โหมดส่วนตัว — ข้ามได้ */ }
}

function _apply(rawApps, rawDocs, rawCats, source, at) {
  HubState.apps = (rawApps || []).map(normalizeApp).sort(function (a, b) {
    return (a.order - b.order) || a.name.localeCompare(b.name, "th");
  });
  HubState.docs = (rawDocs || []).map(normalizeDoc).sort(function (a, b) {
    return (a.order - b.order) || a.title.localeCompare(b.title, "th");
  });
  HubState.cats = (rawCats || []).map(normalizeCat).sort(function (a, b) {
    return (a.order - b.order) || a.name.localeCompare(b.name, "th");
  });
  HubState.source = source;
  HubState.fetchedAt = at || Date.now();
}

/* loadRegistry(opts)
 *  opts.force = true → ข้าม cache สด บังคับ fetch ใหม่
 *  คืน Promise<{source}> ; เรียก onUpdate ทุกครั้งที่ข้อมูลเปลี่ยน */
function loadRegistry(opts, onUpdate) {
  opts = opts || {};
  var cached = _readCache();
  var fresh = cached && (Date.now() - cached.at) < HUB_CONFIG.CACHE_TTL_MS;

  // แสดง cache ทันทีถ้ามี (เร็ว) — แล้วค่อยรีเฟรชเบื้องหลัง
  if (cached && !opts.force) {
    _apply(cached.apps, cached.docs, cached.cats, "cache", cached.at);
    if (onUpdate) onUpdate();
  }

  // ถ้า cache สดและไม่ได้บังคับ → พอแล้ว
  if (fresh && !opts.force) return Promise.resolve({ source: "cache" });

  return apiGet()
    .then(function (data) {
      var apps = pickList(data, "apps");
      var docs = pickList(data, "docs");
      var cats = pickList(data, "cats");
      _writeCache(apps, docs, cats);
      _apply(apps, docs, cats, "online", Date.now());
      if (onUpdate) onUpdate();
      return { source: "online" };
    })
    .catch(function (err) {
      // ออนไลน์ไม่ได้ — ถ้ายังไม่มีอะไรแสดง ให้ fallback
      if (!HubState.apps.length && !HubState.docs.length && !HubState.cats.length) {
        if (cached) { _apply(cached.apps, cached.docs, cached.cats, "cache", cached.at); }
        else { _apply(window.APPS_SEED || [], window.DOCS_SEED || [], window.CATS_SEED || [], "seed", 0); }
        if (onUpdate) onUpdate();
      }
      return { source: HubState.source, error: err.message };
    });
}
