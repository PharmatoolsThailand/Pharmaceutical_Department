/* auth.js — ระบบ login 3 ระดับ (ใช้ร่วมกัน hub + admin)
 *   guest  = ไม่ login → เห็นเฉพาะที่ตั้งสาธารณะ
 *   staff  = เจ้าหน้าที่ → เห็น/ใช้แอพ+เอกสารที่ซ่อนได้ (แก้ไม่ได้)
 *   admin  = ผู้ดูแล → จัดการ/ตั้งค่า/สลับการโชว์ ได้ทุกอย่าง
 * รหัสที่กรอกส่งไป Apps Script ตรวจ (STAFF_TOKEN / ADMIN_TOKEN) แล้วคืน role
 * ความปลอดภัยจริงอยู่ฝั่งเซิร์ฟเวอร์ — ฝั่งนี้แค่เก็บ token+role ปลดล็อก UI */

window.Auth = (function () {
  var TKEY = "pharmacyHub.token";
  var RKEY = "pharmacyHub.role";

  function getToken() { return sessionStorage.getItem(TKEY) || localStorage.getItem(TKEY) || ""; }
  function getRole() {
    var r = sessionStorage.getItem(RKEY) || localStorage.getItem(RKEY) || "guest";
    return (r === "admin" || r === "staff") ? r : "guest";
  }
  function isLoggedIn() { return getRole() !== "guest"; }   // staff ขึ้นไป = เห็นของซ่อน
  function isAdmin() { return getRole() === "admin"; }

  function setSession(token, role, remember) {
    sessionStorage.setItem(TKEY, token);
    sessionStorage.setItem(RKEY, role);
    if (remember) { localStorage.setItem(TKEY, token); localStorage.setItem(RKEY, role); }
    else { localStorage.removeItem(TKEY); localStorage.removeItem(RKEY); }
  }
  function clear() {
    sessionStorage.removeItem(TKEY); sessionStorage.removeItem(RKEY);
    localStorage.removeItem(TKEY); localStorage.removeItem(RKEY);
  }

  // โหมด local (ไม่มี backend) → เทียบรหัสทดสอบใน config คืน role หรือ null
  function _localRole(pw) {
    if (pw && pw === HUB_CONFIG.LOCAL_ADMIN_PW) return "admin";
    if (pw && pw === HUB_CONFIG.LOCAL_STAFF_PW) return "staff";
    return null;
  }

  function _fnv1a(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
    return ("0000000" + h.toString(16)).slice(-8);
  }
  // รหัสที่รู้จัก (เทียบ hash ใน config) → ปลดล็อกทันที ไม่ต้องรอเซิร์ฟเวอร์
  function _fastRole(pw) {
    if (!pw) return null;
    var h = _fnv1a(pw);
    if (HUB_CONFIG.ADMIN_HASH && h === HUB_CONFIG.ADMIN_HASH) return "admin";
    if (HUB_CONFIG.STAFF_HASH && h === HUB_CONFIG.STAFF_HASH) return "staff";
    return null;
  }

  function _ensureModal() {
    if (document.getElementById("authModal")) return;
    var wrap = document.createElement("div");
    wrap.id = "authModal";
    wrap.className = "modal-backdrop";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="authTitle">' +
        '<div class="modal__head"><span>🔒</span><h2 id="authTitle">เข้าสู่ระบบ</h2></div>' +
        '<form id="authForm" class="modal__body">' +
          '<label class="field">' +
            '<span class="field__label">รหัสผ่าน</span>' +
            '<input id="authPass" type="password" class="field__input" autocomplete="current-password" required />' +
            '<span class="field__hint">เฉพาะเจ้าหน้าที่ที่ได้รับอนุญาต</span>' +
          '</label>' +
          '<label class="checkrow"><input id="authRemember" type="checkbox" /> จดจำในเครื่องนี้</label>' +
          '<p id="authError" class="form-error" hidden></p>' +
          '<div class="modal__foot">' +
            '<button type="button" class="btn btn--ghost" data-close>ยกเลิก</button>' +
            '<button type="submit" class="btn btn--primary" id="authSubmit">เข้าสู่ระบบ</button>' +
          '</div>' +
        '</form>' +
      '</div>';
    document.body.appendChild(wrap);
  }

  // promptLogin() → Promise<role|false>  (role = "staff"/"admin" ถ้าสำเร็จ, false ถ้ายกเลิก)
  function promptLogin() {
    _ensureModal();
    var modal = document.getElementById("authModal");
    var form = document.getElementById("authForm");
    var pass = document.getElementById("authPass");
    var remember = document.getElementById("authRemember");
    var errEl = document.getElementById("authError");
    var submit = document.getElementById("authSubmit");

    return new Promise(function (resolve) {
      function close(result) { modal.hidden = true; form.onsubmit = null; resolve(result); }
      function showErr(msg) { errEl.textContent = msg; errEl.hidden = false; }
      function reset() { submit.disabled = false; submit.textContent = "เข้าสู่ระบบ"; }

      modal.hidden = false;
      errEl.hidden = true;
      pass.value = "";
      setTimeout(function () { pass.focus(); }, 30);

      modal.querySelector("[data-close]").onclick = function () { close(false); };
      modal.onclick = function (e) { if (e.target === modal) close(false); };

      form.onsubmit = function (e) {
        e.preventDefault();
        var token = pass.value.trim();
        if (!token) return;

        function ok(role) { setSession(token, role, remember.checked); reset(); close(role); }
        function bad(msg) { reset(); showErr(msg || "รหัสผ่านไม่ถูกต้อง"); pass.select(); }

        // fast-path: รหัสที่รู้จัก → เข้าทันที (ไม่ยิงเซิร์ฟเวอร์ = เร็ว ไม่สะดุด unauthorized)
        var fast = _fastRole(token);
        if (fast) { ok(fast); return; }

        submit.disabled = true; submit.textContent = "กำลังตรวจสอบ…";

        if (!HUB_CONFIG.APPS_SCRIPT_URL) {
          var r = _localRole(token);
          if (r) ok(r); else bad("รหัสผ่านไม่ถูกต้อง");
          return;
        }

        // รหัสที่ไม่รู้จัก → ตรวจกับเซิร์ฟเวอร์ · ลองซ้ำครั้งเดียวถ้าตอบกลับเพี้ยน/เน็ตสะดุด
        function verify(retry) {
          apiPost({ action: "verify", token: token }).then(function (res) {
            if (res && res.ok && (res.role === "admin" || res.role === "staff")) { ok(res.role); return; }
            if (retry && (!res || res.unparsed)) { setTimeout(function () { verify(false); }, 400); return; }
            if (res) console.warn("[verify] server:", res);
            bad("รหัสผ่านไม่ถูกต้อง");
          }).catch(function (err) {
            if (retry) { setTimeout(function () { verify(false); }, 400); return; }
            console.warn("[verify] เชื่อมต่อไม่ได้:", err);
            bad("รหัสผ่านไม่ถูกต้อง");
          });
        }
        verify(true);
      };
    });
  }

  return {
    getToken: getToken, getRole: getRole,
    isLoggedIn: isLoggedIn, isAdmin: isAdmin,
    clear: clear, promptLogin: promptLogin
  };
})();
