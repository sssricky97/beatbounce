// One-time fetch of the Fredoka + Caveat web fonts so the Android app is fully
// self-contained and renders identically offline (no Google Fonts dependency).
// Downloads the woff2 files into assets/fonts/ and writes assets/fonts.css with
// the url()s rewritten to local paths. Re-run only if the font set changes.
//   node scripts/fetch-fonts.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(new URL('.', import.meta.url)));
const fontsDir = join(root, 'assets', 'fonts');
mkdirSync(fontsDir, { recursive: true });

// Same families/weights the game's style.css uses.
const CSS_URL =
  'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Caveat:wght@600;700&display=swap';
// A modern desktop UA makes Google return woff2 (not ttf) @font-face blocks.
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

console.log('[fonts] fetching css from Google Fonts...');
const css = await (await fetch(CSS_URL, { headers: { 'User-Agent': UA } })).text();

// Match each "/* subset */ @font-face { ... }" block.
const blockRe = /\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*{([^}]*)}/g;
let out = '';
let count = 0;
const seen = new Set();
let m;
while ((m = blockRe.exec(css)) !== null) {
  const subset = m[1];
  const body = m[2];
  const family = (body.match(/font-family:\s*'([^']+)'/) || [])[1];
  const weight = (body.match(/font-weight:\s*(\d+)/) || [])[1];
  const url = (body.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+\.woff2)\)/) || [])[1];
  if (!family || !weight || !url) continue;

  const file = `${family}-${weight}-${subset}.woff2`.toLowerCase().replace(/\s+/g, '');
  if (!seen.has(file)) {
    const buf = Buffer.from(await (await fetch(url, { headers: { 'User-Agent': UA } })).arrayBuffer());
    writeFileSync(join(fontsDir, file), buf);
    seen.add(file);
    count++;
    console.log(`  saved fonts/${file} (${(buf.length / 1024).toFixed(1)} KB)`);
  }
  // Rewrite the block's url() to the local relative path.
  out += `/* ${family} ${weight} ${subset} */\n@font-face {${body.replace(/url\([^)]+\)/, `url(fonts/${file})`)}}\n\n`;
}

if (count === 0) throw new Error('No woff2 font-face blocks parsed - aborting.');
writeFileSync(join(root, 'assets', 'fonts.css'), out);
console.log(`[fonts] wrote assets/fonts.css with ${count} font files.`);
