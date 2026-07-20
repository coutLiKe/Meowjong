"use strict";
/* ============================================================
   Meowjong — Trophy Room (local achievements)
   Purely additive, local-only progression on top of the existing
   stats ledger (js/stats.js). No server, no currency, no FOMO —
   milestone-gated recognition of moments the FJ ruleset already
   makes special (three golds, robbing the gold, a clean match).
   ============================================================ */

const ACH_KEY = "meowjong-achievements";

const ACHIEVEMENTS = [
  { id: "first_win",    icon: "🏆", name: "First Win",      desc: "Win your first hand." },
  { id: "three_golds",  icon: "🥇", name: "Three Golds",    desc: "Win instantly with Three Golds 三金倒." },
  { id: "rob_gold",     icon: "💰", name: "Rob the Gold",   desc: "Win by Robbing the Gold 抢金." },
  { id: "no_flowers",   icon: "🌸", name: "No Flowers",     desc: "Win a hand holding zero flowers 无花." },
  { id: "flower_power", icon: "🌺", name: "Flower Power",   desc: "Win a hand holding 4 or more flowers." },
  { id: "self_made_10", icon: "🎯", name: "Self-Made",      desc: "Win 10 hands by self-draw 自摸." },
  { id: "century",      icon: "🀄", name: "Century Club",   desc: "Win 100 hands, lifetime." },
  { id: "streak_3",     icon: "🔥", name: "On a Roll",      desc: "Win 3 hands in a row." },
  { id: "iron_wall",    icon: "🛡️", name: "Iron Wall",      desc: "Finish a match without ever dealing in." },
  { id: "champion",     icon: "👑", name: "Grand Champion", desc: "Finish a match in 1st place." },
  { id: "daily_7",      icon: "📅", name: "Daily Devotee",  desc: "Play the Daily Hand on 7 different days." },
];

function achDefaultState() { return { unlocked: {}, streak: 0, bestStreak: 0, matchClean: true, dailyDays: [] }; }

function achLoad() {
  const raw = storeGet(ACH_KEY);
  if (!raw) return achDefaultState();
  try {
    const d = JSON.parse(raw);
    const merged = Object.assign(achDefaultState(), d && typeof d === "object" ? d : {});
    if (!merged.unlocked || typeof merged.unlocked !== "object") merged.unlocked = {};
    if (!Array.isArray(merged.dailyDays)) merged.dailyDays = [];
    return merged;
  } catch (e) { return achDefaultState(); }
}
function achSave(s) { storeSet(ACH_KEY, JSON.stringify(s)); }
function achUnlock(s, newly, id) { if (!s.unlocked[id]) { s.unlocked[id] = Date.now(); newly.push(id); } }

/* Queues unlock toasts one at a time so a multi-achievement hand doesn't
   stack a wall of text — reuses the existing board-toast + chime. */
function achToastQueue(newly) {
  if (!newly.length) return;
  let i = 0;
  const next = () => {
    if (i >= newly.length) return;
    const a = ACHIEVEMENTS.find(x => x.id === newly[i]);
    i++;
    if (a && typeof fxToast === "function") fxToast(`${a.icon} Achievement unlocked: ${a.name}`, "ready");
    if (typeof sndTenpai === "function") sndTenpai();
    setTimeout(next, 2600);
  };
  next();
}

/* Called once per finished hand, mirroring statsRecordHandEnd's hook points
   in doWin()/drawGame(). youLost distinguishes "someone else won" (breaks a
   streak) from a draw (leaves it alone). */
function achRecordHandEnd({ youWon = false, youLost = false, selfDraw = false, howType = "", flowers = 0, dealtIn = false } = {}) {
  const s = achLoad();
  const newly = [];
  const stats = typeof statsLoad === "function" ? statsLoad() : null;

  if (dealtIn) s.matchClean = false;

  if (youWon) {
    s.streak = (s.streak || 0) + 1;
    s.bestStreak = Math.max(s.bestStreak || 0, s.streak);
    if (stats && stats.wins >= 1) achUnlock(s, newly, "first_win");
    if (howType === "threegold") achUnlock(s, newly, "three_golds");
    if (howType === "qiangjin") achUnlock(s, newly, "rob_gold");
    if (flowers === 0) achUnlock(s, newly, "no_flowers");
    if (flowers >= 4) achUnlock(s, newly, "flower_power");
    if (stats && stats.selfDraws >= 10) achUnlock(s, newly, "self_made_10");
    if (stats && stats.wins >= 100) achUnlock(s, newly, "century");
    if (s.streak >= 3) achUnlock(s, newly, "streak_3");
  } else if (youLost) {
    s.streak = 0;
  }
  achSave(s);
  achToastQueue(newly);
}

/* Reset the "clean match" tracker at the start of every match (solo or
   party) — Iron Wall only credits a full match played start-to-finish. */
function achMatchStart() {
  const s = achLoad();
  s.matchClean = true;
  achSave(s);
}

function achRecordMatchEnd(youPlaceFirst) {
  const s = achLoad();
  const newly = [];
  if (s.matchClean) achUnlock(s, newly, "iron_wall");
  if (youPlaceFirst) achUnlock(s, newly, "champion");
  achSave(s);
  achToastQueue(newly);
}

function achRecordDailyPlay(seed) {
  const s = achLoad();
  const newly = [];
  if (!s.dailyDays.includes(seed)) s.dailyDays.push(seed);
  if (s.dailyDays.length >= 7) achUnlock(s, newly, "daily_7");
  achSave(s);
  achToastQueue(newly);
}

function achShow() {
  const s = achLoad();
  const rows = ACHIEVEMENTS.map(a => {
    const got = !!s.unlocked[a.id];
    return `<li class="${got ? "" : "log-dim"}">${got ? a.icon : "🔒"} <b>${a.name}</b> — ${a.desc}${got ? ` <span class="log-dim">✓ unlocked</span>` : ""}</li>`;
  }).join("");
  const count = Object.keys(s.unlocked).length;
  showModal(`<h2>🏆 Trophy Room</h2><p>${count} / ${ACHIEVEMENTS.length} unlocked${s.bestStreak ? ` · best streak <b>${s.bestStreak}</b>` : ""}</p><ul class="standings">${rows}</ul>`,
    [{ label: "Close", cls: "primary", cb: hideModal }]);
}
