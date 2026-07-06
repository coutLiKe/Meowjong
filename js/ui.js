"use strict";
/* ============================================================
   Meowjong — DOM rendering & interaction helpers
   ============================================================ */

function $(sel) { return document.querySelector(sel); }

/* Small corner index for learners (toggleable): number for suits,
   E/S/W/N for winds, R/G/W for dragons. */
function cornerText(kind) {
  if (kind < 27) return String(rankOf(kind));
  if (isWind(kind)) return WINDS[kind - 27].key;
  return DRAGONS[kind - 31].key;
}

/* Create a tile element. kind === null → face-down back.
   Uses <span> so tiles can live inside <p> text (a <div> would close the paragraph). */
function tileEl(kind, opts = {}) {
  const d = document.createElement("span");
  if (kind === null || kind === undefined) {
    d.className = "tile back" + (opts.small ? " small" : "") + (opts.mini ? " mini" : "");
    d.textContent = "🀄";
    d.title = "A face-down tile — hidden from you";
    return d;
  }
  let cls = "tile";
  if (typeof G !== "undefined" && G.wildKind !== null && G.wildKind !== undefined && kind === G.wildKind) cls += " gold";
  if (opts.small) cls += " small";
  if (opts.mini) cls += " mini";
  if (opts.selected) cls += " selected";
  if (opts.suggest) cls += " suggest";
  if (opts.last) cls += " last-discard";
  d.className = cls;
  d.innerHTML = `<span class="corner">${cornerText(kind)}</span>` + tileFaceSVG(kind);
  d.title = tileName(kind);
  d.dataset.kind = kind;
  return d;
}

function meldEl(meld) {
  const wrap = document.createElement("div");
  wrap.className = "meld";
  let kinds;
  if (meld.type === "chow") kinds = [meld.kind, meld.kind + 1, meld.kind + 2];
  else kinds = new Array(meld.type === "kong" ? 4 : 3).fill(meld.kind);
  for (const k of kinds) wrap.appendChild(tileEl(meld.concealed && meld.type === "kong" ? null : k, { small: true }));
  wrap.title = (MELD_LABEL[meld.type] || meld.type).toUpperCase() + (meld.concealed ? " (concealed)" : "");
  return wrap;
}

/* ---------- Panels ---------- */

function renderOpponents() {
  for (let i = 1; i <= 3; i++) {
    const s = G.seats[i];
    const panel = $("#opp-" + i);
    panel.querySelector(".opp-name").textContent = s.emoji + " " + s.name;
    panel.querySelector(".opp-score").textContent = s.score + " pts";
    panel.querySelector(".opp-wind").textContent = "Wind: " + WINDS[s.wind].key;
    panel.classList.toggle("active-turn", G.activeSeat === i);
    const handRow = panel.querySelector(".opp-hand");
    handRow.innerHTML = "";
    if (G.peek && !isPartyMode()) {
      for (const t of sortHand(s.hand.slice())) handRow.appendChild(tileEl(t, { small: true }));
    } else {
      for (const t of s.hand) handRow.appendChild(tileEl(null, { mini: true }));
      const n = document.createElement("span");
      n.className = "hand-count";
      n.textContent = s.hand.length + " tiles";
      handRow.appendChild(n);
    }
    const meldRow = panel.querySelector(".opp-melds");
    meldRow.innerHTML = "";
    for (const m of s.melds) meldRow.appendChild(meldEl(m));
    if (s.melds.length) {
      const lbl = document.createElement("span");
      lbl.className = "meld-label";
      lbl.textContent = "claimed sets (locked in, face-up):";
      meldRow.prepend(lbl);
    }
    renderFlowerRow(panel.querySelector(".opp-flowers"), s.flowers || []);
  }
}

/* flowers (winds) exposed beside a hand — public, they multiply the score */
function renderFlowerRow(el, flowers) {
  if (!el) return;
  el.innerHTML = "";
  if (!flowers.length) return;
  const lbl = document.createElement("span");
  lbl.className = "flower-label";
  lbl.textContent = `🌸 ×${flowers.length}`;
  lbl.title = flowers.length + " flowers — their win pays " + flowers.length + "× the base";
  el.appendChild(lbl);
  for (const f of flowers) el.appendChild(tileEl(f, { mini: true, small: false }));
}

