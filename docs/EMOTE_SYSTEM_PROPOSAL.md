# Meowjong — Reaction Emote System Proposal ("Cat Chat")

**Status: APPROVED (sculpted-heads direction) & CORE IMPLEMENTED (E1–E3 + mood
sounds), 2026-07-11.** Shipped: `js/emotes.js` (14 sculpted SVG heads, registry,
rate limiter, wheel, AI reactions), head-pop rendering with the full degradation
ladder, `{t:"emote"}` party protocol with host-side validation + rate limiting,
`sndEmote` mood voices, 9 new tests (83/83 green). Verified live: solo boot with
zero console errors, wheel via mouse/keyboard (E · 1–8 · Esc · outside-click ·
modal/menu guards), rate limit, fx-off static rendering, heads on all four seats.
Still open (E4/E5): per-emote signature moves, particles, combo reactions, context
pre-highlight, per-cat personality weights, Emote Book/unlocks, per-player mute,
3-browser party smoke test.

---

## 1 · Why redesign

The current "reaction" is one line of code deep. `fxEmote(seat, emoji)` (fx.js) floats a
hardcoded 😼 up from an AI cat's name pill when it claims — 24 px, fully gone in ~1 s,
never player-triggered, never networked as an intentional message. Concretely:

| Problem | Root cause today |
|---|---|
| Easy to miss | 24 px glyph, 1 s total lifetime, 0→fade immediately after peak |
| Not expressive | Single emoji (😼), single trigger (claims) |
| Not a *player* feature | Only seats 1–3 (AI) ever emote; you have no way to react |
| Off-style | OS emoji rendering clashes with the hand-drawn SVG tile art |
| Invisible in party | Guests see it only as a side effect of the claim render, and humans can't say anything to each other at all |

Party mode (beta) makes this urgent: four humans at a table with **no expression channel
whatsoever** — no chat, no reactions. Emotes are the cheap, wholesome, moderation-free
way to give the table a voice.

## 2 · Design stances (the load-bearing decisions)

1. **Emotes are communication, not decoration.** The fx layer's rule is "motion off ⇒
   effect gone." That's wrong for emotes: a guest at `fx-off` still needs to *see* that
   Mochi's player is laughing at them. So: the bubble always renders and a log line is
   always written; only the *animation* obeys `fx-full/subtle/off` + `prefers-reduced-motion`.
2. **Custom SVG cat faces, not emoji.** The repo already draws every tile face in SVG
   (`faces.js`) and has a zero-asset rule (even sound is synthesized). Emotes join the
   same pipeline: a shared cat-head base + per-emote expression layers, built as inline
   SVG strings, tinted with the existing palette (`--ink #4a3426`, `--accent #e8895a`,
   `--panel #fffaf1`). Crisp at any size, themeable, ~0 bytes of assets.
3. **One system for cats and humans.** The AI cats' hardcoded 😼 is replaced by the same
   registry the wheel uses, driven by game context. Most play is single-player — the
   expressive-cats upgrade is where most users feel this feature.
4. **Fast to send, impossible to spam.** Sub-second send path for the sender; hard rate
   limits + per-player mute so the receiver is never hostage.
5. **The emotes are sculpted 3D cat heads, alive in the scene.** (Direction chosen in
   review, 2026-07-11, over a coin-token concept and a true-WebGL concept.) Each emote
   is a shaded, dimensional "vinyl toy" cat head — gradient-lit dome, glossy top-light,
   soft under-shade — that **pops out at the camera** over the seat pill and plays a
   living animation: head bob and tilt, ears that wiggle independently, plus a signature
   per-emote move (laugh bounces, cry slumps, shock recoils). Built as SVG + gradients +
   CSS 3D transforms — zero assets, zero dependencies — and gated behind the existing
   `fxDepth()` exactly like the 3D table: Full 3D gets the living head, Subtle gets a
   flat pop, Off gets a static face. See §5.1 for the alternatives evaluated.

## 3 · Interaction design

### 3.1 Is a wheel the right UX?

