/* De Confiserie storefront – no database, no framework */
(function () {
  "use strict";
  var S = window.SITE || {};
  var CUR = S.currency || "QAR";
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* ---------- safe storage ---------- */
  function sget(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function sset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return CUR + " " + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }); }
  function waLink(text) { return "https://wa.me/" + S.whatsapp + "?text=" + encodeURIComponent(text); }
  function productUrl(p) { return "product.html?id=" + encodeURIComponent(p.id); }
  var WA_SVG = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>';

  function toast(html) {
    var t = $("#toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.innerHTML = html; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2800);
  }

  /* ---------- products ---------- */
  var PRODUCTS = [];
  function isPreview() { try { return localStorage.getItem("dc_preview") === "1"; } catch (e) { return false; } }
  function loadProducts() {
    if (isPreview()) {
      var d = sget("dc_admin_products", null);
      if (d) return Promise.resolve(d);
    }
    return fetch("data/products.json", { cache: "no-cache" })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .catch(function () { return window.__PRODUCTS || []; });
  }
  function active() { return PRODUCTS.filter(function (p) { return p.active !== false; }); }
  function byId(id) { for (var i = 0; i < PRODUCTS.length; i++) if (PRODUCTS[i].id === id) return PRODUCTS[i]; return null; }

  function buyText(p) {
    return "Hello " + S.brand + ", I would like to order:\n*" + p.name + "* – " + money(p.price) +
      "\n" + S.domain + "/" + productUrl(p) + "\n\nName / message on cake: \nDelivery date: \nDelivery area: ";
  }
  function card(p) {
    return '<article class="card">' +
      '<a class="card-img" href="' + productUrl(p) + '"><img src="' + esc(p.thumb || p.image) + '" alt="' + esc(p.name) + '" width="480" height="600" loading="lazy" decoding="async"></a>' +
      (p.badge ? '<span class="badge">' + esc(p.badge) + "</span>" : "") +
      '<div class="card-body"><h3 class="card-title"><a href="' + productUrl(p) + '">' + esc(p.name) + "</a></h3>" +
      '<p class="price">' + money(p.price) + "</p>" +
      '<div class="card-actions"><button type="button" class="btn btn-outline" data-add="' + esc(p.id) + '">Add to cart</button>' +
      '<a class="btn btn-wa" href="' + waLink(buyText(p)) + '" target="_blank" rel="noopener" aria-label="Buy ' + esc(p.name) + ' on WhatsApp">' + WA_SVG + "Buy</a></div>" +
      "</div></article>";
  }

  /* ---------- cart ---------- */
  function getCart() { return sget("dc_cart", []); }
  function setCart(c) { sset("dc_cart", c); updateCount(); }
  function addToCart(id, qty, msg) {
    var c = getCart(), found = null;
    c.forEach(function (l) { if (l.id === id && (l.msg || "") === (msg || "")) found = l; });
    if (found) found.qty += qty || 1; else c.push({ id: id, qty: qty || 1, msg: msg || "" });
    setCart(c);
    var p = byId(id);
    toast("Added " + esc(p ? p.name : "item") + ' <a href="cart.html">View cart</a>');
  }
  function updateCount() {
    var n = getCart().reduce(function (a, l) { return a + l.qty; }, 0);
    $$(".cart-count").forEach(function (el) { el.textContent = n; el.setAttribute("data-n", n); });
  }

  /* ---------- global events ---------- */
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-add]");
    if (b) { e.preventDefault(); addToCart(b.getAttribute("data-add"), 1, ""); }
    var m = e.target.closest(".menu-btn");
    if (m) { var nav = $(".nav"); var o = nav.classList.toggle("open"); m.setAttribute("aria-expanded", o); }
  });

  /* ---------- pages ---------- */
  function renderHome() {
    var g = $("#featured"); if (!g) return;
    var list = active().filter(function (p) { return p.featured; });
    if (list.length < 4) list = active();
    g.innerHTML = list.slice(0, 8).map(card).join("");
  }

  function renderShop() {
    var g = $("#grid"); if (!g) return;
    var params = new URLSearchParams(location.search);
    var state = { cat: params.get("cat") || "All", q: params.get("q") || "", sort: "featured" };
    var cats = ["All"];
    active().forEach(function (p) { (p.categories || []).forEach(function (c) { if (cats.indexOf(c) < 0) cats.push(c); }); });
    var chipBox = $("#cats");
    chipBox.innerHTML = cats.map(function (c) { return '<button type="button" class="chip" data-cat="' + esc(c) + '" aria-pressed="' + (c === state.cat) + '">' + esc(c) + "</button>"; }).join("");
    $("#q").value = state.q;
    function draw() {
      var q = state.q.toLowerCase();
      var list = active().filter(function (p) {
        return (state.cat === "All" || (p.categories || []).indexOf(state.cat) >= 0) &&
          (!q || (p.name + " " + (p.description || "") + " " + (p.categories || []).join(" ")).toLowerCase().indexOf(q) >= 0);
      });
      if (state.sort === "low") list.sort(function (a, b) { return a.price - b.price; });
      if (state.sort === "high") list.sort(function (a, b) { return b.price - a.price; });
      if (state.sort === "name") list.sort(function (a, b) { return a.name.localeCompare(b.name); });
      g.innerHTML = list.length ? list.map(card).join("") : '<p class="empty" style="grid-column:1/-1">No cakes match your search. <a href="' + waLink("Hello " + S.brand + ", I am looking for a custom cake: ") + '" target="_blank" rel="noopener">Ask us on WhatsApp</a> – we make custom designs.</p>';
      $("#count").textContent = list.length + (list.length === 1 ? " cake" : " cakes");
    }
    chipBox.addEventListener("click", function (e) {
      var c = e.target.closest("[data-cat]"); if (!c) return;
      state.cat = c.getAttribute("data-cat");
      $$(".chip", chipBox).forEach(function (x) { x.setAttribute("aria-pressed", x === c); });
      var u = new URL(location); state.cat === "All" ? u.searchParams.delete("cat") : u.searchParams.set("cat", state.cat); history.replaceState(null, "", u);
      draw();
    });
    $("#q").addEventListener("input", function (e) { state.q = e.target.value; draw(); });
    $("#sort").addEventListener("change", function (e) { state.sort = e.target.value; draw(); });
    draw();
  }

  function setMeta(sel, attr, val) { var el = $(sel); if (el) el.setAttribute(attr, val); }
  function renderProduct() {
    var box = $("#pdp"); if (!box) return;
    var id = new URLSearchParams(location.search).get("id");
    var p = id && byId(id);
    if (!p || p.active === false) {
      box.innerHTML = '<div class="empty" style="grid-column:1/-1"><h1>Cake not found</h1><p>This item may no longer be available.</p><a class="btn btn-primary" href="cakes.html">Browse all cakes</a></div>';
      return;
    }
    var url = S.domain + "/" + productUrl(p);
    document.title = p.name + " – " + money(p.price) + " | " + S.brand + " Qatar";
    var d = (p.description || p.name).slice(0, 155);
    setMeta('meta[name="description"]', "content", d);
    setMeta('link[rel="canonical"]', "href", url);
    setMeta('meta[property="og:title"]', "content", p.name + " | " + S.brand);
    setMeta('meta[property="og:description"]', "content", d);
    setMeta('meta[property="og:url"]', "content", url);
    if (p.image && p.image.indexOf("data:") !== 0) setMeta('meta[property="og:image"]', "content", S.domain + "/" + p.image);
    var ld = document.createElement("script"); ld.type = "application/ld+json";
    ld.textContent = JSON.stringify({ "@context": "https://schema.org", "@type": "Product", name: p.name, image: S.domain + "/" + p.image, description: p.description, sku: p.id, brand: { "@type": "Brand", name: S.brand },
      offers: { "@type": "Offer", priceCurrency: CUR, price: p.price, availability: "https://schema.org/InStock", url: url, seller: { "@type": "Organization", name: S.legalName } } });
    document.head.appendChild(ld);
    $("#crumb").textContent = p.name;

    box.innerHTML =
      '<div class="pdp-img"><img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" width="900" height="1125" fetchpriority="high"></div>' +
      "<div>" +
      '<div class="tags">' + (p.categories || []).map(function (c) { return '<a class="tag" href="cakes.html?cat=' + encodeURIComponent(c) + '">' + esc(c) + "</a>"; }).join("") + "</div>" +
      "<h1>" + esc(p.name) + "</h1>" +
      '<p class="price">' + money(p.price) + ' <small>incl. all taxes</small></p>' +
      '<p class="desc">' + esc(p.description || "") + "</p>" +
      (p.details ? '<p class="note">' + esc(p.details) + "</p>" : "") +
      '<div class="field"><label for="msg">Name / message on cake</label><input id="msg" maxlength="60" placeholder="e.g. Happy Birthday Sara"></div>' +
      '<div class="field"><label for="qty">Quantity</label><div class="qty"><button type="button" data-q="-1" aria-label="Decrease">−</button><input id="qty" value="1" inputmode="numeric" aria-label="Quantity"><button type="button" data-q="1" aria-label="Increase">+</button></div></div>' +
      '<div class="pdp-actions"><button type="button" class="btn btn-primary" id="addBtn">Add to cart</button><a class="btn btn-wa" id="buyBtn" target="_blank" rel="noopener" href="#">' + WA_SVG + "Buy on WhatsApp</a></div>" +
      '<p class="note">' + esc(S.deliveryNote) + '. Designs can be customised – share your idea on WhatsApp. Theme cakes are best ordered at least 48 hours in advance.</p>' +
      "</div>";
    function qty() { var n = parseInt($("#qty").value, 10); return n > 0 ? Math.min(n, 50) : 1; }
    function syncBuy() {
      var m = $("#msg").value.trim();
      $("#buyBtn").href = waLink("Hello " + S.brand + ", I would like to order:\n*" + p.name + "* × " + qty() + " = " + money(p.price * qty()) + "\n" + url +
        "\nName / message on cake: " + m + "\nDelivery date: \nDelivery area: ");
    }
    box.addEventListener("click", function (e) {
      var q = e.target.closest("[data-q]");
      if (q) { $("#qty").value = Math.max(1, qty() + parseInt(q.getAttribute("data-q"), 10)); syncBuy(); }
    });
    box.addEventListener("input", syncBuy);
    $("#addBtn").addEventListener("click", function () { addToCart(p.id, qty(), $("#msg").value.trim()); });
    syncBuy();
    var rel = active().filter(function (x) { return x.id !== p.id && (x.categories || []).some(function (c) { return (p.categories || []).indexOf(c) >= 0; }); }).slice(0, 4);
    if (rel.length) { $("#related").innerHTML = rel.map(card).join(""); $("#relatedWrap").hidden = false; }
  }

  function orderRef() {
    var d = new Date(), z = function (n) { return String(n).padStart(2, "0"); };
    return "DC-" + String(d.getFullYear()).slice(2) + z(d.getMonth() + 1) + z(d.getDate()) + "-" + Math.floor(1000 + Math.random() * 9000);
  }
  function renderCart() {
    var box = $("#cartLines"); if (!box) return;
    var dateIn = $("#c_date");
    var t = new Date(); t.setDate(t.getDate() + 1); dateIn.min = t.toISOString().slice(0, 10);
    var saved = sget("dc_customer", {});
    ["name", "phone", "area", "address", "date", "slot", "notes"].forEach(function (k) { var el = $("#c_" + k); if (el && saved[k]) el.value = saved[k]; });

    function draw() {
      var c = getCart().filter(function (l) { return byId(l.id); });
      if (!c.length) {
        $("#cartWrap").hidden = true; $("#cartEmpty").hidden = false; return;
      }
      $("#cartWrap").hidden = false; $("#cartEmpty").hidden = true;
      var sub = 0;
      box.innerHTML = c.map(function (l, i) {
        var p = byId(l.id); sub += p.price * l.qty;
        return '<div class="line"><a href="' + productUrl(p) + '"><img src="' + esc(p.thumb || p.image) + '" alt="' + esc(p.name) + '" width="80" height="100" loading="lazy"></a>' +
          "<div><h3>" + esc(p.name) + "</h3><div class=\"note\">" + money(p.price) + " each</div>" +
          '<div class="msg"><input data-msg="' + i + '" value="' + esc(l.msg) + '" maxlength="60" placeholder="Name / message on cake" aria-label="Message on cake for ' + esc(p.name) + '"></div></div>' +
          '<div class="line-end"><strong>' + money(p.price * l.qty) + '</strong><div class="qty"><button type="button" data-dq="' + i + '" data-v="-1" aria-label="Decrease">−</button><input value="' + l.qty + '" readonly aria-label="Quantity"><button type="button" data-dq="' + i + '" data-v="1" aria-label="Increase">+</button></div>' +
          '<button type="button" class="link-btn" data-rm="' + i + '">Remove</button></div></div>';
      }).join("");
      $("#subtotal").textContent = money(sub);
      $("#total").textContent = money(sub);
    }
    box.addEventListener("click", function (e) {
      var c = getCart().filter(function (l) { return byId(l.id); }), b;
      if ((b = e.target.closest("[data-dq]"))) { var l = c[+b.getAttribute("data-dq")]; l.qty = Math.max(1, l.qty + +b.getAttribute("data-v")); setCart(c); draw(); }
      if ((b = e.target.closest("[data-rm]"))) { c.splice(+b.getAttribute("data-rm"), 1); setCart(c); draw(); }
    });
    box.addEventListener("change", function (e) {
      var i = e.target.getAttribute("data-msg"); if (i == null) return;
      var c = getCart().filter(function (l) { return byId(l.id); }); c[+i].msg = e.target.value.trim(); setCart(c);
    });

    $("#checkout").addEventListener("submit", function (e) {
      e.preventDefault();
      var f = {}; ["name", "phone", "area", "address", "date", "slot", "notes"].forEach(function (k) { f[k] = ($("#c_" + k).value || "").trim(); });
      sset("dc_customer", f);
      var c = getCart().filter(function (l) { return byId(l.id); });
      if (!c.length) return;
      var ref = orderRef(), sub = 0;
      var lines = c.map(function (l, i) {
        var p = byId(l.id); sub += p.price * l.qty;
        return (i + 1) + ") " + p.name + " × " + l.qty + " = " + money(p.price * l.qty) + (l.msg ? "\n   Message on cake: " + l.msg : "");
      });
      var text = "*New Order – " + S.brand + "*\nOrder ref: " + ref + "\n\n" + lines.join("\n") +
        "\n\nSubtotal: " + money(sub) + "\nDelivery: to be confirmed\n\n" +
        "Name: " + f.name + "\nPhone: " + f.phone + "\nArea: " + f.area + "\nAddress: " + f.address +
        "\nDelivery date: " + f.date + "\nTime slot: " + f.slot + (f.notes ? "\nNotes: " + f.notes : "") +
        "\n\nI agree to the Terms & Conditions and Refund Policy.";
      window.open(waLink(text), "_blank", "noopener");
      $("#doneRef").textContent = ref;
      $("#doneLink").href = waLink(text);
      setCart([]);
      $("#cartWrap").hidden = true; $("#cartDone").hidden = false;
      window.scrollTo(0, 0);
    });
    draw();
  }

  /* ---------- boot ---------- */
  updateCount();
  var page = document.body.getAttribute("data-page");
  if (isPreview()) { var bar = document.createElement("div"); bar.className = "strip"; bar.style.background = "#B4475F"; bar.innerHTML = 'Preview mode – showing unpublished admin changes on this device only. <a href="admin.html">Admin</a>'; document.body.insertBefore(bar, document.body.firstChild); }
  if (["home", "shop", "product", "cart"].indexOf(page) >= 0) {
    loadProducts().then(function (list) {
      PRODUCTS = Array.isArray(list) ? list : [];
      if (page === "home") renderHome();
      if (page === "shop") renderShop();
      if (page === "product") renderProduct();
      if (page === "cart") renderCart();
    });
  }
})();
