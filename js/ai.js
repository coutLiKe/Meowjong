"use strict";
/* ============================================================
   Meowjong — opponent AI + Professor Paws coaching (FJ style)
   Golds (wild tiles) are never discarded and are excluded from
   structure evaluation — they can complete anything.
   ============================================================ */

const V_SET = 100, V_PAIR = 36, V_PARTIAL = 30, V_GAP = 24;

function floaterValue(k) {
  if (k >= 27) return 0;               // winds never sit in a hand
  const r = rankOf(k);
  return 3 + Math.min(r - 1, 9 - r);   // middle tiles are worth keeping
}

/* Heuristic value of a set of natural counts — higher = closer to winning.
   Memoized per call: flush hands have many overlapping sub-states, so caching
   on the counts key turns an exponential search into a polynomial one. Positions
   below `i` are always 0, so the full counts string uniquely keys each sub-problem. */
function evalCounts(c) { return evalRec(c, 0, new Map()); }

function evalRec(c, i, memo) {
  while (i < 34 && c[i] === 0) i++;
  if (i >= 34) return 0;
  const key = c.join("");
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  c[i]--;
  let best = evalRec(c, i, memo) + floaterValue(i);
  c[i]++;
  if (c[i] >= 2) {
    c[i] -= 2;
    best = Math.max(best, evalRec(c, i, memo) + V_PAIR);
    c[i] += 2;
  }
  if (c[i] >= 3) {
    c[i] -= 3;
    best = Math.max(best, evalRec(c, i, memo) + V_SET);
    c[i] += 3;
  }
  if (i < 27) {
    const r = i % 9;
    if (r <= 7 && c[i + 1] > 0) {
      c[i]--; c[i + 1]--;
      best = Math.max(best, evalRec(c, i, memo) + V_PARTIAL);
      c[i]++; c[i + 1]++;
    }
    if (r <= 6) {
      if (c[i + 1] > 0 && c[i + 2] > 0) {
        c[i]--; c[i + 1]--; c[i + 2]--;
        best = Math.max(best, evalRec(c, i, memo) + V_SET);
        c[i]++; c[i + 1]++; c[i + 2]++;
      } else if (c[i + 2] > 0) {
        c[i]--; c[i + 2]--;
        best = Math.max(best, evalRec(c, i, memo) + V_GAP);
        c[i]++; c[i + 2]++;
      }
    }
  }
  memo.set(key, best);
  return best;
}

/* Pick the best discard from a 14-tile hand. Never discards the gold. */
function chooseDiscard(hand, wildKind = -1) {
  const counts = countsOf(hand);
  if (wildKind >= 0) counts[wildKind] = 0;   // golds are untouchable & structureless
  let best = null;
  for (let k = 0; k < 27; k++) {
    if (counts[k] === 0) continue;
    counts[k]--;
    const score = evalCounts(counts);
    counts[k]++;
    if (!best || score > best.score || (score === best.score && floaterValue(k) < floaterValue(best.kind))) {
      best = { kind: k, score };
    }
  }
  // pathological all-gold hand: give one up
  if (!best) best = { kind: hand[0], score: 0 };
  return best;
}

/* Rough distance-to-win estimate (0 = ready). Each gold ≈ one free step. */
function roughShanten(hand, melds, wildKind = -1) {
  if (winningKinds(hand, melds, wildKind).length > 0) return 0;
  const wilds = wildKind >= 0 ? hand.filter(t => t === wildKind).length : 0;
  const c = countsOf(hand);
  if (wildKind >= 0) c[wildKind] = 0;
  const { m, p, pair } = bestShape(c, 0, new Map());
  const totalM = m + melds.length;
  const usefulP = Math.min(p, 4 - totalM);
  return Math.max(1, 8 - 2 * totalM - usefulP - (pair ? 1 : 0) - wilds);
}

