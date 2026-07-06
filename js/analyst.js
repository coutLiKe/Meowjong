"use strict";
/* ============================================================
   Meowjong — The Analyst (advanced strategy assistant)

   Distinct from the Coach: enumerates EVERY available action,
   scores each one, models opponents from public info, and
   refines the ranking with Monte Carlo rollouts.

   Layer 1  exact math      — shanten, waits, live outs (sync, instant)
   Layer 2  threat model    — per-opponent speed × payout × suit lean (sync)
   Layer 3  rollouts        — simulated futures, time-sliced on the main
                              thread (~40 ms chunks) so file:// installs
                              work without a Web Worker.

   Works identically for party guests: it only reads the player's
   own projected view of the table, so it can't leak hidden info.
   ============================================================ */

const ANALYST = {
  on: false,          // panel enabled (header toggle)
  auto: true,         // analyze automatically on your turn
  token: 0,           // cancels stale rollouts
  mode: "idle",       // idle | turn | claim
  rows: null,
  threats: null,
  expanded: null,
  showAll: false,
  simDone: false,
};

const AN_SIMS = 80;        // rollouts per candidate
const AN_SIM_CANDS = 4;    // only the top heuristic candidates get rollouts
const AN_HORIZON = 20;     // simulated draws per rollout

/* ---------- Layer 1: exact evaluation ---------- */

function anMyTiles() {
  const you = G.seats[0];
  return you.hand.concat(you.drawn !== null && you.drawn !== undefined ? [you.drawn] : []);
}

function anEstMyWin(selfDraw) {
  return fjScore(G.seats[0], { selfDraw }).total;
}

/* Evaluate the hand left after discarding `kind` from `tiles` */
function anEvalDiscard(tiles, kind) {
  const wild = wildOf();
  const melds = G.seats[0].melds;
  const rest = tiles.slice();
  rest.splice(rest.indexOf(kind), 1);
  const sh = roughShanten(rest, melds, wild);
  let waits = [], outs = 0, goldOuts = 0;
  if (sh === 0) {
    waits = winningKinds(rest, melds, wild);
    outs = waits.reduce((a, k) => a + liveCount(k), 0);
    if (wild >= 0 && !waits.includes(wild)) goldOuts = liveCount(wild); // any gold completes a ready hand
  }
  const c = countsOf(rest);
  if (wild >= 0) c[wild] = 0;
  const shape = evalCounts(c);
  // heuristic win probability by distance-to-ready
  let pWin;
  if (sh === 0) pWin = Math.min(0.55, 0.10 + 0.045 * (outs + goldOuts));
  else if (sh === 1) pWin = 0.16 + Math.min(0.08, shape / 4000);
  else if (sh === 2) pWin = 0.08;
  else pWin = 0.03;
  return { rest, sh, waits, outs, goldOuts, shape, pWin };
}

/* ---------- Layer 2: threat model ---------- */

function anThreats() {
  return [1, 2, 3].map(i => {
    const s = G.seats[i];
    const melds = s.melds.length;
    const fl = (s.flowers || []).length;
    const total = fjScore(s, {}).total;               // what their win pays (base)
    const level = Math.min(1, melds * 0.28 + fl * 0.05);
    const meldSuits = [0, 0, 0];
    s.melds.forEach(m => { if (m.kind < 27) meldSuits[suitOf(m.kind)]++; });
    const discSuits = [0, 0, 0];
    G.river.forEach(d => { if (d.seat === i && d.kind < 27) discSuits[suitOf(d.kind)]++; });
    const hoard = [0, 1, 2].filter(su => meldSuits[su] >= 2 && discSuits[su] === 0);
    return { seat: i, name: s.name, emoji: s.emoji, melds, fl, total, level, hoard, discSuits };
  });
}

/* Deal-in risk (0..1) + note for discarding `kind`, given threat profiles */
function anRisk(kind, threats) {
  const vis = visibleKindCounts();
  const inRiver = G.river.some(d => d.kind === kind);
  if (inRiver || vis[kind] >= 3) {
    return { p: 0.02, note: inRiver ? "already in the pile — near-safe" : "almost every copy visible — near-safe" };
  }
  const r = rankOf(kind);
  const base = (r >= 4 && r <= 6) ? 0.17 : (r === 3 || r === 7) ? 0.13 : 0.08;
  let p = 0.02, note = "fresh tile, no reads against it";
  for (const t of threats) {
    if (t.level < 0.15) continue;
    let pt = base * (0.4 + t.level);
    let n = `${t.name} looks ${t.level > 0.6 ? "very close" : "active"}`;
    if (t.hoard.includes(suitOf(kind))) {
      pt = Math.max(pt, 0.22 + 0.25 * t.level);
      n = `${t.name} is hoarding ${SUITS[suitOf(kind)].name}`;
    } else if (t.discSuits[suitOf(kind)] > 1) {
      pt *= 0.55;
      n = `${t.name} keeps shedding ${SUITS[suitOf(kind)].name}`;
    }
    if (pt > p) { p = pt; note = n; }
  }
  return { p: Math.min(0.5, p), note };
}

