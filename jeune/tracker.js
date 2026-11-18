/* Jeune cycle tracker page.
   - month calendar coloured by blend phase
   - tap a day to see its phase, day number and blends
   - log period start dates; everything is stored only in this browser */

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ---------- storage ---------- */
const KEY = "jeune.cycle.v2";
const OLD_KEY = "jeune.cycle.v1";   // earlier preview stored one start date
const store = {
  get(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
  set(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  del(key) { try { localStorage.removeItem(key); } catch (e) { /* ignore */ } }
};

/* ---------- dates (local time, ISO yyyy-mm-dd strings) ---------- */
const pad = (n) => String(n).padStart(2, "0");
const toISO = (d) => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
const parse = (s) => { const p = s.split("-").map(Number); return new Date(p[0], p[1] - 1, p[2]); };
const dayDiff = (a, b) => Math.round((b - a) / 86400000);   // whole days, DST safe
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtLong  = (iso) => parse(iso).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const fmtShort = (d)   => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const fmtChip  = (iso) => parse(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const now = new Date();
const todayISO = toISO(new Date(now.getFullYear(), now.getMonth(), now.getDate()));

/* ---------- state ---------- */
let state = { starts: [], len: CONFIG.defaultCycle };
(function load() {
  const v2 = store.get(KEY);
  if (v2 && Array.isArray(v2.starts)) {
    state.starts = v2.starts.filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s));
    if (v2.len) state.len = clampLen(v2.len);
  } else {
    const v1 = store.get(OLD_KEY);
    if (v1 && v1.start) { state.starts = [v1.start]; if (v1.len) state.len = clampLen(v1.len); }
  }
  state.starts = Array.from(new Set(state.starts)).sort();
})();
function clampLen(n) { return Math.min(CONFIG.maxCycle, Math.max(CONFIG.minCycle, Number(n) || CONFIG.defaultCycle)); }
function save() { store.set(KEY, state); }

let selected = todayISO;
let view = { y: now.getFullYear(), m: now.getMonth() };

/* ---------- the cycle maths ---------- */
function phaseOfDay(day) { return day <= 5 ? "menstrual" : day <= 11 ? "follicular" : "luteal"; }

/* Returns where a date falls in the cycle, or null if no period start is logged.
   - after a logged start: counts days from the latest start on or before the date
   - past one cycle length with no newer start: assumes the cycle repeats (estimate)
   - before the first logged start: projects backwards (estimate) */
function cycleAt(iso) {
  if (!state.starts.length) return null;
  const L = state.len, d = parse(iso);
  let s = null, next = null;
  for (const x of state.starts) { if (x <= iso) s = x; else { next = x; break; } }
  let day, len = L, estimated = false;
  if (s) {
    const diff = dayDiff(parse(s), d);
    if (diff < L) {
      day = diff + 1;
      if (next) { const gap = dayDiff(parse(s), parse(next)); if (gap < L) len = gap; }
    } else { day = (diff % L) + 1; estimated = true; }
  } else {
    const diff = dayDiff(parse(state.starts[0]), d);       // negative
    day = (((diff % L) + L) % L) + 1; estimated = true;
  }
  return { day: day, len: len, phase: phaseOfDay(day), estimated: estimated, isStart: state.starts.indexOf(iso) !== -1, anchor: s || state.starts[0] };
}

/* ---------- ring ---------- */
function ringSVG(c) {
  const R = 88, C = 2 * Math.PI * R, gap = 4, L = c.len;
  const segs = [["menstrual", 1, Math.min(5, L)], ["follicular", 6, Math.min(11, L)], ["luteal", 12, L]].filter((s) => s[2] >= s[1]);
  let out = '<g transform="rotate(-90 110 110)" fill="none" stroke-width="18">';
  segs.forEach(function (s) {
    const frac = (s[2] - s[1] + 1) / L;
    const dash = Math.max(2, frac * C - gap);
    const off = -((s[1] - 1) / L) * C;
    out += '<circle cx="110" cy="110" r="' + R + '" style="stroke:' + CONFIG.phases[s[0]].color + '" stroke-opacity="' + (s[0] === c.phase ? 1 : 0.45) +
           '" stroke-dasharray="' + dash.toFixed(2) + " " + (C - dash).toFixed(2) + '" stroke-dashoffset="' + off.toFixed(2) + '"/>';
  });
  out += "</g>";
  const th = ((c.day - 0.5) / L) * 2 * Math.PI - Math.PI / 2;
  out += '<circle cx="' + (110 + R * Math.cos(th)).toFixed(2) + '" cy="' + (110 + R * Math.sin(th)).toFixed(2) + '" r="11" fill="#fff" stroke="#2a1f33" stroke-width="3"/>';
  return out;
}

/* ---------- calendar ---------- */
function renderCalendar() {
  const grid = $("#calGrid");
  grid.innerHTML = "";
  const first = new Date(view.y, view.m, 1);
  $("#calTitle").textContent = first.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  $("#calEmpty").hidden = state.starts.length > 0;

  for (let i = 0; i < first.getDay(); i++) {
    const b = document.createElement("span");
    b.className = "day blank"; b.setAttribute("aria-hidden", "true");
    grid.appendChild(b);
  }
  const count = new Date(view.y, view.m + 1, 0).getDate();
  for (let n = 1; n <= count; n++) {
    const iso = view.y + "-" + pad(view.m + 1) + "-" + pad(n);
    const c = cycleAt(iso);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.date = iso;
    btn.className = "day" + (c ? "" : " nodata") + (iso === todayISO ? " today" : "") + (iso === selected ? " selected" : "") + (c && c.isStart ? " start" : "");
    if (c) btn.style.setProperty("--c", CONFIG.phases[c.phase].color);
    btn.setAttribute("aria-pressed", String(iso === selected));
    btn.setAttribute("aria-label", fmtLong(iso) + ". " + (c ? CONFIG.phases[c.phase].name + " phase, day " + c.day + (c.isStart ? ", period start" : "") + (c.estimated ? ", estimated" : "") : "No cycle logged"));
    const num = document.createElement("span"); num.className = "num"; num.textContent = String(n);
    btn.appendChild(num);
    if (c) { const bar = document.createElement("span"); bar.className = "bar"; btn.appendChild(bar); }
    grid.appendChild(btn);
  }
}

/* ---------- selected-day detail ---------- */
function renderDetail() {
  const c = cycleAt(selected);
  const body = $("#dBody"), empty = $("#dEmpty");
  const mark = $("#dMark"), markNote = $("#dMarkNote");
  const isFuture = selected > todayISO;
  const isLogged = state.starts.indexOf(selected) !== -1;

  if (!c) {
    body.hidden = true; empty.hidden = false;
    $("#dEmptyDate").textContent = fmtLong(selected);
  } else {
    body.hidden = false; empty.hidden = true;
    const P = CONFIG.phases[c.phase];
    const tense = selected < todayISO ? "You were in the " : selected === todayISO ? "You are in the " : "You'll be in the ";

    $("#ring").innerHTML = ringSVG(c);
    $("#ring").setAttribute("aria-label", "Day " + c.day + " of " + c.len + ", " + P.name + " phase");
    $("#ringDay").textContent = "Day " + c.day;
    $("#ringPhase").textContent = P.name;
    $("#dDate").textContent = fmtLong(selected);
    $("#dDot").style.background = P.color;
    $("#dPhaseText").textContent = tense + P.name + " phase";
    $("#dDayOf").textContent = "Day " + c.day + " of " + c.len;

    const take = $("#dTake");
    take.textContent = "";
    take.append("Blends: ");
    const a = document.createElement("strong"); a.textContent = "Essential"; take.append(a);
    take.append(" + ");
    const b = document.createElement("strong"); b.textContent = P.name; take.append(b);

    $("#dTagline").textContent = P.tagline;
    $("#dBlurb").textContent = P.blurb;

    const toNext = P.endDay(c.len) - c.day + 1;
    const nextDate = addDays(parse(selected), toNext);
    $("#dNext").textContent = c.phase === "luteal"
      ? "A new cycle begins around " + fmtShort(nextDate) + "."
      : "The " + (c.phase === "menstrual" ? "Follicular" : "Luteal") + " Blend begins on " + fmtShort(nextDate) + ".";

    $("#dNote").textContent = c.isStart
      ? "You logged this day as the first day of a period."
      : c.estimated
        ? "Estimated from your logged period dates and a " + state.len + "-day cycle."
        : "Counted from the period start you logged on " + fmtChip(c.anchor) + ".";
  }

  // mark / remove a period start
  if (isLogged) {
    mark.hidden = false; mark.textContent = "Remove this period start"; mark.dataset.mode = "remove";
    markNote.hidden = true;
  } else if (isFuture) {
    mark.hidden = true; markNote.hidden = false; markNote.textContent = "You can mark a period start once the day arrives.";
  } else {
    mark.hidden = false; mark.textContent = "Mark as first day of period"; mark.dataset.mode = "add";
    markNote.hidden = true;
  }
}

/* ---------- setup panel ---------- */
function renderSetup() {
  $("#lenOut").textContent = String(state.len);
  const chips = $("#chips");
  chips.innerHTML = "";
  state.starts.slice().reverse().forEach(function (iso) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button"; btn.dataset.date = iso;
    btn.setAttribute("aria-label", "Remove period start " + fmtChip(iso));
    btn.append(fmtChip(iso));
    const x = document.createElement("span"); x.textContent = "×"; x.setAttribute("aria-hidden", "true");
    btn.appendChild(x);
    li.appendChild(btn); chips.appendChild(li);
  });
  $("#chipsEmpty").hidden = state.starts.length > 0;
  $("#clearAll").hidden = state.starts.length === 0;
}

