// Generates Google Play Store assets for Hugging Pop, rendered from SVG via
// sharp so they exactly match the in-game palette + cartoon character.
// Output: play-store-assets/*.png
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const OUT = join(root, 'play-store-assets');
mkdirSync(OUT, { recursive: true });

// ---- Game palette (from game.js) -------------------------------------------
const INK = '#2a2440';
const PAL = ['#ff6b9d', '#6ec2ff', '#ffd95a', '#9adf7a', '#b582ff', '#ff9a4a', '#6deeda', '#ff7aa8'];
const FONT = 'Trebuchet MS, Verdana, Segoe UI, sans-serif';

// ---- SVG building blocks ----------------------------------------------------
function bubble(cx, cy, r, color, sw = null) {
  sw = sw || Math.max(3, r * 0.06);
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" stroke="${INK}" stroke-width="${sw}"/>
    <ellipse cx="${cx - r * 0.33}" cy="${cy - r * 0.38}" rx="${r * 0.30}" ry="${r * 0.20}" fill="#ffffff" opacity="0.55"/>
    <circle cx="${cx + r * 0.4}" cy="${cy + r * 0.34}" r="${r * 0.07}" fill="#ffffff" opacity="0.35"/>`;
}

// Cute round yellow character with big eyes + smile + rosy cheeks.
function hero(cx, cy, r, mood = 'happy') {
  const sw = Math.max(3, r * 0.07);
  const eyeR = r * 0.20, eyeDx = r * 0.40, eyeY = cy - r * 0.10;
  const pupR = eyeR * 0.55;
  const cheek = r * 0.16;
  let mouth;
  if (mood === 'charge') {
    mouth = `<ellipse cx="${cx}" cy="${cy + r * 0.34}" rx="${r * 0.16}" ry="${r * 0.20}" fill="${INK}"/>`;
  } else {
    mouth = `<path d="M ${cx - r * 0.26} ${cy + r * 0.28} Q ${cx} ${cy + r * 0.55} ${cx + r * 0.26} ${cy + r * 0.28}"
              fill="none" stroke="${INK}" stroke-width="${sw}" stroke-linecap="round"/>`;
  }
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffd95a" stroke="${INK}" stroke-width="${sw}"/>
    <ellipse cx="${cx - r * 0.34}" cy="${cy - r * 0.42}" rx="${r * 0.30}" ry="${r * 0.18}" fill="#fff3c4" opacity="0.7"/>
    <circle cx="${cx - eyeDx}" cy="${eyeY}" r="${eyeR}" fill="#ffffff" stroke="${INK}" stroke-width="${sw * 0.6}"/>
    <circle cx="${cx + eyeDx}" cy="${eyeY}" r="${eyeR}" fill="#ffffff" stroke="${INK}" stroke-width="${sw * 0.6}"/>
    <circle cx="${cx - eyeDx + pupR * 0.3}" cy="${eyeY + pupR * 0.2}" r="${pupR}" fill="${INK}"/>
    <circle cx="${cx + eyeDx + pupR * 0.3}" cy="${eyeY + pupR * 0.2}" r="${pupR}" fill="${INK}"/>
    <circle cx="${cx - eyeDx + pupR * 0.55}" cy="${eyeY - pupR * 0.4}" r="${pupR * 0.35}" fill="#fff"/>
    <circle cx="${cx + eyeDx + pupR * 0.55}" cy="${eyeY - pupR * 0.4}" r="${pupR * 0.35}" fill="#fff"/>
    <circle cx="${cx - r * 0.55}" cy="${cy + r * 0.28}" r="${cheek}" fill="#ff8caa" opacity="0.55"/>
    <circle cx="${cx + r * 0.55}" cy="${cy + r * 0.28}" r="${cheek}" fill="#ff8caa" opacity="0.55"/>
    ${mouth}`;
}

