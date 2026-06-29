/* docs.js — พื้นที่ "เอกสารสำคัญ" บนหน้า Hub (โชว์เฉพาะหลัง login)
 * เก็บลิงก์ Google Sheet / เอกสารอื่น ในชีท Docs ผ่าน Apps Script
 * จัดการ (เพิ่ม/แก้/ลบ) ได้ในตัว — แนบ token เหมือนหน้า admin */

window.DocsPanel = (function () {
  var editingId = null;

  function _ensureModal() {
    if (document.getElementById("docModal")) return;
    var wrap = document.createElement("div");
    wrap.id = "docModal";
    wrap.className = "modal-backdrop";
    wrap.hidden = true;
    wrap.innerHTML =
      '<div class="modal modal--sm" role="dialog" aria-modal="true" aria-labelledby="docModalTitle">' +
        '<div class="modal__head"><span>🔗</span><h2 id="docModalTitle">เพิ่มลิงก์</h2>' +
          '<button type="button" class="modal__close" data-close aria-label="ปิด">✕</button></div>' +
        '<form id="docForm" class="modal__body">' +
          '<label class="field"><span class="field__label">ชื่อเอกสาร</span>' +
            '<input name="title" class="field__input" required /></label>' +
          '<label class="field"><span class="field__label">ลิงก์ (URL)</span>' +
            '<input name="url" class="field__input" placeholder="https://…" required /></label>' +
          '<label class="field"><span class="field__label">หมายเหตุ</span>' +
            '<input name="note" class="field__input" placeholder="เช่น Google Sheet / SOP" /></label>' +
          '<label class="field"><span class="field__label">ลำดับ</span>' +
            '<input name="order" type="number" class="field__input" value="999" min="1" /></label>' +
          '<p id="docFormError" class="form-error" hidden></p>' +
          '<div class="modal__foot">' +
            '<button type="button" class="btn btn--ghost" data-close>ยกเลิก</button>' +
            '<button type="submit" class="btn btn--primary" id="docSave">บันทึก</button>' +
          '</div>' +
        '</form>' +
      '</div>';
    document.body.appendChild(wrap);

    // ปิดเฉพาะปุ่ม [data-close] — ไม่ปิดเมื่อคลิก backdrop
    wrap.querySelectorAll("[data-close]").forEach(function (b) { b.onclick = closeForm; });
    document.getElementById("docForm").onsubmit = onSave;
  }

  function fld(name) {
    return document.getElementById("docForm").elements.namedItem(name);
  }

  // ---------- เรนเดอร์พื้นที่เอกสาร ----------
  function render() {
    var sec = document.getElementById("docsSection");
    if (!sec) return;
    if (!Auth.isLoggedIn()) { sec.hidden = true; sec.innerHTML = ""; return; }

    _ensureModal();
    sec.hidden = false;

    var items = (HubState.docs || []).map(function (d) {
      var sub = d.note || d.url;
      return '<div class="item-row">' +
        '<div class="item-row__icon">🔗</div>' +
        '<div class="item-row__main">' +
          '<div class="item-row__name"><a href="' + escapeHtml(d.url || "#") +
            '" target="_blank" rel="noopener">' + escapeHtml(d.title) + "</a></div>" +
          (sub ? '<div class="item-row__sub">' + escapeHtml(sub) + "</div>" : "") +
        "</div>" +
        '<div class="item-row__actions">' +
          pubPill(d) +
          '<button class="btn btn--sm" data-edit="' + escapeHtml(d.id) + '">แก้ไข</button>' +
          '<button class="btn btn--sm btn--danger" data-del="' + escapeHtml(d.id) + '">ลบ</button>' +
        "</div>" +
      "</div>";
    }).join("");

    sec.innerHTML = items
      ? '<div class="item-list">' + items + "</div>"
      : '<div class="docs-empty">ยังไม่มีรายการ — กดปุ่ม “เพิ่มลิงก์” ด้านบนเพื่อเพิ่มฐานข้อมูล/ระบบ</div>';

    sec.querySelectorAll("[data-toggle]").forEach(function (b) {
      b.onclick = function () { onTogglePublic(b.getAttribute("data-toggle")); };
    });
    sec.querySelectorAll("[data-edit]").forEach(function (b) {
      b.onclick = function () { openForm(b.getAttribute("data-edit")); };
    });
    sec.querySelectorAll("[data-del]").forEach(function (b) {
      b.onclick = function () { onDelete(b.getAttribute("data-del")); };
    });
  }

  // ---------- ฟอร์ม ----------
  function openForm(id) {
    _ensureModal();
    editingId = id;
    var doc = id ? (HubState.docs || []).find(function (d) { return d.id === id; }) : null;
    document.getElementById("docModalTitle").textContent = id ? "แก้ไขลิงก์" : "เพิ่มลิงก์";
    document.getElementById("docFormError").hidden = true;
    fld("title").value = doc ? doc.title : "";
    fld("url").value = doc ? doc.url : "";
    fld("note").value = doc ? doc.note : "";
    fld("order").value = doc ? doc.order : 999;
    document.getElementById("docModal").hidden = false;
    setTimeout(function () { fld("title").focus(); }, 30);
  }

  function closeForm() {
    var m = document.getElementById("docModal");
    if (m) m.hidden = true;
    editingId = null;
  }

  function onSave(e) {
    e.preventDefault();
    var title = fld("title").value.trim();
    var url = fld("url").value.trim();
    if (!title || !url) return _err("กรอกชื่อและลิงก์");

    var existing = editingId ? (HubState.docs || []).find(function (x) { return x.id === editingId; }) : null;
    var doc = {
      id: editingId || ("doc-" + Date.now()),
      title: title, url: url,
      note: fld("note").value.trim(),
      public: existing ? existing.public : false,   // คงค่าเดิม; ใหม่ = เฉพาะเจ้าหน้าที่
      order: Number(fld("order").value) || 999
    };

    _busy(true);
    apiPost({ collection: "docs", action: "upsert", token: Auth.getToken(), item: doc })
      .then(function (res) {
        _busy(false);
        if (res && res.ok === false) {
          if (res.error === "unauthorized") return _reauth();
          return _err("บันทึกไม่สำเร็จ: " + (res.error || ""));
        }
        closeForm();
        if (window.HubRefresh) window.HubRefresh(true);
      })
      .catch(function (err) {
        _busy(false);
        _err(err.message === "no-url"
          ? "ยังไม่ได้ตั้ง APPS_SCRIPT_URL — บันทึกขึ้นชีทไม่ได้"
          : "บันทึกไม่สำเร็จ: " + err.message);
      });
  }

  function onTogglePublic(id) {
    var d = (HubState.docs || []).find(function (x) { return x.id === id; });
    if (!d) return;
    var row = { id: d.id, title: d.title, url: d.url, note: d.note, public: !d.public, order: d.order };
    apiPost({ collection: "docs", action: "upsert", token: Auth.getToken(), item: row })
      .then(function (res) {
        if (res && res.ok === false) {
          if (res.error === "unauthorized") return _reauth();
          return alert("เปลี่ยนสถานะไม่สำเร็จ: " + (res.error || ""));
        }
        if (window.HubRefresh) window.HubRefresh(true);
      })
      .catch(function (err) {
        alert(err.message === "no-url"
          ? "ยังไม่ได้ตั้ง APPS_SCRIPT_URL — เปลี่ยนสถานะบนชีทไม่ได้"
          : "เปลี่ยนสถานะไม่สำเร็จ: " + err.message);
      });
  }

  function onDelete(id) {
    var doc = (HubState.docs || []).find(function (d) { return d.id === id; });
    if (!confirm("ลบลิงก์ \"" + (doc ? doc.title : id) + "\" ?")) return;
    apiPost({ collection: "docs", action: "delete", token: Auth.getToken(), id: id })
      .then(function (res) {
        if (res && res.ok === false) {
          if (res.error === "unauthorized") return _reauth();
          return alert("ลบไม่สำเร็จ: " + (res.error || ""));
        }
        if (window.HubRefresh) window.HubRefresh(true);
      })
      .catch(function (err) {
        alert(err.message === "no-url"
          ? "ยังไม่ได้ตั้ง APPS_SCRIPT_URL — ลบบนชีทไม่ได้"
          : "ลบไม่สำเร็จ: " + err.message);
      });
  }

  // ---------- ตัวช่วย ----------
  function _err(msg) {
    var el = document.getElementById("docFormError");
    el.textContent = msg; el.hidden = false;
  }
  function _busy(b) {
    var s = document.getElementById("docSave");
    s.disabled = b; s.textContent = b ? "กำลังบันทึก…" : "บันทึก";
  }
  function _reauth() {
    Auth.clear(); _busy(false);
    alert("เซสชันหมดอายุ หรือรหัสไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่");
    closeForm(); render();
  }

  return { render: render, openAdd: function () { openForm(null); } };
})();
