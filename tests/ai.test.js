"use strict";
const { loadGame, test, eq, ok, notOk } = require("./harness");
const { T } = loadGame();

/* ---------- chooseDiscard ---------- */

test("chooseDiscard never throws away a gold", () => {
  // three golds (kind 26) + three loners; the discard must be a loner
  const hand = [26, 26, 26, 0, 4, 8, 13];
  const d = T.chooseDiscard(hand, 26);
  ok(d && d.kind !== 26, "picked a non-gold to discard");
  ok([0, 4, 8, 13].includes(d.kind));
});

test("chooseDiscard sheds an isolated tile over a connected one", () => {
  // 3-4-5 dots connected + lone 9-char (kind 26) far away → discard the loner
  const d = T.chooseDiscard([2, 3, 4, 26], -1);
  eq(d.kind, 26, "the disconnected terminal goes");
});

/* ---------- roughShanten ---------- */

test("roughShanten is 0 for a ready (tenpai) hand", () => {
  eq(T.roughShanten([0, 1, 2, 9, 10, 11, 18, 19, 20, 3, 4, 8, 8], [], -1), 0);
});

test("roughShanten grows for messier hands", () => {
  const ready = T.roughShanten([0, 1, 2, 9, 10, 11, 18, 19, 20, 3, 4, 8, 8], [], -1);
  const messy = T.roughShanten([0, 3, 6, 9, 12, 15, 18, 21, 24, 26, 5, 13, 22], [], -1);
  ok(messy > ready, "scattered hand is further from ready");
});

test("a held gold lowers the distance to ready", () => {
  // same shape; one version has a gold standing in for a useful tile
  const base = T.roughShanten([0, 1, 9, 10, 18, 19, 3, 4, 5, 6, 22, 23, 8], [], -1);
  const withGold = T.roughShanten([0, 1, 9, 10, 18, 19, 3, 4, 5, 6, 22, 26, 8], 26 /*as melds? no*/ === 26 ? [] : [], 26);
  ok(withGold <= base, "a wild never makes you further from ready");
});

/* ---------- evalCounts sanity ---------- */

test("evalCounts rates a complete run above three scattered tiles", () => {
  const run = T.evalCounts(T.countsOf([0, 1, 2]));
  const scattered = T.evalCounts(T.countsOf([0, 3, 6]));
  ok(run > scattered);
});

/* ---------- table awareness (reads G) ---------- */

test("liveCount reflects visible copies from the player's view", () => {
  // reset a minimal solo table state
  T.G.river = [{ kind: 5, seat: 1 }, { kind: 5, seat: 2 }];
  T.G.seats.forEach(s => { s.hand = []; s.melds = []; s.flowers = []; s.drawn = null; });
  T.G.seats[0].hand = [5];            // I hold one more 5
  T.G.wildFlip = null; T.G.deadFlips = [];
  eq(T.liveCount(5, 0), 1, "4 - (2 river + 1 mine) = 1 left");
  eq(T.liveCount(9, 0), 4, "unseen tile → all 4 live");
});
