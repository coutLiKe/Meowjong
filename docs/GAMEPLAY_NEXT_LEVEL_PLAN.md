# Meowjong — Gameplay Next-Level Plan

**Status: SHIPPED — all four pillars implemented, 2026-07-17.**
**Revision note:** dropped selectable AI difficulty tiers per direction — "you
always want to try and win no matter what." Every cat plays at one strength:
full Analyst-driven EV + danger awareness, always. Personality is flavor (a
fixed bias layered on identical information/tile access), not a strength dial.

**What shipped, milestone by milestone:**
- **G1 · Unified strong AI** — `js/ai.js` (`seatThreats`/`seatRisk`/`seatWinProb`/
  `chooseDiscardSmart`/`seatWantsPung`/`seatWantsChow`) replaced the old
  shape-only heuristic in `js/main.js`'s `aiTurnLoop`/`resolveClaims`. No
  selector, no UI surface — every cat, solo and party AI-fill seats alike.
- **G2 · Cat personalities** — `CAT_PERSONALITIES` in `js/ai.js`: Mochi
  (aggressive chaser), Biscuit (defensive folder), Captain Whiskers
  (flower-hoarder) — fixed weight biases on the same engine, not a strength
  difference.
- **G0 · Seeded RNG scaffold** — `mulberry32` + optional `rand` param on
  `buildWall()` in `js/tiles.js`. Live/party play still calls `buildWall()`
  with no seed (`Math.random()`, untouched); only Daily Hand passes one.
- **G3 · Match Play (solo)** — turned out to already exist (`MATCH_HANDS`,
  `showStandings`, "Keep playing") from earlier work; left as-is and reused
  as the foundation for G7.
- **G4 · Daily Hand** — `startDaily()`/`showDailyResult()` in `js/main.js`: one
  seeded hand per UTC calendar day, "Try again" re-deals the identical wall,
  personal best stored locally (`meowjong-daily-best`). Menu entry added.
- **G5 · Stats ledger** — new `js/stats.js`: hands played, win rate, self-draw/
  instant-win counts, deal-ins, avg flowers, biggest hand — persistent local
  counters recorded from `doWin`/`drawGame`. Menu entry + reset confirmation.
- **G6 · Hand recap** — scoped to solo, current-hand only (as flagged as the
  likely scope-down): `G.myDiscardLog` traces each of your discards' shanten
  before/after; a "📜 Recap" button on the win/draw modal opens it and a
  "Back" button returns to that same end-of-hand modal (not a bare close —
  this was caught and fixed during live testing so "Next hand"/"New match"
  are never stranded behind the recap view).
- **G7 · Match Play (party) + AI at full strength in AI-fill seats** — host
  picks a match length (8/16/24 hands) in the lobby; `nextHand()` now also
  triggers standings for a party host, broadcast to guests via a new
  structured `{t:"standings"}` message (`standingsData`/`standingsHtml` in
  `main.js`, `netBroadcastStandings` in `net.js` — never raw HTML, matching
  the existing end-modal channel's safety property).
- **G8 · Spectator join** — scoped down from a full board view to a safe,
  lightweight read-only text summary (deliberately NOT touching the tuned 3D
  renderer): a 5th+ joiner gets `NET.spectators[]`, a redacted
  `projectForSpectator()` snapshot (all hands hidden, public info only), and
  a live-updating modal panel instead of being turned away.

All of the above verified via `node tests/run.js` (86/86 green throughout) and
live browser smoke tests: a full 8-hand solo match, a full Daily Hand run with
deterministic re-deal, the stats screen, the recap round-trip, and the party
lobby/spectator code paths exercised directly (no second browser available in
this environment, so the P2P wire path itself is unverified end-to-end —
flagged below).

**Known gap / next verification step:** G7/G8's net.js changes have not been
exercised with two real, separate browser connections (only unit-level calls
against fabricated state). Recommend a manual two-browser party smoke test
(start a room, join as a guest, join a 5th connection as a spectator, run a
short match to a standings screen) before calling party mode's new surface
fully proven.
**Scope: actual gameplay — AI strength, match structure, replay/meta-progression,
party depth. This is deliberately the complement of the two already-approved
presentation proposals (`GAMEPLAY_REVAMP_PROPOSAL.md` — table/motion/HUD, shipped
M0–M8; `EMOTE_SYSTEM_PROPOSAL.md` — reactions, shipped E1–E3). Those made the game
*feel* alive. This plan makes the game itself deeper: sharper opponents, real
match structure, memory across hands, and richer social play. FJ rules
(`js/engine.js`) stay the single implemented variant — nothing here forks the
ruleset; everything is additive and toggleable.*

---

## 0. Where this picks up

Two things already on record point straight at this work:

- **`docs/FAIRNESS_REVIEW.md` §6–7 (2026, unimplemented).** Confirmed by a
  200,000-deal simulation that the shuffle/deal are perfectly fair — the "I win
  too easily" feeling is real but caused by **assistance asymmetry** (you get
  Professor Paws + the Analyst; the cats don't) and **flat AI** (`js/ai.js`
  `chooseDiscard`/`aiWantsPung`/`aiWantsChow` is one fixed heuristic, no danger
  awareness, no difficulty tiers, no personality). The review explicitly drafted
  a fix (§6) and asked a still-open question: is the goal *harder opponents*,
  *less lopsided-feeling matches*, or both? This plan answers "both," staged so
  you can stop after either.
