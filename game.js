/* Beat Bounce Jump
   A funny one-button rhythm jumping game built with Phaser 3.
   No external assets: all visuals drawn procedurally,
   all audio synthesized with Web Audio API.
*/

const GAME_W = 480;
const GAME_H = 800;
const BPM = 90;
const BEAT_MS = 60000 / BPM; // ~666.67 ms
const PLAYER_X = GAME_W / 2;

// Achievement ranks: E unlocks at 500m, then every +300m bumps the rank up.
// Each entry has the unlock height in metres, the rank letter, an accent
// colour for the badge and a tagline shown under the letter.
const ACHIEVEMENTS = [
  { meters: 500,  rank: 'E', color: 0x9adf7a, hex: '#9adf7a', tag: 'NICE START!' },
  { meters: 800,  rank: 'D', color: 0x6dd0ff, hex: '#6dd0ff', tag: 'KEEP CLIMBING!' },
  { meters: 1100, rank: 'C', color: 0xffd95a, hex: '#ffd95a', tag: 'GREAT JUMPS!' },
  { meters: 1400, rank: 'B', color: 0xff9a4a, hex: '#ff9a4a', tag: 'BLAZING UP!' },
  { meters: 1700, rank: 'A', color: 0xff7aa8, hex: '#ff7aa8', tag: 'AMAZING!' },
  { meters: 2000, rank: 'S', color: 0xb582ff, hex: '#b582ff', tag: 'SUPER STAR!' }
];

const DIFFICULTY = {
  easy:   { gravity: 1700, gapMult: 0.70, rampMult: 0.45, widthMult: 1.20, driftRangeMult: 0.35, driftSpeedMult: 0.55, jumpMult: 1.05, label: 'EASY',   color: 0x9adf7a },
  medium: { gravity: 2000, gapMult: 1.00, rampMult: 1.00, widthMult: 1.00, driftRangeMult: 1.00, driftSpeedMult: 1.00, jumpMult: 1.00, label: 'MEDIUM', color: 0xffd95a },
  hard:   { gravity: 2300, gapMult: 1.18, rampMult: 1.50, widthMult: 0.85, driftRangeMult: 1.30, driftSpeedMult: 1.20, jumpMult: 0.96, label: 'HARD',   color: 0xff7aa8 }
};

const COLORS = {
  ink: 0x2a2440,
  inkHex: '#2a2440',
  yellow: 0xffd95a,
  orange: 0xff9a4a,
  pink: 0xff7aa8,
  green: 0x6ddc84,
  blue: 0x6ec2ff,
  purple: 0xb582ff,
  cream: 0xfff4d8,
  red: 0xff5a5a,
  white: 0xffffff
};

// ---------- AudioManager ----------
class AudioManager {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicGain = null;
    this.fxGain = null;
    this.musicVolume = 0.22;
    this.fxVolume = 0.6;
    this._beatLoop = null;
  }
  init() {
    if (this.ctx) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.muted ? 0 : this.musicVolume;
    this.musicGain.connect(this.ctx.destination);
    this.fxGain = this.ctx.createGain();
    this.fxGain.gain.value = this.muted ? 0 : this.fxVolume;
    this.fxGain.connect(this.ctx.destination);
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMuted(m) {
    this.muted = !!m;
    // Mirror to Phaser's sound system so loaded mp3s (e.g. the game-over clip)
    // also obey this toggle.
    try {
      if (typeof game !== 'undefined' && game && game.sound) game.sound.mute = this.muted;
    } catch (e) {}
    if (!this.ctx) return;
    // Instant cut/restore — cancel any in-flight ramps then snap the gain.
    const t = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(t);
    this.fxGain.gain.cancelScheduledValues(t);
    this.musicGain.gain.setValueAtTime(this.muted ? 0 : this.musicVolume, t);
    this.fxGain.gain.setValueAtTime(this.muted ? 0 : this.fxVolume, t);
    // When muting, also stop the rolling beat loop so no scheduled hits fire.
    if (this.muted) this.stopBeatLoop();
  }

  startBeatLoop() {
    if (!this.ctx || this.muted) return;
    this.stopBeatLoop();
    let count = 0;
    const tick = () => {
      this._kick();
      if (count % 2 === 1) this._clap();
      // off-beat hat
      window.setTimeout(() => this._hat(), BEAT_MS / 2);
      count++;
      this._beatLoop = window.setTimeout(tick, BEAT_MS);
    };
    tick();
  }
  stopBeatLoop() {
    if (this._beatLoop) clearTimeout(this._beatLoop);
    this._beatLoop = null;
  }

  _kick() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.18);
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(this.musicGain);
    o.start(t); o.stop(t + 0.34);
  }
  _clap() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.18, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 1.5);
    const n = this.ctx.createBufferSource(); n.buffer = buf;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1500; bp.Q.value = 0.6;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.32, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    n.connect(bp).connect(g).connect(this.musicGain); n.start(t);
  }
  _hat() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.04, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const n = this.ctx.createBufferSource(); n.buffer = buf;
    const hp = this.ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.14, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    n.connect(hp).connect(g).connect(this.musicGain); n.start(t);
  }

  playBoing(strength = 1) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    const g = this.ctx.createGain();
    const startF = 220 + strength * 60;
    const endF = 700 + strength * 350;
    o.frequency.setValueAtTime(startF, t);
    o.frequency.exponentialRampToValueAtTime(endF, t + 0.18);
    o.frequency.exponentialRampToValueAtTime(startF * 0.7, t + 0.32);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g).connect(this.fxGain);
    o.start(t); o.stop(t + 0.36);
  }
  playPop() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'square';
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(1600, t + 0.05);
    g.gain.setValueAtTime(0.18, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(g).connect(this.fxGain);
    o.start(t); o.stop(t + 0.14);
  }
  playLand() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(420, t);
    o.frequency.exponentialRampToValueAtTime(160, t + 0.1);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(this.fxGain);
    o.start(t); o.stop(t + 0.18);
  }
  playCheer() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    [660, 880, 1100, 1320].forEach((f, i) => {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      const start = t + i * 0.04;
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(0.18, start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.3);
      o.connect(g).connect(this.fxGain);
      o.start(start); o.stop(start + 0.32);
    });
  }
  playBuzz() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(80, t + 0.32);
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
    o.connect(g).connect(this.fxGain);
    o.start(t); o.stop(t + 0.36);
  }
  playClick() {
    if (!this.ctx || this.muted) return;
    // Schedule a hair in the future so a freshly-resumed AudioContext doesn't
    // miss the start-time. Also louder + longer so it's clearly audible.
    const t = this.ctx.currentTime + 0.04;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(900, t);
    o.frequency.exponentialRampToValueAtTime(580, t + 0.10);
    g.gain.setValueAtTime(0.55, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    o.connect(g).connect(this.fxGain);
    o.start(t); o.stop(t + 0.20);
  }
  playMetronome() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    const g = this.ctx.createGain();
    o.frequency.value = 1400;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g).connect(this.fxGain);
    o.start(t); o.stop(t + 0.06);
  }
  playFail() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    const g = this.ctx.createGain();
    o.frequency.setValueAtTime(440, t);
    o.frequency.exponentialRampToValueAtTime(200, t + 0.16);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.3);
    g.gain.setValueAtTime(0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    o.connect(g).connect(this.fxGain);
    o.start(t); o.stop(t + 0.34);
  }
  playWhoosh() {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * 0.6, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const n = this.ctx.createBufferSource(); n.buffer = buf;
    const bp = this.ctx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(2200, t + 0.5);
    bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    n.connect(bp).connect(g).connect(this.fxGain);
    n.start(t);
  }
}

const AUDIO = new AudioManager();


// ---------- Storage ----------
const STORE_KEY = 'beatbouncejump:v1';
function loadProgress() {
  const def = { bestHeight: 0, bestCombo: 0, muted: false, autoRhythm: false, autoRhythmTutorialSeen: false, lastDifficulty: 'medium', bestRank: -1 };
  try { return Object.assign(def, JSON.parse(localStorage.getItem(STORE_KEY)) || {}); }
  catch (e) { return def; }
}
function saveProgress(p) { try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) {} }

// ---------- BeatManager ----------
class BeatManager {
  constructor(scene, bpm) {
    this.scene = scene;
    this.beatMs = 60000 / bpm;
    this.startTime = 0;
    this.beatCount = 0;
    this.event = null;
    this.callbacks = [];
  }
  start() {
    this.startTime = this.scene.time.now;
    this.beatCount = 0;
    this.event = this.scene.time.addEvent({
      delay: this.beatMs,
      loop: true,
      callback: () => { this.beatCount++; this.callbacks.forEach(cb => cb(this.beatCount)); }
    });
    this.callbacks.forEach(cb => cb(0));
  }
  stop() { if (this.event) this.event.remove(); this.event = null; }
  onBeat(cb) { this.callbacks.push(cb); }
  // returns ms since the closest beat (signed)
  beatPhase() {
    const now = this.scene.time.now;
    const elapsed = now - this.startTime;
    const phase = elapsed % this.beatMs;
    return phase < this.beatMs / 2 ? phase : phase - this.beatMs;
  }
  beatProgress() {
    const now = this.scene.time.now;
    const elapsed = now - this.startTime;
    return (elapsed % this.beatMs) / this.beatMs;
  }
}

// =================================================================
// BootScene
// =================================================================
class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    // Game-over voice clip
    this.load.audio('fail', 'sounds/faaaa.mp3');
    // Long-jump voice clip (plays on a strong/charged jump)
    this.load.audio('longjump', 'sounds/uiiiiiiii.mp3');
    // Jump tone (plays on every jump)
    this.load.audio('jump', 'sounds/jump.mp3');
    // Star/note pickup clip
    this.load.audio('star', 'sounds/star.mp3');
  }
  create() {
    // Note (music note) texture
    const note = this.make.graphics({ x: 0, y: 0, add: false });
    note.lineStyle(3, COLORS.ink, 1);
    note.fillStyle(COLORS.purple, 1);
    note.fillEllipse(10, 22, 14, 11);
    note.strokeEllipse(10, 22, 14, 11);
    note.lineBetween(17, 22, 17, 4);
    note.fillStyle(COLORS.ink, 1);
    note.fillTriangle(17, 4, 27, 8, 17, 12);
    note.generateTexture('note', 32, 32);
    note.destroy();

    // Star texture
    const star = this.make.graphics({ x: 0, y: 0, add: false });
    star.lineStyle(2.5, COLORS.ink, 1);
    star.fillStyle(COLORS.yellow, 1);
    const sx = 14, sy = 14;
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5;
      const r = i % 2 === 0 ? 12 : 5;
      pts.push({ x: sx + Math.cos(a) * r, y: sy + Math.sin(a) * r });
    }
    star.beginPath();
    star.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) star.lineTo(pts[i].x, pts[i].y);
    star.closePath();
    star.fillPath();
    star.strokePath();
    star.generateTexture('star', 28, 28);
    star.destroy();

    // Sparkle
    const sp = this.make.graphics({ x: 0, y: 0, add: false });
    sp.fillStyle(0xffffff, 1);
    sp.fillCircle(6, 6, 6);
    sp.generateTexture('sparkle', 12, 12);
    sp.destroy();

    // Notebook paper line tile
    const paper = this.make.graphics({ x: 0, y: 0, add: false });
    paper.fillStyle(0xffffff, 0.0);
    paper.fillRect(0, 0, 64, 36);
    paper.lineStyle(1.2, 0x6aa8d8, 0.32);
    paper.lineBetween(0, 35, 64, 35);
    paper.generateTexture('paperline', 64, 36);
    paper.destroy();

    // Tiny dust
    const dust = this.make.graphics({ x: 0, y: 0, add: false });
    dust.fillStyle(0xffffff, 1);
    dust.fillCircle(4, 4, 4);
    dust.generateTexture('dust', 8, 8);
    dust.destroy();

    // Cloud puff (white circle for emitters)
    const puff = this.make.graphics({ x: 0, y: 0, add: false });
    puff.fillStyle(0xffffff, 1);
    puff.fillCircle(8, 8, 8);
    puff.generateTexture('puff', 16, 16);
    puff.destroy();

    // pre-generate all bubble color textures so spawning never pays the cost
    BUBBLE_PALETTE.forEach(c => ensureBubbleTexture(this, c));
    BUBBLE_PALETTE.forEach(c => ensureDiscoTileLitTexture(this, c));

    const el = document.getElementById('loader');
    if (el) el.classList.add('hidden');

    this.scene.start('Menu');
  }
}

// =================================================================
// Background helpers
// =================================================================
function makeDiscoBall(scene, x, y) {
  const c = scene.add.container(x, y);
  c.setScrollFactor(0);
  c.setDepth(-170);

  // soft outer glow that pulses (added behind everything)
  const glow = scene.add.graphics();
  glow.fillStyle(0xfff4d8, 0.28);
  glow.fillCircle(0, 0, 60);
  c.add(glow);
  scene.tweens.add({
    targets: glow, alpha: { from: 0.28, to: 0.6 },
    yoyo: true, repeat: -1, duration: 600, ease: 'Sine.easeInOut'
  });

  // hanger line going up (above ball, doesn't rotate)
  const line = scene.add.graphics();
  line.lineStyle(2, COLORS.ink, 0.55);
  line.lineBetween(0, -38, 0, -90);
  c.add(line);

  // sparkle rays around ball (rotate slowly)
  const rays = scene.add.graphics();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const x1 = Math.cos(a) * 46, y1 = Math.sin(a) * 46;
    const x2 = Math.cos(a) * 72, y2 = Math.sin(a) * 72;
    rays.lineStyle(2, 0xfff4d8, 0.85);
    rays.lineBetween(x1, y1, x2, y2);
  }
  rays.alpha = 0.7;
  c.add(rays);
  scene.tweens.add({ targets: rays, angle: 360, repeat: -1, duration: 5000 });

  // Spinning body container (rotates to give disco effect)
  const spinner = scene.add.container(0, 0);
  const body = scene.add.graphics();
  // dark outer ring (looks like the metal frame)
  body.fillStyle(0x2a2440, 1);
  body.fillCircle(0, 0, 40);
  // base silver sphere
  body.fillStyle(0xc8d0e6, 1);
  body.fillCircle(0, 0, 38);
  // colored mirror tile patches with deterministic-ish layout
  const tileColors = [0xff6bd6, 0x6dd0ff, 0xffd95a, 0xb582ff, 0x9adf7a, 0xff7aa8, 0xfff4d8];
  for (let i = 0; i < 38; i++) {
    const ang = (i * 137) % 360 * Math.PI / 180;
    const rr = ((i * 7) % 32) + 2;
    const px = Math.cos(ang) * rr;
    const py = Math.sin(ang) * rr;
    body.fillStyle(tileColors[i % tileColors.length], 0.85);
    body.fillRect(px - 3, py - 3, 6, 6);
  }
  // grid lines (latitude / longitude)
  body.lineStyle(1, 0x4a4262, 0.55);
  for (let r = -30; r <= 30; r += 8) body.lineBetween(-34, r, 34, r);
  for (let dx = -30; dx <= 30; dx += 8) body.lineBetween(dx, -34, dx, 34);
  spinner.add(body);
  c.add(spinner);
  scene.tweens.add({ targets: spinner, angle: 360, repeat: -1, duration: 4000 });

  // outline (does not rotate, so the ball edge stays solid)
  const outline = scene.add.graphics();
  outline.lineStyle(3, COLORS.ink, 1);
  outline.strokeCircle(0, 0, 38);
  c.add(outline);

  // top-left shine (does not rotate)
  const shine = scene.add.graphics();
  shine.fillStyle(0xffffff, 0.55);
  shine.fillEllipse(-14, -14, 14, 8);
  shine.fillStyle(0xffffff, 0.95);
  shine.fillCircle(-17, -17, 3);
  c.add(shine);
  scene.tweens.add({
    targets: shine, alpha: { from: 0.85, to: 1 },
    yoyo: true, repeat: -1, duration: 350, ease: 'Sine.easeInOut'
  });

  // gentle bobbing
  scene.tweens.add({ targets: c, y: y + 6, yoyo: true, repeat: -1, duration: 2400, ease: 'Sine.easeInOut' });

  return c;
}

