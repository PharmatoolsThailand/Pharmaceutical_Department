/* api.js — เรียก Apps Script Web App (อ่าน/เขียน)
 * POST ใช้ Content-Type text/plain เพื่อเลี่ยง CORS preflight (ตามแพทเทิร์น Consult form) */

// คืน payload ดิบ ({apps, docs} หรือ array เดิม) — ผู้เรียกดึงด้วย pickList()
function apiGet() {
  var url = HUB_CONFIG.APPS_SCRIPT_URL;
  if (!url) return Promise.reject(new Error("no-url"));
  return fetch(url, { method: "GET", redirect: "follow" })
    .then(function (r) {
      if (!r.ok) throw new Error("http-" + r.status);
      return r.json();
    });
}

/* ส่ง action ไป Apps Script (upsert/delete/verify)
 * คืน Promise<{ok, ...}>; ถ้าอ่าน response ไม่ได้ (CORS opaque) ให้ถือว่าน่าจะสำเร็จ
 * แล้วให้ผู้เรียก reload ยืนยันเอง */
function apiPost(payload) {
  var url = HUB_CONFIG.APPS_SCRIPT_URL;
  if (!url) return Promise.reject(new Error("no-url"));
  return fetch(url, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  })
    .then(function (r) {
      return r.text().then(function (txt) {
        try { return JSON.parse(txt); }
        catch (e) { return { ok: true, unparsed: true }; }
      });
    });
}
