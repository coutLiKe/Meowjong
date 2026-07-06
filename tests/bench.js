"use strict";
/* Micro-benchmark for the recursive evaluators (H6). Not a test — run manually:
   node tests/bench.js */
const { loadGame } = require("./harness");
const { T } = loadGame();

function timeIt(label, fn, iters) {
  fn(); // warm
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < iters; i++) fn();
  const t1 = process.hrtime.bigint();
  const ms = Number(t1 - t0) / 1e6;
  console.log(`${label.padEnd(52)} ${(ms / iters).toFixed(4)} ms/call   (${iters}x in ${ms.toFixed(1)}ms)`);
  return ms / iters;
}

// Pathological: a full one-suit (flush) hand with wilds — deepest branching.
const flush = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 8, 4]; // 13 dots-suit tiles
const wild = 4; // 5 of Dots is the gold → three copies of kind 4 float as wild
const flushMelds = [];

// A "coach turn" style sweep: shanten of every distinct discard from a 14-tile hand.
const hand14 = [0, 0, 1, 2, 3, 4, 5, 6, 7, 8, 8, 8, 4, 13];
function coachSweep() {
  let min = 9;
  const seen = new Set();
  for (let i = 0; i < hand14.length; i++) {
    const k = hand14[i];
    if (seen.has(k) || k === wild) continue;
    seen.add(k);
    const rest = hand14.slice(); rest.splice(i, 1);
    min = Math.min(min, T.roughShanten(rest, [], wild));
  }
  return min;
}

console.log("--- H6 evaluator benchmark (flush + wilds = worst case) ---\n");
timeIt("isWinningCounts(flush, 4, wild)", () => T.isWinningCounts(T.countsOf(flush.concat([0])), 4, wild), 20000);
timeIt("winningKinds(flush, wild)  [27-kind sweep]", () => T.winningKinds(flush, flushMelds, wild), 5000);
timeIt("roughShanten(flush, wild)", () => T.roughShanten(flush, flushMelds, wild), 5000);
timeIt("coachSweep (13x roughShanten)", coachSweep, 2000);
timeIt("evalCounts(flush)", () => T.evalCounts(T.countsOf(flush)), 20000);

// Rollout-scale: the Analyst runs ~80 sims × ~20 win-checks each per candidate.
console.log("");
timeIt("1600x isWinningCounts (one Analyst candidate)", () => {
  for (let i = 0; i < 1600; i++) T.isWinningCounts(T.countsOf(flush.concat([0])), 4, wild);
}, 50);