function applyDiscoToBackground(layers, on) {
  if (!layers) return;
  if (layers.sun) layers.sun.setVisible(!on);
  if (layers.discoBall) layers.discoBall.setVisible(!!on);
}

function buildSkyBackground(scene, scrollable = true) {
  const w = scene.scale.width, h = scene.scale.height;
  const layers = {};

  // Sky gradient
  const sky = scene.add.graphics();
  const stops = [
    { y: 0,    c: 0xffd8a3 },
    { y: 0.18, c: 0xffb88a },
    { y: 0.42, c: 0xffd1c4 },
    { y: 0.65, c: 0xb8e1ff },
    { y: 1.0,  c: 0x87ceeb }
  ];
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    const y0 = a.y * h, y1 = b.y * h;
    sky.fillGradientStyle(a.c, a.c, b.c, b.c, 1);
    sky.fillRect(0, y0, w, y1 - y0);
  }
  sky.setDepth(-200);
  sky.setScrollFactor(0);
  layers.sky = sky;

  // Notebook line tile across bg
  const paper = scene.add.tileSprite(w / 2, h / 2, w + 4, h + 4, 'paperline');
  paper.setAlpha(0.5);
  paper.setScrollFactor(0);
  paper.setDepth(-180);
  layers.paper = paper;

  // Sun + disco ball share a position; one is shown at a time
  const skyAnchorX = w * 0.78, skyAnchorY = h * 0.16;

  // Smiling sun
  const sun = scene.add.container(skyAnchorX, skyAnchorY);
  sun.setScrollFactor(0);
  sun.setDepth(-170);
  const sunGfx = scene.add.graphics();
  // rays
  sunGfx.fillStyle(0xffe17a, 1);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rx = Math.cos(a) * 56, ry = Math.sin(a) * 56;
    sunGfx.fillTriangle(rx * 0.8, ry * 0.8, rx, ry, rx * 0.78 - ry * 0.08, ry * 0.78 + rx * 0.08);
  }
  // body
  sunGfx.lineStyle(3, COLORS.ink, 1);
  sunGfx.fillStyle(COLORS.yellow, 1);
  sunGfx.fillCircle(0, 0, 38);
  sunGfx.strokeCircle(0, 0, 38);
  // eyes
  sunGfx.fillStyle(COLORS.ink, 1);
  sunGfx.fillCircle(-12, -6, 4);
  sunGfx.fillCircle(12, -6, 4);
  // smile
  sunGfx.lineStyle(3, COLORS.ink, 1);
  sunGfx.beginPath();
  sunGfx.arc(0, 4, 14, Phaser.Math.DegToRad(15), Phaser.Math.DegToRad(165));
  sunGfx.strokePath();
  // cheeks
  sunGfx.fillStyle(0xff8caa, 0.7);
  sunGfx.fillCircle(-20, 6, 4);
  sunGfx.fillCircle(20, 6, 4);
  sun.add(sunGfx);
  scene.tweens.add({ targets: sun, y: sun.y + 8, yoyo: true, repeat: -1, duration: 2400, ease: 'Sine.easeInOut' });
  layers.sun = sun;

  // Disco ball (hidden by default, used in disco mode)
  layers.discoBall = makeDiscoBall(scene, skyAnchorX, skyAnchorY);
  layers.discoBall.setVisible(false);

  // Floating clouds and notes that scroll with parallax
  layers.cloudGroup = scene.add.container(0, 0);
  layers.cloudGroup.setDepth(-150);
  for (let i = 0; i < 3; i++) {
    const c = makeCloud(scene, Math.random() * w, Math.random() * h, 0.7 + Math.random() * 0.5, Math.random() < 0.5);
    layers.cloudGroup.add(c);
  }
  layers.starGroup = scene.add.container(0, 0);

  return layers;
}

function makeCloud(scene, x, y, scale, hasFace) {
  const c = scene.add.container(x, y);
  c.setScale(scale);
  const g = scene.add.graphics();
  g.lineStyle(3, COLORS.ink, 1);
  g.fillStyle(0xffffff, 1);
  // bumpy cloud
  g.fillCircle(-22, 0, 18);
  g.fillCircle(0, -8, 22);
  g.fillCircle(22, 0, 18);
  g.fillCircle(8, 8, 16);
  g.fillCircle(-10, 8, 14);
  // outline approximation
  g.strokeCircle(-22, 0, 18);
  g.strokeCircle(0, -8, 22);
  g.strokeCircle(22, 0, 18);
  g.strokeCircle(8, 8, 16);
  g.strokeCircle(-10, 8, 14);
  // re-fill to cover overlapping outlines
  g.lineStyle(0, 0, 0);
  g.fillCircle(-22, 0, 16);
  g.fillCircle(0, -8, 20);
  g.fillCircle(22, 0, 16);
  g.fillCircle(8, 8, 14);
  g.fillCircle(-10, 8, 12);
  c.add(g);

  if (hasFace) {
    const face = scene.add.graphics();
    face.fillStyle(COLORS.ink, 1);
    face.fillCircle(-8, -4, 2.5);
    face.fillCircle(8, -4, 2.5);
    face.lineStyle(2, COLORS.ink, 1);
    face.beginPath();
    face.arc(0, 2, 6, Phaser.Math.DegToRad(15), Phaser.Math.DegToRad(165));
    face.strokePath();
    face.fillStyle(0xff9eb6, 0.7);
    face.fillCircle(-14, 4, 2);
    face.fillCircle(14, 4, 2);
    c.add(face);
  }

  return c;
}

// =================================================================
// Player
// =================================================================
class Player {
  constructor(scene, x, y) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.vy = 0;
    this.gravity = 1700;
    this.onGround = false;
    this.wantsJump = false;
    this.lastPlatform = null;
    this.coyoteTime = 0;
    this.invuln = 0;
    this.dead = false;

    this.container = scene.add.container(x, y);
    this.container.setDepth(50);

    // shadow
    this.shadow = scene.add.ellipse(0, 26, 50, 14, 0x000000, 0.18);
    this.shadow.setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.container.add(this.shadow);

    // body wrapper for squash/stretch independently of charge effects
    this.body = scene.add.container(0, 0);
    this.container.add(this.body);

    // Aura ring (combo)
    this.aura = scene.add.graphics();
    this.body.add(this.aura);

    // Body graphics (redrawn each frame for face state)
    this.gfx = scene.add.graphics();
    this.body.add(this.gfx);

    // Spinning arms (disco mode mid-air pose). Drawn once; rotated as a unit.
    this.arms = scene.add.graphics();
    this.arms.alpha = 0;
    this.body.add(this.arms);
    this._drawArms();

    // Disco glasses overlay (drawn once, alpha-faded to show/hide)
    this.glasses = scene.add.graphics();
    this.glasses.alpha = 0;
    this.body.add(this.glasses);
    this._drawGlasses();

    // Disco rainbow outline (redrawn each frame when active)
    this.outlineGfx = scene.add.graphics();
    this.body.addAt(this.outlineGfx, 0); // behind body
    this.outlineColors = [0xff6bd6, 0x6dd0ff, 0xffd95a, 0x9adf7a, 0xb582ff];
    this._outlineT = 0;

    this.state = 'idle';
    this.faceMood = 'happy';
    this.chargeRatio = 0;
    this.bobPhase = 0;
    this.discoMode = false;

    this.draw();
  }

  _drawArms() {
    const g = this.arms;
    g.clear();
    const armColor = this.bodyColor || COLORS.yellow;
    // left arm: stick + mitten
    g.lineStyle(4, COLORS.ink, 1);
    g.beginPath();
    g.moveTo(-26, 4);
    g.lineTo(-44, -6);
    g.strokePath();
    g.fillStyle(armColor, 1);
    g.fillCircle(-46, -8, 5.5);
    g.lineStyle(2.5, COLORS.ink, 1);
    g.strokeCircle(-46, -8, 5.5);
    // right arm: stick + mitten
    g.lineStyle(4, COLORS.ink, 1);
    g.beginPath();
    g.moveTo(26, 4);
    g.lineTo(44, -6);
    g.strokePath();
    g.fillStyle(armColor, 1);
    g.fillCircle(46, -8, 5.5);
    g.lineStyle(2.5, COLORS.ink, 1);
    g.strokeCircle(46, -8, 5.5);
  }

  _drawGlasses() {
    const g = this.glasses;
    g.clear();
    // frame
    g.fillStyle(0x0a0a14, 1);
    g.fillRoundedRect(-23, -14, 46, 14, 6);
    // bridge
    g.lineStyle(3, 0x0a0a14, 1);
    g.lineBetween(-3, -8, 3, -8);
    // lens reflections
    g.fillStyle(0x6dd0ff, 0.95);
    g.fillRoundedRect(-20, -12, 17, 10, 4);
    g.fillRoundedRect(3, -12, 17, 10, 4);
    g.fillStyle(0xb582ff, 0.85);
    g.fillRoundedRect(-18, -6, 13, 4, 3);
    g.fillRoundedRect(5, -6, 13, 4, 3);
    // shines
    g.fillStyle(0xffffff, 1);
    g.fillRect(-16, -10, 5, 3);
    g.fillRect(7, -10, 5, 3);
  }

  setDiscoMode(on) {
    if (this.discoMode === on) return;
    this.discoMode = on;
    this.scene.tweens.add({
      targets: this.glasses,
      alpha: on ? 1 : 0,
      duration: 280,
      ease: 'Sine.easeOut'
    });
    if (!on && this.arms) {
      this.scene.tweens.killTweensOf(this.arms);
      this.arms.alpha = 0;
      this.arms.angle = 0;
    }
  }

  draw() {
    const g = this.gfx;
    g.clear();
    // body
    g.lineStyle(3.5, COLORS.ink, 1);
    g.fillStyle(this.bodyColor || COLORS.yellow, 1);
    g.fillEllipse(0, 0, 56, 56);
    g.strokeEllipse(0, 0, 56, 56);
    // belly hint
    g.fillStyle(0xfff1b8, 0.6);
    g.fillEllipse(0, 8, 30, 18);

    // legs
    g.fillStyle(COLORS.ink, 1);
    g.fillEllipse(-9, 26, 10, 8);
    g.fillEllipse(9, 26, 10, 8);

    // eyes
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-10, -6, 9);
    g.fillCircle(10, -6, 9);
    g.lineStyle(2.5, COLORS.ink, 1);
    g.strokeCircle(-10, -6, 9);
    g.strokeCircle(10, -6, 9);
    // pupils based on state
    g.fillStyle(COLORS.ink, 1);
    let pupilOffsetX = 0, pupilOffsetY = 0;
    if (this.state === 'jump') pupilOffsetY = -2;
    else if (this.state === 'fall') pupilOffsetY = 3;
    else if (this.state === 'charge') { pupilOffsetX = 0; pupilOffsetY = 1; }
    g.fillCircle(-10 + pupilOffsetX, -6 + pupilOffsetY, 4);
    g.fillCircle(10 + pupilOffsetX, -6 + pupilOffsetY, 4);

    // mouth
    g.lineStyle(3, COLORS.ink, 1);
    if (this.faceMood === 'happy') {
      g.beginPath();
      g.arc(0, 8, 8, Phaser.Math.DegToRad(15), Phaser.Math.DegToRad(165));
      g.strokePath();
    } else if (this.faceMood === 'panic') {
      // wide O
      g.fillStyle(COLORS.ink, 1);
      g.fillEllipse(0, 12, 14, 10);
    } else if (this.faceMood === 'charge') {
      // smirk
      g.beginPath();
      g.moveTo(-6, 10);
      g.lineTo(6, 10);
      g.strokePath();
    } else if (this.faceMood === 'scream') {
      g.fillStyle(COLORS.ink, 1);
      g.fillEllipse(0, 14, 18, 14);
      g.fillStyle(COLORS.red, 0.9);
      g.fillEllipse(0, 18, 8, 6);
    } else if (this.faceMood === 'wow') {
      // small o
      g.fillStyle(COLORS.ink, 1);
      g.fillEllipse(0, 12, 8, 8);
    }

    // cheeks
    g.fillStyle(0xff9eb6, 0.85);
    g.fillCircle(-20, 6, 3);
    g.fillCircle(20, 6, 3);
  }

  drawAura(combo) {
    const g = this.aura;
    g.clear();
    if (combo < 5) return;
    let color = 0xffd95a;
    let alpha = 0.45;
    let radius = 36;
    if (combo >= 20) { color = 0xff7aa8; alpha = 0.7; radius = 48; }
    else if (combo >= 10) { color = 0x9ad4ff; alpha = 0.55; radius = 42; }
    else if (combo >= 5) { color = 0xffd95a; alpha = 0.4; radius = 36; }
    g.lineStyle(4, color, alpha);
    g.strokeCircle(0, 0, radius);
    g.lineStyle(2, color, alpha * 0.6);
    g.strokeCircle(0, 0, radius + 6);
  }

  setState(s) {
    if (this.state === s) return;
    this.state = s;
    if (s === 'idle') this.faceMood = 'happy';
    else if (s === 'charge') this.faceMood = 'charge';
    else if (s === 'jump') this.faceMood = 'wow';
    else if (s === 'fall') this.faceMood = 'panic';
    this.draw();
  }

  setMood(m) {
    if (this.faceMood === m) return;
    this.faceMood = m;
    this.draw();
  }

  squash(amount) {
    this.scene.tweens.killTweensOf(this.body);
    this.body.angle = 0;
    this.body.scaleX = 1 + amount;
    this.body.scaleY = 1 - amount;
    this.scene.tweens.add({
      targets: this.body,
      scaleX: 1, scaleY: 1,
      duration: 240,
      ease: 'Back.easeOut'
    });
    if (this.arms) {
      this.scene.tweens.killTweensOf(this.arms);
      this.scene.tweens.add({
        targets: this.arms,
        alpha: 0, angle: 0,
        duration: 160,
        ease: 'Sine.easeOut'
      });
    }
  }

  stretch(amount) {
    this.scene.tweens.killTweensOf(this.body);
    this.body.angle = 0;
    this.body.scaleX = 1 - amount;
    this.body.scaleY = 1 + amount;
    this.scene.tweens.add({
      targets: this.body,
      scaleX: 1, scaleY: 1,
      duration: 320,
      ease: 'Sine.easeOut'
    });
  }

  startCharge() {
    this.setState('charge');
  }

  performJump(strength, onBeat) {
    // strength: 0..1. Floor is high enough that even a quick tap clears the
    // largest typical gap on any difficulty (snappy jump-game feel).
    const baseVy = -920;
    const maxVy = -1420;
    let vy = Phaser.Math.Linear(baseVy, maxVy, Phaser.Math.Clamp(strength, 0, 1));
    if (onBeat) vy *= 1.18;
    const diffKey = this.scene.difficulty;
    if (diffKey && DIFFICULTY[diffKey]) vy *= DIFFICULTY[diffKey].jumpMult;
    this.vy = vy;
    this.onGround = false;
    this.coyoteTime = 0;
    this.setState('jump');
    this.stretch(0.2 + strength * 0.15);
    if (this.discoMode && this.arms) {
      // Body stays round; only arms swing around it like a dancer mid-pirouette.
      this.scene.tweens.killTweensOf(this.arms);
      const dir = (Math.random() < 0.5) ? 1 : -1;
      this.arms.angle = 0;
      this.arms.alpha = 1;
      this.scene.tweens.add({
        targets: this.arms,
        angle: 720 * dir,
        duration: 720,
        ease: 'Cubic.easeOut'
      });
    }
  }

  hurt() {
    if (this.invuln > 0) return false;
    this.invuln = 1500;
    this.setMood('scream');
    this.scene.tweens.add({
      targets: this.body, alpha: { from: 1, to: 0.3 },
      yoyo: true, repeat: 5, duration: 120
    });
    return true;
  }

  update(_t, dtMs) {
    if (this.dead) return;
    const dt = dtMs / 1000;
    this.bobPhase += dt;
    this.invuln = Math.max(0, this.invuln - dtMs);

    // physics
    this.vy += this.gravity * dt;
    this.vy = Math.min(this.vy, 1500);
    this.y += this.vy * dt;

    // coyote tick
    if (!this.onGround) this.coyoteTime += dtMs;

    // sync container
    this.container.x = this.x;
    this.container.y = this.y;

    if (this.state === 'charge') {
      this.body.x = (Math.random() - 0.5) * 1.4;
      this.body.y = (Math.random() - 0.5) * 1.4;
    } else if (this.onGround) {
      this.body.x = 0;
      this.body.y = Math.sin(this.bobPhase * 5) * 1.2;
    } else {
      this.body.x = 0;
      this.body.y = 0;
    }

    // disco outline pulse
    if (this.discoMode) {
      this._outlineT += dt;
      const og = this.outlineGfx;
      og.clear();
      const colorIdx = Math.floor(this._outlineT * 4) % this.outlineColors.length;
      const c = this.outlineColors[colorIdx];
      const pulse = (Math.sin(this._outlineT * 6) + 1) / 2;
      const r = 32 + pulse * 4;
      og.lineStyle(4, c, 0.85);
      og.strokeCircle(0, 0, r);
      og.lineStyle(2, c, 0.4);
      og.strokeCircle(0, 0, r + 5);
    } else if (this.outlineGfx && this._outlineT !== 0) {
      this.outlineGfx.clear();
      this._outlineT = 0;
    }

    // face state by velocity
    if (this.state !== 'charge') {
      if (this.vy > 220) {
        this.setState('fall');
      } else if (this.vy < -120) {
        this.setState('jump');
      }
    }
  }
}

