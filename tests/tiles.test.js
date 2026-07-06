"use strict";
const { loadGame, test, eq, ok, notOk } = require("./harness");
const { T } = loadGame();

/* Kind encoding: 0-8 Dots, 9-17 Bamboo, 18-26 Characters, 27-30 Winds, 31-33 Dragons */

test("suitOf / rankOf map kinds correctly", () => {
  eq(T.suitOf(0), 0, "dots"); eq(T.rankOf(0), 1);
  eq(T.suitOf(8), 0); eq(T.rankOf(8), 9);
  eq(T.suitOf(9), 1, "bamboo"); eq(T.rankOf(9), 1);
  eq(T.suitOf(17), 1); eq(T.rankOf(17), 9);
  eq(T.suitOf(18), 2, "chars"); eq(T.rankOf(18), 1);
  eq(T.suitOf(26), 2); eq(T.rankOf(26), 9);
  eq(T.suitOf(27), -1, "honors have no suit");
});

test("honor classifiers", () => {
  ok(T.isWind(27) && T.isWind(30), "E..N are winds");
  notOk(T.isWind(26), "char is not a wind");
  notOk(T.isWind(31), "dragon is not a wind");
  ok(T.isHonor(27) && T.isHonor(31));
  notOk(T.isHonor(26));
  ok(T.isDragon(31) && T.isDragon(33));
  notOk(T.isDragon(30));
});

test("buildWall is a 124-tile FJ wall: 4 each of 31 kinds, NO dragons", () => {
  const wall = T.buildWall();
  eq(wall.length, 124, "total tiles");
  const c = T.countsOf(wall);
  for (let k = 0; k <= 30; k++) eq(c[k], 4, `four of kind ${k}`);
  eq(c[31] || 0, 0, "no red dragon");
  eq(c[32] || 0, 0, "no green dragon");
  eq(c[33] || 0, 0, "no white dragon");
});

test("buildWall shuffles (not always identical)", () => {
  const a = T.buildWall().join(","), b = T.buildWall().join(",");
  ok(a !== b, "two walls should differ (astronomically unlikely to match)");
});

test("countsOf tallies a hand", () => {
  eq(T.countsOf([0, 0, 5, 30]).slice(0, 6), [2, 0, 0, 0, 0, 1]);
  eq(T.countsOf([])[0], 0);
});

test("sortHand sorts ascending in place", () => {
  const h = [26, 0, 13, 9, 5];
  eq(T.sortHand(h), [0, 5, 9, 13, 26]);
});

test("tileName / tileShort are human-readable", () => {
  eq(T.tileName(0), "1 of Dots");
  eq(T.tileName(13), "5 of Bamboo");
  eq(T.tileName(22), "5 of Characters");
  ok(/East/.test(T.tileName(27)), "east wind name");
  ok(T.tileShort(0).startsWith("1"), "short dots");
  eq(T.tileShort(27), "東", "wind short is the char");
});
