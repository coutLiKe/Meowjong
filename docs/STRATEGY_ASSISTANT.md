# Design Draft: The Analyst — Advanced Strategy Assistant

**Status: proposal only — not implemented.**
A deep strategic analysis system for FJ Meowjong, distinct from both the Tutorial and Professor Paws (the Coach).

---

## 1. Feature proposal

**The Analyst** is an on-demand, per-turn decision engine. Where the Coach gives one friendly
suggestion, the Analyst enumerates **every legal action**, scores each one quantitatively,
models opponents from public information, and simulates the hand several turns ahead. It
answers three questions on any turn:

1. **What are all my options, ranked?** (every discard, every claim, kong, win, fold)
2. **What does each option cost/gain me?** (win probability, expected points, deal-in risk)
3. **Why?** (an expandable evidence trail: waits, live-tile counts, opponent threat models,
   simulated futures)

It is a tool for a player who already knows the rules and wants to close the gap between
"playing" and "playing well" — an engine review panel, in chess terms, not a teacher.

### Core capabilities

| Capability | Description |
|---|---|
| **Action enumeration** | On your turn: all 14 discards + kong/win options. Out of turn: claim vs pass. Each becomes a scored node. |
| **Hand evaluation** | For each action: resulting shanten (wild-aware), wait width, live-tile counts, gold utilization, flower-adjusted expected value. |
| **Opponent modeling** | Per-opponent threat profile from public info: exposed melds (speed), discard patterns (suit reading), flower count (payout size), tempo (claim frequency). Produces a per-tile **deal-in risk estimate**. |
| **Look-ahead simulation** | Monte Carlo rollouts over the unseen-tile distribution: play out N simulated futures per candidate action (2–4 turns deep) to estimate win%, draw%, and deal-in%. |
| **Recommendation** | Ranked action list with a composite score: `EV = P(win)·avgWinPts − P(dealIn)·avgLossPts − P(otherWins)·avgTax`, plus a plain-language rationale per line. |
| **Fold detection** | Recognizes when no action has positive EV and recommends a defensive line ("fold: discard safe tiles in this order: …"). |

---

## 2. UI wireframe

A collapsible **Analyst panel** that docks below the coach panel (desktop) or as a bottom
sheet (narrow layouts). Closed by default; opened via a header toggle or per-turn button.

```
┌─ THE ANALYST ────────────────────────────── [auto ▢] [✕] ┐
│ Turn 14 · you are 1 step from ready · seat EV: +12.4     │
│                                                          │
│ RANKED ACTIONS                                           │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ ➊ Discard 9萬   EV +18.2   win 24%  deal-in 3%   ▸  │ │
│ │ ➋ Discard 1●    EV +15.1   win 22%  deal-in 2%   ▸  │ │
│ │ ➌ Gang 4∥       EV  +9.8   win 19%  deal-in 6%   ▸  │ │
│ │ …11 more (all discards scored)              [show ▾] │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                          │
│ ▸ expanded row ➊:                                        │
│   Waits after: 3∥(3 left) 6∥(4 left) → 7 live outs      │
│   +2 outs via gold draws (3 golds unseen)                │
│   Risk: 9萬 seen twice, Mochi discarded 8萬 → safe-ish   │
│   Rollout (200 sims): win 24% · Biscuit wins 31% ·       │
│   wall-out 18% — Biscuit is the race to beat             │
│                                                          │
│ THREATS   Mochi ▂▂▅ (2 melds, 1🌸)  Biscuit ▂▅█ (3 melds,│
│           4🌸 — feeding them costs ~80)  Whiskers ▂▂▂    │
└──────────────────────────────────────────────────────────┘
```

Key UI decisions:
- **Numbers first, prose on demand** — each row expands into the evidence trail.
- **Threat meters** always visible: per-opponent bars combining speed × payout.
- **Auto mode** (off by default): re-analyze every turn automatically vs on-click.
- Uses the existing design system: panel cards, `--accent` highlights, tile glyphs via
  `tileShort()`, small inline icons from `icons.js`.

---

## 3. Example workflow

1. Mid-game, your turn: you draw 7●. The header Analyst button shows a pulsing dot
   (analysis ready / stale).
2. You open the panel. Within ~300 ms the ranked list appears (progressive: instant
   heuristic ranking first, rollout percentages fill in as simulations finish).
3. Top line: *"Discard 9萬 — EV +18.2."* You expand it: it keeps your open 3∥/6∥ wait
   (7 live outs), and 9萬 is near-safe (two copies visible, Biscuit shed Characters twice).
4. You notice line ➌ suggests your Gang is actually *negative* EV — expanding explains:
   "+1 back-wall draw, but collapses your 4∥ from two runs into a locked triplet; win%
   drops 5 points."
