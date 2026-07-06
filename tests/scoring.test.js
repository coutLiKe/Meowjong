"use strict";
const { loadGame, test, eq, ok } = require("./harness");
const { T } = loadGame();

const total = (flowers, opts) => T.fjScore({ flowers }, opts || {}).total;

/* ---------- fjScore: flowers × base + bonuses ---------- */

test("base × flower count", () => {
  eq(total([27], {}), 10, "1 flower → 10");
  eq(total([27, 28, 29], {}), 30, "3 flowers → 30");
  eq(total([27, 28, 29, 30], {}), 40, "4 flowers → 40");
});

test("no-flower win gets the +20 consolation (无花)", () => {
  eq(total([], {}), 30, "base 10 (min ×1) + 20 no-flower");
});

test("self-draw adds +10", () => {
  eq(total([27, 28], { selfDraw: true }), 30, "20 base + 10 self-draw");
});

test("three golds (三金倒) adds +30 and suppresses the self-draw line", () => {
  eq(total([27], { threeGold: true }), 40, "10 base + 30");
  eq(total([27], { threeGold: true, selfDraw: true }), 40, "self-draw not double-counted");
});

test("robbing the gold (抢金) adds +50", () => {
  eq(total([], { qiangJin: true }), 80, "10 base + 20 no-flower + 50");
});

test("fjScore returns itemized lines that sum to the total", () => {
  const r = T.fjScore({ flowers: [27, 28, 29] }, { selfDraw: true });
  const sum = r.lines.reduce((a, l) => a + l.pts, 0);
  eq(sum, r.total, "line items sum to total");
  ok(r.total === 40);
});

/* ---------- fjPayout: who pays what ---------- */

test("self-draw / instant win: everyone pays, winner collects 3× total", () => {
  const p = T.fjPayout(40, true);
  eq(p.each, 40); eq(p.discarder, 0); eq(p.winner, 120);
});

test("discard win: discarder pays double, others half; books balance", () => {
  const p = T.fjPayout(40, false);
  // winner's gains equal the sum of what the three losers pay
  eq(p.winner, p.discarder + 2 * p.each, "conservation of points");
  ok(p.discarder > p.each, "discarder pays more than the others");
});

test("payout scales with fan total", () => {
  ok(T.fjPayout(80, true).winner > T.fjPayout(40, true).winner);
});