/* ---------- Action enumeration & scoring ---------- */

function anAnalyzeTurn() {
  const ctx = G.turnCtx;
  if (!ctx) return null;
  const wild = wildOf();
  const tiles = anMyTiles();
  const threats = anThreats();
  const maxPay = Math.max(...threats.map(t => t.total));
  const myWinPts = anEstMyWin(true);
  const rows = [];

  if (ctx.canWin) {
    rows.push({
      type: "win", label: ctx.threeGold ? "Declare Hú! — Three Golds" : "Declare Hú! 胡",
      ev: myWinPts * 3, pWin: 1, risk: 0,
      detail: `Guaranteed ${myWinPts} points × everyone pays. There is no better line — take it.`,
    });
  }
  for (const k of ctx.cKongs || []) {
    rows.push(anKongRow(tiles, k, false, threats, maxPay));
  }
  for (const k of ctx.aKongs || []) {
    rows.push(anKongRow(tiles, k, true, threats, maxPay));
  }
  const seen = new Set();
  for (const k of tiles) {
    if (seen.has(k) || k === wild) continue;
    seen.add(k);
    const ev = anEvalDiscard(tiles, k);
    const risk = anRisk(k, threats);
    rows.push({
      type: "discard", kind: k,
      label: `Discard ${tileShort(k)}`,
      sh: ev.sh, waits: ev.waits, outs: ev.outs, goldOuts: ev.goldOuts,
      pWin: ev.pWin, risk: risk.p, riskNote: risk.note,
      ev: ev.pWin * myWinPts * 3 - risk.p * maxPay * 2,
      rest: ev.rest,
      sim: { n: 0, win: 0, dealIn: 0, otherWin: 0 },
    });
  }
  // golds are never candidates — say so once
  if (wild >= 0 && tiles.includes(wild)) {
    rows.push({ type: "note", label: `Discard ${tileShort(wild)} 🥇`, ev: -999,
      detail: "Excluded on principle: a gold is strictly better in your hand than in the river — and it can hand someone the win." });
  }
  rows.sort((a, b) => b.ev - a.ev);
  return { rows, threats, myWinPts, maxPay };
}

function anKongRow(tiles, k, added, threats, maxPay) {
  // Evaluate the remainder after the kong (a replacement tile is then drawn).
  // Concealed: all four copies leave the hand and become a NEW meld.
  // Added: only the 4th tile leaves the hand; it upgrades an EXISTING Peng, so
  //        the meld count is unchanged (fixing an off-by-one shanten bug).
  const wild = wildOf();
  const label = added ? "Added Gang" : "Concealed Gang";
  const rest = tiles.slice();
  if (added) {
    rest.splice(rest.indexOf(k), 1);
  } else {
    for (let i = 0; i < 4; i++) { const j = rest.indexOf(k); if (j >= 0) rest.splice(j, 1); }
  }
  const melds = added ? G.seats[0].melds : G.seats[0].melds.concat([{ type: "kong", kind: k }]);
  const sh = roughShanten(rest, melds, wild);
  const pWin = sh === 0 ? 0.3 : sh === 1 ? 0.16 : 0.07;
  return {
    type: "kong", kind: k, label: `${label} ${tileShort(k)}`,
    sh, pWin, risk: 0.02,
    ev: pWin * anEstMyWin(true) * 3 + 4, // +bonus draw value
    detail: `Locks four ${tileShort(k)} into one set and draws a bonus tile from the back wall. After it you'd be ~${sh} step${sh === 1 ? "" : "s"} from ready. Kongs are safe to declare but collapse flexibility — the four tiles can never be split into runs again.`,
  };
}

/* ---------- Layer 3: Monte Carlo rollouts (time-sliced) ---------- */

