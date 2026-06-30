/* app.js — คอนโทรลเลอร์หน้าเดียว (single-page sidebar shell)
 * สลับมุมมองด้วย JS ไม่เปลี่ยนหน้า → ไม่มีปัญหา cache แบบ navigate ข้ามไฟล์
 * มุมมอง: home (launcher + เอกสาร) / apps (จัดการแอพ) / settings (ตั้งค่า) */

(function () {
  var state = { view: "home", q: "", editing: null, catEditing: null };

  var els = {
    nav: document.querySelectorAll(".admin-nav__item[data-view]"),
    manageNav: document.getElementById("manageNav"),
    views: {
      home: document.getElementById("viewHome"),
      docs: document.getElementById("viewDocs"),
      manage: document.getElementById("viewManage"),
      settings: document.getElementById("viewSettings")
    },
    title: document.getElementById("viewTitle"),
    count: document.getElementById("viewCount"),
    search: document.getElementById("searchInput"),
    searchWrap: document.getElementById("searchWrap"),
    refreshBtn: document.getElementById("refreshBtn"),
    authArea: document.getElementById("authArea"),
    warn: document.getElementById("backendWarn"),
    appList: document.getElementById("appList"),
    appEmpty: document.getElementById("appEmpty"),
    appCount: document.getElementById("appCount"),
    docCount: document.getElementById("docCount"),
    addAppBtn: document.getElementById("addAppBtn"),
    addDocBtn: document.getElementById("addDocBtn"),
    settingsBox: document.getElementById("settingsBox"),
    appModal: document.getElementById("appModal"),
    catSelect: document.getElementById("catSelect"),
    catList: document.getElementById("catList"),
    catEmpty: document.getElementById("catEmpty"),
    catCount: document.getElementById("catCount"),
    addCatBtn: document.getElementById("addCatBtn"),
    catModal: document.getElementById("catModal"),
    viewApp: document.getElementById("viewApp"),
    appFrame: document.getElementById("appFrame"),
    appIcon: document.getElementById("appIcon"),
    appName: document.getElementById("appName"),
    appReload: document.getElementById("appReload"),
    appOpenNew: document.getElementById("appOpenNew"),
    appBack: document.getElementById("appBack"),
    grid: document.getElementById("grid")
  };

  // ---------- บูต ----------
  function start() {
    if (!HUB_CONFIG.APPS_SCRIPT_URL) els.warn.hidden = false;
    fillCategorySelect();
    bindEvents();
    renderAuth();
    setView("home");
    showSkeleton();
    refresh(false);
  }

  function bindEvents() {
    els.nav.forEach(function (b) {
      b.onclick = function () {
        closeDrawer();
        var v = b.getAttribute("data-view");
        if ((v === "manage" || v === "settings") && !Auth.isAdmin()) {
          Auth.promptLogin().then(function (role) {
            renderAuth();
            if (role !== "guest") refresh(true);  // โหลดรายการที่ซ่อนตามสิทธิ์ใหม่
            if (role === "admin") setView(v);      // staff login ก็ยังเข้าจัดการไม่ได้
          });
          return;
        }
        setView(v);
      };
    });

    var drawerToggle = document.getElementById("drawerToggle");
    var drawerBackdrop = document.getElementById("drawerBackdrop");
    if (drawerToggle) drawerToggle.onclick = function () { document.body.classList.toggle("drawer-open"); };
    if (drawerBackdrop) drawerBackdrop.onclick = closeDrawer;
    els.search.addEventListener("input", debounce(function (e) {
      HubUI.query = e.target.value;
      if (state.view === "home") renderGrid();
    }, 120));
    els.refreshBtn.onclick = function () { refresh(true); };
    els.addAppBtn.onclick = function () { openAppForm(null); };
    els.addDocBtn.onclick = function () { if (window.DocsPanel) DocsPanel.openAdd(); };
    els.addCatBtn.onclick = function () { openCatForm(null); };
    bindModal(els.appModal, "appForm", onSaveApp);
    bindModal(els.catModal, "catForm", onSaveCat);

    // คลิกแอพในหน้าแรก → เปิดใน iframe (sidebar อยู่ตลอด); ctrl/กลางคลิก = แท็บใหม่
    els.grid.addEventListener("click", function (e) {
      var a = e.target.closest("[data-app-id]");
      if (!a) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
      e.preventDefault();
      var app = HubState.apps.find(function (x) { return x.id === a.getAttribute("data-app-id"); });
      if (app) openApp(app);
    });
    els.appBack.onclick = function () { setView("home"); };
    els.appReload.onclick = function () {
      if (state.currentApp) els.appFrame.src = state.currentApp.path;
    };

    document.addEventListener("keydown", function (e) {
      if (e.key === "/" && document.activeElement !== els.search && !els.searchWrap.hidden) {
        e.preventDefault(); els.search.focus();
      }
    });
  }

  function bindModal(modal, formId, onSubmit) {
    modal.querySelectorAll("[data-close]").forEach(function (b) {
      b.onclick = function () { modal.hidden = true; state.editing = null; };
    });
    document.getElementById(formId).onsubmit = onSubmit;
  }

  function fillCategorySelect() {
    els.catSelect.innerHTML = getCats().map(function (c) {
      return '<option value="' + escapeHtml(c.id) + '">' + escapeHtml(c.icon + " " + c.name) + "</option>";
    }).join("");
  }

  // ---------- โหลดข้อมูล ----------
  function refresh(force) {
    els.refreshBtn.classList.add("is-spinning");
    return loadRegistry({ force: force }, renderActive).then(function (res) {
      els.refreshBtn.classList.remove("is-spinning");
      if (res.error && HubState.source !== "online") {
        showStatus("โหลดออนไลน์ไม่ได้ — แสดงข้อมูลล่าสุด (" +
          (HubState.source === "cache" ? "แคช" : "ตั้งต้น") + ")", "warn");
      } else if (res.source === "online") {
        showStatus("");
      }
      return res;
    });
  }
  window.HubRefresh = refresh;          // ให้ docs.js เรียกหลังบันทึก

  function renderActive() {
    if (state.view === "home") renderHome();
    else if (state.view === "docs") renderDocsLauncher();
    else if (state.view === "manage") renderManage();
    else renderSettings();
  }

  // ---------- เปิดแอพใน iframe (เบราว์เซอร์ในตัว) ----------
  function openApp(app) {
    if (!app || app.status === "soon" || !app.path) return;
    state.currentApp = app;
    document.body.classList.add("app-open");
    Object.keys(els.views).forEach(function (k) { els.views[k].hidden = true; });
    els.viewApp.hidden = false;
    els.appIcon.textContent = app.icon;
    els.appName.textContent = app.name;
    els.appOpenNew.href = app.path;
    els.appFrame.src = app.path;
  }

  function _exitApp() {
    document.body.classList.remove("app-open");
    els.viewApp.hidden = true;
    if (els.appFrame.getAttribute("src") !== "about:blank") els.appFrame.src = "about:blank";
  }

  // ---------- สลับมุมมอง ----------
  function setView(view) {
    closeDrawer();
    _exitApp();
    state.view = view; els.search.value = ""; HubUI.query = "";
    els.nav.forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-view") === view);
    });
    Object.keys(els.views).forEach(function (k) { els.views[k].hidden = k !== view; });
    els.title.textContent = view === "home" ? "แอปพลิเคชัน"
      : view === "docs" ? "ฐานข้อมูล & ระบบ"
      : view === "manage" ? "จัดการ" : "ตั้งค่า";
    els.searchWrap.hidden = view !== "home";
    renderActive();
  }

  function _showAll() { return !!(window.Auth && Auth.isLoggedIn()); }

  // ---------- หน้าแรก (launcher แอพ) ----------
  function renderHome() {
    renderGrid();
    var n = HubState.apps.filter(function (a) { return _showAll() || a.public; }).length;
    els.count.textContent = n + " แอป";
  }

  // ---------- เอกสารสำคัญ (launcher เอกสาร · ดูอย่างเดียว) ----------
  function renderDocsLauncher() {
    renderDocsGrid();
    var n = (HubState.docs || []).filter(function (d) { return _showAll() || d.public; }).length;
    els.count.textContent = n + " รายการ";
  }

  function catName(id) {
    var c = getCats().find(function (x) { return x.id === id; });
    return c ? (c.icon + " " + c.name) : id;
  }

  // แปลงแอพ (normalized) → row สำหรับส่งขึ้นชีท (tags เป็นสตริง)
  function appToRow(a) {
    return {
      id: a.id, name: a.name, desc: a.desc, category: a.category,
      icon: a.icon, path: a.path, tags: a.tags.join(", "),
      status: a.status, public: a.public, order: a.order
    };
  }

  function onToggleApp(id) {
    var a = HubState.apps.find(function (x) { return x.id === id; });
    if (!a) return;
    var row = appToRow(a); row.public = !a.public;
    apiPost({ collection: "apps", action: "upsert", token: Auth.getToken(), item: row })
      .then(function (res) {
        if (res && res.ok === false) {
          if (res.error === "unauthorized") return reauth();
          return alert("เปลี่ยนสถานะไม่สำเร็จ: " + (res.error || ""));
        }
        refresh(true);
      })
      .catch(function (err) {
        alert(err.message === "no-url"
          ? "ยังไม่ได้เชื่อมต่อระบบ — เปลี่ยนสถานะไม่ได้"
          : "เปลี่ยนสถานะไม่สำเร็จ: " + err.message);
      });
  }

  // ---------- จัดการ (แอพ + เอกสาร ที่เดียว) ----------
  function renderManage() {
    els.count.textContent = "";
    renderAppsManage();
    if (window.DocsPanel) DocsPanel.render();
    els.docCount.textContent = "(" + HubState.docs.length + ")";
    renderCats();
  }

  // ---------- จัดการหมวดหมู่ ----------
  function renderCats() {
    var cats = getCats().slice().sort(function (a, b) {
      return (a.order - b.order) || a.name.localeCompare(b.name, "th");
    });
    els.catCount.textContent = "(" + cats.length + ")";
    els.catEmpty.hidden = cats.length > 0;
    els.catList.innerHTML = cats.map(function (c) {
      var used = HubState.apps.filter(function (a) { return a.category === c.id; }).length;
      return '<div class="item-row">' +
        '<div class="item-row__icon">' + escapeHtml(c.icon) + "</div>" +
        '<div class="item-row__main">' +
          '<div class="item-row__name">' + escapeHtml(c.name) + "</div>" +
          '<div class="item-row__sub">' + used + " แอป</div>" +
        "</div>" +
        '<div class="item-row__actions">' +
          '<button class="btn btn--sm" data-edit="' + escapeHtml(c.id) + '">แก้ไข</button>' +
          '<button class="btn btn--sm btn--danger" data-del="' + escapeHtml(c.id) + '">ลบ</button>' +
        "</div>" +
      "</div>";
    }).join("");
    els.catList.querySelectorAll("[data-edit]").forEach(function (b) {
      b.onclick = function () { openCatForm(b.getAttribute("data-edit")); };
    });
    els.catList.querySelectorAll("[data-del]").forEach(function (b) {
      b.onclick = function () { onDeleteCat(b.getAttribute("data-del")); };
    });
  }

  function cf(name) { return document.getElementById("catForm").elements.namedItem(name); }

  function openCatForm(id) {
    state.catEditing = id;
    document.getElementById("catFormError").hidden = true;
    var c = id ? getCats().find(function (x) { return x.id === id; }) : null;
    document.getElementById("catModalTitle").textContent = id ? "แก้ไขหมวด" : "เพิ่มหมวด";
    cf("name").value = c ? c.name : "";
    cf("icon").value = c ? c.icon : "📦";
    cf("order").value = c ? c.order : 999;
    els.catModal.hidden = false;
    setTimeout(function () { cf("name").focus(); }, 30);
  }

  function onSaveCat(e) {
    e.preventDefault();
    if (!cf("name").value.trim()) return catErr("กรอกชื่อหมวด");
    var cat = {
      id: state.catEditing || ("cat-" + Date.now()),
      name: cf("name").value.trim(),
      icon: cf("icon").value.trim() || "📦",
      order: Number(cf("order").value) || 999
    };
    var btn = document.getElementById("catSave");
    setBusy(btn, true);
    apiPost({ collection: "cats", action: "upsert", token: Auth.getToken(), item: cat })
      .then(function (res) {
        setBusy(btn, false);
        if (res && res.ok === false) {
          if (res.error === "unauthorized") return reauth();
          return catErr("บันทึกไม่สำเร็จ: " + (res.error || ""));
        }
        els.catModal.hidden = true; state.catEditing = null;
        refresh(true);
      })
      .catch(function (err) {
        setBusy(btn, false);
        catErr(err.message === "no-url"
          ? "ยังไม่ได้เชื่อมต่อระบบ — บันทึกไม่ได้"
          : "บันทึกไม่สำเร็จ: " + err.message);
      });
  }

  function onDeleteCat(id) {
    var c = getCats().find(function (x) { return x.id === id; });
    var used = HubState.apps.filter(function (a) { return a.category === id; }).length;
    var warn = used ? " (มี " + used + " แอปใช้หมวดนี้อยู่)" : "";
    if (!confirm("ลบหมวด \"" + (c ? c.name : id) + "\"" + warn + " ?")) return;
    apiPost({ collection: "cats", action: "delete", token: Auth.getToken(), id: id })
      .then(function (res) {
        if (res && res.ok === false) {
          if (res.error === "unauthorized") return reauth();
          return alert("ลบไม่สำเร็จ: " + (res.error || ""));
        }
        refresh(true);
      })
      .catch(function (err) {
        alert(err.message === "no-url"
          ? "ยังไม่ได้เชื่อมต่อระบบ — ลบไม่ได้"
          : "ลบไม่สำเร็จ: " + err.message);
      });
  }

  function catErr(msg) { var el = document.getElementById("catFormError"); el.textContent = msg; el.hidden = false; }

  function renderAppsManage() {
    var list = HubState.apps.slice().sort(function (a, b) {
      return (a.order - b.order) || a.name.localeCompare(b.name, "th");
    });
    els.appCount.textContent = "(" + HubState.apps.length + ")";
    els.appEmpty.hidden = list.length > 0;

    els.appList.innerHTML = list.map(function (a) {
      return '<div class="item-row">' +
        '<div class="item-row__icon">' + escapeHtml(a.icon) + "</div>" +
        '<div class="item-row__main">' +
          '<div class="item-row__name">' + escapeHtml(a.name) + "</div>" +
          '<div class="item-row__sub">' + escapeHtml(a.desc || a.path) + "</div>" +
        "</div>" +
        '<div class="item-row__meta">' +
          '<span class="pill pill--cat">' + escapeHtml(catName(a.category)) + "</span>" +
          '<span class="pill pill--' + escapeHtml(a.status) + '">' + escapeHtml(a.status) + "</span>" +
        "</div>" +
        '<div class="item-row__actions">' +
          pubPill(a) +
          '<button class="btn btn--sm" data-edit="' + escapeHtml(a.id) + '">แก้ไข</button>' +
          '<button class="btn btn--sm btn--danger" data-del="' + escapeHtml(a.id) + '">ลบ</button>' +
        "</div>" +
      "</div>";
    }).join("");

    els.appList.querySelectorAll("[data-toggle]").forEach(function (b) {
      b.onclick = function () { onToggleApp(b.getAttribute("data-toggle")); };
    });
    els.appList.querySelectorAll("[data-edit]").forEach(function (b) {
      b.onclick = function () { openAppForm(b.getAttribute("data-edit")); };
    });
    els.appList.querySelectorAll("[data-del]").forEach(function (b) {
      b.onclick = function () { onDeleteApp(b.getAttribute("data-del")); };
    });
  }

  // ---------- ตั้งค่า ----------
  function renderSettings() {
    els.count.textContent = "";
    var url = HUB_CONFIG.APPS_SCRIPT_URL;
    var conn = url ? '<span class="badge-ok">● เชื่อมต่อแล้ว</span>'
                   : '<span class="badge-bad">● ยังไม่ได้เชื่อมต่อ</span>';
    var src = { online: "ออนไลน์", cache: "แคช (offline)", seed: "ข้อมูลตั้งต้น" };

    els.settingsBox.innerHTML =
      '<div class="settings-card"><h3>สถานะระบบ</h3>' +
        '<div class="settings-row"><span class="settings-label">การเชื่อมต่อ</span><span class="settings-value">' + conn + "</span></div>" +
        '<div class="settings-row"><span class="settings-label">แหล่งข้อมูลล่าสุด</span><span class="settings-value">' + (src[HubState.source] || HubState.source) + "</span></div>" +
      "</div>" +
      '<div class="settings-card"><h3>ข้อมูลในระบบ</h3>' +
        '<div class="settings-row"><span class="settings-label">จำนวนแอพ</span><span class="settings-value">' + HubState.apps.length + "</span></div>" +
        '<div class="settings-row"><span class="settings-label">จำนวนเอกสาร</span><span class="settings-value">' + HubState.docs.length + "</span></div>" +
        '<div class="settings-row"><span class="settings-label">หมวดทั้งหมด</span><span class="settings-value">' + getCats().length + "</span></div>" +
      "</div>" +
      '<div class="settings-card"><h3>วิธีแก้ไข</h3>' +
        '<p class="settings-row settings-hint" style="border:0;">' +
          "เพิ่ม/แก้แอป ฐานข้อมูล และหมวดหมู่ ได้จากเมนู “จัดการ”" +
        "</p></div>";
  }

  // ---------- ฟอร์มแอพ ----------
  function af(name) { return document.getElementById("appForm").elements.namedItem(name); }

  function openAppForm(id) {
    state.editing = id;
    fillCategorySelect();                 // รีเฟรชตัวเลือกหมวดให้ตรงปัจจุบัน
    document.getElementById("appFormError").hidden = true;
    var a = id ? HubState.apps.find(function (x) { return x.id === id; }) : null;
    document.getElementById("appModalTitle").textContent = id ? "แก้ไขแอพ" : "เพิ่มแอพ";
    af("id").value = a ? a.id : "";
    af("id").readOnly = !!id;
    af("name").value = a ? a.name : "";
    af("desc").value = a ? a.desc : "";
    af("icon").value = a ? a.icon : "📦";
    af("path").value = a ? a.path : "";
    af("category").value = a ? a.category : getCats()[0].id;
    af("status").value = a ? a.status : "active";
    af("tags").value = a ? a.tags.join(", ") : "";
    af("order").value = a ? a.order : 999;
    els.appModal.hidden = false;
    setTimeout(function () { af("name").focus(); }, 30);
  }

  function onSaveApp(e) {
    e.preventDefault();
    var id = af("id").value.trim();
    if (!id || !af("name").value.trim()) return formErr("กรอกรหัสและชื่อแอพ");
    if (!state.editing && HubState.apps.some(function (a) { return a.id === id; }))
      return formErr("รหัส \"" + id + "\" ถูกใช้แล้ว");

    var existing = state.editing ? HubState.apps.find(function (x) { return x.id === id; }) : null;
    var app = {
      id: id, name: af("name").value.trim(), desc: af("desc").value.trim(),
      category: af("category").value, icon: af("icon").value.trim() || "📦",
      path: af("path").value.trim(), tags: af("tags").value.trim(),
      status: af("status").value,
      public: existing ? existing.public : true,   // คงค่าเดิม; ใหม่ = สาธารณะ
      order: Number(af("order").value) || 999
    };

    var btn = document.getElementById("appSave");
    setBusy(btn, true);
    apiPost({ collection: "apps", action: "upsert", token: Auth.getToken(), item: app })
      .then(function (res) {
        setBusy(btn, false);
        if (res && res.ok === false) {
          if (res.error === "unauthorized") return reauth();
          return formErr("บันทึกไม่สำเร็จ: " + (res.error || ""));
        }
        els.appModal.hidden = true; state.editing = null;
        refresh(true);
      })
      .catch(function (err) {
        setBusy(btn, false);
        formErr(err.message === "no-url"
          ? "ยังไม่ได้เชื่อมต่อระบบ — บันทึกไม่ได้"
          : "บันทึกไม่สำเร็จ: " + err.message);
      });
  }

  function onDeleteApp(id) {
    var a = HubState.apps.find(function (x) { return x.id === id; });
    if (!confirm("ลบแอพ \"" + (a ? a.name : id) + "\" ?")) return;
    apiPost({ collection: "apps", action: "delete", token: Auth.getToken(), id: id })
      .then(function (res) {
        if (res && res.ok === false) {
          if (res.error === "unauthorized") return reauth();
          return alert("ลบไม่สำเร็จ: " + (res.error || ""));
        }
        refresh(true);
      })
      .catch(function (err) {
        alert(err.message === "no-url"
          ? "ยังไม่ได้เชื่อมต่อระบบ — ลบไม่ได้"
          : "ลบไม่สำเร็จ: " + err.message);
      });
  }

  // ---------- auth (3 ระดับ) ----------
  function renderAuth() {
    var role = Auth.getRole();
    els.manageNav.hidden = role !== "admin";       // จัดการ/ตั้งค่า = admin เท่านั้น

    if (role === "admin" || role === "staff") {
      var label = role === "admin" ? "ผู้ดูแลระบบ" : "เจ้าหน้าที่";
      var ico = role === "admin" ? "🛡️" : "🧑‍⚕️";
      els.authArea.innerHTML =
        '<div class="role-badge role-badge--' + role + '"><span class="role-badge__ico">' + ico + '</span>' +
          '<span class="admin-nav__txt">' + label + '</span></div>' +
        '<button class="admin-nav__item" id="logoutBtn"><span class="admin-nav__ico">⎋</span><span class="admin-nav__txt">ออกจากระบบ</span></button>';
      document.getElementById("logoutBtn").onclick = function () {
        closeDrawer();
        Auth.clear(); renderAuth();
        // กลับหน้าแรกถ้าอยู่หน้าเฉพาะ admin · โหลดใหม่ให้เหลือเฉพาะสาธารณะ (ทิ้งรายการที่ซ่อน)
        if (state.view === "manage" || state.view === "settings") setView("home");
        refresh(true);
      };
    } else {
      els.authArea.innerHTML =
        '<button class="admin-nav__item" id="loginBtn"><span class="admin-nav__ico">🔒</span><span class="admin-nav__txt">เข้าสู่ระบบ</span></button>';
      document.getElementById("loginBtn").onclick = function () {
        closeDrawer();
        Auth.promptLogin().then(function (r) { if (r) { renderAuth(); refresh(true); } });
      };
    }
  }

  // ---------- ตัวช่วย ----------
  function closeDrawer() { document.body.classList.remove("drawer-open"); }
  function formErr(msg) { var el = document.getElementById("appFormError"); el.textContent = msg; el.hidden = false; }
  function setBusy(btn, b) { btn.disabled = b; btn.textContent = b ? "กำลังบันทึก…" : "บันทึก"; }
  function reauth() {
    Auth.clear(); renderAuth();
    alert("เซสชันหมดอายุ หรือรหัสไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่");
    Auth.promptLogin().then(function (ok) { if (ok) renderAuth(); });
  }

  start();
})();
