"use strict";
/* ============================================================
   Meowjong — interactive tutorial (FJ / Fujian style)

   Each step teaches ONE idea, then most steps gate progression
   behind a small interaction:
     task.type 'choice' — answer a question (tiles or text options)
     task.type 'pick'   — select multiple tiles (e.g. "find the pair")
     task.type 'demo'   — click through a staged walkthrough
   Hints appear only after two wrong attempts.
   ============================================================ */

const LESSONS = [
  {
    title: "Welcome! 🀄",
    body: () => `
      <p>Hi! I'm <b>Professor Paws</b>, and in about ten minutes you'll be playing
      <b>FJ (Fujian) mahjong</b> — a fast, lucky, gold-rush style of the classic game.</p>
      <p>Mahjong is a 4-player game, a bit like the card game rummy: everyone draws and
      discards tiles, racing to complete a hand first.</p>
      <p>We'll go step by step: first <b>reading the tiles</b>, then <b>building sets</b>,
      then the <b>special FJ rules</b> — flowers 🌸 and the wild gold 🥇. Every step has a
      tiny exercise so it sticks.</p>`,
    why: "Most people find mahjong confusing because they're taught everything at once. One idea at a time is all it takes.",
  },
  {
    title: "The goal",
    body: () => `
      <p>A winning hand is <b>4 sets + 1 pair</b>. A set is three tiles that belong together;
      a pair is two identical tiles. Here's a complete winning hand:</p>
      ${tilesHTML([0, 1, 2])} ${tilesHTML([13, 14, 15])} ${tilesHTML([22, 22, 22])}
      ${tilesHTML([6, 7, 8])} ${tilesHTML([26, 26])}
      <p>Four groups of three, plus the pair on the end. When you complete this shape, you
      call <b>"Hú!" (胡)</b> — "I've won!"</p>`,
    why: "Everything in mahjong — every draw, discard, and claim — is in service of reaching this exact shape before anyone else.",
    task: {
      type: "choice",
      q: "Quick check: how many tiles are in a complete winning hand?",
      labels: ["13", "14", "17"],
      answer: 1,
      why: "4 sets × 3 tiles + 1 pair = 14. You hold 13 between turns — the 14th is the tile that wins.",
      hint: "Count the hand above: four groups of three, plus two.",
    },
  },
  {
    title: "Reading tiles: Dots",
    body: () => `
      <p>There are three suits, each numbered 1–9 with four copies of every tile.
      First suit: <b>Dots</b> — just count the circles.</p>
      ${tilesHTML([0, 1, 2, 3, 4, 5, 6, 7, 8])}
      <p>The tiny corner number helps while you learn (you can turn it off later with the
      <b>Labels</b> toggle).</p>`,
    why: "Reading tiles instantly is 90% of feeling comfortable at a real table.",
    task: {
      type: "choice",
      q: "Click the 7 of Dots:",
      tiles: [4, 6, 8],
      answer: 1,
      why: "Seven circles. The others were the 5 and the 9.",
      hint: "Count the circles — you're looking for exactly seven.",
    },
  },
  {
    title: "Reading tiles: Bamboo",
    body: () => `
      <p>Second suit: <b>Bamboo</b> — count the sticks.</p>
      ${tilesHTML([9, 10, 11, 12, 13, 14, 15, 16, 17])}`,
    why: "Dots and Bamboo look similar at a glance — circles vs sticks. Telling them apart fast prevents the most common beginner misreads.",
    task: {
      type: "choice",
      q: "Click the 2 of Bamboo:",
      tiles: [10, 12, 16],
      answer: 0,
      why: "Two sticks. The others were the 4 and the 8.",
      hint: "Sticks, not circles — and just two of them.",
    },
  },
  {
    title: "Reading tiles: Characters",
    body: () => `
      <p>Third suit: <b>Characters</b>. The number is written in Chinese over the red
      萬 ("ten thousand"):</p>
      ${tilesHTML([18, 19, 20, 21, 22, 23, 24, 25, 26])}
      <p style="text-align:center"><b>一</b> 1 · <b>二</b> 2 · <b>三</b> 3 · <b>四</b> 4 ·
      <b>伍</b> 5 · <b>六</b> 6 · <b>七</b> 7 · <b>八</b> 8 · <b>九</b> 9</p>`,
    why: "You'll learn the numerals fastest by using them — the corner labels have your back until then.",
    task: {
      type: "choice",
      q: "Click the 5 of Characters (伍):",
      tiles: [19, 22, 25],
      answer: 1,
      why: "伍 is 5. The others were 二 (2) and 八 (8).",
      hint: "Look for 伍 — or peek at the corner numbers.",
    },
  },
  {
    title: "Suits never mix",
    body: () => `
      <p>One rule to burn in early: numbers only connect <b>within their own suit</b>.</p>
      <p>${T(2)}${T(3)}${T(4)} is a run. &nbsp;${T(2)}${T(12)}${T(22)} is just three
      strangers — a 3 of Dots has nothing to do with a 4 of Bamboo.</p>`,
    why: "Half of all beginner 'why isn't this a set?!' moments are two suits accidentally mixed.",
    task: {
      type: "choice",
      q: "Which two tiles could belong to the same run?",
      labels: ["4● and 5●", "4● and 5∥", "9● and 1∥"],
      answer: 0,
      why: "Same suit, neighboring numbers — that's the only combination that can grow into a run.",
      hint: "Check the suit symbols first, numbers second.",
    },
  },
  {
    title: "The pair — the \"eyes\"",
    body: () => `
      <p>Every winning hand needs exactly <b>one pair</b>: two identical tiles. Players call
      it the <b>eyes</b>.</p>
      <p>Identical means identical — same suit <i>and</i> same number.</p>`,
    why: "Hands most often stall at the end because nothing was saved for the eyes. Spotting and protecting a pair early is a real skill.",
    task: {
      type: "pick",
      q: "Click the TWO tiles that form a pair:",
      tiles: [3, 11, 11, 24],
      answers: [1, 2],
      why: "The two 3s of Bamboo are identical twins — that's a pair. The 4 of Dots and 7 of Characters have no partner here.",
      hint: "You're looking for two tiles that match exactly — suit and number.",
    },
  },
  {
    title: "Sets #1: the Chi (run)",
    body: () => `
      <p>The first kind of set: a <b>Chi</b> — three consecutive numbers in one suit:</p>
      ${tilesHTML([2, 3, 4])}
      <p>Runs never wrap around (8-9-1 doesn't count) and, as you know, never mix suits.</p>`,
    why: "Runs are the easiest sets to finish — a 4-5 can be completed by two different tiles (3 or 6), giving you twice the chances.",
    task: {
      type: "choice",
      q: "You hold these two. Click the tile that completes the run:",
      show: [3, 4],
      tiles: [5, 12, 8],
      answer: 0,
      why: "4●-5● extends to 3● or 6● — and the 6● was on offer. The 4∥ is the wrong suit; the 9● doesn't connect.",
      hint: "Same suit as the pair shown, and a number right next to them.",
    },
  },
  {
    title: "Sets #2: Peng & Gang",
    body: () => `
      <p><b>Peng</b> — three identical tiles: ${T(14)}${T(14)}${T(14)}</p>
      <p><b>Gang</b> — all four copies: ${T(22)}${T(22)}${T(22)}${T(22)} — still counts as
      one set, and you draw a bonus tile from the back wall.</p>`,
    why: "Triplets are slower than runs (only one tile kind completes them) — but they're claimable from ANY player, as you'll see soon.",
    task: {
      type: "choice",
      q: "You hold TWO 6∥ and an opponent discards a third 6∥. What do you call?",
      labels: ["Peng!", "Chi!", "Gang!"],
      answer: 0,
      why: "Two in hand + their discard = three identical tiles = Peng. A Gang would need THREE in your hand; a Chi is for runs.",
      hint: "Count what you'd end up with: 2 + 1 identical tiles.",
    },
  },
  {
    title: "FJ special #1: winds are FLOWERS 🌸",
    body: () => `
      <p>Now the FJ twist. The four winds — 東 南 西 北 — <b>never stay in your hand</b>.
      They're bonus tiles. Walk through what happens when you draw one:</p>`,
    why: "Flowers are the FJ scoring engine: your winning points are multiplied by how many you've collected. More on that soon.",
    task: {
      type: "demo",
      q: "Try it — play out a flower draw:",
      stages: [
        { text: "It's your turn. You draw from the wall… it's the <b>East Wind 東</b>!", tiles: [27], btn: "Expose it as a flower →" },
        { text: "東 goes <b>face-up into your flower row</b>, where everyone can see it. Winds never stay hidden in a hand.", tiles: [27], btn: "Draw a replacement from the back wall →" },
        { text: "Your replacement is the <b>5 of Dots</b> — a normal tile, straight into your hand. The game does all of this automatically; you just enjoy the free flower. 🌸", tiles: [4], btn: "Got it ✓" },
      ],
      done: "Flower handled! In a real game you'll see this whole dance in the log.",
    },
  },
  {
    title: "The rhythm of a turn",
    body: () => `
      <p>Everyone holds <b>13 tiles</b>. Your turn is two beats:</p>
      <ol>
        <li><b>Draw</b> one tile → you briefly hold 14.</li>
        <li><b>Discard</b> one face-up into the middle → back to 13.</li>
      </ol>
      <p>Draw one, throw one, round and round — each turn your hand should get a little
      closer to 4 sets + a pair.</p>`,
    why: "The discard IS the decision. Drawing is luck; choosing what to let go of is the whole game.",
    task: {
      type: "choice",
      q: "You've just discarded. How many tiles are you holding?",
      labels: ["13", "14", "12"],
      answer: 0,
      why: "14 after drawing, 13 after discarding. If you ever hold anything else, something's gone wrong!",
      hint: "Draw up to 14, discard back down to…",
    },
  },
  {
    title: "Stealing discards — and who wins ties",
    body: () => `
      <p>Discards aren't dead! You can claim the newest one:</p>
      <ul>
        <li><b>Peng!</b> — you hold 2 matching → claim from <i>anyone</i>.</li>
        <li><b>Gang!</b> — you hold 3 matching → claim from <i>anyone</i>, plus a bonus draw.</li>
        <li><b>Chi!</b> — completes a run — but <i>only from the player right before you</i>.</li>
        <li><b>Hú!</b> — completes your whole hand → win, from <i>anyone</i>.</li>
      </ul>
      <p>Claimed sets go <b>face-up</b> beside your hand, locked in. If two players want the
      same tile: <b>Hú beats Peng/Gang beats Chi</b>.</p>`,
    why: "Claims are how you speed up — and the priority ladder is why a juicy discard sometimes isn't yours to take.",
    task: {
      type: "choice",
      q: "You could Chi the discard, but another player calls Peng on it. Who takes the tile?",
      labels: ["They do — Peng outranks Chi", "You do — you're next in turn order", "Whoever clicked first"],
      answer: 0,
      why: "Peng always outranks Chi, no matter the seating. (The game is polite about this: it won't even offer you a Chi that's already doomed.)",
      hint: "Check the priority ladder above.",
    },
  },
  {
    title: "FJ special #2: the GOLD 🥇",
    body: () => `
      <p>After each deal, one tile is flipped face-up at the back of the wall — the
      <b>GOLD (金)</b>. Its <b>3 remaining copies are wild</b>: each can stand in for
      <i>any suit tile</i>.</p>
      <p><b>Three gold rules:</b></p>
      <ul>
        <li>✅ Completes <b>any Chi or Peng</b> in your hand</li>
        <li>🚫 Can <b>never be the pair</b> — the eyes must be real tiles</li>
        <li>🚫 Can <b>never be used to claim</b> a discard</li>
      </ul>
      <p>Golds glow in your hand — and one thing you'll learn in Strategy School:
      <b>never, ever discard one</b>.</p>`,
    why: "The gold is the strongest tile on the table every single hand — using it well (and not wasting it) decides FJ games.",
    task: {
      type: "choice",
      q: "The gold this hand is 5●. You hold 3∥ 4∥ and one gold. What can your gold do?",
      labels: ["Complete the run, standing in as 2∥ or 5∥", "Pair up with a real 5● as the eyes", "Nothing — golds are just bonus points"],
      answer: 0,
      why: "A gold becomes whatever suit tile you need inside a set — so 3∥ 4∥ + gold is a finished Chi. But it can never be the eyes.",
      hint: "Re-read the three gold rules — one ✅, two 🚫.",
    },
  },
  {
    title: "Instant wins ⚡",
    body: () => `
      <p>Two FJ moments end a hand on the spot:</p>
      <ul>
        <li>🥇🥇🥇 <b>Three Golds (三金倒)</b> — hold all three wilds at once and you win
        immediately (+30 bonus).</li>
        <li>⚡ <b>Robbing the Gold (抢金)</b> — if the flipped gold would complete your
        freshly dealt hand, you win before anyone even moves (+50).</li>
      </ul>`,
    why: "With two golds in hand, every draw is a lottery ticket for an instant win — it changes how you value keeping them.",
    task: {
      type: "choice",
      q: "You're holding TWO golds and draw the third. What happens?",
      labels: ["You win instantly — 三金倒!", "Nothing until your hand is complete", "You must discard one gold"],
      answer: 0,
      why: "All three golds in one hand is an automatic win worth +30 — the game will flash you a special Hú button.",
      hint: "三金倒 literally triggers the moment the third gold arrives.",
    },
  },
  {
    title: "Scoring: flowers pay the bills 💰",
    body: () => `
      <p>FJ scoring is beautifully simple:</p>
      <ul>
        <li>Winner's points = <b>10 (base) × number of flowers</b> (minimum ×1)</li>
        <li>Zero flowers? <b>+20</b> consolation (无花)</li>
        <li>Three Golds +30 · Robbing the Gold +50 · Self-draw +10</li>
      </ul>
      <p>The player who <b>discarded the winning tile pays double</b>; on self-draws and
      instant wins, everyone pays.</p>`,
    why: "Flower counts are public — so you always know how expensive each opponent's win would be, and how hard to push your own hand.",
    task: {
      type: "choice",
      q: "You win holding 3 flowers. Base is 10 — how many points before bonuses?",
      labels: ["30", "10", "13"],
      answer: 0,
      why: "10 × 3 flowers = 30. A 5-flower hand would already be 50 — flowers ARE the score in FJ.",
      hint: "Multiply, don't add.",
    },
  },
  {
    title: "Graduation 🎓",
    body: () => `
      <p>Final exam! Here's your hand — 13 tiles, four sets already complete:</p>
      ${tilesHTML([0, 1, 2])} ${tilesHTML([9, 10, 11])} ${tilesHTML([18, 19, 20])}
      ${tilesHTML([22, 22, 22])} ${tilesHTML([7])}
      <p>Three runs, a Peng of 5萬… and one lonely 8 of Dots.</p>`,
    why: "Recognizing what your hand is waiting for — at a glance — is the moment mahjong clicks.",
    task: {
      type: "choice",
      q: "Which tile wins you this hand?",
      tiles: [7, 26, 13],
      answer: 0,
      why: "Hú! 胡 — a second 8● pairs your lonely one: 4 sets + eyes = 14. You're officially ready to play. In-game, I'll be in the side panel with hints whenever you want them.",
      hint: "Four sets are done. What's missing? (Step 7 knows.)",
    },
  },
];

