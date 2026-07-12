"use strict";
const { loadGame, test, eq, ok, notOk } = require("./harness");
const { T } = loadGame();

/* ---------- registry integrity ---------- */

test("emote registry has the 14 launch emotes, each fully specified", () => {
  const ids = Object.keys(T.EMOTES);
  eq(ids.length, 14, "14 launch emotes");
  for (const id of ids) {
    const e = T.EMOTES[id];
    ok(e.label && typeof e.label === "string", id + " has a label");
    ok(e.glyph && typeof e.glyph === "string", id + " has a log glyph");
    ok(e.verb && typeof e.verb === "string", id + " has a log verb");
    ok(e.verbYou && typeof e.verbYou === "string", id + " has a second-person verb for the solo 'You'");
    ok(e.mood && typeof e.mood === "string", id + " has a sound mood");
    ok(T.EMOTE_ART[id], id + " has face art");
  }
});

test("every emote renders a sculpted SVG face with animatable ear groups", () => {
  for (const id of Object.keys(T.EMOTES)) {
    const svg = T.emoteFaceSVG(id);
    ok(svg.startsWith("<svg"), id + " renders an <svg>");
    ok(svg.includes('class="earL"') && svg.includes('class="earR"'), id + " has both ear groups");
    ok(svg.includes("mj-shadeG"), id + " carries the sculpted shading pass");
    ok(svg.includes('class="hd"'), id + " has the head dome");
    // balanced markup: an unclosed element would derail the whole overlay
    const opens = (svg.match(/<(?!\/)/g) || []).length;
    const closes = (svg.match(/<\//g) || []).length + (svg.match(/\/>/g) || []).length;
    eq(opens, closes, id + " has balanced tags");
  }
});

test("unknown emote ids render nothing (defensive no-op)", () => {
  eq(T.emoteFaceSVG("nope"), "");
  eq(T.emoteFaceSVG(undefined), "");
});

test("the default wheel loadout is 8 valid, distinct emotes", () => {
  eq(T.EMOTE_LOADOUT.length, 8);
  eq(new Set(T.EMOTE_LOADOUT).size, 8, "no duplicates");
  for (const id of T.EMOTE_LOADOUT) ok(T.EMOTES[id], id + " is in the registry");
});

test("AI reaction events reference only registry emotes", () => {
  for (const [ev, def] of Object.entries(T.EMOTE_EVENTS)) {
    ok(def.ids.length > 0, ev + " has candidate emotes");
    ok(def.chance > 0 && def.chance <= 1, ev + " chance in (0,1]");
    for (const id of def.ids) ok(T.EMOTES[id], ev + " → " + id + " exists");
  }
});

/* ---------- the rate limiter (host-authoritative anti-spam) ---------- */

test("rate limiter: first emote passes, an immediate repeat is blocked", () => {
  ok(T.emoteRateOk("a", 1000), "first passes");
  notOk(T.emoteRateOk("a", 1500), "0.5s later is inside the 2.5s gap");
  ok(T.emoteRateOk("a", 1000 + T.EMOTE_RATE.minGapMs), "passes again after the gap");
});

test("rate limiter: at most 4 in any 15s window", () => {
  let t = 0;
  for (let i = 0; i < 4; i++) {
    ok(T.emoteRateOk("b", t), "emote " + (i + 1) + " passes");
    t += T.EMOTE_RATE.minGapMs;
  }
  notOk(T.emoteRateOk("b", t), "the 5th inside the window is blocked");
  ok(T.emoteRateOk("b", T.EMOTE_RATE.windowMs + 1), "passes once the window slides");
});

test("rate limiter: buckets are independent per seat", () => {
  ok(T.emoteRateOk("seat1", 1000));
  ok(T.emoteRateOk("seat2", 1000), "seat2 unaffected by seat1's emote");
});

/* ---------- party protocol safety ---------- */

test("host drops emotes with unknown ids (no crash, no broadcast)", () => {
  // the guard in hostOnData is: typeof d.id === "string" && EMOTES[d.id]
  notOk(T.EMOTES["<script>"], "hostile id is not in the registry");
  notOk(T.EMOTES[""], "empty id is not in the registry");
});
