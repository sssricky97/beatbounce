// Generates the source artwork that @capacitor/assets turns into every Android
// icon density + splash. Produces, under assets/:
//   icon.png            (1024) full legacy icon (gradient + mascot)
//   icon-foreground.png (1024) mascot only, padded into the adaptive safe zone
//   icon-background.png (1024) flat gradient for the adaptive background layer
//   splash.png          (2732) dark launch splash with mascot + wordmark
//   splash-dark.png     (2732) same (the game's launch background is dark)
// Run via: npm run art   (then: npm run assets)
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(new URL('.', import.meta.url)));
const out = join(root, 'assets');
mkdirSync(out, { recursive: true });

// The mascot: a round yellow face with two big eyes, rosy cheeks and a smile,
// matching the in-game character. cx/cy/r let us place it on any canvas.
function mascot(cx, cy, r) {
  const s = r / 300; // scale factor relative to the reference 300px radius
  const eyeR = 95 * s, eyeDX = 82 * s, eyeDY = 40 * s;
  const pupR = 46 * s;
  const lEyeX = cx - eyeDX, rEyeX = cx + eyeDX, eyeY = cy - eyeDY;
  const cheekY = cy + 80 * s, cheekDX = 142 * s;
  const stroke = Math.max(2, 9 * s);
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffd23f" stroke="#e3a11c" stroke-width="${stroke}"/>
    <ellipse cx="${cx - cheekDX}" cy="${cheekY}" rx="${58 * s}" ry="${36 * s}" fill="#ff9ec4" opacity="0.75"/>
    <ellipse cx="${cx + cheekDX}" cy="${cheekY}" rx="${58 * s}" ry="${36 * s}" fill="#ff9ec4" opacity="0.75"/>
    <circle cx="${lEyeX}" cy="${eyeY}" r="${eyeR}" fill="#ffffff" stroke="#5a3a12" stroke-width="${stroke}"/>
    <circle cx="${rEyeX}" cy="${eyeY}" r="${eyeR}" fill="#ffffff" stroke="#5a3a12" stroke-width="${stroke}"/>
    <circle cx="${lEyeX + 18 * s}" cy="${eyeY + 14 * s}" r="${pupR}" fill="#3a2410"/>
    <circle cx="${rEyeX - 18 * s}" cy="${eyeY + 14 * s}" r="${pupR}" fill="#3a2410"/>
    <circle cx="${lEyeX + 4 * s}" cy="${eyeY - 4 * s}" r="${16 * s}" fill="#ffffff"/>
    <circle cx="${rEyeX - 32 * s}" cy="${eyeY - 4 * s}" r="${16 * s}" fill="#ffffff"/>
    <path d="M ${cx - 62 * s} ${cy + 96 * s} Q ${cx} ${cy + 168 * s} ${cx + 62 * s} ${cy + 96 * s}"
          fill="none" stroke="#5a3a12" stroke-width="${14 * s}" stroke-linecap="round"/>
  `;
}

const skyGrad = `
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#bfe3ff"/>
    <stop offset="1" stop-color="#ffd1e8"/>
  </linearGradient>`;

async function render(svg, size, file) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(join(out, file));
  console.log('  wrote', file);
}

// icon.png - full bleed gradient + large mascot
const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>${skyGrad}</defs>
  <rect width="1024" height="1024" rx="180" fill="url(#sky)"/>
  ${mascot(512, 520, 300)}
</svg>`;

// icon-foreground.png - mascot only (transparent), pulled into the ~66% safe
// zone so Android's adaptive mask never clips it.
const iconFg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  ${mascot(512, 512, 232)}
</svg>`;

// icon-background.png - flat gradient layer behind the adaptive foreground.
const iconBg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>${skyGrad}</defs>
  <rect width="1024" height="1024" fill="url(#sky)"/>
</svg>`;

// splash - dark brand background, centered mascot + wordmark, kept well inside
// the center so @capacitor/assets can crop it to any device aspect ratio.
// Keep the mascot + wordmark inside the central ~1450px so a portrait device's
// CENTER_CROP (which only reveals the middle ~56% of the square's width) never
// clips them.
const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="2732" height="2732" viewBox="0 0 2732 2732">
  <rect width="2732" height="2732" fill="#1a1330"/>
  ${mascot(1366, 1300, 300)}
  <text x="1366" y="1760" text-anchor="middle" font-family="Fredoka, Arial, sans-serif"
        font-size="150" font-weight="700" fill="#ff8fc7" letter-spacing="2">HUGGING POP</text>
</svg>`;

console.log('[art] rendering source artwork to assets/ ...');
await render(icon, 1024, 'icon.png');
await render(iconFg, 1024, 'icon-foreground.png');
await render(iconBg, 1024, 'icon-background.png');
await render(splash, 2732, 'splash.png');
await render(splash, 2732, 'splash-dark.png');
console.log('[art] done.');
