"use strict";
/* ============================================================
   Meowjong — Cat Chat: the reaction emote system (E1–E3)

   Design doc: docs/EMOTE_SYSTEM_PROPOSAL.md (sculpted-heads
   direction, approved 2026-07-11).

   Each emote is a sculpted SVG cat head — the tile-face line
   language over a gradient-lit dome — that pops out over a seat
   pill and plays a living loop (bob + independent ear wiggles).
   Zero assets: faces are composed strings like faces.js.

   Emotes are COMMUNICATION, not decoration: unlike fx.js, the
   head still renders (statically) at fx-off / reduced-motion,
   and every reaction writes a log line. Only the MOTION obeys
   the fx ladder: fx-full = 3D pop + living loop (fxDepth gate),
   fx-subtle = flat 2D pop, fx-off/reduced = static face.

   Party protocol (host-authoritative, see net.js):
     guest → host  { t:"emote", id }
     host  → guest { t:"emote", seat, id }   (seat pre-rotated)
   ============================================================ */

/* ---------- the roster ---------- */

const EMOTE_LOADOUT = ["happy", "laugh", "smug", "celebrate", "gg", "cry", "shock", "think"];

const EMOTE_RATE = { minGapMs: 2500, windowMs: 15000, maxInWindow: 4 };

/* ---------- face builder (same composition approach as faces.js) ---------- */

const EM_EARS =
  '<g class="earL"><path class="fl" d="M31,41 L20,12 L48,27 Z"/><path class="fi" d="M31,36 L26,19 L42,27 Z"/></g>' +
  '<g class="earR"><path class="fl" d="M69,41 L80,12 L52,27 Z"/><path class="fi" d="M69,36 L74,19 L58,27 Z"/></g>';
const EM_EARS_FLAT =
  '<g class="earL"><path class="fl" d="M32,40 L9,27 L39,22 Z"/><path class="fi" d="M31,36 L18,29 L35,26 Z"/></g>' +
  '<g class="earR"><path class="fl" d="M68,40 L91,27 L61,22 Z"/><path class="fi" d="M69,36 L82,29 L65,26 Z"/></g>';
const EM_HEAD = '<ellipse class="hd" cx="50" cy="57" rx="31" ry="27"/>';
const EM_WHISK = '<g class="wh"><path d="M9,51 L24,54"/><path d="M7,60 L24,60"/><path d="M9,69 L24,66"/>' +
  '<path d="M91,51 L76,54"/><path d="M93,60 L76,60"/><path d="M91,69 L76,66"/></g>';
const EM_WHISK_UP = '<g class="wh"><path d="M6,44 L23,53"/><path d="M4,58 L23,59"/><path d="M8,73 L24,65"/>' +
  '<path d="M94,44 L77,53"/><path d="M96,58 L77,59"/><path d="M92,73 L76,65"/></g>';
const EM_NOSE = '<path class="ns" d="M47,58.5 L53,58.5 L50,62.5 Z"/>';
const EM_EYES_HAPPY = '<path class="ln" d="M34,51 Q39,45 44,51"/><path class="ln" d="M56,51 Q61,45 66,51"/>';
const EM_EYES_SAD = '<path class="ln" d="M34,48 Q39,53 44,48"/><path class="ln" d="M56,48 Q61,53 66,48"/>';
const EM_MOUTH_W = '<path class="ln" d="M42,64 Q46,68.5 50,64 Q54,68.5 58,64" stroke-width="2.5"/>';
const EM_MOUTH_WINV = '<path class="ln" d="M42,68 Q46,63.5 50,68 Q54,63.5 58,68" stroke-width="2.5"/>';
const EM_MOUTH_OPEN = '<path class="fill" d="M39,63 Q50,80 61,63 Z"/><ellipse cx="50" cy="71.5" rx="5" ry="3" class="tong"/>';
const EM_BLUSH = '<ellipse class="bl" cx="30" cy="62" rx="4.5" ry="2.6"/><ellipse class="bl" cx="70" cy="62" rx="4.5" ry="2.6"/>';
/* sculpted-mode extras: soft bottom shade + glossy top-light */
const EM_SCULPT = '<ellipse cx="50" cy="74" rx="24" ry="9" fill="url(#mj-shadeG)"/>' +
  '<ellipse cx="38" cy="37" rx="11" ry="6" fill="#ffffff" opacity=".4" transform="rotate(-14 38 37)"/>';