/* ============================================================
   Strategy School — how to actually play WELL (advanced deck)
   ============================================================ */
const STRATEGY = [
  {
    title: "Think in \"steps to ready\" 🪜",
    body: () => `
      <p>Strong players don't ask <i>"is this tile nice?"</i> — they ask
      <i>"how many steps am I from ready?"</i> (Being <b>ready</b>, or <i>tenpai</i>,
      means one tile from winning.)</p>
      <p>Every draw-and-discard should move you down that ladder. Keep tiles with the most
      <b>future partners</b>:</p>
      <ul>
        <li>A <b>middle number</b> like ${T(13)} can join 3-4-5, 4-5-6 and 5-6-7 — plus pair up.</li>
        <li>An <b>edge tile</b> like ${T(9)} joins only 1-2-3.</li>
        <li>A <b>gold</b> 🥇 is the ultimate partner — it joins <i>everything</i>. Each gold
        you hold is roughly one whole step closer to ready.</li>
      </ul>`,
    why: "My in-game comments like “about 2 steps from ready” are exactly this count (golds included). If a discard makes the number go UP, it was probably a mistake.",
    task: {
      type: "choice",
      q: "Flexibility check: which lonely tile has the MOST ways to become part of a set? (The gold this hand is 3萬.)",
      tiles: [0, 4, 20],
      answer: 2,
      why: "That 3萬 IS the gold — it completes any run or triplet in the game. Among naturals, the middle 5 beats the edge 1, but nothing beats a wild.",
      hint: "One of these three isn't like the others this hand…",
    },
  },
  {
    title: "Not all waits are equal ⚖️",
    body: () => `
      <p>When you're one tile from winning, <b>what shape you wait with</b> decides how often
      you actually win.</p>
      <p><b>Open wait</b> — ${T(12)}${T(13)} finishes with a 3 <i>or</i> 6 of Bamboo:
      <b>8 possible tiles</b>. The gold standard (pun intended).</p>
      <p><b>Gap wait</b> — ${T(12)}${T(14)} needs exactly a 5∥: <b>4 tiles</b>.</p>
      <p><b>Edge wait</b> — ${T(9)}${T(10)} needs exactly a 3∥: <b>4 tiles</b>.</p>
      <p><b>Pair wait</b> — ${T(22)}${T(22)} needs the third copy: <b>at most 2</b> — and in
      FJ a gold <b>can't</b> fill your pair, so pair waits are even worse here!</p>`,
    why: "When two discards look equal, keeping the wider wait can literally double your win rate — the biggest 'invisible' skill in mahjong.",
    task: {
      type: "choice",
      q: "Pick ONE shape to keep as your final wait. Which wins most often?",
      labels: ["7-8 of Dots (open wait)", "1-2 of Dots (edge wait)", "Pair wait on a Character tile"],
      answer: 0,
      why: "7-8 completes with a 6 OR a 9 — up to 8 winning tiles, plus any gold you draw. The edge wait has 4; the pair wait at most 2 and no gold help.",
      hint: "Count how many distinct tiles finish each shape.",
    },
  },
  {
    title: "Count the living tiles 🔢",
    body: () => `
      <p>There are exactly <b>4 copies</b> of every tile. The discard pile, claimed sets,
      flower rows, and the flipped gold are all public — <b>use them</b>.</p>
      <ul>
        <li>Waiting on a tile with <b>3 copies visible</b>? Only 1 left — nearly dead.</li>
        <li>Waiting on the <b>gold's own kind</b>? One copy is flipped on the table and
        everyone hoards golds — don't wait on it.</li>
      </ul>`,
    why: "My Hint button does this math for you — “(2 left)” next to each wait, and a warning when a wait is completely dead.",
    task: {
      type: "choice",
      q: "You're ready, waiting on 6∥. One 6∥ is in the river and an opponent has an exposed PENG of 6∥. How many can you still get?",
      labels: ["0 — the wait is dead!", "1", "2"],
      answer: 0,
      why: "1 in the river + 3 in the Peng = all 4 accounted for. Reshape — though drawing a GOLD can still complete a dead wait; that's only 3 lucky tiles to hope for.",
      hint: "Four copies exist. Add up the visible ones.",
    },
  },
  {
    title: "Gold strategy 🥇",
    body: () => `
      <p>Golds decide FJ games. The house rules of gold handling:</p>
      <ul>
        <li><b>NEVER discard a gold.</b> Strictly better than every other tile — and it can
        hand an opponent the win.</li>
        <li><b>Two golds = hunt the third.</b> 三金倒 gives you a secret extra win condition
        all game long.</li>
        <li><b>Lock a natural pair early.</b> Golds can't be eyes — free them up to finish sets.</li>
        <li><b>Golds love loose shapes.</b> With a wild in hand, gaps like 4-6 or 7-9 are
        stronger than usual.</li>
      </ul>`,
    why: "A gold wasted as a 'nice extra tile' is 20–50 points thrown away; a gold used to finish the hardest set is the win.",
    task: {
      type: "choice",
      q: "You hold TWO golds mid-game. What's the strongest reason to guard them both, always?",
      labels: ["A third gold wins instantly (三金倒)", "They score +5 each at the end", "They can be my pair in a pinch"],
      answer: 0,
      why: "With two golds, every single draw could be the instant win — on top of each gold already completing any set. (They can't be the pair, and they're not flat points.)",
      hint: "What happens the moment gold #3 arrives?",
    },
  },
  {
    title: "Flower economics 🌸",
    body: () => `
      <p>In FJ, <b>flowers are the score</b> (base 10 × flower count). Every hand is a small
      economics problem:</p>
      <ul>
        <li><b>3–4+ flowers?</b> Your win is big — play <b>aggressively</b>: claim for speed,
        race to ready.</li>
        <li><b>0–1 flowers?</b> Low ceiling (0 flowers still gets +20) — prefer fast cheap
        wins, or lean defensive.</li>
        <li><b>Watch their flower rows</b> — public info! A 4-flower opponent is a 4× threat,
        and whoever feeds them pays <b>double</b>.</li>
      </ul>`,
    why: "Flowers are luck to receive — but responding to them correctly is pure skill. That's the heart of FJ strategy.",
    task: {
      type: "choice",
      q: "An opponent has 5 flowers and 3 exposed sets. You're 2 steps from a 1-flower win. Best plan?",
      labels: ["Fold: discard only safe tiles", "Race them — push my cheap hand", "Discard fresh middle tiles to speed up"],
      answer: 0,
      why: "They're close AND their win pays 5× base — double from whoever feeds them. Your hand is slow and cheap: fold, stay safe, let someone else pay.",
      hint: "Compare what you'd win vs what you'd pay.",
    },
  },
  {
    title: "Call with a plan 📢",
    body: () => `
      <p>Claims (Chi/Peng/Gang) feel powerful — free tiles! But each has hidden costs:
      the set is <b>locked face-up</b>, your plan is <b>revealed</b>, and a used 4-5 could
      have been an open wait.</p>
      <p><b>In FJ, claims are pure speed</b> — no bonus points for Pengs or fancy patterns.
      The only question: <i>does this claim get me to ready faster without wrecking my shape?</i></p>
      <p><b>Claim happily</b> to complete your 3rd/4th set, or when flower-rich and racing.
      <b>Pass</b> when it strands tiles, wrecks an open wait, or someone dangerous is close.</p>`,
    why: "Graduation exercise: play one hand watching only the flower rows and the gold, asking before every discard — who am I feeding?",
    task: {
      type: "choice",
      q: "Which claim is clearly RIGHT in FJ style?",
      labels: ["Peng that completes my 4th set while I hold 4 flowers", "Any Peng, always — triplets score extra", "A Chi that breaks up my two golds' flexibility"],
      answer: 0,
      why: "FJ has no set-pattern bonuses — claims are speed. Completing your 4th set while flower-rich is exactly when racing pays. 'Pengs score extra' is other variants!",
      hint: "Remember: FJ scoring only counts flowers, golds and how you won.",
    },
  },
];

