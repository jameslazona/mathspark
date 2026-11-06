(() => {
"use strict";
const TEMPLATE_BODY = document.getElementById("app-root").outerHTML;
const STYLE_TEXT = document.getElementById("app-style")?.textContent || "";

/* ===================== helpers ===================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const store = {
  get(k, d) { try { const v = localStorage.getItem("mathspark_" + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("mathspark_" + k, JSON.stringify(v)); } catch {} }
};
const PALETTE = ["#ef4444", "#3b82f6", "#eab308", "#22c55e", "#a855f7", "#f97316", "#ec4899", "#06b6d4"];
const colorFor = s => { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; };

const THEMES = {
  jungle: { name: "Jungle", vi: "Rừng xanh", icon: "🐸", deco: ["🌿", "🐸", "🦋", "🌼", "🍃", "🐞", "🌴"], bg: "linear-gradient(160deg,#dff7c8,#fff4cf)" },
  ocean: { name: "Ocean", vi: "Đại dương", icon: "🐠", deco: ["🐟", "🐠", "🫧", "🐚", "🐙", "🦀", "🌊"], bg: "linear-gradient(160deg,#cdefff,#effcff)" },
  space: { name: "Space", vi: "Vũ trụ", icon: "🚀", deco: ["⭐", "🚀", "🪐", "🌙", "✨", "☄️", "🛸"], bg: "linear-gradient(160deg,#1b1748,#3c2a80)", dark: true },
  candy: { name: "Candy", vi: "Kẹo ngọt", icon: "🍭", deco: ["🍭", "🧁", "🍬", "🌈", "🍩", "🍓", "🎀"], bg: "linear-gradient(160deg,#ffe0ef,#fff2d9)" },
};

const S = {
  vi: store.get("vi", true), sound: store.get("sound", true), theme: store.get("theme", "jungle"),
  view: "library", activities: [], localActs: [], current: null, preview: false, tab: "learn",
  game: null, pr: null, quiz: null,
  db: null, user: null, sample: null, downloads: null, canEdit: null, imgMax: 0,
  libState: "loading", files: [], build: null,
  lib: window.__LIB__ || null, formUrl: "", student: store.get("student", null), pendingKey: null, direct: false, sent: {},
  timer: null, raf: null, embed: window.__EMBED__ || null,
};
if (!THEMES[S.theme]) S.theme = "jungle";

function bi(en) { return esc(en); }
function biL(en, vi, inline) { if (!vi) return esc(en); return inline ? `${esc(en)} <span class="vi-inline">· ${esc(vi)}</span>` : `${esc(en)}<span class="vi">${esc(vi)}</span>`; }
function biV(en, vi) { return vi ? `${esc(en)}<span class="vi">${esc(vi)}</span>` : esc(en); }
function toast(msg, ms = 2600) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), ms);
}
function modal(html, onMount) {
  const m = $("#modal"); m.innerHTML = `<div class="box">${html}</div>`; m.classList.remove("hidden");
  const close = () => { m.classList.add("hidden"); m.innerHTML = ""; };
  m.onclick = e => { if (e.target === m) close(); };
  onMount && onMount(m, close);
  return close;
}
function askConfirm(title, body, okLabel = "OK") {
  return new Promise(res => {
    modal(`<h3>${esc(title)}</h3><p class="muted">${esc(body)}</p><div class="row" style="justify-content:flex-end;margin-top:14px"><button class="btn btn-ghost btn-sm" data-r="0">Cancel</button><button class="btn btn-primary btn-sm" data-r="1">${esc(okLabel)}</button></div>`,
      (m, close) => $$("[data-r]", m).forEach(b => b.onclick = () => { close(); res(b.dataset.r === "1"); }));
  });
}

/* ===================== theme ===================== */
function applyTheme() {
  document.body.dataset.theme = S.theme;
  const d = $("#deco"), t = THEMES[S.theme];
  d.innerHTML = Array.from({ length: 16 }, (_, i) => {
    const x = (i * 61) % 100, y = (i * 37 + 11) % 100, dur = 6 + (i % 5) * 2, delay = -(i * 1.3), sz = 24 + (i % 4) * 10;
    return `<span style="left:${x}%;top:${y}%;font-size:${sz}px;animation-duration:${dur}s;animation-delay:${delay}s">${t.deco[i % t.deco.length]}</span>`;
  }).join("");
}
function themePicker() {
  modal(`<h3>🎨 ${bi("Pick a theme", "Chọn chủ đề", true)}</h3><div class="themes">${Object.entries(THEMES).map(([k, t]) =>
    `<button class="themebtn ${k === S.theme ? "on" : ""}" data-th="${k}" style="background:${t.bg};color:${t.dark ? "#fff" : "#1f2937"}"><span class="e">${t.icon}</span>${bi(t.name, t.vi)}</button>`).join("")}</div>`,
    (m, close) => $$("[data-th]", m).forEach(b => b.onclick = () => { S.theme = b.dataset.th; store.set("theme", S.theme); applyTheme(); tone("win"); close(); render(); }));
}

/* ===================== sound + speech ===================== */
let AC = null;
function tone(kind) {
  if (!S.sound) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const seqs = {
      good: [[660, 0], [880, .09], [1175, .18]], bad: [[260, 0], [200, .12]], win: [[523, 0], [659, .1], [784, .2], [1046, .32]],
      pop: [[900, 0], [1400, .03]], flip: [[520, 0]], tap: [[740, 0]], whoosh: [[400, 0], [700, .05], [1000, .1]],
      unlock: [[784, 0], [988, .08], [1319, .16], [1568, .26]], charge: Array.from({ length: 14 }, (_, i) => [300 + i * 45, i * .12]),
      evolve: [[523, 0], [659, .1], [784, .2], [1046, .3], [784, .45], [1046, .55], [1319, .7], [1568, .85]]
    };
    (seqs[kind] || seqs.tap).forEach(([f, t]) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = kind === "bad" ? "sawtooth" : kind === "pop" ? "square" : "triangle"; o.frequency.value = f;
      const v = kind === "bad" ? .08 : .16;
      g.gain.setValueAtTime(.0001, AC.currentTime + t);
      g.gain.exponentialRampToValueAtTime(v, AC.currentTime + t + .015);
      g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime + t + (kind === "pop" ? .08 : kind === "evolve" ? .3 : .17));
      o.connect(g).connect(AC.destination); o.start(AC.currentTime + t); o.stop(AC.currentTime + t + (kind === "evolve" ? .34 : .22));
    });
  } catch {}
}
const synth = window.speechSynthesis;
let voices = [];
const loadVoices = () => { try { voices = synth ? synth.getVoices() : []; } catch { voices = []; } };
loadVoices(); try { synth && synth.addEventListener("voiceschanged", loadVoices); } catch {}
const hasVi = () => voices.some(v => /^vi/i.test(v.lang));
// Female voice with a neutral English accent: clear US/UK standard voices first, natural (neural) voices preferred.
const FEMALE = /female|woman|aria|jenny|ava|emma|michelle|sonia|libby|hazel|zira|susan|samantha|allison|karen|moira|tessa|serena|kate|victoria|joanna|salli|kendra|kimberly|ivy|amy|nova|shimmer|hoai|linh|my\b/i;
// Female American (en-US) voices with a neutral, General American accent. Natural (neural) voices first.
const VOICE_PREFS = [/jenny.*natural/i, /aria.*natural/i, /ava.*natural/i, /michelle.*natural/i, /google us english/i, /samantha/i, /\bava\b/i, /allison/i, /susan/i, /microsoft (jenny|aria|ava|michelle)/i, /zira/i, /joanna|salli|kendra|kimberly|ivy/i];
let _ev = null;
function englishVoice() {
  if (_ev && voices.includes(_ev)) return _ev;
  const us = voices.filter(v => /^en[-_]US/i.test(v.lang));
  for (const re of VOICE_PREFS) { const v = us.find(v => re.test(v.name)); if (v) return (_ev = v); }
  return (_ev = us.find(v => FEMALE.test(v.name)) || us[0] || voices.find(v => /^en/i.test(v.lang)) || null);
}
function clean(t) { return String(t).replace(/\p{Extended_Pictographic}|️|‍/gu, " ").replace(/\s*\|\s*/g, ", ").replace(/\s*\+\s*/g, " plus ").replace(/\s*=\s*/g, " equals ").replace(/×/g, " times ").replace(/÷/g, " divided by ").replace(/\s+/g, " ").trim(); }
function speak(text, lang = "en", btn) {
  if (!synth) { toast("Read aloud isn't available on this device."); return; }
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(lang === "vi" ? String(text).replace(/\p{Extended_Pictographic}|️/gu, " ") : clean(text));
    const v = lang === "vi" ? (voices.find(v => /^vi/i.test(v.lang) && FEMALE.test(v.name)) || voices.find(v => /^vi/i.test(v.lang))) : englishVoice();
    if (v) u.voice = v; u.lang = lang === "vi" ? (v ? v.lang : "vi-VN") : "en-US"; u.rate = .88; u.pitch = 1;
    if (btn) { btn.classList.add("talking"); u.onend = u.onerror = () => btn.classList.remove("talking"); }
    synth.speak(u);
  } catch {}
}
function sayBtn(en, vi, withVi) {
  if (!en) return "";
  return `<button class="say" data-say="${esc(en)}" data-lang="en" title="Read aloud" aria-label="Read aloud">🔈</button>${withVi && vi && hasVi() ? `<button class="say vi-say" data-say="${esc(vi)}" data-lang="vi" title="Đọc tiếng Việt">VI</button>` : ""}`;
}
document.addEventListener("click", e => { const b = e.target.closest("[data-say]"); if (b) { e.stopPropagation(); speak(b.dataset.say, b.dataset.lang, b); } }, true);

/* ===================== fx ===================== */
function confetti() {
  const c = $("#confetti"), x = c.getContext("2d");
  c.width = innerWidth; c.height = innerHeight;
  const P = Array.from({ length: 160 }, () => ({ x: Math.random() * c.width, y: -20 - Math.random() * c.height * .5, vx: (Math.random() - .5) * 3, vy: 2 + Math.random() * 4, r: 5 + Math.random() * 6, c: pick(PALETTE), a: Math.random() * 6 }));
  let f = 0;
  (function tick() {
    x.clearRect(0, 0, c.width, c.height);
    P.forEach(p => { p.x += p.vx; p.y += p.vy; p.a += .12; x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * .6); x.restore(); });
    if (++f < 180) requestAnimationFrame(tick); else x.clearRect(0, 0, c.width, c.height);
  })();
}
function flyStar(fromEl) {
  const target = $("#starCount"); if (!fromEl || !target) return;
  const a = fromEl.getBoundingClientRect(), b = target.getBoundingClientRect();
  const s = document.createElement("div"); s.className = "flystar"; s.textContent = "⭐";
  s.style.left = (a.left + a.width / 2 - 17) + "px"; s.style.top = (a.top + a.height / 2 - 17) + "px";
  document.body.appendChild(s);
  requestAnimationFrame(() => requestAnimationFrame(() => { s.style.transform = `translate(${b.left + 10 - a.left - a.width / 2}px,${b.top - a.top - a.height / 2}px) scale(.6) rotate(360deg)`; }));
  setTimeout(() => { s.remove(); target.classList.remove("bump"); void target.offsetWidth; target.classList.add("bump"); }, 820);
}
const starsFor = pct => pct >= 90 ? 3 : pct >= 65 ? 2 : pct >= 35 ? 1 : 0;
const ARTIFACT_URL = "https://claude.ai/artifact/5iBXmGi3pSTtUQqBX7rwUW";
const isTeacher = () => S.canEdit === true;
const linkKey = a => String(a.id || "").replace(/[^A-Za-z0-9-]/g, "-").slice(0, 80);
const SITE_URL = "https://jameslazona.github.io/mathspark/";
const webFolder = a => a.folder || slugify(a.data?.title);
const actLink = a => `${SITE_URL}${webFolder(a)}/`;
const slugify = t => String(t || "activity").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "activity";
function parseForm(url) {
  try {
    const u = new URL(String(url).trim());
    if (!/(^|\.)docs\.google\.com$/.test(u.hostname) || !/\/forms\//.test(u.pathname)) return null;
    const map = {};
    for (const [k, v] of u.searchParams) if (/^entry\.\d+$/.test(k) && ["NAME", "CLASS", "ACTIVITY", "TASK", "SCORE", "STARS"].includes(v.trim().toUpperCase())) map[v.trim().toUpperCase()] = k;
    if (!map.NAME || !map.SCORE) return null;
    return { base: u.origin + u.pathname.replace(/\/(viewform|formResponse)$/, ""), map };
  } catch { return null; }
}
function resultUrl(task, score, stars) {
  const f = parseForm(S.formUrl); if (!f || !S.current) return null;
  const st = S.student || { name: "Teacher test", cls: "-" };
  const vals = { NAME: st.name, CLASS: st.cls, ACTIVITY: S.current.data.title, TASK: task, SCORE: score, STARS: String(stars) };
  const q = new URLSearchParams();
  for (const [k, e] of Object.entries(f.map)) q.set(e, vals[k] ?? "");
  q.set("submit", "Submit");
  return `${f.base}/formResponse?${q.toString()}`;
}
/* ---------- automatic result tracking (Google Sheet via Apps Script) ---------- */
const TRACK_URL = () => { const u = (window.__CONFIG__ && window.__CONFIG__.trackUrl) || ""; return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u.trim()) ? u.trim() : ""; };
const device = () => { const u = navigator.userAgent; return /iPad/.test(u) ? "iPad" : /iPhone/.test(u) ? "iPhone" : /Android/.test(u) ? "Android" : /Windows/.test(u) ? "Windows" : /Mac/.test(u) ? "Mac" : /CrOS/.test(u) ? "Chromebook" : "Other"; };
function postEvents(list) {
  const url = TRACK_URL(); if (!url || !list.length) return;
  const body = JSON.stringify(list);
  fetch(url, { method: "POST", mode: "no-cors", keepalive: body.length < 60000, headers: { "Content-Type": "text/plain;charset=utf-8" }, body })
    .catch(() => { const q = store.get("queue", []); store.set("queue", q.concat(list).slice(-100)); });
}
function track(type, extra = {}) {
  if (!TRACK_URL() || !S.current || !S.student || isTeacher()) return;
  const ev = { type, name: S.student.name, cls: S.student.cls, code: S.current.id, title: S.current.data.title, dev: device(), t: Date.now(), ...extra };
  const q = store.get("queue", []); if (q.length) store.set("queue", []);
  postEvents(q.concat([ev]));
}
function sendBox(task, score, stars) {
  if (TRACK_URL() && S.student) return `<div class="sendbox"><div class="fb good" style="display:inline-block">📨 Your teacher can see this result.</div><div class="small muted" style="margin-top:6px;font-weight:700">${esc(S.student.name)} · ${esc(S.student.cls)} · ${esc(task)} · ${esc(score)}</div></div>`;
  if (!S.formUrl) return "";
  const url = resultUrl(task, score, stars); if (!url) return "";
  const key = `${S.current.id}|${task}|${score}|${Date.now() >> 16}`;
  const who = S.student ? `${esc(S.student.name)} · ${esc(S.student.cls)}` : "Teacher test";
  return `<div class="sendbox"><a class="btn btn-accent btn-lg sendbtn" href="${esc(url)}" target="_blank" rel="noopener" data-sent="${esc(key)}">📨 Send my result to my teacher</a>
    <div class="small muted" style="margin-top:6px;font-weight:700">${who} · ${esc(task)} · ${esc(score)}</div></div>`;
}
document.addEventListener("click", e => { const a = e.target.closest(".sendbtn"); if (!a) return; setTimeout(() => { a.outerHTML = `<div class="fb good" style="display:inline-block">✅ Sent to your teacher! A page opened to confirm it.</div>`; tone("win"); }, 300); });
function updateWho() { const b = $("#whoBtn"); if (!b) return; b.classList.toggle("hidden", !S.student || isTeacher()); if (S.student) b.textContent = `👤 ${S.student.name} · ${S.student.cls}`; }
function askName(force) {
  if (isTeacher() || (S.student && !force)) return;
  const st = S.student || { name: "", cls: "" };
  modal(`<div style="text-align:center"><div class="mascot" style="margin:0 auto;width:90px">${mascotSVG()}</div><h3>Hi! What's your name?</h3></div>
    <label class="f">Your name</label><input type="text" id="stName" maxlength="40" value="${esc(st.name)}" placeholder="e.g. Minh Anh" autocomplete="off">
    <label class="f">Your class</label><input type="text" id="stClass" maxlength="20" value="${esc(st.cls)}" placeholder="e.g. 1A" autocomplete="off">
    <div id="stErr" class="small" style="color:var(--bad);font-weight:800;min-height:20px;margin-top:6px"></div>
    <button class="btn btn-primary btn-lg" id="stGo" style="width:100%;margin-top:6px">Let's play! ▶</button>`, (m, close) => {
    m.onclick = null;
    const go = () => { const name = $("#stName", m).value.trim(), cls = $("#stClass", m).value.trim();
      if (!name || !cls) { $("#stErr", m).textContent = !name ? "Please write your name." : "Please write your class."; return; }
      S.student = { name, cls }; store.set("student", S.student); updateWho(); updateStars(); tone("win"); close();
      if (S.view === "journey") { Object.assign(J, { loaded: false, ok: false, board: [], me: [] }); render(); return; }
      setGuide("happy", `Hi ${name}! Let's play math!`); track("open", { task: "Started" }); };
    $("#stGo", m).onclick = go; $$("input", m).forEach(i => i.onkeydown = e => { if (e.key === "Enter") go(); });
    setTimeout(() => $("#stName", m).focus(), 50);
  });
}
const starsHTML = n => `<div class="stars">${[0, 1, 2].map(i => `<span class="${i < n ? "" : "off"}">⭐</span>`).join("")}</div>`;
const PRAISE = [["Keep practising!", "Cố gắng luyện tập thêm nhé!"], ["Good try!", "Em cố gắng tốt lắm!"], ["Great job!", "Em làm tốt lắm!"], ["Amazing! You're a math star!", "Tuyệt vời! Em là ngôi sao toán học!"]];
const YES = [["Great job!", "Giỏi quá!"], ["You got it!", "Em làm đúng rồi!"], ["Super!", "Tuyệt vời!"], ["Wow, well done!", "Wow, giỏi lắm!"], ["Yes! Correct!", "Đúng rồi!"]];
const NO = [["Oops! Try again.", "Ồ! Thử lại nhé."], ["Almost! Look again.", "Gần đúng rồi! Nhìn lại nhé."], ["Not yet. You can do it!", "Chưa đúng. Em làm được mà!"]];

/* ===================== progress / stars ===================== */
const PROG = () => window.__CONFIG__ && S.student && !isTeacher() ? "prog:" + `${S.student.name}|${S.student.cls}`.toLowerCase() : "prog";
function prog(id) { const all = store.get(PROG(), {}); return all[id] || { learn: 0, practice: 0, quiz: 0, games: {} }; }
function setProg(id, fn) { const all = store.get(PROG(), {}); const p = all[id] || { learn: 0, practice: 0, quiz: 0, games: {} }; fn(p); all[id] = p; store.set(PROG(), all); updateStars(); }
function actStars(p) { return (p.learn ? 1 : 0) + (p.practice || 0) + (p.quiz || 0) + Object.values(p.games || {}).reduce((a, b) => a + b, 0); }
function updateStars() { const all = store.get(PROG(), {}); $("#starCount b").textContent = Object.values(all).reduce((a, p) => a + actStars(p), 0); }
function award(kind, stars, game) {
  if (!S.current) return;
  setProg(S.current.id, p => { if (game) { p.games = p.games || {}; p.games[game] = Math.max(p.games[game] || 0, stars); } else p[kind] = Math.max(p[kind] || 0, stars); });
}

/* ===================== mascot ===================== */
function mascotSVG() {
  return `<svg viewBox="0 0 100 112" aria-hidden="true">
    <path d="M50 30 L50 20" stroke="var(--primary-d)" stroke-width="3" stroke-linecap="round"/>
    <path class="spark" d="M50 3l3.6 7.6 8.3.9-6.2 5.6 1.8 8.2L50 21.1l-7.5 4.2 1.8-8.2-6.2-5.6 8.3-.9z" fill="var(--accent)" stroke="var(--accent-d)" stroke-width="1.5"/>
    <ellipse cx="34" cy="106" rx="11" ry="5" fill="var(--primary-d)"/><ellipse cx="66" cy="106" rx="11" ry="5" fill="var(--primary-d)"/>
    <path d="M14 72 Q2 64 6 54" stroke="var(--primary)" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M86 72 Q98 64 94 54" stroke="var(--primary)" stroke-width="8" stroke-linecap="round" fill="none"/>
    <ellipse cx="50" cy="68" rx="38" ry="38" fill="var(--primary)"/>
    <ellipse cx="50" cy="80" rx="24" ry="20" fill="#fff" opacity=".28"/>
    <ellipse cx="36" cy="60" rx="9" ry="11" fill="#fff"/><ellipse cx="64" cy="60" rx="9" ry="11" fill="#fff"/>
    <circle cx="38" cy="62" r="5" fill="#1f2937"/><circle cx="66" cy="62" r="5" fill="#1f2937"/>
    <circle cx="40" cy="59.5" r="1.8" fill="#fff"/><circle cx="68" cy="59.5" r="1.8" fill="#fff"/>
    <g class="lids"><ellipse cx="36" cy="60" rx="10" ry="12" fill="var(--primary)"/><ellipse cx="64" cy="60" rx="10" ry="12" fill="var(--primary)"/></g>
    <circle cx="24" cy="76" r="6" fill="#ff8fb1" opacity=".7"/><circle cx="76" cy="76" r="6" fill="#ff8fb1" opacity=".7"/>
    <path class="m-smile" d="M39 78 Q50 89 61 78" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/>
    <path class="m-big" d="M36 76 Q50 99 64 76 Z" fill="#1f2937"/>
    <path class="m-sad" d="M40 88 Q50 79 60 88" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/>
    <ellipse class="m-o" cx="50" cy="84" rx="5" ry="6" fill="#1f2937"/>
  </svg>`;
}
function guideHTML(en, vi) { return `<div class="guide"><div class="mascot" id="mascot">${mascotSVG()}</div><div class="bubble" id="bubble">${S.view === "player" && S.tab === "learn" ? biL(en, vi) : bi(en, vi)}</div></div>`; }
function setGuide(state, en, vi) {
  const m = $("#mascot"), b = $("#bubble");
  if (m) { m.className = "mascot"; void m.offsetWidth; if (state) m.classList.add(state); clearTimeout(setGuide._t); setGuide._t = setTimeout(() => m && (m.className = "mascot"), 1600); }
  if (b && en) { b.innerHTML = S.view === "player" && S.tab === "learn" ? biL(en, vi) : bi(en, vi); b.style.animation = "none"; void b.offsetWidth; b.style.animation = ""; }
}