function _emHeart(cx, cy, s) {
  return '<path class="hx" d="M' + cx + ',' + (cy + 4 * s) +
    ' C' + (cx - 6 * s) + ',' + (cy - 2 * s) + ' ' + (cx - 2.4 * s) + ',' + (cy - 6.5 * s) + ' ' + cx + ',' + (cy - 2.5 * s) +
    ' C' + (cx + 2.4 * s) + ',' + (cy - 6.5 * s) + ' ' + (cx + 6 * s) + ',' + (cy - 2 * s) + ' ' + cx + ',' + (cy + 4 * s) + ' Z"/>';
}
function _emPaw(cx, cy, rx, ry) {
  return '<ellipse class="fl" cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" stroke-width="2.5"/>' +
    '<path class="ln" d="M' + (cx - rx * .45) + ',' + (cy - ry * .8) + ' L' + (cx - rx * .45) + ',' + (cy - ry * .25) + '" stroke-width="1.8"/>' +
    '<path class="ln" d="M' + cx + ',' + (cy - ry * .95) + ' L' + cx + ',' + (cy - ry * .35) + '" stroke-width="1.8"/>' +
    '<path class="ln" d="M' + (cx + rx * .45) + ',' + (cy - ry * .8) + ' L' + (cx + rx * .45) + ',' + (cy - ry * .25) + '" stroke-width="1.8"/>';
}

