/* Code.gs — Apps Script Web App: registry ของ Pharmacy Hub บน Google Sheet
 * 2 ชีท:
 *   "Apps"       : id | name | desc | category | icon | path | tags | status | public | order
 *   "Docs"       : id | title | url | note | public | order   (public = TRUE/FALSE โชว์สาธารณะ)
 *   "Categories" : id | name | icon | order                   (หมวดหมู่แอป)
 *
 * Deploy: Deploy ▸ New deployment ▸ Web app (Execute as: Me / Who has access: Anyone)
 * คัดลอก URL (.../exec) ไปวางใน js/config.js → APPS_SCRIPT_URL
 *
 * GET  /exec  → { apps: [...], docs: [...] }
 * POST /exec (text/plain JSON) — token ตรวจกับ STAFF_TOKEN/ADMIN_TOKEN:
 *   { action:"verify", token } → { ok, role:"staff"|"admin" }
 *   { collection, action:"upsert"|"delete", item/id, token } → ต้อง role=admin
 */

var SHEETS = {
  apps: { name: "Apps", headers: ["id", "name", "desc", "category", "icon", "path", "tags", "status", "public", "order"] },
  docs: { name: "Docs", headers: ["id", "title", "url", "note", "public", "order"] },
  cats: {
    name: "Categories", headers: ["id", "name", "icon", "order"],
    seed: [
      { id: "dosing", name: "คำนวณขนาดยา", icon: "💊", order: 1 },
      { id: "forms", name: "เอกสาร / ฟอร์ม", icon: "📋", order: 2 },
      { id: "admin", name: "ตารางงาน / บริหาร", icon: "📅", order: 3 },
      { id: "tools", name: "เครื่องมือ", icon: "🧰", order: 4 },
      { id: "other", name: "อื่น ๆ", icon: "📦", order: 5 }
    ]
  }
};

function _sheet(conf) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(conf.name);
  if (!sh) {
    sh = ss.insertSheet(conf.name);
    sh.getRange(1, 1, 1, conf.headers.length).setValues([conf.headers]).setFontWeight("bold");
    // ใส่ข้อมูลเริ่มต้น (เช่น หมวดหมู่ตั้งต้น) ตอนสร้างชีทครั้งแรก
    if (conf.seed && conf.seed.length) {
      conf.seed.forEach(function (row) {
        sh.appendRow(conf.headers.map(function (h) { return row[h] != null ? row[h] : ""; }));
      });
    }
  }
  return sh;
}

function _readAll(conf) {
  var sh = _sheet(conf);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var head = values[0].map(function (h) { return String(h).trim(); });
  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    if (!String(row[0]).trim()) continue;          // ข้ามแถวที่ไม่มี id
    var obj = {};
    for (var c = 0; c < head.length; c++) obj[head[c]] = row[c];
    out.push(obj);
  }
  return out;
}

function _json(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return _json({
    apps: _readAll(SHEETS.apps),
    docs: _readAll(SHEETS.docs),
    cats: _readAll(SHEETS.cats)
  });
}

// คืน role ของ token: "admin" / "staff" / null
function _role(token) {
  if (!token) return null;
  var props = PropertiesService.getScriptProperties();
  var admin = props.getProperty("ADMIN_TOKEN");
  var staff = props.getProperty("STAFF_TOKEN");
  var t = String(token).trim();                       // ตัดเว้นวรรค/ขึ้นบรรทัดที่ติดมา
  if (admin && t === String(admin).trim()) return "admin";
  if (staff && t === String(staff).trim()) return "staff";
  return null;
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents || "{}");
    var action = body.action || "upsert";
    var role = _role(body.token);

    // verify: คืน role ให้ฝั่งเว็บรู้ระดับสิทธิ์
    if (action === "verify") {
      return role ? _json({ ok: true, role: role }) : _json({ ok: false, error: "unauthorized" });
    }

    // เขียน/ลบ ต้องเป็น admin เท่านั้น
    if (role !== "admin") {
      return _json({ ok: false, error: "unauthorized" });
    }

    var conf = SHEETS[body.collection || "apps"];
    if (!conf) return _json({ ok: false, error: "bad-collection" });

    if (action === "delete") {
      _deleteById(conf, body.id);
      return _json({ ok: true, action: "delete", id: body.id });
    }

    var item = body.item || body.app || body;
    if (!item.id) item.id = "item-" + Date.now();
    _upsert(conf, item);
    return _json({ ok: true, action: "upsert", id: item.id });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

/* เรียกครั้งเดียวเพื่อตั้งรหัส 2 ระดับ (แก้ค่าก่อนรัน แล้วรันจาก Editor)
 * หรือไปตั้งเองที่ Project Settings ▸ Script Properties: STAFF_TOKEN, ADMIN_TOKEN */
function setup_setTokens() {
  var props = PropertiesService.getScriptProperties();
  props.setProperty("STAFF_TOKEN", "pharmacy");
  props.setProperty("ADMIN_TOKEN", "raphiphat.13495");
}

/* ดูค่ารหัสที่เก็บจริง — เปิด Apps Script ▸ เลือกฟังก์ชันนี้ ▸ Run ▸ ดู Execution log
 * ไม่ต้อง deploy (ตัวแก้ไขรันโค้ดล่าสุดเสมอ) · [...] ครอบไว้ให้เห็นเว้นวรรคที่ติดมา */
function setup_showTokens() {
  var p = PropertiesService.getScriptProperties();
  Logger.log("keys ทั้งหมด: " + p.getKeys().join(", "));
  Logger.log("ADMIN_TOKEN = [" + p.getProperty("ADMIN_TOKEN") + "]");
  Logger.log("STAFF_TOKEN = [" + p.getProperty("STAFF_TOKEN") + "]");
}

function _rowIndexById(conf, id) {
  var sh = _sheet(conf);
  var ids = sh.getRange(2, 1, Math.max(sh.getLastRow() - 1, 1), 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() === String(id).trim()) return i + 2; // 1-based + header
  }
  return -1;
}

function _upsert(conf, item) {
  var sh = _sheet(conf);
  var rowArr = conf.headers.map(function (h) { return item[h] != null ? item[h] : ""; });
  var idx = _rowIndexById(conf, item.id);
  if (idx === -1) sh.appendRow(rowArr);
  else sh.getRange(idx, 1, 1, conf.headers.length).setValues([rowArr]);
}

function _deleteById(conf, id) {
  var idx = _rowIndexById(conf, id);
  if (idx !== -1) _sheet(conf).deleteRow(idx);
}