5. You discard 9萬. The panel grays out until your next decision point.
6. Later, Biscuit's 4th meld goes down. The Analyst banner flips to **fold advice**:
   *"No positive-EV line remains. Safe discard order: 北-adjacent 9●, then paired 1萬…"*

## 4. Example recommendations (as they would render)

> **➊ Discard 1● — EV +21.4 (win 27%, deal-in 1%)**
> Keeps the 5∥6∥ open wait (8 outs, 6 still live) and your gold stays free to finish
> either remaining set. 1● is dead-safe: three copies visible, and Mochi is collecting
> Bamboo, not Dots.

> **➋ Peng the 6萬 — EV +9.0 (win 21%, deal-in 4%)** — *offered on Whiskers' discard*
> Completes set #3 and steals a tempo beat, but locks you out of the 5-6-7萬 extension
> and reveals your Characters lean. Worth it only because you hold 3 flowers: your win
> pays 30+ and speed now outweighs flexibility. **Take it.**

> **⚠ Fold recommended — best EV line is −4.1**
> Biscuit: 3 melds + 5 flowers → their win costs you ~40 (80 if you feed them). Your hand
> is 2 steps from a 10-point win. Recommended discard order: 9● (3 visible) → 1∥ (they
> discarded the suit twice) → your paired 2萬 last.

---

## 5. Technical architecture

```
js/analyst/
├─ analyst.js          orchestrator: action enumeration, caching, UI feed
├─ evaluator.js        deterministic scoring (shanten Δ, wait width, live outs,
│                      gold utility, flower-weighted EV) — reuses engine.js DFS
├─ threat.js           opponent models from public state (melds, river, flowers,
│                      claim tempo) → per-tile deal-in risk vector
├─ rollout.worker.js   Web Worker: Monte Carlo simulation of unseen-tile futures
└─ panel.js            Analyst panel UI (ranked rows, expanders, threat meters)
```

- **Layer 1 — exact math (sync, <5 ms):** for each candidate action, reuse the existing
  wild-aware engine (`isWinningCounts`, `winningKinds`, `liveCount`) to compute shanten,
  waits, and live outs. This alone produces a correct heuristic ranking instantly.
- **Layer 2 — threat model (sync, <5 ms):** extends today's `dangerNote()` heuristics into
  a numeric per-tile risk vector per opponent (suit-lean × meld count × flower payout).
- **Layer 3 — rollouts (async, Web Worker):** sample unseen tiles into hypothetical walls
  and opponent hands consistent with public info; play K simplified turns (greedy policy
  for all seats); aggregate win/deal-in/wall-out rates. Results stream back and refine the
  Layer-1 ranking without blocking the UI thread.
- **Host-side in party mode:** the Analyst runs purely on each player's *own* visible
  state (their projected snapshot), so it works identically for guests with zero protocol
  changes — and can never leak hidden information it doesn't have.

## 6. How it differs from the Coach

| | **Professor Paws (Coach)** | **The Analyst** |
|---|---|---|
| Audience | Learners | Competent players |
| Trigger | Automatic commentary + one Hint | On-demand panel (optional auto) |
| Output | One suggestion, friendly prose | *All* actions, ranked, with numbers |
| Depth | Current-hand heuristics | Opponent models + multi-turn simulation |
| Tone | Teacher ("never discard gold!") | Advisor ("Gang = −5% win, here's why") |
| Cost | Negligible | Bounded background compute |

They coexist: Coach stays the default for new players; the Analyst is a power tool you
grow into (and the Coach could even point at it: "want the full math? open the Analyst").

## 7. Performance considerations

- **Budgeted rollouts:** cap at ~200 sims/action, 2–4 turns deep, in a Web Worker with a
  150 ms soft deadline — return whatever converged; rows show "est." until refined.
- **Progressive rendering:** Layer-1 exact math renders instantly; percentages hydrate in.
- **Cache by state hash:** (hand + river + melds + flowers) → memoized analysis; a re-open
  on the same turn is free.
- **Prune before simulating:** only roll out the top ~5 heuristic candidates; the rest keep
  Layer-1 scores. Cuts worker load ~70% with no ranking change in practice.
- **Battery/background:** suspend auto-analysis when the tab is hidden (timers are
  throttled anyway) and in party mode when it's not your decision point.
- **Wild-DFS cost:** the exact win-checker is already sub-millisecond; the only real cost
  is rollout volume, which is fully tunable (a "fast/thorough" setting).

---

*Draft v1 — ready for review. Suggested first milestone: Layers 1–2 only (no rollouts),
which already delivers ranked discards with risk notes at effectively zero cost.*