/* ===================== answer checking ===================== */
function numVal(tok) {
  tok = String(tok).trim().replace(/[−–]/g, "-");
  let m;
  if ((m = tok.match(/^(-?\d+)\s+(\d+)\s*\/\s*(\d+)$/))) { const w = +m[1]; const f = +m[2] / +m[3]; return w < 0 ? w - f : w + f; }
  if ((m = tok.match(/^(-?\d+)\s*\/\s*(\d+)$/))) return +m[2] ? +m[1] / +m[2] : null;
  if (/^-?\d{1,3}([, ]\d{3})+(\.\d+)?$/.test(tok)) return parseFloat(tok.replace(/[, ]/g, ""));
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(tok)) return parseFloat(tok.replace(/\./g, "").replace(",", "."));
  if (/^-?\d+,\d+$/.test(tok)) return parseFloat(tok.replace(",", "."));
  if (/^-?\d*\.?\d+$/.test(tok)) return parseFloat(tok);
  return null;
}
const NUMRE = /^\s*(-?\d+\s+\d+\s*\/\s*\d+|-?\d+\s*\/\s*\d+|-?\d{1,3}(?:,\d{3})+(?:\.\d+)?|-?\d+(?:[.,]\d+)?|-?\.\d+)\s*(.*)$/;
function norm(s) { return String(s ?? "").normalize("NFC").toLowerCase().replace(/[×x✕]/g, "×").replace(/\s+/g, " ").replace(/[.!?;'"]+$/g, "").trim(); }
function splitNum(s) { const m = String(s).match(NUMRE); if (!m) return null; const v = numVal(m[1]); return v == null ? null : { v, rest: norm(m[2]) }; }
function isCorrect(input, answers) {
  const a = norm(input); if (!a) return false;
  for (const ans of answers || []) {
    const b = norm(ans);
    if (a === b || a.replace(/\s/g, "") === b.replace(/\s/g, "")) return true;
    const ni = splitNum(input), na = splitNum(ans);
    if (ni && na && Math.abs(ni.v - na.v) < 1e-9 && (ni.rest === "" || ni.rest === na.rest || na.rest === "")) return true;
  }
  return false;
}
const isNumericAnswer = ans => /^[\d\s.,/\-−]+$/.test(String(ans || "").trim());

/* ===================== visuals ===================== */
const int = (v, lo, hi) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : null; };
const numOrNull = (v, lo, hi) => v === null || v === "?" || v === undefined ? null : (Number.isFinite(Number(v)) ? Math.min(hi, Math.max(lo, Number(v))) : null);
const SHAPES = ["circle", "square", "triangle", "rectangle", "pentagon", "hexagon", "oval", "star"];
function sanitizeVisual(v) {
  if (!v || typeof v !== "object") return null;
  const em = e => { const s = String(e || "").trim(); return s && [...s].length <= 4 ? s : "🔵"; };
  switch (v.type) {
    case "groups": { const g = (Array.isArray(v.groups) ? v.groups : []).slice(0, 3).map(n => int(n, 0, 12) ?? 0); const ems = Array.isArray(v.emojis) ? v.emojis.slice(0, 3).map(em) : null;
      return g.length && g.some(n => n > 0) ? { type: "groups", emoji: em(v.emoji || ems?.[0]), emojis: ems, groups: g, style: v.style === "circles" ? "circles" : "" } : null; }
    case "partwhole": { const p = Array.isArray(v.parts) ? v.parts.slice(0, 3) : []; if (p.length < 2) return null; return { type: "partwhole", whole: numOrNull(v.whole, 0, 100000), parts: p.map(x => numOrNull(x, 0, 100000)) }; }
    case "tenframe": { const c = int(v.count, 0, 20); return c == null ? null : { type: "tenframe", count: c }; }
    case "numberline": { const mn = Number(v.min), mx = Number(v.max); if (!Number.isFinite(mn) || !Number.isFinite(mx) || mx <= mn || mx - mn > 1000) return null;
      return { type: "numberline", min: mn, max: mx, step: Number(v.step) > 0 ? Number(v.step) : (mx - mn <= 20 ? 1 : Math.ceil((mx - mn) / 10)), marks: (v.marks || []).map(Number).filter(n => n >= mn && n <= mx).slice(0, 6), jumps: (v.jumps || []).filter(j => j && Number.isFinite(+j.from) && Number.isFinite(+j.to)).slice(0, 6).map(j => ({ from: +j.from, to: +j.to })) }; }
    case "bar": { const p = (Array.isArray(v.parts) ? v.parts : []).slice(0, 6).map(x => numOrNull(x, 0, 1e6)); if (!p.length) return null; return { type: "bar", whole: numOrNull(v.whole, 0, 1e6), parts: p }; }
    case "fraction": { const d = int(v.den, 1, 12), n = int(v.num, 0, 12); return d ? { type: "fraction", num: Math.min(n ?? 0, d), den: d, shape: v.shape === "bar" ? "bar" : "circle" } : null; }
    case "array": { const r = int(v.rows, 1, 10), c = int(v.cols, 1, 10); return r && c ? { type: "array", rows: r, cols: c, emoji: em(v.emoji) } : null; }
    case "clock": { const h = int(v.h, 0, 12), m = int(v.m, 0, 59); return h == null ? null : { type: "clock", h: h || 12, m: m || 0 }; }
    case "image": {
      const src = String(v.src || ""); if (!(/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(src) || /^img\/[\w.-]+\.(png|jpe?g|webp|gif)$/i.test(src)) || src.length > 400000) return null;
      const pct = n => Math.min(100, Math.max(0, Number(n) || 0));
      return { type: "image", src, alt: String(v.alt || "").slice(0, 200),
        spots: (v.spots || []).slice(0, 20).map(p => ({ x: pct(p.x), y: pct(p.y) })),
        rings: (v.rings || []).slice(0, 3).map(r => ({ x: pct(r.x), y: pct(r.y), w: pct(r.w), h: pct(r.h), color: /^#[0-9a-f]{3,6}$/i.test(r.color || "") ? r.color : "#dc2626" })) };
    }
    case "sentence": { const it = (Array.isArray(v.items) ? v.items : []).slice(0, 9).map(x => x === null || x === "?" ? null : ["+", "−", "-", "=", "×", "÷"].includes(x) ? (x === "-" ? "−" : x) : (Number.isFinite(Number(x)) ? Number(x) : undefined)).filter(x => x !== undefined); return it.length >= 3 ? { type: "sentence", items: it } : null; }
    case "mixed": { const it = (Array.isArray(v.items) ? v.items : []).slice(0, 3).map(x => [em(x?.[0]), int(x?.[1], 0, 10) ?? 0]).filter(x => x[1] > 0); return it.length ? { type: "mixed", items: it } : null; }
    case "shapes": { const it = (v.items || []).map(s => String(s).toLowerCase()).filter(s => SHAPES.includes(s)).slice(0, 6); return it.length ? { type: "shapes", items: it } : null; }
  }
  return null;
}
const fmt = n => n == null ? "?" : (Math.round(n * 1000) / 1000).toString();
function renderVisual(v) {
  if (!v) return "";
  let h = "";
  switch (v.type) {
    case "groups":
      const circ = v.style === "circles" || S.current?.data?.groupStyle === "circles";
      h = `<div class="vgroups" data-count>${v.groups.map((n, g) => `<div class="hoop h${g} ${circ ? "circ" : ""}">${n ? Array.from({ length: n }, () => `<button class="obj" data-obj>${esc(v.emojis?.[g] || v.emoji)}</button>`).join("") : `<span class="muted" style="font-weight:900">0</span>`}</div>`).join("")}</div>
        <div class="vhint">👆 ${bi("Tap to count", "Chạm để đếm", true)} <button data-reset>↺</button></div>`; break;
    case "tenframe": {
      const frames = v.count > 10 ? 2 : 1;
      h = `<div class="row" data-count style="justify-content:center">${Array.from({ length: frames }, (_, f) => `<div class="tf-grid">${Array.from({ length: 10 }, (_, i) => { const k = f * 10 + i; return k < v.count ? `<button class="tf-cell" data-obj><i></i></button>` : `<span class="tf-cell"></span>`; }).join("")}</div>`).join("")}</div>
        <div class="vhint">👆 ${bi("Tap to count", "Chạm để đếm", true)} <button data-reset>↺</button></div>`; break;
    }
    case "sentence":
      h = `<div class="sent">${v.items.map(x => typeof x === "number" ? `<span class="sbox">${fmt(x)}</span>` : x === null ? `<span class="sbox q">?</span>` : `<span class="sop">${esc(x)}</span>`).join("")}</div>`; break;
    case "mixed":
      h = `<div class="vgroups" data-count><div class="hoop circ mixed">${v.items.map(([e, n]) => Array.from({ length: n }, () => `<button class="obj" data-obj>${esc(e)}</button>`).join("")).join("")}</div></div>
        <div class="vhint">👆 Tap to count <button data-reset>↺</button></div>`; break;
    case "image":
      h = `<div class="vimg" data-count><img src="${v.src}" alt="${esc(v.alt)}" draggable="false">
        ${v.rings.map(r => `<span class="ring" style="left:${r.x - r.w / 2}%;top:${r.y - r.h / 2}%;width:${r.w}%;height:${r.h}%;border-color:${r.color}"></span>`).join("")}
        ${v.spots.map(p => `<button class="spot" data-obj style="left:${p.x}%;top:${p.y}%" aria-label="Count"></button>`).join("")}</div>
        <div class="vhint">${v.spots.length ? `👆 Tap each one to count <button data-reset>↺</button>` : ""}${v.rings.length ? ` <button data-rings>⭕ Show the groups</button>` : ""}</div>`; break;
    case "partwhole": {
      const n = v.parts.length, W = n === 3 ? 300 : 240, xs = n === 3 ? [55, 150, 245] : [60, 180], cols = ["#dc2626", "#2563eb", "#16a34a"];
      const txt = (x, y, val, c, sl) => `<text data-t="${sl}" x="${x}" y="${y + 11}" text-anchor="middle" font-family="Baloo 2, Nunito" font-weight="800" font-size="${String(fmt(val)).length > 3 ? 20 : 30}" fill="${val == null ? "#f97316" : c}">${fmt(val)}</text>`;
      h = `<svg viewBox="0 0 ${W} 175" width="${W}">${xs.map(x => `<line x1="${W / 2}" y1="66" x2="${x}" y2="112" stroke="#1f2937" stroke-width="6" stroke-linecap="round"/>`).join("")}
        <circle data-slot="w" class="${v.whole == null ? "pw-empty" : ""}" cx="${W / 2}" cy="40" r="34" fill="#fff" stroke="#1f2937" stroke-width="4"/>${txt(W / 2, 40, v.whole, "#1f2937", "w")}
        ${v.parts.map((p, i) => `<circle data-slot="${i}" class="${p == null ? "pw-empty" : ""}" cx="${xs[i]}" cy="136" r="34" fill="#fff" stroke="${cols[i]}" stroke-width="4"/>${txt(xs[i], 136, p, cols[i], i)}`).join("")}</svg>`; break;
    }
    case "numberline": {
      const W = 620, x0 = 30, x1 = 590, X = n => x0 + (n - v.min) / (v.max - v.min) * (x1 - x0), y = 92;
      let ticks = ""; for (let n = v.min; n <= v.max + 1e-9; n += v.step) ticks += `<line x1="${X(n)}" y1="${y - 9}" x2="${X(n)}" y2="${y + 9}" stroke="#1f2937" stroke-width="3"/><text x="${X(n)}" y="${y + 32}" text-anchor="middle" font-family="Nunito" font-weight="800" font-size="17">${fmt(n)}</text>`;
      const jumps = v.jumps.map((j, i) => { const a = X(j.from), b = X(j.to), m = (a + b) / 2, hgt = Math.min(60, Math.abs(b - a) / 2 + 14); const d = j.to - j.from;
        return `<path d="M${a} ${y - 6} Q${m} ${y - 6 - hgt * 1.6} ${b} ${y - 6}" fill="none" stroke="${PALETTE[i % PALETTE.length]}" stroke-width="4" marker-end="url(#ah)"/><text x="${m}" y="${y - 10 - hgt * .8}" text-anchor="middle" font-family="Nunito" font-weight="900" font-size="17" fill="${PALETTE[i % PALETTE.length]}">${d > 0 ? "+" : ""}${fmt(d)}</text>`; }).join("");
      h = `<svg viewBox="0 0 ${W} 135" width="${W}"><defs><marker id="ah" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L10 5L0 10z" fill="#1f2937"/></marker></defs>
        <line x1="12" y1="${y}" x2="608" y2="${y}" stroke="#1f2937" stroke-width="4"/>${ticks}${jumps}${v.marks.map(n => `<circle cx="${X(n)}" cy="${y}" r="9" fill="var(--accent)" stroke="#1f2937" stroke-width="2.5"/>`).join("")}</svg>`; break;
    }
    case "bar": {
      const known = v.parts.filter(p => p != null).reduce((a, b) => a + b, 0), nulls = v.parts.filter(p => p == null).length;
      const total = v.whole != null ? v.whole : known + nulls * Math.max(1, known / Math.max(1, v.parts.length - nulls));
      const missing = nulls ? Math.max(total * .15, (total - known) / nulls) : 0;
      const sizes = v.parts.map(p => p == null ? missing : p), sum = sizes.reduce((a, b) => a + b, 0) || 1;
      let x = 20; const W = 600, inner = 560;
      const segs = sizes.map((s, i) => { const w = s / sum * inner; const r = `<rect x="${x}" y="78" width="${w}" height="46" fill="${PALETTE[(i + 1) % PALETTE.length]}" fill-opacity=".85" stroke="#1f2937" stroke-width="3"/><text x="${x + w / 2}" y="109" text-anchor="middle" font-family="Baloo 2,Nunito" font-weight="800" font-size="24" fill="#fff">${fmt(v.parts[i])}</text>`; x += w; return r; }).join("");
      h = `<svg viewBox="0 0 ${W} 135" width="${W}"><rect x="20" y="12" width="${inner}" height="46" fill="#fff" stroke="#1f2937" stroke-width="3"/><text x="${20 + inner / 2}" y="44" text-anchor="middle" font-family="Baloo 2,Nunito" font-weight="800" font-size="24" fill="${v.whole == null ? "#f97316" : "#1f2937"}">${fmt(v.whole)}</text>${segs}</svg>`; break;
    }
    case "fraction": {
      if (v.shape === "bar") {
        const w = 360 / v.den;
        h = `<svg viewBox="0 0 380 80" width="380">${Array.from({ length: v.den }, (_, i) => `<rect x="${10 + i * w}" y="10" width="${w}" height="60" fill="${i < v.num ? "var(--accent)" : "#fff"}" stroke="#1f2937" stroke-width="3"/>`).join("")}</svg>`;
      } else {
        const R = 72, c = 80;
        const seg = i => { const a0 = (i / v.den) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / v.den) * 2 * Math.PI - Math.PI / 2; return `M${c} ${c} L${c + R * Math.cos(a0)} ${c + R * Math.sin(a0)} A${R} ${R} 0 ${v.den === 1 ? 1 : 0} 1 ${c + R * Math.cos(a1) - (v.den === 1 ? .01 : 0)} ${c + R * Math.sin(a1)} Z`; };
        h = `<svg viewBox="0 0 160 160" width="170">${v.den === 1 ? `<circle cx="${c}" cy="${c}" r="${R}" fill="${v.num ? "var(--accent)" : "#fff"}" stroke="#1f2937" stroke-width="3"/>` : Array.from({ length: v.den }, (_, i) => `<path d="${seg(i)}" fill="${i < v.num ? "var(--accent)" : "#fff"}" stroke="#1f2937" stroke-width="3"/>`).join("")}</svg>`;
      }
      break;
    }
    case "array":
      h = `<div class="arr" style="grid-template-columns:repeat(${v.cols},auto)">${Array.from({ length: v.rows * v.cols }, () => `<span>${esc(v.emoji)}</span>`).join("")}</div>`; break;
    case "clock": {
      const c = 90, ha = ((v.h % 12) + v.m / 60) * 30 * Math.PI / 180, ma = v.m * 6 * Math.PI / 180;
      h = `<svg viewBox="0 0 180 180" width="190"><circle cx="${c}" cy="${c}" r="84" fill="#fff" stroke="var(--primary)" stroke-width="8"/>
        ${Array.from({ length: 60 }, (_, i) => { const a = i * 6 * Math.PI / 180, r1 = i % 5 ? 76 : 70; return `<line x1="${c + r1 * Math.sin(a)}" y1="${c - r1 * Math.cos(a)}" x2="${c + 80 * Math.sin(a)}" y2="${c - 80 * Math.cos(a)}" stroke="#1f2937" stroke-width="${i % 5 ? 1.5 : 3}"/>`; }).join("")}
        ${Array.from({ length: 12 }, (_, i) => { const a = (i + 1) * 30 * Math.PI / 180; return `<text x="${c + 58 * Math.sin(a)}" y="${c - 58 * Math.cos(a) + 7}" text-anchor="middle" font-family="Baloo 2,Nunito" font-weight="800" font-size="19">${i + 1}</text>`; }).join("")}
        <line x1="${c}" y1="${c}" x2="${c + 40 * Math.sin(ha)}" y2="${c - 40 * Math.cos(ha)}" stroke="#ef4444" stroke-width="8" stroke-linecap="round"/>
        <line x1="${c}" y1="${c}" x2="${c + 62 * Math.sin(ma)}" y2="${c - 62 * Math.cos(ma)}" stroke="#1f2937" stroke-width="5" stroke-linecap="round"/><circle cx="${c}" cy="${c}" r="6" fill="#1f2937"/></svg>`; break;
    }
    case "shapes": {
      const poly = (n, r = 30, rot = -Math.PI / 2) => Array.from({ length: n }, (_, i) => { const a = rot + i * 2 * Math.PI / n; return `${40 + r * Math.cos(a)},${40 + r * Math.sin(a)}`; }).join(" ");
      const star = Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 13 : 32; return `${40 + r * Math.cos(a)},${42 + r * Math.sin(a)}`; }).join(" ");
      const draw = { circle: `<circle cx="40" cy="40" r="30"/>`, oval: `<ellipse cx="40" cy="40" rx="34" ry="22"/>`, square: `<rect x="12" y="12" width="56" height="56"/>`, rectangle: `<rect x="4" y="20" width="72" height="40"/>`, triangle: `<polygon points="${poly(3, 34, -Math.PI / 2).replace(/(\d+\.?\d*),(\d+\.?\d*)/g, (m, x, y) => `${x},${+y + 6}`)}"/>`, pentagon: `<polygon points="${poly(5)}"/>`, hexagon: `<polygon points="${poly(6, 31, 0)}"/>`, star: `<polygon points="${star}"/>` };
      h = `<div class="shapes">${v.items.map((s, i) => `<figure><svg viewBox="0 0 80 80" width="76" fill="${PALETTE[i % PALETTE.length]}" stroke="#1f2937" stroke-width="3">${draw[s]}</svg></figure>`).join("")}</div>`; break;
    }
  }
  return `<div class="visual">${h}</div>`;
}
function bindVisuals(root) {
  $$("[data-count]", root).forEach(box => {
    let c = 0;
    const wrap = box.parentElement;
    $$("[data-obj]", box).forEach(o => o.onclick = () => {
      if (o.dataset.n) return; c++; o.dataset.n = c; o.classList.add("counted");
      o.insertAdjacentHTML("beforeend", `<span class="n">${c}</span>`); tone("tap"); speak(String(c));
    });
    const rg = $("[data-rings]", wrap); if (rg) rg.onclick = () => { const on = box.classList.toggle("rings-on"); rg.textContent = on ? "⭕ Hide the groups" : "⭕ Show the groups"; tone("pop"); };
    const r = $("[data-reset]", wrap); if (r) r.onclick = () => { c = 0; $$("[data-obj]", box).forEach(o => { delete o.dataset.n; o.classList.remove("counted"); o.querySelector(".n")?.remove(); }); };
  });
}

/* ===================== activity validation ===================== */
const str = v => (v == null ? "" : String(v)).trim();
const arr = v => Array.isArray(v) ? v : [];
function sanitize(a) {
  if (!a || typeof a !== "object") throw new Error("The AI reply was empty.");
  const out = {
    title: str(a.title) || "Math activity", title_vi: str(a.title_vi), icon: [...str(a.icon)].length && [...str(a.icon)].length <= 4 ? str(a.icon) : "",
    topic: str(a.topic), grade: str(a.grade), summary: str(a.summary), summary_vi: str(a.summary_vi),
    vocabulary: arr(a.vocabulary).map(v => ({ term: str(v.term), term_vi: str(v.term_vi), meaning: str(v.meaning), meaning_vi: str(v.meaning_vi), emoji: [...str(v.emoji)].length <= 4 ? str(v.emoji) : "" })).filter(v => v.term),
    concepts: arr(a.concepts).map(c => ({
      title: str(c.title), title_vi: str(c.title_vi), explain: str(c.explain), explain_vi: str(c.explain_vi),
      example: c.example && str(c.example.problem) ? {
        problem: str(c.example.problem), problem_vi: str(c.example.problem_vi), visual: sanitizeVisual(c.example.visual),
        steps: arr(c.example.steps).map(s => typeof s === "string" ? { en: s, vi: "" } : { en: str(s.en), vi: str(s.vi) }).filter(s => s.en),
        answer: str(c.example.answer)
      } : null
    })).filter(c => c.title || c.explain),
    playground: null, groupStyle: a.groupStyle === "circles" ? "circles" : "",
    practice: arr(a.practice).map(p => {
      const choices = arr(p.choices).map(str).filter(Boolean);
      const type = p.type === "choice" && choices.length >= 2 ? "choice" : "input";
      return { level: Math.min(3, Math.max(1, parseInt(p.level) || 1)), type, choices, answers: arr(p.answers).map(str).filter(Boolean), visual: sanitizeVisual(p.visual),
        question: str(p.question), question_vi: str(p.question_vi), hint: str(p.hint), hint_vi: str(p.hint_vi), solution: str(p.solution), solution_vi: str(p.solution_vi) };
    }).filter(p => p.question && p.answers.length),
    games: {
      match: arr(a.games?.match).map(m => ({ left: str(m.left), right: str(m.right), visual: sanitizeVisual(m.visual) })).filter(m => m.left && m.right),
      speed: arr(a.games?.speed).map(s => ({ q: str(s.q), answers: arr(s.answers).map(str).filter(Boolean), visual: sanitizeVisual(s.visual) })).filter(s => s.q && s.answers.length),
      truefalse: arr(a.games?.truefalse).map(t => ({ statement: str(t.statement), statement_vi: str(t.statement_vi), answer: t.answer === true || t.answer === "true", why: str(t.why), why_vi: str(t.why_vi), visual: sanitizeVisual(t.visual) })).filter(t => t.statement),
      circles: arr(a.games?.circles).map(c => ({ total: int(c?.total, 2, 10), frame: ["sentence", "whole-first"].includes(c?.frame) ? c.frame : "parts", emoji: [...str(c?.emoji)].length && [...str(c?.emoji)].length <= 4 ? str(c.emoji) : "🔴" })).filter(c => c.total).slice(0, 8),
      model: arr(a.games?.model).map(m => { const v = sanitizeVisual({ type: "partwhole", whole: m?.whole, parts: m?.parts }); if (!v) return null;
        const nulls = [v.whole, ...v.parts].filter(x => x == null).length; if (nulls !== 1 || ![v.whole, ...v.parts].every(x => x == null || Number.isInteger(x))) return null;
        const known = v.parts.filter(x => x != null).reduce((a, b) => a + b, 0), ans = v.whole == null ? known : v.whole - known; return ans >= 0 ? { whole: v.whole, parts: v.parts, ans } : null; }).filter(Boolean).slice(0, 12),
    },
    quiz: arr(a.quiz).map(q => {
      const choices = arr(q.choices).map(str).filter(Boolean).slice(0, 5);
      return { question: str(q.question), question_vi: str(q.question_vi), choices, answer: parseInt(q.answer), visual: sanitizeVisual(q.visual), explain: str(q.explain), explain_vi: str(q.explain_vi) };
    }).filter(q => q.question && q.choices.length >= 2 && q.answer >= 0 && q.answer < q.choices.length),
  };
  const pg = a.playground;
  if (pg && pg.kind === "flip") { const t = int(pg.total, 2, 10); if (t) out.playground = { kind: "flip", total: t }; }
  if (pg && pg.kind === "split") { const t = int(pg.total, 2, 10); if (t) out.playground = { kind: "split", style: pg.style === "circles" ? "circles" : "", total: t, emoji: [...str(pg.emoji)].length && [...str(pg.emoji)].length <= 4 ? str(pg.emoji) : "🔴" }; }
  const seenL = new Set(), seenR = new Set();
  out.games.match = out.games.match.filter(m => { const l = norm(m.left), r = norm(m.right); if (seenL.has(l) || seenR.has(r)) return false; seenL.add(l); seenR.add(r); return true; }).slice(0, 8);
  out.practice.sort((x, y) => x.level - y.level);
  if (!out.practice.length && !out.quiz.length) throw new Error("The AI could not build questions from this material.");
  return out;
}

/* ===================== capabilities ===================== */
async function initCaps() {
  const C = window.claude && typeof window.claude.use === "function" ? window.claude : null;
  if (!C) { S.libState = "off"; S.capsReady = true; render(); return; }
  const use = n => C.use(n).catch(() => null);
  const [db, user, sample, downloads] = await Promise.all([use("db"), use("user"), use("sample"), use("downloads")]);
  S.db = db; S.user = user; S.sample = sample; S.downloads = downloads;
  if (user) { try { S.canEdit = await user.canEdit(); } catch { S.canEdit = null; } }
  if (sample) { try { const lim = await sample.limits(); S.imgMax = lim?.images?.maxCount || 0; } catch { S.imgMax = 0; } }
  $("#navCreate").classList.toggle("hidden", !(sample && S.canEdit !== false));
  $("#navShare").classList.toggle("hidden", !isTeacher());
  $("#navPlay").classList.toggle("hidden", !isTeacher());
  S.capsReady = true;
  updateWho();
  if (db) { subscribeLibrary(); try { db.doc("settings/main").onSnapshot(d => { const v = d.exists ? d.data()?.formUrl : ""; if (v || isTeacher()) S.formUrl = v || S.lib?.formUrl || ""; if (S.view === "share") render(); }, () => {}); } catch {} }
  else { S.libState = "off"; }
  if (!S.direct || S.view !== "player") render();
}
function subscribeLibrary() {
  S.libState = "loading";
  const slow = setTimeout(() => { if (S.libState === "loading") { S.libState = "slow"; if (S.view === "library") render(); } }, 10000);
  try {
    S.db.collection("activities").orderBy("createdAt", "desc").onSnapshot(snap => {
      S.activities = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => d.data).map(d => { try { return { ...d, data: sanitize(d.data) }; } catch { return null; } }).filter(Boolean);
      if (!snap.metadata.fromCache) { clearTimeout(slow); S.libState = "ready"; } else if (S.libState === "loading") S.libState = "ready";
      if (S.pendingKey) openFromKey(); else if (S.view === "library") render();
    }, err => { clearTimeout(slow); S.libState = "error"; if (S.view === "library") render(); });
  } catch { clearTimeout(slow); S.libState = "error"; }
}

/* ===================== routing ===================== */
function stopAll() { if (S.timer) { clearInterval(S.timer); S.timer = null; } if (S.raf) { cancelAnimationFrame(S.raf); S.raf = null; } try { synth && synth.cancel(); } catch {} }
function go(view) {
  stopAll(); S.view = view;
  if (view !== "player" && !S.embed && location.hash.startsWith("#act-")) { try { history.replaceState(null, "", location.pathname + location.search); } catch { S.ignoreHash = true; location.hash = ""; } }
  $$("#nav button").forEach(b => b.classList.toggle("on", b.dataset.view === (view === "player" ? (S.preview ? "create" : "library") : view)));
  render(); scrollTo({ top: 0, behavior: "smooth" });
}
function render() {
  const m = $("#main");
  if (S.view === "create") return renderCreate(m);
  if (S.view === "share") return renderShare(m);
  if (S.view === "results") return renderResults(m);
  if (S.view === "journey") return renderJourney(m);
  if (S.view === "player" && S.current) return renderPlayer(m);
  return renderLibrary(m);
}

/* ===================== library ===================== */
function actCard(a, i, local) {
  const d = a.data, col = colorFor(a.id || d.title), p = prog(a.id), st = actStars(p);
  const gameDone = Object.keys(p.games || {}).length > 0;
  return `<div class="card act" data-open="${i}" data-local="${local ? 1 : 0}">
    <div class="row" style="align-items:flex-start"><div class="icon" style="background:${col}22">${esc(d.icon || "🔢")}</div><span class="spacer"></span>
      <div style="text-align:right">${d.grade ? `<span class="tag">${esc(d.grade)}</span>` : ""}${local ? `<div><span class="tag coral">Not saved</span></div>` : ""}</div></div>
    <h3>${bi(d.title, d.title_vi)}</h3>
    ${d.topic ? `<div><span class="tag sun">${esc(d.topic)}</span></div>` : ""}
    <div class="pips" title="Learn · Practice · Games · Quiz"><span class="pip ${p.learn ? "on" : ""}">📘</span><span class="pip ${p.practice ? "on" : ""}">✏️</span><span class="pip ${gameDone ? "on" : ""}">🎮</span><span class="pip ${p.quiz ? "on" : ""}">🏆</span></div>
    <div class="foot"><b style="font-family:var(--fd);font-size:18px">⭐ ${st}</b><span class="spacer"></span>
      ${S.canEdit && !local ? `<button class="btn btn-ghost btn-sm" data-ln="${i}" title="Copy student link">🔗</button><button class="btn btn-ghost btn-sm" data-dl="${i}" title="Offline copy">⬇</button><button class="btn btn-ghost btn-sm" data-del="${i}" title="Delete">🗑</button>` : ""}
      <button class="btn btn-primary btn-sm">${bi("Play", "Chơi", true)} ▶</button></div>
  </div>`;
}
function libList() { return S.db ? S.activities : (S.lib?.activities || []).map(a => { try { return { ...a, data: sanitize(a.data) }; } catch { return null; } }).filter(Boolean); }
function openFromKey() {
  const key = S.pendingKey, a = libList().find(x => linkKey(x) === key);
  if (a) { S.pendingKey = null; S.direct = !isTeacher(); openActivity(a, false); return true; }
  if (S.db && S.libState === "ready" || !S.db && S.libState === "off") { S.pendingKey = null; toast("That activity link wasn't found."); render(); }
  return false;
}
function renderLibrary(m) {
  if (!isTeacher()) {
    m.innerHTML = `<div class="card result" style="max-width:560px;margin:30px auto"><div class="mascot" style="margin:0 auto;width:120px">${mascotSVG()}</div>
      ${S.capsReady ? `<h2>Hi there! 👋</h2><p style="font-weight:800;font-size:19px">Please open the activity link your teacher gave you.</p><div style="font-size:50px">🔗</div>` : `<h2>Loading…</h2>`}</div>`;
    return;
  }
  const list = libList(), local = S.localActs;
  let body = "";
  if (S.libState === "loading" && !list.length) body = `<div class="card sec muted">Loading activities…</div>`;
  else if (S.libState === "slow" && !list.length) body = `<div class="notice">The class library can't be reached yet. Check your connection.</div>`;
  else if (S.libState === "error") body = `<div class="notice err">The class library could not be loaded right now.</div>`;
  else if (S.libState === "off" && !local.length && !list.length) body = `<div class="notice">Ask your teacher for your activity link.</div>`;
  if (list.length || local.length) body += `<div class="grid">${local.map((a, i) => actCard(a, i, true)).join("")}${list.map((a, i) => actCard(a, i, false)).join("")}</div>`;
  else if (S.libState === "ready") body += `<div class="card empty"><div style="font-size:70px">📭</div><h2>No activities yet</h2>
      <p class="muted">${S.canEdit !== false && S.sample ? "Upload a lesson and MathSpark will build learning, games and a quiz." : "Your teacher hasn't added any activities yet."}</p>
      ${S.canEdit !== false && S.sample ? `<button class="btn btn-primary btn-lg" id="goCreate">✨ Create the first activity</button>` : ""}</div>`;
  m.innerHTML = `<div class="hero onbg libhero"><div class="mascot">${mascotSVG()}</div><div class="bubble" style="margin-bottom:30px"><h1 style="font-size:inherit">${bi("Hi! I'm Sparky. Let's play math!", "Chào em! Mình là Sparky. Cùng chơi toán nhé!")}</h1></div>
    <div class="resbtns"><a class="btn btn-ghost btn-lg" href="${SITE_URL}#missions" target="_blank" rel="noopener">🗺️ Missions</a><a class="btn btn-primary btn-lg" href="${SITE_URL}#results" target="_blank" rel="noopener">📊 See results</a></div></div>${body}`;
  $(".hero h1", m).style.fontSize = "24px";
  $("#goCreate")?.addEventListener("click", () => go("create"));
  $$("[data-open]", m).forEach(el => el.addEventListener("click", e => {
    if (e.target.closest("[data-del],[data-dl],[data-ln]")) return;
    tone("whoosh"); openActivity((el.dataset.local === "1" ? local : list)[+el.dataset.open], el.dataset.local === "1");
  }));
  $$("[data-del]", m).forEach(b => b.addEventListener("click", async () => {
    const a = list[+b.dataset.del];
    if (!(await askConfirm("Delete this activity?", `"${a.data.title}" will be removed for all students.`, "Delete"))) return;
    try { await S.db.collection("activities").doc(a.id).delete(); toast("Deleted"); } catch (e) { toast("Couldn't delete: " + (e?.code || "error")); }
  }));
  $$("[data-dl]", m).forEach(b => b.addEventListener("click", () => offlineCopy(list[+b.dataset.dl])));
  $$("[data-ln]", m).forEach(b => b.addEventListener("click", () => showLink(list[+b.dataset.ln])));
}
function showLink(a) {
  const url = actLink(a);
  modal(`<h3>🔗 Student link</h3><p class="small muted" style="font-weight:700">${esc(a.data.title)}</p>
    <input type="text" readonly value="${esc(url)}" id="lnk" style="font-size:14px"><div class="row" style="margin-top:10px"><button class="btn btn-primary btn-sm" id="cp">📋 Copy link</button><button class="btn btn-ghost btn-sm" id="cls">Close</button></div>
    <div class="notice" style="margin-top:12px">This link works once the page is on your GitHub website. New activity? Press <b>⬇ Website page</b> on the 📤 Share &amp; results page and upload it to the <b>${esc(webFolder(a))}</b> folder.</div>`, (m, close) => {
    $("#lnk", m).onclick = e => e.target.select();
    $("#cp", m).onclick = async () => { try { await navigator.clipboard.writeText(url); toast("Link copied!"); } catch { $("#lnk", m).select(); toast("Press Ctrl+C to copy"); } };
    $("#cls", m).onclick = close;
  });
}
function openActivity(a, isPreview) {
  S.current = a; S.preview = !!isPreview; S.tab = "learn"; S.game = null; S.pr = null; S.quiz = null; go("player");
  if (!isPreview && !S.embed) { try { const h = "act-" + linkKey(a); if (location.hash !== "#" + h) { S.ignoreHash = true; location.hash = h; } } catch {} }
  if (!isPreview) askName();
}

/* ===================== create (teacher) ===================== */
const KIND = f => {
  const n = (f.name || "").toLowerCase(), t = f.type || "";
  if (t === "application/pdf" || n.endsWith(".pdf")) return "pdf";
  if (n.endsWith(".pptx")) return "pptx";
  if (n.endsWith(".ppt")) return "ppt";
  if (n.endsWith(".docx")) return "docx";
  if (t.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/.test(n)) return "image";
  if (t.startsWith("text/") || n.endsWith(".txt") || n.endsWith(".md")) return "text";
  return "other";
};
const KCOL = { pdf: "#dc2626", pptx: "#ea580c", ppt: "#ea580c", docx: "#2563eb", image: "#0f766e", text: "#6b7280", other: "#6b7280" };
function addFiles(list) {
  for (const f of list) {
    const k = KIND(f);
    const item = { id: Math.random().toString(36).slice(2), name: f.name || "pasted-image.png", kind: k, file: f, thumb: null, status: "" };
    if (k === "ppt") item.status = "Old .ppt format — please save as .pptx or PDF";
    if (k === "other") item.status = "This file type can't be read";
    if (k === "image") item.thumb = URL.createObjectURL(f);
    S.files.push(item);
  }
  if (S.view === "create") renderFiles();
}
function renderFiles() {
  const el = $("#fileList"); if (!el) return;
  el.innerHTML = S.files.map(f => `<div class="file">
    ${f.thumb ? `<img class="thumb" src="${f.thumb}" alt="">` : `<div class="thumb" style="background:${KCOL[f.kind]}">${esc(f.kind.toUpperCase())}</div>`}
    <div><div class="nm">${esc(f.name)}</div><div class="st">${esc(f.status || (f.file.size ? (f.file.size / 1024 / 1024).toFixed(2) + " MB" : ""))}</div></div>
    <button class="x" data-rm="${f.id}" aria-label="Remove">×</button></div>`).join("");
  $$("[data-rm]", el).forEach(b => b.onclick = () => { const f = S.files.find(x => x.id === b.dataset.rm); if (f?.thumb) URL.revokeObjectURL(f.thumb); S.files = S.files.filter(x => x.id !== b.dataset.rm); renderFiles(); });
  updateBuildBtn();
}
function updateBuildBtn() {
  const b = $("#buildBtn"); if (!b) return;
  const has = S.files.some(f => !["ppt", "other"].includes(f.kind)) || ($("#pasteText")?.value.trim().length > 20);
  b.disabled = !has || !!S.build;
}
function renderCreate(m) {
  if (!S.sample) { m.innerHTML = `<div class="card sec"><h2>Create an activity</h2><div class="notice">Building activities with AI needs Claude. Open this page on claude.ai while signed in.</div></div>`; return; }
  const opt = store.get("opts", { grade: "Grade 1", diff: "on", practice: 10, quiz: 10, vi: true, quality: "default" });
  const grades = ["Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6", "Grade 7", "Grade 8", "Grade 9"];
  m.innerHTML = `
  <div class="guide onbg"><div class="mascot" id="mascot">${mascotSVG()}</div><div class="bubble" id="bubble"><b>Create a math activity.</b> Give me the lesson — I'll build pictures, practice, games and a quiz on that topic.</div></div>
  <div class="create">
    <div class="card sec">
      <div class="drop" id="drop" tabindex="0" role="button" aria-label="Upload files">
        <div class="big">📚</div><h3>Drop the lesson here</h3>
        <div class="muted small">PDF · PowerPoint (.pptx) · Word (.docx) · photos of the book<br>or <b>click to choose</b>, or <b>paste</b> a picture (Ctrl + V)</div>
        <input type="file" id="fileIn" multiple accept=".pdf,.pptx,.ppt,.docx,.txt,image/*" hidden>
      </div>
      <div class="files" id="fileList"></div>
      <label class="f" for="pasteText">Paste lesson text (optional)</label>
      <textarea id="pasteText" rows="4" placeholder="Copy and paste text from the book or your notes…"></textarea>
      <label class="f" for="extra">Instructions for the AI (optional)</label>
      <input type="text" id="extra" placeholder="e.g. Only use page 2 · Use money examples · Make it Lesson 1 only">
    </div>
    <div class="card sec">
      <h2>Settings</h2>
      <div class="settings">
        <div><label class="f">Grade</label><select id="oGrade">${grades.map(g => `<option ${g === opt.grade ? "selected" : ""}>${g}</option>`).join("")}</select></div>
        <div><label class="f">Difficulty</label><select id="oDiff"><option value="easy" ${opt.diff === "easy" ? "selected" : ""}>Easier (support)</option><option value="on" ${opt.diff === "on" ? "selected" : ""}>On level</option><option value="hard" ${opt.diff === "hard" ? "selected" : ""}>Challenge</option></select></div>
        <div><label class="f">Practice questions</label><select id="oPractice">${[6, 10, 15].map(n => `<option ${n == opt.practice ? "selected" : ""}>${n}</option>`).join("")}</select></div>
        <div><label class="f">Quiz questions</label><select id="oQuiz">${[5, 10, 15, 20].map(n => `<option ${n == opt.quiz ? "selected" : ""}>${n}</option>`).join("")}</select></div>
      </div>
      <label class="f">AI quality</label>
      <select id="oQuality"><option value="default" ${opt.quality === "default" ? "selected" : ""}>Standard (faster)</option><option value="complex" ${opt.quality === "complex" ? "selected" : ""}>Best (slower, more careful)</option></select>
      <label class="check"><input type="checkbox" id="oVi" ${opt.vi ? "checked" : ""}> Add Vietnamese to Key words and Learn</label>
      <div style="margin-top:18px"><button class="btn btn-primary btn-lg" id="buildBtn" style="width:100%" disabled>✨ Build activity</button></div>
      ${S.imgMax ? "" : `<p class="small muted" style="margin-top:8px">Pictures can't be sent to the AI in this view, so only text in your files will be read.</p>`}
      <div id="status"></div>
    </div>
  </div>`;
  const drop = $("#drop"), fin = $("#fileIn");
  drop.onclick = () => fin.click();
  drop.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fin.click(); } };
  fin.onchange = () => { addFiles([...fin.files]); fin.value = ""; };
  drop.ondragover = e => { e.preventDefault(); drop.classList.add("over"); };
  drop.ondragleave = () => drop.classList.remove("over");
  drop.ondrop = e => {
    e.preventDefault(); drop.classList.remove("over");
    const fs = [...(e.dataTransfer.files || [])];
    if (fs.length) addFiles(fs);
    else { const t = e.dataTransfer.getData("text/plain"); if (t) { const ta = $("#pasteText"); ta.value = (ta.value ? ta.value + "\n" : "") + t; updateBuildBtn(); } }
  };
  $("#pasteText").oninput = updateBuildBtn;
  $("#buildBtn").onclick = startBuild;
  renderFiles();
  if (S.build) renderStatus();
}
document.addEventListener("paste", e => {
  if (S.view !== "create") return;
  const items = [...(e.clipboardData?.items || [])].filter(i => i.kind === "file");
  if (items.length) {
    e.preventDefault();
    addFiles(items.map((i, n) => { const f = i.getAsFile(); return f && !f.name ? new File([f], `pasted-${Date.now()}-${n}.png`, { type: f.type }) : f; }).filter(Boolean));
    toast("Picture added");
  } else if (!["TEXTAREA", "INPUT"].includes(document.activeElement?.tagName)) {
    const t = e.clipboardData?.getData("text/plain");
    if (t) { const ta = $("#pasteText"); ta.value = (ta.value ? ta.value + "\n" : "") + t; updateBuildBtn(); toast("Text added"); }
  }
});

/* ---------- file reading ---------- */
const loaded = {};
function loadScript(src) {
  return loaded[src] || (loaded[src] = new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => { delete loaded[src]; rej(new Error("Could not load a helper library. Check your internet connection.")); }; document.head.appendChild(s); }));
}
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFW = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
const JSZIP = "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
function canvasToBlob(c, q = .85) { return new Promise(r => c.toBlob(b => r(b), "image/jpeg", q)); }
async function shrinkImage(blob, max = 1600) {
  try {
    const bmp = await createImageBitmap(blob);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
    return await canvasToBlob(c);
  } catch { return null; }
}
async function readPdf(f, budget, setStatus) {
  await loadScript(PDFJS); await loadScript(PDFW);
  const lib = window.pdfjsLib; lib.GlobalWorkerOptions.workerSrc = PDFW;
  const pdf = await lib.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise;
  const n = Math.min(pdf.numPages, 40), texts = [], images = [], renderAll = pdf.numPages <= budget;
  for (let i = 1; i <= n; i++) {
    setStatus(`Reading page ${i} of ${pdf.numPages}`);
    const page = await pdf.getPage(i), tc = await page.getTextContent();
    let t = "", lastY = null;
    for (const it of tc.items) { const y = it.transform?.[5]; if (lastY != null && Math.abs(y - lastY) > 4) t += "\n"; else if (t && !t.endsWith(" ")) t += " "; t += it.str; lastY = y; }
    t = t.replace(/[ \t]+/g, " ").trim();
    if (t) texts.push(`[Page ${i}]\n${t}`);
    if ((renderAll || t.length < 60) && images.length < budget) {
      const vp0 = page.getViewport({ scale: 1 }), scale = Math.min(2.2, 1500 / Math.max(vp0.width, vp0.height)), vp = page.getViewport({ scale });
      const c = document.createElement("canvas"); c.width = vp.width; c.height = vp.height;
      const ctx = c.getContext("2d"); ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const b = await canvasToBlob(c, .82); if (b) images.push({ blob: b, label: `${f.name} page ${i}` });
    }
  }
  if (pdf.numPages > n) texts.push(`[Only the first ${n} of ${pdf.numPages} pages were read]`);
  return { text: texts.join("\n\n"), images, note: `${pdf.numPages} pages` };
}
const decodeXml = s => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d)).replace(/&amp;/g, "&");
function xmlText(xml, tag) {
  return xml.split(new RegExp(`</${tag}:p>`)).map(p => [...p.matchAll(new RegExp(`<${tag}:t(?:\\s[^>]*)?>([^<]*)</${tag}:t>`, "g"))].map(m => decodeXml(m[1])).join("")).map(s => s.trim()).filter(Boolean).join("\n");
}
async function readPptx(f, budget, setStatus) {
  await loadScript(JSZIP);
  const zip = await window.JSZip.loadAsync(await f.arrayBuffer());
  const slides = Object.keys(zip.files).filter(p => /^ppt\/slides\/slide\d+\.xml$/.test(p)).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]);
  const texts = [];
  for (const [i, p] of slides.entries()) {
    setStatus(`Reading slide ${i + 1} of ${slides.length}`);
    const t = xmlText(await zip.file(p).async("string"), "a");
    const notesP = `ppt/notesSlides/notesSlide${p.match(/\d+/)[0]}.xml`;
    let notes = ""; if (zip.file(notesP)) notes = xmlText(await zip.file(notesP).async("string"), "a").replace(/^\d+$/m, "").trim();
    if (t || notes) texts.push(`[Slide ${i + 1}]\n${t}${notes ? `\n(Notes: ${notes})` : ""}`);
  }
  const media = Object.keys(zip.files).filter(p => /^ppt\/media\/.*\.(png|jpe?g|gif|webp)$/i.test(p));
  const sized = await Promise.all(media.map(async p => ({ p, b: await zip.file(p).async("blob") })));
  const images = [];
  for (const { p, b } of sized.filter(x => x.b.size > 12000).sort((a, b) => b.b.size - a.b.size).slice(0, budget)) { const s = await shrinkImage(b); if (s) images.push({ blob: s, label: `${f.name} picture ${p.split("/").pop()}` }); }
  return { text: texts.join("\n\n"), images, note: `${slides.length} slides` };
}
async function readDocx(f, budget) {
  await loadScript(JSZIP);
  const zip = await window.JSZip.loadAsync(await f.arrayBuffer());
  const x = zip.file("word/document.xml"); const text = x ? xmlText(await x.async("string"), "w") : "";
  const media = Object.keys(zip.files).filter(p => /^word\/media\/.*\.(png|jpe?g|gif|webp)$/i.test(p));
  const images = [];
  for (const p of media.slice(0, budget)) { const b = await zip.file(p).async("blob"); if (b.size > 12000) { const s = await shrinkImage(b); if (s) images.push({ blob: s, label: `${f.name} picture` }); } }
  return { text, images, note: "" };
}

/* ---------- build ---------- */
function renderStatus() {
  const el = $("#status"); if (!el || !S.build) return;
  const b = S.build, steps = ["Reading your files", "AI is analyzing the lesson", "Building activities"];
  el.innerHTML = `<div class="status"><b>${esc(b.error ? "Something went wrong" : "Building…")}</b>
    <ul class="steps">${steps.map((s, i) => `<li class="${i < b.step ? "done" : i === b.step && !b.error ? "on" : ""}"><span class="dot">${i < b.step ? "✓" : ""}</span>${s}${i === b.step && b.detail ? ` <span class="small muted">· ${esc(b.detail)}</span>` : ""}</li>`).join("")}</ul>
    ${b.error ? `<div class="notice err" style="margin-top:10px">${esc(b.error)}</div><button class="btn btn-ghost btn-sm" id="closeStatus" style="margin-top:10px">OK</button>` : `<button class="btn btn-ghost btn-sm" id="stopBuild" style="margin-top:10px">Stop</button>`}</div>`;
  $("#stopBuild")?.addEventListener("click", () => b.ctl.abort());
  $("#closeStatus")?.addEventListener("click", () => { S.build = null; el.innerHTML = ""; updateBuildBtn(); });
}
function setBuild(patch) { Object.assign(S.build, patch); if (S.view === "create") renderStatus(); }
const ERRS = {
  not_granted: "Claude wasn't allowed to run on this page. Reload and choose Allow to build activities.",
  sampling_disabled: "Claude isn't available on this account.",
  rate_limited: "Too many requests right now, or your usage limit was reached. Please wait a bit and try again.",
  session_expired: "Your sign-in expired. Please sign in to claude.ai again.",
  image_rejected: "One of the pictures couldn't be read. Try a different photo (JPG or PNG).",
  prompt_too_large: "The files are too long. Try uploading fewer pages.",
  refused: "The AI declined this material. Try a different file.",
  invalid_json: "The AI reply was not in the right format. Please try again.",
  empty_completion: "The AI returned nothing. Try fewer pages or try again.",
};
async function startBuild() {
  if (S.build) return;
  const opts = { grade: $("#oGrade").value, diff: $("#oDiff").value, practice: +$("#oPractice").value, quiz: +$("#oQuiz").value, vi: $("#oVi").checked, quality: $("#oQuality").value };
  store.set("opts", opts);
  const extra = $("#extra").value.trim(), pasted = $("#pasteText").value.trim();
  S.build = { ctl: new AbortController(), step: 0, detail: "" };
  updateBuildBtn(); renderStatus(); setGuide("think", "Let me read the lesson…");
  try {
    const texts = [], imgs = [];
    const budget = () => Math.max(0, (S.imgMax || 0) - imgs.length);
    const usable = S.files.filter(f => !["ppt", "other"].includes(f.kind));
    for (const f of usable.filter(f => f.kind === "image")) { if (budget() > 0) { setBuild({ detail: f.name }); const b = await shrinkImage(f.file); if (b) imgs.push({ blob: b, label: f.name }); } }
    for (const f of usable.filter(f => f.kind !== "image")) {
      if (S.build.ctl.signal.aborted) throw { code: "cancelled" };
      const st = d => { f.status = d; setBuild({ detail: `${f.name}: ${d}` }); };
      let r;
      if (f.kind === "pdf") r = await readPdf(f.file, budget(), st);
      else if (f.kind === "pptx") r = await readPptx(f.file, budget(), st);
      else if (f.kind === "docx") r = await readDocx(f.file, budget());
      else r = { text: await f.file.text(), images: [] };
      f.status = `Read ✓ ${r.note || ""}`.trim();
      if (r.text) texts.push(`=== ${f.name} ===\n${r.text}`);
      imgs.push(...r.images.slice(0, budget()));
    }
    if (pasted) texts.push(`=== Pasted text ===\n${pasted}`);
    renderFiles();
    let source = texts.join("\n\n");
    if (source.length > 90000) source = source.slice(0, 90000) + "\n[...text cut short...]";
    if (!source.trim() && !imgs.length) throw new Error(S.imgMax ? "No readable content was found in the files." : "No text was found. Pictures can't be read in this view — try a PDF with text, or paste the text.");
    setBuild({ step: 1, detail: "Thinking… (this can take 1–2 minutes)" });
    const prompt = buildPrompt(opts, extra, source, imgs.map(i => i.label));
    const data = await S.sample.json(prompt, {
      signal: S.build.ctl.signal, modelTier: opts.quality, images: imgs.length ? imgs.map(i => i.blob) : undefined, cache: false,
      onText: ({ text }) => setBuild({ detail: `Writing… ${text.length.toLocaleString()} characters` }),
    });
    setBuild({ step: 2, detail: "" });
    if (data && data.error) throw new Error(String(data.error));
    const act = sanitize(data);
    S.build = null;
    openActivity({ id: "local-" + Date.now(), createdAt: Date.now(), data: act }, true);
    tone("win"); confetti(); toast("Activity ready! Check it, then save it for your class.");
  } catch (e) {
    if (e?.code === "cancelled") { S.build = null; if (S.view === "create") { $("#status").innerHTML = ""; updateBuildBtn(); } return; }
    setBuild({ error: e?.code ? (ERRS[e.code] || "The AI service had a problem. Please try again.") : (e?.message || "Something went wrong.") });
  }
}
function buildPrompt(o, extra, source, imgLabels) {
  const diff = { easy: "easier than the book (more support, smaller numbers)", on: "at the same level as the book", hard: "slightly more challenging than the book (more multi-step and word problems)" }[o.diff];
  const vi = o.vi
    ? `Vietnamese goes ONLY in the vocabulary and the Learn content: fill vocabulary "term_vi" and "meaning_vi", "title_vi", "summary_vi", and in every concept "title_vi", "explain_vi", example "problem_vi" and each step's "vi", with natural, accurate Vietnamese using the standard math words Vietnamese textbooks use (e.g. phân số, mẫu số, phép cộng, chu vi, diện tích; address children as "em"). Practice, games and quiz are English only: leave every other *_vi field as "". Students are Vietnamese children with low English, so keep English simple.`
    : `English only: leave every *_vi field as "".`;
  return `You are an expert primary and lower-secondary math teacher building a fun, interactive, picture-rich practice activity for ${o.grade} students at a bilingual school in Vietnam.

TASK
Read the lesson material below${imgLabels.length ? ` and the ${imgLabels.length} attached image(s) (${imgLabels.join("; ")})` : ""}. Find the main math topic and the skills it teaches. Build an activity ONLY about that topic, using the same methods, models (e.g. part-whole model, ten frame, number line, bar model), vocabulary and number range the material uses. Make it ${diff}.
${extra ? `Teacher's instructions (follow them): ${extra}\n` : ""}
RULES
- Every answer MUST be correct. Work each question out before writing its answer. Double-check arithmetic, and check that every visual matches its question.
- Write math in plain text with Unicode: × ÷ − = ≠ < > ≤ ≥ ½ ¼ ¾ ² ³ √ π °. Fractions as 3/4, mixed numbers as 1 1/2. No LaTeX, no Markdown.
- Short sentences, simple English. Use names, money (đồng), food, animals and places familiar to children in Vietnam.
- ${vi}
- "answers" lists every acceptable typed answer (e.g. ["12","12 cm"], ["3/4","0.75"]). Typed answers must be short: a number, a fraction, or one or two words. Prefer numeric answers for "input" questions.
- Practice "choice" items: 2–4 choices; answers[0] must exactly equal the correct choice text.
- Quiz "answer" = 0-based index of the correct choice. Spread correct positions. Distractors = common mistakes.
- Match pairs: unique, short (max ~6 words) left/right, e.g. a problem and its answer. Emoji are welcome.
- Speed items: quick mental-math or recall questions with one short answer (prefer a number).
- If the material has no math content at all, reply {"error":"short reason"} instead.

VISUALS — young children learn from pictures, so add a "visual" to MOST practice items, quiz questions and every concept example where a picture fits. The question text must make sense together with the visual. If the question asks for a number, do not show that number in the visual (use null, which shows "?"). Allowed visuals:
- {"type":"groups","emoji":"🐸","groups":[3,2],"style":"circles"} (or "emojis":["🍏","🍌"] for a different object in each group)  objects in 1–3 groups (0–12 each); children tap them to count; "style":"circles" draws plain red circles like the book, "" draws red/blue hoops. When you say "first circle"/"second circle" use circles; only say "red hoop"/"blue hoop" with the hoop style
- {"type":"partwhole","whole":6,"parts":[2,null]}  part-whole (cherry) model; 2 or 3 parts; null shows "?"
- {"type":"tenframe","count":7}  ten frame(s), 0–20 counters
- {"type":"numberline","min":0,"max":10,"marks":[3],"jumps":[{"from":3,"to":7}]}
- {"type":"bar","whole":10,"parts":[6,null]}  bar model; whole may be null
- {"type":"fraction","num":3,"den":4,"shape":"circle"}  shape "circle" or "bar"; den 1–12
- {"type":"array","rows":3,"cols":4,"emoji":"🍎"}  up to 10×10
- {"type":"clock","h":3,"m":30}
- {"type":"shapes","items":["triangle","square"]}  from circle, square, triangle, rectangle, pentagon, hexagon, oval, star
- {"type":"sentence","items":[2,"+",3,"=",null]}  a number sentence in yellow boxes like the book; null shows "?"; also "whole first" like [null,"=",2,"+",3]
- {"type":"mixed","items":[["🔴",4],["🟡",2]]}  two or three kinds of counters mixed in ONE circle (e.g. double-sided counters)
Emoji pictures in the question text (like 🍎🍎🍎) are also fine for very young learners.

GAMES WITH MODELS — games can show visuals too: a match item's "visual" replaces its left text on the card (keep "left" as a short text label), and speed and truefalse items may have a "visual". When the lesson uses a part-whole model, number bonds, addition or subtraction, fill "games.model" with 10 part-whole puzzles that each have exactly ONE null (the missing whole or part), numbers from the lesson's range, and use partwhole visuals in many speed, truefalse and match items. Otherwise "model": [].

TWO CIRCLES GAME — each set may have "frame": "parts" (☐ is a part. ☐ is a part. The whole is ☐.), "sentence" (☐ + ☐ = ☐) or "whole-first" (☐ = ☐ + ☐); use "sentence"/"whole-first" when the lesson teaches number sentences or number bonds. When the lesson is about parts and wholes, grouping, sorting into 2 groups, number bonds or addition within 10, fill "games.circles" with 6 sets of objects (total 3–10, one emoji each); children drag them into two empty circles and complete "☐ is a part. ☐ is a part. The whole is ☐." Otherwise "circles": [].

PLAYGROUND — if the topic is number bonds, part-whole, addition or subtraction within 10, include "playground":{"kind":"split","total":N,"emoji":"🔴"} (move objects between two circles) or {"kind":"flip","total":N} (flip red/yellow double-sided counters in one circle — best for number bonds) with N = 4–10 from the lesson (children move counters between two hoops). Otherwise set "playground": null.

Reply with ONLY one JSON object in exactly this shape:
{
 "title": "short activity title", "title_vi": "", "icon": "one emoji for the topic",
 "topic": "topic in 1-4 words", "grade": "${o.grade}",
 "summary": "1-2 sentences telling students what they will learn", "summary_vi": "",
 "vocabulary": [ {"term":"","term_vi":"","emoji":"one emoji","meaning":"simple child-friendly meaning","meaning_vi":""} ],
 "concepts": [ {"title":"","title_vi":"","explain":"2-4 short sentences","explain_vi":"",
   "example": {"problem":"","problem_vi":"","visual":{...} or null,"steps":[{"en":"","vi":""}],"answer":""}} ],
 "playground": {"kind":"split","total":5,"emoji":"🔴"} or null,
 "practice": [ {"level":1,"type":"input","question":"","question_vi":"","visual":{...} or null,"choices":[],"answers":[""],"hint":"","hint_vi":"","solution":"short worked solution","solution_vi":""} ],
 "games": {
   "match": [ {"left":"","right":"","visual":{...} or null} ],
   "speed": [ {"q":"","answers":[""],"visual":{...} or null} ],
   "truefalse": [ {"statement":"","statement_vi":"","answer":true,"why":"","why_vi":"","visual":{...} or null} ],
   "model": [ {"whole":6,"parts":[2,null]} ],
   "circles": [ {"total":4,"emoji":"🟥","frame":"parts"} ]
 },
 "quiz": [ {"question":"","question_vi":"","visual":{...} or null,"choices":["","","",""],"answer":0,"explain":"","explain_vi":""} ]
}
Counts: vocabulary 4–8; concepts 2–4 (each with a worked example of 2–5 steps); practice exactly ${o.practice} (levels 1 easy → 3 harder, mixing "input" and "choice"); match 6 pairs; speed 15; truefalse 8; model 10 (or 0); circles 6 (or 0); quiz exactly ${o.quiz}.

LESSON MATERIAL
${source || "(See the attached images.)"}`;
}

/* ---------- saving / offline ---------- */
async function saveCurrent() {
  const a = S.current;
  if (!S.db) { toast("Sign in to save to the class library. Use the offline copy instead."); return; }
  const btn = $("#saveBtn"); if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }
  try {
    const id = slugify(a.data.title) + "-" + Math.random().toString(36).slice(2, 6);
    const ref = S.db.collection("activities").doc(id);
    const used = new Set(S.activities.map(webFolder)); let folder = slugify(a.data.title), k = 2; while (used.has(folder)) folder = slugify(a.data.title) + "-" + k++;
    await ref.set({ createdAt: Date.now(), title: a.data.title, folder, data: a.data });
    S.localActs = S.localActs.filter(x => x !== a);
    S.current = { ...a, id: ref.id, folder }; S.preview = false;
    tone("win"); confetti(); toast("Saved! Go to 📤 Share & results to put it on your website.", 4000);
    go("player");
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = "💾 Save for class"; }
    toast(e?.code === "quota_exceeded" ? "The library is full. Delete old activities first." : e?.code === "invalid_argument" ? "You don't have permission to save to this library." : "Couldn't save. Please try again.");
  }
}
async function offlineCopy(a) {
  if (!S.downloads) { toast("Downloads aren't available here."); return; }
  const data = JSON.parse(JSON.stringify(a.data));
  const toData = async src => { try { const b = await (await fetch(src)).blob(); return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(src); fr.readAsDataURL(b); }); } catch { return src; } };
  const walk = async o => { if (!o || typeof o !== "object") return; if (o.type === "image" && typeof o.src === "string" && !o.src.startsWith("data:")) o.src = await toData(o.src); for (const k in o) await walk(o[k]); };
  await walk(data);
  const payload = JSON.stringify({ id: a.id, data, formUrl: S.formUrl || "" }).replace(/</g, "\\u003c");
  const main = $("#app-main").textContent;
  const html = `<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(a.data.title)} · MathSpark</title><link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet"><style id="app-style">${STYLE_TEXT}</style></head><body data-theme="${S.theme}">${TEMPLATE_BODY}<script>window.__EMBED__=${payload};<\/script><script id="app-main">${main}<\/script></body></html>`;
  const filename = (a.data.title || "math-activity").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60) + ".html";
  try { await S.downloads.save({ filename, data: new Blob([html], { type: "text/html" }) }); toast("Offline copy saved. Share the file with students — it opens in any browser."); }
  catch (e) { try { await S.downloads.save({ filename, data: html }); toast("Offline copy saved."); } catch { toast("The download was cancelled."); } }
}

