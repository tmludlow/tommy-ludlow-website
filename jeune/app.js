/* Jeune preview site: home page behaviour
   - bag + preview checkout (no payment, nothing is sent)
   - scroll effects
   Settings live in config.js. The cycle tracker is on tracker.html. */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- storage (never required for the page to work) ---------- */
const store = {
  get(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  },
  set(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ } },
  del(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
};

const money = (n) => "$" + Number(n).toLocaleString("en-US");

/* ---------- brand + prices ---------- */
$$("[data-brand]").forEach((el) => { el.textContent = CONFIG.brand; });
document.title = CONFIG.brand + ": Supplements that move with your cycle";
$$("[data-price]").forEach((el) => {
  const id = el.dataset.price === "essential" ? "essential-pouch" : el.dataset.price;
  el.textContent = money(CONFIG.items[id].price);
});

/* ---------- reveal on scroll ---------- */
(function reveal() {
  const els = $$(".reveal");
  if (!("IntersectionObserver" in window) || reduceMotion) { els.forEach((e) => e.classList.add("in")); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
  }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });
  els.forEach((e) => io.observe(e));
})();

/* ---------- scroll effects: hero scale + statement words ---------- */
(function scrollFx() {
  const hero = $("#heroMedia");
  const statement = $("#statement");
  const textEl = $("#statementText");

  // split statement into words
  const words = textEl.textContent.trim().split(/\s+/);
  textEl.textContent = "";
  const spans = words.map((w, i) => {
    const s = document.createElement("span");
    s.className = "w";
    s.textContent = w;
    textEl.appendChild(s);
    if (i < words.length - 1) textEl.appendChild(document.createTextNode(" "));
    return s;
  });
  textEl.setAttribute("aria-label", words.join(" "));

  if (reduceMotion) { spans.forEach((s) => s.classList.add("on")); return; }

  let ticking = false;
  function update() {
    ticking = false;
    const vh = window.innerHeight;
    if (hero) {
      const r = hero.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.9)));
      hero.style.transform = "scale(" + (0.94 + 0.06 * t).toFixed(4) + ")";
    }
    const sr = statement.getBoundingClientRect();
    const total = sr.height - vh;
    const p = total > 0 ? Math.min(1, Math.max(0, -sr.top / total)) : 1;
    const q = Math.min(1, Math.max(0, (p - 0.06) / 0.74));
    const on = Math.ceil(q * spans.length);
    spans.forEach((s, i) => s.classList.toggle("on", i < on));
  }
  function onScroll() { if (!ticking) { ticking = true; requestAnimationFrame(update); } }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
})();

/* =====================================================================
   BAG + PREVIEW CHECKOUT
   ===================================================================== */