function anFastDiscard(hand, wild) {
  const c = countsOf(hand);
  let best = null, bestScore = Infinity;
  for (const k of new Set(hand)) {
    if (k === wild || k >= 27) continue;
    let s = c[k] * 10;
    const su = suitOf(k), r = rankOf(k);
    for (const d of [-2, -1, 1, 2]) {
      const n = k + d;
      if (n >= 0 && n < 27 && suitOf(n) === su && c[n] > 0) s += Math.abs(d) === 1 ? 6 : 3;
    }
    s += Math.min(r - 1, 9 - r);
    if (s < bestScore) { bestScore = s; best = k; }
  }
  return best !== null ? best : hand[0];
}

function anSimOne(row) {
  const wild = wildOf();
  const myMelds = G.seats[0].melds.length;
  // unseen pool from MY perspective = opponents' hands + the wall
  const vis = visibleKindCounts();
  const pool = [];
  for (let k = 0; k <= 30; k++) for (let n = 4 - vis[k]; n > 0; n--) pool.push(k);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  // hypothetical opponent hands (winds can't be held — they slide back to the wall)
  const hands = [null, [], [], []];
  const backWall = [];
  for (let i = 1; i <= 3; i++) {
    const size = 13 - 3 * G.seats[i].melds.length;
    while (hands[i].length < size && pool.length) {
      const t = pool.pop();
      if (isWind(t)) backWall.push(t); else hands[i].push(t);
    }
  }
  const wall = backWall.concat(pool);
  const myHand = row.rest.slice();
  const meldsOf = s => (s === 0 ? myMelds : G.seats[s].melds.length);
  const winsWith = (h, extra, s) =>
    isWinningCounts(countsOf(extra === null ? h : h.concat([extra])), 4 - meldsOf(s), wild);

  row.sim.n++;
  // instant ron on the candidate discard itself
  for (let i = 1; i <= 3; i++) {
    if (winsWith(hands[i], row.kind, i)) { row.sim.dealIn++; return; }
  }
  let seat = 1;
  for (let d = 0; d < AN_HORIZON && wall.length; d++) {
    let t = wall.pop();
    while (t !== undefined && isWind(t) && wall.length) t = wall.pop(); // flowers auto-replace
    if (t === undefined || isWind(t)) break;
    const h = seat === 0 ? myHand : hands[seat];
    h.push(t);
    if ((wild >= 0 && h.filter(x => x === wild).length >= 3) || winsWith(h, null, seat)) {
      if (seat === 0) row.sim.win++; else row.sim.otherWin++;
      return;
    }
    const dk = anFastDiscard(h, wild);
    h.splice(h.indexOf(dk), 1);
    if (seat === 0) {
      for (let i = 1; i <= 3; i++) if (winsWith(hands[i], dk, i)) { row.sim.dealIn++; return; }
    } else {
      if (winsWith(myHand, dk, 0)) { row.sim.win++; return; }
    }
    seat = (seat + 1) % 4;
  }
  // unresolved within horizon — counts toward n only
}

function anRunSims(analysis, token) {
  const cands = analysis.rows.filter(r => r.type === "discard").slice(0, AN_SIM_CANDS);
  if (!cands.length) { ANALYST.simDone = true; anRender(); return; }
  let ci = 0, si = 0;
  const step = () => {
    if (token !== ANALYST.token) return;             // stale — a new turn started
    const deadline = performance.now() + 40;
    while (performance.now() < deadline) {
      if (ci >= cands.length) {
        // refine EV with simulated frequencies and re-rank
        for (const r of cands) {
          const n = Math.max(1, r.sim.n);
          r.pWin = r.sim.win / n;
          r.risk = r.sim.dealIn / n;
          r.pOther = r.sim.otherWin / n;
          r.ev = r.pWin * analysis.myWinPts * 3 - r.risk * analysis.maxPay * 2 - r.pOther * analysis.maxPay * 0.5;
          r.refined = true;
        }
        analysis.rows.sort((a, b) => b.ev - a.ev);
        ANALYST.simDone = true;
        anRender();
        return;
      }
      anSimOne(cands[ci]);
      if (++si >= AN_SIMS) { si = 0; ci++; }
    }
    anRender();                                       // progressive refresh
    setTimeout(step, 0);
  };
  step();
}

/* ---------- Claim analysis (fast path, no rollouts) ---------- */