// =================================================================
// Platforms
// =================================================================
const PLATFORM_TYPES = ['pencil', 'burger', 'drum', 'banana', 'cloud', 'fake'];

const BUBBLE_PALETTE = [0xff6b9d, 0x6ec2ff, 0xffd95a, 0x9adf7a, 0xb582ff, 0xff9a4a, 0x6deeda, 0xff7aa8];

const BUBBLE_TEX_W = 140;
const BUBBLE_TEX_H = 120;
const BUBBLE_TEX_TOP = 12; // y offset from top of texture where the bubble's top edge sits

function ensureBubbleTexture(scene, color) {
  const key = 'bubble_' + color.toString(16);
  if (scene.textures.exists(key)) return key;
  const W = BUBBLE_TEX_W, H = BUBBLE_TEX_H;
  const cx = W / 2, cy = H / 2 + 4;
  const w = W - 8, ovalH = H - 16;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // simple, fast bubble: solid translucent body + outline + single shine
  g.fillStyle(color, 0.55);
  g.fillEllipse(cx, cy, w, ovalH);
  g.lineStyle(3, 0x2a2440, 1);
  g.strokeEllipse(cx, cy, w, ovalH);
  g.fillStyle(0xffffff, 0.95);
  g.fillEllipse(cx - w * 0.25, cy - ovalH * 0.27, w * 0.18, ovalH * 0.13);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(cx - w * 0.32, cy - ovalH * 0.3, 2.5);

  g.generateTexture(key, W, H);
  g.destroy();
  return key;
}

// Disco-floor tile (idle): glossy, semi-transparent glass panel with subtle
// LED dots and a glassy sheen on top. Drawn into the same texture canvas as
// the bubble (same W/H/TOP) so swapping at runtime preserves origin and scale.
function ensureDiscoTileTexture(scene, color) {
  const key = 'discotile_' + color.toString(16);
  if (scene.textures.exists(key)) return key;
  const W = BUBBLE_TEX_W, H = BUBBLE_TEX_H;
  const top = BUBBLE_TEX_TOP;
  const padX = 8;
  const tileH = 58;
  const tileW = W - padX * 2;
  const x = padX;
  const y = top;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // very faint tinted halo so the glass isn't invisible against the sky
  g.fillStyle(color, 0.05);
  g.fillEllipse(x + tileW / 2, y + tileH / 2, tileW + 18, tileH + 14);

  // single sheet of clear glass, slightly tinted
  g.fillStyle(0xffffff, 0.13);
  g.fillRoundedRect(x, y, tileW, tileH, 14);

  // glossy reflection across the upper half (gives the wet-floor look)
  g.fillStyle(0xffffff, 0.40);
  g.fillRoundedRect(x + 6, y + 4, tileW - 12, 8, 4);
  // subtle secondary reflection lower down
  g.fillStyle(0xffffff, 0.18);
  g.fillRoundedRect(x + 16, y + tileH * 0.55, tileW - 32, 4, 2);

  // top-edge highlight (the surface where the player lands)
  g.fillStyle(0xffffff, 0.65);
  g.fillRoundedRect(x + 4, y, tileW - 8, 2, 1);

  // soft glass outline (no battery-style segmentation, no dots)
  g.lineStyle(1.5, 0xffffff, 0.55);
  g.strokeRoundedRect(x, y, tileW, tileH, 14);
  g.lineStyle(1, color, 0.40);
  g.strokeRoundedRect(x + 1, y + 1, tileW - 2, tileH - 2, 13);

  g.generateTexture(key, W, H);
  g.destroy();
  return key;
}

// Disco-floor lit pill: a horizontal glowing tube. Rendered as a near-white
// base with luminance variation only — the actual color is applied at runtime
// via 4-corner tints that shift over time, producing the smooth multi-color
// gradient that flows across the tube.
function ensureDiscoTileLitTexture(scene, _color) {
  const key = 'discotile_lit_pill';
  if (scene.textures.exists(key)) return key;
  const W = BUBBLE_TEX_W, H = BUBBLE_TEX_H;
  const top = BUBBLE_TEX_TOP;

  const padX = 6;
  const tubeH = 26;
  const tubeW = W - padX * 2;
  const x = padX;
  const y = top;
  const r = tubeH / 2;  // pill shape: corner radius = half height

  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  // Just the bar itself — no halo, no shadow box. Anything outside the pill
  // shape stays fully transparent so there's no rectangular backdrop.

  // Main pill body (white base — tinted at runtime)
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(x, y, tubeW, tubeH, r);

  // Brighter upper half for the "lit from inside" pop after tinting
  g.fillStyle(0xffffff, 0.55);
  g.fillRoundedRect(x + 2, y + 2, tubeW - 4, Math.round(tubeH * 0.55), r * 0.8);

  // Hot top stripe (the glossy reflection along the surface)
  g.fillStyle(0xffffff, 0.95);
  g.fillRoundedRect(x + 8, y + 1, tubeW - 16, 2, 1);

  g.generateTexture(key, W, H);
  g.destroy();
  return key;
}

// HSV → 24-bit RGB hex int. Used to compute smoothly cycling neon colors for
// per-platform 4-corner tint animation in disco mode.
function hsvHex(h, s, v) {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6);
  const f = h * 6 - i;
  const p = v * (1 - s);
  const q = v * (1 - f * s);
  const t = v * (1 - (1 - f) * s);
  let R, G, B;
  switch (i % 6) {
    case 0: R = v; G = t; B = p; break;
    case 1: R = q; G = v; B = p; break;
    case 2: R = p; G = v; B = t; break;
    case 3: R = p; G = q; B = v; break;
    case 4: R = t; G = p; B = v; break;
    default: R = v; G = p; B = q; break;
  }
  return ((R * 255) & 0xff) << 16 | ((G * 255) & 0xff) << 8 | ((B * 255) & 0xff);
}

class Platform {
  constructor(scene, x, y, type, width = 110) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.type = type;
    this.width = width;
    this.height = 26;
    this.alive = true;
    this.broken = false;
    this.consumed = false;
    this.movingDir = 0;
    this.moveRange = 0;
    this.moveSpeed = 0;
    this.originX = x;
    this.bounceMul = 1.0;
    this.moveTime = Math.random() * 6;
    this.moveOmega = 0;
    if (type === 'pencil') {
      this._bubbleColor = BUBBLE_PALETTE[Math.floor(Math.random() * BUBBLE_PALETTE.length)];
      // every balloon drifts horizontally, scaled by elapsed time AND difficulty
      const elapsed = (scene.time.now - scene.gameStartTime) / 1000;
      const diffKey = (scene.difficulty && DIFFICULTY[scene.difficulty]) ? scene.difficulty : 'medium';
      const dRange = DIFFICULTY[diffKey].driftRangeMult;
      const dSpeed = DIFFICULTY[diffKey].driftSpeedMult;
      this.moveRange = (60 + Math.min(elapsed * 0.6, 50)) * dRange;
      const basePeriod = 4.5 - Math.min(elapsed * 0.02, 2.0);
      const period = basePeriod / Math.max(0.1, dSpeed);
      this.moveOmega = (Math.PI * 2) / period;
      this.movingDir = 1;
      if (Math.random() < 0.5) this.moveTime += period / 2;
    } else if (type !== 'fake' && type !== 'cloud' && Math.random() < 0.18 && y < -300) {
      this.movingDir = Math.random() < 0.5 ? 1 : -1;
      this.moveRange = 80 + Math.random() * 60;
      this.moveSpeed = 40 + Math.random() * 40;
    }

    this.container = scene.add.container(x, y);
    this.container.setDepth(20);
    this.gfx = scene.add.graphics();
    this.container.add(this.gfx);
    if (type === 'pencil') {
      const useDisco = !!scene.discoMode;
      // In disco mode every tile uses the glowing pill texture so the floor
      // stays lit permanently. The non-disco state still uses bubbles.
      const key = useDisco
        ? ensureDiscoTileLitTexture(scene, this._bubbleColor)
        : ensureBubbleTexture(scene, this._bubbleColor);
      this.bubbleImg = scene.add.image(0, -this.height / 2, key);
      this.bubbleImg.setOrigin(0.5, BUBBLE_TEX_TOP / BUBBLE_TEX_H);
      this.bubbleImg.setScale(this.width / BUBBLE_TEX_W);
      this.container.add(this.bubbleImg);
      this._discoPhase = Math.random() * Math.PI * 2;
    }
    this.draw();
  }

  applyDiscoStyle(on) {
    if (this.type !== 'pencil' || !this.bubbleImg || !this.bubbleImg.scene) return;
    const tw = this.scene.tweens;
    tw.killTweensOf(this.bubbleImg);
    const baseScale = this.width / BUBBLE_TEX_W;
    this.bubbleImg.setScale(baseScale);
    if (on) {
      this.bubbleImg.setTexture(ensureDiscoTileLitTexture(this.scene, 0));
      // Per-platform phase so colors travel along the floor like a wave
      if (this._discoPhase === undefined) {
        this._discoPhase = Math.random() * Math.PI * 2;
      }
    } else {
      this.bubbleImg.setTexture(ensureBubbleTexture(this.scene, this._bubbleColor));
      if (this.bubbleImg.clearTint) this.bubbleImg.clearTint();
    }
  }

  // Jump-off feedback: quick scale pulse + sparkle burst so the player feels
  // they kicked off the floor. The tile itself is already glowing so we
  // exaggerate it briefly instead of swapping textures.
  flashDisco() {
    if (this.type !== 'pencil' || !this.bubbleImg || !this.bubbleImg.scene) return;
    if (!this.scene.discoMode) return;
    const tw = this.scene.tweens;
    tw.killTweensOf(this.bubbleImg);
    const baseScale = this.width / BUBBLE_TEX_W;
    this.bubbleImg.setScale(baseScale);
    // Springy squash: horizontal stretch, vertical squash, then snap back.
    tw.add({
      targets: this.bubbleImg,
      scaleX: baseScale * 1.18,
      scaleY: baseScale * 0.82,
      duration: 110,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        if (this.bubbleImg && this.bubbleImg.scene) this.bubbleImg.setScale(baseScale);
      }
    });
    // Sparkle pop above the tile
    if (this.scene.sparkles) {
      this.scene.sparkles.explode(10, this.container.x, this.container.y - 12);
    }
  }

  draw() {
    const g = this.gfx;
    g.clear();
    g.lineStyle(3, COLORS.ink, 1);
    const w = this.width, h = this.height;
    if (this.type === 'pencil') {
      // bubble drawn via cached texture (added in constructor); nothing to do here
    } else if (this.type === 'burger') {
      // bottom bun
      g.fillStyle(0xe9a866, 1);
      g.fillRoundedRect(-w / 2, 0, w, 12, 6);
      g.strokeRoundedRect(-w / 2, 0, w, 12, 6);
      // patty
      g.fillStyle(0x6b3a2a, 1);
      g.fillRect(-w / 2 + 4, -3, w - 8, 6);
      g.strokeRect(-w / 2 + 4, -3, w - 8, 6);
      // lettuce
      g.fillStyle(COLORS.green, 1);
      for (let i = -w / 2 + 4; i < w / 2 - 4; i += 8) {
        g.fillTriangle(i, -3, i + 4, -10, i + 8, -3);
        g.strokeTriangle(i, -3, i + 4, -10, i + 8, -3);
      }
      // top bun
      g.fillStyle(0xf2c78a, 1);
      g.beginPath();
      g.arc(0, -10, w / 2 - 2, Math.PI, Math.PI * 2);
      g.lineTo(w / 2 - 2, -10);
      g.lineTo(-w / 2 + 2, -10);
      g.closePath();
      g.fillPath(); g.strokePath();
      // sesame
      g.fillStyle(0xffe7a8, 1);
      [-12, 0, 14].forEach(sx => g.fillCircle(sx, -16, 2));
    } else if (this.type === 'drum') {
      g.fillStyle(0xff6b6b, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 4);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);
      // top oval
      g.fillStyle(0xffeacc, 1);
      g.fillEllipse(0, -h / 2, w, 10);
      g.strokeEllipse(0, -h / 2, w, 10);
      // tension lines
      g.lineStyle(2, COLORS.ink, 1);
      for (let i = -w / 2 + 10; i <= w / 2 - 10; i += 18) {
        g.lineBetween(i, -h / 2, i, h / 2);
      }
    } else if (this.type === 'banana') {
      g.fillStyle(COLORS.yellow, 1);
      g.beginPath();
      g.moveTo(-w / 2, 4);
      g.bezierCurveTo(-w / 4, -26, w / 4, -26, w / 2, 4);
      g.bezierCurveTo(w / 4, 18, -w / 4, 18, -w / 2, 4);
      g.closePath();
      g.fillPath(); g.strokePath();
      // peel ends
      g.fillStyle(0xa67a2a, 1);
      g.fillEllipse(-w / 2 + 4, 4, 8, 6);
      g.fillEllipse(w / 2 - 4, 4, 8, 6);
    } else if (this.type === 'cloud') {
      g.fillStyle(0xffffff, 1);
      g.fillCircle(-w / 4, 0, h * 0.9);
      g.fillCircle(0, -4, h);
      g.fillCircle(w / 4, 0, h * 0.9);
      g.fillCircle(-w / 5, 6, h * 0.7);
      g.fillCircle(w / 5, 6, h * 0.7);
      // outline approximation
      g.strokeCircle(-w / 4, 0, h * 0.9);
      g.strokeCircle(0, -4, h);
      g.strokeCircle(w / 4, 0, h * 0.9);
    } else if (this.type === 'fake') {
      // looks like a real platform but with a wobbly weird color
      g.fillStyle(0xd4c5e8, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
      // crack lines
      g.lineStyle(2, COLORS.ink, 0.5);
      g.lineBetween(-w / 4, -h / 4, -w / 6, h / 4);
      g.lineBetween(w / 6, -h / 4, w / 3, h / 4);
    }
  }

  bounceMultiplier() {
    if (this.type === 'drum') return 1.0; // beat-bonus handled externally
    if (this.type === 'cloud') return 0.85;
    if (this.type === 'banana') return 0.85;
    if (this.type === 'burger') return 0.7;
    if (this.type === 'pencil') return 1.0;
    return 1.0;
  }

  onLand(player, scene) {
    // handle special effects
    if (this.type === 'cloud') {
      // collapses after one bounce
      this.consumed = true;
      scene.time.delayedCall(40, () => this.breakAway(scene));
    } else if (this.type === 'fake') {
      this.consumed = true;
      this.breakAway(scene);
    } else if (this.type === 'banana') {
      // nudge player visually
      scene.cameras.main.shake(80, 0.003);
    }
  }

  breakAway(scene) {
    if (this.broken) return;
    this.broken = true;
    this.alive = false;
    // particles
    scene.cloudPuffs.explode(8, this.container.x, this.container.y);
    scene.tweens.add({
      targets: this.container,
      angle: Phaser.Math.Between(-25, 25),
      y: this.container.y + 80,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.easeIn',
      onComplete: () => this.container.destroy()
    });
  }

  update(_t, dtMs, beatProgress) {
    if (!this.alive) return;
    if (this.moveOmega > 0) {
      this.moveTime += dtMs / 1000;
      this.x = this.originX + Math.sin(this.moveTime * this.moveOmega) * this.moveRange;
      this.container.x = this.x;
    } else if (this.movingDir !== 0) {
      this.x += this.movingDir * this.moveSpeed * (dtMs / 1000);
      if (this.x > this.originX + this.moveRange) { this.x = this.originX + this.moveRange; this.movingDir = -1; }
      else if (this.x < this.originX - this.moveRange) { this.x = this.originX - this.moveRange; this.movingDir = 1; }
      this.container.x = this.x;
    }
    // beat pulse for drums
    if (this.type === 'drum') {
      const pulse = 1 + Math.sin(beatProgress * Math.PI) * 0.06;
      this.container.scaleY = pulse;
    } else if (this.type === 'cloud') {
      this.container.scaleY = 1 + Math.sin(beatProgress * Math.PI * 2) * 0.04;
    } else {
      // tiny wiggle on beat
      this.container.scaleX = 1 + Math.sin(beatProgress * Math.PI * 2) * 0.02;
    }
  }
}

