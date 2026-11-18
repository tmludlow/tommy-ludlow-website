/* Jeune preview site: behaviour
   - cycle tracker (toolbar + ring)
   - bag + preview checkout (no payment, nothing is sent)
   - scroll effects
   Everything the founders may want to change is in CONFIG. */

const CONFIG = {
  brand: "Jeune",          // placeholder: change here when the name is settled
  deposit: 20,             // refundable pre-order deposit, in dollars
  items: {
    "kit":               { name: "The Cycle Kit",       price: 120, img: "images/trio.jpg",      meta: "56 pouches · 28-day cycle" },
    "essential-pouch":   { name: "The Essential Blend", price: 49,  img: "images/essential.jpg", meta: "28 liposomal pouches" },
    "essential-capsule": { name: "The Essential Blend", price: 49,  img: "images/essential.jpg", meta: "30 capsules" }
  },
  // Blend days follow the pitch deck: 1-5, 6-11, 12 to the end of the cycle.
  phases: {
    menstrual:  { name: "Menstrual",  color: "var(--menstrual)",  endDay: () => 5 },
    follicular: { name: "Follicular", color: "var(--follicular)", endDay: () => 11 },
    luteal:     { name: "Luteal",     color: "var(--luteal)",     endDay: (len) => len }
  },
  minCycle: 21,
  maxCycle: 35,
  defaultCycle: 28
};

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
   CYCLE TRACKER
   ===================================================================== */
