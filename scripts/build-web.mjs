// Assembles the Capacitor web root (www/) from the existing web-game source.
// The web game itself (game.js, style.css, assets) is NEVER modified - we only
// copy it and swap the CDN Phaser tag for a locally vendored copy so the app
// runs fully offline. Run via: npm run build:web
import { existsSync, rmSync, mkdirSync, copyFileSync, cpSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(new URL('.', import.meta.url)));
const www = join(root, 'www');

// 1. Clean rebuild of www/
if (existsSync(www)) rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
mkdirSync(join(www, 'vendor'), { recursive: true });

// 2. Copy single-file web assets verbatim.
for (const f of ['game.js', 'style.css', 'manifest.json']) {
  copyFileSync(join(root, f), join(www, f));
}

// 3. Copy asset folders verbatim.
for (const d of ['sounds', 'images']) {
  cpSync(join(root, d), join(www, d), { recursive: true });
}

// 4. Vendor Phaser locally (offline-safe) instead of loading from the CDN.
copyFileSync(
  join(root, 'node_modules', 'phaser', 'dist', 'phaser.min.js'),
  join(www, 'vendor', 'phaser.min.js')
);

// 4b. Bundle the Fredoka + Caveat fonts locally (assets/fonts.css + the woff2
//     files), so the app renders identically offline with no Google Fonts call.
//     Produced by scripts/fetch-fonts.mjs.
copyFileSync(join(root, 'assets', 'fonts.css'), join(www, 'fonts.css'));
cpSync(join(root, 'assets', 'fonts'), join(www, 'fonts'), { recursive: true });

// 5. App index.html: identical shell to the web build, but Phaser is loaded
//    from the vendored file and game.js is referenced statically (no Date.now
//    cache-buster, since the WebView serves packaged files, not a live server).
const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover, interactive-widget=resizes-content" />
<meta name="theme-color" content="#1a1330" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
<meta name="apple-mobile-web-app-title" content="Hugging Pop" />
<meta name="mobile-web-app-capable" content="yes" />
<link rel="manifest" href="manifest.json" />
<title>Hugging Pop</title>
<link rel="stylesheet" href="fonts.css" />
<link rel="stylesheet" href="style.css" />
</head>
<body>
<div id="loader">
  <div class="loader-inner">
    <div class="bouncy"></div>
    <div class="loader-text">HUGGING POP</div>
  </div>
</div>
<div id="game-wrap"><div id="game"></div></div>
<script src="vendor/phaser.min.js"></script>
<script src="game.js"></script>
</body>
</html>
`;
writeFileSync(join(www, 'index.html'), indexHtml);

console.log('[build:web] www/ assembled (phaser vendored locally).');