const EMOTE_ART = {
  happy: EM_EARS + EM_HEAD + EM_WHISK + EM_EYES_HAPPY + EM_BLUSH + EM_NOSE + EM_MOUTH_W,
  laugh: EM_EARS + EM_HEAD + EM_WHISK +
    '<path class="ln" d="M34,46 L42,51 L34,56"/><path class="ln" d="M66,46 L58,51 L66,56"/>' +
    EM_NOSE + EM_MOUTH_OPEN + '<path class="tr" d="M29,54 q-3,4 -1,8"/>',
  sad: EM_EARS_FLAT + EM_HEAD + EM_WHISK + EM_EYES_SAD + EM_NOSE + EM_MOUTH_WINV,
  cry: EM_EARS_FLAT + EM_HEAD + EM_WHISK +
    '<path class="ln" d="M34,51 L44,51"/><path class="ln" d="M56,51 L66,51"/>' +
    '<path class="tr" d="M38,55 q-2,9 0,17"/><path class="tr" d="M62,55 q2,9 0,17"/>' +
    '<circle cx="36" cy="77" r="1.7" class="trf"/><circle cx="64" cy="77" r="1.7" class="trf"/>' +
    EM_NOSE + EM_MOUTH_WINV,
  angry: EM_EARS_FLAT + EM_HEAD + EM_WHISK +
    '<path class="ln" d="M33,44 L44,48"/><path class="ln" d="M67,44 L56,48"/>' +
    '<circle class="fill" cx="40" cy="53" r="2.4"/><circle class="fill" cx="60" cy="53" r="2.4"/>' +
    EM_NOSE + '<path class="ln" d="M44,67 Q50,63.5 56,67" stroke-width="2.5"/>' +
    '<g class="hxln"><path d="M76,13 L80,18"/><path d="M86,13 L82,18"/><path d="M76,25 L80,20"/><path d="M86,25 L82,20"/></g>',
  shock: EM_EARS + EM_HEAD + EM_WHISK_UP +
    '<circle cx="39" cy="51" r="6.5" class="eye"/><circle cx="61" cy="51" r="6.5" class="eye"/>' +
    '<circle class="fill" cx="39" cy="52" r="2"/><circle class="fill" cx="61" cy="52" r="2"/>' +
    EM_NOSE + '<ellipse class="fill" cx="50" cy="69" rx="3.4" ry="4.4"/>' +
    '<g class="ln" stroke-width="2"><path d="M24,7 L28,14"/><path d="M50,3 L50,10"/><path d="M76,7 L72,14"/></g>',
  love: EM_EARS + EM_HEAD + EM_WHISK + _emHeart(39, 51, 1.35) + _emHeart(61, 51, 1.35) +
    EM_BLUSH + EM_NOSE + EM_MOUTH_W + _emHeart(79, 21, .8) + _emHeart(23, 15, .6),
  smug: EM_EARS + EM_HEAD + EM_WHISK +
    '<path class="ln" d="M33,49 L45,49"/><path class="ln" d="M55,49 L67,49"/>' +
    '<path class="ln" d="M37,49 Q40,52.5 43,49" stroke-width="2.5"/><path class="ln" d="M57,49 Q60,52.5 63,49" stroke-width="2.5"/>' +
    '<path class="ln" d="M55,41.5 Q61,38.5 67,41.5" stroke-width="2.5"/>' +
    EM_NOSE + '<path class="ln" d="M43,65 Q51,70 59,62" stroke-width="2.5"/>',
  sleepy: EM_EARS_FLAT + EM_HEAD + EM_WHISK + EM_EYES_SAD + EM_NOSE +
    '<path class="ln" d="M46,66 Q50,68.5 54,66" stroke-width="2.5"/>' +
    '<text class="ztxt" x="70" y="25" font-size="12">z</text><text class="ztxt" x="79" y="15" font-size="8.5">z</text>',
  think: EM_EARS + EM_HEAD + EM_WHISK +
    '<path class="ln" d="M35,50 Q39,47.5 43,50"/><path class="ln" d="M57,50 Q61,47.5 65,50"/>' +
    EM_NOSE + '<path class="ln" d="M44,66.5 L54,64.5" stroke-width="2.5"/>' + _emPaw(59, 73, 9.5, 7) +
    '<text class="qtxt" x="72" y="29" font-size="16">?</text>',
  celebrate: EM_EARS + EM_HEAD + EM_EYES_HAPPY + EM_BLUSH + EM_NOSE + EM_MOUTH_OPEN +
    _emPaw(15, 41, 7, 8) + _emPaw(85, 41, 7, 8) +
    '<rect x="24" y="8" width="4" height="4" rx="1" class="cf1" transform="rotate(18 26 10)"/>' +
    '<rect x="70" y="5" width="4" height="4" rx="1" class="cf2" transform="rotate(-14 72 7)"/>' +
    '<circle cx="52" cy="6" r="2" class="cf3"/><circle cx="10" cy="22" r="2" class="cf4"/>' +
    '<rect x="88" y="18" width="3.5" height="3.5" rx="1" class="cf3" transform="rotate(24 90 20)"/>',
  pawsup: EM_EARS + EM_HEAD + EM_WHISK + EM_EYES_HAPPY + EM_BLUSH + EM_NOSE + EM_MOUTH_W +
    '<ellipse class="fl" cx="69" cy="74" rx="11" ry="9.5" stroke-width="2.5"/>' +
    '<ellipse class="bl" cx="63.5" cy="70" rx="2.1" ry="2.6"/><ellipse class="bl" cx="69" cy="68.5" rx="2.1" ry="2.6"/>' +
    '<ellipse class="bl" cx="74.5" cy="70" rx="2.1" ry="2.6"/><ellipse class="bl" cx="69" cy="77" rx="4.4" ry="3.2"/>',
  facepalm: EM_EARS + EM_HEAD + EM_WHISK + EM_NOSE +
    '<path class="ln" d="M45,68.5 L55,68.5" stroke-width="2.5"/>' +
    '<ellipse class="fl" cx="50" cy="50" rx="17" ry="9" stroke-width="2.5"/>' +
    '<path class="ln" d="M42,43.5 L42,50" stroke-width="1.8"/><path class="ln" d="M50,42.5 L50,50" stroke-width="1.8"/><path class="ln" d="M58,43.5 L58,50" stroke-width="1.8"/>',
  gg: EM_EARS + EM_HEAD + EM_WHISK + EM_EYES_HAPPY + EM_NOSE +
    '<path class="ln" d="M44,65 Q50,69 56,65" stroke-width="2.5"/>' +
    '<path class="ln" d="M71,71 L71,31" stroke-width="2.5"/>' +
    '<path d="M71,31 L94,36.5 L71,44 Z" class="flag"/>' +
    '<text x="76" y="40.5" font-size="7" class="flagtxt">GG</text>' +
    '<ellipse class="fl" cx="71" cy="72" rx="5.5" ry="4.5" stroke-width="2.5"/>',
};