function anAnalyzeClaim(opts, kind) {
  const wild = wildOf();
  const you = G.seats[0];
  const hand = you.hand;
  const threats = anThreats();
  const rows = [];
  const baseSh = roughShanten(hand, you.melds, wild);
  const meldPlus = you.melds.concat([{ type: "pung", kind }]);

  const addClaimRow = (label, restHand, note) => {
    const sh = roughShanten(restHand, meldPlus, wild);
    rows.push({
      type: "claim", label, sh,
      ev: (baseSh - sh) * 12 + (sh === 0 ? 15 : 0),
      detail: `${note} You'd go from ${baseSh} step${baseSh === 1 ? "" : "s"} to <b>${sh}</b> from ready — but the set is locked face-up and your plan is shown.`,
    });
  };
  if (opts.win) rows.push({ type: "claim", label: "Hú! 胡 — take the win", ev: 999, detail: "It completes your hand. No analysis needed." });
  if (opts.pung) addClaimRow(`Peng ${tileShort(kind)}`, hand.filter((t, i) => i !== hand.indexOf(kind) && i !== hand.lastIndexOf(kind)).concat([]), "Turns your pair into a locked triplet.");
  if (opts.kong) addClaimRow(`Gang ${tileShort(kind)}`, hand.filter(t => t !== kind), "Four-of-a-kind plus a bonus draw.");
  for (const pair of (opts.chows || [])) {
    const rest = hand.slice();
    rest.splice(rest.indexOf(pair[0]), 1);
    rest.splice(rest.indexOf(pair[1]), 1);
    addClaimRow(`Chi (${tileShort(pair[0])} ${tileShort(pair[1])})`, rest, "Completes the run using both hand tiles.");
  }
  rows.push({
    type: "claim", label: "Pass", ev: baseSh <= 1 ? 8 : 2,
    detail: `Stay concealed and flexible at ${baseSh} step${baseSh === 1 ? "" : "s"} from ready. Right when a claim would strand tiles or wreck a wide wait.`,
  });
  rows.sort((a, b) => b.ev - a.ev);
  return { rows, threats, claim: true };
}

/* ---------- Panel UI ---------- */

function anSetVisible(v) {
  $("#analyst").classList.toggle("hidden", !v);
}

function anStatus(msg) {
  ANALYST.mode = "idle";
  ANALYST.rows = null;
  $("#an-body").innerHTML = `<div class="an-status">${msg}</div>`;
}

function anRender() {
  if (!ANALYST.on || !ANALYST.analysis) return;
  const a = ANALYST.analysis;
  const rows = a.rows;
  const body = $("#an-body");
  const fmtP = p => Math.round(p * 100) + "%";
  const shown = ANALYST.showAll ? rows : rows.slice(0, 5);
  let html = "";

  if (!a.claim) {
    const best = rows[0];
    html += `<div class="an-summary">${ANALYST.simDone ? "" : `<span class="an-est">simulating…</span> `}best line: <b>${best.label}</b> (EV ${best.ev.toFixed(1)})</div>`;
  } else {
    html += `<div class="an-summary">claim decision — ranked:</div>`;
  }

  html += shown.map((r, i) => {
    const open = ANALYST.expanded === i;
    let meta = "";
    if (r.type === "discard") {
      meta = `<span class="an-num">EV ${r.ev.toFixed(1)}</span><span class="an-num">win ${fmtP(r.pWin)}</span><span class="an-num ${r.risk > 0.15 ? "an-bad" : ""}">risk ${fmtP(r.risk)}</span>${r.refined ? "" : `<span class="an-est">est.</span>`}`;
    } else if (r.type === "claim" || r.type === "kong") {
      meta = r.ev > 900 ? `<span class="an-num an-good">take it</span>` : `<span class="an-num">score ${r.ev.toFixed(0)}</span>`;
    }
    return `<div class="an-row ${r.type === "note" ? "an-muted" : ""}" data-i="${i}">
      <div class="an-row-head"><span class="an-rank">${r.type === "note" ? "–" : i + 1}</span>
      <span class="an-label">${r.label}</span>${meta}<span class="an-caret">${open ? "▾" : "▸"}</span></div>
      ${open ? `<div class="an-detail">${anDetail(r)}</div>` : ""}
    </div>`;
  }).join("");

  if (!ANALYST.showAll && rows.length > 5) {
    html += `<button class="an-more" id="an-more">show all ${rows.length} actions ▾</button>`;
  }

  // threat meters
  html += `<div class="an-threats">` + a.threats.map(t => {
    const pct = Math.round(t.level * 100);
    return `<div class="an-threat"><span>${t.emoji} ${t.name}</span>
      <span class="an-meter"><span style="width:${pct}%"></span></span>
      <span class="an-tnote">${t.melds} meld${t.melds === 1 ? "" : "s"}, ${t.fl}🌸${t.hoard.length ? " — hoarding " + t.hoard.map(su => SUITS[su].name).join("/") : ""} · pays ~${t.total * 2}</span></div>`;
  }).join("") + `</div>`;

  body.innerHTML = html;
  body.querySelectorAll(".an-row").forEach(el => {
    el.addEventListener("click", () => {
      const i = Number(el.dataset.i);
      ANALYST.expanded = ANALYST.expanded === i ? null : i;
      anRender();
    });
  });
  const more = $("#an-more");
  if (more) more.addEventListener("click", e => { e.stopPropagation(); ANALYST.showAll = true; anRender(); });
}

