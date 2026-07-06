# Meowjong — Deep Codebase Audit & Red Flag Analysis
*Audit date: 2026-07-04 · Scope: entire repo (4,016 LOC: 10 JS files, 1 CSS, 1 HTML) · Method: full source read + protocol trace + metrics (grep counts, complexity analysis). Findings marked **CONFIRMED** (verified in source) or **POTENTIAL** (needs measurement).*

Companion summary lives in the session report. Issues numbered for cross-reference.

## Remediation status
**Phase 1 (part A) — DONE 2026-07-04** (verified in preview, 5/5 solo hands clean):
- ✅ **C2** global `error`/`unhandledrejection` handlers + `handLoop` try/catch → `reportFatal()` recovery modal (re-deal / menu; guests get reload). No more silent freezes.
- ✅ **C3 + H2** PeerJS vendored to `js/vendor/peerjs.min.js`, lazy-loaded via `ensurePeerLib()` on first Party use, removed from the boot path. Splash no longer gated on any network resource. Static CDN `<script>` deleted (supply-chain risk gone).
- ✅ **C1 (name vector)** `sanitizeName()` strips `< > = "` etc. at every entry point (`getPartyName`, host `hello` receipt). *Remaining: host→guest raw-HTML modal channel (P1-7).* 
- ✅ **H5 + gotoMenu leak** `cancelPendingChoices()` resolves abandoned turn/claim sinks on `startHand`/`gotoMenu`/`netShutdown` — coroutines now exit via their gen check instead of leaking.
- ✅ **M7** removed forced auto-reload in `netShutdown` (user-triggered now).
- ✅ **M6** guest lobby now has a Leave button.
- ✅ **M8** `storeGet/storeSet` localStorage wrappers (survive Safari private mode).
- ✅ **M13** `flipGold` null-guard.
- ✅ **M1** Analyst added-Gang meld-count fix (was off-by-one; verified tenpai reading correct).

**Phase 1 (part B) — DONE 2026-07-04** (verified: solo 6/6 + 4/4 clean; 2-client party test — join, structured win modal, promptCancel, disconnect→cat takeover):
- ✅ **H3** heartbeat (`startHostHeartbeat`/`startGuestHeartbeat`, 7 s ping / 22 s timeout) detects dead peers fast → existing cat-takeover fires; `netHostPrompt` now has a 60 s AFK timeout and a self-cleaning resolver (no more leaked `NET.pending` entries or frozen tables).
- ✅ **H4** `netBroadcastPromptCancel()` on every `startHand` → guests run `clearLocalPrompt()`; no stale claim buttons over a fresh hand.
- ✅ **C1 (remainder)** host→guest modals now carry **structured data** rendered by the shared `endModalHtml()` (escapes names, coerces/clamps tile kinds, drops malformed melds). Guest `log`/`coach` messages pass through `sanitizeMarkup()` (escape-all-then-restore-allowlist: `<b> <i> <br> <span class="log-dim">`). The raw-HTML host→guest channel is closed.
- ✅ Also: `?v=p1b` cache-buster on all local assets (protects users from stale-JS on updates).

**Phase 1: COMPLETE.**

