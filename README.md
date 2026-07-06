# 🀄 Meowjong — Learn & Play FJ (Fujian) Mahjong

A beginner-friendly implementation of **FJ (Fujian/Fuzhou) style 4-player mahjong** — the
fast, gold-rush variant — with traditional tiles, a built-in teacher (**Professor Paws** 🎓),
and an online **party mode** for playing with friends. This is the only variant implemented.

## How to run

Open `index.html` in any modern browser (double-click it). No install, no build.
Party mode needs an internet connection (it uses the free PeerJS peer-to-peer service).

## FJ rules implemented

- **124 tiles**: Dots ● / Bamboo ∥ / Characters 萬 (1–9 ×4) + four winds. **No dragons.**
- **Winds are flowers 🌸**: drawn (or dealt) → exposed beside the hand → replacement drawn
  from the back of the wall. They never stay in a hand.
- **The Gold 🥇 (金)**: after the deal, a tile is flipped at the back wall; its 3 remaining
  copies are **wild** — each substitutes any suit tile in a set. A gold can **not** be the
  pair/eyes and can **not** be used in chi/peng/gang claims.
- **Winning hand**: 4 sets + 1 pair (13-tile hands; dealer draws first).
- **Instant wins**: **三金倒** — hold all three golds (+30); **抢金 Robbing the Gold** — the
  flipped gold completes a ready dealt hand (+50).
- **Scoring**: winner gets **10 base × flower count** (min ×1); **+20** for winning with no
  flowers (无花); **+10** self-draw. The player who discards the winning tile pays double;
  on self-draws and instant wins everyone pays.
- Chi only from the previous player; peng/gang from anyone; concealed/added gangs with
  back-wall replacement draws.

## Party mode 🎉

Real 4-player mahjong over the internet, no server to set up: host gets a 4-letter room
code, up to 3 friends join with it, AI cats fill empty seats and take over on disconnect.
Everyone sees the table from their own seat (flower rows and the gold are public).

## Learning features

- **🎓 Interactive tutorial** — 9 lessons with quizzes, FJ rules from zero (auto-opens first visit)
- **🧠 Strategy School** — 6 advanced lessons: steps-to-ready, wait shapes, counting live
  tiles, gold strategy, flower economics (bet sizing), claim discipline
- **🎓 Professor Paws** — one friendly coach, one brain. He auto-comments as you play
  (distance to ready, gold/flower alerts, tenpai/danger warnings) and his **💡 Hint** button
  suggests the discard to make — with live-tile counts, safety reads, and gold warnings.
- **📊 Show my full analysis** — an expander inside Paws' panel that reveals the *same*
  engine's full working: **every** legal action ranked by EV / win% / deal-in risk, each
  opponent modelled (speed × flower payout × suit reads), and Monte Carlo rollouts of
  simulated futures. Because Paws' Hint and the ranked table read one engine, they never
  disagree — the tile Paws glows is the table's top line. Design doc:
  `docs/STRATEGY_ASSISTANT.md`
- **👀 Peek mode** — see the AI cats' hands while you learn (single-player only)
- **🔤 Labels toggle** — corner numbers/letters on tiles while you learn to read the faces
- **📜 Game log** — every action narrated in plain English

Built with plain HTML/CSS/JS; the only dependency is PeerJS (CDN) for party mode.
