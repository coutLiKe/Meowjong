"use strict";
/* ============================================================
   Meowjong — local stats ledger (Pillar 3 / G5)
   Purely additive counters recorded at existing hand-end hooks
   (doWin/drawGame in main.js). Local-only, never uploaded.
   ============================================================ */

const STATS_KEY = "meowjong-stats";

function statsDefault() {
  return {
    handsPlayed: 0, wins: 0, selfDraws: 0, instantWins: 0, dealIns: 0,
    flowersTotal: 0, biggestHand: 0,
  };
}

function statsLoad() {
  const raw = storeGet(STATS_KEY);
  if (!raw) return statsDefault();
  try {
    const d = JSON.parse(raw);
    return Object.assign(statsDefault(), d && typeof d === "object" ? d : {});
  } catch (e) { return statsDefault(); }
}

function statsSave(s) { storeSet(STATS_KEY, JSON.stringify(s)); }

/* Called once per finished hand from doWin()/drawGame(). Only tracks the
   local human's outcomes — party guests only see their own seat's result. */
function statsRecordHandEnd({ youWon = false, selfDraw = false, instantWin = false, flowers = 0, points = 0, dealtIn = false } = {}) {
  const s = statsLoad();
  s.handsPlayed++;
  if (youWon) {
    s.wins++;
    if (selfDraw) s.selfDraws++;
    if (instantWin) s.instantWins++;
    s.flowersTotal += flowers | 0;
    s.biggestHand = Math.max(s.biggestHand, points | 0);
  }
  if (dealtIn) s.dealIns++;
  statsSave(s);
}

function statsShow() {
  const s = statsLoad();
  const winRate = s.handsPlayed ? Math.round(100 * s.wins / s.handsPlayed) : 0;
  const avgFlowers = s.wins ? (s.flowersTotal / s.wins).toFixed(1) : "—";
  showModal(`<h2>📊 Your stats</h2>
    <ul class="standings">
      <li>Hands played: <b>${s.handsPlayed}</b></li>
      <li>Wins: <b>${s.wins}</b> <span class="log-dim">(${winRate}% win rate)</span></li>
      <li>Self-draw wins: <b>${s.selfDraws}</b></li>
      <li>Instant wins (三金倒 / 抢金): <b>${s.instantWins}</b></li>
      <li>Times you dealt in: <b>${s.dealIns}</b></li>
      <li>Average flowers on a win: <b>${avgFlowers}</b> 🌸</li>
      <li>Biggest single-hand score: <b>${s.biggestHand}</b> pts</li>
    </ul>
    <p class="log-dim">Tracked locally on this device only — never uploaded anywhere.</p>`,
    [
      { label: "Reset stats", cls: "secondary", cb: () => {
          showModal(`<h2>Reset stats?</h2><p>This clears everything above — it can't be undone.</p>`, [
            { label: "Reset", cls: "primary", cb: () => { statsSave(statsDefault()); statsShow(); } },
            { label: "Cancel", cls: "secondary", cb: statsShow },
          ]);
        } },
      { label: "Close", cls: "primary", cb: hideModal },
    ]);
}