- **The game currently has exactly one shape of session**: a single hand (or an
  endless string of single hands) via `startSolo()`/`startHand()` in
  `js/main.js`, with no match target, no seeded replay, and no memory of past
  hands beyond the current save-slot (`storeGet`/`storeSet`, `SAVE_KEY`). There
  is no stats/progression surface at all today.

Both are gameplay gaps a presentation pass can't touch — this plan is where they
get addressed.

---

## 1. Pillars

1. **Opponents that actually scale.** Difficulty tiers and personalities, built
   on the Analyst engine that already exists (`js/analyst.js`) — reuse, don't
   rebuild.
2. **A session has a shape.** Beyond one hand: matches with a target (points or
   round count), a rotating prevailing wind, a real "you won the table" moment.
3. **The game remembers you.** Stats, hand history/replay, a seeded daily hand —
   turns single sessions into a game with a throughline.
4. **Party mode grows up.** The four-human table gets house-rule choices and
   lightweight structure (already has emotes for voice; this adds match shape).

Hard constraints carried over from the sibling proposals (unchanged): FJ rules
and scoring stay canonical by default; party-mode host-authoritative determinism
is never put at risk; no build step, no server, `file://`-friendly; every new
system is off-by-default/opt-in unless explicitly a default upgrade approved
below.

---

## 2. Opponent AI — one strong brain + personality (Pillar 1)

