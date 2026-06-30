/* pwa.js — ติดตั้งเว็บเป็นแอป (PWA install)
 * - ลงทะเบียน service worker (เงื่อนไขให้ติดตั้งได้)
 * - ปุ่ม "ติดตั้งแอป" ใน sidebar: คลิกแล้วเรียกหน้าต่างติดตั้งของเบราว์เซอร์
 * - ถ้าเบราว์เซอร์ยังไม่พร้อม (iOS / file://) → เปิด modal สอนติดตั้งด้วยมือ
 * ใช้ได้เฉพาะตอนเสิร์ฟผ่าน https/localhost — เปิดด้วย file:// ปุ่มจะซ่อน */

(function () {
  var deferredPrompt = null;

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    if (location.protocol === "file:") return;          // file:// ลง SW ไม่ได้
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function (err) {
        console.warn("[pwa] ลงทะเบียน service worker ไม่สำเร็จ:", err);
      });
    });
  }

  function showBtn(show) {
    var btn = document.getElementById("installAppBtn");
    if (btn) btn.hidden = !show;
  }

  function ensureModal() {
    if (document.getElementById("installModal")) return;
    var wrap = document.createElement("div");
    wrap.id = "installModal";
    wrap.className = "modal-backdrop";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal modal--install" role="dialog" aria-modal="true" aria-labelledby="installTitle">' +
        '<div class="modal__head">' +
          '<span>📲</span><h2 id="installTitle">ติดตั้งแอป</h2>' +
          '<button type="button" class="modal__close" data-close aria-label="ปิด">✕</button>' +
        '</div>' +
        '<div class="modal__body">' +
          '<button type="button" class="btn btn--primary btn--block" id="installNowBtn">💻 ติดตั้งลงเครื่องนี้</button>' +
          '<p class="install-hint" id="installPcHint">* ใช้ได้กับ Google Chrome / Microsoft Edge บนคอมพิวเตอร์</p>' +
          '<div class="install-divider">📱 ติดตั้งบนมือถือ / แท็บเล็ต</div>' +
          '<div class="install-guide-wrap" id="installGuideWrap">' +
            '<img class="install-guide" id="installGuideImg" src="assets/images/install-guide.png" alt="วิธีติดตั้งแอปบนมือถือ" />' +
            '<p class="install-guide-cap">🔍 แตะรูปเพื่อดูเต็มจอ</p>' +
            '<div class="install-guide-fallback">' +
              '<b>iPhone / iPad (Safari):</b> แตะ แชร์ <span class="kbd">⬆️</span> → <b>เพิ่มลงในหน้าจอโฮม</b><br>' +
              '<b>Android (Chrome):</b> แตะเมนู <span class="kbd">⋮</span> → <b>ติดตั้งแอป</b>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(wrap);

    wrap.querySelector("[data-close]").onclick = function () { wrap.hidden = true; };
    wrap.onclick = function (e) { if (e.target === wrap) wrap.hidden = true; };
    document.getElementById("installNowBtn").onclick = doInstall;
    // ลองหารูป install-guide หลายนามสกุล · ไม่เจอเลย → แสดงขั้นตอนแบบข้อความแทน
    var gimg = document.getElementById("installGuideImg");
    var exts = ["png", "jpg", "jpeg", "webp"], i = 0;
    gimg.onerror = function () {
      i++;
      if (i < exts.length) gimg.src = "assets/images/install-guide." + exts[i];
      else document.getElementById("installGuideWrap").classList.add("is-missing");
    };
    gimg.onclick = function () { openLightbox(gimg.currentSrc || gimg.src); };
  }

  // แตะรูปวิธีติดตั้ง → ดูเต็มจอ
  function openLightbox(src) {
    var lb = document.getElementById("installLightbox");
    if (!lb) {
      lb = document.createElement("div");
      lb.id = "installLightbox";
      lb.className = "install-lightbox";
      lb.hidden = true;
      lb.innerHTML = '<img alt="วิธีติดตั้งแอป" />';
      lb.onclick = function () { lb.hidden = true; };
      document.body.appendChild(lb);
    }
    lb.querySelector("img").src = src;
    lb.hidden = false;
  }

  function openModal() {
    ensureModal();
    var modal = document.getElementById("installModal");
    var now = document.getElementById("installNowBtn");
    var hint = document.getElementById("installPcHint");
    if (deferredPrompt) {
      now.disabled = false;
      hint.textContent = "* ใช้ได้กับ Google Chrome / Microsoft Edge บนคอมพิวเตอร์";
    } else {
      now.disabled = true;
      hint.textContent = "* เบราว์เซอร์นี้ยังติดตั้งอัตโนมัติไม่ได้ — ใช้วิธีด้านล่าง";
    }
    modal.hidden = false;
  }

  function doInstall() {
    if (!deferredPrompt) { openModal(); return; }
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then(function (res) {
      if (res && res.outcome === "accepted") { showBtn(false); }
      deferredPrompt = null;
    });
  }

  function init() {
    registerSW();
    if (isStandalone()) { showBtn(false); return; }   // เปิดจากแอปที่ติดตั้งแล้ว = ไม่ต้องโชว์
    showBtn(true);                                     // โชว์ปุ่มเสมอ (iOS ไม่ยิง beforeinstallprompt)

    var btn = document.getElementById("installAppBtn");
    if (btn) btn.onclick = function () {
      if (deferredPrompt) doInstall(); else openModal();
    };

    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredPrompt = e;
      showBtn(true);                                    // พร้อมติดตั้ง → โชว์ปุ่ม
    });

    window.addEventListener("appinstalled", function () {
      deferredPrompt = null;
      showBtn(false);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