function renderRiver() {
  const river = $("#river");
  river.innerHTML = "";
  if (!G.river.length) {
    river.innerHTML = `<span class="river-empty">Discarded tiles pile up here. The newest one glows — that's the one you can claim.</span>`;
    return;
  }
  for (let i = 0; i < G.river.length; i++) {
    const { kind, seat } = G.river[i];
    const cell = document.createElement("div");
    cell.className = "river-cell";
    const t = tileEl(kind, { small: true, last: i === G.river.length - 1 && G.lastDiscard !== null });
    cell.appendChild(t);
    const badge = document.createElement("span");
    badge.className = "river-badge";
    badge.textContent = G.seats[seat].emoji;
    badge.title = "discarded by " + G.seats[seat].name;
    cell.appendChild(badge);
    river.appendChild(cell);
  }
  river.scrollTop = river.scrollHeight;
}

function renderStatus() {
  $("#wall-count").textContent = G.wall.length;
  $("#round-label").textContent = "Hand " + G.handNumber;
  const you = G.seats[0];
  $("#your-score").textContent = you.score + " pts";
  // the flipped gold (wild) tile
  const slot = $("#gold-slot");
  slot.innerHTML = "";
  if (G.wildKind !== null && G.wildKind !== undefined) {
    slot.appendChild(tileEl(G.wildKind, { small: true }));
    const note = document.createElement("span");
    note.className = "gold-note";
    note.innerHTML = ` = <b>${tileName(G.wildKind)}</b> — its 3 other copies are wild`;
    slot.appendChild(note);
  }
  renderFlowerRow($("#your-flowers"), you.flowers || []);
  // turn-order line reflects actual seat names (party mode changes them)
  const order = $("#turn-order");
  if (order) {
    order.textContent = "turn order: You → " +
      [1, 2, 3].map(i => G.seats[i].emoji + " " + G.seats[i].name).join(" → ") + " → back to you…";
  }
}

function renderHand() {
  const you = G.seats[0];
  const handRow = $("#hand");
  handRow.innerHTML = "";
  const canClick = G.awaitingDiscard;
  const suggestKind = G.suggestKind;
  const addTile = (k, isDrawn) => {
    const el = tileEl(k, {
      selected: G.selectedIdx === handRow.children.length,
      suggest: suggestKind !== null && k === suggestKind,
    });
    if (isDrawn) el.classList.add("drawn");
    if (canClick) {
      el.classList.add("clickable");
      const idx = handRow.children.length;
      el.addEventListener("click", () => onHandTileClick(idx, k));
    }
    handRow.appendChild(el);
  };
  for (const k of you.hand) addTile(k, false);
  if (you.drawn !== null && you.drawn !== undefined) addTile(you.drawn, true);

  const meldRow = $("#your-melds");
  meldRow.innerHTML = "";
  for (const m of you.melds) meldRow.appendChild(meldEl(m));
  $("#player-panel").classList.toggle("active-turn", G.activeSeat === 0);
}

function renderAll() {
  renderOpponents();
  renderRiver();
  renderStatus();
  renderHand();
  if (typeof netAfterRender === "function") netAfterRender();
}

/* ---------- Actions bar ---------- */

function showActions(buttons) {
  const bar = $("#actions");
  bar.innerHTML = "";
  for (const b of buttons) {
    const btn = document.createElement("button");
    btn.className = "action-btn " + (b.cls || "");
    btn.innerHTML = b.label;
    btn.addEventListener("click", b.cb);
    bar.appendChild(btn);
  }
}
function clearActions() { $("#actions").innerHTML = ""; }

function setPrompt(text) { $("#prompt").innerHTML = text || ""; }

/* ---------- Coach panel ---------- */

function coachSay(html, mood = "🐱") {
  $("#coach-face").textContent = mood;
  $("#coach-msg").innerHTML = html;
}

/* ---------- Log ---------- */

function log(msg, cls = "", localOnly = false) {
  const el = document.createElement("div");
  el.className = "log-line " + cls;
  el.innerHTML = msg;
  const box = $("#log");
  box.appendChild(el);
  while (box.children.length > 80) box.removeChild(box.firstChild);
  box.scrollTop = box.scrollHeight;
  if (!localOnly && typeof netBroadcastLog === "function") netBroadcastLog(msg, cls);
}

/* ---------- Modal ---------- */

function showModal(html, buttons = []) {
  $("#modal-content").innerHTML = html;
  const bar = $("#modal-buttons");
  bar.innerHTML = "";
  for (const b of buttons) {
    const btn = document.createElement("button");
    btn.className = "action-btn " + (b.cls || "");
    btn.innerHTML = b.label;
    btn.addEventListener("click", b.cb);
    bar.appendChild(btn);
  }
  $("#modal-overlay").classList.remove("hidden");
}
function hideModal() { $("#modal-overlay").classList.add("hidden"); }

