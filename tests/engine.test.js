"use strict";
const { loadGame, test, eq, ok, notOk } = require("./harness");
const { T } = loadGame();

const C = h => T.countsOf(h);
const win = (h, sets, wild) => T.isWinningCounts(C(h), sets, wild);

/* ---------- isWinningCounts: the wild-aware win detector ---------- */

test("pure win: 4 chi + a pair, no wilds", () => {
  // 0-1-2 dots, 3-4-5 dots, 9-10-11 bam, 18-19-20 char, 8-8 pair (14 tiles)
  ok(win([0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 8, 8], 4, -1));
});

test("pure win: 4 pungs + a pair", () => {
  ok(win([0, 0, 0, 9, 9, 9, 18, 18, 18, 26, 26, 26, 5, 5], 4, -1));
});

test("a non-winning 14-tile shape is rejected", () => {
  notOk(win([0, 2, 4, 6, 9, 11, 13, 15, 18, 20, 22, 24, 26, 8], 4, -1));
});

test("seven ISOLATED pairs is NOT a win (FJ has no seven-pairs hand)", () => {
  // pairs spaced so none can combine into runs → no valid 4 sets + pair
  notOk(win([0, 0, 4, 4, 8, 8, 9, 9, 13, 13, 17, 17, 22, 22], 4, -1));
});

test("but consecutive pairs that decompose into runs ARE a win", () => {
  // 1-2-3 ×2 + 4-5-6 ×2 + 7-pair — a legitimate all-runs hand
  ok(win([0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6], 4, -1));
});

test("wild completes a run (fills the missing middle tile)", () => {
  // 0,1 + wild(=2 dots) → 0-1-2 chi; rest are natural sets + pair. wild kind = 25.
  const hand = [0, 1, 25, 9, 10, 11, 18, 19, 20, 3, 4, 5, 8, 8];
  ok(win(hand, 4, 25), "with wild designated → win");
  notOk(win(hand, 4, -1), "same tiles, no wild → lone 8-char is not a win");
});

test("wild completes a triplet", () => {
  // 0,0 + wild → pung of dots-1. wild kind = 13.
  ok(win([0, 0, 13, 9, 10, 11, 18, 19, 20, 3, 4, 5, 8, 8], 4, 13));
});

test("CRITICAL: a wild can never be the pair/eyes", () => {
  // four complete natural sets + two wilds that could only serve as the pair
  const hand = [0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 26, 26]; // 26,26 are the wild
  notOk(win(hand, 4, 26), "wild pair is illegal → not a win");
  ok(win(hand, 4, 25), "same tiles but 26,26 natural pair (wild elsewhere) → win");
});

test("two wilds complete two different sets", () => {
  // 0,0+wild = pung, 9,10+wild = chi, + two natural sets + natural pair. wild = 13.
  ok(win([0, 0, 13, 9, 10, 13, 18, 19, 20, 3, 4, 5, 26, 26], 4, 13));
});

test("melded hand: setsNeeded reflects exposed sets", () => {
  // 2 melds already down → only 2 sets + pair needed from the 8 concealed tiles
  ok(T.isWinningCounts(C([0, 1, 2, 9, 10, 11, 26, 26]), 2, -1), "2 sets + pair");
  notOk(T.isWinningCounts(C([0, 1, 2, 9, 10, 12, 26, 26]), 2, -1), "broken run → no");
});

/* ---------- winningKinds: wait detection ---------- */

test("winningKinds finds an open wait (both ends of 3-4)", () => {
  // 0-1-2, 9-10-11, 18-19-20 chi + 8,8 pair + 3,4 waiting → needs 2(3dots) or 5(6dots)
  const waits = T.winningKinds([0, 1, 2, 9, 10, 11, 18, 19, 20, 3, 4, 8, 8], [], -1);
  eq(waits.slice().sort((a, b) => a - b), [2, 5], "open wait 2/5");
});

test("winningKinds never returns wind/honor tiles (can't be held)", () => {
  const waits = T.winningKinds([0, 1, 2, 9, 10, 11, 18, 19, 20, 3, 4, 8, 8], [], -1);
  ok(waits.every(k => k < 27), "all waits are suit tiles");
});

test("winningKinds: a complete-but-for-pair hand waits on the pair tile", () => {
  // 4 sets done + lone 8 → waits only on 8 (kind 7 = 8 dots)
  const waits = T.winningKinds([0, 1, 2, 3, 4, 5, 9, 10, 11, 18, 19, 20, 7], [], -1);
  eq(waits, [7]);
});

/* ---------- claim eligibility (gold can never be melded) ---------- */

test("canPung needs two matching non-gold tiles", () => {
  ok(T.canPung([5, 5, 9], 5, -1));
  notOk(T.canPung([5, 9], 5, -1), "only one copy");
  notOk(T.canPung([5, 5], 5, 5), "the tile IS the gold → cannot pung a gold");
});

test("canKongFromDiscard needs three, gold excluded", () => {
  ok(T.canKongFromDiscard([5, 5, 5, 9], 5, -1));
  notOk(T.canKongFromDiscard([5, 5, 9], 5, -1));
  notOk(T.canKongFromDiscard([5, 5, 5], 5, 5), "gold cannot be konged");
});

test("chowOptions returns the hand pairs that complete a run", () => {
  eq(T.chowOptions([0, 1], 2, -1), [[0, 1]], "1-2 + discard 3 → run");
  eq(T.chowOptions([1, 3], 2, -1), [[1, 3]], "2-4 + discard 3 → gap fill");
  eq(T.chowOptions([9, 10], 2, -1), [], "wrong suit → no chow");
  eq(T.chowOptions([0, 1], 2, 2), [], "discard is the gold → no chow");
});

test("concealedKongs / addedKongs, gold excluded", () => {
  eq(T.concealedKongs([5, 5, 5, 5, 9], -1), [5]);
  eq(T.concealedKongs([5, 5, 5, 5], 5), [], "four golds can't be declared a kong");
  eq(T.addedKongs([5, 9], [{ type: "pung", kind: 5 }], -1), [5], "hold 4th tile of an exposed pung");
  eq(T.addedKongs([5, 9], [{ type: "pung", kind: 5 }], 5), [], "gold pung can't be upgraded");
});