**Phase 2 (Stability) — DONE 2026-07-04** (verified: save-on-start, resume restores scores/dealer/hand, 8-hand match→standings, corrupt & bad-shape saves rejected, party mode writes no save, full solo match clean):
- ✅ **H8** Save/resume — `saveMatch()` writes the match ledger (scores, dealer, hand #, match length; versioned `v:2`) to localStorage at each hand boundary; `loadMatch()` validates and rejects corrupt/party blobs; menu shows a **Resume** button (primary) with a live summary; "Single Player" confirms before overwriting a save. Hand-boundary granularity by design (a suspended async turn-loop can't be safely serialized; full mid-hand restore deferred to a Phase 4 deterministic-replay refactor).
- ✅ **M9** Match structure — a match is `MATCH_HANDS` (8) hands, then a ranked **standings** screen (New match / Keep playing / Menu); no more infinite score drift.
- ✅ **H1** Trust model surfaced in the party dialog ("play with people you trust — the host's device holds everyone's tiles").
- ✅ **M12** In-game **House rules & scoring** reference (menu link) documenting FJ scoring and the deliberate simplifications (chi-from-left, no robbing-the-kong, dealer-excluded 抢金, no dead wall).
- (H5/M6/M7/M8/M13 were already delivered in Phase 1.)

**Phase 2: COMPLETE.**

**M11 (Automated tests) — DONE 2026-07-04** (pulled forward from Phase 4 — highest-leverage item):
- ✅ **57 passing unit tests**, zero dependencies, run via `npm test` / `node tests/run.js`.
- A `vm`-based harness (`tests/harness.js`) loads the **real unmodified source** (tiles/engine/ai/net/main) with DOM/localStorage stubs — no refactor needed to test production code.
- Covers the crown jewels: wild-aware `isWinningCounts` (incl. the "gold can't be the pair" rule, two-wild sets, run-vs-pair decomposition), `winningKinds` waits, claim eligibility with gold exclusion, `fjScore`/`fjPayout` (all bonuses + point conservation), `chooseDiscard` never sheds a gold, live-tile counting, `sanitizeName`/`sanitizeMarkup`/`escapeHtml` injection guards, and the full save/resume validation matrix (corrupt/version/party/range rejection + private-mode storage).
- Already earned its keep: writing them surfaced (and corrected) a wrong assumption in a test about seven-pairs decomposition — proving the engine correctly accepts run-decomposable hands.

**Phase 3 (Performance) — DONE 2026-07-04** (benchmark-driven; 59 tests green; solo 5/5 + 2-client party verified):
- ✅ **H6** Memoized the recursive evaluators `evalRec`/`evalCounts` and `bestShape` (per-call Map keyed on the counts string; sub-states below index `i` are always 0, so the key is exact). Benchmarked worst case (flush + wilds): **`evalCounts` 1.21ms → 0.027ms (~45×)** — that's the `chooseDiscard` hot path run ~14× every AI turn (≈17ms → ≈0.4ms). Transparent (all engine tests still pass). Left `isWinningCounts` alone (already 0.005ms). Bench script: `node tests/bench.js`.
- ✅ **H9** Coalesced + deduped the host→guest state broadcast: `netAfterRender` now queues a single microtask flush instead of sending on every `renderAll` (was 4–8×/turn); `netFlushState` skips guests whose snapshot is byte-identical. Every host→guest event (prompt/log/modal) flushes first, so **state always precedes the event that references it** (verified: `promptEverBeforeState: false`; ~8 states vs 7 logs where the old code sent dozens).
- 🐛 **Found & fixed a latent crash** while verifying: the new flush-before-log made `projectFor` run before the first deal → `s.hand.length` of undefined → would have crashed any host starting a party. Made `projectFor` null-safe and added 2 regression tests (now 59 total).

**Phase 3: COMPLETE.** Next: Phase 4 (ES modules, split god-object G) — architectural, lower urgency now that tests exist.

---

## 🔴 CRITICAL

### C1. HTML injection / XSS through the party protocol
- **Location:** `net.js` `hostStartGame()` (~L166: `G.seats[i].name = g.name`), `guestOnData()` L313–315 (`showModal(d.html, [])`), L307–311 (`log(d.msg)`, `coachSay(d.msg)`); consumed unescaped by `main.js` `pushDiscard()` L407, `applyClaim()` L560, `doWin()` L691–703, `ui.js` `renderStatus()` turn-order line, `log()` (innerHTML).
- **Description (CONFIRMED):** `escapeHtml()` exists but is applied in only 5 places (lobby list, disconnect log, shutdown reason). Guest-supplied names flow raw into dozens of `innerHTML` sinks on the host *and* are re-broadcast to every guest. Separately, guests render **arbitrary raw HTML sent by the host** (`t:"modal"`, `t:"log"`, `t:"coach"`).
- **Root cause:** trust boundary never defined; escaping treated as per-call-site garnish instead of enforced at the sink.
- **Why it matters / impact:** the 14-char name cap blunts (but does not block — `<svg onload=…>` is exactly 14 chars) name-based payloads; the host→guest HTML channel is *unbounded*: anyone who gets you to join their room code can execute arbitrary HTML/JS in your browser (steal localStorage, redirect, mine, deface).
- **Fix:** (1) sanitize names on receipt to `[\w \-']{1,14}`; (2) escape at every sink or switch log/coach to `textContent` + a tiny trusted-markup formatter; (3) replace `t:"modal"` raw HTML with structured data ({winnerSeat, handKinds, scoreLines…}) rendered by trusted client code.
- **Difficulty:** Medium (½–1 day). **Schedule: immediately, before any public sharing.**

### C2. Async game core has zero error handling — one exception = permanent silent freeze
- **Location:** whole engine. Metrics: exactly **7 `try/catch` in 4,016 LOC, all wrapping PeerJS `send()`** in net.js. `handLoop`/`takeTurn`/`resolveClaims`/`doWin` (main.js L182–493) have none; no `window.onerror` / `unhandledrejection` handler exists.
- **Description (CONFIRMED):** any throw inside the async turn pipeline becomes an unhandled promise rejection. The loop dies; UI stays frozen mid-turn with no message, no recovery, no log.
- **Root cause:** happy-path development; the `gen` token cancels loops deliberately but nothing handles *accidental* death.
- **Impact:** soft lock. Repro: inject any error into `aiTurnLoop` → hand halts forever; user's only exit is knowing to press Re-deal. In party mode all four players hang.
- **Fix:** wrap `handLoop` body in try/catch → log, toast "something went wrong — re-dealing", `startHand()`; add global `error`/`unhandledrejection` listeners that surface + recover; route to a `reportError()` seam for future telemetry.
- **Difficulty:** Easy (2–3 h). **Immediately.**

### C3. Loading gate depends on a render-blocking third-party CDN — infinite splash on bad networks
- **Location:** `index.html` L~160 (`<script src="https://unpkg.com/peerjs@1.5.4...">`, synchronous, no `integrity`), `main.js` L824–827 (`finishLoading` waits on `window` `load`).
- **Description (CONFIRMED):** the splash→menu transition fires on `load`, and `load` waits for the synchronous unpkg script. On captive portals / blackholed DNS / very slow links, that request can stall 30–75+ s → **the loading screen never ends** ("Shuffling the tiles…" forever). If the script ultimately fails, `startHosting()`/`startJoining()` call `new Peer(...)` with `Peer` undefined → uncaught ReferenceError and a dead party dialog.
- **Root cause:** third-party dependency placed on the boot critical path; no existence guard.
- **Fix:** add `defer`/`async` + load PeerJS lazily when Party is opened; gate the splash on `DOMContentLoaded` + a hard 3 s cap; guard `typeof Peer === "undefined"` with a friendly "party mode needs internet" message; add SRI (see H2).
- **Difficulty:** Easy (1–2 h). **Immediately.**

---

## 🟠 HIGH

### H1. Client-side trust: the host *is* the server (cheating & fairness)
- **Location:** architecture (net.js host-authoritative model; `buildWall()` uses `Math.random`).
- **CONFIRMED by design:** the host's browser holds all hands in plain `G.seats[i].hand`; devtools = full wallhack. RNG is unseeded, unauditable `Math.random`. Guests cannot verify anything (scores, deals, claims).
- **Why it matters:** fine for trusted friends; disqualifying for open/competitive play at scale. Also: host tab throttling (documented in code history) means a backgrounded host slows the game for everyone.
- **Fix:** short-term, document the trust model in README/party dialog. Long-term (only if going public): dedicated authoritative server or commit-reveal shuffle (hash the wall pre-deal, reveal seed post-hand) to make cheating detectable.
- **Difficulty:** doc = trivial; real fix = Large. **Document now, schedule real fix if audience changes.**

### H2. No SRI / no fallback on the PeerJS CDN (supply chain)
- **Location:** `index.html` script tag.
- **CONFIRMED:** version pinned but no `integrity`+`crossorigin`; a compromised unpkg serves attacker JS with full page privileges.
- **Fix:** add SRI hash, or vendor `peerjs.min.js` into the repo (also fixes C3's offline story). **Easy (30 min). Immediately.**

### H3. `netHostPrompt` has no timeout and `NET.pending` is never cleaned — party soft-locks & resolver leaks
- **Location:** `net.js` L188–195; cleanup only in `netShutdown` (L381). `startHand`/`gotoMenu` never touch `NET.pending`.
- **CONFIRMED:** (a) a guest whose machine dies *without* a clean TCP close leaves the host `await`ing forever (OS timeouts can be minutes) → whole table frozen; heartbeat/timeout absent. (b) On re-deal, stale resolvers stay in `NET.pending` and are overwritten next prompt — each orphaned resolver pins its promise chain and captured hand arrays forever (slow leak on long party sessions with re-deals).
- **Fix:** 30–60 s prompt timeout resolving `{type:"auto"}` + "taking over for X" notice; clear `NET.pending` (resolve `auto`) inside `startHand()`; PeerJS `peer.socket` heartbeat or app-level ping every 10 s.
- **Difficulty:** Easy–Medium (2–4 h). **Immediately (it's the #1 party-mode failure mode).**

### H4. Host re-deal leaves guests with stale prompt UI (state desync)
- **Location:** protocol gap: `startHand()` sends `netCloseModals()` (net.js L253) but there is no `promptCancel` message; guest's `claimPromptUI` buttons/action bar persist until they click something.
- **CONFIRMED:** repro — host re-deals while a guest is deciding a claim: guest still sees "Peng / Pass" for a tile that no longer exists; clicking sends an action the host discards (gen check) but the guest's UI only then cleans up; meanwhile new-hand state renders *behind* the stale buttons.
- **Fix:** broadcast `{t:"promptCancel"}` from `startHand`/`gotoMenu`; guest handler runs the same cleanup as `done()`.
- **Difficulty:** Easy (1 h). **Immediately.**

### H5. Every abandoned hand leaks its suspended coroutine (local too)
- **Location:** `gotoMenu()` main.js L748, Re-deal path L801; `beginTurnPrompt` promise (L231) and `claimPromptUI` promises (L462) are never resolved when `G.gen` advances.
- **CONFIRMED pattern:** the `await` never completes, so the whole `handLoop` frame — with captured hands, walls, closures — is pinned for the page lifetime. Each menu-exit/re-deal adds one zombie chain (~tens of KB).
- **Impact:** hours-long sessions with frequent re-deals grow memory monotonically; hard to see, never GC'd.
- **Fix:** on `gen++`, call the stored `G.choiceSink({type:"auto"})` (and NET.pending resolvers) before nulling — loops then exit via their existing gen checks and free everything.
- **Difficulty:** Easy (1 h). **Soon (Phase 2).**

### H6. Exponential evaluators with no memoization (POTENTIAL hot spot)
- **Location:** `ai.js` `evalRec` (branching ~6/level), `bestShape` (~5/level, depth = distinct kinds), `engine.js` `canFormSetsW` + `runRec`; amplified by `coachTurnUpdate` (main.js L615–625) calling `roughShanten` for **each of ~12 unique discards**, each of which calls `winningKinds` = 27 × wild-DFS.
- **Evidence:** measured ~0.1 ms on typical hands (fast); worst cases (13 tiles one suit + wilds, e.g. flush hands late game) are combinatorially far heavier and were **not measured** — plausible 50–300 ms main-thread stalls exactly on the most exciting hands.
- **Fix:** memoize `bestShape`/`canFormSetsW` on a counts-key (or cap node budget with a fallback heuristic); compute the coach's minShanten from one pass instead of 12.
- **Difficulty:** Medium (½ day incl. benchmarks). **Phase 3, but benchmark now.**

### H7. Monolithic global architecture — 173 top-level globals, circular runtime coupling
- **Location:** everywhere. Metrics: 173 `function|const|let` top-level bindings across 10 files sharing one namespace; `main.js` (828 LOC) ↔ `net.js` ↔ `ui.js` ↔ `analyst.js` call each other freely (`ui.renderAll` → `netAfterRender`; `net` → `startHand`/`newMatch`/`hideMenu`; `main` → a dozen `net*`/`analyst*` fns guarded by `typeof`); script order in index.html is load-bearing.
- **Why it matters:** name-collision risk (`$`, `log`, `icon` are dangerously generic), initialization-order fragility, no tree of ownership — every new feature (Analyst proved this) must thread `typeof`-guarded hooks through main.js. This is the tax on all future work.
- **Fix:** ES modules with explicit imports; extract pure engine (`engine.js`+`ai.js` already are) behind a clean interface; introduce an event bus (`emit("discard", …)`) so net/analyst/coach subscribe instead of being hard-called.
- **Difficulty:** Large (2–3 days). **Phase 4 — before the next big feature.**

### H8. No persistence whatsoever — any reload loses the match
- **Location:** storage layer absent; `localStorage` used only for 4 UI flags.
- **CONFIRMED:** accidental refresh, crash, or the forced reloads in `netShutdown` (L383–384!) destroy scores/hand instantly. There is no save system to corrupt because there is none at all — for a "ship to millions" bar that *is* the data-loss finding.
- **Fix:** serialize `{seats, wall, river, dealer, handNumber, wildKind, gen-independent}` to localStorage after each completed action (single JSON write, ~2 KB, atomic enough); offer "Resume?" on boot; version-stamp the blob for future migrations.
- **Difficulty:** Medium (1 day; party mode resume is harder — punt to host-only). **Phase 2.**

### H9. Render fan-out: full DOM rebuild + full network snapshot on every `renderAll`
- **Location:** `ui.js` `renderAll` → rebuilds opponents/river/status/hand via innerHTML (≈100+ SVG nodes) and → `netAfterRender` (net.js L226) sends a **fresh full JSON snapshot to every guest** — with `renderAll` called 4–8× per turn cycle (draw, prompt, discard, claim, threat warning…).
- **CONFIRMED:** ~10–30 KB per action per guest of redundant sends; repeated layout/paint on low-end devices; river re-renders all ~60 discards each time. O(hand+river) per render is fine, ×8 × node-heavy SVG is not free.
- **Fix:** dirty-flag renders (hand vs river vs status), or at minimum debounce `netAfterRender` per macrotask and skip identical snapshots (hash compare).
- **Difficulty:** Medium (½ day). **Phase 3.**

---

## 🟡 MEDIUM

### M1. Analyst mis-evaluates *added* Gang (logic bug)
`analyst.js` `anKongRow`: appends `{type:"kong"}` to `melds` for shanten calc, but an added Gang upgrades an *existing* Peng — meld count doesn't grow. Result: `4 - melds.length` off by one → shanten understated ~2 → added-Gang rows systematically over-ranked. **CONFIRMED.** Fix: pass `melds` unchanged for added kongs (they contribute a set already). Easy; fix with next Analyst touch.

### M2. Analyst numbers carry false precision & magic constants
80 sims ⇒ ±11 pp confidence on the displayed "win 24%"; EV formula constants (×3, ×2, ×0.5) and threat weights (0.28, 0.05, 0.17/0.13/0.08) are unlabeled guesses. Users will over-trust decimals. Fix: round to 5 pp buckets or show "~", name the constants, document the model in the panel's tooltip. Easy.

### M3. Analyst panel re-renders every 40 ms slice; expanded row tracked by index
`anRunSims` calls `anRender()` per slice (~25 fps innerHTML rebuild during sims — wasteful); after the final re-sort, `ANALYST.expanded` (an index) points at a different row, so the user's open row visibly swaps content. **CONFIRMED.** Fix: render only on candidate completion; key expansion by row identity (kind). Easy.

### M4. `G` is a god object with type-shifting fields
Game state, UI state (`selectedIdx`, `suggestKind`), flow control (`choiceSink`, `gen`), and coach flags share one mutable global; on guests `G.wall` becomes `{length:n}` (duck-typed impostor) and `G.seats` is wholesale replaced by network data. Any host-only code path run on a guest (console, future bug) explodes. Fix: split `GameState` / `UiState` / `FlowState`; give guests a real read-model. Medium; Phase 4.

### M5. Duplicated business logic
Tenpai message built twice (`interactiveTurnLoop` L260–266 vs `coachHint`); claim eligibility computed twice (AI branch vs human branch of `resolveClaims`); *two* hand evaluators (`evalCounts` vs `bestShape`) and *two* threat models (`dangerNote` vs `anThreats`) that will drift apart. **CONFIRMED.** Fix: extract `claimOptionsFor(seat, kind)`, `tenpaiSummary(seat)`, one threat module. Medium.

### M6. Lobby UX traps
`hostOnData` calls `renderLobby()` on every join — stomping whatever modal the host had open (e.g. mid-tutorial). Guest lobby modal has **no Leave/Cancel button** (`showModal(..., [])`) — a guest stuck in a lobby can only reload. **CONFIRMED.** Easy fixes.

### M7. `netShutdown` force-reloads the page
Host path schedules `location.reload()` after 4 s *unconditionally* (net.js L384) — wiping log/scores even if the user was reading the modal or mid-something. Guest path reloads on OK. Combined with H8, party teardown = guaranteed data loss. Fix: in-place teardown (re-init NET, restore chrome, back to menu). Easy–Medium.

### M8. Unguarded `localStorage` (Safari private mode)
6 call sites, none wrapped; `setItem` throws in some private-mode/quota situations. Worst path: inside `finishLoading`'s setTimeout — exception skips `openTutorial`, uncaught error, first-run tutorial never appears. **CONFIRMED absence of guards.** Fix: `storageGet/Set` wrapper with try/catch. Easy.

### M9. No match-end condition / unbounded values
Scores go negative forever, `handNumber` grows unbounded, no "player X is bankrupt / match over after N hands" — a long session has no narrative end and no guard against absurd states. Design decision needed. Easy–Medium.

### M10. Accessibility is near-zero
Tiles are click-only `<span>`s (no `tabindex`, `role`, labels beyond `title`), modals don't trap focus or handle Esc, gold is signaled by color/glow only (corner labels help), `pulse`/`logo-bob` ignore `prefers-reduced-motion`. For a public product this is a launch blocker in several markets. Medium effort, Phase 5 at latest.

### M11. Zero automated tests
No test files exist. The highest-risk logic — wild-aware `canFormSetsW`/`isWinningCounts`, `fjScore`, claim priority, net message validation — is pure and trivially testable but lives as page globals. Every regression to date was caught by ad-hoc console harnesses that live only in chat history. Fix: extract engine to module + ~40 unit tests (win shapes incl. wild-pair ban, qiangjin, 三金倒, payouts, claim pruning). Medium; highest ROI item in this audit.

### M12. House rules are undocumented in-game
Simplifications (no kong-after-claim declaration window, no robbing-the-kong, dealer excluded from 抢金, custom payment split, no dead wall) are deliberate but invisible — players who know FJ will think these are bugs. Fix: "House rules" panel in the tutorial/menu. Easy.

### M13. Latent crash: `tileShort(-1)` if the gold flip exhausts the wall
`flipGold()` has no null guard; today unreachable (≤16 winds can't exhaust a 71-tile wall), but any future tile-mix change trips `SUITS[-1].short` → boot-of-hand crash. Add a guard + assert. Trivial.

### M14. CSS accretion (676 lines)
Dead vars (`--yarn/--fish/--paw`, dragon colors), append-order override hacks (`#coach{position:static}` cancelling an earlier rule, duplicate `#screen-loading` z-index), obsolete selectors from removed features. Consolidation pass needed before it calcifies. Easy, Phase 4.

---

## 🟢 LOW (grouped)

- **Dead state:** `G.flushHinted` set but never read; `G.wildFlip` duplicates `wildKind`; `deadFlips` kept but only ever logged.
- **Naming/placement:** `MELD_LABEL` lives in tiles.js; `$`, `log`, `icon` are collision-bait global names; `chow/pung/kong` internal ids vs Chi/Peng/Gang display names (intentional, but document it).
- **Analyst nits:** `.concat([])` no-op; `an-linkbtn` uses inline `onclick=` (only inline handler in the codebase).
- **Consistency:** Labels/Peek toggles not persisted while Analyst prefs are; party-modal buttons still use emoji (🏠/🚪) contra the icon policy; menu decorative tiles can inherit last game's gold glow.
- **Robustness trivia:** `startHosting` retries forever on persistent broker errors (add a cap); `removeN` is O(n²) on 14-element arrays (irrelevant); back-wall `shift()` O(n) (irrelevant); reliance on PeerJS reliable-*ordered* delivery is correct but undocumented.
- **Distribution:** no PWA manifest/apple-touch icon; favicon is a large inline data-URI (fine, but extract when a build step exists).

---

## Concurrency review (summary)
The `gen` token + choice-sink pattern is sound and consistently applied at every `await` (verified all 9 resumption sites in main.js) — but it's *manual*: nothing prevents a future `await` from forgetting the check. The claim phase's `Promise.all` correctly tolerates disconnects via `auto`. One structural note: message ordering between `state` and `prompt` relies on PeerJS's ordered channel — true today (`reliable:true`), fragile if transport changes. No deadlocks found beyond H3's missing timeout; no shared-mutation races found in sims (they run only while the game awaits human input, and are token-cancelled).

## Game-logic review (summary)
Win validation is host-side everywhere (guest "win" claims re-checked against `opts.win` — **good**); discard/kong/chow inputs validated against real hand state (**good**); no client-trusted scoring. Exploits found: none beyond H1 (host omniscience). Fairness: claim-priority pruning is correct including turn-order tie-breaks; AI is uniform difficulty (no scaling — design gap, not bug); rules fidelity items in M12.

---

# Executive Summary

| Dimension | Score | Note |
|---|---|---|
| Overall code quality | **6.5/10** | Clean, consistent, well-commented small-scale code; weak boundaries |
| Maintainability | **5/10** | 173 globals, circular coupling, no tests — refactor tax rising |
| Performance | **7/10** | Fast in practice; unmeasured exponential corners + render fan-out |
| Security | **4/10** | XSS via party protocol, no SRI, total client trust |
| Scalability | **4/10** | Perfect for 4 friends; nothing survives "millions" (by design) |
| Reliability | **5.5/10** | Zero error recovery, party soft-locks, no persistence |

## Top 20 priority issues
1. C1 XSS via guest names & host→guest raw HTML
2. C2 No error handling → silent permanent freezes
3. C3 CDN-gated boot → infinite loading screen
4. H3 No prompt timeout / pending-resolver leak → party soft-lock
5. H2 No SRI on PeerJS (supply chain)
6. H4 Guest stale-prompt desync on re-deal
7. M11 Zero tests over the rules engine
8. H8 No persistence — reload/crash loses everything
9. H5 Zombie coroutine leak per abandoned hand
10. M7 Forced page reloads on party teardown
11. M8 Unguarded localStorage (private-mode boot path)
12. M6 Lobby modal stomping + guest can't leave lobby
13. H6 Unmemoized exponential evaluators (benchmark, then fix)
14. H9 Snapshot-per-render network waste + full DOM rebuilds
15. M1 Analyst added-Gang mis-evaluation
16. H1 Host-trust model undocumented
17. M12 House rules undocumented in-game
18. M4 God-object G / wall type polymorphism
19. M10 Accessibility baseline
20. M9 No match-end condition

## Quick wins (≤1 hour each)
SRI hash on PeerJS · `typeof Peer` guard + lazy load · global `unhandledrejection` handler with re-deal recovery · sanitize guest names at receipt · `{t:"promptCancel"}` on re-deal · resolve sinks in `gotoMenu`/`startHand` · storage try/catch wrapper · Leave button in guest lobby · cancel `netShutdown` auto-reload · fix Analyst added-Gang melds arg · guard `flipGold` null · delete dead flags/CSS vars.

## Long-term roadmap
- **Phase 1 — Critical (days):** C1, C2, C3, H2, H3, H4 + quick wins above.
- **Phase 2 — Stability (week):** H5, H8 (save/resume), M6, M7, M8, M13; document trust model (H1) and house rules (M12).
- **Phase 3 — Performance (week):** benchmark & memoize evaluators (H6); dirty-flag rendering + snapshot dedup/debounce (H9); Analyst render/precision fixes (M2, M3).
- **Phase 4 — Architecture (1–2 weeks):** ES modules, extract pure engine package + unit tests (M11 — can start earlier, standalone), split G (M4), dedupe logic (M5), CSS consolidation (M14), event-bus decoupling (H7).
- **Phase 5 — Future-proofing:** accessibility pass (M10), match structure & difficulty options (M9), PWA/offline packaging, optional server authority or commit-reveal deal for public play (H1).

## Final verdict
- **Production-ready?** For its actual audience — friends playing over shared room codes — *close*: fix Phase 1 and it's respectable hobby software. For "millions of users": **no** — security (C1/H1/H2), reliability (C2/H3), and the absence of persistence and tests are each disqualifying alone.
- **Biggest architectural risks:** the 173-global monolith with circular runtime coupling (every feature raises the tax), and the host-as-server trust model if the audience ever exceeds friends.
- **Most dangerous technical debt:** zero tests over a hand-rolled combinatorial rules engine — the code most likely to regress is the code with no safety net; plus the manual `gen` cancellation pattern, which works today only because every await site remembered the check.
- **Before adding features:** Phase 1 security/reliability fixes, engine extraction + tests, and the prompt-lifecycle cleanup (H3/H4/H5) — the Analyst integration already showed how expensive cross-cutting features are under the current coupling.
- **Six months out if unresolved:** a slow memory creep on party hosts (H5/H3) that looks like "the game gets laggy after a long night"; a griefing incident the first time a room code leaks publicly (C1); an unexplained freeze report nobody can reproduce (C2, no logging); a rules regression silently introduced by an innocent refactor (M11); and a CSS/global-namespace tangle that turns a two-hour feature into a two-day one (H7/M14).
