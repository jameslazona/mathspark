
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
      pop: [[900, 0], [1400, .03]], flip: [[520, 0]], tap: [[740, 0]], whoosh: [[400, 0], [700, .05], [1000, .1]]
    };
    (seqs[kind] || seqs.tap).forEach(([f, t]) => {
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = kind === "bad" ? "sawtooth" : kind === "pop" ? "square" : "triangle"; o.frequency.value = f;
      const v = kind === "bad" ? .08 : .16;
      g.gain.setValueAtTime(.0001, AC.currentTime + t);
      g.gain.exponentialRampToValueAtTime(v, AC.currentTime + t + .015);
      g.gain.exponentialRampToValueAtTime(.0001, AC.currentTime + t + (kind === "pop" ? .08 : .17));
      o.connect(g).connect(AC.destination); o.start(AC.currentTime + t); o.stop(AC.currentTime + t + .22);
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
const VOICE_PREFS = [/jenny.*natural|aria.*natural|ava.*natural|emma.*natural/i, /google us english/i, /samantha/i, /sonia.*natural|libby.*natural/i, /google uk english female/i, /microsoft (jenny|aria|ava|emma|zira)/i, /allison|ava|susan/i, /microsoft (libby|sonia|hazel|susan)/i, /karen|serena|kate|tessa|moira/i];
let _ev = null;
function englishVoice() {
  if (_ev && voices.includes(_ev)) return _ev;
  const en = voices.filter(v => /^en[-_]/i.test(v.lang));
  const std = en.filter(v => /^en[-_](US|GB)/i.test(v.lang));
  for (const re of VOICE_PREFS) { const v = std.find(v => re.test(v.name)) || en.find(v => re.test(v.name)); if (v) return (_ev = v); }
  return (_ev = std.find(v => FEMALE.test(v.name) && !/male\b(?<!female)/i.test(v.name)) || en.find(v => FEMALE.test(v.name)) || std[0] || en[0] || null);
}
function clean(t) { return String(t).replace(/\p{Extended_Pictographic}|️|‍/gu, " ").replace(/\s*\|\s*/g, ", ").replace(/×/g, " times ").replace(/÷/g, " divided by ").replace(/\s+/g, " ").trim(); }
function speak(text, lang = "en", btn) {
  if (!synth) { toast("Read aloud isn't available on this device."); return; }
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(lang === "vi" ? String(text).replace(/\p{Extended_Pictographic}|️/gu, " ") : clean(text));
    const v = lang === "vi" ? (voices.find(v => /^vi/i.test(v.lang) && FEMALE.test(v.name)) || voices.find(v => /^vi/i.test(v.lang))) : englishVoice();
    if (v) u.voice = v; u.lang = v ? v.lang : (lang === "vi" ? "vi-VN" : "en-US"); u.rate = .88; u.pitch = 1;
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
function sendBox(task, score, stars) {
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
      S.student = { name, cls }; store.set("student", S.student); updateWho(); tone("win"); close(); setGuide("happy", `Hi ${name}! Let's play math!`); };
    $("#stGo", m).onclick = go; $$("input", m).forEach(i => i.onkeydown = e => { if (e.key === "Enter") go(); });
    setTimeout(() => $("#stName", m).focus(), 50);
  });
}
const starsHTML = n => `<div class="stars">${[0, 1, 2].map(i => `<span class="${i < n ? "" : "off"}">⭐</span>`).join("")}</div>`;
const PRAISE = [["Keep practising!", "Cố gắng luyện tập thêm nhé!"], ["Good try!", "Em cố gắng tốt lắm!"], ["Great job!", "Em làm tốt lắm!"], ["Amazing! You're a math star!", "Tuyệt vời! Em là ngôi sao toán học!"]];
const YES = [["Great job!", "Giỏi quá!"], ["You got it!", "Em làm đúng rồi!"], ["Super!", "Tuyệt vời!"], ["Wow, well done!", "Wow, giỏi lắm!"], ["Yes! Correct!", "Đúng rồi!"]];
const NO = [["Oops! Try again.", "Ồ! Thử lại nhé."], ["Almost! Look again.", "Gần đúng rồi! Nhìn lại nhé."], ["Not yet. You can do it!", "Chưa đúng. Em làm được mà!"]];