// =================================================================
// PlatformManager
// =================================================================
class PlatformManager {
  constructor(scene, difficulty) {
    this.scene = scene;
    this.difficulty = (difficulty && DIFFICULTY[difficulty]) ? difficulty : 'medium';
    this.platforms = [];
    this.notes = [];
    this.obstacles = [];
    this.powerups = [];
    this.highestY = 0;       // smallest y (most negative going up)
    this.lastPlatformX = PLAYER_X;
    const gm = DIFFICULTY[this.difficulty].gapMult;
    this.gapSpec = { min: Math.round(80 * gm), max: Math.round(120 * gm) };
    this.fakeChance = 0.0;
  }

  spawnInitial(startY) {
    // initial wide platform under the player
    this.add(new Platform(this.scene, PLAYER_X, startY, 'pencil', 200));
    let y = startY - 110;
    for (let i = 0; i < 10; i++) {
      this.spawnNextRow(y);
      y -= Phaser.Math.Between(this.gapSpec.min, this.gapSpec.max);
    }
    this.highestY = y;
  }

  add(p) { this.platforms.push(p); }

  spawnNextRow(y) {
    if (this.platforms.length >= 18) return null;
    const elapsed = (this.scene.time.now - this.scene.gameStartTime) / 1000;
    // SAFE-MODE: only bubbles for stability. Variations re-enabled once stable.
    let type = 'pencil';

    const wm = (DIFFICULTY[this.difficulty] || DIFFICULTY.medium).widthMult;
    const minWidth = Math.round(((type === 'cloud' || type === 'fake') ? 90 : 100) * wm);
    const maxWidth = Math.round(((type === 'pencil') ? 130 : 130) * wm);
    const w = Phaser.Math.Between(minWidth, maxWidth);
    let x;
    if (type === 'pencil') {
      // moving balloons swing symmetrically around the player column
      x = PLAYER_X;
    } else {
      const minX = PLAYER_X - (w / 2 - 24);
      const maxX = PLAYER_X + (w / 2 - 24);
      x = Phaser.Math.Between(minX, maxX);
    }
    const p = new Platform(this.scene, x, y, type, w);
    this.add(p);

    // SAFE-MODE: notes only, no obstacles or powerups
    if (this.notes.length < 6 && Math.random() < 0.35) {
      const nx = Phaser.Math.Between(PLAYER_X - 80, PLAYER_X + 80);
      const ny = y - Phaser.Math.Between(36, 56);
      this.spawnNote(nx, ny);
    }
    return p;
  }

  spawnNote(x, y) {
    const c = this.scene.add.container(x, y);
    c.setDepth(15);
    const img = this.scene.add.image(0, 0, 'note').setScale(1);
    c.add(img);
    this.scene.tweens.add({
      targets: c, y: y - 6, yoyo: true, repeat: -1, duration: 700, ease: 'Sine.easeInOut'
    });
    this.scene.tweens.add({
      targets: img, angle: { from: -10, to: 10 }, yoyo: true, repeat: -1, duration: 500, ease: 'Sine.easeInOut'
    });
    this.notes.push({ container: c, x, y, alive: true });
  }

  spawnObstacle(y) {
    const fromLeft = Math.random() < 0.5;
    const c = this.scene.add.container(fromLeft ? -40 : GAME_W + 40, y);
    c.setDepth(40);
    const cloud = makeCloud(this.scene, 0, 0, 0.9, false);
    c.add(cloud);
    // angry face
    const face = this.scene.add.graphics();
    face.fillStyle(COLORS.ink, 1);
    face.fillCircle(-7, -4, 2.5);
    face.fillCircle(7, -4, 2.5);
    face.lineStyle(2.2, COLORS.ink, 1);
    face.beginPath();
    face.moveTo(-12, -10);
    face.lineTo(-3, -6);
    face.moveTo(12, -10);
    face.lineTo(3, -6);
    face.strokePath();
    // frown
    face.beginPath();
    face.arc(0, 8, 6, Phaser.Math.DegToRad(195), Phaser.Math.DegToRad(345));
    face.strokePath();
    c.add(face);
    const dir = fromLeft ? 1 : -1;
    const speed = 70 + Math.random() * 60;
    this.obstacles.push({ container: c, vx: speed * dir, alive: true });
  }

  spawnPowerup(x, y, kind) {
    const c = this.scene.add.container(x, y);
    c.setDepth(35);
    const g = this.scene.add.graphics();
    if (kind === 'rocket') {
      // rocket hat
      g.lineStyle(3, COLORS.ink, 1);
      g.fillStyle(0xff7a6a, 1);
      g.fillTriangle(-12, 6, 12, 6, 0, -22);
      g.strokeTriangle(-12, 6, 12, 6, 0, -22);
      g.fillStyle(0xffd95a, 1);
      g.fillCircle(0, -10, 4);
      g.lineStyle(3, COLORS.ink, 1);
      g.strokeCircle(0, -10, 4);
      // flame
      g.fillStyle(COLORS.orange, 1);
      g.fillTriangle(-6, 8, 6, 8, 0, 18);
      g.strokeTriangle(-6, 8, 6, 8, 0, 18);
    } else {
      // slow time clock
      g.lineStyle(3, COLORS.ink, 1);
      g.fillStyle(0x9ad4ff, 1);
      g.fillCircle(0, 0, 14);
      g.strokeCircle(0, 0, 14);
      g.lineStyle(2.5, COLORS.ink, 1);
      g.lineBetween(0, 0, 0, -10);
      g.lineBetween(0, 0, 8, 4);
    }
    c.add(g);
    this.scene.tweens.add({
      targets: c, y: y - 8, yoyo: true, repeat: -1, duration: 800, ease: 'Sine.easeInOut'
    });
    this.scene.tweens.add({
      targets: c, angle: 360, repeat: -1, duration: 4000
    });
    this.powerups.push({ container: c, kind, alive: true });
  }

  // call when player climbs higher
  ensureContent(playerY) {
    while (this.highestY > playerY - GAME_H * 1.5) {
      const gap = Phaser.Math.Between(this.gapSpec.min, this.gapSpec.max);
      this.highestY -= gap;
      this.spawnNextRow(this.highestY);
    }
  }

  cleanup(camTopY) {
    const cutoff = camTopY + GAME_H + 200;
    const tw = this.scene.tweens;
    this.platforms = this.platforms.filter(p => {
      if (p.container.y > cutoff || !p.container.scene) {
        if (p.container.scene) {
          tw.killTweensOf(p.container);
          if (p.bubbleImg) tw.killTweensOf(p.bubbleImg);
          if (p._discoFlashEvt) { p._discoFlashEvt.remove(false); p._discoFlashEvt = null; }
          p.container.destroy();
        }
        return false;
      }
      return true;
    });
    this.notes = this.notes.filter(n => {
      if (n.container.y > cutoff || !n.alive) {
        if (n.container.scene) {
          tw.killTweensOf(n.container);
          n.container.list.forEach(child => tw.killTweensOf(child));
          n.container.destroy();
        }
        return false;
      }
      return true;
    });
    this.obstacles = this.obstacles.filter(o => {
      if (o.container.y > cutoff || !o.alive || o.container.x < -100 || o.container.x > GAME_W + 100) {
        if (o.container.scene) {
          tw.killTweensOf(o.container);
          o.container.destroy();
        }
        return false;
      }
      return true;
    });
    this.powerups = this.powerups.filter(p => {
      if (p.container.y > cutoff || !p.alive) {
        if (p.container.scene) {
          tw.killTweensOf(p.container);
          p.container.destroy();
        }
        return false;
      }
      return true;
    });
  }

  setDiscoStyle(on) {
    this.platforms.forEach(p => { try { p.applyDiscoStyle && p.applyDiscoStyle(on); } catch (e) {} });
  }

  setDifficulty(elapsed) {
    const d = DIFFICULTY[this.difficulty] || DIFFICULTY.medium;
    const e = elapsed * d.rampMult;
    let base, fake;
    if (e < 15)      { base = { min: 70,  max: 100 }; fake = 0.0; }
    else if (e < 35) { base = { min: 80,  max: 115 }; fake = 0.05; }
    else if (e < 65) { base = { min: 90,  max: 130 }; fake = 0.08; }
    else             { base = { min: 100, max: 145 }; fake = 0.12; }
    this.gapSpec = {
      min: Math.round(base.min * d.gapMult),
      max: Math.round(base.max * d.gapMult)
    };
    this.fakeChance = fake;
  }
}

// =================================================================
// MenuScene
// =================================================================
class DifficultyScene extends Phaser.Scene {
  constructor() { super('Difficulty'); }
  create() {
    const w = this.scale.width, h = this.scale.height;
    const bg = buildSkyBackground(this);
    applyDiscoToBackground(bg, !!loadProgress().autoRhythm);
    this.cameras.main.fadeIn(280, 255, 245, 220);

    // dim panel
    this.add.rectangle(w / 2, h / 2, w, h, 0x2a2440, 0.18).setDepth(0);

    const title = this.add.text(w / 2, h * 0.18, 'CHOOSE\nDIFFICULTY', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '52px',
      color: '#2a2440',
      fontStyle: '700',
      align: 'center',
      lineSpacing: -6
    }).setOrigin(0.5).setDepth(10);
    title.setStroke('#fff4d8', 8);
    title.setShadow(0, 5, '#0c0a18', 0, false, true);
    this.tweens.add({
      targets: title, y: title.y - 5, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut'
    });

    const last = (loadProgress().lastDifficulty) || 'medium';

    const opts = [
      { key: 'easy',   y: h * 0.40, blurb: 'small gaps, gentle gravity' },
      { key: 'medium', y: h * 0.56, blurb: 'classic balance' },
      { key: 'hard',   y: h * 0.72, blurb: 'big gaps, fast ramp' }
    ];
    opts.forEach(o => {
      const d = DIFFICULTY[o.key];
      const isLast = (o.key === last);
      this._mkDiffButton(w / 2, o.y, d.label, d.color, o.blurb, isLast, () => {
        AUDIO.playClick();
        const p = loadProgress(); p.lastDifficulty = o.key; saveProgress(p);
        this.cameras.main.fadeOut(260, 255, 245, 220);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { difficulty: o.key }));
      });
    });

    // BACK to menu
    this._mkBackButton(w / 2, h * 0.90, 'BACK', () => {
      AUDIO.playClick();
      this.cameras.main.fadeOut(220, 255, 245, 220);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
    });

    // ESC also goes back
    this.input.keyboard.once('keydown-ESC', () => this.scene.start('Menu'));
  }

  _mkDiffButton(x, y, label, color, blurb, highlight, onClick) {
    const bw = 280, bh = 70;
    const c = this.add.container(x, y).setDepth(20);
    const bg = this.add.graphics();
    const draw = (offset = 0) => {
      bg.clear();
      bg.fillStyle(COLORS.ink, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2 + 6 - offset, bw, bh, 16);
      bg.fillStyle(color, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2 - offset, bw, bh, 16);
      bg.lineStyle(highlight ? 4 : 3, COLORS.ink, 1);
      bg.strokeRoundedRect(-bw / 2, -bh / 2 - offset, bw, bh, 16);
      if (highlight) {
        bg.lineStyle(2, 0xffffff, 0.85);
        bg.strokeRoundedRect(-bw / 2 + 6, -bh / 2 - offset + 6, bw - 12, bh - 12, 12);
      }
    };
    draw();
    c.add(bg);
    const txt = this.add.text(0, -10, label, {
      fontFamily: 'Fredoka, sans-serif', fontSize: '28px',
      color: '#2a2440', fontStyle: '700'
    }).setOrigin(0.5);
    c.add(txt);
    const sub = this.add.text(0, 16, blurb, {
      fontFamily: 'Fredoka, sans-serif', fontSize: '12px',
      color: '#2a2440', fontStyle: '600'
    }).setOrigin(0.5).setAlpha(0.85);
    c.add(sub);
    if (highlight) {
      const tag = this.add.text(bw / 2 - 10, -bh / 2 + 10, 'LAST', {
        fontFamily: 'Fredoka, sans-serif', fontSize: '10px',
        color: '#2a2440', fontStyle: '700'
      }).setOrigin(1, 0);
      c.add(tag);
    }
    const hit = this.add.zone(0, 0, bw, bh + 12).setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerover', () => { draw(2); this.tweens.add({ targets: c, scale: 1.04, duration: 120 }); });
    hit.on('pointerout',  () => { draw(0); this.tweens.add({ targets: c, scale: 1.0,  duration: 120 }); });
    hit.on('pointerdown', () => { draw(-3); txt.y = -9; sub.y = 17; });
    hit.on('pointerup',   () => { draw(0); txt.y = -10; sub.y = 16; onClick(); });
    return c;
  }

  _mkBackButton(x, y, label, onClick) {
    const bw = 140, bh = 40;
    const c = this.add.container(x, y).setDepth(20);
    const bg = this.add.graphics();
    const draw = (offset = 0) => {
      bg.clear();
      bg.fillStyle(COLORS.ink, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2 + 4 - offset, bw, bh, 10);
      bg.fillStyle(0xb8e1ff, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2 - offset, bw, bh, 10);
      bg.lineStyle(3, COLORS.ink, 1);
      bg.strokeRoundedRect(-bw / 2, -bh / 2 - offset, bw, bh, 10);
    };
    draw();
    c.add(bg);
    const txt = this.add.text(0, 0, label, {
      fontFamily: 'Fredoka, sans-serif', fontSize: '16px',
      color: '#2a2440', fontStyle: '700'
    }).setOrigin(0.5);
    c.add(txt);
    const hit = this.add.zone(0, 0, bw, bh + 10).setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerover', () => { draw(2); this.tweens.add({ targets: c, scale: 1.04, duration: 120 }); });
    hit.on('pointerout',  () => { draw(0); this.tweens.add({ targets: c, scale: 1.0,  duration: 120 }); });
    hit.on('pointerdown', () => { draw(-2); });
    hit.on('pointerup',   () => { draw(0); onClick(); });
    return c;
  }
}

