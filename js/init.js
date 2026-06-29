/* init.js — บูตแอพ (โหลดท้ายสุด) */

(function () {
  var searchEl = document.getElementById("searchInput");
  var refreshEl = document.getElementById("refreshBtn");

  // วาดทั้งกริดแอพ + พื้นที่เอกสาร
  function renderAll() {
    renderGrid();
    if (window.DocsPanel) DocsPanel.render();
  }

  searchEl.addEventListener("input", debounce(function (e) {
    HubUI.query = e.target.value;
    renderGrid();
  }, 120));

  // กด "/" เพื่อโฟกัสช่องค้นหา, Esc เพื่อล้าง
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== searchEl) {
      e.preventDefault(); searchEl.focus();
    } else if (e.key === "Escape" && document.activeElement === searchEl) {
      searchEl.value = ""; HubUI.query = ""; renderGrid();
    }
  });

  function refresh(force) {
    if (force) refreshEl.classList.add("is-spinning");
    return loadRegistry({ force: force }, renderAll).then(function (res) {
      refreshEl.classList.remove("is-spinning");
      if (res.error && HubState.source !== "online") {
        showStatus("โหลดออนไลน์ไม่ได้ — แสดงข้อมูลล่าสุดที่มี (" +
          (HubState.source === "cache" ? "แคช" : "ตั้งต้น") + ")", "warn");
      } else if (res.source === "online") {
        showStatus("");
      }
      return res;
    });
  }
  window.HubRefresh = refresh;            // ให้ docs.js เรียกรีโหลดหลังบันทึก

  refreshEl.addEventListener("click", function () { refresh(true); });

  // ----- พื้นที่ login / จัดการ -----
  var authArea = document.getElementById("authArea");
  function renderAuth() {
    if (Auth.isLoggedIn()) {
      authArea.innerHTML =
        '<a class="hub-authbtn hub-authbtn--solid" href="admin.html">🛠 จัดการแอพ</a>' +
        '<button class="hub-authbtn" id="logoutBtn" title="ออกจากระบบ">ออกจากระบบ</button>';
      document.getElementById("logoutBtn").onclick = function () {
        Auth.clear(); renderAuth();
      };
    } else {
      authArea.innerHTML = '<button class="hub-authbtn" id="loginBtn">🔒 เข้าสู่ระบบ</button>';
      document.getElementById("loginBtn").onclick = function () {
        Auth.promptLogin().then(function (ok) { if (ok) renderAuth(); });
      };
    }
    if (window.DocsPanel) DocsPanel.render();   // โชว์/ซ่อนพื้นที่เอกสารตามสถานะ login
  }
  renderAuth();

  showSkeleton();
  refresh(false);
})();