function cloud(cx, cy, s, op = 0.9) {
  return `<g opacity="${op}">
    <ellipse cx="${cx}" cy="${cy}" rx="${70 * s}" ry="${42 * s}" fill="#ffffff"/>
    <ellipse cx="${cx - 50 * s}" cy="${cy + 10 * s}" rx="${44 * s}" ry="${30 * s}" fill="#ffffff"/>
    <ellipse cx="${cx + 52 * s}" cy="${cy + 12 * s}" rx="${40 * s}" ry="${28 * s}" fill="#ffffff"/>
  </g>`;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Big readable cartoon text: white fill + dark outline.
function title(cx, cy, text, size, fill = '#ffffff', stroke = INK) {
  const sw = size * 0.14;
  return `<text x="${cx}" y="${cy}" font-family="${FONT}" font-size="${size}" font-weight="bold"
            text-anchor="middle" dominant-baseline="middle"
            fill="${fill}" stroke="${stroke}" stroke-width="${sw}"
            paint-order="stroke" stroke-linejoin="round">${esc(text)}</text>`;
}

function render(svg, w, h, file) {
  return sharp(Buffer.from(svg)).resize(w, h).png().toFile(join(OUT, file))
    .then(() => console.log('  ✓', file));
}

// ---- 1. App icon 512x512 ----------------------------------------------------
function iconSVG() {
  const W = 512;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${W}" viewBox="0 0 ${W} ${W}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#7ecbff"/>
        <stop offset="0.55" stop-color="#c9a8ff"/>
        <stop offset="1" stop-color="#ff8fc0"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${W}" fill="url(#g)"/>
    ${bubble(96, 120, 46, PAL[0])}
    ${bubble(420, 150, 38, PAL[1])}
    ${bubble(120, 400, 40, PAL[4])}
    ${bubble(410, 392, 50, PAL[3])}
    ${hero(256, 268, 132)}
  </svg>`;
}

// ---- 2. Feature graphic 1024x500 -------------------------------------------
function featureSVG() {
  const W = 1024, H = 500;
  let bubbles = '';
  const col = [[815, 410, 34, 1], [860, 320, 30, 3], [820, 232, 34, 4], [880, 150, 30, 0], [835, 70, 30, 7]];
  for (const [x, y, r, c] of col) bubbles += bubble(x, y, r, PAL[c]);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0" stop-color="#73c4ff"/>
        <stop offset="0.6" stop-color="#b9a6ff"/>
        <stop offset="1" stop-color="#ff95c2"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${cloud(180, 120, 1.1, 0.85)}
    ${cloud(520, 80, 0.9, 0.7)}
    ${cloud(300, 430, 1.3, 0.8)}
    ${bubble(120, 250, 30, PAL[1])}
    ${bubble(250, 350, 26, PAL[2])}
    ${bubbles}
    ${hero(815, 250, 78, 'happy')}
    ${title(372, 215, 'Hugging Pop', 104)}
    <text x="372" y="300" font-family="${FONT}" font-size="40" font-weight="bold" text-anchor="middle"
      fill="#fff" stroke="${INK}" stroke-width="5" paint-order="stroke">One-tap bubble jumper</text>
    ${bubble(372, 392, 22, PAL[5])}
    ${bubble(430, 405, 16, PAL[6])}
    ${bubble(316, 402, 18, PAL[0])}
  </svg>`;
}

// ---- 3. Screenshots 1080x1920 ----------------------------------------------
function screenSVG(opts) {
  const W = 1080, H = 1920;
  const { caption, disco, hud, charge, difficulties } = opts;
  const skyTop = disco ? '#3a1d63' : '#73c4ff';
  const skyMid = disco ? '#7b2ea8' : '#bda7ff';
  const skyBot = disco ? '#c83f9e' : '#ff9ec6';
  const capBg = disco ? '#b03bd6' : '#ff6b9d';

  // platform column
  let plats = '';
  const xs = [540, 470, 600, 500, 560, 520];
  let py = 1640;
  for (let i = 0; i < 6; i++) {
    const r = 78 - i * 2;
    if (disco) {
      plats += `<rect x="${xs[i] - r}" y="${py - 22}" width="${r * 2}" height="44" rx="22"
        fill="${PAL[i % PAL.length]}" stroke="${INK}" stroke-width="5"/>
        <rect x="${xs[i] - r * 0.7}" y="${py - 16}" width="${r * 1.4}" height="14" rx="7" fill="#ffffff" opacity="0.5"/>`;
    } else {
      plats += bubble(xs[i], py, r, PAL[i % PAL.length]);
    }
    py -= 200;
  }

  let clouds = disco ? '' : cloud(220, 700, 1.2, 0.75) + cloud(840, 920, 1.0, 0.65) + cloud(300, 1180, 1.1, 0.6);
  let discoBall = disco ? `
    <circle cx="820" cy="560" r="70" fill="#dfe7ff" stroke="${INK}" stroke-width="6"/>
    <g stroke="#9fb0d8" stroke-width="2" opacity="0.8">
      <line x1="760" y1="540" x2="880" y2="540"/><line x1="755" y1="575" x2="885" y2="575"/>
      <line x1="765" y1="605" x2="875" y2="605"/><line x1="820" y1="490" x2="820" y2="630"/>
      <line x1="785" y1="495" x2="785" y2="625"/><line x1="855" y1="495" x2="855" y2="625"/>
    </g>` : `
    <g>
      <circle cx="830" cy="560" r="64" fill="#ffe17a" stroke="${INK}" stroke-width="6"/>
      <circle cx="808" cy="548" r="6" fill="${INK}"/><circle cx="852" cy="548" r="6" fill="${INK}"/>
      <path d="M 806 572 Q 830 590 854 572" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>
    </g>`;

  // hud
  let hudSvg = '';
  if (hud) {
    hudSvg = `
      <text x="60" y="360" font-family="${FONT}" font-size="64" font-weight="bold" fill="${INK}"
        stroke="#fff4d8" stroke-width="8" paint-order="stroke">${hud.h}</text>
      <text x="64" y="404" font-family="${FONT}" font-size="28" font-weight="bold" fill="${INK}" opacity="0.8">HEIGHT</text>
      <text x="540" y="360" font-family="${FONT}" font-size="58" font-weight="bold" text-anchor="middle"
        fill="#bf3a82" stroke="#fff4d8" stroke-width="8" paint-order="stroke">x${hud.combo}</text>`;
  }

  // charge ring
  let chargeSvg = charge ? `
    <circle cx="540" cy="1760" r="64" fill="none" stroke="#ffffff" stroke-width="14" opacity="0.5"/>
    <circle cx="540" cy="1760" r="64" fill="none" stroke="#ffd95a" stroke-width="14"
      stroke-dasharray="300 402" stroke-linecap="round" transform="rotate(-90 540 1760)"/>` : '';

  // difficulty badges
  let diffSvg = '';
  if (difficulties) {
    const ds = [['EASY', '#9adf7a', 760], ['MEDIUM', '#ffd95a', 980], ['HARD', '#ff7aa8', 1200]];
    for (const [label, c, y] of ds) {
      diffSvg += `<rect x="300" y="${y}" width="480" height="120" rx="32" fill="${c}" stroke="${INK}" stroke-width="7"/>
        <text x="540" y="${y + 78}" font-family="${FONT}" font-size="58" font-weight="bold" text-anchor="middle"
          fill="${INK}">${label}</text>`;
    }
  }

  const heroY = charge ? 1556 : (hud ? 980 : 1556);
  const heroScene = difficulties ? '' :
    (disco
      ? hero(540, heroY, 70, 'happy')
      : hero(540, heroY, 70, charge ? 'charge' : 'happy'));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${skyTop}"/>
        <stop offset="0.5" stop-color="${skyMid}"/>
        <stop offset="1" stop-color="${skyBot}"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#s)"/>
    ${clouds}
    ${discoBall}
    ${difficulties ? '' : plats}
    ${diffSvg}
    ${heroScene}
    ${hudSvg}
    ${chargeSvg}
    <!-- caption banner -->
    <rect x="0" y="0" width="${W}" height="250" fill="${capBg}"/>
    <rect x="0" y="250" width="${W}" height="10" fill="${INK}" opacity="0.25"/>
    ${title(540, 150, caption.t, caption.size || 76)}
    ${caption.sub ? `<text x="540" y="210" font-family="${FONT}" font-size="36" font-weight="bold"
        text-anchor="middle" fill="#fff" opacity="0.95">${esc(caption.sub)}</text>` : ''}
  </svg>`;
}

const screens = [
  { file: 'screenshot-1.png', caption: { t: 'Bounce as high as you can!' , size: 64 } },
  { file: 'screenshot-2.png', caption: { t: 'Simple one-tap controls', size: 70 }, charge: true },
  { file: 'screenshot-3.png', caption: { t: 'Light up DISCO mode!', size: 74 }, disco: true },
  { file: 'screenshot-4.png', caption: { t: 'Easy, Medium & Hard', size: 74 }, difficulties: true },
  { file: 'screenshot-5.png', caption: { t: 'Beat your best height!', size: 70 }, hud: { h: '1240m', combo: '8' } }
];

console.log('Rendering Play Store assets ->', OUT);
await render(iconSVG(), 512, 512, 'icon-512.png');
await render(featureSVG(), 1024, 500, 'feature-graphic-1024x500.png');
for (const s of screens) await render(screenSVG(s), 1080, 1920, s.file);
console.log('Done.');