class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }
  create() {
    const w = this.scale.width, h = this.scale.height;
    const bg = buildSkyBackground(this);
    applyDiscoToBackground(bg, !!loadProgress().autoRhythm);

    // bouncing character demo (wears glasses if disco mode is saved on)
    this.demo = this.add.container(w / 2, h * 0.55);
    this.demoPlayer = new Player(this, 0, 0);
    if (loadProgress().autoRhythm) this.demoPlayer.setDiscoMode(true);
    this.demo.add(this.demoPlayer.container);
    this.tweens.add({
      targets: this.demoPlayer.container,
      y: { from: 0, to: -36 },
      yoyo: true, repeat: -1,
      duration: 600, ease: 'Sine.easeInOut'
    });
    // tiny cloud under demo
    const dc = makeCloud(this, w / 2, h * 0.62, 1.1, true);
    dc.setDepth(45);

    // Title
    this.title = this.add.text(w / 2, h * 0.18, 'BEAT BOUNCE\nJUMP', {
      fontFamily: 'Fredoka, sans-serif',
      fontSize: '62px',
      color: '#2a2440',
      fontStyle: '700',
      align: 'center',
      lineSpacing: -8
    }).setOrigin(0.5).setDepth(10);
    this.title.setStroke('#fff4d8', 8);
    this.title.setShadow(0, 6, '#0c0a18', 0, false, true);
    this.tweens.add({
      targets: this.title,
      y: this.title.y - 6, yoyo: true, repeat: -1, duration: 1400, ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: this.title, angle: { from: -2, to: 2 }, yoyo: true, repeat: -1, duration: 2200, ease: 'Sine.easeInOut'
    });

    // Buttons
    this._mkButton(w / 2, h * 0.74, 'PLAY', COLORS.green, () => {
      AUDIO.init(); AUDIO.resume();
      // Phaser's WebAudio sound manager needs an unlock from a user gesture
      try { if (this.sound && this.sound.unlock) this.sound.unlock(); } catch (e) {}
      // Anime-ahh clip on the PLAY click (loaded as 'star' in BootScene)
      if (!AUDIO.muted) {
        try { this.sound.play('star', { volume: 0.9 }); } catch (e) {}
      }
      this.cameras.main.fadeOut(280, 255, 245, 220);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Difficulty'));
    });
    this._mkButton(w / 2, h * 0.83, 'HOW TO PLAY', COLORS.blue, () => {
      AUDIO.init(); AUDIO.resume();
      AUDIO.playClick();
      this.scene.start('HowToPlay');
    });

    const progress = loadProgress();
    AUDIO.setMuted(!!progress.muted);
    this.muteBtn = this._mkButton(w / 2, h * 0.92, progress.muted ? 'SOUND: OFF' : 'SOUND: ON', COLORS.pink, () => {
      AUDIO.init();
      const m = !AUDIO.muted;
      AUDIO.setMuted(m);
      const p = loadProgress(); p.muted = m; saveProgress(p);
      this.muteBtn.label.setText(m ? 'SOUND: OFF' : 'SOUND: ON');
      AUDIO.playClick();
    });

    // best line
    const p = loadProgress();
    const rankPart = (typeof p.bestRank === 'number' && p.bestRank >= 0 && ACHIEVEMENTS[p.bestRank])
      ? `   RANK  ${ACHIEVEMENTS[p.bestRank].rank}` : '';
    this.add.text(w / 2, h * 0.05, `BEST  ${Math.floor(p.bestHeight)}m   COMBO  x${p.bestCombo}${rankPart}`, {
      fontFamily: 'Fredoka, sans-serif', fontSize: '14px',
      color: '#2a2440', fontStyle: '600'
    }).setOrigin(0.5).setDepth(10).setAlpha(0.9);

    // gentle ambient: start beat loop on first interaction
    const tryStart = () => {
      AUDIO.init(); AUDIO.resume();
      window.removeEventListener('pointerdown', tryStart);
      window.removeEventListener('keydown', tryStart);
    };
    window.addEventListener('pointerdown', tryStart);
    window.addEventListener('keydown', tryStart);

    this.cameras.main.fadeIn(400, 255, 245, 220);
  }

  _mkButton(x, y, label, color, onClick) {
    const bw = 240, bh = 56;
    const c = this.add.container(x, y).setDepth(20);
    const bg = this.add.graphics();
    const draw = (offset = 0) => {
      bg.clear();
      // shadow
      bg.fillStyle(COLORS.ink, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2 + 6 - offset, bw, bh, 14);
      // body
      bg.fillStyle(color, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2 - offset, bw, bh, 14);
      bg.lineStyle(3, COLORS.ink, 1);
      bg.strokeRoundedRect(-bw / 2, -bh / 2 - offset, bw, bh, 14);
    };
    draw();
    c.add(bg);
    const txt = this.add.text(0, -2, label, {
      fontFamily: 'Fredoka, sans-serif', fontSize: '24px',
      color: '#2a2440', fontStyle: '700'
    }).setOrigin(0.5);
    c.add(txt);
    c.label = txt;
    const hit = this.add.zone(0, 0, bw, bh + 12).setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerover', () => { draw(2); this.tweens.add({ targets: c, scale: 1.04, duration: 120 }); });
    hit.on('pointerout',  () => { draw(0); this.tweens.add({ targets: c, scale: 1.0,  duration: 120 }); });
    hit.on('pointerdown', () => { draw(-3); txt.y = 1; });
    hit.on('pointerup',   () => { draw(0); txt.y = -2; onClick(); });
    return c;
  }
}

// =================================================================
// HowToPlayScene
// =================================================================
class HowToPlayScene extends Phaser.Scene {
  constructor() { super('HowToPlay'); }
  create() {
    const w = this.scale.width, h = this.scale.height;
    const bg = buildSkyBackground(this);
    applyDiscoToBackground(bg, !!loadProgress().autoRhythm);
    this.add.rectangle(w / 2, h / 2, w, h, 0xffffff, 0.7).setDepth(0);

    this.add.text(w / 2, h * 0.1, 'HOW TO PLAY', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '38px',
      color: '#2a2440', fontStyle: '700'
    }).setOrigin(0.5).setDepth(1);

    const lines = [
      ['Tap or click to charge a jump.', '#2a2440'],
      ['Quick tap for a tiny hop.', '#3a4030'],
      ['Hold longer for a higher jump.', '#3a4030'],
      ['', null],
      ['Release on the BEAT pulse', '#bf3a82'],
      ['for a +20% boost and a combo.', '#bf3a82'],
      ['', null],
      ['Watch out for purple FAKE platforms.', '#7a4ab8'],
      ['Drums boost you on a beat landing.', '#c43838'],
      ['Burgers slow your bounce.', '#a4631a'],
      ['', null],
      ['Stay above the bottom edge.', '#2a2440'],
      ['Climb forever.', '#2a2440']
    ];
    lines.forEach((l, i) => {
      if (l[0] === '') return;
      this.add.text(w / 2, h * 0.18 + i * 30, l[0], {
        fontFamily: 'Fredoka, sans-serif', fontSize: '18px',
        color: l[1], fontStyle: '600'
      }).setOrigin(0.5).setDepth(1);
    });

    this.add.text(w / 2, h * 0.92, 'TAP TO RETURN', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '20px',
      color: '#bf3a82', fontStyle: '700'
    }).setOrigin(0.5).setDepth(1);

    this.input.once('pointerdown', () => { AUDIO.playClick(); this.scene.start('Menu'); });
    this.input.keyboard.once('keydown', () => this.scene.start('Menu'));
  }
}