/* ===================== mission journey (website home page) ===================== */
const ON_SITE = () => !!window.__CONFIG__;
const MISSIONS = () => Array.isArray(window.__MISSIONS__) ? window.__MISSIONS__.filter(x => x && x.id && x.folder) : [];
const stuId = st => st ? `${st.name}|${st.cls}`.toLowerCase() : "";
const EVO = [
  { n: "Sparky Egg", vi: "Trứng Sparky" }, { n: "Baby Sparky", vi: "Sparky con" }, { n: "Sparky", vi: "Sparky" },
  { n: "Super Sparky", vi: "Siêu Sparky" }, { n: "Rocket Sparky", vi: "Sparky Tên lửa" }, { n: "Wizard Sparky", vi: "Sparky Phù thủy" },
  { n: "Golden Sparky", vi: "Sparky Vàng" }, { n: "King Sparky", vi: "Vua Sparky" }, { n: "Galaxy Sparky", vi: "Sparky Ngân hà" }];
const MAX_STAGE = EVO.length - 1;
const stageFor = done => Math.max(0, Math.min(MAX_STAGE, done));
function sparkySVG(stage, cls = "") {
  stage = Math.max(0, Math.min(MAX_STAGE, stage | 0));
  const u = "sp" + Math.random().toString(36).slice(2, 7);
  if (stage === 0) return `<svg class="sparky s0 ${cls}" viewBox="-14 -22 128 146" aria-hidden="true">
    <ellipse cx="50" cy="110" rx="30" ry="6" fill="#000" opacity=".12"/>
    <g class="egg"><path d="M50 14 C24 14 14 52 14 72 C14 96 30 108 50 108 C70 108 86 96 86 72 C86 52 76 14 50 14Z" fill="#fffaf0" stroke="#e5d9bf" stroke-width="2.5"/>
    <circle cx="34" cy="44" r="7" fill="var(--primary)" opacity=".55"/><circle cx="66" cy="34" r="5" fill="var(--accent)" opacity=".7"/><circle cx="70" cy="86" r="8" fill="var(--primary)" opacity=".45"/><circle cx="28" cy="88" r="5" fill="var(--accent)" opacity=".6"/>
    <path d="M18 64 L30 58 L38 66 L48 57 L58 66 L67 57 L76 65 L83 60" stroke="#c9b48a" stroke-width="2.5" fill="none" stroke-linejoin="round"/>
    <ellipse cx="40" cy="74" rx="4.5" ry="5.5" fill="#1f2937"/><ellipse cx="60" cy="74" rx="4.5" ry="5.5" fill="#1f2937"/><circle cx="41.5" cy="72" r="1.6" fill="#fff"/><circle cx="61.5" cy="72" r="1.6" fill="#fff"/>
    <path d="M45 84 Q50 88 55 84" stroke="#1f2937" stroke-width="2.5" fill="none" stroke-linecap="round"/></g></svg>`;
  const gold = stage === 6 || stage === 7, galaxy = stage === 8;
  const body = galaxy ? `url(#${u}g)` : gold ? "#f5b301" : "var(--primary)";
  const dark = galaxy ? "#3b2a8f" : gold ? "#b7791f" : "var(--primary-d)";
  const capeCol = stage >= 7 ? "#7c3aed" : "#ef4444", capeDk = stage >= 7 ? "#5b21b6" : "#b91c1c";
  const sc = stage === 1 ? .8 : 1;
  const head = stage >= 7
    ? `<path d="M30 36 L33 16 L42 28 L50 10 L58 28 L67 16 L70 36 Z" fill="#facc15" stroke="#a16207" stroke-width="2" stroke-linejoin="round"/><circle cx="50" cy="26" r="3.4" fill="#ef4444"/><circle cx="38" cy="30" r="2.4" fill="#3b82f6"/><circle cx="62" cy="30" r="2.4" fill="#22c55e"/>`
    : stage >= 5
      ? `<path d="M26 38 Q50 30 74 38 L56 -4 Q52 -10 48 -6 Z" fill="#6d28d9" stroke="#4c1d95" stroke-width="2" stroke-linejoin="round"/><ellipse cx="50" cy="38" rx="28" ry="5" fill="#5b21b6"/><path d="M50 6l2 4.4 4.8.5-3.6 3.2 1 4.7L50 16.4l-4.3 2.4 1-4.7-3.6-3.2 4.8-.5z" fill="#fde047"/><circle cx="60" cy="24" r="2" fill="#fde047"/><circle cx="40" cy="28" r="1.6" fill="#fde047"/>`
      : stage === 1
        ? `<path d="M28 40 Q30 20 50 18 Q70 20 72 40 L66 34 L60 41 L54 33 L48 41 L42 33 L36 41 Z" fill="#fffaf0" stroke="#e5d9bf" stroke-width="2" stroke-linejoin="round"/><circle cx="40" cy="28" r="3.5" fill="var(--accent)" opacity=".7"/><circle cx="60" cy="25" r="2.6" fill="var(--primary-d)" opacity=".45"/>`
        : `<path d="M50 30 L50 20" stroke="${dark}" stroke-width="3" stroke-linecap="round"/><path class="spark" d="M50 3l3.6 7.6 8.3.9-6.2 5.6 1.8 8.2L50 21.1l-7.5 4.2 1.8-8.2-6.2-5.6 8.3-.9z" fill="var(--accent)" stroke="var(--accent-d)" stroke-width="1.5"/>`;
  return `<svg class="sparky s${stage} ${cls}" viewBox="-14 -22 128 146" aria-hidden="true">
    <defs><radialGradient id="${u}g" cx=".35" cy=".3"><stop offset="0" stop-color="#a78bfa"/><stop offset=".6" stop-color="#6d28d9"/><stop offset="1" stop-color="#312e81"/></radialGradient>
      <linearGradient id="${u}r" x1="0" x2="1"><stop offset="0" stop-color="#f87171"/><stop offset=".25" stop-color="#facc15"/><stop offset=".5" stop-color="#4ade80"/><stop offset=".75" stop-color="#60a5fa"/><stop offset="1" stop-color="#c084fc"/></linearGradient></defs>
    ${galaxy ? `<circle class="aura" cx="50" cy="66" r="58" fill="none" stroke="url(#${u}r)" stroke-width="5" stroke-dasharray="10 7" opacity=".9"/>` : ""}
    <ellipse cx="50" cy="112" rx="${30 * sc}" ry="5" fill="#000" opacity=".12"/>
    <g transform="translate(50 80) scale(${sc}) translate(-50 -80)">
    ${galaxy ? `<path d="M18 58 Q-10 30 -6 70 Q4 66 14 74Z" fill="#bae6fd" stroke="#38bdf8" stroke-width="2"/><path d="M82 58 Q110 30 106 70 Q96 66 86 74Z" fill="#bae6fd" stroke="#38bdf8" stroke-width="2"/>` : ""}
    ${stage >= 3 ? `<path d="M26 46 Q10 90 16 108 Q50 98 84 108 Q90 90 74 46 Z" fill="${capeCol}" stroke="${capeDk}" stroke-width="2"/>` : ""}
    ${stage >= 4
      ? `<g class="boots"><path d="M22 100 h22 v8 q0 4 -4 4 h-18 z" fill="#f97316" stroke="#c2410c" stroke-width="1.5"/><path d="M56 100 h22 v12 h-18 q-4 0 -4 -4 z" fill="#f97316" stroke="#c2410c" stroke-width="1.5"/><path class="flame" d="M26 112 q4 9 8 0 q4 9 8 0" fill="#fde047"/><path class="flame" d="M58 112 q4 9 8 0 q4 9 8 0" fill="#fde047"/></g>`
      : `<ellipse cx="34" cy="106" rx="11" ry="5" fill="${dark}"/><ellipse cx="66" cy="106" rx="11" ry="5" fill="${dark}"/>`}
    <path d="M14 72 Q2 64 6 54" stroke="${body}" stroke-width="8" stroke-linecap="round" fill="none"/>
    <path d="M86 72 Q98 64 94 54" stroke="${body}" stroke-width="8" stroke-linecap="round" fill="none"/>
    ${stage === 5 || stage === 6 ? `<path d="M96 54 L104 28" stroke="#78350f" stroke-width="3.5" stroke-linecap="round"/><path class="spark" d="M104 16l2.6 5.4 6 .7-4.4 4 1.3 5.9-5.5-3-5.4 3 1.3-5.9-4.4-4 5.9-.7z" fill="#fde047" stroke="#ca8a04" stroke-width="1"/>` : ""}
    <ellipse cx="50" cy="68" rx="38" ry="38" fill="${body}" ${gold ? `stroke="#b7791f" stroke-width="2"` : ""}/>
    ${galaxy ? `<circle cx="30" cy="84" r="1.6" fill="#fff"/><circle cx="70" cy="90" r="1.3" fill="#fff"/><circle cx="76" cy="48" r="1.5" fill="#fff"/><circle cx="24" cy="50" r="1.2" fill="#fff"/><circle cx="58" cy="96" r="1" fill="#fff"/>` : ""}
    <ellipse cx="50" cy="80" rx="24" ry="20" fill="#fff" opacity="${gold ? .35 : .28}"/>
    ${stage >= 3 && stage < 7 ? `<circle cx="50" cy="94" r="6" fill="#facc15" stroke="#a16207" stroke-width="1.5"/><text x="50" y="97.5" font-size="8" text-anchor="middle" fill="#7c2d12" font-weight="900">★</text>` : ""}
    <ellipse cx="36" cy="60" rx="9" ry="11" fill="#fff"/><ellipse cx="64" cy="60" rx="9" ry="11" fill="#fff"/>
    <circle cx="38" cy="62" r="5" fill="#1f2937"/><circle cx="66" cy="62" r="5" fill="#1f2937"/>
    <circle cx="40" cy="59.5" r="1.8" fill="#fff"/><circle cx="68" cy="59.5" r="1.8" fill="#fff"/>
    <circle cx="24" cy="76" r="6" fill="#ff8fb1" opacity=".7"/><circle cx="76" cy="76" r="6" fill="#ff8fb1" opacity=".7"/>
    <path d="M39 78 Q50 89 61 78" stroke="#1f2937" stroke-width="4" fill="none" stroke-linecap="round"/>
    ${head}
    </g>
    ${galaxy ? `<text class="twk" x="-6" y="10" font-size="12">✨</text><text class="twk t2" x="92" y="2" font-size="11">⭐</text><text class="twk t3" x="96" y="104" font-size="10">✨</text>` : ""}
  </svg>`;
}