const tracker = (function () {
  const KEY = "jeune.cycle.v1";
  const toolbar = $("#toolbar");
  const summaryBtn = $("#toolbarSummary");
  const form = $("#toolbarForm");
  const startInput = $("#tbStart");
  const lenOut = $("#tbLen");
  const errEl = $("#tbError");
  let len = CONFIG.defaultCycle;

  const pad = (n) => String(n).padStart(2, "0");
  const toISO = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  const parseISO = (s) => { const p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
  const today0 = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmtDate = (d) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

  startInput.max = toISO(today0());

  function phaseFor(day) { return day <= 5 ? "menstrual" : day <= 11 ? "follicular" : "luteal"; }

  function compute(state) {
    const start = parseISO(state.start);
    const diff = Math.round((today0() - start) / 86400000);
    if (isNaN(diff) || diff < 0) return null;
    const L = state.len;
    const day = (diff % L) + 1;
    const phase = phaseFor(day);
    const daysToNext = CONFIG.phases[phase].endDay(L) - day + 1;
    return { day: day, len: L, phase: phase, wrapped: diff >= L, daysToNext: daysToNext, nextDate: addDays(today0(), daysToNext) };
  }

  function ringSVG(c) {
    const R = 88, C = 2 * Math.PI * R, gap = 4, L = c.len;
    const segs = [["menstrual", 1, 5], ["follicular", 6, 11], ["luteal", 12, L]];
    let out = '<g transform="rotate(-90 110 110)" fill="none" stroke-width="18">';
    segs.forEach(function (s) {
      const frac = (s[2] - s[1] + 1) / L;
      const dash = Math.max(2, frac * C - gap);
      const off = -((s[1] - 1) / L) * C;
      const active = s[0] === c.phase;
      out += '<circle cx="110" cy="110" r="' + R + '" style="stroke:' + CONFIG.phases[s[0]].color + '" ' +
             'stroke-opacity="' + (active ? 1 : 0.45) + '" stroke-dasharray="' + dash.toFixed(2) + " " + (C - dash).toFixed(2) + '" ' +
             'stroke-dashoffset="' + off.toFixed(2) + '"/>';
    });
    out += "</g>";
    const th = ((c.day - 0.5) / L) * 2 * Math.PI - Math.PI / 2;
    const mx = 110 + R * Math.cos(th), my = 110 + R * Math.sin(th);
    out += '<circle cx="' + mx.toFixed(2) + '" cy="' + my.toFixed(2) + '" r="11" fill="#fff" stroke="#2a1f33" stroke-width="3"/>';
    return out;
  }

  function render() {
    const state = store.get(KEY, null);
    const c = state && state.start ? compute(state) : null;

    const empty = $("#trackerEmpty"), result = $("#trackerResult");
    const dot = $("#tbDot"), text = $("#tbText");

    if (!c) {
      empty.hidden = false; result.hidden = true;
      dot.style.background = "var(--gold)";
      text.textContent = "Track your cycle";
      return;
    }
    const P = CONFIG.phases[c.phase];
    empty.hidden = true; result.hidden = false;

    dot.style.background = P.color;
    text.textContent = "Day " + c.day + " · " + P.name + " blend";

    $("#ring").innerHTML = ringSVG(c);
    $("#ring").setAttribute("aria-label", "Day " + c.day + " of " + c.len + ", " + P.name + " blend");
    $("#ringDay").textContent = "Day " + c.day;
    $("#ringPhase").textContent = P.name;
    $("#trDate").textContent = fmtDate(today0());
    $("#trHeadline").textContent = "Day " + c.day + " of " + c.len;

    const take = $("#trTake");
    take.textContent = "";
    take.append("Take your ");
    const b1 = document.createElement("strong"); b1.textContent = "Essential Blend"; take.append(b1);
    take.append(" and your ");
    const b2 = document.createElement("strong"); b2.textContent = P.name + " Blend"; take.append(b2);
    take.append(" today.");

    const plural = c.daysToNext === 1 ? "day" : "days";
    $("#trNext").textContent = c.phase === "luteal"
      ? "Your next period is expected in " + c.daysToNext + " " + plural + " (" + fmtDate(c.nextDate) + "). The Menstrual Blend begins then."
      : "The " + (c.phase === "menstrual" ? "Follicular" : "Luteal") + " Blend starts in " + c.daysToNext + " " + plural + " (" + fmtDate(c.nextDate) + ").";

    const strip = $("#strip");
    strip.innerHTML = "";
    for (let d = 1; d <= c.len; d++) {
      const s = document.createElement("span");
      s.style.setProperty("--c", CONFIG.phases[phaseFor(d)].color);
      if (d < c.day) s.className = "past";
      if (d === c.day) s.className = "today";
      strip.appendChild(s);
    }

    $("#trNote").textContent = c.wrapped
      ? "Your last date is more than one cycle ago, so we've assumed your cycle repeats. Update the date when your next period begins."
      : "";
  }

  function setOpen(open) {
    toolbar.dataset.state = open ? "open" : "collapsed";
    summaryBtn.setAttribute("aria-expanded", String(open));
    if (open) {
      const state = store.get(KEY, null);
      if (state && state.start) startInput.value = state.start;
      if (state && state.len) setLen(state.len);
      setTimeout(function () { startInput.focus({ preventScroll: true }); }, 50);
    }
  }
  function setLen(n) {
    len = Math.min(CONFIG.maxCycle, Math.max(CONFIG.minCycle, n));
    lenOut.textContent = String(len);
  }
  function showError(msg) { errEl.textContent = msg; errEl.hidden = !msg; startInput.setAttribute("aria-invalid", msg ? "true" : "false"); }

  summaryBtn.addEventListener("click", function () { setOpen(toolbar.dataset.state !== "open"); });
  $("#lenMinus").addEventListener("click", function () { setLen(len - 1); });
  $("#lenPlus").addEventListener("click", function () { setLen(len + 1); });
  $$("[data-open-tracker]").forEach(function (el) {
    el.addEventListener("click", function (e) {
      if (el.tagName === "A") e.preventDefault();
      setOpen(true);
    });
  });

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    const v = startInput.value;
    if (!v) return showError("Please choose the first day of your last period.");
    const diff = Math.round((today0() - parseISO(v)) / 86400000);
    if (diff < 0) return showError("That date is in the future.");
    if (diff > 365) return showError("That date is more than a year ago. Please choose a more recent one.");
    showError("");
    store.set(KEY, { start: v, len: len });
    render();
    setOpen(false);
    const card = $("#trackerCard");
    if (card && !reduceMotion) {
      const r = card.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) { /* leave the visitor where they are */ }
    }
  });

  $("#tbClear").addEventListener("click", function () {
    store.del(KEY);
    startInput.value = "";
    setLen(CONFIG.defaultCycle);
    showError("");
    render();
  });

  // restore
  const saved = store.get(KEY, null);
  if (saved && saved.len) setLen(saved.len);
  render();

  return { render: render };
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
  $("#trAdd").addEventListener("click", function () { add("kit"); });

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