function renderAll() { renderCalendar(); renderDetail(); renderSetup(); }

/* ---------- actions ---------- */
function addStart(iso) {
  if (state.starts.indexOf(iso) === -1) { state.starts.push(iso); state.starts.sort(); save(); }
}
function removeStart(iso) {
  state.starts = state.starts.filter((s) => s !== iso); save();
}
function showView(iso) { const d = parse(iso); view = { y: d.getFullYear(), m: d.getMonth() }; }

$("#calPrev").addEventListener("click", function () { view.m -= 1; if (view.m < 0) { view.m = 11; view.y -= 1; } renderCalendar(); });
$("#calNext").addEventListener("click", function () { view.m += 1; if (view.m > 11) { view.m = 0; view.y += 1; } renderCalendar(); });
$("#calToday").addEventListener("click", function () { selected = todayISO; showView(todayISO); renderAll(); });

$("#calGrid").addEventListener("click", function (e) {
  const b = e.target.closest("button.day");
  if (!b) return;
  selected = b.dataset.date;
  renderAll();
  const again = $('#calGrid button[data-date="' + selected + '"]');
  if (again) again.focus({ preventScroll: true });
});

$("#dMark").addEventListener("click", function () {
  if ($("#dMark").dataset.mode === "remove") removeStart(selected); else addStart(selected);
  renderAll();
});