**Where:** `js/ai.js` (discard/claim heuristics), `js/analyst.js` (the shared EV
+ danger engine already computed for the human's Hint/analysis panel).

**The core move:** cats currently think with `chooseDiscard`+`evalCounts` alone
— shape efficiency, zero table awareness, zero opponent modeling, one strength
for every cat, every game. The Analyst engine already computes exact shanten,
ukeire, per-opponent deal-in risk, and ranked EV for the human every turn. Wiring
that same engine into the AI turn (instead of duplicating logic) is the single
highest-leverage change available:

**Direction confirmed: no difficulty tiers.** Every cat, in every game
(single-player and party AI-fill seats), always plays to win at one strength —
the strongest one available. There is no "easy mode" opponent; a cat that plays
worse than it can is just a worse game. Concretely, the fixed heuristic in
`chooseDiscard`/`aiWantsPung`/`aiWantsChow` (shape efficiency only, zero table
awareness) is **replaced outright**, not gated behind a selector:

- **Danger-aware discarding.** Before discarding, weigh `dangerNote`-style
  signals (an opponent with 2+ exposed melds building a suit, a big flower
  pile raising the stakes) against shape value — prefer an equally-good but
  safer tile when one exists, and knowingly push into danger only when the EV
  says so. This alone answers "cats never fold."
- **EV-driven decisions, not just shape.** The Analyst engine already computes
  exact shanten, ukeire, and per-opponent deal-in risk to rank the human's
  options every turn (EV = win% × payout − deal-in risk). Cats read from the
  **same engine** for both discards and claims (chi/pon/kong), so they play at
  "coach quality" by default — no separate, weaker code path to maintain.
- **Claim discipline.** Skip a chi/pon that strands a wide wait or would be
  worse EV than passing, exactly as the Analyst would advise the human.

**Personality — flavor, not strength.** A small fixed weight bias per named cat
on top of the identical engine and identical tile access: e.g. an aggressive
chaser (pushes thin waits a hair further), a defensive folder (folds a shade
earlier on danger cues), a flower-hoarder (values flower count over raw speed),
a tempo player (claims a bit more readily for board control). None of these
make a cat play *worse* overall — they bias *which* good line it prefers, the
same symmetric-randomness/asymmetric-strategy framing the Fairness Review used.
Assign each named cat (check `js/main.js` seat setup for current names) one
fixed personality so repeat players learn "Whiskers always pushes," mirroring
the fixed reaction biases the emote system already gave them.

**Player-facing surface:** none needed — no selector, no menu option. This
ships as a straight upgrade to `js/ai.js`; every game gets stronger opponents
immediately, solo and party alike.

**Verify:** a regression test asserting the new AI's simulated win-rate is
materially higher than the old fixed-heuristic baseline over N seeded hands
(reusing the fairness harness's Monte Carlo scaffolding to prove the change
landed, not to compare tiers); a danger-awareness unit test (given a fixed hand
+ a clear opponent threat, the AI must not discard the obviously dangerous tile
when an equal-value safe one is available).

---

## 3. Match structure — from "a hand" to "a game" (Pillar 2)

**Where:** `js/main.js` (`startHand`, `startSolo`, hand-result flow), new
lightweight match-state object alongside `G`.

Today a "game" is however many discrete hands you choose to play in a row, with
score persisting only within a browser session and no target or finish line
beyond closing the tab. Proposed additions, all opt-in from the pre-game screen:

- **Quick Hand (today's mode, unchanged default).** One hand, score shown,
  "next hand" — exactly current behavior. No regression risk.
- **Match Play (new).** Choose a **target**: point total (e.g. first to 200) or
  **hand count** (e.g. best cumulative score over 8 hands, dealer rotates each
  hand/win per standard FJ dealer-continuation rules already implicit in the
  engine). At the target, a **Match Result** screen replaces the per-hand modal:
  final standings, biggest hand, best/worst tenpai streak — a real finish line.
  This is the one addition here with actual engineering weight (a match-level
  score ledger + end condition check hooked into the existing hand-result flow)
  but touches no scoring math in `engine.js`.
- **Rotating prevailing wind (optional toggle, off by default to start).**
  FJ already tracks seat winds for flowers; a "ranked-feel" toggle advances a
  round wind across a Match, changing which wind is "prevailing" for flavor/
  narration only (no scoring hook unless a later pass wants one — flag this as
  cosmetic-first so it can't destabilize scoring).
- **Daily Hand (new, seeded).** One fixed deal per calendar day (a small
  seeded PRNG — mulberry32, exactly the Fairness Review's §5 recommendation —
  replaces `Math.random()` for this mode only; live/party play keeps
  `Math.random()` untouched). Same seed for everyone who opens the game that
  day; a personal best (score, hand count to win) stored locally. No server, no
  leaderboard — this stays a single-player, zero-backend feature: the "shared
  puzzle" feeling without needing an account system.

**Verify:** match ledger unit tests (target reached triggers result screen,
dealer rotation matches FJ convention); daily-hand determinism test (same
calendar date → identical wall across repeated `buildWall` calls with the
seeded RNG).

---

## 4. Memory — stats, hand history, replay (Pillar 3)

**Where:** new `js/stats.js` (pure data, mirrors the existing `storeGet/Set`
pattern), a new panel reusing existing modal chrome.

- **A lightweight local stats ledger.** Hands played, win rate, average shanten
  reached, average flowers per win, biggest single-hand score, instant-win count
  (三金倒/抢金 tallied separately since they're the flashiest moments). Purely
  additive counters updated at existing hand-end hooks — no new gameplay logic,
  just recording what already happens. Surfaced as a simple stats screen off the
  menu.
- **Hand history + replay scrubber.** Log the sequence of draws/discards/claims
  for the current hand (much of this is already narrated in the game log); a
  post-hand "replay" view steps through it with the Analyst's shanten/ukeire
  overlay at each step — turns every hand into a free lesson after the fact,
  reusing the Analyst engine a third time rather than building new analysis.
  Scope note: this is the single largest item in this plan; ship it after
  match structure, and consider limiting v1 to *the current hand only* (no
  cross-session archive) to bound the work.
- **Seed + replay for bug reports (from the Fairness Review, still open).** Log
  the hand's seed; a "copy seed" button on the result modal lets a player share
  or re-run a hand that "felt off" — direct QA value, and a free building block
  for the Daily Hand feature above (same seeded-RNG plumbing serves both).

**Verify:** stats persistence survives reload (existing save-slot test pattern);
replay scrubber renders the same shanten numbers the live coach showed in the
original hand (no silent divergence between live play and replay).

---

## 5. Party mode gameplay depth (Pillar 4)

**Where:** `js/net.js`. Emotes (E1–E3) already gave the table a voice; this
section is match *structure* for a room of humans, not more communication.

- **Match Play in party rooms.** The Match Play target from §3 (point total or
  hand count) becomes a lobby setting the host picks before dealing — turns
  "we're playing party mode" into "we're playing a set," with the Match Result
  screen as the natural end-of-session moment for the whole room.
- **AI-filled seats play at full strength too.** When a seat is AI-filled
  (empty/disconnected), it runs the same one-strength engine from §2 — no
  "relaxed" fill-in bot; a party game stays fully contested even if a seat
  drops.
- **Spectator join (new, small).** Someone who joins a room mid-hand today
  either fills a seat or is turned away; a lightweight spectator view (read-only
  render of the public state: river, melds, flowers, wall count — never
  opponents' concealed hands) lets a 5th+ friend watch and chat via emotes
  without disrupting the four-seat protocol. Strictly additive to `net.js`'s
  existing message set; a spectator never sends a game-affecting message.

**Verify:** existing `tests/net.test.js` pattern extended for the new lobby
setting (host-authoritative, guests can't override) and spectator no-op safety
(spectator messages never mutate authoritative state).

---

## 6. Explicit non-goals (for this pass)

- **No new mahjong variant.** FJ stays the only ruleset; no Riichi/Cantonese/
  Sichuan mode. (A variant switcher is a plausible *future* ask but is a
  ground-up rules-engine project, not a "next level" increment on this one.)
- **No online ranked ladder / server-backed leaderboard.** Would require an
  account system and backend, breaking the zero-server, `file://`-friendly
  constraint that's a stated feature, not an accident. Daily Hand gets the
  "shared puzzle" feeling without one.
- **No monetization/currency/streaks.** Same stance the emote proposal already
  took — this stays a free café game; unlocks (if any) are milestone-gated, not
  purchased.

---

## 7. Milestones

Ordered by dependency; each independently shippable and testable.

| # | Milestone | Ships | Difficulty | Depends on |
|---|---|---|---|---|
| **G0** | Seeded RNG scaffold | Optional mulberry32 PRNG behind a flag; `Math.random()` untouched for live/party play | ★★☆☆☆ | — |
| **G1** | Unified strong AI | `js/ai.js` discard/claim logic replaced with danger-aware, Analyst-EV-driven decisions for every cat, solo and party, no selector | ★★★★☆ | — |
| **G2** | Cat personalities | Fixed weight bias per named cat, layered on G1 | ★★☆☆☆ | G1 |
| **G3** | Match Play (solo) | Point/hand-count target, match ledger, Match Result screen | ★★★☆☆ | — |
| **G4** | Daily Hand | Seeded daily deal, personal-best local storage | ★★☆☆☆ | G0 |
| **G5** | Stats ledger | Persistent counters + stats screen | ★★☆☆☆ | — |
| **G6** | Hand history + replay scrubber | Current-hand step-through with Analyst overlay | ★★★★☆ | — |
| **G7** | Match Play (party) + AI-filled seats at full strength | Host-set target; AI-fill seats always run G1's engine | ★★★☆☆ | G1, G3 |
| **G8** | Spectator join | Read-only room view for a 5th+ guest | ★★★☆☆ | — |

**Starting now: G1 (unified strong AI)** — it's the direct, already-scoped
answer to the Fairness Review's open question, ships with no UI surface at all
(no selector to design), and is the highest
player-facing impact per unit of work. **G3 + G5** (Match Play + stats) is a
strong second slice — it gives the game a shape and a memory. G6 (replay) is the
single biggest lift here and can trail.

---

## 8. Risks & mitigations

- **A stronger AI suddenly feels "unfair" rather than "harder."** → The Fairness
  Review already proved the deal itself is unbiased; only the opponents'
  *policy* changes, using information (danger, EV) the human already sees via
  the coach. Frame it in-game (log/tutorial copy) as "the cats learned to play
  properly," not a difficulty spike out of nowhere.
- **Match Play changing scoring semantics.** → Match ledger is presentation/
  bookkeeping on top of `engine.js`'s existing per-hand `fjScore`/`fjPayout`;
  it never modifies a hand's score, only accumulates it and defines a stopping
  point.
- **Seeded RNG leaking into live/party determinism.** → Scoped strictly to
  Daily Hand (single-player only); live and party play keep `Math.random()`
  exactly as today. Explicit test asserts party mode's wall-build path is
  untouched.
- **Replay (G6) scope creep.** → Cap v1 to the current hand only; a
  cross-session hand archive is a clearly separable future ask, not bundled in.
- **Party spectator abusing the protocol.** → Spectator messages are a strict
  read-only subset validated host-side, same pattern as emote rate-limiting.

---

## Summary

The presentation revamp made Meowjong *feel* like a real game; this plan makes
it *play* like one that grows with you: opponents with real teeth (G1–G2), a
session with a finish line (G3, G7), a game that remembers what you did (G4–G6),
and a party table with actual match shape (G7–G8) — all built on engines
(`Analyst`, `Fisher–Yates` shuffle) already proven correct, and all opt-in or
default-preserving so nothing currently working regresses.

**Starting point: G1 (unified strong AI) first** — it directly answers the
standing open question from the Fairness Review, needs no new UI, and is the
highest-leverage single change available. Implementation begins now.