/* ---------- End-of-hand modal (shared safe renderer: host & guest) ----------
   Built from STRUCTURED DATA only — no raw HTML passthrough — so a party guest
   can never be fed script by the host. Names are HTML-escaped; tile kinds are
   coerced to a valid integer range before they touch any renderer. */
function _kindClamp(k) { const n = k | 0; return n < 0 ? 0 : n > 33 ? 33 : n; }

function endHowText(d) {
  if (d.howType === "qiangjin") return "by <b>ROBBING THE GOLD 抢金</b> — the flipped gold completed a ready dealt hand!";
  if (d.howType === "threegold") return "with <b>THREE GOLDS 三金倒</b> — an instant win!";
  if (d.howType === "selfdraw") return "by self-draw 自摸 🀄";
  return `on ${escapeHtml(d.discarderName || "")}'s discard of ${tileShort(_kindClamp(d.winTile))}`;
}

function endModalHtml(d) {
  if (!d || d.kind === "draw") {
    return "<h2>🤝 The wall ran out!</h2><p>Nobody completed a hand — it's a draw. No points change hands. On to the next one!</p>";
  }
  const esc = escapeHtml;
  const handKinds = (d.handKinds || []).map(_kindClamp);
  const flowers = (d.flowers || []).map(_kindClamp);
  const melds = (d.melds || [])
    .filter(m => m && (m.type === "pung" || m.type === "kong" || m.type === "chow"))
    .map(m => ({ type: m.type, kind: _kindClamp(m.kind), concealed: !!m.concealed }));
  const h2 = d.youWin
    ? "<h2>🎉 Hú! 胡 — You win!</h2>"
    : `<h2>${esc(d.winnerEmoji || "")} ${esc(d.winnerName || "")} wins this hand</h2>`;
  let body = `<p>${esc(d.winnerName || "")} won ${endHowText(d)}</p>`;
  body += `<p><b>The winning hand</b> (gold = ${tileShort(_kindClamp(d.wild))} 🥇):</p>` + tilesHTML(handKinds);
  if (melds.length) {
    body += `<p><b>Claimed sets:</b></p><div class="tile-row">`;
    for (const m of melds) body += meldEl(m).outerHTML;
    body += `</div>`;
  }
  if (flowers.length) body += `<p><b>Flowers (${flowers.length}):</b></p>` + tilesHTML(flowers);
  body += `<p><b>Scoring:</b></p><ul class="fan-list">`;
  for (const l of (d.scoreLines || [])) body += `<li>${esc(l.name)} — ${esc(l.desc)} <b>(+${l.pts | 0})</b></li>`;
  const from = d.everyonePays ? "(everyone pays)" : `— mostly from ${esc(d.discarderName || "")}, who discarded the winning tile`;
  body += `</ul><p><b>Total: ${d.total | 0} points</b> → ${esc(d.winnerName || "")} collects <b>${d.winnerPayout | 0}</b> ${from}.</p>`;
  return h2 + body;
}

/* Render a row of tiles as inline HTML (for tutorial / win screens) */
function tilesHTML(kinds, small = true) {
  const wrap = document.createElement("div");
  for (const k of kinds) wrap.appendChild(tileEl(k, { small }));
  return `<div class="tile-row">${wrap.innerHTML}</div>`;
}
function T(kind) {
  const el = tileEl(kind, { small: true });
  return `<span class="inline-tile">${el.outerHTML}</span>`;
}

/* ---------- Tile guide (legend) ---------- */

function buildLegend() {
  const groups = [
    { kinds: [0, 4, 8],        caption: "<b>Dots</b> (circles), 1–9 — count the circles" },
    { kinds: [9, 13, 17],      caption: "<b>Bamboo</b> (sticks), 1–9 — count the sticks" },
    { kinds: [18, 22, 26],     caption: "<b>Characters</b> — Chinese numeral over 萬 (\"10,000\")" },
    { kinds: [27, 28, 29, 30], caption: "<b>Winds = FLOWERS 🌸</b> — never kept in hand: expose & redraw. Each one multiplies your winning score!" },
    { kinds: [null],           caption: "Face-down tile (hidden). <b>No dragons in FJ style.</b> The glowing 🥇 tile shown at the table is the GOLD — wild!" },
  ];
  const body = $("#legend-body");
  body.innerHTML = "";
  for (const g of groups) {
    const item = document.createElement("div");
    item.className = "legend-item";
    const row = document.createElement("div");
    row.className = "legend-tiles";
    for (const k of g.kinds) row.appendChild(tileEl(k, { small: true }));
    const cap = document.createElement("div");
    cap.className = "legend-caption";
    cap.innerHTML = g.caption;
    item.appendChild(row);
    item.appendChild(cap);
    body.appendChild(item);
  }
}
