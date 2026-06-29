/* admin.js — Sidebar console: จัดการ แอพ + เอกสาร + ตั้งค่า
 * ต้อง login ก่อน; การเขียนแนบ token ทุกครั้ง (เซิร์ฟเวอร์ตรวจกับ ADMIN_TOKEN) */

(function () {
  var state = { view: "apps", apps: [], docs: [], q: "", editing: null };

  var els = {
    nav: document.querySelectorAll(".admin-nav__item[data-view]"),
    views: {
      apps: document.getElementById("viewApps"),
      docs: document.getElementById("viewDocs"),
      settings: document.getElementById("viewSettings")
    },
    title: document.getElementById("viewTitle"),
    count: document.getElementById("viewCount"),
    search: document.getElementById("adminSearch"),
    searchWrap: document.getElementById("searchWrap"),
    addBtn: document.getElementById("addBtn"),
    warn: document.getElementById("backendWarn"),
    appList: document.getElementById("appList"),
    appEmpty: document.getElementById("appEmpty"),
    docList: document.getElementById("docList"),
    docEmpty: document.getElementById("docEmpty"),
    settingsBox: document.getElementById("settingsBox"),
    appModal: document.getElementById("appModal"),
    docModal: document.getElementById("docModal"),
    catSelect: document.getElementById("catSelect")
  };

  // ---------- บูต: ต้อง login ก่อน ----------
  function boot() {
    if (!HUB_CONFIG.APPS_SCRIPT_URL) els.warn.hidden = false;
    if (Auth.isAdmin()) return start();
    Auth.promptLogin().then(function (role) {
      if (role === "admin") start(); else window.location.href = "index.html";
    });
  }

  function start() {
    fillCategorySelect();
    bindEvents();
    setView("apps");
    loadData();
  }

  function bindEvents() {
    document.getElementById("logoutBtn").onclick = function () {
      Auth.clear(); window.location.href = "index.html";
    };
    els.nav.forEach(function (b) {
      b.onclick = function () { setView(b.getAttribute("data-view")); };
    });
    els.search.addEventListener("input", debounce(function (e) {
      state.q = e.target.value; render();
    }, 120));
    els.addBtn.onclick = function () {
      state.view === "docs" ? openDocForm(null) : openAppForm(null);
    };
    bindModal(els.appModal, "appForm", onSaveApp);
    bindModal(els.docModal, "docForm", onSaveDoc);
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
  function loadData() {
    var src = HUB_CONFIG.APPS_SCRIPT_URL ? apiGet() : Promise.reject(new Error("no-url"));
    src.then(function (data) {
      state.apps = pickList(data, "apps").map(normalizeApp);
      state.docs = pickList(data, "docs").map(normalizeDoc);
      render();
    }).catch(function () {
      state.apps = (window.APPS_SEED || []).map(normalizeApp);
      state.docs = (window.DOCS_SEED || []).map(normalizeDoc);
      render();
    });
  }

  // ---------- สลับมุมมอง ----------
  function setView(view) {
    state.view = view; state.q = ""; els.search.value = "";
    els.nav.forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-view") === view);
    });
    Object.keys(els.views).forEach(function (k) { els.views[k].hidden = k !== view; });
    var isSettings = view === "settings";
    els.searchWrap.hidden = isSettings;
    els.addBtn.hidden = isSettings;
    els.title.textContent = view === "apps" ? "จัดการแอป" : view === "docs" ? "ฐานข้อมูล & ระบบ" : "ตั้งค่า";
    els.addBtn.textContent = view === "docs" ? "➕ เพิ่มลิงก์" : "➕ เพิ่มแอพ";
    render();
  }

  function render() {
    if (state.view === "apps") renderApps();
    else if (state.view === "docs") renderDocs();
    else renderSettings();
  }

  function catName(id) {
    var c = getCats().find(function (x) { return x.id === id; });
    return c ? (c.icon + " " + c.name) : id;
  }

  // ---------- มุมมองแอพ ----------
  function renderApps() {
    var q = normalize(state.q);
    var list = state.apps.filter(function (a) {
      return !q || normalize([a.name, a.desc, a.tags.join(" "), a.id].join(" ")).indexOf(q) !== -1;
    }).sort(function (a, b) {
      return (a.order - b.order) || a.name.localeCompare(b.name, "th");
    });
    els.count.textContent = "ทั้งหมด " + state.apps.length + " แอพ" + (q ? " · แสดง " + list.length : "");
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
          '<button class="btn btn--sm" data-edit="' + escapeHtml(a.id) + '">แก้ไข</button>' +
          '<button class="btn btn--sm btn--danger" data-del="' + escapeHtml(a.id) + '">ลบ</button>' +
        "</div>" +
      "</div>";
    }).join("");

    bindRowActions(els.appList, openAppForm, onDeleteApp);
  }

  // ---------- มุมมองเอกสาร ----------
  function renderDocs() {
    var q = normalize(state.q);
    var list = state.docs.filter(function (d) {
      return !q || normalize([d.title, d.note, d.url].join(" ")).indexOf(q) !== -1;
    }).sort(function (a, b) {
      return (a.order - b.order) || a.title.localeCompare(b.title, "th");
    });
    els.count.textContent = "ทั้งหมด " + state.docs.length + " ลิงก์" + (q ? " · แสดง " + list.length : "");
    els.docEmpty.hidden = list.length > 0;

    els.docList.innerHTML = list.map(function (d) {
      return '<div class="item-row">' +
        '<div class="item-row__icon">🔗</div>' +
        '<div class="item-row__main">' +
          '<div class="item-row__name">' + escapeHtml(d.title) + "</div>" +
          '<div class="item-row__sub"><a href="' + escapeHtml(d.url || "#") + '" target="_blank" rel="noopener">' +
            escapeHtml(d.url) + "</a>" + (d.note ? " · " + escapeHtml(d.note) : "") + "</div>" +
        "</div>" +
        '<div class="item-row__actions">' +
          '<button class="btn btn--sm" data-edit="' + escapeHtml(d.id) + '">แก้ไข</button>' +
          '<button class="btn btn--sm btn--danger" data-del="' + escapeHtml(d.id) + '">ลบ</button>' +
        "</div>" +
      "</div>";
    }).join("");

    bindRowActions(els.docList, openDocForm, onDeleteDoc);
  }

  function bindRowActions(container, onEdit, onDel) {
    container.querySelectorAll("[data-edit]").forEach(function (b) {
      b.onclick = function () { onEdit(b.getAttribute("data-edit")); };
    });
    container.querySelectorAll("[data-del]").forEach(function (b) {
      b.onclick = function () { onDel(b.getAttribute("data-del")); };
    });
  }

  // ---------- มุมมองตั้งค่า ----------
  function renderSettings() {
    els.count.textContent = "";
    var url = HUB_CONFIG.APPS_SCRIPT_URL;
    var conn = url
      ? '<span class="badge-ok">● เชื่อมต่อแล้ว</span>'
      : '<span class="badge-bad">● ยังไม่ได้ตั้งค่า</span>';
    var urlShort = url ? escapeHtml(url.length > 48 ? url.slice(0, 48) + "…" : url) : "—";

    els.settingsBox.innerHTML =
      '<div class="settings-card">' +
        "<h3>การเชื่อมต่อ Google Sheet</h3>" +
        '<div class="settings-row"><span class="settings-label">สถานะ</span><span class="settings-value">' + conn + "</span></div>" +
        '<div class="settings-row"><span class="settings-label">APPS_SCRIPT_URL</span><span class="settings-value">' + urlShort + "</span></div>" +
      "</div>" +
      '<div class="settings-card">' +
        "<h3>ข้อมูลในระบบ</h3>" +
        '<div class="settings-row"><span class="settings-label">จำนวนแอพ</span><span class="settings-value">' + state.apps.length + "</span></div>" +
        '<div class="settings-row"><span class="settings-label">จำนวนเอกสาร</span><span class="settings-value">' + state.docs.length + "</span></div>" +
        '<div class="settings-row"><span class="settings-label">หมวดทั้งหมด</span><span class="settings-value">' + getCats().length + "</span></div>" +
      "</div>" +
      '<div class="settings-card">' +
        "<h3>วิธีแก้ไข</h3>" +
        '<p class="settings-row settings-hint" style="border:0;">' +
          "แก้ไขแอพ/เอกสารได้จากหน้านี้ หรือแก้แถวใน Google Sheet ตรง ๆ ก็ได้ · " +
          "เพิ่มหมวดใหม่แก้ที่ <code>js/config.js</code> · คู่มือติดตั้งดู <code>apps-script/SETUP.md</code>" +
        "</p>" +
      "</div>";
  }

  // ---------- ฟอร์มแอพ ----------
  function af(name) { return document.getElementById("appForm").elements.namedItem(name); }

  function openAppForm(id) {
    state.editing = id;
    document.getElementById("appFormError").hidden = true;
    var a = id ? state.apps.find(function (x) { return x.id === id; }) : null;
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
    if (!id || !af("name").value.trim()) return formErr("appFormError", "กรอกรหัสและชื่อแอพ");
    if (!state.editing && state.apps.some(function (a) { return a.id === id; }))
      return formErr("appFormError", "รหัส \"" + id + "\" ถูกใช้แล้ว");

    var app = {
      id: id, name: af("name").value.trim(), desc: af("desc").value.trim(),
      category: af("category").value, icon: af("icon").value.trim() || "📦",
      path: af("path").value.trim(), tags: af("tags").value.trim(),
      status: af("status").value, order: Number(af("order").value) || 999
    };
    save("apps", app, document.getElementById("appSave"), els.appModal, "appFormError");
  }

  function onDeleteApp(id) {
    var a = state.apps.find(function (x) { return x.id === id; });
    if (confirm("ลบแอพ \"" + (a ? a.name : id) + "\" ?")) remove("apps", id);
  }

  // ---------- ฟอร์มเอกสาร ----------
  function df(name) { return document.getElementById("docForm").elements.namedItem(name); }

  function openDocForm(id) {
    state.editing = id;
    document.getElementById("docFormError").hidden = true;
    var d = id ? state.docs.find(function (x) { return x.id === id; }) : null;
    document.getElementById("docModalTitle").textContent = id ? "แก้ไขลิงก์" : "เพิ่มลิงก์";
    df("title").value = d ? d.title : "";
    df("url").value = d ? d.url : "";
    df("note").value = d ? d.note : "";
    df("order").value = d ? d.order : 999;
    els.docModal.hidden = false;
    setTimeout(function () { df("title").focus(); }, 30);
  }

  function onSaveDoc(e) {
    e.preventDefault();
    if (!df("title").value.trim() || !df("url").value.trim())
      return formErr("docFormError", "กรอกชื่อและลิงก์");
    var doc = {
      id: state.editing || ("doc-" + Date.now()),
      title: df("title").value.trim(), url: df("url").value.trim(),
      note: df("note").value.trim(), order: Number(df("order").value) || 999
    };
    save("docs", doc, document.getElementById("docSave"), els.docModal, "docFormError");
  }

  function onDeleteDoc(id) {
    var d = state.docs.find(function (x) { return x.id === id; });
    if (confirm("ลบลิงก์ \"" + (d ? d.title : id) + "\" ?")) remove("docs", id);
  }

  // ---------- เขียน/ลบ ผ่าน API ----------
  function save(collection, item, btn, modal, errId) {
    setBusy(btn, true);
    apiPost({ collection: collection, action: "upsert", token: Auth.getToken(), item: item })
      .then(function (res) {
        setBusy(btn, false);
        if (res && res.ok === false) {
          if (res.error === "unauthorized") return reauth();
          return formErr(errId, "บันทึกไม่สำเร็จ: " + (res.error || ""));
        }
        modal.hidden = true; state.editing = null;
        loadData();
      })
      .catch(function (err) {
        setBusy(btn, false);
        formErr(errId, err.message === "no-url"
          ? "ยังไม่ได้ตั้ง APPS_SCRIPT_URL — บันทึกขึ้นชีทไม่ได้"
          : "บันทึกไม่สำเร็จ: " + err.message);
      });
  }

  function remove(collection, id) {
    apiPost({ collection: collection, action: "delete", token: Auth.getToken(), id: id })
      .then(function (res) {
        if (res && res.ok === false) {
          if (res.error === "unauthorized") return reauth();
          return alert("ลบไม่สำเร็จ: " + (res.error || ""));
        }
        loadData();
      })
      .catch(function (err) {
        alert(err.message === "no-url"
          ? "ยังไม่ได้ตั้ง APPS_SCRIPT_URL — ลบบนชีทไม่ได้"
          : "ลบไม่สำเร็จ: " + err.message);
      });
  }

  // ---------- ตัวช่วย ----------
  function formErr(id, msg) { var el = document.getElementById(id); el.textContent = msg; el.hidden = false; }
  function setBusy(btn, b) { btn.disabled = b; btn.textContent = b ? "กำลังบันทึก…" : "บันทึก"; }
  function reauth() {
    Auth.clear();
    alert("เซสชันหมดอายุ หรือรหัสไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่");
    Auth.promptLogin().then(function (ok) { if (!ok) window.location.href = "index.html"; });
  }

  boot();
})();