const J = { loaded: false, ok: false, cfg: null, board: [], me: [], lb: "class", busy: false, at: 0 };
function journeyList() {
  const all = MISSIONS(), cfg = J.cfg || {}, order = Array.isArray(cfg.order) ? cfg.order : [], state = cfg.state || {};
  const byId = new Map(all.map(m => [m.id, m]));
  const seq = [...order.filter(id => byId.has(id)), ...all.map(m => m.id).filter(id => !order.includes(id))];
  return seq.map(id => ({ ...byId.get(id), state: state[id] || "open" })).filter(m => m.state !== "hidden");
}
function loadJourney(quiet) {
  const url = TRACK_URL(); if (!url || !S.student || J.busy) { J.loaded = true; if (!quiet && S.view === "journey") render(); return; }
  J.busy = true;
  const cb = "__msj" + Date.now(), sc = document.createElement("script");
  const done = d => { clearTimeout(timer); delete window[cb]; sc.remove(); J.busy = false; J.loaded = true;
    if (d && d.ok) { J.ok = true; J.cfg = d.missions || null; J.board = d.board || []; J.me = d.me || []; J.at = Date.now(); }
    if (S.view === "journey") render(); };
  const timer = setTimeout(() => done(null), 15000);
  window[cb] = d => done(d); sc.onerror = () => done(null);
  sc.src = `${url}?action=journey&name=${encodeURIComponent(S.student.name)}&cls=${encodeURIComponent(S.student.cls)}&callback=${cb}&t=${Date.now()}`;
  document.body.appendChild(sc);
}
setInterval(() => { if (S.view === "journey" && document.visibilityState === "visible" && !$("#modal:not(.hidden)")) loadJourney(true); }, 60000);
function myMission(id) {
  const p = prog(id), srv = J.me.find(r => r.code === id) || {};
  const quiz = Math.max(p.quiz || 0, Number(srv.quizStars) || 0);
  const games = { ...(srv.games || {}) }; Object.entries(p.games || {}).forEach(([k, v]) => { games[k] = Math.max(games[k] || 0, v); });
  const learn = !!(p.learn || srv.learn), practice = Math.max(p.practice || 0, Number(srv.practice) || 0);
  const local = (store.get("jdone", {})[stuId(S.student)] || []).includes(id);
  return { learn, practice, games, quiz, done: quiz >= 1 || local, stars: Math.max(actStars({ learn, practice, quiz, games }), Number(srv.total) || 0) };
}
function journeyGo(m) { tone("whoosh"); setTimeout(() => { location.href = `${m.folder.replace(/[^A-Za-z0-9_-]/g, "")}/`; }, 250); }
function renderJourney(m) {
  $("#nav").classList.add("hidden");
  if (!S.student) { m.innerHTML = `<div class="card result" style="max-width:520px;margin:30px auto"><div style="width:150px;margin:0 auto">${sparkySVG(0)}</div><h2>Your math journey is waiting!</h2></div>`; askName(); return; }
  if (!J.loaded && !J.busy) loadJourney();
  const list = journeyList(), sid = stuId(S.student);
  const info = list.map(x => ({ ...x, my: myMission(x.id) }));
  const doneN = info.filter(x => x.my.done).length, stage = stageFor(doneN);
  const totalStars = info.reduce((a, x) => a + x.my.stars, 0);
  const nextIdx = info.findIndex(x => x.state === "open" && !x.my.done);
  const seenOpen = store.get("seenOpen", {})[sid], fresh = seenOpen ? info.filter(x => x.state === "open" && !seenOpen.includes(x.id)).map(x => x.id) : [];
  const nextStage = stage < MAX_STAGE ? EVO[stage + 1] : null;
  const evoBar = nextStage ? `<div class="evo-next"><div class="ghost">${sparkySVG(stage + 1)}</div><div style="flex:1"><div class="small" style="font-weight:900">${bi(`Finish 1 more mission to become ${nextStage.n}!`, `Hoàn thành thêm 1 nhiệm vụ để thành ${nextStage.vi}!`)}</div>
      <div class="evo-dots">${EVO.slice(1).map((_, i) => `<span class="${i < stage ? "on" : ""}"></span>`).join("")}</div></div></div>`
    : `<div class="evo-next"><div class="small" style="font-weight:900">🌌 ${bi("Your Sparky reached its final form. Amazing!", "Sparky đã đạt hình dạng cuối cùng. Tuyệt vời!")}</div></div>`;
  const meRank = (() => { const cl = J.board.filter(b => String(b.cls).toLowerCase() === String(S.student.cls).toLowerCase()); const i = cl.findIndex(b => `${b.name}|${b.cls}`.toLowerCase() === sid); return i < 0 ? null : i + 1; })();
  const top3 = J.board.filter(b => String(b.cls).toLowerCase() === String(S.student.cls).toLowerCase()).slice(0, 3);
  m.innerHTML = `
  <div class="jhero card">
    <div class="jpet" id="jpet">${sparkySVG(stage, "bob")}</div>
    <div class="jinfo">
      <div class="eyebrow">${esc(S.student.cls)} · ${bi("Level", "Cấp", true)} ${stage + 1}</div>
      <h1>${bi(`Hi, ${S.student.name}!`, `Chào ${S.student.name}!`)}</h1>
      <div class="jform">${bi(`Your buddy: ${EVO[stage].n}`, `Bạn đồng hành: ${EVO[stage].vi}`)}</div>
      ${evoBar}
      <div class="jstats"><span>⭐ <b>${totalStars}</b> ${bi("stars", "sao", true)}</span><span>🏁 <b>${doneN}/${info.filter(x => x.state === "open").length}</b> ${bi("missions", "nhiệm vụ", true)}</span>${meRank ? `<span>🏆 <b>#${meRank}</b> ${bi("in your class", "trong lớp", true)}</span>` : ""}</div>
      <div class="row" style="margin-top:12px"><button class="btn btn-primary" id="jBoard">🏆 ${bi("Leaderboard", "Bảng xếp hạng", true)}</button>
        ${nextIdx >= 0 ? `<button class="btn btn-accent" id="jNext">▶ ${bi("Next mission", "Nhiệm vụ tiếp theo", true)}</button>` : ""}</div>
    </div>
    ${top3.length ? `<div class="jtop"><div class="small" style="font-weight:900;margin-bottom:6px">🏆 ${bi("Top in", "Dẫn đầu lớp", true)} ${esc(S.student.cls)}</div>${top3.map((b, i) => `<div class="jtop-row ${`${b.name}|${b.cls}`.toLowerCase() === sid ? "me" : ""}"><span class="md">${["🥇", "🥈", "🥉"][i]}</span><span class="av">${sparkySVG(stageFor(b.done))}</span><b>${esc(b.name)}</b><span class="spacer"></span><span class="st">⭐ ${b.stars}</span></div>`).join("")}</div>` : ""}
  </div>
  ${!J.loaded ? `<div class="card sec rload" style="max-width:420px;margin:0 auto"><div class="spin"></div> ${bi("Loading your map…", "Đang tải bản đồ…", true)}</div>` : `<div class="jmap" id="jmap">
    <svg class="jpath" id="jpath"></svg>
    <div class="jstart">🚩 ${bi("Start", "Bắt đầu", true)}</div>
    ${info.map((x, i) => `<div class="jnode ${x.state === "locked" ? "locked" : x.my.done ? "done" : i === nextIdx ? "next" : "open"} ${fresh.includes(x.id) ? "fresh" : ""}" data-i="${i}" style="--c:${colorFor(x.id)}">
        ${i === nextIdx ? `<div class="jme">${sparkySVG(stage)}</div>` : ""}
        <button class="jbtn" data-m="${i}" aria-label="${esc(x.title)}"><span class="ic">${x.state === "locked" ? "🔒" : esc(x.icon || "🔢")}</span>${x.my.done ? `<span class="ok">✓</span>` : ""}</button>
        <div class="jlab"><div class="small" style="font-weight:900;opacity:.7">${bi("Mission", "Nhiệm vụ", true)} ${i + 1}${fresh.includes(x.id) ? ` <span class="newtag">NEW!</span>` : ""}</div><b>${esc(x.title)}</b>
          <div class="jst">${x.state === "locked" ? `<span class="small">${bi("Coming soon", "Sắp mở", true)}</span>` : [0, 1, 2].map(k => `<span class="${k < x.my.quiz ? "" : "off"}">⭐</span>`).join("")}</div></div>
      </div>`).join("")}
    <div class="jnode castle" data-i="${info.length}"><div class="jbtn" style="cursor:default"><span class="ic">🏰</span></div><div class="jlab"><b>${bi("More missions coming soon!", "Sắp có thêm nhiệm vụ mới!")}</b></div></div>
  </div>
  `}
  ${J.loaded && !info.length ? `<div class="notice">${bi("No missions yet. Ask your teacher!", "Chưa có nhiệm vụ. Hỏi cô/thầy nhé!")}</div>` : ""}`;
  $("#jBoard", m).onclick = () => { tone("tap"); showBoard(); };
  $("#jNext", m)?.addEventListener("click", () => missionSheet(info[nextIdx], nextIdx, stage));
  $$("[data-m]", m).forEach(b => b.onclick = () => { const i = +b.dataset.m, x = info[i];
    if (x.state === "locked") { tone("bad"); toast("🔒 This mission opens soon. Your teacher will unlock it!"); b.closest(".jnode").classList.remove("shake"); void b.offsetWidth; b.closest(".jnode").classList.add("shake"); return; }
    missionSheet(x, i, stage); });
  if (!J.loaded) { $("#jpet", m).onclick = () => tone("pop"); return; }
  drawJourney(info, nextIdx);
  $("#jpet", m).onclick = () => { tone("pop"); const p = $("#jpet .sparky"); p.classList.remove("happy"); void p.offsetWidth; p.classList.add("happy"); speak(`I'm ${EVO[stage].n}!`); };
  // remember what was seen, then celebrate anything new
  const so = store.get("seenOpen", {}); so[sid] = info.filter(x => x.state === "open").map(x => x.id); store.set("seenOpen", so);
  if (fresh.length && seenOpen) setTimeout(() => { tone("unlock"); toast(`🎉 New mission: ${info.find(x => x.id === fresh[0]).title}!`, 3500); }, 600);
  const seenDone = store.get("seenDone", {}), prevDone = seenDone[sid] || [];
  const nowDone = info.filter(x => x.my.done).map(x => x.id), justDone = nowDone.filter(id => !prevDone.includes(id));
  if (!(sid in seenDone) || justDone.length) { seenDone[sid] = [...new Set([...prevDone, ...nowDone])]; store.set("seenDone", seenDone); }
  const evo = store.get("evo", {}), was = evo[sid];
  if (was == null) { evo[sid] = stage; store.set("evo", evo); if (stage === 0 && !$("#modal:not(.hidden)")) setTimeout(() => meetSparky(), 400); }
  else if (stage > was) { evo[sid] = stage; store.set("evo", evo); setTimeout(() => evolveShow(was, stage), 500); }
  else if (justDone.length && prevDone.length + justDone.length > 0 && J.loaded) { const el = $(`.jnode[data-i="${info.findIndex(x => x.id === justDone[0])}"]`); if (el) { el.classList.add("stamp"); tone("win"); } }
}
function drawJourney(info, nextIdx) {
  const map = $("#jmap"); if (!map) return;
  const W = map.clientWidth, narrow = W < 600, nodes = $$(".jnode", map), xs = narrow ? [.17, .38] : [.5, .78, .5, .22], gap = narrow ? 140 : 170, top = 90;
  nodes.forEach((n, i) => { const x = xs[i % xs.length] * W, y = top + i * gap; n.style.left = x + "px"; n.style.top = y + "px"; n.classList.toggle("lab-left", !narrow && xs[i % xs.length] > .6); });
  map.style.setProperty("--sx", xs[0] * 100 + "%");
  map.style.height = (top + (nodes.length - 1) * gap + 150) + "px";
  const pts = nodes.map((_, i) => [xs[i % xs.length] * W, top + i * gap]); pts.unshift([xs[0] * W, 20]);
  const seg = (a, b) => `M${a[0]} ${a[1]} C${a[0]} ${(a[1] + b[1]) / 2} ${b[0]} ${(a[1] + b[1]) / 2} ${b[0]} ${b[1]}`;
  const doneUpTo = info.reduce((a, x, i) => x.my.done ? i + 1 : a, 0);
  const svg = $("#jpath"); svg.setAttribute("width", W); svg.setAttribute("height", map.style.height.replace("px", ""));
  svg.innerHTML = pts.slice(1).map((p, i) => `<path d="${seg(pts[i], p)}" class="${i < doneUpTo ? "on" : ""}"/>`).join("");
  clearTimeout(drawJourney._t);
  window.onresize = () => { clearTimeout(drawJourney._t); drawJourney._t = setTimeout(() => { if (S.view === "journey") drawJourney(info, nextIdx); }, 150); };
}
function missionSheet(x, i, stage) {
  tone("tap");
  const my = x.my, gameN = Object.keys(my.games || {}).length;
  const parts = [["📘", "Learn", "Học", my.learn], ["✏️", "Practice", "Luyện tập", my.practice > 0], ["🎮", "Play a game", "Chơi trò chơi", gameN > 0], ["🏆", "Pass the Quiz", "Vượt qua bài kiểm tra", my.quiz >= 1]];
  modal(`<div style="text-align:center"><div class="msheet-ic" style="--c:${colorFor(x.id)}">${esc(x.icon || "🔢")}</div>
      <div class="eyebrow">${bi("Mission", "Nhiệm vụ", true)} ${i + 1}</div><h3 style="font-size:26px;margin:4px 0">${esc(x.title)}</h3>${x.topic ? `<span class="tag sun">${esc(x.topic)}</span>` : ""}</div>
    <div class="mparts">${parts.map(([ic, en, vi, ok]) => `<div class="${ok ? "on" : ""}"><span>${ok ? "✅" : ic}</span>${bi(en, vi, true)}</div>`).join("")}</div>
    <p class="small" style="text-align:center;font-weight:800;margin:4px 0 12px">${my.done ? "🎉 " + bi("Mission complete! Play again to win more stars.", "Đã hoàn thành! Chơi lại để có thêm sao.", true) : bi("Pass the Quiz to complete this mission and help Sparky grow!", "Vượt qua bài kiểm tra để hoàn thành nhiệm vụ và giúp Sparky lớn lên!", true)}</p>
    <button class="btn btn-primary btn-lg" id="mGo" style="width:100%">${my.done ? "↻ " + bi("Play again", "Chơi lại", true) : "▶ " + bi("Start mission", "Bắt đầu nhiệm vụ", true)}</button>`, (mm, close) => {
    $("#mGo", mm).onclick = () => { close(); journeyGo(x); };
  });
}
function meetSparky() {
  modal(`<div style="text-align:center"><div style="width:170px;margin:0 auto">${sparkySVG(0, "wiggle")}</div><h3 style="font-size:26px">${bi("Meet your Sparky Egg!", "Đây là trứng Sparky của em!")}</h3>
    <p style="font-weight:800">${bi("Finish missions to help it hatch and grow into something amazing.", "Hoàn thành nhiệm vụ để trứng nở và lớn lên thật tuyệt vời.")}</p>
    <button class="btn btn-primary btn-lg" id="meetOk">${bi("Let's go!", "Bắt đầu thôi!", true)} 🚀</button></div>`, (mm, close) => { tone("pop"); $("#meetOk", mm).onclick = () => { tone("whoosh"); close(); }; });
}
function evolveShow(from, to) {
  modal(`<div class="evo-show"><div class="evo-title">${bi("Something is happening…", "Có điều gì đó đang xảy ra…")}</div>
    <div class="evo-stage" id="evoStage"><div class="evo-pet shaking">${sparkySVG(from)}</div><div class="evo-flash"></div></div>
    <div id="evoText" style="min-height:90px"></div></div>`, (mm, close) => {
    tone("charge");
    setTimeout(() => {
      const st = $("#evoStage", mm); if (!st) return;
      st.classList.add("flash");
      setTimeout(() => { if (!$("#evoStage", mm)) return;
        st.querySelector(".evo-pet").outerHTML = `<div class="evo-pet popin">${sparkySVG(to, "bob")}</div>`;
        tone("evolve"); confetti();
        $(".evo-title", mm).innerHTML = "🎉 " + bi("WOW! Sparky evolved!", "WOW! Sparky đã tiến hóa!");
        $("#evoText", mm).innerHTML = `<h3 style="font-size:28px;margin:6px 0">${bi(`${EVO[to].n}!`, `${EVO[to].vi}!`)}</h3><button class="btn btn-primary btn-lg" id="evoOk">${bi("Awesome!", "Tuyệt quá!", true)} ✨</button>`;
        speak(`Wow! Your Sparky evolved into ${EVO[to].n}!`);
        $("#evoOk", mm).onclick = () => { tone("tap"); close(); };
      }, 450);
    }, 1900);
  });
}
function showBoard() {
  const sid = stuId(S.student), myCls = String(S.student.cls).toLowerCase();
  const draw = mm => {
    const box = $("#lbBox", mm); if (!box) return;
    const rows = J.lb === "class" ? J.board.filter(b => String(b.cls).toLowerCase() === myCls) : J.board;
    $$("[data-lb]", mm).forEach(b => b.classList.toggle("on", b.dataset.lb === J.lb));
    if (!TRACK_URL() || (!J.ok && J.loaded)) { box.innerHTML = `<div class="notice">${bi("The leaderboard isn't ready yet. Ask your teacher.", "Bảng xếp hạng chưa sẵn sàng. Hỏi cô/thầy nhé.")}</div>`; return; }
    if (!rows.length) { box.innerHTML = `<div class="notice">${bi("No one is on the board yet. Finish a mission to be first!", "Chưa có ai. Hoàn thành nhiệm vụ để là người đầu tiên!")}</div>`; return; }
    const mi = rows.findIndex(b => `${b.name}|${b.cls}`.toLowerCase() === sid);
    const row = (b, i) => `<div class="lbrow ${i === mi ? "me" : ""} ${i < 3 ? "top" : ""}"><span class="rk">${i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</span><span class="av">${sparkySVG(stageFor(b.done))}</span>
      <div style="flex:1;min-width:0"><b>${esc(b.name)}</b>${i === mi ? ` <span class="tag">${bi("You", "Em", true)}</span>` : ""}<div class="small">${J.lb === "all" ? esc(b.cls) + " · " : ""}${EVO[stageFor(b.done)].n}</div></div>
      <span class="lbs">🏁 ${b.done}</span><span class="lbs st">⭐ ${b.stars}</span></div>`;
    box.innerHTML = rows.slice(0, 10).map(row).join("") + (mi >= 10 ? `<div class="lbgap">⋯</div>${row(rows[mi], mi)}` : "");
  };
  modal(`<div style="text-align:center"><div style="font-size:50px">🏆</div><h3 style="font-size:28px;margin:0">${bi("Leaderboard", "Bảng xếp hạng", true)}</h3></div>
    <div class="lbtabs"><button data-lb="class">${bi("My class", "Lớp của em", true)}</button><button data-lb="all">${bi("Everyone", "Tất cả", true)}</button></div>
    <div id="lbBox"><div class="muted" style="text-align:center;padding:20px">…</div></div>
    <div class="small muted" style="text-align:center;margin-top:8px;font-weight:700">${bi("Win stars in Learn, Practice, Games and the Quiz to climb up!", "Nhận sao ở Học, Luyện tập, Trò chơi và Kiểm tra để leo hạng!", true)}</div>
    <button class="btn btn-primary" id="lbOk" style="width:100%;margin-top:12px">OK</button>`, (mm, close) => {
    tone("whoosh"); draw(mm);
    $$("[data-lb]", mm).forEach(b => b.onclick = () => { tone("tap"); J.lb = b.dataset.lb; draw(mm); });
    $("#lbOk", mm).onclick = () => close();
    const prev = J.at; loadJourney(true); const t = setInterval(() => { if (!$("#lbBox", mm)) return clearInterval(t); if (J.at !== prev || !J.busy) { draw(mm); if (!J.busy) clearInterval(t); } }, 400);
  });
}
function markMissionDone(id) {
  if (!S.student) return; const all = store.get("jdone", {}), k = stuId(S.student);
  all[k] = [...new Set([...(all[k] || []), id])]; store.set("jdone", all);
}