/* id → { label (wheel/a11y), glyph (log flavor), verb / verbYou (log line,
   third person for the cats & guests, second person for the solo "You"),
   mood (synthesized sound in sound.js) } */
const EMOTES = {
  happy:     { label: "Happy",       glyph: "😸", verb: "beams",           verbYou: "beam",           mood: "happy" },
  laugh:     { label: "Laughing",    glyph: "😹", verb: "laughs",          verbYou: "laugh",          mood: "laugh" },
  sad:       { label: "Sad",         glyph: "😿", verb: "droops",          verbYou: "droop",          mood: "sad" },
  cry:       { label: "Crying",      glyph: "😿", verb: "cries",           verbYou: "cry",            mood: "sad" },
  angry:     { label: "Angry",       glyph: "😾", verb: "fumes",           verbYou: "fume",           mood: "angry" },
  shock:     { label: "Shocked",     glyph: "🙀", verb: "is shocked",      verbYou: "are shocked",    mood: "shock" },
  love:      { label: "Heart eyes",  glyph: "😻", verb: "has heart eyes",  verbYou: "have heart eyes", mood: "love" },
  smug:      { label: "Smug",        glyph: "😼", verb: "looks smug",      verbYou: "look smug",      mood: "smug" },
  sleepy:    { label: "Sleepy",      glyph: "😽", verb: "yawns",           verbYou: "yawn",           mood: "sleepy" },
  think:     { label: "Thinking",    glyph: "🤔", verb: "is thinking",     verbYou: "are thinking",   mood: "think" },
  celebrate: { label: "Celebration", glyph: "🎉", verb: "celebrates",      verbYou: "celebrate",      mood: "fanfare" },
  pawsup:    { label: "Paws up",     glyph: "👍", verb: "gives a paws-up", verbYou: "give a paws-up", mood: "happy" },
  facepalm:  { label: "Facepalm",    glyph: "🫣", verb: "facepalms",       verbYou: "facepalm",       mood: "sad" },
  gg:        { label: "GG",          glyph: "🏳️", verb: "says GG",         verbYou: "say GG",         mood: "gg" },
};

function emoteFaceSVG(id) {
  const art = EMOTE_ART[id];
  if (!art) return "";
  return '<svg class="em" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
    art + EM_SCULPT + '</svg>';
}

/* ---------- rate limiter (host-authoritative; mirrored client-side) ----------
   Pure and clock-injectable so tests can drive it. One bucket per key. */
const _emoteTimes = Object.create(null);
function emoteRateOk(key, now) {
  now = now === undefined ? Date.now() : now;
  const arr = _emoteTimes[key] || (_emoteTimes[key] = []);
  while (arr.length && now - arr[0] > EMOTE_RATE.windowMs) arr.shift();
  if (arr.length && now - arr[arr.length - 1] < EMOTE_RATE.minGapMs) return false;
  if (arr.length >= EMOTE_RATE.maxInWindow) return false;
  arr.push(now);
  return true;
}

/* ---------- the popping head (visual only) ---------- */

const EMO = {
  live: {},        // seat → { el, timers }
  cool: {},        // seat → last AI-reaction timestamp
  wheelOpen: false,
  _prevFocus: null,
};

