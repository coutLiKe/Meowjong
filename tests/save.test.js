"use strict";
const { loadGame, test, eq, ok, notOk } = require("./harness");

/* Fresh context per assertion group — save state is shared mutable global. */

function soloState(T) {
  T.G.seats.forEach((s, i) => { s.control = i === 0 ? "local" : "ai"; });
  T.G.seats[0].score = 320; T.G.seats[1].score = 470;
  T.G.seats[2].score = 590; T.G.seats[3].score = 620;
  T.G.dealer = 2; T.G.handNumber = 5; T.G.matchTarget = 8;
}

test("isSoloMatch: true for local+3 AI, false with a remote seat", () => {
  const { T } = loadGame();
  T.G.seats.forEach((s, i) => { s.control = i === 0 ? "local" : "ai"; });
  ok(T.isSoloMatch());
  T.G.seats[1].control = "remote";
  notOk(T.isSoloMatch(), "a party seat is not a solo match");
});

test("saveMatch → loadMatch round-trips the ledger", () => {
  const { T } = loadGame();
  soloState(T);
  T.saveMatch();
  const d = T.loadMatch();
  ok(d, "a save exists");
  eq(d.scores, [320, 470, 590, 620]);
  eq(d.dealer, 2);
  eq(d.handNumber, 5);
  eq(d.matchTarget, 8);
  eq(d.v, T.SAVE_VERSION);
});

test("saveMatch writes nothing in a party match (can't resume P2P)", () => {
  const { T } = loadGame();
  soloState(T);
  T.G.seats[1].control = "remote";
  T.clearSave();
  T.saveMatch();
  eq(T.loadMatch(), null, "no save written for a party game");
});

test("loadMatch rejects corrupt JSON", () => {
  const { T, localStorage } = loadGame();
  localStorage.setItem("meowjong-save", "{ this is not json");
  eq(T.loadMatch(), null);
});

test("loadMatch rejects a wrong schema version", () => {
  const { T, localStorage } = loadGame();
  localStorage.setItem("meowjong-save", JSON.stringify({
    v: 1, scores: [1, 2, 3, 4], controls: ["local", "ai", "ai", "ai"], dealer: 0, handNumber: 1,
  }));
  eq(T.loadMatch(), null, "old version → ignored, not crashed");
});

test("loadMatch rejects a malformed ledger (bad score array)", () => {
  const { T, localStorage } = loadGame();
  localStorage.setItem("meowjong-save", JSON.stringify({
    v: 2, scores: [1, 2, 3], controls: ["local", "ai", "ai", "ai"], dealer: 0, handNumber: 1,
  }));
  eq(T.loadMatch(), null, "scores must be length 4");
});

test("loadMatch rejects a non-solo (party) save blob", () => {
  const { T, localStorage } = loadGame();
  localStorage.setItem("meowjong-save", JSON.stringify({
    v: 2, scores: [1, 2, 3, 4], controls: ["local", "remote", "ai", "ai"], dealer: 0, handNumber: 1,
  }));
  eq(T.loadMatch(), null, "a save with a remote seat is not resumable here");
});

test("loadMatch rejects out-of-range dealer / handNumber", () => {
  const { T, localStorage } = loadGame();
  const base = { v: 2, scores: [1, 2, 3, 4], controls: ["local", "ai", "ai", "ai"] };
  localStorage.setItem("meowjong-save", JSON.stringify(Object.assign({ dealer: 9, handNumber: 1 }, base)));
  eq(T.loadMatch(), null, "dealer must be 0..3");
  localStorage.setItem("meowjong-save", JSON.stringify(Object.assign({ dealer: 0, handNumber: 0 }, base)));
  eq(T.loadMatch(), null, "handNumber must be >= 1");
});

test("clearSave removes the saved match", () => {
  const { T } = loadGame();
  soloState(T);
  T.saveMatch();
  ok(T.loadMatch(), "exists before clear");
  T.clearSave();
  eq(T.loadMatch(), null, "gone after clear");
});

test("storeGet/storeSet swallow a throwing localStorage (private mode)", () => {
  const { T, sandbox } = loadGame();
  sandbox.localStorage = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  eq(T.storeGet("x"), null, "read failure → null, no throw");
  T.storeSet("x", "1");   // must not throw
  ok(true);
});