/* ---- teacher: choose which missions are open ---- */
const MS = { draft: null, saving: false, msg: "" };
function renderMissionsTab(box, D) {
  const all = MISSIONS();
  if (!all.length) { box.innerHTML = `<div class="notice">No missions found. Upload <b>missions.js</b> to your website (see the Share page in MathSpark).</div>`; return; }
  if (!MS.draft) { const cfg = D.missions || {}, order = Array.isArray(cfg.order) ? cfg.order : [];
    const ids = [...order.filter(id => all.some(m => m.id === id)), ...all.map(m => m.id).filter(id => !order.includes(id))];
    MS.draft = { order: ids, state: Object.fromEntries(ids.map(id => [id, (cfg.state || {})[id] || "open"])) }; }
  const byId = new Map(all.map(m => [m.id, m])), dr = MS.draft;
  const ST = [["open", "🟢 Open"], ["locked", "🔒 Coming soon"], ["hidden", "🙈 Hidden"]];
  box.innerHTML = `<div class="card sec"><h2 style="margin-bottom:4px">🗺️ Student missions</h2>
    <p class="muted" style="margin-top:0;font-weight:700">Students open <a href="${SITE_URL}" target="_blank" rel="noopener">${SITE_URL}</a> and see these missions as one journey, in this order.<br>
    <b>Open</b> = students can play it. <b>Coming soon</b> = they see it locked. <b>Hidden</b> = not on their map.</p>
    <div class="mlist">${dr.order.map((id, i) => { const m = byId.get(id); return `<div class="mrow st-${dr.state[id]}"><span class="mnum">${i + 1}</span><span class="mic">${esc(m.icon || "🔢")}</span><b style="flex:1;min-width:140px">${esc(m.title)}</b>
      <div class="seg">${ST.map(([k, l]) => `<button class="${dr.state[id] === k ? "on st-" + k : ""}" data-st="${esc(id)}" data-v="${k}">${l}</button>`).join("")}</div>
      <button class="btn btn-ghost btn-sm" data-up="${i}" ${i ? "" : "disabled"} title="Move up">▲</button><button class="btn btn-ghost btn-sm" data-dn="${i}" ${i < dr.order.length - 1 ? "" : "disabled"} title="Move down">▼</button></div>`; }).join("")}</div>
    <div class="row" style="margin-top:14px"><button class="btn btn-primary" id="mSave" ${MS.saving ? "disabled" : ""}>${MS.saving ? "Saving…" : "💾 Save missions"}</button><span class="small" style="font-weight:800">${esc(MS.msg)}</span></div></div>`;
  $$("[data-st]", box).forEach(b => b.onclick = () => { dr.state[b.dataset.st] = b.dataset.v; MS.msg = "Not saved yet"; renderMissionsTab(box, D); });
  $$("[data-up]", box).forEach(b => b.onclick = () => { const i = +b.dataset.up; [dr.order[i - 1], dr.order[i]] = [dr.order[i], dr.order[i - 1]]; MS.msg = "Not saved yet"; renderMissionsTab(box, D); });
  $$("[data-dn]", box).forEach(b => b.onclick = () => { const i = +b.dataset.dn; [dr.order[i + 1], dr.order[i]] = [dr.order[i], dr.order[i + 1]]; MS.msg = "Not saved yet"; renderMissionsTab(box, D); });
  $("#mSave", box).onclick = () => {
    const url = TRACK_URL(), key = store.get("tkey", ""); if (!url || !key) return;
    MS.saving = true; MS.msg = ""; renderMissionsTab(box, D);
    fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "missions", key, order: dr.order, state: dr.state }) })
      .then(() => new Promise(r => setTimeout(r, 1500)))
      .then(() => { MS.saving = false; MS.msg = ""; RS.after = () => {
          const c = RS.data && RS.data.missions, same = c && JSON.stringify(c.order) === JSON.stringify(dr.order) && Object.keys(dr.state).every(id => c.state && c.state[id] === dr.state[id]);
          MS.msg = same ? "✅ Saved! Students will see it next time they open the journey." : RS.data && !("missions" in RS.data) ? "⚠️ Update your Google script first (see step 1 in the instructions)." : "⚠️ It didn't save. Try again.";
          if (same) tone("win"); };
        loadResults(key, true); })
      .catch(() => { MS.saving = false; MS.msg = "⚠️ Couldn't save. Check your internet."; renderMissionsTab(box, D); });
  };
}