// =================================================================
// GameScene
// =================================================================
class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) {
    const fromData = data && data.difficulty;
    const fromStore = (loadProgress().lastDifficulty);
    this.difficulty = (fromData && DIFFICULTY[fromData]) ? fromData
                    : (fromStore && DIFFICULTY[fromStore]) ? fromStore
                    : 'medium';
    const p = loadProgress(); p.lastDifficulty = this.difficulty; saveProgress(p);
  }

  create() {
    const w = this.scale.width, h = this.scale.height;
    this.gameOver = false;
    this.paused = false;
    this.gameStartTime = this.time.now;
    this.score = 0;
    // Index of the last achievement unlocked this run (-1 = none yet).
    this._achievementIdx = -1;
    this.height = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.perfectCount = 0;

    // World camera
    this.cameras.main.setBackgroundColor(0xb8e1ff);
    this.bg = buildSkyBackground(this);

    // Beat pulse ring (visual)
    this.beatRing = this.add.graphics();
    this.beatRing.setScrollFactor(0);
    this.beatRing.setDepth(-100);

    // Power systems
    this.cloudPuffs = this.add.particles(0, 0, 'puff', {
      lifespan: 600,
      speed: { min: 60, max: 180 },
      scale: { start: 1.0, end: 0.0 },
      alpha: { start: 0.9, end: 0 },
      tint: 0xffffff,
      emitting: false
    }).setDepth(60);

    this.sparkles = this.add.particles(0, 0, 'sparkle', {
      lifespan: 700,
      speed: { min: 40, max: 200 },
      scale: { start: 0.9, end: 0.0 },
      alpha: { start: 1, end: 0 },
      blendMode: 'ADD',
      tint: [0xffd95a, 0xffffff, 0xff7aa8],
      emitting: false
    }).setDepth(80);

    this.noteParticles = this.add.particles(0, 0, 'note', {
      lifespan: 900,
      speed: { min: 30, max: 90 },
      scale: { start: 0.6, end: 0.2 },
      alpha: { start: 1, end: 0 },
      gravityY: -50,
      emitting: false
    }).setDepth(70);

    // Player
    this.player = new Player(this, PLAYER_X, GAME_H - 200);
    this.player.gravity = DIFFICULTY[this.difficulty].gravity;

    // Platform manager
    this.platformManager = new PlatformManager(this, this.difficulty);
    this.platformManager.spawnInitial(GAME_H - 140);
    // start the player on the initial platform
    this.player.y = GAME_H - 200;

    // Beat manager
    this.beat = new BeatManager(this, BPM);
    this.beat.onBeat(() => this._onBeat());
    this.beat.start();

    // Audio: only SFX, no background drum loop
    AUDIO.init(); AUDIO.resume();

    // Camera follow setup (manual handling)
    this.cameraTopY = 0;
    this.maxClimb = 0;

    // Input: charge & release
    this.charging = false;
    this.chargeStart = 0;
    this.chargedJumpQueued = false;
    this.queuedStrength = 0.4;
    this.queuedOnBeat = false;
    this.queuedAuto = false;
    this.queuedAt = 0;

    this.input.on('pointerdown', (p, currentlyOver) => {
      if (currentlyOver && currentlyOver.length > 0) return;
      this._onDown(p);
    });
    this.input.on('pointerup', (p, currentlyOver) => {
      if (currentlyOver && currentlyOver.length > 0 && !this.charging) return;
      this._onUp(p);
    });
    this.input.on('pointerupoutside', (p) => this._onUp(p));
    this._winUpHandler = () => this._onUp();
    window.addEventListener('pointerup', this._winUpHandler);
    window.addEventListener('blur', this._winUpHandler);
    this.events.once('shutdown', () => {
      window.removeEventListener('pointerup', this._winUpHandler);
      window.removeEventListener('blur', this._winUpHandler);
    });
    this.input.keyboard.on('keydown-SPACE', (e) => { if (!e.repeat) this._onDown(); });
    this.input.keyboard.on('keyup-SPACE', () => this._onUp());
    this.input.keyboard.on('keydown-P', () => this._togglePause());

    // Powerup state
    this.rocketUntil = 0;
    this.slowUntil = 0;
    this.giantUntil = 0;
    this.giantJumpsLeft = 0;

    // Auto Rhythm Mode state (loaded from progress)
    const __progress = loadProgress();
    this.discoMode = !!__progress.autoRhythm;
    this.queuedAuto = false;
    this.player.setDiscoMode(this.discoMode);
    applyDiscoToBackground(this.bg, this.discoMode);
    if (this.platformManager) this.platformManager.setDiscoStyle(this.discoMode);

    // Disco overlays (always present; alpha controlled by mode)
    this._buildDiscoLayer();

    // Floating texts
    this._floats = [];

    // Build UI (in same scene, simpler)
    this._buildUI();

    this.cameras.main.fadeIn(350, 255, 245, 220);

    // Hard cleanup on scene shutdown to prevent leaks across restarts
    this.events.once('shutdown', () => {
      try {
        if (this.beat) this.beat.stop();
        AUDIO.stopBeatLoop && AUDIO.stopBeatLoop();
        this.tweens.killAll();
        this.time.removeAllEvents();
        if (this._winUpHandler) {
          window.removeEventListener('pointerup', this._winUpHandler);
          window.removeEventListener('blur', this._winUpHandler);
        }
        if (this._floats) {
          this._floats.forEach(f => f.text && f.text.scene && f.text.destroy());
          this._floats.length = 0;
        }
      } catch (e) {}
    });
  }

  _buildUI() {
    const w = this.scale.width;
    // top bar
    this.uiHeight = this.add.text(14, 14, '0m', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '22px',
      color: '#2a2440', fontStyle: '700'
    }).setScrollFactor(0).setDepth(200);
    this.uiHeight.setStroke('#fff4d8', 4);
    this.add.text(14, 36, 'HEIGHT', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '10px',
      color: '#2a2440', fontStyle: '700'
    }).setScrollFactor(0).setDepth(200).setAlpha(0.7);

    this.uiCombo = this.add.text(w / 2, 18, 'x0', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '24px',
      color: '#bf3a82', fontStyle: '700'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(200);
    this.uiCombo.setStroke('#fff4d8', 4);
    this.add.text(w / 2, 46, 'COMBO', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '10px',
      color: '#bf3a82', fontStyle: '700'
    }).setOrigin(0.5, 0).setScrollFactor(0).setDepth(200).setAlpha(0.85);

    const p = loadProgress();
    this.uiBest = this.add.text(w - 14, 14, `BEST ${Math.floor(p.bestHeight)}m`, {
      fontFamily: 'Fredoka, sans-serif', fontSize: '14px',
      color: '#2a2440', fontStyle: '700'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(200).setAlpha(0.9);

    // difficulty badge
    const d = DIFFICULTY[this.difficulty] || DIFFICULTY.medium;
    this.uiDiff = this.add.text(w - 14, 32, d.label, {
      fontFamily: 'Fredoka, sans-serif', fontSize: '11px',
      color: '#2a2440', fontStyle: '700',
      backgroundColor: '#fff4d8', padding: { x: 6, y: 2 }
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(200);

    // pause button
    this.pauseBtn = this.add.text(w - 18, 50, 'II', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '20px',
      color: '#2a2440', fontStyle: '700'
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(200)
      .setInteractive({ useHandCursor: true });
    this.pauseBtn.on('pointerdown', () => { AUDIO.playClick(); this._togglePause(); });

    // Hold meter ring at bottom center
    this.holdRing = this.add.graphics().setScrollFactor(0).setDepth(199);
    this.holdRingX = w / 2;
    this.holdRingY = this.scale.height - 80;

    // Debug HUD - shows FPS and live counts so any blow-up is visible
    this.debugText = this.add.text(8, this.scale.height - 14, '', {
      fontFamily: 'monospace', fontSize: '10px', color: '#2a2440', backgroundColor: '#fff4d899'
    }).setOrigin(0, 1).setScrollFactor(0).setDepth(500);

    // Pause overlay
    this.pauseOverlay = this.add.container(w / 2, this.scale.height / 2).setScrollFactor(0).setDepth(300);
    const pbg = this.add.rectangle(0, 0, w, this.scale.height, 0x000000, 0.62);
    const pTitle = this.add.text(0, -90, 'PAUSED', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '48px',
      color: '#fff4d8', fontStyle: '700'
    }).setOrigin(0.5);
    const pHint = this.add.text(0, -30, 'tap dark area to resume', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '14px',
      color: '#fff4d8', fontStyle: '600'
    }).setOrigin(0.5).setAlpha(0.85);

    // QUIT button (exits the run, saves best, returns to menu)
    const quitBw = 200, quitBh = 50;
    const quitBg = this.add.graphics();
    const drawQuit = (offset = 0) => {
      quitBg.clear();
      quitBg.fillStyle(0x2a2440, 1);
      quitBg.fillRoundedRect(-quitBw / 2, -quitBh / 2 + 5 - offset + 50, quitBw, quitBh, 12);
      quitBg.fillStyle(0xff7aa8, 1);
      quitBg.fillRoundedRect(-quitBw / 2, -quitBh / 2 - offset + 50, quitBw, quitBh, 12);
      quitBg.lineStyle(3, 0x2a2440, 1);
      quitBg.strokeRoundedRect(-quitBw / 2, -quitBh / 2 - offset + 50, quitBw, quitBh, 12);
    };
    drawQuit();
    const quitTxt = this.add.text(0, 50, 'QUIT TO MENU', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '20px',
      color: '#2a2440', fontStyle: '700'
    }).setOrigin(0.5);
    const quitHit = this.add.zone(0, 50, quitBw + 12, quitBh + 12);
    quitHit.on('pointerover', () => { if (this.paused) drawQuit(2); });
    quitHit.on('pointerout',  () => { if (this.paused) drawQuit(0); });
    quitHit.on('pointerdown', () => { if (this.paused) { drawQuit(-3); quitTxt.y = 51; } });
    quitHit.on('pointerup',   () => {
      if (!this.paused) return;
      drawQuit(0); quitTxt.y = 50;
      this._quitToMenu();
    });

    this.pauseOverlay.add([pbg, pTitle, pHint, quitBg, quitTxt, quitHit]);
    this.pauseOverlay.setVisible(false);
    // Resume on dark-area tap. Both interactives are disabled until paused.
    pbg.on('pointerdown', () => {
      if (!this.paused) return;
      this._togglePause();
    });

    // Save handles so _togglePause can enable/disable input on them
    this._pauseHits = { pbg, quitHit };

    // ---- DISCO toggle (bottom-right) ----
    this._buildRhythmToggle();
    // ---- MUSIC on/off toggle (above DISCO) ----
    this._buildMusicToggle();
  }

  _buildRhythmToggle() {
    const w = this.scale.width, h = this.scale.height;
    const bw = 150, bh = 38;
    const cx = w - bw / 2 - 10;
    const cy = h - bh / 2 - 14;
    const c = this.add.container(cx, cy).setScrollFactor(0).setDepth(220);
    const glow = this.add.graphics();
    const bg = this.add.graphics();
    c.add([glow, bg]);
    const txt = this.add.text(0, 0, '', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '13px',
      color: '#2a2440', fontStyle: '700'
    }).setOrigin(0.5);
    c.add(txt);

    const draw = () => {
      const on = this.discoMode;
      glow.clear();
      bg.clear();
      if (on) {
        glow.fillStyle(0xb582ff, 0.35);
        glow.fillRoundedRect(-bw / 2 - 6, -bh / 2 - 6, bw + 12, bh + 12, 14);
      }
      bg.fillStyle(0x2a2440, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2 + 3, bw, bh, 12);
      bg.fillStyle(on ? 0xb582ff : 0xd8d4e8, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 12);
      bg.lineStyle(2.5, 0x2a2440, 1);
      bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 12);
      txt.setText(on ? 'DISCO: ON' : 'DISCO: OFF');
      txt.setColor(on ? '#fff4d8' : '#2a2440');
    };
    draw();

    const hit = this.add.zone(0, 0, bw + 10, bh + 12).setInteractive({ useHandCursor: true });
    c.add(hit);
    // equalizer bars inside the button (visible only when ON)
    const eqBars = [];
    for (let i = 0; i < 4; i++) {
      const bar = this.add.rectangle(bw / 2 - 12 - i * 7, 0, 4, 16, 0xfff4d8)
        .setOrigin(0.5, 0.5).setVisible(false);
      c.add(bar);
      eqBars.push(bar);
    }
    this.rhythmEqBars = eqBars;

    hit.on('pointerdown', () => {
      this.discoMode = !this.discoMode;
      const p = loadProgress();
      p.autoRhythm = this.discoMode;
      saveProgress(p);
      AUDIO.playClick();
      this.charging = false;
      draw();
      eqBars.forEach(b => b.setVisible(this.discoMode));
      if (this.player) this.player.setDiscoMode(this.discoMode);
      if (this.platformManager) this.platformManager.setDiscoStyle(this.discoMode);
      applyDiscoToBackground(this.bg, this.discoMode);
      if (this.uiHeight) this.uiHeight.setStroke(this.discoMode ? '#ff6bd6' : '#fff4d8', 4);
      if (this.uiCombo) this.uiCombo.setStroke(this.discoMode ? '#b582ff' : '#fff4d8', 4);
      if (this.discoMode) {
        this.cameras.main.flash(280, 255, 240, 200);
        this.cameras.main.shake(140, 0.005);
      } else {
        this.cameras.main.flash(180, 220, 240, 255);
      }
      this._showToast(
        this.discoMode ? 'DISCO MODE ON 😎' : 'CHILL MODE 🌿',
        this.discoMode ? '#ffd95a' : '#9adf7a'
      );
      this.tweens.add({ targets: c, scale: { from: 0.92, to: 1.0 }, duration: 200, ease: 'Back.easeOut' });
    });
    // initialize EQ visibility based on stored state
    eqBars.forEach(b => b.setVisible(this.discoMode));

    this.rhythmBtn = c;
    this.rhythmBtnDraw = draw;
    this.rhythmBtnGlow = glow;
    this.rhythmBtnContainer = c;
  }

  _buildMusicToggle() {
    const w = this.scale.width, h = this.scale.height;
    const bw = 130, bh = 30;
    const cx = w - bw / 2 - 10;
    const cy = h - bh / 2 - 60; // sits just above the DISCO toggle
    const c = this.add.container(cx, cy).setScrollFactor(0).setDepth(220);
    const bg = this.add.graphics();
    const txt = this.add.text(0, 0, '', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '12px',
      color: '#2a2440', fontStyle: '700'
    }).setOrigin(0.5);
    c.add([bg, txt]);
    const draw = () => {
      const on = !AUDIO.muted;
      bg.clear();
      bg.fillStyle(0x2a2440, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2 + 3, bw, bh, 11);
      bg.fillStyle(on ? 0x6deeda : 0xd8d4e8, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 11);
      bg.lineStyle(2.2, 0x2a2440, 1);
      bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 11);
      txt.setText(on ? 'SOUND: ON' : 'SOUND: OFF');
    };
    draw();
    const hit = this.add.zone(0, 0, bw + 10, bh + 10).setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerdown', () => {
      AUDIO.init();
      AUDIO.setMuted(!AUDIO.muted);
      const p = loadProgress();
      p.muted = AUDIO.muted;
      saveProgress(p);
      AUDIO.playClick();
      draw();
      this.tweens.add({ targets: c, scale: { from: 0.9, to: 1.0 }, duration: 180, ease: 'Back.easeOut' });
    });
    this.musicBtn = c;
    this.musicBtnDraw = draw;
  }

  _buildDiscoLayer() {
    const w = this.scale.width, h = this.scale.height;
    this.discoColors = [0xff6bd6, 0x6dd0ff, 0xffd95a, 0x9adf7a, 0xb582ff, 0xff9a4a];
    this.discoOverlayAlpha = this.discoMode ? 1 : 0;
    this.discoFlashAlpha = 0;
    this._discoT = 0;
    this._lastComboMilestone = 0;

    // Dark party tint (sits on top of the calm sky to recolor the world)
    this.discoBg = this.add.rectangle(w / 2, h / 2, w, h, 0x140828, 0)
      .setScrollFactor(0).setDepth(-180);

    // One graphics object renders ALL the heavy disco effects (beams, skyline, floor glow, ball)
    this.discoGfx = this.add.graphics().setScrollFactor(0).setDepth(-160);
    this.discoGfx.setBlendMode(Phaser.BlendModes.SCREEN);

    // Soft beat flash (re-tinted on each beat)
    this.discoFlash = this.add.rectangle(w / 2, h / 2, w, h, 0xff6bd6, 0)
      .setScrollFactor(0).setDepth(-50).setBlendMode(Phaser.BlendModes.SCREEN);

    // Toast text (reused)
    this.toastText = this.add.text(w / 2, 80, '', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '26px',
      color: '#fff4d8', fontStyle: '700'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(420).setAlpha(0);
    this.toastText.setStroke('#2a2440', 6);

    // Combo milestone hype text
    this.hypeText = this.add.text(w / 2, h * 0.35, '', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '38px',
      color: '#ffd95a', fontStyle: '700'
    }).setOrigin(0.5).setScrollFactor(0).setDepth(430).setAlpha(0);
    this.hypeText.setStroke('#bf3a82', 8);
  }

  _drawDiscoEffects(dt) {
    const g = this.discoGfx;
    g.clear();
    if (this.discoOverlayAlpha < 0.02) return;
    const w = this.scale.width, h = this.scale.height;
    this._discoT += dt;
    const t = this._discoT;
    const phase = this.beat ? this.beat.beatProgress() : 0;
    const pulse = Math.max(0, 1 - phase * 1.4);
    const a = this.discoOverlayAlpha;
    const colors = this.discoColors;

    // 4 rotating light beams from off-screen top-center
    const cx = w / 2, cy = -40;
    for (let i = 0; i < 4; i++) {
      const baseAng = Math.PI / 2 + (i - 1.5) * 0.55;
      const ang = baseAng + Math.sin(t * 0.6 + i) * 0.45;
      const len = h + 200;
      const halfW = 32 + 18 * Math.sin(t * 1.4 + i);
      const tipX = cx + Math.cos(ang) * len;
      const tipY = cy + Math.sin(ang) * len;
      const px = -Math.sin(ang) * halfW;
      const py = Math.cos(ang) * halfW;
      const c = colors[i % colors.length];
      g.fillStyle(c, (0.16 + 0.18 * pulse) * a);
      g.fillTriangle(cx + px, cy + py, cx - px, cy - py, tipX, tipY);
    }

    // Bottom floor glow
    g.fillStyle(0xff6bd6, (0.22 + 0.25 * pulse) * a);
    g.fillRect(0, h - 50, w, 50);
    g.fillStyle(0xffd95a, (0.10 + 0.15 * pulse) * a);
    g.fillRect(0, h - 16, w, 16);

    // Equalizer skyline at the very bottom
    const barCount = 14;
    const barW = w / barCount;
    for (let i = 0; i < barCount; i++) {
      const wave = Math.abs(Math.sin(t * 4 + i * 0.7));
      const barH = 14 + (wave + pulse * 0.6) * 36;
      const c = colors[i % colors.length];
      g.fillStyle(c, 0.85 * a);
      g.fillRect(i * barW + 2, h - barH - 4, barW - 4, barH);
    }

    // Top disco ball with soft halo
    const ballX = w / 2 + Math.sin(t * 0.9) * 32;
    const ballY = 56;
    g.fillStyle(0xffffff, (0.18 + 0.22 * pulse) * a);
    g.fillCircle(ballX, ballY, 26);
    g.fillStyle(0xb582ff, (0.45 + 0.3 * pulse) * a);
    g.fillCircle(ballX, ballY, 14);
    g.fillStyle(0xffffff, 0.95 * a);
    g.fillCircle(ballX - 4, ballY - 4, 3.5);

    // Bg tint alpha-update via discoBg
    if (this.discoBg) this.discoBg.fillAlpha = 0.55 * a;
  }

  _showToast(text, color) {
    if (!this.toastText) return;
    this.toastText.setText(text);
    if (color) this.toastText.setColor(color);
    this.toastText.setAlpha(1);
    this.toastText.y = 80;
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({
      targets: this.toastText,
      alpha: { from: 1, to: 0 },
      y: { from: 80, to: 60 },
      duration: 1100,
      ease: 'Cubic.easeOut'
    });
  }

  _triggerAchievement(ach) {
    const w = this.scale.width, h = this.scale.height;
    const c = this.add.container(w / 2, h * 0.45).setScrollFactor(0).setDepth(450);

    // Outer halo glow ring
    const halo = this.add.graphics();
    for (let i = 6; i >= 1; i--) {
      halo.fillStyle(ach.color, 0.05 + i * 0.04);
      halo.fillCircle(0, 0, 70 + i * 10);
    }
    c.add(halo);

    // Medal disc
    const disc = this.add.graphics();
    disc.fillStyle(0x2a2440, 1);
    disc.fillCircle(0, 6, 64);
    disc.fillStyle(ach.color, 1);
    disc.fillCircle(0, 0, 64);
    disc.lineStyle(4, 0x2a2440, 1);
    disc.strokeCircle(0, 0, 64);
    // inner ring
    disc.lineStyle(2, 0xffffff, 0.55);
    disc.strokeCircle(0, 0, 56);
    c.add(disc);

    // Rank letter
    const letter = this.add.text(0, 0, ach.rank, {
      fontFamily: 'Fredoka, sans-serif', fontSize: '78px',
      color: '#2a2440', fontStyle: '700'
    }).setOrigin(0.5);
    letter.setStroke('#fff4d8', 6);
    c.add(letter);

    // ACHIEVEMENT label above
    const aboveLbl = this.add.text(0, -100, 'ACHIEVEMENT UNLOCKED', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '14px',
      color: '#fff4d8', fontStyle: '700'
    }).setOrigin(0.5);
    aboveLbl.setStroke('#2a2440', 4);
    c.add(aboveLbl);

    // Tagline below
    const tag = this.add.text(0, 90, ach.tag + '  ' + ach.meters + 'm', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '20px',
      color: ach.hex, fontStyle: '700'
    }).setOrigin(0.5);
    tag.setStroke('#2a2440', 4);
    c.add(tag);

    // Quick sparkle burst behind it
    if (this.sparkles) this.sparkles.explode(24, w / 2, h * 0.45);
    AUDIO.playCheer();
    this.cameras.main.flash(180, 255, 240, 200);
    this.cameras.main.shake(140, 0.004);

    // Animate in: scale-up + bounce, hold, then fade out and destroy.
    c.setScale(0.4);
    c.setAlpha(0);
    this.tweens.add({
      targets: c, alpha: 1, scale: 1, duration: 320, ease: 'Back.easeOut'
    });
    this.tweens.add({
      targets: c, alpha: 0, duration: 350, delay: 1700, ease: 'Cubic.easeIn',
      onComplete: () => { if (c && c.scene) c.destroy(); }
    });

    // Save the best rank reached (if this run beats the persisted best).
    try {
      const p = loadProgress();
      const cur = (typeof p.bestRank === 'number') ? p.bestRank : -1;
      if (this._achievementIdx > cur) {
        p.bestRank = this._achievementIdx;
        saveProgress(p);
      }
    } catch (e) {}
  }

  _showHype(text) {
    if (!this.hypeText) return;
    this.hypeText.setText(text);
    this.hypeText.setAlpha(1);
    this.hypeText.setScale(0.7);
    this.tweens.killTweensOf(this.hypeText);
    this.tweens.add({
      targets: this.hypeText,
      scale: { from: 0.7, to: 1.2 },
      duration: 280, ease: 'Back.easeOut'
    });
    this.tweens.add({
      targets: this.hypeText,
      alpha: { from: 1, to: 0 },
      duration: 950, delay: 280, ease: 'Cubic.easeIn'
    });
  }

  _showToast(text, color) {
    if (!this.toastText) return;
    this.toastText.setText(text);
    if (color) this.toastText.setColor(color);
    this.toastText.setAlpha(1);
    this.toastText.y = 80;
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({
      targets: this.toastText,
      alpha: { from: 1, to: 0 },
      y: { from: 80, to: 60 },
      duration: 1000,
      ease: 'Cubic.easeOut'
    });
  }

  _togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.tweens.pauseAll();
      this.beat.event && (this.beat.event.paused = true);
      this.pauseOverlay.setVisible(true);
      // Only let the overlay receive clicks while we're paused
      if (this._pauseHits) {
        this._pauseHits.pbg.setInteractive();
        this._pauseHits.quitHit.setInteractive({ useHandCursor: true });
      }
    } else {
      this.tweens.resumeAll();
      this.beat.event && (this.beat.event.paused = false);
      this.pauseOverlay.setVisible(false);
      // Disable overlay input so it can't eat in-game clicks
      if (this._pauseHits) {
        this._pauseHits.pbg.disableInteractive();
        this._pauseHits.quitHit.disableInteractive();
      }
    }
  }

  _quitToMenu() {
    if (this.gameOver) return;
    this.gameOver = true;
    AUDIO.playClick();
    AUDIO.stopBeatLoop();
    if (this.beat) this.beat.stop();

    // Save current best so the run isn't wasted
    const finalHeight = Math.floor((this.height || 0) / 10);
    const progress = loadProgress();
    let bestHeight = progress.bestHeight || 0;
    let bestCombo = progress.bestCombo || 0;
    if (finalHeight > bestHeight) bestHeight = finalHeight;
    if ((this.bestCombo || 0) > bestCombo) bestCombo = this.bestCombo;
    saveProgress(Object.assign(progress, { bestHeight, bestCombo, muted: AUDIO.muted }));

    // make sure the world isn't frozen by pause when we leave
    if (this.paused) {
      this.tweens.resumeAll();
      this.paused = false;
    }
    if (this.pauseOverlay) this.pauseOverlay.setVisible(false);

    this.cameras.main.fadeOut(280, 255, 245, 220);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
  }

  _onBeat() {
    if (this.gameOver || this.paused) return;
    const cam = this.cameras.main;
    cam.setZoom(this.discoMode ? 1.018 : 1.012);
    if (this.discoMode) {
      if (this.rhythmBtnContainer) this.rhythmBtnContainer.setScale(1.06);
      if (this.discoFlash) {
        this._discoColorIdx = ((this._discoColorIdx || 0) + 1) % this.discoColors.length;
        this.discoFlash.fillColor = this.discoColors[this._discoColorIdx];
        this.discoFlashAlpha = 0.18;
      }
    }
  }

  _onDown(pointer) {
    if (this.gameOver || this.paused) return;
    if (this.rocketUntil > this.time.now) return;
    this.charging = true;
    this.chargeStart = this.time.now;
    this.player.startCharge();
  }

  _onUp(pointer) {
    if (this.gameOver || this.paused) return;
    if (this.rocketUntil > this.time.now) return;
    if (!this.charging) return;
    this.charging = false;
    const heldMs = this.time.now - this.chargeStart;
    let strength;
    if (heldMs < 150) strength = 0.25;
    else if (heldMs < 400) strength = 0.55;
    else strength = Math.min(1.0, 0.55 + (heldMs - 400) / 800);
    const phase = Math.abs(this.beat.beatPhase());
    const window = this.slowUntil > this.time.now ? 180 : 110;
    const onBeat = phase < window;

    if (this.player.onGround || this.player.coyoteTime < 120) {
      this._executeJump(strength, onBeat);
    } else {
      this.chargedJumpQueued = true;
      this.queuedAuto = false;
      this.queuedStrength = strength;
      this.queuedOnBeat = onBeat;
      this.queuedAt = this.time.now;
    }
    this.player.setState(this.player.onGround ? 'jump' : 'fall');
  }

  _doJump(strength, onBeat) {
    let s = strength;
    if (this.giantJumpsLeft > 0) {
      s = Math.max(s, 1.0);
      this.giantJumpsLeft--;
    }
    // Light up the disco tile we're jumping off
    if (this.discoMode && this.player.lastPlatform && this.player.lastPlatform.flashDisco) {
      this.player.lastPlatform.flashDisco();
    }
    this.player.performJump(s, onBeat);
    // Pick exactly one jump voice: long-jump clip on strong charge, otherwise
    // the regular jump tone. They never overlap.
    if (!AUDIO.muted) {
      try {
        if (s >= 0.7) this.sound.play('longjump', { volume: 0.85 });
        else this.sound.play('jump', { volume: 0.75 });
      } catch (e) {}
    }
  }

  _executeJump(strength, onBeat) {
    this._doJump(strength, onBeat);
    if (onBeat) {
      this.combo++;
      if (this.combo > this.bestCombo) this.bestCombo = this.combo;
      this.score += 50;
      if (this.combo > 0 && this.combo % 5 === 0) AUDIO.playCheer();
      this._addFloat(this.player.x, this.player.y - 50, 'PERFECT!', '#bf3a82');
      this.sparkles.explode(16, this.player.x, this.player.y);
      this.cameras.main.shake(70, 0.003);
      this.perfectCount++;
    } else {
      if (Math.abs(this.beat.beatPhase()) >= 220) this.combo = 0;
    }
    this._refreshUI();
  }

  _onPlatformLanding(p) {
    // Apply platform-specific behaviour and auto-bounce if idle (no charged input)
    p.onLand(this.player, this);
    AUDIO.playLand();
    this.player.squash(0.25);
    this.player.setState('idle');
    this.cloudPuffs.explode(3, this.player.x, this.player.y + 26);

    // drum on-beat detection
    if (p.type === 'drum') {
      const phase = Math.abs(this.beat.beatPhase());
      if (phase < 140) {
        this._addFloat(this.player.x, this.player.y - 50, 'BOOM!', '#c43838');
        AUDIO.playCheer();
        this.score += 30;
        // big bounce
        this.player.performJump(1.0, true);
        this.combo++;
        if (this.combo > this.bestCombo) this.bestCombo = this.combo;
        this.sparkles.explode(20, this.player.x, this.player.y);
        this._refreshUI();
        return;
      }
    }

    // banana slide visual
    if (p.type === 'banana') {
      // give the player a subtle horizontal nudge that decays
      this.player.bananaPushUntil = this.time.now + 600;
      this.player.bananaPushDir = (Math.random() < 0.5) ? -1 : 1;
    }

    // burger reset
    if (p.type === 'burger') {
      this._addFloat(this.player.x, this.player.y - 40, 'YUM', '#a4631a');
    }

    // If a charged jump was queued during fall, fire it now (boosted bounce).
    if (this.chargedJumpQueued && (this.time.now - this.queuedAt) < 1200) {
      const s = this.queuedStrength * p.bounceMultiplier();
      if (this.queuedAuto) this._doJump(s, this.queuedOnBeat);
      else this._executeJump(s, this.queuedOnBeat);
      this.chargedJumpQueued = false;
      this.queuedAuto = false;
    }
    // Otherwise the player rests on the platform until they tap.
  }

  update(time, dtMs) {
    try { this._updateInner(time, dtMs); }
    catch (e) {
      if (this.debugText) this.debugText.setText('ERR ' + (e && e.message ? e.message : e));
      console.error('[GameScene update error]', e);
    }
  }

  _updateInner(time, dtMs) {
    if (this.gameOver || this.paused) return;

    const dt = dtMs / 1000;

    // settle beat-driven visual bumps without stacking tweens
    const cam = this.cameras.main;
    if (cam.zoom !== 1) cam.setZoom(Phaser.Math.Linear(cam.zoom, 1, Math.min(1, dt * 8)));
    if (this.rhythmBtnContainer && this.rhythmBtnContainer.scale !== 1) {
      this.rhythmBtnContainer.setScale(Phaser.Math.Linear(this.rhythmBtnContainer.scale, 1, Math.min(1, dt * 8)));
    }

    // Smoothly approach target overlay alpha (1 when ON, 0 when OFF)
    const targetAlpha = this.discoMode ? 1 : 0;
    if (this.discoOverlayAlpha !== targetAlpha) {
      this.discoOverlayAlpha = Phaser.Math.Linear(this.discoOverlayAlpha, targetAlpha, Math.min(1, dt * 4));
      if (Math.abs(this.discoOverlayAlpha - targetAlpha) < 0.01) this.discoOverlayAlpha = targetAlpha;
    }

    // Beat flash decay
    if (this.discoFlashAlpha > 0) {
      this.discoFlashAlpha = Math.max(0, this.discoFlashAlpha - dt * 0.7);
      if (this.discoFlash) this.discoFlash.fillAlpha = this.discoFlashAlpha;
    }

    // Disco effects render (alpha-gated, single Graphics)
    this._drawDiscoEffects(dt);

    // Equalizer bars on the toggle button (only when ON)
    if (this.discoMode && this.rhythmEqBars) {
      const phase = this.beat.beatProgress();
      const beatPulse = Math.max(0, 1 - phase * 1.4);
      for (let i = 0; i < this.rhythmEqBars.length; i++) {
        const b = this.rhythmEqBars[i];
        const wave = Math.abs(Math.sin((this._discoT || 0) * 6 + i * 0.9));
        b.scaleY = 0.35 + wave * 0.45 + beatPulse * 0.4 * 0.7;
      }
    }

    // banana sideways drift
    if (this.player.bananaPushUntil && this.player.bananaPushUntil > time) {
      this.player.x += this.player.bananaPushDir * 60 * dt;
    }
    // clamp horizontally to play area
    this.player.x = Phaser.Math.Clamp(this.player.x, 30, GAME_W - 30);

    // rocket powerup
    if (this.rocketUntil > time) {
      this.player.vy = -1100;
      this.player.setState('jump');
    }

    // slow time effect on beat ring drawn separately

    // update player physics
    this.player.update(time, dtMs);

    // collision: only detect downward against platform tops
    if (this.player.vy >= 0) {
      let landed = false;
      const viewportBottom = this.cameras.main.scrollY + GAME_H;
      for (let i = 0; i < this.platformManager.platforms.length; i++) {
        const p = this.platformManager.platforms[i];
        if (!p.alive || p.broken) continue;
        const px = p.container.x;
        const py = p.container.y;
        // ignore platforms that have scrolled below the visible area — they
        // shouldn't be able to "rescue" the player after they've already fallen
        // off screen.
        if (py - p.height / 2 > viewportBottom) continue;
        const halfW = p.width / 2;
        const platTop = py - p.height / 2;
        if (this.player.y > platTop - 30 && this.player.y < platTop + 12) {
          if (this.player.x > px - halfW && this.player.x < px + halfW) {
            const justLanded = !this.player.onGround || this.player.lastPlatform !== p;
            this.player.y = platTop - 24;
            this.player.vy = 0;
            this.player.onGround = true;
            this.player.lastPlatform = p;
            landed = true;
            if (justLanded) this._onPlatformLanding(p);
            break;
          }
        }
      }
      if (!landed) this.player.onGround = false;
    } else {
      this.player.onGround = false;
    }

    // capture platform positions BEFORE they drift this frame so we can
    // measure how far each one moved and ride the platform horizontally.
    for (const p of this.platformManager.platforms) p._prevX = p.x;

    // update platforms
    const beatProgress = this.beat.beatProgress();
    for (const p of this.platformManager.platforms) p.update(time, dtMs, beatProgress);

    // Ride the platform: if standing on a drifting platform, move with it
    // so it can't drift out from under us.
    if (this.player.onGround && this.player.lastPlatform && this.player.lastPlatform.alive) {
      const lp = this.player.lastPlatform;
      const dx = lp.x - (lp._prevX !== undefined ? lp._prevX : lp.x);
      if (dx !== 0) {
        this.player.x = Phaser.Math.Clamp(this.player.x + dx, 30, GAME_W - 30);
      }
    }

    // update obstacles
    for (const o of this.platformManager.obstacles) {
      if (!o.alive) continue;
      o.container.x += o.vx * dt;
      // bob
      o.container.y += Math.sin(time * 0.005 + o.container.x * 0.01) * 0.3;
      // collision with player
      const dx = o.container.x - this.player.x;
      const dy = o.container.y - this.player.y;
      if (dx * dx + dy * dy < 40 * 40) {
        if (this.player.hurt()) {
          AUDIO.playBuzz();
          this.cameras.main.flash(180, 255, 90, 90);
          this.player.vy = -300;
          this.combo = 0;
          this._refreshUI();
        }
      }
    }

    // pickups
    for (const n of this.platformManager.notes) {
      if (!n.alive) continue;
      const dx = n.container.x - this.player.x;
      const dy = n.container.y - this.player.y;
      if (dx * dx + dy * dy < 32 * 32) {
        n.alive = false;
        this.tweens.killTweensOf(n.container);
        n.container.list.forEach(ch => this.tweens.killTweensOf(ch));
        n.container.destroy();
        this.score += 25;
        AUDIO.playPop();
        this.noteParticles.explode(4, this.player.x, this.player.y);
        this._refreshUI();
      }
    }

    // powerups
    for (const u of this.platformManager.powerups) {
      if (!u.alive) continue;
      const dx = u.container.x - this.player.x;
      const dy = u.container.y - this.player.y;
      if (dx * dx + dy * dy < 36 * 36) {
        u.alive = false;
        this.tweens.killTweensOf(u.container);
        u.container.list.forEach(ch => this.tweens.killTweensOf(ch));
        u.container.destroy();
        if (u.kind === 'rocket') {
          this.rocketUntil = time + 1800;
          this._addFloat(this.player.x, this.player.y - 50, 'ROCKET!', '#ff5a5a');
          this.giantJumpsLeft = 0;
          AUDIO.playCheer();
          AUDIO.playWhoosh();
        } else if (u.kind === 'slow') {
          this.slowUntil = time + 5000;
          this._addFloat(this.player.x, this.player.y - 50, 'SLOW BEAT', '#9ad4ff');
          AUDIO.playCheer();
        }
      }
    }

    // camera follow upward only
    const targetCamY = Math.min(this.cameras.main.scrollY, this.player.y - GAME_H * 0.55);
    this.cameras.main.scrollY = Phaser.Math.Linear(this.cameras.main.scrollY, targetCamY, 0.12);

    // height score
    const climb = (GAME_H - 140) - this.player.y;
    if (climb > this.maxClimb) {
      this.height = climb;
      this.maxClimb = climb;
      this.score += 0; // height handled separately
      this._refreshUI();
      // Achievement check: trigger the next rank when its meter threshold is hit.
      const meters = Math.floor(this.height / 10);
      const next = this._achievementIdx + 1;
      if (next < ACHIEVEMENTS.length && meters >= ACHIEVEMENTS[next].meters) {
        this._achievementIdx = next;
        this._triggerAchievement(ACHIEVEMENTS[next]);
      }
    }

    // ensure platforms above
    this.platformManager.ensureContent(this.player.y);
    // cleanup below
    this.platformManager.cleanup(this.cameras.main.scrollY);

    // difficulty
    const elapsed = (time - this.gameStartTime) / 1000;
    this.platformManager.setDifficulty(elapsed);

    // disco floor: animate tint on every pencil platform so colors flow
    if (this.discoMode) this._updateDiscoTints(time);

    // hold meter
    this._drawHoldMeter();
    this._drawBeatRing();

    // floats fly
    for (let i = this._floats.length - 1; i >= 0; i--) {
      const f = this._floats[i];
      f.life -= dtMs;
      f.text.y -= 0.06 * dtMs;
      f.text.alpha = Phaser.Math.Clamp(f.life / 700, 0, 1);
      if (f.life <= 0) {
        f.text.destroy();
        this._floats.splice(i, 1);
      }
    }

    // debug HUD
    if (this.debugText && this._dbgTick === undefined) this._dbgTick = 0;
    this._dbgTick = (this._dbgTick || 0) + dtMs;
    if (this.debugText && this._dbgTick > 200) {
      this._dbgTick = 0;
      const fps = Math.round(this.game.loop.actualFps || 0);
      const tw = this.tweens.getAllTweens().length;
      const pm = this.platformManager;
      this.debugText.setText(
        `fps ${fps}  plat ${pm.platforms.length}  note ${pm.notes.length}  obs ${pm.obstacles.length}  pwr ${pm.powerups.length}  flt ${this._floats.length}  tw ${tw}`
      );
    }

    // game over check — fire as soon as the player exits the visible bottom.
    // Also cancel any pending charged jump so a late tap can't "rescue" them.
    if (this.player.y > this.cameras.main.scrollY + GAME_H + 10) {
      this.chargedJumpQueued = false;
      this.queuedAuto = false;
      this._endGame();
    }
  }

  _updateDiscoTints(time) {
    const t = time * 0.001;
    const pms = this.platformManager.platforms;
    for (let i = 0; i < pms.length; i++) {
      const p = pms[i];
      if (p.type !== 'pencil' || !p.bubbleImg || !p.bubbleImg.scene) continue;
      const phase = p._discoPhase || 0;
      // hue rotates over time, with per-corner offsets so the gradient travels
      const hueBase = (t * 0.18 + phase * 0.16);
      const c1 = hsvHex(hueBase + 0.00, 0.85, 1.0);
      const c2 = hsvHex(hueBase + 0.18, 0.85, 1.0);
      const c3 = hsvHex(hueBase + 0.10, 0.85, 1.0);
      const c4 = hsvHex(hueBase + 0.30, 0.85, 1.0);
      p.bubbleImg.setTint(c1, c2, c4, c3);
    }
  }

  _drawHoldMeter() {
    const g = this.holdRing;
    g.clear();
    if (this.discoMode) return; // not used in rhythm mode
    if (!this.charging) return;
    const held = this.time.now - this.chargeStart;
    const ratio = Phaser.Math.Clamp(held / 1000, 0, 1);
    const x = this.holdRingX, y = this.holdRingY;
    g.lineStyle(8, 0xffffff, 0.25);
    g.strokeCircle(x, y, 36);
    g.lineStyle(8, ratio < 0.15 ? 0xffd95a : ratio < 0.4 ? COLORS.green : 0xff7aa8, 0.95);
    g.beginPath();
    g.arc(x, y, 36, -Math.PI / 2, -Math.PI / 2 + ratio * Math.PI * 2);
    g.strokePath();
    const phase = this.beat.beatProgress();
    const ang = -Math.PI / 2 + phase * Math.PI * 2;
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(x + Math.cos(ang) * 36, y + Math.sin(ang) * 36, 4);
  }

  _drawBeatRing() {
    const phase = this.beat.beatProgress();
    const g = this.beatRing;
    g.clear();
    const cx = this.player.x;
    const cy = this.player.y - this.cameras.main.scrollY;

    if (this.discoMode) {
      // Big shrinking aim ring: contracts from large to perfect window over each beat.
      // Player taps when the ring matches the small perfect-window circle.
      const outerStart = 90, outerEnd = 28;
      const r = Phaser.Math.Linear(outerStart, outerEnd, phase);
      g.lineStyle(4, 0xb582ff, 0.85);
      g.strokeCircle(cx, cy, r);
      g.lineStyle(2, 0xffffff, 0.55);
      g.strokeCircle(cx, cy, r + 4);
      // perfect window ring (constant)
      g.lineStyle(2.5, 0xffd95a, 0.85);
      g.strokeCircle(cx, cy, 32);
      // soft inner glow on the beat
      const beatPulse = 1 - phase;
      g.fillStyle(0xb582ff, 0.18 * beatPulse);
      g.fillCircle(cx, cy, 32);
    } else {
      const radius = 48 + phase * 22;
      const alpha = 0.5 - phase * 0.45;
      g.lineStyle(3, 0xffffff, alpha);
      g.strokeCircle(cx, cy, radius);
      g.lineStyle(2, 0xffd95a, alpha * 0.7);
      g.strokeCircle(cx, cy, radius + 6);
    }
  }

  _addFloat(x, y, text, color) {
    while (this._floats.length >= 5) {
      const old = this._floats.shift();
      if (old && old.text && old.text.scene) old.text.destroy();
    }
    const t = this.add.text(x, y, text, {
      fontFamily: 'Fredoka, sans-serif', fontSize: '22px',
      color, fontStyle: '700'
    }).setOrigin(0.5).setDepth(120);
    t.setStroke('#fff4d8', 4);
    this._floats.push({ text: t, life: 700 });
  }

  _refreshUI() {
    this.uiHeight.setText(Math.floor(this.height / 10) + 'm');
    this.uiCombo.setText('x' + this.combo);
    if (this.combo === 0) this.uiCombo.setColor('#888');
    else if (this.combo < 5) this.uiCombo.setColor('#bf3a82');
    else if (this.combo < 10) this.uiCombo.setColor('#ff7aa8');
    else if (this.combo < 20) this.uiCombo.setColor('#9ad4ff');
    else this.uiCombo.setColor('#ff5a5a');
    this.player.drawAura(this.combo);

    this.tweens.killTweensOf(this.uiCombo);
    this.tweens.add({
      targets: this.uiCombo, scale: { from: 1.2, to: 1.0 }, duration: 200, ease: 'Back.easeOut'
    });

    // Combo milestone hype (every 10) when in disco mode
    if (this.discoMode && this.combo > 0 && this.combo % 10 === 0 && this.combo !== this._lastComboMilestone) {
      this._lastComboMilestone = this.combo;
      const lines = ['FEEL THE BEAT!', 'DISCO FEVER!', 'PARTY JUMP!', 'ON FIRE!', 'KEEP GROOVING!'];
      this._showHype(lines[Math.floor(Math.random() * lines.length)]);
      AUDIO.playCheer();
    }
    if (this.combo === 0) this._lastComboMilestone = 0;
  }

  _endGame() {
    if (this.gameOver) return;
    this.gameOver = true;
    AUDIO.stopBeatLoop();
    // Game-over voice clip (respects the global sound toggle)
    if (!AUDIO.muted) {
      try { this.sound.play('fail', { volume: 0.85 }); } catch (e) {}
    }
    this.beat.stop();
    this.player.dead = true;
    this.player.setMood('scream');

    const finalHeight = Math.floor(this.height / 10);
    const progress = loadProgress();
    let bestHeight = progress.bestHeight || 0;
    let bestCombo = progress.bestCombo || 0;
    if (finalHeight > bestHeight) bestHeight = finalHeight;
    if (this.bestCombo > bestCombo) bestCombo = this.bestCombo;
    saveProgress(Object.assign(progress, { bestHeight, bestCombo, muted: AUDIO.muted }));

    this.cameras.main.fadeOut(450, 28, 28, 60);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameOver', {
        height: finalHeight,
        bestCombo: this.bestCombo,
        perfects: this.perfectCount,
        difficulty: this.difficulty,
        bestHeight, bestComboAll: bestCombo
      });
    });
  }
}