$("#lenMinus").addEventListener("click", function () { state.len = clampLen(state.len - 1); save(); renderAll(); });
$("#lenPlus").addEventListener("click", function () { state.len = clampLen(state.len + 1); save(); renderAll(); });

const startInput = $("#startInput");
startInput.max = todayISO;
$("#setupForm").addEventListener("submit", function (e) {
  e.preventDefault();
  const err = $("#setupError");
  const v = startInput.value;
  let msg = "";
  if (!v) msg = "Please choose a date.";
  else if (v > todayISO) msg = "That date is in the future.";
  else if (dayDiff(parse(v), parse(todayISO)) > 730) msg = "That date is more than two years ago.";
  err.textContent = msg; err.hidden = !msg;
  startInput.setAttribute("aria-invalid", msg ? "true" : "false");
  if (msg) return;
  addStart(v);
  startInput.value = "";
  selected = v; showView(v);
  renderAll();
});

$("#chips").addEventListener("click", function (e) {
  const b = e.target.closest("button[data-date]");
  if (!b) return;
  removeStart(b.dataset.date);
  renderAll();
});
$("#clearAll").addEventListener("click", function () {
  state.starts = []; save(); renderAll();
});

/* ---------- start ---------- */
$$("[data-brand]").forEach((el) => { el.textContent = CONFIG.brand; });
document.title = "Cycle tracker | " + CONFIG.brand;
renderAll();