function _emoteMotion() { return typeof fxMotion === "function" ? fxMotion() : false; }
function _emoteDepth() { return typeof fxDepth === "function" ? fxDepth() : false; }

function _emotePill(seat) {
  if (typeof document === "undefined" || !document.querySelector) return null;
  return seat === 0 ? document.querySelector("#player-top")
                    : document.querySelector("#opp-" + seat + " .opp-top");
}

/* Show the head over a seat pill. Pure presentation — no log, no network. */
function emoteShow(seat, id) {
  const def = EMOTES[id];
  const pill = _emotePill(seat);
  if (!def || !pill || typeof pill.getBoundingClientRect !== "function") return;
  const r = pill.getBoundingClientRect();
  if (!r.width) return;

  // one head per seat: a new emote replaces the old one
  const prev = EMO.live[seat];
  if (prev) { try { prev.el.remove(); } catch (_) {} prev.timers.forEach(clearTimeout); }

  const motion = _emoteMotion();
  const mode = !motion ? "em-static" : _emoteDepth() ? "em-3d" : "em-2d";
  const el = document.createElement("div");
  el.className = "emote-head";
  el.innerHTML = '<div class="em-pop ' + mode + '"><div class="em-bob">' + emoteFaceSVG(id) + "</div></div>";
  el.style.left = (r.left + r.width / 2 - 48) + "px";
  el.style.top = Math.max(4, r.top - 96 - 10) + "px";
  document.body.appendChild(el);

  if (motion && typeof fxPulse === "function") fxPulse(pill, "fx-bounce", 650);
  if (typeof sndEmote === "function") sndEmote(def.mood);

  const timers = [];
  const rec = { el, timers };
  EMO.live[seat] = rec;
  if (motion) {
    timers.push(setTimeout(() => { const p = el.querySelector(".em-pop"); if (p) p.classList.add("em-out"); }, 2460));
    timers.push(setTimeout(() => { el.remove(); if (EMO.live[seat] === rec) delete EMO.live[seat]; }, 3100));
  } else {
    timers.push(setTimeout(() => { el.remove(); if (EMO.live[seat] === rec) delete EMO.live[seat]; }, 2400));
  }
}

/* ---------- the full reaction (authority path: solo, or party host) ----------
   Narrates to the log (which the host already broadcasts to guests), shows the
   head locally, and broadcasts the visual to party guests. */
function emoteReact(seat, id) {
  const def = EMOTES[id];
  const s = typeof G !== "undefined" && G.seats && G.seats[seat];
  if (!def || !s) return;
  if (typeof log === "function") {
    const esc = typeof escapeHtml === "function" ? escapeHtml : x => x;
    const verb = s.name === "You" ? def.verbYou : def.verb;
    log(`${s.emoji} <b>${esc(s.name)}</b> ${verb} ${def.glyph}`, "log-dim");
  }
  emoteShow(seat, id);
  if (typeof netBroadcastEmote === "function") netBroadcastEmote(seat, id);
}

/* The local player emotes (wheel / hotkey). Guests route through the host,
   which validates + rate-limits + echoes back; solo/host handle it directly. */
function emoteSend(id) {
  if (!EMOTES[id]) return;
  const isGuest = typeof NET !== "undefined" && NET.role === "guest";
  if (!emoteRateOk("me")) {   // client-side mirror of the host limit
    if (typeof fxToast === "function") fxToast("Let the cat rest a moment 🐾", "info");
    return;
  }
  if (isGuest) {
    try { NET.conn.send({ t: "emote", id }); } catch (_) {}
  } else {
    emoteReact(0, id);
  }
}

/* ---------- context-sensitive AI cat reactions (replaces the hardcoded 😼) ----------
   Only the authority (solo / party host) triggers these; guests receive the
   broadcast. Per-seat 10 s cooldown keeps the table lively but not noisy. */