// =================================================================
// GameOverScene
// =================================================================
const FUNNY_LINES = [
  'Ouch.',
  'Cloud said no.',
  'Missed the beat.',
  'Gravity wins.',
  'Bonk.',
  'The sky was right there.',
  'Almost!',
  'Bouncy luck next time.'
];

class GameOverScene extends Phaser.Scene {
  constructor() { super('GameOver'); }
  init(data) { this.results = data; }
  create() {
    const w = this.scale.width, h = this.scale.height;
    const bg = buildSkyBackground(this);
    applyDiscoToBackground(bg, !!loadProgress().autoRhythm);
    this.add.rectangle(w / 2, h / 2, w, h, 0xffffff, 0.65).setDepth(0);

    this.cameras.main.fadeIn(400, 255, 245, 220);

    const title = this.add.text(w / 2, h * 0.14, 'GAME OVER', {
      fontFamily: 'Fredoka, sans-serif', fontSize: '52px',
      color: '#2a2440', fontStyle: '700'
    }).setOrigin(0.5).setDepth(1);
    title.setStroke('#fff4d8', 8);

    const funny = FUNNY_LINES[Math.floor(Math.random() * FUNNY_LINES.length)];
    this.add.text(w / 2, h * 0.22, funny, {
      fontFamily: 'Caveat, cursive', fontSize: '36px',
      color: '#bf3a82', fontStyle: '700'
    }).setOrigin(0.5).setDepth(1);

    const r = this.results || { height: 0, bestCombo: 0, perfects: 0, bestHeight: 0, bestComboAll: 0 };
    const rows = [
      ['HEIGHT', r.height + 'm'],
      ['BEST COMBO', 'x' + r.bestCombo],
      ['PERFECT JUMPS', r.perfects]
    ];
    rows.forEach((row, i) => {
      const y = h * 0.34 + i * 56;
      this.add.text(w / 2 - 90, y, row[0], {
        fontFamily: 'Fredoka, sans-serif', fontSize: '14px',
        color: '#5a5074', fontStyle: '700'
      }).setOrigin(1, 0.5).setDepth(1);
      this.add.text(w / 2 + 0, y, String(row[1]), {
        fontFamily: 'Fredoka, sans-serif', fontSize: '32px',
        color: '#2a2440', fontStyle: '700'
      }).setOrigin(0, 0.5).setDepth(1);
    });

    // best line
    this.add.text(w / 2, h * 0.58, `BEST  ${r.bestHeight}m   COMBO  x${r.bestComboAll}`, {
      fontFamily: 'Fredoka, sans-serif', fontSize: '14px',
      color: '#bf3a82', fontStyle: '700'
    }).setOrigin(0.5).setDepth(1).setAlpha(0.95);

    // bouncing player decoration
    const miniPlayer = new Player(this, w / 2, h * 0.7);
    miniPlayer.setMood('panic');
    this.tweens.add({
      targets: miniPlayer.container, y: h * 0.7 - 14,
      yoyo: true, repeat: -1, duration: 600, ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: miniPlayer.container, angle: { from: -8, to: 8 },
      yoyo: true, repeat: -1, duration: 800, ease: 'Sine.easeInOut'
    });

    const retryDiff = (r && r.difficulty) || 'medium';
    this._mkBtn(w / 2 - 90, h * 0.88, 'RETRY', COLORS.green, () => {
      AUDIO.playClick();
      this.cameras.main.fadeOut(300, 255, 245, 220);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Game', { difficulty: retryDiff }));
    });
    this._mkBtn(w / 2 + 90, h * 0.88, 'MENU', COLORS.blue, () => {
      AUDIO.playClick();
      this.cameras.main.fadeOut(300, 255, 245, 220);
      this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Menu'));
    });
  }