function bestShape(c, i, memo) {
  while (i < 34 && c[i] === 0) i++;
  if (i >= 34) return { m: 0, p: 0, pair: false };
  const key = c.join("");
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  c[i]--;
  let best = bestShape(c, i, memo);
  c[i]++;
  const better = (a, b) => (2 * a.m + a.p + (a.pair ? 1 : 0)) >= (2 * b.m + b.p + (b.pair ? 1 : 0)) ? a : b;
  if (c[i] >= 2) {
    c[i] -= 2;
    const r = bestShape(c, i, memo);
    best = better({ m: r.m, p: r.pair ? r.p + 1 : r.p, pair: true }, best);
    c[i] += 2;
  }
  if (c[i] >= 3) {
    c[i] -= 3;
    const r = bestShape(c, i, memo);
    best = better({ m: r.m + 1, p: r.p, pair: r.pair }, best);
    c[i] += 3;
  }
  if (i < 27) {
    const rk = i % 9;
    if (rk <= 7 && c[i + 1] > 0) {
      c[i]--; c[i + 1]--;
      const r = bestShape(c, i, memo);
      best = better({ m: r.m, p: r.p + 1, pair: r.pair }, best);
      c[i]++; c[i + 1]++;
    }
    if (rk <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--;
      const r = bestShape(c, i, memo);
      best = better({ m: r.m + 1, p: r.p, pair: r.pair }, best);
      c[i]++; c[i + 1]++; c[i + 2]++;
    } else if (rk <= 6 && c[i + 2] > 0) {
      c[i]--; c[i + 2]--;
      const r = bestShape(c, i, memo);
      best = better({ m: r.m, p: r.p + 1, pair: r.pair }, best);
      c[i]++; c[i + 2]++;
    }
  }
  memo.set(key, best);
  return best;
}

/* Should the AI claim a pung/kong of kind k? */
function aiWantsPung(hand, k, wildKind = -1) {
  if (!canPung(hand, k, wildKind)) return false;
  const c = countsOf(hand);
  if (wildKind >= 0) c[wildKind] = 0;
  const before = evalCounts(c);
  c[k] -= 2;
  const after = evalCounts(c) + V_SET;
  return after > before + 10;
}

function aiWantsChow(hand, k, wildKind = -1) {
  const opts = chowOptions(hand, k, wildKind);
  if (!opts.length) return null;
  const c = countsOf(hand);
  if (wildKind >= 0) c[wildKind] = 0;
  const before = evalCounts(c);
  let best = null;
  for (const [a, b] of opts) {
    c[a]--; c[b]--;
    const after = evalCounts(c) + V_SET;
    c[a]++; c[b]++;
    if (after > before + 12 && (!best || after > best.score)) best = { tiles: [a, b], score: after };
  }
  return best;
}

/* ---------- Table awareness ---------- */

/* Copies of each kind visible from seatIdx's view: river, melds, flowers,
   the flipped gold, and that seat's own tiles. */
function visibleKindCounts(seatIdx = 0) {
  const c = new Array(34).fill(0);
  for (const d of G.river) c[d.kind]++;
  for (const s of G.seats) {
    for (const m of (s.melds || [])) {
      if (m.type === "chow") { c[m.kind]++; c[m.kind + 1]++; c[m.kind + 2]++; }
      else c[m.kind] += m.type === "kong" ? 4 : 3;
    }
    for (const f of (s.flowers || [])) c[f]++;
  }
  if (G.wildFlip !== null && G.wildFlip !== undefined) c[G.wildFlip]++;
  for (const f of (G.deadFlips || [])) c[f]++;
  const you = G.seats[seatIdx];
  for (const t of you.hand) if (t !== null) c[t]++;
  if (you.drawn !== null && you.drawn !== undefined) c[you.drawn]++;
  return c;
}

function liveCount(k, seatIdx = 0) {
  return Math.max(0, 4 - visibleKindCounts(seatIdx)[k]);
}