/* ===================== progress / stars ===================== */
function prog(id) { const all = store.get("prog", {}); return all[id] || { learn: 0, practice: 0, quiz: 0, games: {} }; }
function setProg(id, fn) { const all = store.get("prog", {}); const p = all[id] || { learn: 0, practice: 0, quiz: 0, games: {} }; fn(p); all[id] = p; store.set("prog", all); updateStars(); }
function actStars(p) { return (p.learn ? 1 : 0) + (p.practice || 0) + (p.quiz || 0) + Object.values(p.games || {}).reduce((a, b) => a + b, 0); }
function updateStars() { const all = store.get("prog", {}); $("#starCount b").textContent = Object.values(all).reduce((a, p) => a + actStars(p), 0); }
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
function guideHTML(en, vi) { return `<div class="guide"><div class="mascot" id="mascot">${mascotSVG()}</div><div class="bubble" id="bubble">${bi(en, vi)}</div></div>`; }
function setGuide(state, en, vi) {
  const m = $("#mascot"), b = $("#bubble");
  if (m) { m.className = "mascot"; void m.offsetWidth; if (state) m.classList.add(state); clearTimeout(setGuide._t); setGuide._t = setTimeout(() => m && (m.className = "mascot"), 1600); }
  if (b && en) { b.innerHTML = bi(en, vi); b.style.animation = "none"; void b.offsetWidth; b.style.animation = ""; }
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
    case "groups": { const g = (Array.isArray(v.groups) ? v.groups : []).slice(0, 3).map(n => int(n, 0, 12) ?? 0); return g.length && g.some(n => n > 0) ? { type: "groups", emoji: em(v.emoji), groups: g, style: v.style === "circles" ? "circles" : "" } : null; }
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
      h = `<div class="vgroups" data-count>${v.groups.map((n, g) => `<div class="hoop h${g} ${circ ? "circ" : ""}">${n ? Array.from({ length: n }, () => `<button class="obj" data-obj>${esc(v.emoji)}</button>`).join("") : `<span class="muted" style="font-weight:900">0</span>`}</div>`).join("")}</div>
        <div class="vhint">👆 ${bi("Tap to count", "Chạm để đếm", true)} <button data-reset>↺</button></div>`; break;
    case "tenframe": {
      const frames = v.count > 10 ? 2 : 1;
      h = `<div class="row" data-count style="justify-content:center">${Array.from({ length: frames }, (_, f) => `<div class="tf-grid">${Array.from({ length: 10 }, (_, i) => { const k = f * 10 + i; return k < v.count ? `<button class="tf-cell" data-obj><i></i></button>` : `<span class="tf-cell"></span>`; }).join("")}</div>`).join("")}</div>
        <div class="vhint">👆 ${bi("Tap to count", "Chạm để đếm", true)} <button data-reset>↺</button></div>`; break;
    }
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
      circles: arr(a.games?.circles).map(c => ({ total: int(c?.total, 2, 10), emoji: [...str(c?.emoji)].length && [...str(c?.emoji)].length <= 4 ? str(c.emoji) : "🔴" })).filter(c => c.total).slice(0, 8),
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
  m.innerHTML = `<div class="hero onbg"><div class="mascot">${mascotSVG()}</div><div class="bubble" style="margin-bottom:30px"><h1 style="font-size:inherit">${bi("Hi! I'm Sparky. Let's play math!", "Chào em! Mình là Sparky. Cùng chơi toán nhé!")}</h1></div></div>${body}`;
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
      <label class="check"><input type="checkbox" id="oVi" ${opt.vi ? "checked" : ""}> Add Vietnamese to the Key words</label>
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
    ? `Vietnamese goes ONLY in the vocabulary: fill each vocabulary "term_vi" and "meaning_vi" with natural, accurate Vietnamese using the standard math words Vietnamese textbooks use (e.g. phân số, mẫu số, phép cộng, chu vi, diện tích). Everything else is English only: leave every other *_vi field as "". Students are Vietnamese children with low English, so keep English simple.`
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
- {"type":"groups","emoji":"🐸","groups":[3,2],"style":"circles"}  objects in 1–3 groups (0–12 each); children tap them to count; "style":"circles" draws plain red circles like the book, "" draws red/blue hoops. When you say "first circle"/"second circle" use circles; only say "red hoop"/"blue hoop" with the hoop style
- {"type":"partwhole","whole":6,"parts":[2,null]}  part-whole (cherry) model; 2 or 3 parts; null shows "?"
- {"type":"tenframe","count":7}  ten frame(s), 0–20 counters
- {"type":"numberline","min":0,"max":10,"marks":[3],"jumps":[{"from":3,"to":7}]}
- {"type":"bar","whole":10,"parts":[6,null]}  bar model; whole may be null
- {"type":"fraction","num":3,"den":4,"shape":"circle"}  shape "circle" or "bar"; den 1–12
- {"type":"array","rows":3,"cols":4,"emoji":"🍎"}  up to 10×10
- {"type":"clock","h":3,"m":30}
- {"type":"shapes","items":["triangle","square"]}  from circle, square, triangle, rectangle, pentagon, hexagon, oval, star
Emoji pictures in the question text (like 🍎🍎🍎) are also fine for very young learners.

GAMES WITH MODELS — games can show visuals too: a match item's "visual" replaces its left text on the card (keep "left" as a short text label), and speed and truefalse items may have a "visual". When the lesson uses a part-whole model, number bonds, addition or subtraction, fill "games.model" with 10 part-whole puzzles that each have exactly ONE null (the missing whole or part), numbers from the lesson's range, and use partwhole visuals in many speed, truefalse and match items. Otherwise "model": [].

TWO CIRCLES GAME — when the lesson is about parts and wholes, grouping, sorting into 2 groups, number bonds or addition within 10, fill "games.circles" with 6 sets of objects (total 3–10, one emoji each); children drag them into two empty circles and complete "☐ is a part. ☐ is a part. The whole is ☐." Otherwise "circles": [].

PLAYGROUND — if the topic is number bonds, part-whole, addition or subtraction within 10, include "playground":{"kind":"split","total":N,"emoji":"🔴"} with N = 4–10 from the lesson (children move counters between two hoops). Otherwise set "playground": null.

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
   "circles": [ {"total":4,"emoji":"🟥"} ]
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

/* ===================== share & results (teacher) ===================== */
function renderShare(m) {
  if (!isTeacher()) { m.innerHTML = `<div class="card sec muted">Only the teacher can see this page.</div>`; return; }
  const list = S.activities;
  const f = parseForm(S.formUrl);
  m.innerHTML = `
  <div class="guide onbg"><div class="mascot" id="mascot">${mascotSVG()}</div><div class="bubble" id="bubble"><b>Share activities with your students.</b> Each activity is its own page on your website. A student can only open the activity in the link you send. No login.</div></div>
  <div class="card sec"><h2>1 · Student links (your website)</h2>
    <div>${list.map((a, i) => `<div class="file"><div class="thumb" style="background:#fff;font-size:26px;box-shadow:inset 0 0 0 2px #e5e7eb">${esc(a.data.icon || "🔢")}</div><div style="flex:1;min-width:0"><div class="nm">${esc(a.data.title)}</div><div class="st" style="word-break:break-all"><a href="${esc(actLink(a))}" target="_blank" rel="noopener">${esc(actLink(a))}</a></div></div>
      <button class="btn btn-ghost btn-sm" data-cp="${esc(actLink(a))}">📋 Copy</button><button class="btn btn-ghost btn-sm" data-web="${i}">⬇ Website page</button></div>`).join("") || `<p class="muted">No activities yet.</p>`}</div>
    <div class="notice" style="margin-top:14px"><b>Adding a new activity to the website</b>
      <ol style="margin:6px 0 0;padding-left:20px;line-height:1.7">
        <li>Press <b>⬇ Website page</b> next to the activity. It downloads a file called <b>index.html</b>.</li>
        <li>On GitHub, open your <b>mathspark</b> repository and click <b>Add file → Upload files</b>.</li>
        <li>Drag in <b>index.html</b>. Before committing, click the file name box at the top and type the folder name first, for example <b>number-bonds/</b>, so it becomes <b>number-bonds/index.html</b>. Use the folder name shown in the link.</li>
        <li>Click <b>Commit changes</b>. The link works a minute or two later.</li>
      </ol>
      <div class="small muted" style="margin-top:6px;font-weight:700">Changed an activity that's already on the website? Download its page again and upload it to the same folder to replace the old one. Book pictures you added are not included in website pages.</div></div>
  </div>
  <div class="card sec"><h2>2 · Results in Google Forms</h2>
    <p style="margin-top:0">At the end of Practice, each Game and the Quiz, students tap <b>📨 Send my result to my teacher</b>. Their name, class, activity and score go to your Google Form, and you see everything in a Google Sheet.</p>
    <ol style="line-height:1.7;padding-left:20px;margin:6px 0 12px">
      <li>Go to <a href="https://forms.google.com" target="_blank" rel="noopener">forms.google.com</a> and make a blank form called <b>MathSpark Results</b>.</li>
      <li>Add 6 <b>Short answer</b> questions, in this order: <b>Name</b>, <b>Class</b>, <b>Activity</b>, <b>Task</b>, <b>Score</b>, <b>Stars</b>.</li>
      <li>In <b>Settings → Responses</b>, turn OFF "Collect email addresses" and OFF "Restrict to users in your organisation".</li>
      <li>Click <b>⋮</b> (top right) → <b>Get pre-filled link</b>. Type exactly <b>NAME</b>, <b>CLASS</b>, <b>ACTIVITY</b>, <b>TASK</b>, <b>SCORE</b>, <b>STARS</b> in the 6 boxes, then <b>Get link → Copy link</b>.</li>
      <li>Paste the link below and press <b>Save</b>. On your website, the link also goes in <b>config.js</b> (you've already done this).</li>
      <li>In your form's <b>Responses</b> tab, click <b>Link to Sheets</b> to see all results in a spreadsheet.</li>
    </ol>
    <label class="f" for="formIn">Pre-filled link</label>
    <input type="text" id="formIn" value="${esc(S.formUrl)}" placeholder="https://docs.google.com/forms/d/e/…/viewform?usp=pp_url&entry.…=NAME…">
    <div id="formStat" class="small" style="font-weight:800;margin-top:6px">${f ? `✅ Connected: ${Object.keys(f.map).join(", ")}` : S.formUrl ? "⚠️ This link doesn't look right." : ""}</div>
    <div class="row" style="margin-top:10px"><button class="btn btn-primary btn-sm" id="formSave">💾 Save</button>${f ? `<a class="btn btn-ghost btn-sm" id="formTest" target="_blank" rel="noopener" href="#">🧪 Send a test result</a>` : ""}</div>
  </div>`;
  $$("[data-cp]", m).forEach(b => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.cp); toast("Link copied!"); } catch { toast(b.dataset.cp, 6000); } });
  $$("[data-web]", m).forEach(b => b.onclick = () => websitePage(list[+b.dataset.web]));
  $("#formSave", m).onclick = async () => {
    const v = $("#formIn", m).value.trim(), pf = parseForm(v);
    if (v && !pf) { $("#formStat", m).textContent = "⚠️ I couldn't find NAME and SCORE in this link. Check step 4."; tone("bad"); return; }
    try { await S.db.doc("settings/main").set({ formUrl: v }); S.formUrl = v; toast("Saved!"); render(); } catch { toast("Couldn't save the link."); }
  };
  const t = $("#formTest", m);
  if (t) { const cur = S.current; S.current = { id: "test", data: { title: "Test activity" } }; t.href = resultUrl("Test", "10/10", 3) || "#"; S.current = cur; }
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
  ${d.summary ? `<div class="card sec"><div class="row" style="font-size:19px;font-weight:800"><span style="font-size:30px">🎯</span><div style="flex:1">${bi(d.summary, d.summary_vi)}</div>${sayBtn(d.summary, d.summary_vi)}</div></div>` : ""}
  ${d.vocabulary.length ? `<div class="card sec"><h2>🔤 Key words <span class="vi-inline">· Từ vựng</span></h2><p class="small muted" style="margin:-4px 0 12px">${bi("Tap a card to flip it.", "Chạm vào thẻ để lật.", true)}</p>
    <div class="vocab">${d.vocabulary.map(v => `<div class="vcard"><div class="vinner">
      <div class="vface vfront">${v.emoji ? `<span class="em">${esc(v.emoji)}</span>` : ""}<b>${esc(v.term)}</b>${v.term_vi ? `<span class="vi">${esc(v.term_vi)}</span>` : ""}<div>${sayBtn(v.term, v.term_vi, true)}</div></div>
      <div class="vface vback"><div>${biV(v.meaning, v.meaning_vi)}</div><div>${sayBtn(v.meaning, v.meaning_vi, true)}</div></div></div></div>`).join("")}</div></div>` : ""}
  ${d.concepts.map((c, ci) => `<div class="card concept"><h3>${["💡", "🧠", "🔍", "⭐"][ci % 4]} ${bi(c.title, c.title_vi, true)}</h3><div class="row" style="align-items:flex-start;flex-wrap:nowrap"><div style="flex:1">${bi(c.explain, c.explain_vi)}</div>${sayBtn(c.explain, c.explain_vi)}</div>
    ${c.example ? `<div class="example"><div class="small" style="font-weight:900;color:var(--c-learn-d)">${bi("Example", "Ví dụ", true)}</div><div class="q row" style="flex-wrap:nowrap;align-items:flex-start"><div style="flex:1">${bi(c.example.problem, c.example.problem_vi)}</div>${sayBtn(c.example.problem, c.example.problem_vi)}</div>
      ${renderVisual(c.example.visual)}
      <ol class="stepper" id="st${ci}">${c.example.steps.map(s => `<li><div style="flex:1">${bi(s.en, s.vi)}</div>${sayBtn(s.en, s.vi)}</li>`).join("")}</ol>
      <div class="row" style="margin-top:10px"><button class="btn btn-accent btn-sm" data-step="${ci}">👣 ${bi("Next step", "Bước tiếp theo", true)}</button><span class="ans hidden" id="ans${ci}">✓ ${esc(c.example.answer)}</span></div></div>` : ""}</div>`).join("")}
  ${d.playground ? `<div id="pgWrap"></div>` : ""}
  <div class="row" style="justify-content:center;margin-top:10px"><button class="btn btn-primary btn-lg" id="learnDone">✅ ${bi("I'm ready to practise!", "Em sẵn sàng luyện tập!", true)}</button></div>`;
  bindVisuals(p);
  $$(".vcard", p).forEach(c => c.onclick = () => { c.classList.toggle("flip"); tone("flip"); });
  $$("[data-step]", p).forEach(b => b.onclick = () => {
    const ci = b.dataset.step, lis = $$(`#st${ci} li`, p), next = lis.find(l => !l.classList.contains("show"));
    if (next) { next.classList.add("show"); tone("tap"); }
    if (!lis.find(l => !l.classList.contains("show"))) { $(`#ans${ci}`, p).classList.remove("hidden"); b.classList.add("hidden"); tone("good"); setGuide("happy", "You solved the example!", "Em đã giải xong ví dụ!"); }
  });
  if (d.playground) renderPlayground($("#pgWrap", p), d.playground);
  $("#learnDone").onclick = e => { if (!prog(S.current.id).learn) flyStar(e.currentTarget); award("learn", 1); tone("win"); setTimeout(() => { S.tab = "practice"; renderPlayer($("#main")); scrollTo({ top: 0, behavior: "smooth" }); }, 700); };
}
function renderPlayground(el, pg) {
  const N = pg.total, side = Array(N).fill(0), found = new Set(), goal = N - 1;
  const draw = () => {
    const a = side.filter(s => s === 0).length, b = N - a;
    el.innerHTML = `<div class="card play"><h2>🧪 ${bi("Play with it!", "Cùng thử nào!", true)}</h2>
      <p style="margin:4px 0 0;font-weight:700">${bi(`Tap a ${pg.emoji} to move it to the other ${pg.style === "circles" ? "circle" : "hoop"}. Find all the ways to make ${N}!`, `Chạm vào ${pg.emoji} để chuyển sang vòng kia. Tìm tất cả các cách tạo thành ${N}!`)}</p>
      <div class="pg-area"><div class="pg-hoop ${pg.style === "circles" ? "circ" : ""}">${side.map((s, i) => s === 0 ? `<button class="obj" data-mv="${i}">${esc(pg.emoji)}</button>` : "").join("")}</div>
      <div class="pg-hoop b ${pg.style === "circles" ? "circ" : ""}">${side.map((s, i) => s === 1 ? `<button class="obj" data-mv="${i}">${esc(pg.emoji)}</button>` : "").join("")}</div></div>
      <div class="pg-out">${renderVisual({ type: "partwhole", whole: N, parts: [a, b] })}<div style="text-align:center"><div style="font-family:var(--fd);font-weight:800;font-size:26px">${a} and ${b} → ${N}</div>
      <div class="small muted" style="font-weight:800">${bi(`Ways found: ${found.size} / ${goal}`, `Số cách đã tìm: ${found.size} / ${goal}`, true)}</div>
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
      fb.innerHTML = `<div class="frame"><div><input class="fbox" id="f1" inputmode="none" autocomplete="off"> is a part.</div><div><input class="fbox" id="f2" inputmode="none" autocomplete="off"> is a part.</div><div>The whole is <input class="fbox" id="f3" inputmode="none" autocomplete="off">.</div></div>
        <div id="kpWrap">${keypad("f1")}</div><div class="actions"><button class="btn btn-good btn-lg" id="fChk">✓ Check</button></div><div id="ffb"></div>`;
      setGuide("", "Count each circle. Fill in the boxes!");
      const boxes = $$(".fbox", fb), pad = $(".keypad", fb);
      const act = b => { boxes.forEach(x => x.classList.toggle("on", x === b)); pad.dataset.for = b.id; };
      boxes.forEach(b => { b.onfocus = () => act(b); b.onclick = () => act(b); b.oninput = () => { b.value = b.value.replace(/\D/g, "").slice(0, 2); b.classList.remove("ok", "no"); }; b.onkeydown = e => { if (e.key === "Enter") check(); }; });
      act(boxes[0]);
      const check = () => {
        const v = boxes.map(b => parseInt(b.value)); if (v.some(isNaN)) { setGuide("think", "Fill in all three boxes."); return; }
        const okParts = (v[0] === a && v[1] === b) || (v[0] === b && v[1] === a), okWhole = v[2] === N;
        if (okParts && okWhole) {
          solved = true; boxes.forEach(b => { b.classList.remove("no"); b.classList.add("ok"); b.disabled = true; }); if (tries === 0) { firstTry++; flyStar($("#fChk", p)); }
          tone("good"); const msg = `${v[0]} is a part. ${v[1]} is a part. The whole is ${N}.`; setGuide("happy", msg); speak(msg);
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
    if (!Q.saved) { Q.saved = true; award("quiz", st); refreshTabs(); if (st >= 2) confetti(); tone("win"); setGuide(st >= 2 ? "happy" : "think", ...PRAISE[st]); }
    p.innerHTML = `${path()}<div class="card result"><div class="trophy">${st >= 2 ? "🏆" : "🎖️"}</div>${starsHTML(st)}<h2>${bi(`${right} / ${qs.length} correct`, `Đúng ${right} / ${qs.length} câu`)}</h2><p style="font-weight:800">${bi(PRAISE[st][0], PRAISE[st][1])}</p>
      ${sendBox("Quiz", `${right}/${qs.length} (${pct}%)`, st)}
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
  $("#nav").classList.add("hidden"); $("#offlineBadge").classList.remove("hidden");
  let data = S.embed.data; try { data = sanitize(S.embed.data); } catch {}
  S.formUrl = (window.__CONFIG__ && window.__CONFIG__.formUrl) || S.embed.formUrl || "";
  S.current = { id: S.embed.id || "offline", data }; S.view = "player"; S.tab = "learn";
  render(); updateWho(); askName();
} else {
  S.formUrl = S.lib?.formUrl || "";
  const k = readHash();
  if (k) { S.pendingKey = k; S.direct = true; if (S.lib && openFromKey()) {} else render(); }
  else render();
  initCaps().then(() => { if (isTeacher()) { S.direct = false; if (S.view === "player") { $("#modal").classList.add("hidden"); render(); } } updateWho(); if (S.pendingKey) openFromKey(); });
}
})();
