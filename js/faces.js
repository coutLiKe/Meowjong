"use strict";
/* ============================================================
   Meowjong — traditional tile face artwork (SVG)
   Dots (circles), Bamboo (sticks), Characters (萬),
   Winds (東南西北), Dragons (中 / 發 / blank frame).
   ============================================================ */

const FACE_COLORS = { G: "#1e7a3c", R: "#b3232a", B: "#2b4a9b" };
const CJK_FONT = `'Songti SC','STSong','SimSun','Noto Serif CJK SC',serif`;

/* an engraved-looking circle: ring + inner ring + solid center */
function svgDot(x, y, r, c) {
  const col = FACE_COLORS[c];
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${col}" stroke-width="${r * 0.28}"/>` +
         `<circle cx="${x}" cy="${y}" r="${r * 0.45}" fill="${col}"/>`;
}

/* a bamboo stick: two stacked capsule segments */
function svgStick(cx, cy, c) {
  const col = FACE_COLORS[c];
  const w = 8, h = 22, x = cx - w / 2, y = cy - h / 2;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h * 0.46}" rx="3.4" fill="none" stroke="${col}" stroke-width="2"/>` +
         `<rect x="${x}" y="${y + h * 0.54}" width="${w}" height="${h * 0.46}" rx="3.4" fill="none" stroke="${col}" stroke-width="2"/>` +
         `<line x1="${cx}" y1="${y + 3}" x2="${cx}" y2="${y + h * 0.36}" stroke="${col}" stroke-width="1.6"/>` +
         `<line x1="${cx}" y1="${y + h * 0.64}" x2="${cx}" y2="${y + h - 3}" stroke="${col}" stroke-width="1.6"/>`;
}

/* dot layouts: [x, y, radius, color] per rank */
const DOT_LAYOUTS = {
  1: [[30, 42, 15, "R"]],
  2: [[30, 23, 10, "G"], [30, 61, 10, "B"]],
  3: [[15, 18, 9, "B"], [30, 42, 9, "R"], [45, 66, 9, "B"]],
  4: [[19, 23, 9, "B"], [41, 23, 9, "G"], [19, 61, 9, "G"], [41, 61, 9, "B"]],
  5: [[17, 20, 8, "B"], [43, 20, 8, "G"], [30, 42, 8, "R"], [17, 64, 8, "G"], [43, 64, 8, "B"]],
  6: [[19, 17, 8, "G"], [41, 17, 8, "G"], [19, 42, 8, "R"], [41, 42, 8, "R"], [19, 67, 8, "R"], [41, 67, 8, "R"]],
  7: [[13, 13, 6.5, "G"], [30, 19, 6.5, "G"], [47, 25, 6.5, "G"], [19, 48, 7, "R"], [41, 48, 7, "R"], [19, 69, 7, "R"], [41, 69, 7, "R"]],
  8: [[19, 14, 7, "B"], [41, 14, 7, "B"], [19, 33, 7, "B"], [41, 33, 7, "B"], [19, 52, 7, "B"], [41, 52, 7, "B"], [19, 71, 7, "B"], [41, 71, 7, "B"]],
  9: [[15, 17, 6.5, "G"], [30, 17, 6.5, "G"], [45, 17, 6.5, "G"], [15, 42, 6.5, "R"], [30, 42, 6.5, "R"], [45, 42, 6.5, "R"], [15, 67, 6.5, "B"], [30, 67, 6.5, "B"], [45, 67, 6.5, "B"]],
};

/* bamboo layouts: [x, y, color] per rank */
const BAM_LAYOUTS = {
  1: [[30, 42, "G"]],
  2: [[30, 25, "G"], [30, 59, "G"]],
  3: [[30, 21, "G"], [20, 61, "G"], [40, 61, "G"]],
  4: [[20, 25, "G"], [40, 25, "G"], [20, 59, "G"], [40, 59, "G"]],
  5: [[18, 22, "G"], [42, 22, "G"], [30, 42, "R"], [18, 62, "G"], [42, 62, "G"]],
  6: [[16, 25, "G"], [30, 25, "G"], [44, 25, "G"], [16, 59, "G"], [30, 59, "G"], [44, 59, "G"]],
  7: [[30, 17, "R"], [16, 46, "G"], [30, 46, "G"], [44, 46, "G"], [16, 71, "G"], [30, 71, "G"], [44, 71, "G"]],
  8: [[13, 25, "G"], [24.5, 25, "G"], [35.5, 25, "G"], [47, 25, "G"], [13, 59, "G"], [24.5, 59, "G"], [35.5, 59, "G"], [47, 59, "G"]],
  9: [[16, 18, "G"], [30, 18, "G"], [44, 18, "G"], [16, 42, "R"], [30, 42, "R"], [44, 42, "R"], [16, 66, "G"], [30, 66, "G"], [44, 66, "G"]],
};

const CHAR_NUMERALS = ["一", "二", "三", "四", "伍", "六", "七", "八", "九"];

function svgText(x, y, size, color, text, weight = "bold") {
  return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-family="${CJK_FONT}" font-weight="${weight}" text-anchor="middle">${text}</text>`;
}

/* Full SVG face for a tile kind (0..33) */
function tileFaceSVG(kind) {
  let inner = "";
  if (kind < 9) {
    // Dots
    inner = DOT_LAYOUTS[kind + 1].map(([x, y, r, c]) => svgDot(x, y, r, c)).join("");
    if (kind === 0) {
      // 1-dot gets the fancy double ring
      inner = `<circle cx="30" cy="42" r="19" fill="none" stroke="${FACE_COLORS.G}" stroke-width="2.5"/>` +
              `<circle cx="30" cy="42" r="14" fill="none" stroke="${FACE_COLORS.R}" stroke-width="3.5"/>` +
              `<circle cx="30" cy="42" r="6" fill="${FACE_COLORS.R}"/>`;
    }
  } else if (kind < 18) {
    // Bamboo
    const rank = kind - 9 + 1;
    inner = BAM_LAYOUTS[rank].map(([x, y, c]) => svgStick(x, y, c)).join("");
  } else if (kind < 27) {
    // Characters
    const rank = kind - 18 + 1;
    inner = svgText(30, 36, 27, FACE_COLORS.B, CHAR_NUMERALS[rank - 1]) +
            svgText(30, 74, 29, FACE_COLORS.R, "萬");
  } else if (kind <= 30) {
    // Winds
    inner = svgText(30, 57, 40, FACE_COLORS.B, WINDS[kind - 27].char);
  } else if (kind === 31) {
    inner = svgText(30, 57, 40, FACE_COLORS.R, "中");
  } else if (kind === 32) {
    inner = svgText(30, 57, 40, FACE_COLORS.G, "發");
  } else {
    // White dragon: the blue frame
    inner = `<rect x="11" y="9" width="38" height="66" rx="5" fill="none" stroke="${FACE_COLORS.B}" stroke-width="3"/>` +
            `<rect x="17" y="15" width="26" height="54" rx="3" fill="none" stroke="${FACE_COLORS.B}" stroke-width="1.5"/>`;
  }
  return `<svg viewBox="0 0 60 84" xmlns="http://www.w3.org/2000/svg" class="face-svg" aria-hidden="true">${inner}</svg>`;
}