function anDetail(r) {
  if (r.detail) return r.detail;
  if (r.type !== "discard") return "";
  let d = "";
  if (r.sh === 0) {
    const waitBits = r.waits.map(k => `${tileShort(k)} (${liveCount(k)} left)`).join(", ");
    d += `<b>Ready after this.</b> Waiting on: ${waitBits} — ${r.outs} live out${r.outs === 1 ? "" : "s"}`;
    if (r.goldOuts) d += ` +${r.goldOuts} gold draw${r.goldOuts === 1 ? "" : "s"}`;
    d += ".<br>";
  } else {
    d += `Leaves you ~<b>${r.sh}</b> step${r.sh === 1 ? "" : "s"} from ready.<br>`;
  }
  d += `Safety: ${r.riskNote}.`;
  if (r.refined && r.sim.n) {
    d += `<br>Rollout (${r.sim.n} sims): you win ${Math.round(100 * r.sim.win / r.sim.n)}% · deal-in ${Math.round(100 * r.sim.dealIn / r.sim.n)}% · someone else wins ${Math.round(100 * r.sim.otherWin / r.sim.n)}%.`;
  }
  return d;
}

/* ---------- Hooks (called from main.js, all optional) ---------- */

function analystOnTurn() {
  if (!ANALYST.on) return;
  if (!ANALYST.auto) { anStatus(`It's your turn — <button class="an-linkbtn" onclick="analystRunNow()">analyze it</button>`); return; }
  analystRunNow();
}

function analystRunNow() {
  if (!ANALYST.on || !G.turnCtx) return;
  ANALYST.token++;
  ANALYST.mode = "turn";
  ANALYST.expanded = null;
  ANALYST.showAll = false;
  ANALYST.simDone = false;
  ANALYST.analysis = anAnalyzeTurn();
  anRender();
  anRunSims(ANALYST.analysis, ANALYST.token);
}

function analystOnClaim(opts, kind) {
  if (!ANALYST.on) return;
  ANALYST.token++;
  ANALYST.mode = "claim";
  ANALYST.expanded = null;
  ANALYST.showAll = true;
  ANALYST.simDone = true;
  ANALYST.analysis = anAnalyzeClaim(opts, kind);
  anRender();
}

function analystIdle() {
  if (!ANALYST.on) return;
  ANALYST.token++;
  ANALYST.analysis = null;
  anStatus("Waiting for your next decision…");
}

function analystInit() {
  ANALYST.on = storeGet("meowjong-analyst") === "1";
  ANALYST.auto = storeGet("meowjong-analyst-auto") !== "0";
  const tgl = $("#toggle-analyst");
  tgl.checked = ANALYST.on;
  anSetVisible(ANALYST.on);
  $("#analyst-auto").checked = ANALYST.auto;
  tgl.addEventListener("change", e => {
    ANALYST.on = e.target.checked;
    storeSet("meowjong-analyst", ANALYST.on ? "1" : "0");
    anSetVisible(ANALYST.on);
    if (ANALYST.on) {
      if (G.awaitingDiscard && G.turnCtx) analystOnTurn();
      else anStatus("Waiting for your next decision…");
    }
  });
  $("#analyst-auto").addEventListener("change", e => {
    ANALYST.auto = e.target.checked;
    storeSet("meowjong-analyst-auto", ANALYST.auto ? "1" : "0");
    if (ANALYST.auto && G.awaitingDiscard && G.turnCtx) analystOnTurn();
  });
  anStatus("Waiting for your next decision…");
}