| Option | Speed | Discoverability | Mobile | Screen cost | Verdict |
|---|---|---|---|---|---|
| **Radial wheel (8 slots)** | ★★★ (hold→flick→release, one gesture) | ★★ (needs a visible button too) | ★★ (tap-to-pick works) | Zero until opened | **Recommended** |
| Linear quick-bar always visible | ★★★ | ★★★ | ★ (eats hand space at 375 px) | Permanent row | Rejected: clutters the carefully-budgeted one-screen layout (M7.2) |
| Picker popover (grid menu) | ★ (open→scan→click) | ★★★ | ★★★ | Zero until opened | Fallback pattern — the wheel *degrades into this* on mobile (tap to open, tap a slot) |

A wheel wins because it's spatial: after a day of play, "smug" is *up-right* in muscle
memory and takes ~400 ms to send without reading anything. Mahjong is turn-based, so we
don't need mid-combat speed — but claims and wins are exactly the moments you want to
react *within a second or two*, before the table moves on.

The wheel holds **8 slots** (comfortable flick accuracy limit). The full roster is larger
(14 at launch); the 8-slot **loadout is player-customizable** from an "Emote Book"
(milestone E5). Center of the wheel = cancel.

### 3.2 Opening & selecting

| Input | Open | Select | Cancel |
|---|---|---|---|
| Mouse | Hold **E**, or click the 😺 button by the You pill, or right-click the You pill | Flick toward slot + release (hold-E), or click a slot | Release over center / click outside / Esc |
| Keyboard only | **E** (tap toggles) | **1–8**, or arrows to rotate focus + Enter | Esc |
| Quick hotkeys | — | **Shift+1…8** sends instantly, no wheel | — |
| Touch | Tap the 😺 button (long-press is *not* primary — iOS context-menu conflicts) | Tap a slot | Tap outside |

Guards: the E hotkey is ignored while focus is in an input (party name field); the wheel
auto-closes when an action prompt (claim/win choice) arrives so it never blocks a
decision; focus returns to the hand on close (keyboard-playability preserved).

The 😺 dock button is the discoverability anchor: it sits at the You pill, shows your
most-recent emote as its icon, and pulses gently after table events (someone wins, a big
claim) — a nudge that reacting is possible *right now*.

### 3.3 Where reactions appear

A **sculpted head popping out over the emoter's seat pill** — the one screen position
that identifies *who* said it, exists for all four seats, on desktop and mobile, and
never covers the river or your hand. Sizing up from today's 24 px:

- The head: **~110 px sculpted cat head** — the SVG face builder plus a shading pass
  (gradient-lit dome, glossy top-light, soft under-shade), ears in their own transform
  groups so they can move independently. Drop shadow beneath; no bubble chrome at all —
  the character *is* the reaction.
- Lifetime: **~3.1 s total** (vs 1.0 s today): pop-out at the camera 320 ms → living
  loop ≈2.2 s (bob + ear wiggle + signature move) → shrink-away 600 ms.
- Concurrency: **one head per seat**; re-emoting replaces (with a small re-pop), so the
  worst case is 4 heads on screen, each in its own corner.
- Always narrated: log line ("😹 Mochi laughs") + the existing live region for screen
  readers.

## 4 · The roster: 14 custom cat emotes

Shared base: round café-cat head, big ears, whisker triplets — expression lines in the
engraved style of the tile faces, drawn over the **sculpted shading pass** (§5), so
every emote reads as a painted vinyl toy. Expression = eyes + mouth + ears + up to one
prop; each also names a **signature move** for its living loop. Launch roster
(★ = in the default 8-slot loadout):

| # | id | Name | Expression notes | Typical use |
|---|---|---|---|---|
| 1 | `happy` ★ | Happy | closed smiling eyes, blush dots | general warmth |
| 2 | `laugh` ★ | Laughing | squeezed eyes, wide-open mouth, tear fleck | someone deals in |
| 3 | `sad` | Sad | droopy ears, wobbly mouth | bad draw |
| 4 | `cry` ★ | Crying | streaming tear lines, flat whiskers | you dealt in |
| 5 | `angry` | Angry | flat ears, knit brows, puffed cheeks, tick mark | that was MY tile |
| 6 | `shock` ★ | Shocked | round white eyes, tiny mouth, sprung whiskers | instant win at the table |
| 7 | `love` | Heart eyes | heart pupils, floating mini-hearts | drew the gold |
| 8 | `smug` ★ | Smug | half-lidded eyes, sideways grin (the old 😼, upgraded) | after a claim |
| 9 | `sleepy` | Sleepy | closed eyes, drooping head, "z z" | slow turn |
| 10 | `think` ★ | Thinking | narrowed eyes, paw on chin, "?" | tough discard |
| 11 | `celebrate` ★ | Celebration | open grin, paws up, confetti flecks | a win |
| 12 | `paws-up` | Paws up | one raised paw, toe beans visible | nice move |
| 13 | `facepalm` | Facepalm | paw covering eyes | misclick regret |
| 14 | `gg` ★ | GG | little bow, "GG" pennant held in paws | end of a hand |