const DECKS = {
  basics:   { name: "Beginner class",  lessons: LESSONS },
  strategy: { name: "Strategy School", lessons: STRATEGY },
};

/* ---------- Tutorial state & renderer ---------- */

let lessonIdx = 0;
let curDeck = "basics";
const TUT = { solved: {}, attempts: 0, stage: 0, feedback: null };

function tutKey() { return curDeck + ":" + lessonIdx; }
function tutSolved() { return !!TUT.solved[tutKey()]; }

function openTutorial(startAt = 0, deck = "basics") {
  curDeck = deck;
  lessonIdx = startAt;
  TUT.attempts = 0;
  TUT.stage = 0;
  TUT.feedback = null;
  renderLesson();
}

function gotoLesson(idx) {
  lessonIdx = idx;
  TUT.attempts = 0;
  TUT.stage = 0;
  TUT.feedback = null;
  renderLesson();
}

function markSolved(feedbackHtml) {
  TUT.solved[tutKey()] = true;
  TUT.feedback = { ok: true, html: feedbackHtml };
  renderLesson();
}

function markWrong(task) {
  TUT.attempts++;
  TUT.feedback = { ok: false, html: "❌ Not quite — try again!" };
  renderLesson();
}

function renderLesson() {
  const list = DECKS[curDeck].lessons;
  const L = list[lessonIdx];
  const solved = tutSolved();
  const pct = Math.round(((lessonIdx + 1) / list.length) * 100);

  let html = `<div class="lesson-head">${DECKS[curDeck].name} — Step ${lessonIdx + 1} of ${list.length}</div>
              <div class="tut-progress"><div style="width:${pct}%"></div></div>
              <h2>${L.title}</h2>${L.body()}`;
  if (L.why) html += `<div class="tut-why">💡 <b>Why it matters:</b> ${L.why}</div>`;

  if (L.task) {
    html += `<div class="tut-task"><span class="task-label">${L.task.type === "demo" ? "Try it" : "Your turn"}</span>`;
    html += `<p><b>${L.task.q}</b></p>`;
    if (L.task.type === "demo") {
      const st = solved ? L.task.stages.length : TUT.stage;
      const stage = L.task.stages[Math.min(st, L.task.stages.length - 1)];
      html += `<div class="demo-stage">`;
      if (solved) {
        html += `<p class="tut-done">✓ ${L.task.done}</p>`;
      } else {
        html += `<p>${stage.text}</p>`;
        if (stage.tiles) html += tilesHTML(stage.tiles);
        html += `<button class="action-btn primary demo-btn" id="demo-next">${stage.btn}</button>`;
      }
      html += `</div>`;
    } else {
      if (L.task.show) html += tilesHTML(L.task.show);
      html += `<div class="quiz-options" id="quiz-options"></div>`;
      if (TUT.feedback) {
        html += `<p class="${TUT.feedback.ok ? "quiz-right" : "quiz-wrong"}">${TUT.feedback.html}</p>`;
      }
      if (!solved && TUT.attempts >= 2 && L.task.hint) {
        html += `<div class="tut-hint">💡 <b>Hint:</b> ${L.task.hint}</div>`;
      }
    }
    html += `</div>`;
  }

  // footer buttons — Next is gated behind the step's task
  const buttons = [];
  if (lessonIdx > 0) buttons.push({ label: "← Back", cls: "secondary", cb: () => gotoLesson(lessonIdx - 1) });
  const gated = L.task && !solved;
  if (lessonIdx < list.length - 1) {
    buttons.push({ label: gated ? "Next → (finish the exercise first)" : "Next →", cls: "primary", disabled: gated, cb: () => gotoLesson(lessonIdx + 1) });
  } else if (curDeck === "basics") {
    if (!gated) {
      buttons.push({ label: "Strategy School →", cls: "primary", cb: () => openTutorial(0, "strategy") });
      buttons.push({ label: "Let's play!", cls: "secondary", cb: () => { hideModal(); } });
    } else {
      buttons.push({ label: "Finish the exam to graduate", cls: "primary", disabled: true, cb: () => {} });
    }
  } else {
    buttons.push({ label: gated ? "Finish the exercise first" : "Let's play!", cls: "primary", disabled: gated, cb: () => { hideModal(); } });
  }
  buttons.push({ label: "Close ✕", cls: "secondary", cb: hideModal });
  showModal(html, buttons);
  // apply disabled state (showModal doesn't know about it)
  [...document.querySelectorAll("#modal-buttons .action-btn")].forEach((btn, i) => {
    if (buttons[i] && buttons[i].disabled) btn.disabled = true;
  });

  if (!L.task) return;

  if (L.task.type === "demo") {
    const btn = document.getElementById("demo-next");
    if (btn) btn.addEventListener("click", () => {
      if (TUT.stage < L.task.stages.length - 1) { TUT.stage++; renderLesson(); }
      else markSolved(L.task.done);
    });
    return;
  }

  // choice & pick tasks
  const box = document.getElementById("quiz-options");
  if (!box) return;
  const opts = L.task.tiles || L.task.labels;
  const picked = new Set();

  opts.forEach((o, i) => {
    let el;
    if (L.task.tiles) el = tileEl(o, { small: false });
    else {
      el = document.createElement("button");
      el.className = "action-btn quiz-text-btn";
      el.textContent = o;
    }
    if (solved) {
      const isAnswer = L.task.type === "pick" ? L.task.answers.includes(i) : i === L.task.answer;
      if (isAnswer && el.classList) el.classList.add("q-selected");
      box.appendChild(el);
      return;
    }
    el.classList.add("clickable");
    el.addEventListener("click", () => {
      if (L.task.type === "pick") {
        if (picked.has(i)) { picked.delete(i); el.classList.remove("q-selected"); return; }
        picked.add(i);
        el.classList.add("q-selected");
        if (picked.size === L.task.answers.length) {
          const right = L.task.answers.every(a => picked.has(a));
          if (right) markSolved("✅ <b>Exactly!</b> " + L.task.why);
          else markWrong(L.task);
        }
      } else {
        if (i === L.task.answer) markSolved("✅ <b>Correct!</b> " + L.task.why);
        else markWrong(L.task);
      }
    });
    box.appendChild(el);
  });
}
