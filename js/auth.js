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
            '<span class="field__hint">ใส่รหัสเจ้าหน้าที่ หรือ รหัสผู้ดูแล</span>' +
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
        submit.disabled = true; submit.textContent = "กำลังตรวจสอบ…";

        function ok(role) { setSession(token, role, remember.checked); reset(); close(role); }
        function bad(msg) { reset(); showErr(msg); pass.select(); }

        if (!HUB_CONFIG.APPS_SCRIPT_URL) {
          var r = _localRole(token);
          if (r) ok(r); else bad("รหัสผ่านไม่ถูกต้อง");
          return;
        }

        apiPost({ action: "verify", token: token }).then(function (res) {
          if (res && res.ok && (res.role === "admin" || res.role === "staff")) { ok(res.role); return; }
          if (res && res.unparsed) { bad("เซิร์ฟเวอร์ตอบกลับอ่านไม่ได้ — มัก deploy เวอร์ชันเก่า หรือ Who has access ไม่ใช่ Anyone (ดู console)"); console.warn("[verify] อ่าน response ไม่ได้:", res); return; }
          if (res && res.error) { bad("เซิร์ฟเวอร์ปฏิเสธ: " + res.error + " — ตรวจ STAFF_TOKEN/ADMIN_TOKEN ใน Script Properties ให้ตรงกับที่พิมพ์"); return; }
          bad("รหัสผ่านไม่ถูกต้อง (server ไม่คืน role) — ตรวจว่า deploy Code.gs เวอร์ชันใหม่แล้ว");
        }).catch(function (err) { bad("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้: " + (err && err.message ? err.message : err)); });
      };
    });
  }

  return {
    getToken: getToken, getRole: getRole,
    isLoggedIn: isLoggedIn, isAdmin: isAdmin,
    clear: clear, promptLogin: promptLogin
  };
})();