Later (E5, unlockable/legendary): **golden variants** — `smug-gold` (win using a gold
tile), `crown` (三金倒 three-golds instant win) — same faces stroked in gold `#ffd65a`
with a shimmer sweep. Seasonal variants (lantern-festival hat, etc.) are date-gated
palette/prop swaps on the same bases — cheap and optional.

Registry shape (mirrors `faces.js`): `EMOTES = { id: { label, svg(), mood, move } }`
where `mood` keys the synthesized sound and `move` the signature-move keyframes. One
new file `js/emotes.js`; no assets.

## 5 · Animation spec

All numbers use the existing tokens (`--ease-back: cubic-bezier(.34,1.56,.64,1)`,
`--ease-out-soft`), transform/opacity-only, GPU-friendly, gated exactly like current fx
**except** the "bubble exists" part (stance #1).

**The sculpted head (the centerpiece).** The head reads as 3D through two layers —
sculpted *rendering* and dimensional *motion* — with no WebGL and no library:

- *Sculpted rendering:* the existing face builder gains a shading pass — the head and
  ears fill with a top-left-lit `radialGradient` dome (highlight → cream → shadowed
  rim), a glossy specular ellipse sits on the brow, a soft radial under-shade grounds
  the chin. The engraved expression lines draw on top, so it reads as a **painted vinyl
  toy**: dimensional body, hand-drawn face — still unmistakably Meowjong.
- *Entrance* (320 ms): the head **lunges out at the camera** — from
  `translateZ(140px) scale(.3) rotateY(−35°)`, overshooting with a squash
  (1.14sx, .92sy) at 60%, settling on `--ease-back`. The seat pill does the existing
  `fx-bounce`.
- *Living loop* (~2.2 s): head bob (±2.5° roll, ±9° yaw, −3 px float on a 2 s cycle) +
  **independent ear wiggles** (±6°, the right ear trailing the left by 120 ms — the
  asymmetry is what makes it feel alive) + a **signature move per emote** layered on
  top: laugh bounces on the spot, cry slumps and drips, shock recoils backwards,
  sleepy's nose dips as it nods off, celebrate does a little spin.
- *Exit* (600 ms): shrinks away toward the pill with a fade — the cat "pulls its head
  back in."
- *Implementation:* ears live in `<g class="ear-l/ear-r">` groups animated with SVG CSS
  transforms (`transform-box: view-box` origins at the ear roots); the head rides CSS
  3D transforms inside a local `perspective` context. Registry stays
  `EMOTES = { id: { label, svg(), mood, move } }` — `move` names the signature-move
  keyframe set.

**Wheel open** (180 ms): the wheel rises out of the table plane — starts lying at the
scene's tilt (`rotateX(50°) scale(.6)`) and stands up to face the camera on
`--ease-back`; 8 slots stagger outward 12 ms apart along their radials with a small
`translateZ` cascade; a 20% radial backdrop dim behind it. Close: 120 ms reverse fold +
fade. Hover/focus slot: lifts `translateZ(24px)`, scale 1.1, shadow deepens, label chip
appears under the wheel.

### 5.1 · 3D directions evaluated (review record, 2026-07-11)

Three ways to read "3D cat emotes" were designed and two were prototyped live in the
review artifact:

1. **Coin-flip token** (flat face on a 3D medallion) — *rejected in review*: the 3D was
   in the prop, not the cat; the character stayed flat.
2. **Sculpted heads** (this spec) — **chosen**: the cat itself becomes dimensional and
   alive; ships all 14 emotes at hours-per-emote inside the existing SVG pipeline,
   zero dependencies, degrades cleanly.
3. **True real-time 3D (WebGL)** — *prototyped, parked*: a hand-rolled, zero-dependency
   WebGL cat head (lambert-lit spheres/cones, wiggling ears) was built into the review
   artifact to make the trade-offs concrete. Real 3D is *possible* without libraries,
   but reaching character quality means modeled/rigged/animated assets, realistically
   three.js (~150 KB, breaking the zero-dependency rule), an asset pipeline, days per
   emote ×14, a persistent GPU loop (battery/mobile heat), and an art language foreign
   to the hand-drawn game. **Parked option:** a single WebGL *legendary* emote (the
   三金倒 Crowned cat) as a later E5+ experiment — the prototype proves feasibility.

**Per-mood particles** (4–8 tiny SVG sprites, `fx-full` only, self-removing like
`fxSpark`): hearts drift up (`love`), tear drips (`cry`), tick-mark + brief 1 px shake
(`angry`), confetti flecks reusing the win-palette (`celebrate`), "z" glyphs (`sleepy`).

**Degradation ladder** (mirrors how the 3D table itself degrades): `fx-full` = the
sculpted head — pop-out, living loop, signature move, particles · `fx-subtle` = flat 2D
pop — squash-and-stretch scale-in, fade-out, no 3D, no loops · `fx-off` /
`reduced-motion` = the face appears statically, holds 2.4 s, disappears (opacity step
only). The sculpted *rendering* (shading) survives at every level — only *motion*
degrades. Log + live-region line in *all* modes. The 3D branch keys off the existing
`fxDepth()` gate, so it can never disagree with the table's own depth setting.

**Sound** (synthesized in `sound.js`, respects the master toggle + volume): ≤300 ms mew
variants per mood — happy: rising major third; sad/cry: falling minor; smug: lazy
downward slide; shock: octave jump; laugh: staccato triplet; love: low tremolo purr;
celebrate: reuse the win arpeggio, quieter. Sender hears theirs on send; others on
receive.

## 6 · Party protocol & anti-abuse

New message, host-authoritative like everything else in `net.js`:

- Guest → host: `{ t:"emote", id }` (host already knows the guest's seat).
- Host validates: known id ∈ EMOTES, sender's rate-limit bucket OK → broadcasts
  `{ t:"emote", seat, id }` to all guests and renders locally. Invalid/over-limit →
  silently dropped.
- **Rate limit:** 1 per 2.5 s per seat, max 4 per 15 s (then a quiet local "let the cat
  rest a moment 🐾" toast for the sender). Enforced at the host, mirrored client-side so
  the wheel greys out instead of failing.
- **Mute:** right-click (long-press) any opponent pill → "🔇 Mute emotes from X", local
  only, stored per-session. The bubble is suppressed; the log line remains.
- AI-cat emotes in party flow through the same broadcast so host and guests stay in sync
  (today's guest experience of cat reactions is an accident of the state render).

Single-player never touches the network: local render only.

## 7 · Context-sensitive AI reactions (replacing the hardcoded 😼)

Driven from existing hooks in `main.js`/`fx.js` — no engine changes:

| Event (hook already exists) | Cat reaction | Chance |
|---|---|---|
| AI claims peng/gang (`fxAfterClaim`) | `smug` (today's behavior, upgraded) | 80% |
| AI chi | `happy` | 50% |
| AI deals into a win | `cry` or `shock` | 100% |
| AI wins | `celebrate` | 100% |
| Someone robs the gold / 三金倒 | all other cats `shock` | 100% |
| AI draws a flower run (2+) | `love` | 60% |
| Your long think (>20 s on your turn) | one cat `sleepy` | once per hand |
| Hand ends in a draw | random cat `sad` | 60% |

Chances + a per-cat 10 s cooldown keep the table lively but not noisy. Each cat gets a
tiny personality bias (Mochi laughs more, Captain Whiskers is smugger) — one weight table,
big charm payoff.

**Context pre-highlight (E4):** when the wheel opens within 5 s of a table event, the
contextually apt slot starts focused (you dealt in → `cry`; someone won → `gg`), so
keyboard users can react with literally E-Enter.

## 8 · Engagement extras (proposed, all optional)

- **Recents & favorites:** wheel slot 1 = last-used; Emote Book lets you pin the loadout.
- **Unlocks (no FOMO, no currency):** 8 defaults free; the other 6 unlock via gentle
  play milestones — finish the tutorial (`think`), win a hand (`celebrate` → already
  default, so: `paws-up`), win with no flowers 无花 (`facepalm`), rob the gold
  (`smug-gold`), 三金倒 (`crown`), finish a party game (`gg-gold`). Stored via the
  existing `storeGet/storeSet`. Unlock moment: small toast + the Book pulses.
- **Combo reactions:** if 2+ seats send the *same* emote within 4 s, the bubbles link
  with a sparkle arc and a two-note chord — a tiny "we both saw that" moment.
- **Emote packs** = seasonal variant sets (see §4), date-gated, cosmetic only.

Explicitly **not** proposed: purchasable packs, streaks, or anything that pressures play.
This is a free MIT café game; emotes should feel like biscuits, not battle passes.

## 9 · Drawbacks & edge cases

- **Spam/griefing** — rate limit + mute (§6). Worst case is 4 quiet bubbles.
- **Occlusion** — bubbles anchor to pills (never over river/hand/prompts); z-index below
  modals; wheel auto-closes when a claim prompt arrives.
- **fx-off users** — see static bubbles by design (stance #1); if even that offends, an
  "Emotes: on / off" toggle in ⚙ Options is the escape hatch (also the party-wide
  kill-switch for hosts who want a silent table).
- **Win-ceremony overlap** — the end modal outranks bubbles; emotes sent during it queue
  for up to 3 s then drop.
- **Keyboard traps** — wheel is a focus-trapped dialog while open; Esc and outside-click
  both close; focus restores to the hand row.
- **iOS long-press** — never the primary trigger; the 😺 button is.
- **375 px screens** — 210 px wheel fits the M6 mobile layout above the hand dock; slots
  are 44 px+ touch targets.
- **Old host / new guest protocol skew** — unknown `t` values are already ignored by both
  ends; emotes silently no-op across versions instead of erroring.
- **Two emotes racing on one seat** — replace policy, newest wins (§3.3).
- **Nested 3D contexts** — the popping heads must NOT render inside `#table`'s
  transform tree (nesting a `preserve-3d` element in the tilted scene invites blur and
  z-fighting). They live in the `position: fixed` body overlay with their own local
  `perspective`, exactly like today's `fx-ghost` flight tiles. Transform/opacity-only,
  so no layout thrash while tiles fly.
- **Reduced-motion + screen readers** — static render + live-region text (§5); wheel
  slots are labelled buttons.

## 10 · Milestones (each small, shippable, verifiable)

Continues the M-numbering as **E1–E5**; E1–E3 are the core; E4–E5 can ship later.

- **E1 · Sculpted faces & head-pop (foundation).** `js/emotes.js` registry with all 14
  sculpted SVG heads (shading pass + ear groups); `emoteShow()`/`emoteReact()` replace
  `fxEmote` — pop-out + living loop at `fx-full` (`fxDepth()` gate), flat pop at subtle,
  static at off; AI context reactions (§7) wired to the existing hooks; log +
  live-region narration. *Single-player is fully upgraded here.* Verify: all heads
  render in a test page grid; pop/loop/exit at fx-full and clean 2D/static fallbacks;
  64/64 existing tests; no console errors.
- **E2 · The wheel (you can speak).** Wheel component (open/close/select per §3.2),
  😺 dock button, hotkeys, focus management; local-player bubbles. Verify: keyboard-only
  send; mobile 375 px; wheel closes on prompt arrival; input-field guard.
- **E3 · Party wiring.** `{t:"emote"}` protocol, host validation + rate limit, relay,
  mute UI, AI broadcast unification. Verify: `tests/net.test.js` additions (validation,
  rate limit, unknown-id drop); 3-browser manual party smoke.
- **E4 · Juice.** Mood sounds in `sound.js`, per-mood particles, the **signature moves**
  (laugh bounce, cry slump, shock recoil, sleepy nod, celebrate spin — E1 ships the
  shared bob/wiggle loop; E4 adds the per-emote layer), 3D wheel rise-from-the-table
  open, combo reactions, context pre-highlight, per-cat personality weights. Verify:
  sound toggle respected; particle count caps; no jank while a head pops during tile
  flights.
- **E5 · Emote Book & unlocks.** Loadout editor modal, recents, unlock triggers +
  toasts, golden/seasonal variants. Verify: `tests/save.test.js` additions for
  persistence; unlock triggers fire once.

Estimated shape: E1 ≈ the largest (art), E2–E3 medium, E4–E5 small. Everything is
presentation + one protocol message — **engine, scoring, and AI logic untouched.**

---

*Visual companion (wheel mockup + all 14 faces drawn in the proposed style): see the
review artifact published alongside this doc.*
