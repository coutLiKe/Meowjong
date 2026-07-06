"use strict";
/* ============================================================
   Meowjong — tile definitions (FJ / Fujian style set)
   Kind encoding (0..30):
     0-8   Dots (circles)  1-9
     9-17  Bamboo (sticks) 1-9   — the 1-Bamboo is our café cat 🐱
     18-26 Characters (萬) 1-9
     27-30 Winds 東 南 西 北 — used as FLOWER/bonus tiles only
   NO dragons in FJ style. Four copies of each kind → 124 tiles.
   (Kinds 31-33 remain defined for artwork but are never dealt.)
   ============================================================ */

const SUITS = [
  { key: "dot", name: "Dots",       short: "●" },
  { key: "bam", name: "Bamboo",     short: "∥" },
  { key: "man", name: "Characters", short: "萬" },
];

const WINDS = [
  { key: "E", name: "East Wind",  char: "東" },
  { key: "S", name: "South Wind", char: "南" },
  { key: "W", name: "West Wind",  char: "西" },
  { key: "N", name: "North Wind", char: "北" },
];

const DRAGONS = [
  { key: "R", name: "Red Dragon",   char: "中" },
  { key: "G", name: "Green Dragon", char: "發" },
  { key: "W", name: "White Dragon", char: "□" },
];

const N_KINDS = 34;

function suitOf(k)  { return k < 27 ? Math.floor(k / 9) : -1; }
function rankOf(k)  { return k < 27 ? (k % 9) + 1 : 0; }
function isHonor(k) { return k >= 27; }
function isWind(k)  { return k >= 27 && k <= 30; }
function isDragon(k){ return k >= 31; }

/* Human-readable name, e.g. "3 of Dots", "East Wind (東)" */
function tileName(k) {
  if (k < 27) return rankOf(k) + " of " + SUITS[suitOf(k)].name;
  if (isWind(k)) { const w = WINDS[k - 27]; return w.name + " (" + w.char + ")"; }
  const d = DRAGONS[k - 31];
  return d.name + (k === 33 ? "" : " (" + d.char + ")");
}

/* Short form for logs/coach, e.g. "3●", "5∥", "7萬", "東", "中" */
function tileShort(k) {
  if (k < 27) return rankOf(k) + SUITS[suitOf(k)].short;
  if (isWind(k)) return WINDS[k - 27].char;
  return DRAGONS[k - 31].char;
}

/* Build & shuffle a fresh 124-tile FJ wall (suits + winds, no dragons) */
function buildWall() {
  const wall = [];
  for (let k = 0; k <= 30; k++) for (let c = 0; c < 4; c++) wall.push(k);
  for (let i = wall.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wall[i], wall[j]] = [wall[j], wall[i]];
  }
  return wall;
}

function sortHand(hand) { hand.sort((a, b) => a - b); return hand; }

/* Display names for melds (FJ uses the Mandarin terms) */
const MELD_LABEL = { chow: "Chi", pung: "Peng", kong: "Gang" };

/* hand (array of kinds) → counts array of length 34 */
function countsOf(hand) {
  const c = new Array(N_KINDS).fill(0);
  for (const k of hand) c[k]++;
  return c;
}