const EMOTE_EVENTS = {
  claim:   { ids: ["smug"], chance: 0.8 },
  chi:     { ids: ["happy"], chance: 0.5 },
  dealin:  { ids: ["cry", "shock"], chance: 1.0 },
  win:     { ids: ["celebrate"], chance: 1.0 },
  bigwin:  { ids: ["shock"], chance: 1.0 },     // someone else's instant win
  flowers: { ids: ["love"], chance: 0.6 },
  draw:    { ids: ["sad"], chance: 0.6 },
};
const EMOTE_COOLDOWN_MS = 10000;

function emoteCatReact(seat, event) {
  const ev = EMOTE_EVENTS[event];
  const s = typeof G !== "undefined" && G.seats && G.seats[seat];
  if (!ev || !s || s.control !== "ai") return;
  if (typeof NET !== "undefined" && NET.role === "guest") return;   // host decides
  const now = Date.now();
  const important = event === "win" || event === "dealin" || event === "bigwin";
  if (!important && EMO.cool[seat] && now - EMO.cool[seat] < EMOTE_COOLDOWN_MS) return;
  if (Math.random() > ev.chance) return;
  EMO.cool[seat] = now;
  emoteReact(seat, ev.ids[Math.floor(Math.random() * ev.ids.length)]);
}

/* ---------- the emote wheel (E2) ---------- */

function emoteWheelClose() {
  const w = typeof document !== "undefined" && document.getElementById && document.getElementById("emote-wheel");
  if (!w || !EMO.wheelOpen) return;
  EMO.wheelOpen = false;
  w.classList.add("hidden");
  if (EMO._prevFocus && EMO._prevFocus.focus) { try { EMO._prevFocus.focus(); } catch (_) {} }
  EMO._prevFocus = null;
}

function emoteWheelOpen() {
  const w = document.getElementById("emote-wheel");
  if (!w || EMO.wheelOpen) return;
  // never over a modal, and never on the menu/loading screens
  const overlay = document.getElementById("modal-overlay");
  if (overlay && !overlay.classList.contains("hidden")) return;
  for (const id of ["screen-menu", "screen-loading"]) {
    const sc = document.getElementById(id);
    if (sc && !sc.classList.contains("hidden")) return;
  }
  EMO.wheelOpen = true;
  // CSS centers it by default; when the dock is measurable, lift it just above
  w.style.top = "";
  w.style.marginTop = "";
  const dock = document.getElementById("dock");
  const dr = dock ? dock.getBoundingClientRect() : null;
  if (dr && dr.width && window.innerHeight > 320) {
    w.style.top = Math.min(Math.max(8, dr.top - 240 - 12), window.innerHeight - 248) + "px";
    w.style.marginTop = "0";
  }
  w.classList.remove("hidden");
  EMO._prevFocus = document.activeElement;
  const first = w.querySelector(".emote-slot");
  if (first) first.focus();
}

function emoteWheelToggle() { EMO.wheelOpen ? emoteWheelClose() : emoteWheelOpen(); }

function _emoteWheelPick(id) {
  emoteWheelClose();
  emoteSend(id);
}

/* Inject the shared SVG gradients, the wheel, and the 😺 dock button.
   Called once from main.js's DOMContentLoaded; every guard below keeps it a
   no-op in headless/test environments. */