  _mkBtn(x, y, label, color, onClick) {
    const bw = 150, bh = 50;
    const c = this.add.container(x, y).setDepth(2);
    const bg = this.add.graphics();
    const draw = (offset = 0) => {
      bg.clear();
      bg.fillStyle(COLORS.ink, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2 + 5 - offset, bw, bh, 12);
      bg.fillStyle(color, 1);
      bg.fillRoundedRect(-bw / 2, -bh / 2 - offset, bw, bh, 12);
      bg.lineStyle(3, COLORS.ink, 1);
      bg.strokeRoundedRect(-bw / 2, -bh / 2 - offset, bw, bh, 12);
    };
    draw();
    c.add(bg);
    const txt = this.add.text(0, 0, label, {
      fontFamily: 'Fredoka, sans-serif', fontSize: '20px',
      color: '#2a2440', fontStyle: '700'
    }).setOrigin(0.5);
    c.add(txt);
    const hit = this.add.zone(0, 0, bw, bh + 12).setInteractive({ useHandCursor: true });
    c.add(hit);
    hit.on('pointerover', () => { draw(2); this.tweens.add({ targets: c, scale: 1.04, duration: 120 }); });
    hit.on('pointerout',  () => { draw(0); this.tweens.add({ targets: c, scale: 1.0,  duration: 120 }); });
    hit.on('pointerdown', () => { draw(-3); txt.y = 1; });
    hit.on('pointerup',   () => { draw(0); txt.y = 0; onClick(); });
    return c;
  }
}

// =================================================================
// Phaser config
// =================================================================
const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#b8e1ff',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_W,
    height: GAME_H
  },
  fps: { target: 60, smoothStep: true },
  render: { antialias: true, pixelArt: false },
  scene: [BootScene, MenuScene, DifficultyScene, HowToPlayScene, GameScene, GameOverScene]
};

const game = new Phaser.Game(config);

// Block accidental zoom
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('dblclick', e => e.preventDefault());

// Surface any uncaught error onto the live game scene's debug HUD so freezes are visible
window.addEventListener('error', (ev) => {
  try {
    const scene = game.scene.getScene('Game');
    if (scene && scene.debugText) scene.debugText.setText('ERR ' + (ev.message || 'unknown'));
  } catch (e) {}
});