/* ===================== results page (website, #results) ===================== */
const RS = { data: null, loading: false, err: "", cls: "", act: "", q: "", sort: "last", dir: -1, open: {}, tab: location.hash === "#missions" ? "missions" : "results" };
function loadResults(key, quiet) {
  const url = TRACK_URL(); if (!url || !key) return;
  RS.loading = true; if (!quiet) { RS.err = ""; render(); }
  const cb = "__msres" + Date.now(), sc = document.createElement("script");
  const done = (data, err) => { clearTimeout(timer); delete window[cb]; sc.remove(); RS.loading = false;
    if (data && data.ok) { RS.data = data; RS.err = ""; store.set("tkey", key); }
    else if (data && data.error === "key") { RS.err = "That teacher key is not right. Check it and try again."; RS.data = null; store.set("tkey", ""); }
    else if (!quiet || !RS.data) RS.err = err || "Couldn't load the results.";
    if (RS.after) { const f = RS.after; RS.after = null; f(); }
    if (S.view === "results") render(); };
  const timer = setTimeout(() => done(null, "The results took too long to load. Check your internet and press Refresh."), 25000);
  window[cb] = d => done(d);
  sc.onerror = () => done(null, "Couldn't reach the results. Check your internet and press Refresh.");
  sc.src = `${url}?action=results&key=${encodeURIComponent(key)}&callback=${cb}&t=${Date.now()}`;
  document.body.appendChild(sc);
}
setInterval(() => { if (S.view === "results" && RS.data && document.visibilityState === "visible" && !RS.loading) loadResults(store.get("tkey", ""), true); }, 60000);
const fmtTime = iso => { if (!iso) return ""; const d = new Date(iso); return isNaN(d) ? "" : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
const ago = iso => { const t = Date.parse(iso); if (!t) return ""; const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "just now"; if (m < 60) return m + " min ago"; const h = Math.round(m / 60); if (h < 24) return h + " h ago"; const d = Math.round(h / 24); return d === 1 ? "yesterday" : d + " days ago"; };
const GAME_ICON = { "Two Circles": "⭕", "Build the Model": "🍒", "Balloon Pop": "🎈", "Memory Match": "🃏", "Sort It!": "🧺", "Beat the Clock": "⏱️" };
const stuKey = r => `${r.name}|${r.cls}|${r.code}`.toLowerCase();
function resHero(sub) {
  return `<div class="rhero card"><div><div class="eyebrow">Teacher only</div><h1>Class results</h1><p>${sub}</p></div>
    <div class="rhero-art" aria-hidden="true"><span class="a1">📚</span><span class="a2">🏆</span><span class="a3">⭐</span><span class="a4">✨</span><span class="a5">🏅</span><span class="a6">🧮</span></div></div>`;
}
function deleteResults(items, label) {
  const url = TRACK_URL(), key = store.get("tkey", ""); if (!url || !key) return;
  toast("Deleting…");
  const gone = () => !(RS.data.students || []).some(s => items.some(it => `${s.name}|${s.cls}`.toLowerCase() === `${it.name}|${it.cls}`.toLowerCase() && (!it.code || it.code === s.code)));
  fetch(url, { method: "POST", mode: "no-cors", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action: "delete", key, items }) })
    .then(() => new Promise(r => setTimeout(r, 1500)))
    .then(() => { RS.after = () => { if (!RS.data) return; if (gone()) { tone("good"); toast(`Deleted ${label}'s results.`); } else toast("⚠️ It didn't delete. Update your Google script to the newest version, then try again.", 6000); }; loadResults(key, true); })
    .catch(() => toast("⚠️ Couldn't delete. Check your internet."));
}
function renderResults(m) {
  $("#starCount").classList.add("hidden"); $("#whoBtn").classList.add("hidden");
  const url = TRACK_URL(), key = store.get("tkey", "");
  const SUB = "Who has done each MathSpark activity, and how well.";
  if (!url) { m.innerHTML = resHero(SUB) + `<div class="notice">Result saving isn't switched on yet. Add your tracking link to <b>trackUrl</b> in <b>config.js</b>.</div>`; return; }
  if (!RS.data && !(key && RS.loading)) {
    m.innerHTML = resHero(SUB) + `<form class="card sec rkey" id="kform"><div style="font-size:54px">🔑</div><h2>Type your teacher key</h2>
      <p class="muted" style="font-weight:700">It's at the top of your tracking script.</p>
      ${RS.err ? `<div class="notice err">${esc(RS.err)}</div>` : ""}
      <input type="password" id="tkey" placeholder="MS-XXXXXX" autocomplete="current-password" spellcheck="false">
      <button class="btn btn-primary btn-lg" type="submit">✔ Show results</button>
      <p class="small muted">This device will remember the key. Only use it on your own phone or computer.</p></form>`;
    $("#kform", m).onsubmit = e => { e.preventDefault(); const k = $("#tkey", m).value.trim().toUpperCase(); if (k) loadResults(k); };
    if (key && !RS.err && !RS.tried) { RS.tried = true; loadResults(key); }
    return;
  }
  if (!RS.data) { m.innerHTML = resHero(SUB) + `<div class="card sec rload"><div class="spin"></div> Loading results…</div>`; return; }
  const D = RS.data, all = (D.students || []).map(r => {
    const steps = [!!r.learn, !!r.practice, Object.keys(r.games || {}).length > 0, r.quizPct !== "" && r.quizPct != null];
    return { ...r, steps, done: steps.filter(Boolean).length };
  });
  const acts = [...new Map(all.map(s => [s.code, s.title])).entries()];
  const classes = [...new Set(all.map(s => String(s.cls || "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  m.innerHTML = resHero(SUB) + `
    <div class="rtabs big"><button class="${RS.tab === "results" ? "on" : ""}" data-rtab="results">📊 Results</button><button class="${RS.tab === "missions" ? "on" : ""}" data-rtab="missions">🗺️ Missions</button></div>
    <div id="mBox" ${RS.tab === "missions" ? "" : "hidden"}></div><div id="rBox" ${RS.tab === "results" ? "" : "hidden"}>
    <div class="rbar"><button class="btn btn-primary btn-sm" id="rRefresh" ${RS.loading ? "disabled" : ""}>🔄 ${RS.loading ? "Loading…" : "Refresh"}</button>
      <button class="btn btn-ghost btn-sm" id="rCsv">⬇ Download CSV</button>
      <button class="linkbtn" id="rOut">Sign out</button>
      <span class="small rupd">Updated ${esc(fmtTime(D.now))} · refreshes every minute</span></div>
    ${RS.err ? `<div class="notice err">${esc(RS.err)}</div>` : ""}
    <div class="rfilters">
      <label>Activity<select id="rAct"><option value="">All activities</option>${acts.map(([c, t]) => `<option value="${esc(c)}" ${c === RS.act ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>
      <label>Class<select id="rCls"><option value="">All classes</option>${classes.map(c => `<option ${c === RS.cls ? "selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
      <label>Student<input type="text" id="rQ" value="${esc(RS.q)}" placeholder="Search a student"></label></div>
    <div class="rstats" id="rStats"></div><div id="rGroups"></div></div>`;
  $$("[data-rtab]", m).forEach(b => b.onclick = () => { RS.tab = b.dataset.rtab; history.replaceState(null, "", RS.tab === "missions" ? "#missions" : "#results"); render(); });
  if (RS.tab === "missions") { renderMissionsTab($("#mBox", m), D); return; }
  $("#rRefresh", m).onclick = () => loadResults(store.get("tkey", ""));
  $("#rOut", m).onclick = () => { store.set("tkey", ""); RS.data = null; RS.err = ""; RS.tried = true; render(); };
  $("#rAct", m).onchange = e => { RS.act = e.target.value; paint(); };
  $("#rCls", m).onchange = e => { RS.cls = e.target.value; paint(); };
  $("#rQ", m).oninput = e => { RS.q = e.target.value; paint(); };
  const rowsNow = () => { const q = RS.q.trim().toLowerCase();
    return all.filter(s => (!RS.cls || String(s.cls) === RS.cls) && (!RS.act || s.code === RS.act) && (!q || String(s.name).toLowerCase().includes(q))); };
  $("#rCsv", m).onclick = () => {
    const head = ["Student", "Class", "Activity", "Learn", "Practice stars", "Games", "Quiz %", "Quiz stars", "Total stars", "First seen", "Last active"];
    const cell = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [head, ...rowsNow().map(s => [s.name, s.cls, s.title, s.learn ? "Yes" : "", s.practice || "", Object.entries(s.games || {}).map(([k, v]) => `${k} (${v})`).join("; "), s.quizPct ?? "", s.quizStars || "", s.total || 0, fmtTime(s.first), fmtTime(s.last)])].map(r => r.map(cell).join(",")).join("\r\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })); a.download = "mathspark-results.csv"; document.body.appendChild(a); a.click(); a.remove();
  };
  const chip = (txt, lvl) => `<span class="rchip ${lvl || ""}">${txt}</span>`;
  const pctLvl = p => p >= 80 ? "good" : p >= 50 ? "" : "low";
  function paint() {
    const rows = rowsNow();
    const people = new Set(rows.map(r => `${r.name}|${r.cls}`.toLowerCase())).size;
    const fin = rows.filter(r => r.done === 4).length, qz = rows.filter(r => r.steps[3]);
    const avgQ = qz.length ? Math.round(qz.reduce((a, r) => a + Number(r.quizPct), 0) / qz.length) : null;
    $("#rStats").innerHTML = [["🧑‍🎓", people, "students"], ["✅", fin, "finished everything"], ["🏆", qz.length, "quizzes done"], ["⭐", avgQ == null ? "–" : avgQ + "%", "average quiz score"]]
      .map(([i, n, l]) => `<div class="rstat card"><span class="ri">${i}</span><div><b>${n}</b><div class="small">${l}</div></div></div>`).join("");
    const G = $("#rGroups");
    if (!all.length) { G.innerHTML = `<div class="notice">No results yet. When students play an activity, they'll show up here.</div>`; return; }
    if (!rows.length) { G.innerHTML = `<div class="notice">No students match these filters.</div>`; return; }
    const val = (r, k) => k === "name" ? String(r.name).toLowerCase() : k === "progress" ? r.done : k === "stars" ? Number(r.total) || 0 : k === "quiz" ? (r.steps[3] ? Number(r.quizPct) : -1) : Date.parse(r.last) || 0;
    const th = (label, k) => `<th><button class="sortbtn ${RS.sort === k ? "on" : ""}" data-sort="${k}">${label}${RS.sort === k ? (RS.dir > 0 ? " ▲" : " ▼") : ""}</button></th>`;
    const STEP = ["📘 Learn", "✏️ Practice", "🎮 Game", "🏆 Quiz"];
    const table = list => `<div class="rtable"><table><thead><tr>${th("Student", "name")}${th("Progress", "progress")}${th("Stars", "stars")}${th("Quiz score", "quiz")}<th>Games</th>${th("Last active", "last")}</tr></thead><tbody>${
      list.slice().sort((a, b) => { const x = val(a, RS.sort), y = val(b, RS.sort); return (x > y ? 1 : x < y ? -1 : 0) * RS.dir; }).map(r => {
        const id = stuKey(r), open = RS.open[id];
        const games = Object.entries(r.games || {});
        let det = "";
        if (open) {
          const evs = (D.events || []).filter(e => stuKey(e) === id).sort((a, b) => (Date.parse(b.time) || 0) - (Date.parse(a.time) || 0)).slice(0, 40);
          det = `<tr class="rdetail"><td colspan="6"><div class="rdel"><button class="btn btn-ghost btn-sm" data-del1="${esc(id)}">🗑 Delete this result</button><button class="btn btn-ghost btn-sm" data-delall="${esc(id)}">🗑 Delete all of ${esc(r.name)}'s results</button></div><div class="rsteps">${STEP.map((l, i) => `<span class="${r.steps[i] ? "on" : ""}">${r.steps[i] ? "✔" : "○"} ${l}</span>`).join("")}</div>${evs.length ? `<ul class="tl">${evs.map(e => `<li><span class="small">${esc(fmtTime(e.time))}</span> ${esc(e.what)}${e.task && e.task !== "Started" && e.task !== "Learn" && e.task !== "Practice" && e.task !== "Quiz" ? " · " + esc(e.task) : ""}${e.score ? " · " + esc(e.score) : ""}${Number(e.stars) ? " · " + "★".repeat(Math.min(3, Number(e.stars))) : ""}</li>`).join("")}</ul>` : `<div class="small muted">No details yet.</div>`}</td></tr>`;
        }
        return `<tr class="rrow ${open ? "open" : ""}" data-id="${esc(id)}" tabindex="0"><td><b>${esc(r.name)}</b> <span class="caret">${open ? "▴" : "▾"}</span></td>
          <td><div class="pbar"><i style="width:${r.done * 25}%"></i></div><span class="small muted">${r.done} / 4 parts</span></td>
          <td>${chip("★ " + (r.total || 0), r.total >= 8 ? "good" : r.total >= 3 ? "" : "low")}</td>
          <td>${r.steps[3] ? chip(r.quizPct + "%", pctLvl(r.quizPct)) : `<span class="muted">–</span>`}</td>
          <td class="gicons">${games.length ? games.map(([k, v]) => `<span title="${esc(k)}: ${v} ★">${GAME_ICON[k] || "🎮"}</span>`).join("") : `<span class="muted">–</span>`}</td>
          <td class="small" title="${esc(fmtTime(r.last))}">${esc(ago(r.last))}</td></tr>${det}`;
      }).join("")}</tbody></table></div>`;
    const byClass = {}; rows.forEach(r => { const c = String(r.cls || "").trim() || "—"; (byClass[c] = byClass[c] || []).push(r); });
    G.innerHTML = Object.keys(byClass).sort((a, b) => a === "—" ? 1 : b === "—" ? -1 : a.localeCompare(b, undefined, { numeric: true })).map(c => {
      const list = byClass[c], closed = RS.open["cls:" + c] === false;
      const byAct = {}; list.forEach(r => (byAct[r.code] = byAct[r.code] || { title: r.title, rows: [] }).rows.push(r));
      const codes = Object.keys(byAct).sort((a, b) => Math.max(...byAct[b].rows.map(r => Date.parse(r.last) || 0)) - Math.max(...byAct[a].rows.map(r => Date.parse(r.last) || 0)));
      const nStu = new Set(list.map(r => String(r.name).toLowerCase())).size;
      return `<section class="rclass"><button class="rclass-head" data-cls="${esc(c)}"><span class="cbadge">${esc(c.slice(0, 4))}</span><h2>Class ${esc(c)}</h2><span class="spacer"></span>
          <span class="small">${nStu} student${nStu === 1 ? "" : "s"} · ${codes.length} activit${codes.length === 1 ? "y" : "ies"}</span><span class="caret">${closed ? "▸" : "▾"}</span></button>
        ${closed ? "" : codes.map(code => { const g = byAct[code], rs = g.rows, q = rs.filter(r => r.steps[3]);
          const av = q.length ? Math.round(q.reduce((a, r) => a + Number(r.quizPct), 0) / q.length) : null;
          return `<div class="ract card"><div class="ract-head"><div><div class="eyebrow">Activity</div><h3>${esc(g.title)}</h3></div><span class="spacer"></span>
            ${chip(rs.length + " student" + (rs.length === 1 ? "" : "s"))}${chip(rs.filter(r => r.done === 4).length + " finished", "good")}${chip(q.length + " did the quiz")}${av != null ? chip("Quiz avg " + av + "%", pctLvl(av)) : ""}</div>${table(rs)}</div>`; }).join("")}</section>`;
    }).join("");
    $$("[data-sort]", G).forEach(b => b.onclick = () => { const k = b.dataset.sort; if (RS.sort === k) RS.dir = -RS.dir; else { RS.sort = k; RS.dir = k === "name" ? 1 : -1; } paint(); });
    const byId = id => all.find(r => stuKey(r) === id);
    $$("[data-del1],[data-delall]", G).forEach(b => b.onclick = async ev => {
      ev.stopPropagation(); const r = byId(b.dataset.del1 || b.dataset.delall); if (!r) return; const one = !!b.dataset.del1;
      const ok = await askConfirm(one ? `Delete ${r.name}'s result?` : `Delete all of ${r.name}'s results?`,
        one ? `${r.name} (${r.cls}) will be removed from "${r.title}" and from the leaderboard. This can't be undone.` : `Every result for ${r.name} (${r.cls}), in every activity, will be removed, including the leaderboard. This can't be undone.`, "Delete");
      if (!ok) return;
      deleteResults([{ name: r.name, cls: r.cls, code: one ? r.code : "" }], `${r.name}`);
    });
    $$(".rrow", G).forEach(tr => { tr.onclick = () => { RS.open[tr.dataset.id] = !RS.open[tr.dataset.id]; paint(); }; tr.onkeydown = e => { if (e.key === "Enter") tr.click(); }; });
    $$("[data-cls]", G).forEach(b => b.onclick = () => { const k = "cls:" + b.dataset.cls; RS.open[k] = RS.open[k] === false ? true : false; paint(); });
  }
  paint();
}

/* ===================== share & results (teacher) ===================== */
function renderShare(m) {
  if (!isTeacher()) { m.innerHTML = `<div class="card sec muted">Only the teacher can see this page.</div>`; return; }
  const list = S.activities;
  const f = parseForm(S.formUrl);
  m.innerHTML = `
  <div class="guide onbg"><div class="mascot" id="mascot">${mascotSVG()}</div><div class="bubble" id="bubble"><b>One link for all your missions.</b> Students open your website, type their name and class, and follow the mission journey. No login.</div></div>
  <div class="card sec"><h2>1 · The student link</h2>
    <div class="file"><div class="thumb" style="background:#fff;font-size:26px;box-shadow:inset 0 0 0 2px #e5e7eb">🗺️</div><div style="flex:1;min-width:0"><div class="nm">Mission journey (all activities)</div><div class="st"><a href="${SITE_URL}" target="_blank" rel="noopener">${SITE_URL}</a></div></div>
      <button class="btn btn-ghost btn-sm" data-cp="${SITE_URL}">📋 Copy</button></div>
    <div class="row" style="margin-top:12px"><a class="btn btn-ghost btn-sm" href="${SITE_URL}#missions" target="_blank" rel="noopener">🗺️ Choose open missions</a><a class="btn btn-primary btn-sm" href="${SITE_URL}#results" target="_blank" rel="noopener">📊 See results</a></div>
  </div>
  <div class="card sec"><h2>2 · Activities on your website</h2>
    <div>${list.map((a, i) => `<div class="file"><div class="thumb" style="background:#fff;font-size:26px;box-shadow:inset 0 0 0 2px #e5e7eb">${esc(a.data.icon || "🔢")}</div><div style="flex:1;min-width:0"><div class="nm">${esc(a.data.title)}</div><div class="st" style="word-break:break-all">Folder: <b>${esc(webFolder(a))}</b> · <a href="${esc(actLink(a))}" target="_blank" rel="noopener">open</a></div></div>
      <button class="btn btn-ghost btn-sm" data-cp="${esc(actLink(a))}">📋 Copy</button><button class="btn btn-ghost btn-sm" data-web="${i}">⬇ Website page</button></div>`).join("") || `<p class="muted">No activities yet.</p>`}</div>
    <div class="row" style="margin-top:12px"><button class="btn btn-accent" id="misDl">⬇ missions.js (the mission list)</button></div>
    <div class="notice" style="margin-top:14px"><b>Adding a new activity to the journey</b>
      <ol style="margin:6px 0 0;padding-left:20px;line-height:1.7">
        <li>Press <b>⬇ Website page</b> next to the new activity. It downloads <b>index.html</b>.</li>
        <li>Press <b>⬇ missions.js</b>. It downloads the updated mission list.</li>
        <li>On GitHub, open <b>mathspark</b> and click <b>Add file → Upload files</b>. Drag in <b>index.html</b>, then click the file name box and type the folder name first, for example <b>number-bonds/</b>. Commit.</li>
        <li>Upload <b>missions.js</b> the same way, but at the top level (no folder). Commit.</li>
        <li>Open <b>🗺️ Choose open missions</b> to unlock it for students, or lock it until you're ready.</li>
      </ol>
      <div class="small muted" style="margin-top:6px;font-weight:700">Changed an activity that's already on the website? Download its page again and upload it to the same folder. Book pictures you added are not included in website pages.</div></div>
  </div>`;
  $("#misDl", m).onclick = () => missionsFile();
  $$("[data-cp]", m).forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.cp); toast("Link copied!"); } catch { toast(b.dataset.cp, 6000); } });
  $$("[data-web]", m).forEach(b => b.onclick = () => websitePage(list[+b.dataset.web]));
}
async function missionsFile() {
  if (!S.downloads) { toast("Downloads aren't available here."); return; }
  const list = S.activities.slice().sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)).map(a => ({ id: a.id, folder: webFolder(a), title: a.data.title, icon: a.data.icon || "🔢", topic: a.data.topic || "" }));
  const js = `// MathSpark mission list. Made by the MathSpark app. Upload it to the top of your mathspark repository.\nwindow.__MISSIONS__ = ${JSON.stringify(list, null, 1).replace(/</g, "\\u003c")};\n`;
  try { await S.downloads.save({ filename: "missions.js", data: new Blob([js], { type: "text/javascript" }) }); toast("Downloaded missions.js! Upload it to the top of your mathspark repository.", 5000); }
  catch { toast("The download was cancelled."); }
}
async function websitePage(a) {
  if (!S.downloads) { toast("Downloads aren't available here."); return; }
  const strip = o => { if (!o || typeof o !== "object") return o; if (Array.isArray(o)) return o.map(strip); const r = {}; for (const k in o) r[k] = (o[k] && o[k].type === "image") ? null : strip(o[k]); return r; };
  const data = strip(JSON.parse(JSON.stringify(a.data)));
  const payload = JSON.stringify({ id: a.id, data, formUrl: S.formUrl || "" }).replace(/</g, "\\u003c");
  const html = `<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(a.data.title)} · MathSpark</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet"><link rel="stylesheet" href="../app.css"></head><body data-theme="jungle">${TEMPLATE_BODY}<script src="../config.js"><\/script><script>window.__EMBED__=${payload};<\/script><script src="../app.js"><\/script></body></html>`;
  try { await S.downloads.save({ filename: "index.html", data: new Blob([html], { type: "text/html" }) }); toast(`Downloaded! Upload it to the "${webFolder(a)}" folder on GitHub.`, 5000); }
  catch { try { await S.downloads.save({ filename: "index.html", data: html }); toast("Downloaded!"); } catch { toast("The download was cancelled."); } }
}
async function publishLinks() {
  const C = window.claude; const art = C ? await C.use("artifact").catch(() => null) : null;
  if (!art) { toast("Updating links isn't available here."); return; }
  if (!(await askConfirm("Update student links?", `This puts your ${S.activities.length} activities${S.formUrl ? " and Google Form" : ""} into the student links. Open pages will reload once.`, "Update"))) return;
  const btn = $("#pubBtn"); if (btn) { btn.disabled = true; btn.textContent = "Updating…"; }
  try {
    const acts = [];
    for (const a of S.activities) { const data = JSON.parse(JSON.stringify(a.data)); await inlineImages(data); acts.push({ id: a.id, data }); }
    const lib = { publishedAt: Date.now(), formUrl: S.formUrl || "", activities: acts };
    const html = `<!DOCTYPE html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>MathSpark</title><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;600;700;800&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet"><style id="app-style">${STYLE_TEXT}</style></head><body data-theme="jungle">${TEMPLATE_BODY}<script>window.__LIB__=${JSON.stringify(lib).replace(/</g, "\\u003c")};<\/script><script id="app-main">${$("#app-main").textContent}<\/script></body></html>`;
    await art.publish(html);
    toast("Student links updated!");
  } catch (e) {
    if (btn) { btn.disabled = false; btn.textContent = "📤 Update student links"; }
    toast(e?.code === "conflict" ? "Someone else updated the page. Try again." : "Couldn't update the links (" + (e?.code || "error") + ").");
  }
}
async function inlineImages(data) {
  const toData = async src => { try { const b = await (await fetch(src)).blob(); return await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.onerror = () => r(src); fr.readAsDataURL(b); }); } catch { return src; } };
  const walk = async o => { if (!o || typeof o !== "object") return; if (o.type === "image" && typeof o.src === "string" && !o.src.startsWith("data:")) o.src = await toData(o.src); for (const k in o) await walk(o[k]); };
  await walk(data);
}

/* ===================== player ===================== */
const TABS = [["learn", "📘", "Learn", "Học"], ["practice", "✏️", "Practice", "Luyện tập"], ["games", "🎮", "Games", "Trò chơi"], ["quiz", "🏆", "Quiz", "Kiểm tra"]];
const GUIDE = {
  learn: ["Let's learn! Tap the cards and pictures.", "Cùng học nào! Chạm vào thẻ và hình nhé."],
  practice: ["Your turn! Answer one question at a time.", "Đến lượt em! Trả lời từng câu nhé."],
  games: ["Game time! Pick a game to play.", "Giờ chơi! Chọn một trò chơi nhé."],
  quiz: ["Quiz adventure! Help me reach the flag 🏁", "Phiêu lưu kiểm tra! Giúp mình đến lá cờ 🏁"],
};
function renderPlayer(m) {
  stopAll();
  const a = S.current, d = a.data, p = prog(a.id);
  const doneTab = { learn: p.learn, practice: p.practice, games: Object.keys(p.games || {}).length, quiz: p.quiz };
  const tb = S.preview ? `<div class="teacherbar"><b>👀 Preview</b><span class="small muted">This is what students will see.</span><span class="spacer"></span>
      ${S.db ? `<button class="btn btn-primary btn-sm" id="saveBtn">💾 Save for class</button>` : ""}
      ${S.downloads ? `<button class="btn btn-ghost btn-sm" id="dlBtn">⬇ Offline copy</button>` : ""}
      <button class="btn btn-ghost btn-sm" id="rebuildBtn">↻ Rebuild</button><button class="btn btn-ghost btn-sm" id="discardBtn">Discard</button></div>`
    : (S.canEdit && !S.embed && S.downloads ? `<div class="row" style="justify-content:flex-end;margin-bottom:8px"><button class="btn btn-ghost btn-sm" id="dlBtn">⬇ Offline copy for students</button></div>` : "");
  m.innerHTML = `${tb}
   <div class="phead onbg">${S.embed || S.direct || !isTeacher() ? "" : `<button class="back" id="backBtn" aria-label="Back">←</button>`}<div class="ticon">${esc(d.icon || "🔢")}</div>
     <div style="flex:1;min-width:200px"><h1>${bi(d.title, d.title_vi)}</h1></div></div>
   <div class="onbg">${guideHTML(...GUIDE[S.tab])}</div>
   <div class="tabs">${TABS.map(([k, ic, en, vi]) => `<button class="tab t-${k} ${S.tab === k ? "on" : ""}" data-tab="${k}">${doneTab[k] ? `<span class="done">✅</span>` : ""}<span class="ic">${ic}</span>${en}</button>`).join("")}</div>
   <div id="pane" style="margin-top:18px"></div>`;
  $("#backBtn")?.addEventListener("click", () => go(S.preview ? "create" : "library"));
  $$("[data-tab]", m).forEach(b => b.onclick = () => { S.tab = b.dataset.tab; S.game = null; tone("whoosh"); renderPlayer(m); });
  $("#saveBtn")?.addEventListener("click", saveCurrent);
  $("#dlBtn")?.addEventListener("click", () => offlineCopy(a));
  $("#discardBtn")?.addEventListener("click", async () => { if (await askConfirm("Discard this activity?", "It hasn't been saved.", "Discard")) { S.localActs = S.localActs.filter(x => x !== a); S.current = null; S.preview = false; go("create"); } });
  $("#rebuildBtn")?.addEventListener("click", () => { S.preview = false; go("create"); setTimeout(() => startBuild(), 50); });
  if (S.preview && !S.db && !S.localActs.includes(a)) S.localActs.unshift(a);
  const pane = $("#pane");
  ({ learn: renderLearn, practice: renderPractice, games: renderGames, quiz: renderQuiz })[S.tab](pane, d);
}
const refreshTabs = () => { const p = prog(S.current.id); const done = { learn: p.learn, practice: p.practice, games: Object.keys(p.games || {}).length, quiz: p.quiz };
  $$(".tab").forEach(t => { const k = t.dataset.tab; if (done[k] && !t.querySelector(".done")) t.insertAdjacentHTML("afterbegin", `<span class="done">✅</span>`); }); };

/* ---------- learn ---------- */
function renderLearn(p, d) {
  p.innerHTML = `
  ${d.summary ? `<div class="card sec"><div class="row" style="font-size:19px;font-weight:800"><span style="font-size:30px">🎯</span><div style="flex:1">${biL(d.summary, d.summary_vi)}</div>${sayBtn(d.summary, d.summary_vi, true)}</div></div>` : ""}
  ${d.vocabulary.length ? `<div class="card sec"><h2>🔤 Key words <span class="vi-inline">· Từ vựng</span></h2><p class="small muted" style="margin:-4px 0 12px">${biL("Tap a card to flip it.", "Chạm vào thẻ để lật.", true)}</p>
    <div class="vocab">${d.vocabulary.map(v => `<div class="vcard"><div class="vinner">
      <div class="vface vfront">${v.emoji ? `<span class="em">${esc(v.emoji)}</span>` : ""}<b>${esc(v.term)}</b>${v.term_vi ? `<span class="vi">${esc(v.term_vi)}</span>` : ""}<div>${sayBtn(v.term, v.term_vi, true)}</div></div>
      <div class="vface vback"><div>${biV(v.meaning, v.meaning_vi)}</div><div>${sayBtn(v.meaning, v.meaning_vi, true)}</div></div></div></div>`).join("")}</div></div>` : ""}
  ${d.concepts.map((c, ci) => `<div class="card concept"><h3>${["💡", "🧠", "🔍", "⭐"][ci % 4]} ${biL(c.title, c.title_vi, true)}</h3><div class="row" style="align-items:flex-start;flex-wrap:nowrap"><div style="flex:1">${biL(c.explain, c.explain_vi)}</div>${sayBtn(c.explain, c.explain_vi, true)}</div>
    ${c.example ? `<div class="example"><div class="small" style="font-weight:900;color:var(--c-learn-d)">${biL("Example", "Ví dụ", true)}</div><div class="q row" style="flex-wrap:nowrap;align-items:flex-start"><div style="flex:1">${biL(c.example.problem, c.example.problem_vi)}</div>${sayBtn(c.example.problem, c.example.problem_vi, true)}</div>
      ${renderVisual(c.example.visual)}
      <ol class="stepper" id="st${ci}">${c.example.steps.map(s => `<li><div style="flex:1">${biL(s.en, s.vi)}</div>${sayBtn(s.en, s.vi, true)}</li>`).join("")}</ol>
      <div class="row" style="margin-top:10px"><button class="btn btn-accent btn-sm" data-step="${ci}">👣 ${biL("Next step", "Bước tiếp theo", true)}</button><span class="ans hidden" id="ans${ci}">✓ ${esc(c.example.answer)}</span></div></div>` : ""}</div>`).join("")}
  ${d.playground ? `<div id="pgWrap"></div>` : ""}
  <div class="row" style="justify-content:center;margin-top:10px"><button class="btn btn-primary btn-lg" id="learnDone">✅ ${biL("I'm ready to practise!", "Em sẵn sàng luyện tập!", true)}</button></div>`;
  bindVisuals(p);
  $$(".vcard", p).forEach(c => c.onclick = () => { c.classList.toggle("flip"); tone("flip"); });
  $$("[data-step]", p).forEach(b => b.onclick = () => {
    const ci = b.dataset.step, lis = $$(`#st${ci} li`, p), next = lis.find(l => !l.classList.contains("show"));
    if (next) { next.classList.add("show"); tone("tap"); }
    if (!lis.find(l => !l.classList.contains("show"))) { $(`#ans${ci}`, p).classList.remove("hidden"); b.classList.add("hidden"); tone("good"); setGuide("happy", "You solved the example!", "Em đã giải xong ví dụ!"); }
  });
  if (d.playground) renderPlayground($("#pgWrap", p), d.playground);
  $("#learnDone").onclick = e => { if (!prog(S.current.id).learn) flyStar(e.currentTarget); award("learn", 1); track("learn", { task: "Learn", stars: 1 }); tone("win"); setTimeout(() => { S.tab = "practice"; renderPlayer($("#main")); scrollTo({ top: 0, behavior: "smooth" }); }, 700); };
}
function renderFlip(el, pg) {
  const N = pg.total, side = Array(N).fill(0), found = new Set(), goal = N - 1;
  const draw = () => {
    const r = side.filter(x => x === 0).length, y = N - r;
    el.innerHTML = `<div class="card play"><h2>🧪 ${biL("Play with it!", "Cùng thử nào!", true)}</h2>
      <p style="margin:4px 0 0;font-weight:700">${biL(`Here are ${N} counters. Tap a counter to flip it: red 🔴 or yellow 🟡. How many number bonds to ${N} can you make?`, `Đây là ${N} chấm tròn. Chạm vào chấm để lật: đỏ 🔴 hoặc vàng 🟡. Em tạo được bao nhiêu cách tách số ${N}?`)}</p>
      <div style="display:flex;justify-content:center;margin-top:12px"><div class="flipcircle">${side.map((x, i) => `<button class="obj flipc" data-fl="${i}">${x ? "🟡" : "🔴"}</button>`).join("")}</div></div>
      <div class="pg-out">${renderVisual({ type: "partwhole", whole: N, parts: [r, y] })}<div style="text-align:center">${renderVisual({ type: "sentence", items: [r, "+", y, "=", N] })}
      <div class="small muted" style="font-weight:800">${biL(`Bonds found: ${found.size} / ${goal}`, `Số cách đã tìm: ${found.size} / ${goal}`, true)}</div>
      <div class="found" style="margin-top:6px">${[...found].map(f => `<span>${f}</span>`).join("")}</div></div></div></div>`;
    $$("[data-fl]", el).forEach(b => b.onclick = () => {
      side[+b.dataset.fl] ^= 1; tone("flip");
      const nr = side.filter(x => x === 0).length, ny = N - nr, key = `${nr} + ${ny} = ${N}`;
      if (nr > 0 && ny > 0 && !found.has(key)) { found.add(key); speak(`${nr} plus ${ny} equals ${N}`);
        if (found.size === goal) setTimeout(() => { confetti(); tone("win"); setGuide("happy", `You found all ${goal} number bonds to ${N}!`, `Em đã tìm ra tất cả ${goal} cách tách số ${N}!`); }, 300); else tone("good"); }
      draw();
    });
  };
  draw();
}
function renderPlayground(el, pg) {
  if (pg.kind === "flip") return renderFlip(el, pg);
  const N = pg.total, side = Array(N).fill(0), found = new Set(), goal = N - 1;
  const draw = () => {
    const a = side.filter(s => s === 0).length, b = N - a;
    el.innerHTML = `<div class="card play"><h2>🧪 ${biL("Play with it!", "Cùng thử nào!", true)}</h2>
      <p style="margin:4px 0 0;font-weight:700">${biL(`Tap a ${pg.emoji} to move it to the other ${pg.style === "circles" ? "circle" : "hoop"}. Find all the ways to make ${N}!`, `Chạm vào ${pg.emoji} để chuyển sang vòng kia. Tìm tất cả các cách tạo thành ${N}!`)}</p>
      <div class="pg-area"><div class="pg-hoop ${pg.style === "circles" ? "circ" : ""}">${side.map((s, i) => s === 0 ? `<button class="obj" data-mv="${i}">${esc(pg.emoji)}</button>` : "").join("")}</div>
      <div class="pg-hoop b ${pg.style === "circles" ? "circ" : ""}">${side.map((s, i) => s === 1 ? `<button class="obj" data-mv="${i}">${esc(pg.emoji)}</button>` : "").join("")}</div></div>
      <div class="pg-out">${renderVisual({ type: "partwhole", whole: N, parts: [a, b] })}<div style="text-align:center"><div style="font-family:var(--fd);font-weight:800;font-size:26px">${a} and ${b} → ${N}</div>
      <div class="small muted" style="font-weight:800">${biL(`Ways found: ${found.size} / ${goal}`, `Số cách đã tìm: ${found.size} / ${goal}`, true)}</div>
      <div class="found" style="margin-top:6px">${[...found].map(f => `<span>${f}</span>`).join("")}</div></div></div></div>`;
    $$("[data-mv]", el).forEach(b => b.onclick = () => {
      side[+b.dataset.mv] ^= 1; tone("pop");
      const na = side.filter(s => s === 0).length, nb = N - na, key = `${na} & ${nb}`;
      if (na > 0 && nb > 0 && !found.has(key)) { found.add(key); speak(`${na} and ${nb} make ${N}`); if (found.size === goal) { setTimeout(() => { confetti(); tone("win"); setGuide("happy", `You found all the ways to make ${N}!`, `Em đã tìm ra tất cả các cách tạo thành ${N}!`); }, 300); } else tone("good"); }
      draw();
    });
  };
  draw();
}

/* ---------- keypad ---------- */
function keypad(id) { return `<div class="keypad" data-for="${id}">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "/", ".", "⌫"].map(k => `<button data-key="${k}" class="${k === "⌫" ? "k-del" : ""}">${k}</button>`).join("")}</div>`; }
document.addEventListener("click", e => {
  const k = e.target.closest("[data-key]"); if (!k) return;
  const pad = k.closest(".keypad"), inp = document.getElementById(pad.dataset.for); if (!inp || inp.disabled) return;
  inp.value = k.dataset.key === "⌫" ? inp.value.slice(0, -1) : (inp.value + k.dataset.key).slice(0, 12); tone("tap");
  inp.dispatchEvent(new Event("input"));
});

/* ---------- practice (one at a time) ---------- */
function renderPractice(p, d) {
  const P = S.pr || (S.pr = { i: 0, res: [] });
  if (!d.practice.length) { p.innerHTML = `<div class="card sec muted">No practice for this activity.</div>`; return; }
  if (P.i >= d.practice.length) return practiceEnd(p, d);
  const q = d.practice[P.i], lvl = ["", "⭐", "⭐⭐", "⭐⭐⭐"][q.level];
  let tries = 0, done = false;
  const numeric = q.answers.some(isNumericAnswer);
  p.innerHTML = `<div class="dots">${d.practice.map((_, i) => `<i class="${P.res[i] || ""} ${i === P.i ? "cur" : ""}">${P.res[i] === "star" ? "★" : ""}</i>`).join("")}</div>
   <div class="card qcard" id="qc"><div class="row"><span class="lvl">${lvl} ${bi("Question", "Câu", true)} ${P.i + 1} / ${d.practice.length}</span></div>
     <div class="qtext"><span style="flex:1">${bi(q.question, q.question_vi)}</span>${sayBtn(q.question, q.question_vi)}</div>
     ${renderVisual(q.visual)}
     ${q.type === "choice" ? `<div class="choices">${q.choices.map((c, k) => `<button class="choice ch${k % 5}" data-k="${k}"><span class="shp">${"▲◆●■★"[k % 5]}</span>${esc(c)}</button>`).join("")}</div>`
      : `<div class="ansrow"><input type="text" class="ansin" id="pin" autocomplete="off" inputmode="${numeric ? "none" : "text"}" placeholder="?"><button class="btn btn-good btn-lg" id="chk">✓ ${bi("Check", "Kiểm tra", true)}</button></div>${numeric ? keypad("pin") : ""}`}
     <div id="fb"></div>
     <div class="actions" id="acts">${q.hint ? `<button class="btn btn-ghost btn-sm" id="hintBtn">💡 ${bi("Hint", "Gợi ý", true)}</button>` : ""}</div>
   </div>`;
  bindVisuals(p);
  const qc = $("#qc", p), fb = $("#fb", p), acts = $("#acts", p);
  const finish = (result) => {
    done = true; P.res[P.i] = result;
    $$(".choice", p).forEach(b => b.disabled = true); const inp = $("#pin", p); if (inp) inp.disabled = true; $("#chk", p)?.setAttribute("disabled", "");
    acts.innerHTML = `<button class="btn btn-primary btn-lg" id="nextQ">${P.i === d.practice.length - 1 ? bi("Finish", "Hoàn thành", true) + " 🏁" : bi("Next", "Tiếp", true) + " ➜"}</button>`;
    $("#nextQ", p).onclick = () => { P.i++; tone("whoosh"); renderPractice(p, d); };
  };
  const check = (val, k) => {
    if (done || !String(val).trim()) return;
    if (isCorrect(val, q.answers)) {
      const yes = pick(YES); tone("good"); qc.classList.add("glow"); setGuide("happy", ...yes);
      if (k != null) $(`[data-k="${k}"]`, p).classList.add("right");
      fb.innerHTML = `<div class="fb good">🎉 ${bi(...yes, true)}${q.solution ? `<div style="margin-top:4px;font-weight:600">${bi(q.solution, q.solution_vi)}</div>` : ""}</div>`;
      if (tries === 0) flyStar(qc);
      finish(tries === 0 ? "star" : "ok");
    } else {
      tries++; tone("bad"); const no = pick(NO); setGuide("sad", ...no);
      qc.classList.remove("shake"); void qc.offsetWidth; qc.classList.add("shake");
      if (k != null) { const b = $(`[data-k="${k}"]`, p); b.classList.add("wrong"); b.disabled = true; }
      fb.innerHTML = `<div class="fb bad">🤔 ${bi(...no, true)}</div>`;
      const inp = $("#pin", p); if (inp) { inp.select(); }
      if (tries >= 2 && !$("#showBtn", p)) { acts.insertAdjacentHTML("beforeend", `<button class="btn btn-ghost btn-sm" id="showBtn">👀 ${bi("Show me", "Chỉ cho em", true)}</button>`);
        $("#showBtn", p).onclick = () => { fb.innerHTML = `<div class="fb sol">${bi(q.solution || "Here is the answer:", q.solution_vi)}<div style="margin-top:6px">${bi("Answer", "Đáp án", true)}: <b style="font-size:20px">${esc(q.answers[0])}</b></div></div>`;
          if (q.type === "choice") $$(".choice", p).forEach(b => { if (isCorrect(q.choices[+b.dataset.k], q.answers)) b.classList.add("right"); else b.classList.add("dim"); });
          setGuide("think", "Look carefully. You'll get the next one!", "Nhìn kỹ nhé. Câu sau em sẽ làm được!"); finish("help"); }; }
    }
  };
  $$(".choice", p).forEach(b => b.onclick = () => check(q.choices[+b.dataset.k], +b.dataset.k));
  const inp = $("#pin", p);
  if (inp) { $("#chk", p).onclick = () => check(inp.value); inp.onkeydown = e => { if (e.key === "Enter") check(inp.value); }; if (!numeric) setTimeout(() => inp.focus(), 50); }
  $("#hintBtn", p)?.addEventListener("click", () => { setGuide("think", q.hint, q.hint_vi); fb.innerHTML = `<div class="fb hint">💡 ${bi(q.hint, q.hint_vi)}</div>`; tone("tap"); });
}
function practiceEnd(p, d) {
  const P = S.pr, n = d.practice.length, score = P.res.reduce((a, r) => a + (r === "star" ? 1 : r === "ok" ? .7 : 0), 0);
  const pct = Math.round(score / n * 100), st = starsFor(pct);
  award("practice", st); refreshTabs();
  if (st >= 2) { confetti(); tone("win"); }
  setGuide(st >= 2 ? "happy" : "think", ...PRAISE[st]);
  const first = P.res.filter(r => r === "star").length;
  if (!P.sent) { P.sent = true; track("practice", { task: "Practice", score: `${first}/${n} first try`, stars: st, correct: P.res.filter(r => r === "star" || r === "ok").length, total: n }); }
  p.innerHTML = `<div class="card result">${starsHTML(st)}<h2>${bi(PRAISE[st][0], PRAISE[st][1])}</h2>
    <p style="font-weight:800">${bi(`${first} of ${n} right on the first try!`, `Đúng ngay lần đầu ${first} / ${n} câu!`)}</p>
    ${sendBox("Practice", `${first}/${n} first try`, st)}
    <div class="actions"><button class="btn btn-accent btn-lg" id="toGames">🎮 ${bi("Play games", "Chơi trò chơi", true)}</button><button class="btn btn-ghost" id="again">↻ ${bi("Practise again", "Luyện lại", true)}</button></div></div>`;
  $("#toGames", p).onclick = () => { S.tab = "games"; renderPlayer($("#main")); };
  $("#again", p).onclick = () => { S.pr = null; renderPractice(p, d); };
}

/* ---------- games ---------- */
const GAMES = [
  ["circles", "⭕", "Two Circles", "", "Put things into 2 groups. Then count the parts and the whole.", "", "#b91c1c", g => g.circles.length > 0],
  ["model", "🍒", "Build the Model", "", "Drag the right number into the empty circle.", "", "#ec4899", (g, d) => g.model.length >= 3 || !!d.playground],
  ["balloon", "🎈", "Balloon Pop", "Bắn bóng bay", "Pop the balloon with the right answer!", "Chạm vào bóng bay có đáp án đúng!", "#ef4444", g => g.speed.length >= 3],
  ["memory", "🃏", "Memory Match", "Lật thẻ ghi nhớ", "Flip cards and find the pairs.", "Lật thẻ và tìm các cặp.", "#a855f7", g => g.match.length >= 3],
  ["sort", "🧺", "Sort It!", "Phân loại!", "Drag each card to TRUE or FALSE.", "Kéo thẻ vào ĐÚNG hoặc SAI.", "#22c55e", g => g.truefalse.length >= 3],
  ["speed", "⏱️", "Beat the Clock", "Đua với thời gian", "How many can you do in 60 seconds?", "Em làm được bao nhiêu câu trong 60 giây?", "#f97316", g => g.speed.length >= 3],
];
function renderGames(p, d) {
  stopAll();
  const g = d.games;
  if (!S.game) {
    const pr = prog(S.current.id).games || {};
    const list = GAMES.filter(x => x[7](g, d));
    p.innerHTML = list.length ? `<div class="gpick">${list.map(([k, ic, en, vi, den, dvi, col]) => `<div class="card gcard" data-g="${k}" style="border-color:${col}"><div class="big">${ic}</div><h3>${bi(en, vi)}</h3><p class="small muted" style="font-weight:700">${bi(den, dvi)}</p>
      <div style="font-size:22px;margin:4px 0">${[0, 1, 2].map(i => `<span style="${i < (pr[k] || 0) ? "" : "filter:grayscale(1);opacity:.25"}">⭐</span>`).join("")}</div>
      <button class="btn btn-sm" style="background:${col};color:#fff;box-shadow:0 4px 0 rgba(0,0,0,.2)">${bi("Play", "Chơi", true)} ▶</button></div>`).join("")}</div>`
      : `<div class="card sec muted">No games for this activity.</div>`;
    $$("[data-g]", p).forEach(c => c.onclick = () => { S.game = { kind: c.dataset.g }; tone("whoosh"); renderGames(p, d); });
    return;
  }
  const back = `<button class="btn btn-ghost btn-sm" id="gBack">← ${bi("Games", "Trò chơi", true)}</button>`;
  ({ circles: gameCircles, model: gameModel, balloon: gameBalloon, memory: gameMemory, sort: gameSort, speed: gameSpeed })[S.game.kind](p, d, back);
  bindBack(p);
}
function bindBack(p) { const b = $("#gBack", p); if (b) b.onclick = () => { stopAll(); S.game = null; setGuide("", ...GUIDE.games); renderGames(p, S.current.data); }; }
function gameEnd(p, back, key, stars, en, vi, again) {
  stopAll(); award(null, stars, key); refreshTabs();
  if (stars) confetti(); tone("win"); setGuide(stars >= 2 ? "happy" : "think", ...PRAISE[stars]);
  const gname = (GAMES.find(g => g[0] === key) || [])[2] || "Game";
  track("game", { task: gname, game: key, score: en, stars });
  p.innerHTML = `<div class="card result">${starsHTML(stars)}<h2>${bi(PRAISE[stars][0], PRAISE[stars][1])}</h2><p style="font-weight:800">${bi(en, vi)}</p>${sendBox("Game: " + gname, en, stars)}
    <div class="actions">${back}<button class="btn btn-primary" id="again">↻ ${bi("Play again", "Chơi lại", true)}</button></div></div>`;
  $("#again", p).onclick = again; bindBack(p);
}
function distractors(ans, pool) {
  const n = numVal(ans), out = new Set();
  if (n != null && Number.isInteger(n)) {
    shuffle([n - 1, n + 1, n + 2, n - 2, n + 3, n - 3].filter(x => x >= 0 && x !== n)).forEach(x => out.size < 3 && out.add(String(x)));
  } else shuffle(pool.filter(x => norm(x) !== norm(ans))).forEach(x => out.size < 3 && out.add(x));
  while (out.size < 2) out.add(String(Math.floor(Math.random() * 20)));
  return [...out];
}
function gameCircles(p, d, back) {
  const rounds = d.games.circles;
  let r = 0, firstTry = 0, sel = null;
  const draw = () => {
    if (r >= rounds.length) { const pct = Math.round(firstTry / rounds.length * 100); return gameEnd(p, back, "circles", starsFor(pct), `You sorted ${rounds.length} sets into two circles!`, "", () => gameCircles(p, d, back)); }
    const R0 = rounds[r], N = R0.total, ways = new Set();
    let tries = 0, solved = false;
    p.innerHTML = `<div class="gbar">${back}<span class="spacer"></span><span class="score">⭕ ${r + 1}/${rounds.length}</span><span class="score">⭐ ${firstTry}</span></div>
      <div class="card sec c2game"><div class="mg-q">Here are ${N} ${esc(R0.emoji)}. Put them into 2 groups. ${sayBtn(`Here are ${N}. Put them into 2 groups.`)}</div>
      <div class="tray" id="tray">${Array.from({ length: N }, (_, i) => `<button class="piece" data-pc="${i}">${esc(R0.emoji)}</button>`).join("")}</div>
      <div class="small muted" style="font-weight:800;margin-top:6px">👆 Drag each one into a circle (or tap it, then tap a circle).</div>
      <div class="circles2"><div class="cz" data-cz="0"></div><div class="cz" data-cz="1"></div></div>
      <div id="frameBox"></div><div class="found" id="ways"></div></div>`;
    bindBack(p);
    const tray = $("#tray", p), cz = $$(".cz", p);
    const place = (pc, dest) => { dest.appendChild(pc); pc.style.transform = ""; pc.classList.remove("sel"); sel = null; tone("pop"); update(); };
    const update = () => {
      const a = cz[0].children.length, b = cz[1].children.length, fb = $("#frameBox", p);
      if (solved) return;
      if (tray.children.length) { fb.innerHTML = ""; return; }
      if (!a || !b) { fb.innerHTML = `<div class="fb hint">Put some in <b>both</b> circles!</div>`; setGuide("think", "Use both circles!"); return; }
      const bx = id => `<input class="fbox" id="${id}" inputmode="none" autocomplete="off">`;
      const frameHTML = R0.frame === "sentence" ? `<div class="frame"><div class="sentrow">${bx("f1")} + ${bx("f2")} = ${bx("f3")}</div></div>`
        : R0.frame === "whole-first" ? `<div class="frame"><div class="sentrow">${bx("f3")} = ${bx("f1")} + ${bx("f2")}</div></div>`
        : `<div class="frame"><div>${bx("f1")} is a part.</div><div>${bx("f2")} is a part.</div><div>The whole is ${bx("f3")}.</div></div>`;
      fb.innerHTML = `${frameHTML}
        <div id="kpWrap">${keypad("f1")}</div><div class="actions"><button class="btn btn-good btn-lg" id="fChk">✓ Check</button></div><div id="ffb"></div>`;
      setGuide("", R0.frame === "parts" ? "Count each circle. Fill in the boxes!" : "Count each circle. Write the number sentence!");
      const boxes = ["f1", "f2", "f3"].map(id => $("#" + id, fb)), pad = $(".keypad", fb);
      const act = b => { boxes.forEach(x => x.classList.toggle("on", x === b)); pad.dataset.for = b.id; };
      boxes.forEach(b => { b.onfocus = () => act(b); b.onclick = () => act(b); b.oninput = () => { b.value = b.value.replace(/\D/g, "").slice(0, 2); b.classList.remove("ok", "no"); }; b.onkeydown = e => { if (e.key === "Enter") check(); }; });
      act(R0.frame === "whole-first" ? boxes[2] : boxes[0]);
      const check = () => {
        const v = boxes.map(b => parseInt(b.value)); if (v.some(isNaN)) { setGuide("think", "Fill in all three boxes."); return; }
        const okParts = (v[0] === a && v[1] === b) || (v[0] === b && v[1] === a), okWhole = v[2] === N;
        if (okParts && okWhole) {
          solved = true; boxes.forEach(b => { b.classList.remove("no"); b.classList.add("ok"); b.disabled = true; }); if (tries === 0) { firstTry++; flyStar($("#fChk", p)); }
          tone("good"); const msg = R0.frame === "sentence" ? `${v[0]} + ${v[1]} = ${N}` : R0.frame === "whole-first" ? `${N} = ${v[0]} + ${v[1]}` : `${v[0]} is a part. ${v[1]} is a part. The whole is ${N}.`; setGuide("happy", msg); speak(msg);
          ways.add(`${Math.min(a, b)} and ${Math.max(a, b)}`); const allWays = Math.floor(N / 2);
          $("#ways", p).innerHTML = [...ways].map(w => `<span>${w}</span>`).join("");
          $("#kpWrap", p).innerHTML = "";
          $("#ffb", p).innerHTML = `<div class="fb good">🎉 Correct! ${ways.size < allWays ? "Is there another way of doing this?" : `You found all ${allWays} ways!`}</div>`;
          $(".actions", fb).innerHTML = `${ways.size < allWays ? `<button class="btn btn-accent" id="again">🔄 Try another way</button>` : ""}<button class="btn btn-primary btn-lg" id="nxt">Next ➜</button>`;
          $("#again", p)?.addEventListener("click", () => { solved = false; $$(".piece", p).forEach(pc => tray.appendChild(pc)); tries = 1; $("#ffb", p).innerHTML = ""; update(); tone("whoosh"); });
          $("#nxt", p).onclick = () => { r++; tone("whoosh"); draw(); };
          if (ways.size >= allWays) { confetti(); }
        } else {
          tries++; tone("bad"); setGuide("sad", okWhole ? "Count each circle again." : "Count all of them for the whole.");
          boxes[0].classList.toggle("no", !okParts); boxes[1].classList.toggle("no", !okParts); boxes[2].classList.toggle("no", !okWhole);
          boxes[0].classList.toggle("ok", okParts); boxes[1].classList.toggle("ok", okParts); boxes[2].classList.toggle("ok", okWhole);
          if (tries >= 2) $("#ffb", p).innerHTML = `<div class="fb sol">Tip: tap the ${esc(R0.emoji)} in each circle to count. The whole is all of them together.</div>`;
        }
      };
      $("#fChk", p).onclick = check;
    };
    const hit = (x, y) => [...cz, tray].find(el => { const b = el.getBoundingClientRect(); return x > b.left && x < b.right && y > b.top && y < b.bottom; });
    $$(".piece", p).forEach(pc => {
      let sx = 0, sy = 0, dx = 0, dy = 0, down = false;
      pc.onpointerdown = e => { if (solved) return; down = true; sx = e.clientX; sy = e.clientY; dx = dy = 0; pc.setPointerCapture(e.pointerId); pc.classList.add("drag"); };
      pc.onpointermove = e => { if (!down) return; dx = e.clientX - sx; dy = e.clientY - sy; pc.style.transform = `translate(${dx}px,${dy}px) scale(1.2)`; const h = hit(e.clientX, e.clientY); cz.forEach(c => c.classList.toggle("hot", c === h)); };
      pc.onpointerup = e => { if (!down) return; down = false; pc.classList.remove("drag"); cz.forEach(c => c.classList.remove("hot"));
        if (Math.hypot(dx, dy) < 8) { pc.style.transform = "";
          if (pc.parentElement === tray) { $$(".piece.sel", p).forEach(x => x.classList.remove("sel")); pc.classList.add("sel"); sel = pc; tone("tap"); }
          else place(pc, tray);
          return; }
        const h = hit(e.clientX, e.clientY); if (h) place(pc, h); else pc.style.transform = ""; };
    });
    cz.forEach(c => c.addEventListener("click", e => { if (sel && !e.target.closest(".piece")) place(sel, c); }));
  };
  draw();
}
function modelRounds(d) {
  let list = d.games.model.slice();
  if (list.length < 3 && d.playground) {
    const max = Math.max(5, d.playground.total); list = [];
    for (let k = 0; k < 10; k++) { const w = 3 + Math.floor(Math.random() * (max - 2)), a = 1 + Math.floor(Math.random() * (w - 1)), miss = pick(["w", 0, 1]);
      list.push({ whole: miss === "w" ? null : w, parts: [miss === 0 ? null : a, miss === 1 ? null : w - a], ans: miss === "w" ? w : miss === 0 ? a : w - a }); }
  }
  return shuffle(list).slice(0, 10);
}
function gameModel(p, d, back) {
  const rounds = modelRounds(d);
  let r = 0, right = 0, miss = 0, tries = 0, busy = false;
  p.innerHTML = `<div class="gbar">${back}<span class="spacer"></span><span class="score">🍒 <span id="mR">1</span>/${rounds.length}</span><span class="score">⭐ <span id="mS">0</span></span></div>
    <div class="card sec mgame"><div class="mg-q" id="mgq"></div><div class="mg-model" id="mgm"></div><div class="tiles" id="tiles"></div><div class="mg-help" id="mgh"></div></div>`;
  const round = () => {
    if (!$("#mgm", p)) return;
    if (r >= rounds.length) { const pct = Math.round(right / rounds.length * 100); return gameEnd(p, back, "model", starsFor(pct), `You built ${right} models on the first try!`, "", () => gameModel(p, d, back)); }
    busy = false; tries = 0; const m = rounds[r]; $("#mR", p).textContent = r + 1;
    const slot = m.whole == null ? "w" : String(m.parts.findIndex(x => x == null));
    const q = m.whole == null ? "What is the whole?" : "What is the missing part?";
    $("#mgq", p).innerHTML = `${q} ${sayBtn(q + " Drag the number into the empty circle.")}`;
    $("#mgm", p).innerHTML = renderVisual({ type: "partwhole", whole: m.whole, parts: m.parts });
    const known = m.parts.filter(x => x != null);
    $("#mgh", p).innerHTML = `<button class="btn btn-ghost btn-sm" id="helpBtn">🔴 Show me with counters</button>`;
    $("#helpBtn", p).onclick = () => { const g = m.whole == null ? m.parts : [m.parts.find(x => x != null) ?? 0];
      $("#mgh", p).innerHTML = m.whole == null ? renderVisual({ type: "groups", emoji: "🔴", groups: g })
        : `<div class="small" style="font-weight:800">The whole is ${m.whole}. Count on from ${known[0]} to ${m.whole}!</div>${renderVisual({ type: "numberline", min: 0, max: Math.max(10, m.whole), step: 1, marks: [known[0], m.whole], jumps: [] })}`;
      bindVisuals($("#mgh", p)); tone("tap"); };
    const opts = shuffle([String(m.ans), ...distractors(String(m.ans), [])]).slice(0, 4);
    const tiles = $("#tiles", p);
    tiles.innerHTML = opts.map((o, k) => `<button class="tile-n" data-v="${esc(o)}" style="background:${PALETTE[(k + r) % PALETTE.length]}">${esc(o)}</button>`).join("");
    const target = () => $(`#mgm [data-slot="${slot}"]`, p);
    $$(".tile-n", tiles).forEach(t => {
      let sx = 0, sy = 0, dx = 0, dy = 0, down = false;
      t.onpointerdown = e => { if (busy) return; down = true; sx = e.clientX; sy = e.clientY; dx = dy = 0; t.setPointerCapture(e.pointerId); t.classList.add("drag"); t.classList.remove("back"); };
      t.onpointermove = e => { if (!down) return; dx = e.clientX - sx; dy = e.clientY - sy; t.style.transform = `translate(${dx}px,${dy}px) scale(1.1)`; target()?.classList.toggle("pw-hot", over(t)); };
      t.onpointerup = () => { if (!down) return; down = false; t.classList.remove("drag"); target()?.classList.remove("pw-hot");
        if (Math.hypot(dx, dy) < 8 || over(t)) judge(t); else back(t); };
    });
    const over = t => { const a = t.getBoundingClientRect(), b = target()?.getBoundingClientRect(); if (!b) return false; const cx = a.left + a.width / 2, cy = a.top + a.height / 2; return cx > b.left - 20 && cx < b.right + 20 && cy > b.top - 20 && cy < b.bottom + 20; };
    const back = t => { t.classList.add("back"); t.style.transform = ""; };
    const judge = t => {
      if (busy) return;
      const v = t.dataset.v;
      if (+v === m.ans) {
        busy = true; const c = target(), a = t.getBoundingClientRect(), b = c.getBoundingClientRect();
        t.classList.add("fly"); t.style.transform = `translate(${b.left + b.width / 2 - (a.left + a.width / 2) + (parseFloat((t.style.transform.match(/translate\(([-\d.]+)px/) || [0, 0])[1]) || 0)}px,${b.top + b.height / 2 - (a.top + a.height / 2) + (parseFloat((t.style.transform.match(/,\s*([-\d.]+)px/) || [0, 0])[1]) || 0)}px) scale(.4)`; t.style.opacity = "0";
        setTimeout(() => { const tx = $(`#mgm [data-t="${slot}"]`, p); tx.textContent = v; tx.setAttribute("fill", "#16a34a"); c.classList.remove("pw-empty"); c.classList.add("pw-ok"); }, 300);
        const whole = m.whole ?? m.ans, parts = m.parts.map(x => x ?? m.ans);
        tone("good"); if (tries === 0) { right++; $("#mS", p).textContent = right; flyStar(c); }
        setGuide("happy", `${parts.join(" and ")} make ${whole}!`); speak(`${parts.join(" and ")} make ${whole}`);
        r++; setTimeout(round, 1500);
      } else {
        tries++; miss++; tone("bad"); setGuide("sad", ...pick(NO)); back(t); t.classList.remove("shake"); void t.offsetWidth; t.classList.add("shake");
        if (tries >= 2) $$(".tile-n", tiles).forEach(x => { if (+x.dataset.v === m.ans) x.classList.add("glow"); });
      }
    };
  };
  round();
}
function gameBalloon(p, d, back) {
  const items = d.games.speed, rounds = shuffle(items).slice(0, Math.min(10, items.length)), pool = items.map(i => i.answers[0]);
  let r = 0, hits = 0, misses = 0, score = 0, balloons = [], locked = false;
  p.innerHTML = `<div class="gbar">${back}<span class="spacer"></span><span class="score">🎈 <span id="bRound">1</span>/${rounds.length}</span><span class="score">⭐ <span id="bScore">0</span></span></div>
    <div class="sky" id="sky"><div class="sign" id="sign"></div></div>`;
  const sky = $("#sky", p);
  const H = () => sky.clientHeight, W = () => sky.clientWidth;
  const balloonSVG = c => `<svg viewBox="0 0 96 150"><path d="M48 112 Q44 130 50 148" stroke="#475569" stroke-width="2" fill="none"/><ellipse cx="48" cy="56" rx="44" ry="52" fill="${c}"/><ellipse cx="32" cy="34" rx="10" ry="16" fill="#fff" opacity=".35"/><path d="M42 106 L54 106 L48 116 Z" fill="${c}"/></svg>`;
  const round = () => {
    if (!sky.isConnected) return;
    if (r >= rounds.length) { const pct = Math.round(hits / Math.max(1, hits + misses) * 100); return gameEnd(p, back, "balloon", starsFor(pct), `You popped ${hits} right balloons!`, `Em đã bắn đúng ${hits} quả bóng!`, () => gameBalloon(p, d, back)); }
    locked = false; const it = rounds[r]; $("#bRound", p).textContent = r + 1;
    $("#sign", p).innerHTML = `${it.visual ? renderVisual(it.visual) : ""}${esc(it.q)} ${sayBtn(it.q)}`;
    balloons.forEach(b => b.el.remove());
    const opts = shuffle([it.answers[0], ...distractors(it.answers[0], pool)]).slice(0, 4), n = opts.length;
    balloons = opts.map((o, k) => {
      const el = document.createElement("button"); el.className = "balloon"; el.innerHTML = balloonSVG(PALETTE[(k + r) % PALETTE.length]) + `<b>${esc(o)}</b>`;
      sky.appendChild(el);
      const b = { el, val: o, x: (k + .5) * (W() / n) - 48, y: -150 + Math.random() * 120, sp: .9 + Math.random() * .6, ph: Math.random() * 6, alive: true };
      el.onclick = () => hit(b, it);
      return b;
    });
  };
  const hit = (b, it) => {
    if (!b.alive || locked) return;
    const rect = b.el.getBoundingClientRect(), sr = sky.getBoundingClientRect();
    if (isCorrect(b.val, it.answers)) {
      locked = true; b.alive = false; b.el.classList.add("popped"); tone("pop"); setTimeout(() => tone("good"), 80);
      hits++; score += 10; $("#bScore", p).textContent = score;
      const plus = document.createElement("div"); plus.className = "plus"; plus.textContent = "+10"; plus.style.left = (rect.left - sr.left + 30) + "px"; plus.style.top = (rect.top - sr.top) + "px"; sky.appendChild(plus); setTimeout(() => plus.remove(), 1000);
      setGuide("happy", ...pick(YES)); r++; setTimeout(round, 750);
    } else {
      misses++; tone("bad"); b.alive = false; b.el.style.transition = "opacity .4s, transform .4s"; b.el.style.opacity = ".15"; setGuide("sad", ...pick(NO));
    }
  };
  const loop = () => {
    const h = H();
    balloons.forEach(b => { if (!b.el.isConnected || b.el.classList.contains("popped")) return; b.y += b.sp * (h / 420) * 1.2; b.ph += .03; if (b.y > h + 20) b.y = -160; b.el.style.transform = `translate(${b.x + Math.sin(b.ph) * 10}px, ${-b.y}px)`; });
    S.raf = requestAnimationFrame(loop);
  };
  round(); S.raf = requestAnimationFrame(loop);
}
function gameMemory(p, d, back) {
  const pairs = shuffle(d.games.match).slice(0, 6);
  const cards = shuffle(pairs.flatMap((m, i) => [{ pair: i, t: m.left, v: m.visual }, { pair: i, t: m.right }]));
  let open = [], matched = 0, moves = 0, busy = false;
  const ic = THEMES[S.theme].icon;
  p.innerHTML = `<div class="gbar">${back}<span class="spacer"></span><span class="score">🔄 <span id="mv">0</span></span><span class="score">✅ <span id="mt">0</span>/${pairs.length}</span></div>
    <div class="mem">${cards.map((c, i) => `<button class="mcard" data-i="${i}"><div class="in"><div class="f bk">${ic}</div><div class="f ft">${c.v ? renderVisual(c.v) : esc(c.t)}</div></div></button>`).join("")}</div>`;
  $$(".mcard", p).forEach(el => el.onclick = () => {
    const i = +el.dataset.i;
    if (busy || el.classList.contains("open") || el.classList.contains("matched")) return;
    el.classList.add("open"); tone("flip"); open.push(i);
    if (open.length === 2) {
      moves++; $("#mv", p).textContent = moves; busy = true;
      const [a, b] = open, ea = $(`[data-i="${a}"]`, p), eb = $(`[data-i="${b}"]`, p);
      if (cards[a].pair === cards[b].pair) {
        setTimeout(() => { ea.classList.add("matched"); eb.classList.add("matched"); tone("good"); matched++; $("#mt", p).textContent = matched; open = []; busy = false; setGuide("happy", ...pick(YES));
          if (matched === pairs.length) setTimeout(() => { const n = pairs.length, st = moves <= n + 2 ? 3 : moves <= n * 2 ? 2 : 1; gameEnd(p, back, "memory", st, `All pairs found in ${moves} moves!`, `Tìm hết các cặp trong ${moves} lượt!`, () => gameMemory(p, d, back)); }, 700);
        }, 400);
      } else setTimeout(() => { ea.classList.remove("open"); eb.classList.remove("open"); tone("bad"); open = []; busy = false; }, 950);
    }
  });
}
function gameSort(p, d, back) {
  const items = shuffle(d.games.truefalse).slice(0, 8);
  let i = 0, right = 0, cnt = { t: 0, f: 0 }, busy = false;
  p.innerHTML = `<div class="gbar">${back}<span class="spacer"></span><span class="score">🃏 <span id="sN">1</span>/${items.length}</span><span class="score">✅ <span id="sR">0</span></span></div>
    <div class="sortzone" id="zone"><div id="sfb" style="position:absolute;left:0;right:0;top:200px;z-index:4;display:flex;justify-content:center"></div>
    <div class="baskets"><button class="basket t" data-b="t"><span class="e">✅</span>${bi("TRUE", "ĐÚNG", true)}<span class="cnt" id="ct">0</span></button><button class="basket f" data-b="f"><span class="e">❌</span>${bi("FALSE", "SAI", true)}<span class="cnt" id="cf">0</span></button></div></div>`;
  const zone = $("#zone", p);
  const next = () => {
    if (!zone.isConnected) return;
    $("#sfb", p).innerHTML = "";
    if (i >= items.length) { const pct = Math.round(right / items.length * 100); return gameEnd(p, back, "sort", starsFor(pct), `${right} of ${items.length} sorted correctly!`, `Phân loại đúng ${right} / ${items.length}!`, () => gameSort(p, d, back)); }
    $("#sN", p).textContent = i + 1; busy = false;
    const it = items[i];
    const card = document.createElement("div"); card.className = "scard"; card.innerHTML = `${it.visual ? renderVisual(it.visual) : ""}<div>${bi(it.statement, it.statement_vi)}</div><div style="margin-top:8px">${sayBtn(it.statement, it.statement_vi)}</div><div class="small muted" style="margin-top:6px">👆 ${bi("Drag me!", "Kéo thẻ!", true)}</div>`;
    zone.appendChild(card); card.style.animation = "popin .35s";
    let sx = 0, sy = 0, dx = 0, dy = 0, dragging = false;
    card.onpointerdown = e => { if (busy || e.target.closest("[data-say]")) return; dragging = true; sx = e.clientX; sy = e.clientY; card.setPointerCapture(e.pointerId); card.classList.add("drag"); card.classList.remove("back"); };
    card.onpointermove = e => { if (!dragging) return; dx = e.clientX - sx; dy = e.clientY - sy; card.style.transform = `translateX(calc(-50% + ${dx}px)) translateY(${dy}px) rotate(${dx / 18}deg)`;
      const over = basketAt(card); $$(".basket", zone).forEach(b => b.classList.toggle("hot", b === over)); };
    card.onpointerup = () => { if (!dragging) return; dragging = false; card.classList.remove("drag"); $$(".basket", zone).forEach(b => b.classList.remove("hot"));
      const over = basketAt(card) || (dx < -110 ? $('[data-b="t"]', zone) : dx > 110 ? $('[data-b="f"]', zone) : null);
      if (over) judge(card, over.dataset.b); else { card.classList.add("back"); card.style.transform = "translateX(-50%)"; } dx = dy = 0; };
  };
  const basketAt = card => { const c = card.getBoundingClientRect(), cx = c.left + c.width / 2, cy = c.top + c.height / 2;
    return $$(".basket", zone).find(b => { const r = b.getBoundingClientRect(); return cx > r.left - 30 && cx < r.right + 30 && cy > r.top - 80; }) || null; };
  const judge = (card, b) => {
    if (busy) return; busy = true;
    const it = items[i], ok = (b === "t") === it.answer;
    const send = (key) => { const bk = $(`[data-b="${key}"]`, zone), br = bk.getBoundingClientRect(), zr = zone.getBoundingClientRect(), cr = card.getBoundingClientRect();
      card.classList.add("fly"); card.style.transform = `translateX(calc(-50% + ${br.left + br.width / 2 - (cr.left + cr.width / 2)}px)) translateY(${br.top - cr.top}px) scale(.2)`; card.style.opacity = "0";
      setTimeout(() => { card.remove(); bk.classList.remove("bounce"); void bk.offsetWidth; bk.classList.add("bounce"); cnt[key]++; $("#c" + key, zone).textContent = cnt[key]; }, 450); };
    if (ok) { right++; $("#sR", p).textContent = right; tone("good"); setGuide("happy", it.why || pick(YES)[0], it.why ? it.why_vi : pick(YES)[1]); send(b); i++; setTimeout(next, 700); }
    else {
      tone("bad"); setGuide("sad", ...pick(NO)); card.classList.add("back"); card.style.transform = "translateX(-50%)"; card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
      $("#sfb", p).innerHTML = `<div class="fb bad" style="max-width:440px;box-shadow:var(--shadow)">${bi(`It's ${it.answer ? "TRUE" : "FALSE"}.`, `Câu này ${it.answer ? "ĐÚNG" : "SAI"}.`, true)}${it.why ? `<div style="margin-top:4px">${bi(it.why, it.why_vi)}</div>` : ""}<div style="text-align:center;margin-top:8px"><button class="btn btn-primary btn-sm" id="sOk">OK ➜</button></div></div>`;
      $("#sOk", p).onclick = () => { $("#sfb", p).innerHTML = ""; send(it.answer ? "t" : "f"); i++; setTimeout(next, 650); };
    }
  };
  $$(".basket", zone).forEach(bk => bk.onclick = () => { const c = $(".scard", zone); if (c) judge(c, bk.dataset.b); });
  next();
}
function gameSpeed(p, d, back) {
  const items = d.games.speed, numeric = items.every(i => i.answers.some(isNumericAnswer));
  let list = shuffle(items), i = 0, score = 0, miss = 0, left = 60;
  p.innerHTML = `<div class="card result">${back}<div style="font-size:70px;margin-top:10px">⏱️</div><h2>${bi("Beat the Clock", "Đua với thời gian")}</h2><p style="font-weight:700">${bi("Answer as many as you can in 60 seconds!", "Trả lời càng nhiều càng tốt trong 60 giây!")}</p><button class="btn btn-accent btn-lg" id="go">${bi("Ready… GO!", "Sẵn sàng… BẮT ĐẦU!", true)}</button></div>`;
  bindBack(p);
  $("#go", p).onclick = () => {
    p.innerHTML = `<div class="gbar">${back}<span class="spacer"></span><span class="score">✅ <span id="sS">0</span></span><span class="score">❌ <span id="sM">0</span></span></div>
      <div class="card sec" style="text-align:center"><div class="clock" id="sC">60</div><div class="timebar" style="margin-top:8px"><i id="sB" style="width:100%"></i></div>
      <div class="speedq" id="sQ"></div><div class="ansrow"><input type="text" class="ansin" id="sIn" autocomplete="off" inputmode="${numeric ? "none" : "text"}" placeholder="?"><button class="btn btn-good" id="sOk">✓</button><button class="btn btn-ghost btn-sm" id="sSkip">${bi("Skip", "Bỏ qua", true)} ⏭</button></div>${numeric ? keypad("sIn") : ""}</div>`;
    bindBack(p);
    const inp = $("#sIn", p);
    const show = () => { const it = list[i % list.length]; $("#sQ", p).innerHTML = (it.visual ? renderVisual(it.visual) : "") + esc(it.q); inp.value = ""; if (!numeric) inp.focus(); };
    const next = () => { i++; if (i % list.length === 0) list = shuffle(items); show(); };
    const submit = () => { if (!inp.value.trim()) return;
      if (isCorrect(inp.value, list[i % list.length].answers)) { score++; tone("good"); $("#sS", p).textContent = score; next(); }
      else { miss++; tone("bad"); $("#sM", p).textContent = miss; inp.classList.remove("shake"); void inp.offsetWidth; inp.classList.add("shake"); inp.select(); } };
    inp.onkeydown = e => { if (e.key === "Enter") submit(); };
    $("#sOk", p).onclick = submit; $("#sSkip", p).onclick = () => { miss++; $("#sM", p).textContent = miss; next(); };
    show();
    S.timer = setInterval(() => { left--; const c = $("#sC", p); if (!c) return stopAll(); c.textContent = left; $("#sB", p).style.width = (left / 60 * 100) + "%";
      if (left <= 0) { const st = score >= 15 ? 3 : score >= 10 ? 2 : score >= 5 ? 1 : 0; gameEnd(p, back, "speed", st, `${score} correct in 60 seconds!`, `Đúng ${score} câu trong 60 giây!`, () => gameSpeed(p, d, back)); } }, 1000);
  };
}

/* ---------- quiz adventure ---------- */
function renderQuiz(p, d) {
  const qs = d.quiz;
  if (!qs.length) { p.innerHTML = `<div class="card sec muted">No quiz for this activity.</div>`; return; }
  const Q = S.quiz || (S.quiz = { i: 0, picks: [], started: false });
  if (!Q.started) {
    const best = prog(S.current.id).quiz;
    p.innerHTML = `<div class="card result"><div class="trophy">🏆</div><h2>${bi("Quiz Adventure!", "Phiêu lưu kiểm tra!")}</h2>
      <p style="font-weight:700">${bi(`${qs.length} questions. Each right answer moves Sparky closer to the flag 🏁`, `${qs.length} câu hỏi. Mỗi câu đúng giúp Sparky tiến gần lá cờ 🏁`)}</p>
      ${best ? `<div style="font-size:28px">${starsHTML(best)}</div>` : ""}<button class="btn btn-primary btn-lg" id="qStart" style="margin-top:12px">${bi("Start", "Bắt đầu", true)} ▶</button></div>`;
    $("#qStart", p).onclick = () => { Q.started = true; Q.order = qs.map(q => ({ q, ord: shuffle(q.choices.map((_, k) => k)) })); tone("whoosh"); renderQuiz(p, d); };
    return;
  }
  const path = () => `<div class="path">${Q.order.map((o, i) => `${i ? `<span class="link"></span>` : ""}<span class="stone ${i < Q.picks.length ? (Q.picks[i] === o.q.answer ? "r" : "w") : ""} ${i === Q.i && i >= Q.picks.length ? "cur" : ""}">${i === Math.min(Q.i, Q.order.length - 1) && Q.i < Q.order.length ? `<span class="me">${mascotSVG()}</span>` : ""}${i < Q.picks.length ? (Q.picks[i] === o.q.answer ? "✓" : "✗") : i + 1}</span>`).join("")}<span class="flag">🏁</span></div>`;
  if (Q.i >= qs.length) {
    const right = Q.order.filter((o, i) => Q.picks[i] === o.q.answer).length, pct = Math.round(right / qs.length * 100), st = starsFor(pct);
    if (!Q.saved && st >= 1 && S.embed) markMissionDone(S.current.id);
    if (!Q.saved) { Q.saved = true; track("quiz", { task: "Quiz", score: `${right}/${qs.length} (${pct}%)`, stars: st, correct: right, total: qs.length }); award("quiz", st); refreshTabs(); if (st >= 2) confetti(); tone("win"); setGuide(st >= 2 ? "happy" : "think", ...PRAISE[st]); }
    p.innerHTML = `${path()}<div class="card result"><div class="trophy">${st >= 2 ? "🏆" : "🎖️"}</div>${starsHTML(st)}<h2>${bi(`${right} / ${qs.length} correct`, `Đúng ${right} / ${qs.length} câu`)}</h2><p style="font-weight:800">${bi(PRAISE[st][0], PRAISE[st][1])}</p>
      ${sendBox("Quiz", `${right}/${qs.length} (${pct}%)`, st)}
      ${S.embed && ON_SITE() ? (st >= 1 ? `<div class="mdone">🏁 ${bi("Mission complete!", "Hoàn thành nhiệm vụ!", true)} <a class="btn btn-accent" href="../">🗺️ ${bi("Back to my journey", "Về hành trình của em", true)}</a></div>` : `<div class="small" style="font-weight:800;margin:8px 0">${bi("Get at least 1 star to complete this mission. You can do it!", "Đạt ít nhất 1 sao để hoàn thành nhiệm vụ. Em làm được mà!", true)}</div>`) : ""}
      <div class="actions"><button class="btn btn-primary" id="qAgain">↻ ${bi("Try again", "Làm lại", true)}</button>${pct < 70 ? `<button class="btn btn-ghost" id="qLearn">📘 ${bi("Review the lesson", "Ôn lại bài", true)}</button>` : ""}<button class="btn btn-ghost" id="qRev">📋 ${bi("Check answers", "Xem đáp án", true)}</button></div>
      <div class="review hidden" id="rev">${Q.order.map((o, i) => { const ok = Q.picks[i] === o.q.answer; return `<div class="it"><div><b>${ok ? "✅" : "❌"} ${i + 1}.</b> ${bi(o.q.question, o.q.question_vi)}</div>
        ${!ok ? `<div class="small">${bi("You chose", "Em chọn", true)}: <b style="color:var(--bad)">${esc(o.q.choices[Q.picks[i]] ?? "—")}</b></div>` : ""}<div class="small">${bi("Answer", "Đáp án", true)}: <b style="color:var(--good)">${esc(o.q.choices[o.q.answer])}</b></div>
        ${o.q.explain ? `<div class="fb sol small">${bi(o.q.explain, o.q.explain_vi)}</div>` : ""}</div>`; }).join("")}</div></div>`;
    $("#qAgain", p).onclick = () => { S.quiz = null; renderQuiz(p, d); };
    $("#qLearn", p)?.addEventListener("click", () => { S.tab = "learn"; renderPlayer($("#main")); });
    $("#qRev", p).onclick = () => $("#rev", p).classList.toggle("hidden");
    return;
  }
  const o = Q.order[Q.i];
  p.innerHTML = `${path()}<div class="card qcard" id="qc"><div class="lvl" style="color:var(--c-quiz-d)">🏆 ${bi("Question", "Câu", true)} ${Q.i + 1} / ${qs.length}</div>
    <div class="qtext"><span style="flex:1">${bi(o.q.question, o.q.question_vi)}</span>${sayBtn(o.q.question, o.q.question_vi)}</div>
    ${renderVisual(o.q.visual)}
    <div class="choices">${o.ord.map((k, n) => `<button class="choice ch${n % 5}" data-qk="${k}"><span class="shp">${"▲◆●■★"[n % 5]}</span>${esc(o.q.choices[k])}</button>`).join("")}</div>
    <div id="fb"></div><div class="actions" id="acts"></div></div>`;
  bindVisuals(p);
  $(".path .cur", p)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  $$("[data-qk]", p).forEach(b => b.onclick = () => {
    const k = +b.dataset.qk, ok = k === o.q.answer; Q.picks[Q.i] = k;
    $$("[data-qk]", p).forEach(x => { x.disabled = true; if (+x.dataset.qk === o.q.answer) x.classList.add("right"); else if (x !== b) x.classList.add("dim"); });
    if (!ok) b.classList.add("wrong");
    if (ok) { tone("good"); setGuide("happy", ...pick(YES)); flyStar(b); } else { tone("bad"); setGuide("sad", ...pick(NO)); }
    $("#fb", p).innerHTML = `<div class="fb ${ok ? "good" : "bad"}">${ok ? "🎉 " + bi(...pick(YES), true) : "💭 " + bi("The right answer is:", "Đáp án đúng là:", true) + " <b>" + esc(o.q.choices[o.q.answer]) + "</b>"}${o.q.explain ? `<div style="margin-top:4px;font-weight:600">${bi(o.q.explain, o.q.explain_vi)}</div>` : ""}</div>`;
    $("#acts", p).innerHTML = `<button class="btn btn-primary btn-lg" id="qNext">${Q.i === qs.length - 1 ? bi("Finish", "Về đích", true) + " 🏁" : bi("Next", "Tiếp", true) + " ➜"}</button>`;
    $("#qNext", p).onclick = () => { Q.i++; tone("whoosh"); renderQuiz(p, d); };
  });
}

/* ===================== header & start ===================== */
const soundBtn = $("#soundBtn");
const syncTools = () => { soundBtn.classList.toggle("on", S.sound); soundBtn.textContent = S.sound ? "🔊" : "🔇"; };
soundBtn.onclick = () => { S.sound = !S.sound; store.set("sound", S.sound); syncTools(); tone("tap"); };
$("#themeBtn").onclick = themePicker;
$$("#nav button").forEach(b => b.onclick = () => go(b.dataset.view));
syncTools(); applyTheme(); updateStars();
$("#whoBtn").onclick = () => askName(true);
function readHash() { const m = location.hash.match(/^#act-([A-Za-z0-9-]+)$/); return m ? m[1] : null; }
window.addEventListener("hashchange", () => { if (S.ignoreHash) { S.ignoreHash = false; return; } const k = readHash(); if (k && (!S.current || linkKey(S.current) !== k)) { S.pendingKey = k; openFromKey(); } });
if (S.embed) {
  $("#nav").classList.add("hidden"); if (location.protocol === "file:") $("#offlineBadge").classList.remove("hidden");
  let data = S.embed.data; try { data = sanitize(S.embed.data); } catch {}
  S.formUrl = (window.__CONFIG__ && window.__CONFIG__.formUrl) || S.embed.formUrl || "";
  S.current = { id: S.embed.id || "offline", data }; S.view = "player"; S.tab = "learn";
  render(); updateWho(); askName();
  if (S.student) track("open", { task: "Started" });
  if (ON_SITE()) { $("#starCount").title = "Your stars"; $("#nav").insertAdjacentHTML("afterend", `<a class="pill jlink" href="../" title="My journey">🗺️ <span class="nl">My journey</span></a>`); }
} else if (/^#(results|missions)$/.test(location.hash)) {
  $("#nav").classList.add("hidden"); S.view = "results"; render();
} else if (ON_SITE()) {
  S.view = "journey"; updateWho(); updateStars(); render();
} else {
  S.formUrl = S.lib?.formUrl || "";
  const k = readHash();
  if (k) { S.pendingKey = k; S.direct = true; if (S.lib && openFromKey()) {} else render(); }
  else render();
  initCaps().then(() => { if (isTeacher()) { S.direct = false; if (S.view === "player") { $("#modal").classList.add("hidden"); render(); } } updateWho(); if (S.pendingKey) openFromKey(); });
}
})();