function emoteInit() {
  if (typeof document === "undefined" || !document.body || document.getElementById("emote-wheel")) return;

  // shared gradient defs (referenced by every face via url(#…))
  const defs = document.createElement("div");
  defs.setAttribute("aria-hidden", "true");
  defs.style.position = "absolute";
  defs.style.width = "0";
  defs.style.height = "0";
  defs.style.overflow = "hidden";
  defs.innerHTML = '<svg width="0" height="0"><defs>' +
    '<radialGradient id="mj-headG" cx="36%" cy="30%" r="82%">' +
    '<stop offset="0%" stop-color="#fffef9"/><stop offset="45%" stop-color="#f8ecd2"/>' +
    '<stop offset="85%" stop-color="#e5cfa6"/><stop offset="100%" stop-color="#d2b789"/></radialGradient>' +
    '<radialGradient id="mj-earG" cx="40%" cy="30%" r="80%">' +
    '<stop offset="0%" stop-color="#f5ab7e"/><stop offset="100%" stop-color="#d2703f"/></radialGradient>' +
    '<radialGradient id="mj-shadeG" cx="50%" cy="50%" r="50%">' +
    '<stop offset="0%" stop-color="rgba(74,52,38,.20)"/><stop offset="70%" stop-color="rgba(74,52,38,0)"/></radialGradient>' +
    "</defs></svg>";
  document.body.appendChild(defs);

  // the wheel: 8 loadout slots on a circle + a hub label
  const w = document.createElement("div");
  w.id = "emote-wheel";
  w.className = "hidden";
  w.setAttribute("role", "menu");
  w.setAttribute("aria-label", "Emote wheel");
  const R = 88, C = 120;   // slot-ring radius, wheel center (240px box)
  EMOTE_LOADOUT.forEach((id, i) => {
    const a = (i * 45 - 90) * Math.PI / 180;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "emote-slot";
    b.setAttribute("role", "menuitem");
    b.setAttribute("aria-label", "Send " + EMOTES[id].label + " (" + (i + 1) + ")");
    b.title = EMOTES[id].label + " — " + (i + 1);
    b.style.left = (C + R * Math.cos(a)) + "px";
    b.style.top = (C + R * Math.sin(a)) + "px";
    b.innerHTML = emoteFaceSVG(id);
    b.addEventListener("click", () => _emoteWheelPick(id));
    w.appendChild(b);
  });
  const hub = document.createElement("div");
  hub.className = "emote-hub";
  hub.textContent = "Esc";
  w.appendChild(hub);
  document.body.appendChild(w);

  // the 😺 button on your pill — the discoverability anchor
  const pt = document.getElementById("player-top");
  if (pt) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "emote-btn";
    btn.title = "React — press E";
    btn.setAttribute("aria-label", "Open the emote wheel");
    btn.textContent = "😺";
    btn.addEventListener("click", e => { e.stopPropagation(); emoteWheelToggle(); });
    pt.appendChild(btn);
  }

  // keyboard: E toggles · 1–8 select while open · Shift+1–8 instant · Esc closes
  document.addEventListener("keydown", e => {
    const t = e.target;
    if (t && t.matches && t.matches("input, textarea, select")) return;
    const overlay = document.getElementById("modal-overlay");
    const modalUp = overlay && !overlay.classList.contains("hidden");
    if (e.key === "Escape" && EMO.wheelOpen) { e.preventDefault(); emoteWheelClose(); return; }
    if ((e.key === "e" || e.key === "E") && !e.metaKey && !e.ctrlKey && !e.altKey && !modalUp) {
      e.preventDefault();
      emoteWheelToggle();
      return;
    }
    if (e.shiftKey && /^Digit[1-8]$/.test(e.code) && !modalUp) {   // instant hotkey
      e.preventDefault();
      const id = EMOTE_LOADOUT[Number(e.code.slice(5)) - 1];
      if (id) { emoteWheelClose(); emoteSend(id); }
      return;
    }
    if (!EMO.wheelOpen) return;
    if (/^[1-8]$/.test(e.key)) { e.preventDefault(); _emoteWheelPick(EMOTE_LOADOUT[Number(e.key) - 1]); return; }
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const slots = Array.prototype.slice.call(document.querySelectorAll("#emote-wheel .emote-slot"));
      const cur = slots.indexOf(document.activeElement);
      const dir = (e.key === "ArrowRight" || e.key === "ArrowDown") ? 1 : -1;
      const next = slots[((cur < 0 ? 0 : cur) + dir + slots.length) % slots.length];
      if (next) next.focus();
    }
  });

  // clicking anywhere outside closes the wheel
  document.addEventListener("click", e => {
    if (!EMO.wheelOpen) return;
    const w2 = document.getElementById("emote-wheel");
    const btn = document.getElementById("emote-btn");
    if (w2 && !w2.contains(e.target) && e.target !== btn) emoteWheelClose();
  });
}
