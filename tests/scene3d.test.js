"use strict";
/* The 3D table's fairness gate: everything the scene renders flows through
   scene3dProjection(), and this suite pins down that opponents' concealed
   hands cross that boundary as a COUNT and nothing else. If a future change
   to the projection starts carrying hidden kinds, these tests fail. */
const { loadGame, test, eq, ok, notOk } = require("./harness");
const { T } = loadGame();

function fakeState() {
  return {
    seats: [
      { hand: [0, 1, 2], drawn: 5, melds: [{ type: "chow", kind: 9, concealed: false }], flowers: [27] },
      { hand: [11, 12, 13, 14], drawn: null, melds: [{ type: "pung", kind: 20, concealed: false }], flowers: [28, 29] },
      { hand: [21, 22], drawn: 23, melds: [], flowers: [] },
      { hand: [3, 4, 5, 6, 7], drawn: null, melds: [], flowers: [30] },
    ],
    river: [{ kind: 8, seat: 1 }, { kind: 17, seat: 0 }],
    wall: { length: 42 },
    wildFlip: 26, activeSeat: 2, suggestKind: 1,
  };
}

test("scene3d projection: own hand, drawn tile, and public info pass through", () => {
  const p = T.scene3dProjection(fakeState());
  eq(JSON.stringify(p.myTiles), "[0,1,2]");
  eq(p.myDrawn, 5);
  eq(p.myMelds.length, 1);
  eq(p.river.length, 2);
  eq(p.wallLen, 42);
  eq(p.wildFlip, 26);
});

test("scene3d projection: opponents' concealed hands become a count ONLY", () => {
  const p = T.scene3dProjection(fakeState());
  eq(p.opp.length, 3);
  eq(p.opp[0].count, 4);
  eq(p.opp[1].count, 2);
  eq(p.opp[2].count, 5);
  for (const o of p.opp) {
    notOk("hand" in o, "no hand array crosses the boundary");
    notOk("drawn" in o, "no drawn tile crosses the boundary");
    eq(JSON.stringify(Object.keys(o).sort()), '["count","flowers","melds"]');
  }
});

test("scene3d projection: changing hidden kinds changes NOTHING but the count", () => {
  const a = fakeState();
  const b = fakeState();
  b.seats[1].hand = [25, 25, 25, 25];      // same count, totally different tiles
  b.seats[2].drawn = 0;                    // hidden drawn tile changes too
  eq(JSON.stringify(T.scene3dProjection(a)), JSON.stringify(T.scene3dProjection(b)));
});

test("scene3d projection: tolerates missing/partial state (guest snapshots, boot)", () => {
  const p = T.scene3dProjection({ seats: [{}, {}, {}, {}] });
  eq(p.myTiles.length, 0);
  eq(p.opp[0].count, 0);
  eq(p.wallLen, 0);
  ok(p.wildFlip === null && p.activeSeat === null);
});
