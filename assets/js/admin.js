/* De Confiserie admin – products, sales dashboard, publish. No database: data in this browser + exported files. */
(function () {
  "use strict";
  var S = window.SITE || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function sget(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function sset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { toast("Browser storage is full – remove or re-upload smaller photos."); return false; } }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return "QAR " + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
  function today() { var d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); }
  function slug(s) { return String(s).toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "cake"; }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function toast(t) { var el = $("#toast"); el.textContent = t; el.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(function () { el.classList.remove("show"); }, 2600); }
  function download(name, blob) { var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  function sha256(t) {
    return crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return x.toString(16).padStart(2, "0"); }).join("");
    });
  }

  /* ---------------- auth ---------------- */
  function authed() { try { return sessionStorage.getItem("dc_admin") === "1"; } catch (e) { return false; } }
  $("#loginForm").addEventListener("submit", function (e) {
    e.preventDefault();
    sha256($("#pw").value).then(function (h) {
      if (h === S.adminHash) { try { sessionStorage.setItem("dc_admin", "1"); } catch (x) {} start(); }
      else $("#loginErr").textContent = "Incorrect password.";
    }).catch(function () { $("#loginErr").textContent = "Please open the admin page over https."; });
  });
  $("#logout").addEventListener("click", function () { try { sessionStorage.removeItem("dc_admin"); } catch (e) {} location.reload(); });

  /* ---------------- state ---------------- */
  var products = [], sales = sget("dc_sales", []);
  function saveProducts(dirty) { if (sset("dc_admin_products", products) && dirty !== false) { sset("dc_admin_dirty", true); } renderProducts(); }
  function saveSales() { sset("dc_sales", sales); renderSales(); renderDash(); }
  function loadLive() {
    return fetch("data/products.json", { cache: "no-cache" }).then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .catch(function () { return []; });
  }

  function start() {
    $("#loginView").hidden = true; $("#appView").hidden = false;
    var draft = sget("dc_admin_products", null);
    (draft ? Promise.resolve(draft) : loadLive()).then(function (list) {
      products = list || [];
      if (!draft) sset("dc_admin_products", products);
      renderProducts(); renderSales(); renderDash();
      try { $("#previewToggle").checked = localStorage.getItem("dc_preview") === "1"; } catch (e) {}
    });
  }

  /* ---------------- tabs ---------------- */
  $$(".tab").forEach(function (t) {
    t.addEventListener("click", function () {
      $$(".tab").forEach(function (x) { x.setAttribute("aria-selected", x === t); });
      $$("[data-view]").forEach(function (v) { v.hidden = v.getAttribute("data-view") !== t.getAttribute("data-tab"); });
      if (t.getAttribute("data-tab") === "dash") renderDash();
    });
  });
  $$("[data-close]").forEach(function (b) { b.addEventListener("click", function () { b.closest("dialog").close(); }); });

  /* ---------------- products ---------------- */
  function renderProducts() {
    var q = ($("#pSearch").value || "").toLowerCase();
    var list = products.filter(function (p) { return !q || p.name.toLowerCase().indexOf(q) >= 0; });
    $("#pCount").textContent = "(" + products.length + ")";
    $("#unpub").hidden = !sget("dc_admin_dirty", false);
    $("#pTable").innerHTML = "<thead><tr><th>Photo</th><th>Name</th><th class='n'>Price</th><th>Status</th><th></th></tr></thead><tbody>" +
      (list.length ? list.map(function (p) {
        var i = products.indexOf(p);
        return "<tr><td><img src='" + esc(p.thumb || p.image) + "' alt=''></td><td><strong>" + esc(p.name) + "</strong><br>" +
          (p.categories || []).map(function (c) { return "<span class='pill'>" + esc(c) + "</span>"; }).join("") + "</td>" +
          "<td class='n'>" + money(p.price) + "</td><td>" + (p.active !== false ? "<span class='st st-Delivered'>Visible</span>" : "<span class='st st-Cancelled'>Hidden</span>") + "</td>" +
          "<td style='white-space:nowrap'><button class='btn btn-ghost btn-sm' data-edit='" + i + "'>Edit</button> <button class='btn btn-ghost btn-sm' data-toggle='" + i + "'>" + (p.active !== false ? "Hide" : "Show") + "</button> <button class='btn btn-sm' style='color:var(--bad)' data-del='" + i + "'>Delete</button></td></tr>";
      }).join("") : "<tr><td colspan='5' class='muted'>No products.</td></tr>") + "</tbody>";
  }
  $("#pSearch").addEventListener("input", renderProducts);
  $("#pTable").addEventListener("click", function (e) {
    var b;
    if ((b = e.target.closest("[data-edit]"))) openProduct(+b.getAttribute("data-edit"));
    if ((b = e.target.closest("[data-toggle]"))) { var p = products[+b.getAttribute("data-toggle")]; p.active = p.active === false; saveProducts(); }
    if ((b = e.target.closest("[data-del]"))) { var d = products[+b.getAttribute("data-del")]; if (confirm("Delete \"" + d.name + "\"? This removes it from the store after you publish.")) { products.splice(+b.getAttribute("data-del"), 1); saveProducts(); } }
  });

  var editIdx = -1, pendingImg = null;
  function openProduct(i) {
    editIdx = i; pendingImg = null;
    var p = i >= 0 ? products[i] : { name: "", price: "", categories: [], description: "", details: "", badge: "", active: true, featured: true };
    $("#pDlgTitle").textContent = i >= 0 ? "Edit product" : "Add product";
    $("#pName").value = p.name; $("#pPrice").value = p.price; $("#pBadge").value = p.badge || "";
    $("#pCats").value = (p.categories || []).join(", "); $("#pDesc").value = p.description || ""; $("#pDetails").value = p.details || "";
    $("#pActive").checked = p.active !== false; $("#pFeat").checked = !!p.featured;
    $("#pImg").value = ""; $("#pImgPrev").src = p.thumb || p.image || "";
    $("#pDlg").showModal();
  }
  $("#addProduct").addEventListener("click", function () { openProduct(-1); });

  function loadImg(file) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { var im = new Image(); im.onload = function () { res(im); }; im.onerror = rej; im.src = r.result; }; r.onerror = rej; r.readAsDataURL(file); });
  }
  function toWebp(im, maxW, maxH, crop) {
    var c = document.createElement("canvas"), x = c.getContext("2d"), sx = 0, sy = 0, sw = im.width, sh = im.height, w, h;
    if (crop) { var r = maxW / maxH; if (sw / sh > r) { sw = Math.round(sh * r); sx = Math.round((im.width - sw) / 2); } else { sh = Math.round(sw / r); sy = Math.round((im.height - sh) / 2); } w = maxW; h = maxH; }
    else { var k = Math.min(1, maxW / sw, maxH / sh); w = Math.round(sw * k); h = Math.round(sh * k); }
    c.width = w; c.height = h; x.drawImage(im, sx, sy, sw, sh, 0, 0, w, h);
    var d = c.toDataURL("image/webp", 0.8);
    return d.indexOf("data:image/webp") === 0 ? d : c.toDataURL("image/jpeg", 0.82);
  }
  $("#pImg").addEventListener("change", function () {
    var f = this.files[0]; if (!f) return;
    loadImg(f).then(function (im) {
      pendingImg = { image: toWebp(im, 900, 1125, false), thumb: toWebp(im, 480, 600, true) };
      $("#pImgPrev").src = pendingImg.thumb;
    }).catch(function () { toast("Could not read that image."); });
  });
  $("#pForm").addEventListener("submit", function (e) {
    if (e.submitter && e.submitter.value !== "save") return;
    var name = $("#pName").value.trim(), price = parseFloat($("#pPrice").value);
    if (!name || !(price >= 0)) { e.preventDefault(); toast("Name and price are required."); return; }
    var p = editIdx >= 0 ? products[editIdx] : {};
    if (editIdx < 0) {
      var id = slug(name), n = 2; while (products.some(function (x) { return x.id === id; })) id = slug(name) + "-" + n++;
      p.id = id;
      if (!pendingImg) { e.preventDefault(); toast("Please add a product photo."); return; }
    }
    p.name = name; p.price = price; p.badge = $("#pBadge").value.trim();
    p.categories = $("#pCats").value.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    p.description = $("#pDesc").value.trim(); p.details = $("#pDetails").value.trim();
    p.active = $("#pActive").checked; p.featured = $("#pFeat").checked;
    if (pendingImg) { p.image = pendingImg.image; p.thumb = pendingImg.thumb; }
    if (editIdx < 0) products.unshift(p);
    saveProducts(); toast("Saved. Remember to publish.");
  });

  /* ---------------- publish ---------------- */
  function dataUrlToBlob(d) { var parts = d.split(","), bin = atob(parts[1]), a = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return new Blob([a], { type: parts[0].slice(5).split(";")[0] }); }
  function buildExport() {
    var files = [], stamp = Date.now().toString(36);
    var out = products.map(function (p) {
      var c = JSON.parse(JSON.stringify(p));
      ["image", "thumb"].forEach(function (k) {
        if (c[k] && c[k].indexOf("data:") === 0) {
          var ext = c[k].indexOf("image/webp") > 0 ? "webp" : "jpg";
          var path = (k === "thumb" ? "images/thumb/" : "images/") + c.id + "-" + stamp + "." + ext;
          files.push({ path: path, blob: dataUrlToBlob(c[k]) }); c[k] = path;
        }
      });
      return c;
    });
    return { json: JSON.stringify(out, null, 2), files: files, out: out };
  }
  $("#dlZip").addEventListener("click", function () {
    if (!window.JSZip) { toast("Zip tool still loading – check your internet and try again."); return; }
    var x = buildExport(), z = new JSZip();
    z.file("data/products.json", x.json);
    x.files.forEach(function (f) { z.file(f.path, f.blob); });
    z.generateAsync({ type: "blob" }).then(function (b) {
      download("deconfiserie-update-" + today() + ".zip", b);
      products = x.out; saveProducts(false); // images now point at their published paths
      $("#pubStatus").innerHTML = "<span class='ok'>Downloaded.</span> Upload &amp; extract it in your website root, then click “Mark as published”. (" + x.files.length + " new image file(s))";
    });
  });
  $("#dlJson").addEventListener("click", function () {
    var x = buildExport();
    if (x.files.length) { toast("New photos need the .zip download."); return; }
    download("products.json", new Blob([x.json], { type: "application/json" }));
  });
  $("#markPub").addEventListener("click", function () { sset("dc_admin_dirty", false); renderProducts(); toast("Marked as published."); });
  $("#resetDraft").addEventListener("click", function () {
    if (!confirm("Discard all unpublished product changes?")) return;
    loadLive().then(function (l) { products = l; sset("dc_admin_products", l); sset("dc_admin_dirty", false); renderProducts(); toast("Reloaded live products."); });
  });
  $("#previewToggle").addEventListener("change", function () { try { this.checked ? localStorage.setItem("dc_preview", "1") : localStorage.removeItem("dc_preview"); } catch (e) {} });
  $("#genHash").addEventListener("click", function () { var v = $("#newPw").value; if (v.length < 8) { toast("Use at least 8 characters."); return; } sha256(v).then(function (h) { $("#hashOut").value = h; $("#hashOut").select(); }); });

  /* ---------------- sales ---------------- */
  var STATUSES = ["Pending", "Confirmed", "Delivered", "Cancelled"];
  function renderSales() {
    var q = ($("#sSearch").value || "").toLowerCase(), f = $("#sFilter").value;
    var list = sales.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).filter(function (s) {
      return (!f || s.status === f) && (!q || [s.ref, s.customer, s.phone, s.note].join(" ").toLowerCase().indexOf(q) >= 0);
    });
    $("#sTable").innerHTML = "<thead><tr><th>Date</th><th>Ref</th><th>Customer</th><th>Items</th><th class='n'>Total</th><th>Status</th><th></th></tr></thead><tbody>" +
      (list.length ? list.map(function (s) {
        return "<tr><td>" + esc(s.date) + "</td><td>" + esc(s.ref || "–") + "</td><td>" + esc(s.customer || "–") + "<br><span class='muted'>" + esc(s.phone || "") + "</span></td>" +
          "<td>" + (s.items || []).map(function (i) { return esc(i.name) + " × " + i.qty; }).join("<br>") + "</td><td class='n'>" + money(s.total) + "</td>" +
          "<td><select data-st='" + s.id + "' aria-label='Status' style='padding:6px;width:auto'>" + STATUSES.map(function (x) { return "<option" + (x === s.status ? " selected" : "") + ">" + x + "</option>"; }).join("") + "</select></td>" +
          "<td style='white-space:nowrap'><button class='btn btn-ghost btn-sm' data-se='" + s.id + "'>Edit</button> <button class='btn btn-sm' style='color:var(--bad)' data-sd='" + s.id + "'>Delete</button></td></tr>";
      }).join("") : "<tr><td colspan='7' class='muted'>No sales yet. Use “Record sale” or “Paste WhatsApp order”.</td></tr>") + "</tbody>";
  }
  function findSale(id) { for (var i = 0; i < sales.length; i++) if (sales[i].id === id) return sales[i]; }
  $("#sSearch").addEventListener("input", renderSales);
  $("#sFilter").addEventListener("change", renderSales);
  $("#sTable").addEventListener("change", function (e) { var id = e.target.getAttribute("data-st"); if (id) { findSale(id).status = e.target.value; saveSales(); } });
  $("#sTable").addEventListener("click", function (e) {
    var b;
    if ((b = e.target.closest("[data-se]"))) openSale(findSale(b.getAttribute("data-se")));
    if ((b = e.target.closest("[data-sd]")) && confirm("Delete this sale?")) { var id = b.getAttribute("data-sd"); sales = sales.filter(function (s) { return s.id !== id; }); saveSales(); }
  });

  var editSale = null;
  function itemRow(it) {
    var opts = "<option value=''>Custom item…</option>" + products.map(function (p) { return "<option value='" + esc(p.id) + "' data-price='" + p.price + "'" + (it.id === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("");
    var d = document.createElement("div"); d.className = "items-row";
    d.innerHTML = "<div><select class='ip'>" + opts + "</select><input class='in' placeholder='Item name' value='" + esc(it.name || "") + "' style='margin-top:4px" + (it.id ? ";display:none" : "") + "'></div>" +
      "<input class='iq' type='number' min='1' value='" + (it.qty || 1) + "' aria-label='Qty'><input class='ipr' type='number' min='0' step='0.01' value='" + (it.price != null ? it.price : "") + "' placeholder='Price' aria-label='Unit price'>" +
      "<button type='button' class='btn btn-sm' style='padding:6px;color:var(--bad)' aria-label='Remove item'>×</button>";
    $("#sItems").appendChild(d);
  }
  function calcTotal() {
    var t = 0; $$(".items-row", $("#sItems")).forEach(function (r) { t += (parseFloat($(".iq", r).value) || 0) * (parseFloat($(".ipr", r).value) || 0); });
    t += parseFloat($("#sDel").value) || 0; $("#sTotal").value = Math.round(t * 100) / 100;
  }
  $("#sItems").addEventListener("change", function (e) {
    var r = e.target.closest(".items-row");
    if (e.target.classList.contains("ip")) {
      var o = e.target.selectedOptions[0];
      $(".in", r).style.display = o.value ? "none" : "";
      if (o.value) { $(".in", r).value = o.textContent; $(".ipr", r).value = o.getAttribute("data-price"); }
    }
    calcTotal();
  });
  $("#sItems").addEventListener("input", calcTotal);
  $("#sDel").addEventListener("input", calcTotal);
  $("#sItems").addEventListener("click", function (e) { if (e.target.closest("button")) { e.target.closest(".items-row").remove(); calcTotal(); } });
  $("#addItem").addEventListener("click", function () { itemRow({}); });

  function openSale(s) {
    editSale = s && s.id ? s : null;
    s = s || {};
    $("#sDate").value = s.date || today(); $("#sRef").value = s.ref || ""; $("#sCust").value = s.customer || ""; $("#sPhone").value = s.phone || "";
    $("#sDel").value = s.delivery || 0; $("#sPay").value = s.payment || "Cash on delivery"; $("#sStatus").value = s.status || "Confirmed"; $("#sNote").value = s.note || "";
    $("#sItems").innerHTML = ""; (s.items && s.items.length ? s.items : [{}]).forEach(itemRow);
    calcTotal(); $("#sDlg").showModal();
  }
  $("#addSale").addEventListener("click", function () { openSale(null); });
  $("#sForm").addEventListener("submit", function (e) {
    if (e.submitter && e.submitter.value !== "save") return;
    var items = $$(".items-row", $("#sItems")).map(function (r) {
      var sel = $(".ip", r);
      return { id: sel.value || "", name: sel.value ? sel.selectedOptions[0].textContent : $(".in", r).value.trim(), qty: parseInt($(".iq", r).value, 10) || 1, price: parseFloat($(".ipr", r).value) || 0 };
    }).filter(function (i) { return i.name; });
    if (!items.length) { e.preventDefault(); toast("Add at least one item."); return; }
    calcTotal();
    var s = editSale || { id: uid() };
    s.date = $("#sDate").value; s.ref = $("#sRef").value.trim(); s.customer = $("#sCust").value.trim(); s.phone = $("#sPhone").value.trim();
    s.items = items; s.delivery = parseFloat($("#sDel").value) || 0; s.total = parseFloat($("#sTotal").value) || 0;
    s.payment = $("#sPay").value; s.status = $("#sStatus").value; s.note = $("#sNote").value.trim();
    if (!editSale) sales.push(s);
    saveSales(); toast("Sale saved.");
  });

  /* paste WhatsApp order */
  $("#pasteOrder").addEventListener("click", function () { $("#wText").value = ""; $("#wDlg").showModal(); });
  $("#wForm").addEventListener("submit", function (e) {
    if (e.submitter && e.submitter.value !== "parse") return;
    var t = $("#wText").value, m, items = [];
    var re = /^\s*(?:\d+\)\s*)?\*?(.+?)\*?\s*[×x]\s*(\d+)\s*=\s*QAR\s*([\d,\.]+)/gim;
    while ((m = re.exec(t))) { var q = +m[2], tot = parseFloat(m[3].replace(/,/g, "")); items.push({ name: m[1].trim(), qty: q, price: Math.round(tot / q * 100) / 100 }); }
    if (!items.length) { var one = /\*(.+?)\*\s*[–-]\s*QAR\s*([\d,\.]+)/.exec(t); if (one) items.push({ name: one[1].trim(), qty: 1, price: parseFloat(one[2].replace(/,/g, "")) }); }
    items.forEach(function (i) { var p = products.filter(function (x) { return x.name.toLowerCase() === i.name.toLowerCase(); })[0]; if (p) i.id = p.id; });
    var get = function (rx) { var r = rx.exec(t); return r ? r[1].trim() : ""; };
    var msgs = []; var mr = /Message on cake:\s*(.+)/gi, mm; while ((mm = mr.exec(t))) msgs.push(mm[1].trim());
    var dd = get(/^Delivery date:\s*(.+)$/m), area = get(/^Area:\s*(.+)$/m);
    setTimeout(function () {
      openSale({ ref: get(/Order ref:\s*(\S+)/i), customer: get(/^Name:\s*(.+)$/m), phone: get(/^Phone:\s*(.+)$/m), items: items, status: "Pending",
        note: [dd && "Delivery " + dd, area, msgs.length && "Cake msg: " + msgs.join(" | ")].filter(Boolean).join(" · ") });
      if (!items.length) toast("Couldn’t find items – please add them manually.");
    }, 50);
  });

  $("#csv").addEventListener("click", function () {
    var rows = [["Date", "Ref", "Customer", "Phone", "Items", "Delivery", "Total", "Payment", "Status", "Notes"]];
    sales.slice().sort(function (a, b) { return a.date.localeCompare(b.date); }).forEach(function (s) {
      rows.push([s.date, s.ref, s.customer, s.phone, (s.items || []).map(function (i) { return i.name + " x" + i.qty; }).join("; "), s.delivery, s.total, s.payment, s.status, s.note]);
    });
    var csv = rows.map(function (r) { return r.map(function (v) { v = v == null ? "" : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\n");
    download("deconfiserie-sales-" + today() + ".csv", new Blob(["﻿" + csv], { type: "text/csv" }));
  });
  $("#backup").addEventListener("click", function () { download("deconfiserie-sales-backup-" + today() + ".json", new Blob([JSON.stringify({ sales: sales, exported: new Date().toISOString() }, null, 2)], { type: "application/json" })); });
  $("#restore").addEventListener("change", function () {
    var f = this.files[0]; if (!f) return; var r = new FileReader();
    r.onload = function () {
      try { var d = JSON.parse(r.result); var list = Array.isArray(d) ? d : d.sales; if (!Array.isArray(list)) throw 0;
        var ids = {}; sales.forEach(function (s) { ids[s.id] = 1; }); var added = 0;
        list.forEach(function (s) { if (s && s.id && !ids[s.id]) { sales.push(s); added++; } });
        saveSales(); toast("Restored " + added + " sale(s)."); } catch (e) { toast("That file is not a valid backup."); }
    };
    r.readAsText(f);
  });

  /* ---------------- dashboard ---------------- */
  function dkey(d) { return d.toISOString().slice(0, 10); }
  function renderDash() {
    var rv = $("#range").value, now = new Date(today() + "T00:00:00Z"), from = null;
    if (rv !== "all") { from = new Date(now); from.setUTCDate(from.getUTCDate() - (+rv - 1)); }
    var inR = sales.filter(function (s) { return !from || s.date >= dkey(from); });
    var valid = inR.filter(function (s) { return s.status !== "Cancelled"; });
    var rev = valid.reduce(function (a, s) { return a + (+s.total || 0); }, 0);
    $("#kRev").textContent = money(rev);
    $("#kOrd").textContent = valid.length;
    $("#kAov").textContent = valid.length ? money(Math.round(rev / valid.length)) : "–";
    $("#kPen").textContent = sales.filter(function (s) { return s.status === "Pending"; }).length;

    // series
    var monthly = rv === "365" || rv === "all", buckets = [], map = {};
    if (monthly) {
      var start = from ? new Date(from) : (valid.length ? new Date(valid.reduce(function (m, s) { return s.date < m ? s.date : m; }, today()) + "T00:00:00Z") : new Date(now));
      start.setUTCDate(1);
      for (var d = new Date(start); d <= now; d.setUTCMonth(d.getUTCMonth() + 1)) { var k = dkey(d).slice(0, 7); map[k] = buckets.length; buckets.push({ k: k, label: d.toLocaleString("en", { month: "short", timeZone: "UTC" }) + " " + String(d.getUTCFullYear()).slice(2), v: 0 }); }
      valid.forEach(function (s) { var i = map[s.date.slice(0, 7)]; if (i != null) buckets[i].v += +s.total || 0; });
    } else {
      for (var d2 = new Date(from); d2 <= now; d2.setUTCDate(d2.getUTCDate() + 1)) { var k2 = dkey(d2); map[k2] = buckets.length; buckets.push({ k: k2, label: d2.toLocaleString("en", { day: "numeric", month: "short", timeZone: "UTC" }), v: 0 }); }
      valid.forEach(function (s) { var i = map[s.date]; if (i != null) buckets[i].v += +s.total || 0; });
    }
    $("#chartTitle").textContent = "Revenue by " + (monthly ? "month" : "day") + " (QAR)";
    drawChart(buckets);

    // top products
    var agg = {};
    valid.forEach(function (s) { (s.items || []).forEach(function (i) { var k = i.name; agg[k] = (agg[k] || 0) + i.qty * i.price; }); });
    var top = Object.keys(agg).map(function (k) { return { n: k, v: agg[k] }; }).sort(function (a, b) { return b.v - a.v; }).slice(0, 6);
    var mx = top.length ? top[0].v : 1;
    $("#top").innerHTML = top.length ? top.map(function (t) { return "<div class='hbar'><span class='t' title='" + esc(t.n) + "'>" + esc(t.n) + "</span><span class='v'>" + money(t.v) + "</span><span class='b'><i style='width:" + Math.max(2, t.v / mx * 100) + "%'></i></span></div>"; }).join("") : "<p class='muted'>No sales in this period.</p>";

    var rec = sales.slice().sort(function (a, b) { return b.date.localeCompare(a.date); }).slice(0, 8);
    $("#recent").innerHTML = "<thead><tr><th>Date</th><th>Customer</th><th>Items</th><th class='n'>Total</th><th>Status</th></tr></thead><tbody>" +
      (rec.length ? rec.map(function (s) { return "<tr><td>" + esc(s.date) + "</td><td>" + esc(s.customer || "–") + "</td><td>" + (s.items || []).map(function (i) { return esc(i.name) + " × " + i.qty; }).join(", ") + "</td><td class='n'>" + money(s.total) + "</td><td><span class='st st-" + esc(s.status) + "'>" + esc(s.status) + "</span></td></tr>"; }).join("") : "<tr><td colspan='5' class='muted'>No orders yet.</td></tr>") + "</tbody>";
  }
  $("#range").addEventListener("change", renderDash);

  function niceMax(v) { if (v <= 0) return 100; var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; }
  function drawChart(b) {
    var W = 640, H = 220, L = 52, R = 8, T = 10, B = 26, el = $("#chart");
    var max = niceMax(Math.max.apply(null, b.map(function (x) { return x.v; }).concat([0])));
    var cw = (W - L - R) / Math.max(1, b.length), bw = Math.max(2, Math.min(36, cw - 2));
    var y = function (v) { return T + (H - T - B) * (1 - v / max); };
    var s = "<svg viewBox='0 0 " + W + " " + H + "' role='img' aria-label='Revenue chart'>";
    for (var g = 0; g <= 4; g++) { var gv = max * g / 4, gy = y(gv); s += "<line x1='" + L + "' x2='" + (W - R) + "' y1='" + gy + "' y2='" + gy + "' stroke='#EFE2D8' stroke-width='1'/><text x='" + (L - 6) + "' y='" + (gy + 4) + "' text-anchor='end' font-size='10' fill='#8C7368'>" + (gv >= 1000 ? (gv / 1000) + "k" : gv) + "</text>"; }
    var step = Math.ceil(b.length / 8);
    b.forEach(function (d, i) {
      var x = L + i * cw + (cw - bw) / 2, yy = y(d.v), h = H - B - yy;
      if (d.v > 0) { var r = Math.min(4, bw / 2, h); s += "<path d='M" + x + "," + (H - B) + "V" + (yy + r) + "q0,-" + r + " " + r + ",-" + r + "H" + (x + bw - r) + "q" + r + ",0 " + r + "," + r + "V" + (H - B) + "Z' fill='#B4475F'/>"; }
      if (i % step === 0) s += "<text x='" + (L + i * cw + cw / 2) + "' y='" + (H - 8) + "' text-anchor='middle' font-size='10' fill='#8C7368'>" + esc(d.label) + "</text>";
      s += "<rect x='" + (L + i * cw) + "' y='" + T + "' width='" + cw + "' height='" + (H - T - B) + "' fill='transparent' data-i='" + i + "'/>";
    });
    s += "<line x1='" + L + "' x2='" + (W - R) + "' y1='" + (H - B) + "' y2='" + (H - B) + "' stroke='#CDBFB5'/></svg><div class='tip'></div>";
    el.innerHTML = s;
    var tip = $(".tip", el);
    el.onmousemove = function (e) {
      var i = e.target.getAttribute && e.target.getAttribute("data-i");
      if (i == null) { tip.style.display = "none"; return; }
      var r = el.getBoundingClientRect(); tip.style.display = "block";
      tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px";
      tip.innerHTML = esc(b[i].label) + ": <b>" + money(b[i].v) + "</b>";
    };
    el.onmouseleave = function () { tip.style.display = "none"; };
  }

  if (authed()) start();
})();
