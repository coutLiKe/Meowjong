"use strict";
/* ============================================================
   Meowjong — rules engine (FJ / Fujian-Fuzhou style)

   124 tiles: three suits 1-9 ×4 + four winds ×4. NO dragons.
   - Winds are FLOWERS: drawn → exposed, replacement from back wall.
   - A GOLD (金) tile is flipped at the back wall; its kind is WILD.
     The wild substitutes any suit tile in sets, but can NOT be the
     pair/eyes and can NOT be used in chow/pung/kong claims.
   - Winning hand: 4 sets + 1 pair (13 tiles + winning tile).
   - Three golds in hand (三金倒) = instant win.
   ============================================================ */

/* Can `counts` (naturals only) + w wilds form exactly n sets? */
function canFormSetsW(c, n, w) {
  let k = 0;
  while (k < 34 && c[k] === 0) k++;
  if (k === 34) return w === 3 * n;   // leftover sets must be pure wilds
  if (n === 0) return false;
  // triplet: a natural copies of k + (3-a) wilds
  for (let a = Math.min(3, c[k]); a >= 1; a--) {
    if (w < 3 - a) continue;
    c[k] -= a;
    const ok = canFormSetsW(c, n - 1, w - (3 - a));
    c[k] += a;
    if (ok) return true;
  }
  // runs containing k (k is the smallest remaining natural)
  if (k < 27) {
    const base = Math.floor(k / 9) * 9, r = k - base;
    for (let s = Math.max(0, r - 2); s <= Math.min(6, r); s++) {
      if (runRec(c, base + s, 0, k, n, w)) return true;
    }
  }
  return false;
}

/* Fill run positions start..start+2; k must use its natural copy.
   Other positions branch between natural and wild. */
function runRec(c, start, d, k, n, w) {
  if (d === 3) return canFormSetsW(c, n - 1, w);
  const t = start + d;
  if (t === k) {
    c[t]--;
    const ok = runRec(c, start, d + 1, k, n, w);
    c[t]++;
    return ok;
  }
  if (c[t] > 0) {
    c[t]--;
    if (runRec(c, start, d + 1, k, n, w)) { c[t]++; return true; }
    c[t]++;
  }
  if (w > 0 && runRec(c, start, d + 1, k, n, w - 1)) return true;
  return false;
}

/* Is `counts` (setsNeeded*3 + 2 tiles) a winning shape?
   wildKind's copies float as wilds; the PAIR must be natural tiles. */
function isWinningCounts(counts, setsNeeded, wildKind = -1) {
  const c = counts.slice();
  let w = 0;
  if (wildKind >= 0 && wildKind < 34) { w = c[wildKind]; c[wildKind] = 0; }
  for (let p = 0; p < 34; p++) {
    if (c[p] >= 2) {
      c[p] -= 2;
      const ok = canFormSetsW(c, setsNeeded, w);
      c[p] += 2;
      if (ok) return true;
    }
  }
  return false;
}

/* Which suit tile kinds would complete this hand? (winds can't be drawn into a hand) */
function winningKinds(hand, melds, wildKind = -1) {
  const setsNeeded = 4 - melds.length;
  const counts = countsOf(hand);
  const waits = [];
  for (let k = 0; k < 27; k++) {
    if (counts[k] >= 4) continue;
    counts[k]++;
    if (isWinningCounts(counts, setsNeeded, wildKind)) waits.push(k);
    counts[k]--;
  }
  return waits;
}

/* ---------- FJ scoring ----------
   winner points = base × flowers (min ×1), plus bonuses.        */
function fjScore(seat, opts = {}) {
  const flowers = seat.flowers ? seat.flowers.length : 0;
  const base = 10;
  const lines = [];
  let total = base * Math.max(1, flowers);
  lines.push({
    name: "Base × flowers 🌸",
    desc: `${base} pts × ${flowers === 0 ? "1 (no flowers)" : flowers + " flower" + (flowers > 1 ? "s" : "")}`,
    pts: total,
  });
  if (flowers === 0) { lines.push({ name: "No Flowers 无花", desc: "Winning with zero flowers", pts: 20 }); total += 20; }
  if (opts.threeGold) { lines.push({ name: "Three Golds 三金倒", desc: "Holding three wild tiles — instant win!", pts: 30 }); total += 30; }
  if (opts.qiangJin) { lines.push({ name: "Robbing the Gold 抢金", desc: "The revealed gold completed a ready hand", pts: 50 }); total += 50; }
  if (opts.selfDraw && !opts.threeGold && !opts.qiangJin) { lines.push({ name: "Self-draw 自摸", desc: "Drew the winning tile yourself", pts: 10 }); total += 10; }
  return { lines, total };
}

/* Payments: self-draw (and instant wins) — everyone pays the total;
   win on a discard — the discarder pays double, others half. */
function fjPayout(total, everyonePays) {
  return everyonePays
    ? { each: total, discarder: 0, winner: total * 3 }
    : { each: Math.ceil(total / 2), discarder: total * 2, winner: total * 2 + Math.ceil(total / 2) * 2 };
}

/* ---------- Claim eligibility (gold can never be melded) ---------- */
function canPung(hand, k, wildKind = -1) {
  if (k === wildKind) return false;
  return hand.filter(t => t === k).length >= 2;
}
function canKongFromDiscard(hand, k, wildKind = -1) {
  if (k === wildKind) return false;
  return hand.filter(t => t === k).length >= 3;
}

/* Chow options for discarded kind k — natural tiles only, never the gold */
function chowOptions(hand, k, wildKind = -1) {
  if (k >= 27 || k === wildKind) return [];
  const has = (x) => x !== wildKind && suitOf(x) === suitOf(k) && hand.includes(x);
  const opts = [];
  const r = rankOf(k);
  if (r >= 3 && has(k - 2) && has(k - 1)) opts.push([k - 2, k - 1]);
  if (r >= 2 && r <= 8 && has(k - 1) && has(k + 1)) opts.push([k - 1, k + 1]);
  if (r <= 7 && has(k + 1) && has(k + 2)) opts.push([k + 1, k + 2]);
  return opts;
}

/* Concealed kongs (4 natural copies; the gold can't be konged — only 3 exist in play) */
function concealedKongs(hand, wildKind = -1) {
  const c = countsOf(hand);
  const out = [];
  for (let k = 0; k < 27; k++) if (k !== wildKind && c[k] === 4) out.push(k);
  return out;
}

/* Added kong: hand tile matches one of the player's exposed pungs */
function addedKongs(hand, melds, wildKind = -1) {
  return melds.filter(m => m.type === "pung" && m.kind !== wildKind && hand.includes(m.kind)).map(m => m.kind);
}