const bag = (function () {
  const KEY = "jeune.cart.v1";
  let items = store.get(KEY, []).filter(function (i) { return CONFIG.items[i.id]; });
  let lastFocus = null;

  const drawer = $("#drawer"), scrim = $("#scrim"), checkout = $("#checkout");

  const count = () => items.reduce((n, i) => n + i.qty, 0);
  const total = () => items.reduce((n, i) => n + CONFIG.items[i.id].price * i.qty, 0);
  const deposit = () => (items.length ? Math.min(CONFIG.deposit, total()) : 0);
  function save() { store.set(KEY, items); }

  function add(id) {
    const f = items.find(function (i) { return i.id === id; });
    if (f) f.qty += 1; else items.push({ id: id, qty: 1 });
    save(); render(); open();
  }
  function change(id, delta) {
    const f = items.find(function (i) { return i.id === id; });
    if (!f) return;
    f.qty += delta;
    if (f.qty <= 0) items = items.filter(function (i) { return i.id !== id; });
    save(); render();
  }

  function lineHTML(i, editable) {
    const it = CONFIG.items[i.id];
    const row = document.createElement("div");
    row.className = "line-item";
    const img = document.createElement("img");
    img.src = it.img; img.alt = ""; img.width = 64; img.height = 64;
    const mid = document.createElement("div");
    const nm = document.createElement("div"); nm.className = "li-name"; nm.textContent = it.name;
    const meta = document.createElement("div"); meta.className = "li-meta"; meta.textContent = it.meta + " · monthly";
    mid.append(nm, meta);
    if (editable) {
      const q = document.createElement("div"); q.className = "qty";
      const minus = document.createElement("button"); minus.type = "button"; minus.textContent = "−"; minus.setAttribute("aria-label", "Remove one " + it.name); minus.dataset.act = "dec"; minus.dataset.id = i.id;
      const n = document.createElement("span"); n.textContent = String(i.qty);
      const plus = document.createElement("button"); plus.type = "button"; plus.textContent = "+"; plus.setAttribute("aria-label", "Add one " + it.name); plus.dataset.act = "inc"; plus.dataset.id = i.id;
      q.append(minus, n, plus); mid.append(q);
    } else {
      meta.textContent += " · Qty " + i.qty;
    }
    const pr = document.createElement("div"); pr.className = "li-price"; pr.textContent = money(it.price * i.qty);
    row.append(img, mid, pr);
    return row;
  }

  function render() {
    const c = count();
    const badge = $("#cartCount");
    badge.textContent = String(c); badge.hidden = c === 0;
    $("#cartBtn").setAttribute("aria-label", "Open bag, " + c + (c === 1 ? " item" : " items"));

    const body = $("#drawerBody");
    body.innerHTML = "";
    if (!items.length) {
      const e = document.createElement("p"); e.className = "empty-bag"; e.textContent = "Your bag is empty.";
      body.appendChild(e);
    } else {
      items.forEach(function (i) { body.appendChild(lineHTML(i, true)); });
    }
    $("#drawerFoot").hidden = !items.length;
    $("#dTotal").textContent = money(total());
    $("#dDeposit").textContent = money(deposit());

    // checkout summary
    const co = $("#coItems");
    co.innerHTML = "";
    items.forEach(function (i) { co.appendChild(lineHTML(i, false)); });
    $("#coTotal").textContent = money(total());
    $("#coDeposit").textContent = money(deposit());
  }

  function lock(on) { document.body.style.overflow = on ? "hidden" : ""; }

  function open() {
    lastFocus = document.activeElement;
    drawer.hidden = false; scrim.hidden = false; lock(true);
    $("#drawerClose").focus();
  }
  function close() {
    drawer.hidden = true; scrim.hidden = true;
    if (checkout.hidden) lock(false);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  function openCheckout() {
    if (!items.length) return;
    drawer.hidden = true; scrim.hidden = true;
    checkout.hidden = false; lock(true);
    $("#coForm").hidden = false; $("#coDone").hidden = true;
    checkout.scrollTop = 0;
    $("#coFormEl [name=email]").focus();
  }
  function closeCheckout() {
    checkout.hidden = true; lock(false);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  // events
  $("#cartBtn").addEventListener("click", open);
  $("#drawerClose").addEventListener("click", close);
  scrim.addEventListener("click", close);
  $("#toCheckout").addEventListener("click", openCheckout);
  $("#coClose").addEventListener("click", closeCheckout);
  $("#doneClose").addEventListener("click", closeCheckout);
  $("#drawerBody").addEventListener("click", function (e) {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    change(b.dataset.id, b.dataset.act === "inc" ? 1 : -1);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    if (!checkout.hidden) closeCheckout(); else if (!drawer.hidden) close();
  });

  $$("[data-add]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      let id = btn.dataset.add;
      if (id === "essential") id = "essential-" + $("#essentialFormat").value;
      add(id);
    });
  });

  // preview checkout form
  const formEl = $("#coFormEl"), errEl = $("#coError");
  formEl.addEventListener("submit", function (e) {
    e.preventDefault();
    const bad = [];
    $$("input[required]", formEl).forEach(function (inp) {
      let ok = inp.type === "checkbox" ? inp.checked : inp.value.trim().length > 0;
      if (inp.type === "email") ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inp.value.trim());
      inp.setAttribute("aria-invalid", ok ? "false" : "true");
      if (!ok) bad.push(inp);
    });
    if (bad.length) {
      errEl.textContent = "Please complete the highlighted fields" + (bad.some(function (b) { return b.type === "checkbox"; }) ? " and confirm the pre-order terms." : ".");
      errEl.hidden = false; bad[0].focus();
      return;
    }
    errEl.hidden = true;
    const email = $("[name=email]", formEl).value.trim();
    const ref = "PRE-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    $("#doneText").textContent = "Preview reference " + ref + ". Nothing was saved, sent or charged. In the live version, a confirmation would go to " + email + " and a refundable deposit of " + money(deposit()) + " would be taken.";
    items = []; save(); render();
    $("#coForm").hidden = true; $("#coDone").hidden = false;
    checkout.scrollTop = 0;
    formEl.reset();
  });

  render();
  return { add: add };
})();