/* Opponents with 2+ exposed sets (or a big flower pile) are threats. */
function dangerNote(k) {
  const threats = G.seats.filter((s, i) => i > 0 && (s.melds.length >= 2 || (s.flowers || []).length >= 4));
  if (!threats.length) return null;
  const vis = visibleKindCounts();
  const inRiver = G.river.some(d => d.kind === k);
  const t0 = threats[0];
  const flowerNote = (t0.flowers || []).length >= 4
    ? ` And with <b>${t0.flowers.length} flowers</b>, their win pays ${t0.flowers.length}× the base — feeding them is expensive!` : "";
  if (inRiver || vis[k] >= 3) {
    return `🛡️ ${tileShort(k)} is a relatively <b>safe</b> discard — ${inRiver ? "it's already in the discard pile" : "almost every copy is visible"}, so it's unlikely to complete anyone's hand.`;
  }
  for (const t of threats) {
    if (k < 27 && t.melds.length >= 2) {
      const seatIdx = G.seats.indexOf(t);
      const meldSuitCount = t.melds.filter(m => m.kind < 27 && suitOf(m.kind) === suitOf(k)).length;
      const discardedSuit = G.river.some(d => d.seat === seatIdx && d.kind < 27 && suitOf(d.kind) === suitOf(k));
      if (meldSuitCount >= 2 && !discardedSuit) {
        return `⚠️ <b>Danger!</b> ${t.emoji} ${t.name} has ${t.melds.length} sets showing and is collecting <b>${SUITS[suitOf(k)].name}</b> — a fresh ${tileShort(k)} is risky.${flowerNote}`;
      }
    }
  }
  if (k < 27 && rankOf(k) >= 3 && rankOf(k) <= 7) {
    const names = threats.map(t => `${t.emoji} ${t.name}`).join(" and ");
    return `⚠️ Careful — ${names} look${threats.length > 1 ? "" : "s"} close to winning. A fresh <b>middle tile</b> like ${tileShort(k)} is the riskiest kind of discard.${flowerNote}`;
  }
  return null;
}

/* Why is kind k the right discard? */
function discardReason(hand, k) {
  const counts = countsOf(hand);
  const copies = counts[k];
  if (k < 27) {
    let neighbors = 0;
    for (let d = -2; d <= 2; d++) {
      if (d === 0) continue;
      const n = k + d;
      if (n >= 0 && n < 27 && suitOf(n) === suitOf(k) && counts[n] > 0) neighbors++;
    }
    if (copies === 1 && neighbors === 0) {
      return `${tileName(k)} is <b>isolated</b> — you have no nearby ${SUITS[suitOf(k)].name} tiles, so it can't easily grow into a run or a pair.`;
    }
    const r = rankOf(k);
    if (copies === 1 && (r === 1 || r === 9) && neighbors <= 1) {
      return `${tileName(k)} is an <b>edge tile</b>. A ${r} can only join one run (${r === 1 ? "1-2-3" : "7-8-9"}), so it has fewer chances than a middle tile.`;
    }
  }
  return `${tileName(k)} is the tile your hand needs <b>least</b> right now — every other tile is doing more work toward a set or pair.`;
}

/* Full coach hint for the human's 14-tile hand */
function coachHint(hand, melds) {
  const wild = (G.wildKind !== null && G.wildKind !== undefined) ? G.wildKind : -1;
  const golds = wild >= 0 ? hand.filter(t => t === wild).length : 0;
  const best = chooseDiscard(hand, wild);
  const remaining = hand.filter((t, i) => i !== hand.indexOf(best.kind));
  const waits = winningKinds(remaining, melds, wild);
  let msg = discardReason(hand, best.kind);
  if (golds > 0) {
    msg += `<br><br>🥇 You're holding <b>${golds} gold${golds > 1 ? "s" : ""}</b> (${tileShort(wild)}) — never throw those away! ${golds === 2 ? "One more and you win instantly (三金倒)!" : "Gold completes any set."}`;
  }
  if (waits.length) {
    const parts = waits.map(k => `${tileShort(k)}${k === wild ? " 🥇" : ""} <b>(${liveCount(k)} left)</b>`);
    msg += `<br><br>After that you'll be <b>ready to win (tenpai)</b>, waiting on: ${parts.join(", ")}`;
    if (waits.every(k => liveCount(k) === 0)) {
      msg += `<br>⚠️ …but <b>every one of those tiles is already visible — that wait is dead!</b> Count the living tiles and reshape.`;
    }
  }
  const danger = dangerNote(best.kind);
  if (danger) msg += `<br><br>${danger}`;
  return { kind: best.kind, message: msg };
}
