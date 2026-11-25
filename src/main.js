import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { buildExterior, LAYOUT, walkHeight, isBlockedOut } from './exterior.js';
import { buildInterior, INSIDE } from './interior.js';
import { createActors } from './actor.js';
import { ParticleField, Footprints } from './fx.js';
import { Sound } from './audio.js';
import { RepairQuest } from './repair.js';
import { buildValley, valleyHeight, valleyBlocked, VALLEY_START } from './valley.js';
import { LANGS, t, getLang, setLang, onLang } from './i18n.js';

// ---------------------------------------------------------------- renderer
const stage = document.getElementById('stage');
const isMobile = matchMedia('(pointer: coarse)').matches;
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.75 : 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
stage.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.05, 900);

// ---------------------------------------------------------------- worlds
const outside = buildExterior();
const inside = buildInterior(renderer);

// The traveler: one rigged character, two instances (outside / inside).
// Falls back to the procedural traveler if the model can't load.
const [walker, walkerIn] = await createActors(`./assets/models/traveler.glb?v=${window.__V || ''}`, 2, [{ snowy: true }, { snowy: false }]);
outside.scene.add(walker.group);
walkerIn.staff.visible = false; // left at the door
inside.scene.add(walkerIn.group);

const snow = new ParticleField({ count: isMobile ? 3500 : 6500, seed: 3 });
outside.scene.add(snow.points);
const prints = new Footprints(outside.scene);

// ---------------------------------------------------------------- post
const composer = new EffectComposer(renderer);
composer.setPixelRatio(renderer.getPixelRatio());
composer.setSize(innerWidth, innerHeight);
const renderPass = new RenderPass(outside.scene, camera);
composer.addPass(renderPass);
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.5, 0.55, 0.88);
composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.32 }, uWarm: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uVig; uniform float uWarm; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.2, length(d * vec2(1.0, 1.15)));
      c.rgb *= mix(1.0 - uVig, 1.0, v);
      // gentle split tone: cool shadows, warm highlights
      float l = dot(c.rgb, vec3(0.299,0.587,0.114));
      c.rgb += mix(vec3(-0.012, 0.0, 0.018), vec3(0.025, 0.01, -0.02) * (1.0 + uWarm), smoothstep(0.2, 0.8, l));
      c.rgb += (h(vUv * 900.0 + uTime) - 0.5) * 0.028;
      gl_FragColor = c;
    }`,
});
composer.addPass(grade);

// ---------------------------------------------------------------- UI helpers
const $ = (id) => document.getElementById(id);
const titleEl = $('title'), hintEl = $('hint'), linesEl = $('lines'), fadeEl = $('fade');
const ringEl = $('ring'), ringFill = $('ringFill'), againEl = $('again');
const musicBtn = $('musicBtn'), langBtn = $('langBtn'), langMenu = $('langMenu'), cornerEl = $('corner');
const RING_LEN = 238.8;
const tx = (key) => t(key, isMobile);

// Story lines and hints hold a text key, so they can be re-rendered when the language changes.
/** Fill a line with its words; the Buddha's words get one span per character (per word in English), so they ink in one by one. */
function fillLine(el) {
  const text = tx(el.dataset.k);
  if (!el.classList.contains('voice')) { el.textContent = text; return; }
  el.textContent = '';
  const parts = getLang() === 'en' ? text.split(/(\s+)/) : [...text];
  let i = 0;
  for (const p of parts) {
    if (!p) continue;
    if (/^\s+$/.test(p)) { el.append(p); continue; }
    const sp = document.createElement('span');
    sp.className = 'ch';
    sp.textContent = p;
    sp.style.setProperty('--i', i++);
    el.append(sp);
  }
}
function say(key, cls = 'v', style = null, into = linesEl) {
  const el = document.createElement('div');
  el.className = `line ${cls}`;
  el.dataset.k = key;
  if (style) for (const [k, v] of Object.entries(style)) el.style.setProperty(k, v);
  fillLine(el);
  into.appendChild(el);
  requestAnimationFrame(() => requestAnimationFrame(() => { if (!el.dataset.gone) el.classList.add('show'); }));
  return el;
}
function unsay(el) {
  if (!el) return;
  el.dataset.gone = '1';
  el.classList.remove('show');
  setTimeout(() => el.remove(), 1800);
}
let hintKey = '';
function hint(key) {
  if (key === hintKey) return;
  hintKey = key;
  if (!key) { hintEl.classList.remove('show'); return; }
  hintEl.classList.remove('show');
  setTimeout(() => { if (hintKey === key) { hintEl.textContent = tx(key); hintEl.classList.add('show'); } }, hintEl.textContent ? 350 : 0);
}
let titleSub = 'sub', titleMain = 'title';
function renderTitle() {
  titleEl.innerHTML = '';
  titleEl.append(tx(titleMain));
  const small = document.createElement('small');
  small.textContent = tx(titleSub);
  titleEl.append(small);
}
function fade(to, warm = false, ms = 1800) {
  fadeEl.classList.toggle('warm', warm);
  fadeEl.style.transition = `opacity ${ms}ms ease`;
  fadeEl.style.opacity = to;
}

// Game-time timers (they run inside tick, so fast-forwarding the game runs them too).
const timers = [];
let clockNow = 0;
function after(sec, fn) { timers.push({ at: clockNow + sec, fn }); }
function runTimers() {
  for (let i = 0; i < timers.length; i++) {
    if (timers[i].at <= clockNow) { const { fn } = timers[i]; timers.splice(i--, 1); fn(); }
  }
}

// The Buddha's voice: brush-written columns that appear right to left (rows in English),
// then fade together. Starting a new speech clears the last one.
let voiceEls = [];
let voiceUntil = 0;
function voice(keys, { gap = 1.6, hold = 3.4 } = {}) {
  for (const el of voiceEls) unsay(el);
  voiceEls = [];
  const n = keys.length;
  const mine = voiceEls;
  keys.forEach((k, i) => after(i * gap, () => {
    if (mine !== voiceEls) return;
    voiceEls.push(say(k, 'voice', { '--x': `${((n - 1) / 2 - i) * 2.1}em`, '--y': `${i * 1.5}em` }));
  }));
  const total = (n - 1) * gap + hold + 1.4;
  voiceUntil = clockNow + total;
  after(total, () => { if (mine === voiceEls) { for (const el of mine) unsay(el); voiceEls = []; } });
  return total;
}
const voicing = () => clockNow < voiceUntil;
// A passing thought of the traveler's, in the left column.
function thought(key, hold = 4) {
  const el = say(key, 'v left');
  after(hold, () => unsay(el));
}

// The errand, top-left: the four lost things, each marked missing / carried / home.
const taskEl = $('task');
let taskSig = '';
function renderTask() {
  taskEl.innerHTML = '';
  const head = document.createElement('div');
  head.className = 'tk-name';
  head.textContent = tx('tk');
  const row = document.createElement('div');
  row.className = 'tk-items';
  for (const id of ['plaque', 'lantern', 'bell', 'bowl']) {
    const it = document.createElement('span');
    it.dataset.id = id;
    it.textContent = tx(`tk_${id}`);
    row.append(it);
  }
  taskEl.append(head, row);
  taskSig = '';
}
function updateTask() {
  const show = activeScene === 'out' && quest.active && !(quest.done && fired.has('taskDone'));
  const sig = show ? quest.items.map((it) => it.state).join() : '';
  if (sig === taskSig) return;
  taskSig = sig;
  taskEl.classList.toggle('show', show);
  if (!show) return;
  for (const it of quest.items) {
    const el = taskEl.querySelector(`[data-id="${it.id}"]`);
    if (el) el.className = it.state === 'home' ? 'home' : it.state === 'lying' ? '' : 'carried';
  }
  // all home: the list stays a moment, then goes
  if (quest.done) after(3.5, () => { fired.add('taskDone'); });
}

// Answers to the Buddha: two replies and a quiet "……" (saying nothing).
// Waiting long enough also counts as silence.
const choicesEl = $('choices');
let choiceDone = null;
function ask(keys, done) {
  choicesEl.innerHTML = '';
  const all = [...keys, 'sil'];
  all.forEach((k, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.k = k === 'sil' ? 'aSil' : k;
    b.textContent = tx(b.dataset.k);
    if (k === 'sil') b.className = 'quiet';
    b.addEventListener('pointerdown', (e) => { e.stopPropagation(); answer(k); });
    choicesEl.append(b);
  });
  choicesEl.classList.add('show');
  if (locked()) document.exitPointerLock();
  const mine = (choiceDone = done);
  after(14, () => { if (choiceDone === mine) answer('sil'); });
}
function answer(k) {
  if (!choiceDone) return;
  const done = choiceDone;
  choiceDone = null;
  choicesEl.classList.remove('show');
  done(k);
}

const sound = new Sound();
againEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); location.reload(); });

// ---------------------------------------------------------------- corner controls
// Language: a small menu of three. Sound: one switch for everything (off = silent).
// Silent until the player turns sound on (every visit starts silent).
let musicOn = false;
sound.setMuted(true);
sound.setMusicOn(false);
function renderMusic() {
  musicBtn.classList.toggle('off', !musicOn);
  musicBtn.setAttribute('aria-pressed', String(musicOn));
  musicBtn.setAttribute('aria-label', tx(musicOn ? 'musicOn' : 'musicOff'));
  musicBtn.title = tx(musicOn ? 'musicOn' : 'musicOff');
}
function toggleMusic() {
  musicOn = !musicOn;
  sound.setMuted(!musicOn);
  sound.start(); // the click is the user gesture that unlocks audio (does nothing while off)
  sound.setMusicOn(musicOn);
  // sound on = wind and score together; outdoors the score stays quiet until the door opens
  if (musicOn && !sound.music) sound.musicStart(sound.level ?? 0.14);
  renderMusic();
}
function openLangMenu(open) {
  langMenu.classList.toggle('open', open);
  langBtn.setAttribute('aria-expanded', String(open));
}
for (const l of LANGS) {
  const b = document.createElement('button');
  b.type = 'button';
  b.dataset.lang = l.id;
  b.lang = l.html;
  b.textContent = l.label;
  b.addEventListener('pointerdown', (e) => { e.stopPropagation(); setLang(l.id); openLangMenu(false); });
  langMenu.append(b);
}
// The corner never passes a tap through to the game.
cornerEl.addEventListener('pointerdown', (e) => e.stopPropagation());
musicBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); toggleMusic(); });
langBtn.addEventListener('pointerdown', (e) => { e.stopPropagation(); openLangMenu(!langMenu.classList.contains('open')); });
window.addEventListener('pointerdown', () => openLangMenu(false));

function applyLang() {
  const meta = LANGS.find((l) => l.id === getLang());
  document.documentElement.lang = meta.html;
  document.title = tx('docTitle');
  renderTitle();
  againEl.textContent = tx('again');
  $('loading').textContent = tx('loading');
  langBtn.setAttribute('aria-label', tx('lang'));
  langBtn.title = tx('lang');
  for (const b of langMenu.children) b.classList.toggle('on', b.dataset.lang === meta.id);
  for (const el of [...linesEl.children, ...$('over').children]) fillLine(el);
  renderTask();
  for (const b of choicesEl.children) b.textContent = tx(b.dataset.k);
  if (hintKey) hintEl.textContent = tx(hintKey);
  renderMusic();
}
onLang(applyLang);
applyLang();

// ---------------------------------------------------------------- input
// holding: the "action" button (mouse/touch held, or Space/E/Enter held).
// keys: movement keys currently down.
let holding = false;
let tapQueued = false;
const keys = new Set();
let camYaw = 0;      // 0 = camera behind the traveler looking toward -Z
let camPitch = 0.22; // radians above horizontal
let pointerDown = false;
let lastPX = 0, lastPY = 0;
const canvas = renderer.domElement;
const locked = () => document.pointerLockElement === canvas;
const FREE_STATES = new Set(['walk', 'inWalk', 'valley']);
// Directed shots: the mouse/touch neither turns the camera nor skips them.
const AUTO_SHOTS = new Set(['intro', 'inLook', 'opening', 'leaving', 'ending', 'wake']);

function lookBy(dx, dy) {
  if (!FREE_STATES.has(state)) return;
  camYaw -= dx * 0.0032;
  camPitch = THREE.MathUtils.clamp(camPitch + dy * 0.0024, -0.05, 0.9);
}

window.addEventListener('pointerdown', (e) => {
  if (AUTO_SHOTS.has(state)) return;
  holding = true; tapQueued = true; pointerDown = true;
  lastPX = e.clientX; lastPY = e.clientY;
  // Desktop: capture the mouse for free look once the journey has begun.
  if (!isMobile && !locked() && (state === 'title' || FREE_STATES.has(state)) && canvas.requestPointerLock) {
    try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (_) { /* unsupported */ }
  }
});
window.addEventListener('pointermove', (e) => {
  if (locked()) { lookBy(e.movementX, e.movementY); return; }
  if (pointerDown) {
    // drag to turn (touch, or mouse when pointer lock is unavailable)
    lookBy((e.clientX - lastPX) * (isMobile ? 1.6 : 1), (e.clientY - lastPY) * (isMobile ? 0.8 : 1));
    lastPX = e.clientX; lastPY = e.clientY;
  }
});
const up = () => { holding = false; pointerDown = false; };
window.addEventListener('pointerup', up);
window.addEventListener('pointercancel', up);
window.addEventListener('blur', () => { up(); keys.clear(); });
const MOVE_KEYS = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);
const ACT_KEYS = new Set(['Space', 'Enter', 'KeyE']);
window.addEventListener('keydown', (e) => {
  if (MOVE_KEYS.has(e.code)) { keys.add(e.code); if (state === 'title') tapQueued = true; e.preventDefault(); }
  if (ACT_KEYS.has(e.code)) { if (!e.repeat) { holding = true; tapQueued = true; } e.preventDefault(); }
  // shortcuts that still work while the mouse is captured: M = music, L = next language
  if (choiceDone && !e.repeat && /^(Digit|Numpad)[123]$/.test(e.code)) {
    const i = Number(e.code.slice(-1)) - 1;
    const b = choicesEl.children[i];
    if (b) answer(b.dataset.k === 'aSil' ? 'sil' : b.dataset.k);
  }
  if (e.code === 'KeyM' && !e.repeat) toggleMusic();
  if (e.code === 'KeyL' && !e.repeat) {
    const i = LANGS.findIndex((l) => l.id === getLang());
    setLang(LANGS[(i + 1) % LANGS.length].id);
  }
});
window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (ACT_KEYS.has(e.code)) holding = false;
});
function takeTap() { const t = tapQueued; tapQueued = false; return t; }

/** Movement intent in camera space: {f: forward, s: strafe, run} */
function moveInput() {
  let f = 0, s = 0;
  if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
  if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
  if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
  if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
  // Holding the screen/mouse walks forward (phone-friendly).
  if (holding && f === 0 && s === 0) f = 1;
  return { f, s, run: keys.has('ShiftLeft') || keys.has('ShiftRight') };
}

// ---------------------------------------------------------------- state
let state = 'title';
let stateTime = 0;
const setState = (s) => { state = s; stateTime = 0; };
let activeScene = 'out';

const L = LAYOUT;
const lines = {};
const fired = new Set();
const once = (key, fn) => { if (!fired.has(key)) { fired.add(key); fn(); } };

// player bodies (position on the ground plane + facing)
const P = { x: 0, z: L.startZ, y: 0, yaw: 0, vx: 0, vz: 0 };
const PI_ = { x: 0, z: INSIDE.startZ, yaw: 0, vx: 0, vz: 0 };

const camPos = new THREE.Vector3(0, 7, 60);
const camLook = new THREE.Vector3(0, 6, -6);
const wantPos = new THREE.Vector3();
const wantLook = new THREE.Vector3();
let camLag = 1.2;

const stick = inside.newStick;
const stickPos = new THREE.Vector3();
let lightProgress = 0;
let stickMode = 'none'; // none | flying | hand | lighting | lit | offering | placed
let flyFrom = new THREE.Vector3(), flyT = 0;

const DOOR = new THREE.Vector2(0, L.facadeZ + 0.85);

// First-person framing inside the hall.
const EYE_Y = 1.58;                                         // the traveler's eye height
const EYE_ALTAR = new THREE.Vector3(0, EYE_Y, INSIDE.stopZ - 0.12); // kneeling cushion, looking at the altar
const ALTAR_LOOK = new THREE.Vector3(0, 1.55, INSIDE.altarZ);
const BUDDHA_FACE = new THREE.Vector3(0, 2.05, -3.2);
const HELD = new THREE.Vector3();  // camera-space spot where the stick is held, below the view
const fpPos = new THREE.Vector3(), fpLook = new THREE.Vector3();
const v3 = new THREE.Vector3();
const ss = THREE.MathUtils.smoothstep;
const lerp = THREE.MathUtils.lerp;
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

/** Catmull-Rom through keyframes [t, yaw, pitch]; returns [yaw, pitch] at time t. */
function lookPath(K, t) {
  let i = 0;
  while (i < K.length - 2 && t > K[i + 1][0]) i++;
  const k0 = K[Math.max(0, i - 1)], k1 = K[i], k2 = K[i + 1], k3 = K[Math.min(K.length - 1, i + 2)];
  const u = THREE.MathUtils.clamp((t - k1[0]) / (k2[0] - k1[0]), 0, 1);
  const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  return [cr(k0[1], k1[1], k2[1], k3[1]), cr(k0[2], k1[2], k2[2], k3[2])];
}
/** Catmull-Rom through keyframes [t, x, y, z] into `out`. */
function splinePoint(out, K, t) {
  let i = 0;
  while (i < K.length - 2 && t > K[i + 1][0]) i++;
  const k0 = K[Math.max(0, i - 1)], k1 = K[i], k2 = K[i + 1], k3 = K[Math.min(K.length - 1, i + 2)];
  const u = THREE.MathUtils.clamp((t - k1[0]) / (k2[0] - k1[0]), 0, 1);
  const cr = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (-a + 3 * b - 3 * c + d) * u * u * u);
  return out.set(cr(k0[1], k1[1], k2[1], k3[1]), cr(k0[2] ?? 0, k1[2] ?? 0, k2[2] ?? 0, k3[2] ?? 0), cr(k0[3] ?? 0, k1[3] ?? 0, k2[3] ?? 0, k3[3] ?? 0));
}
// Opening shot, relative to the traveler: [time, x, y, z]. The first key is filled in from
// the title camera and the last from the follow camera when the shot starts.
const INTRO_KEYS = [
  [0.0, 0, 6, 11],
  [3.0, 3.4, 2.4, 3.2],
  [5.6, 1.5, 1.15, -2.7],
  [7.2, 2.4, 1.55, -0.3],
  [9.0, 1.0, 2.25, 3.1],
  [11.4, 0, 3.3, 6.2],
];
const INTRO_LOOK = [
  [0.0, 0, 5.6, -46],
  [3.0, 0, 1.4, 0],
  [5.6, 0, 1.5, 0],
  [7.2, 0, 1.6, -3],
  [9.0, -0.2, 1.9, -18],
  [11.4, 0, 1.9, 0],
];
const INTRO_FOV = [[0, 1], [3.0, 0.9], [5.6, 0.7], [7.2, 0.8], [9.0, 0.85], [11.4, 1]];

/** A point one metre along yaw/pitch from `from` (yaw 0 looks toward -Z, positive turns left). */
function aim(out, from, yaw, pitch) {
  const cp = Math.cos(pitch);
  return out.set(from.x - Math.sin(yaw) * cp, from.y + Math.sin(pitch), from.z - Math.cos(yaw) * cp);
}

function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/**
 * Shared free-movement step. Moves body `b` relative to the camera yaw,
 * slides along obstacles, turns the traveler toward the motion.
 * Returns the current speed (m/s).
 */
function stepBody(b, dt, { canStand, speed = 1.7, runMul = 2.4 }) {
  const { f, s, run } = moveInput();
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  const rx = Math.cos(camYaw), rz = -Math.sin(camYaw);
  let dx = fx * f + rx * s, dz = fz * f + rz * s;
  const len = Math.hypot(dx, dz);
  if (len > 0) { dx /= len; dz /= len; }
  const top = speed * (run ? runMul : 1); // the run clip reads naturally at about 4 m/s
  const k = Math.min(1, dt * 6);
  b.vx += (dx * top - b.vx) * k;
  b.vz += (dz * top - b.vz) * k;
  const nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
  if (canStand(nx, b.z, b)) b.x = nx; else b.vx *= 0.3;
  if (canStand(b.x, nz, b)) b.z = nz; else b.vz *= 0.3;
  const sp = Math.hypot(b.vx, b.vz);
  if (sp > 0.15) b.yaw = angleLerp(b.yaw, Math.atan2(-b.vx, -b.vz), Math.min(1, dt * 8));
  return sp;
}

const canStandOut = (x, z, b) => {
  if (isBlockedOut(x, z, outside.colliders)) return false;
  return Math.abs(walkHeight(x, z) - walkHeight(b.x, b.z)) < 0.45; // no climbing walls or jumping off the platform
};
const canStandIn = (x, z) => {
  if (Math.abs(x) > 4.0 || z > 5.1 || z < -1.9) return false; // walls, and the altar table edge
  for (const [px, pz] of PILLARS_IN) {
    if ((x - px) ** 2 + (z - pz) ** 2 < 0.42 * 0.42) return false;
  }
  return true;
};
const PILLARS_IN = [[-3.1, 2.2], [3.1, 2.2], [-3.1, -1.6], [3.1, -1.6]];
const solidIn = (p) => PILLARS_IN.some(([px, pz]) => (p.x - px) ** 2 + (p.z - pz) ** 2 < 0.32 * 0.32);

/** Third-person orbit camera target for the current yaw/pitch. `solid(p)` pulls the camera in front of walls. */
const camProbe = new THREE.Vector3();
function orbit(target, dist, solid = null) {
  const cp = Math.cos(camPitch);
  const ox = Math.sin(camYaw) * cp, oy = Math.sin(camPitch), oz = Math.cos(camYaw) * cp;
  let d = dist;
  if (solid) {
    for (let s = 0.4; s <= dist; s += 0.2) {
      camProbe.set(target.x + ox * s, target.y + oy * s, target.z + oz * s);
      if (solid(camProbe)) { d = Math.max(0.6, s - 0.35); break; }
    }
  }
  wantLook.copy(target);
  wantPos.set(target.x + ox * d, target.y + oy * d, target.z + oz * d);
}
// Simple solids for the temple: the hall box and the roof slab above it.
const solidOut = (p) => {
  if (Math.abs(p.x) < 4.35 && p.z < L.facadeZ + 0.3 && p.z > -10.5 && p.y > L.floorY - 0.2 && p.y < L.floorY + 8) return true;
  if (Math.abs(p.x) < 6.7 && p.z < -0.8 && p.z > -12.8 && p.y > L.floorY + 3.4 && p.y < L.floorY + 9) return true;
  if (Math.abs(p.x) < 4.6 && p.z < L.facadeZ + 1.0 && p.z > -10.5 && p.y > L.floorY + 2.2 && p.y < L.floorY + 3.8) return true; // rope + tassels
  if (Math.abs(p.x) < 7 && p.z < -0.7 && p.z > -12.7 && p.y < L.floorY) return true; // the platform
  return false;
};

let bodyY = null, bodyV = 0; // body height and its vertical speed
let camY = 0;                 // a calmer height for the follow camera
/**
 * Stand the traveler on the ground. On stairs the body follows the feet: it rises as soon
 * as either foot comes down over a higher tread, so neither foot sinks into a step.
 */
const LOOKAHEAD = 0.42, RISE_W = 16;
let groundAt = walkHeight; // the surface under the outdoor traveler (the valley swaps it)
function placeWalkerOut(dt = 0) {
  let target = groundAt(P.x, P.z);
  if (walker.feet) {
    let fy = -Infinity;
    const ax = -Math.sin(P.yaw) * LOOKAHEAD, az = -Math.cos(P.yaw) * LOOKAHEAD;
    for (const f of walker.feet) {
      // the stairs run along z, so a foot is sampled at its z but nearly under the body in x:
      // walking along the side edge of the stairs then does not catch the snow beside them
      const fxx = P.x + THREE.MathUtils.clamp(f.x - P.x, -0.04, 0.04), fzz = f.z;
      // a swinging foot looks a little ahead, so the body is already up when it lands
      const g = f.h > 0.03 ? Math.max(groundAt(fxx, fzz), groundAt(fxx + ax, fzz + az)) : groundAt(fxx, fzz);
      fy = Math.max(fy, g - f.h);
    }
    target = THREE.MathUtils.clamp(fy, target - 0.32, target + 0.32);
    // Climbing: aim a little higher by the spring's lag (2v/w), so the smooth rise keeps up with the feet.
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    const slope = (groundAt(P.x + fx * 0.4, P.z + fz * 0.4) - groundAt(P.x - fx * 0.4, P.z - fz * 0.4)) / 0.8;
    const fwd = Math.max(0, P.vx * fx + P.vz * fz);
    if (slope > 0.05 && slope < 1.2) target += Math.min(0.2, slope * fwd * 2 / RISE_W);
  }
  if (bodyY === null || dt === 0) { bodyY = camY = target; bodyV = 0; }
  else {
    // A critically damped spring: the body eases up each step instead of stopping and jumping.
    const w = target > bodyY ? RISE_W : 10;
    const n = 3, h = dt / n;
    for (let i = 0; i < n; i++) { bodyV += (w * w * (target - bodyY) - 2 * w * bodyV) * h; bodyY += bodyV * h; }
    camY = damp(camY, bodyY, 4, dt);
  }
  P.y = bodyY;
  walker.group.position.set(P.x, P.y, P.z);
  walker.group.rotation.y = P.yaw;
}
placeWalkerOut();
walkerIn.group.position.set(0, 0, PI_.z);

// ---------------------------------------------------------------- 修庙: the temple's lost things
// [x, z, yaw] where each lies: the plaque by the door, the chime behind the hall,
// the lantern and the singing bowl out in the snow on either side of the path.
const quest = new RepairQuest({
  outside, sound,
  ground: walkHeight,
  door: new THREE.Vector3(0, L.floorY + 1.2, L.facadeZ + 0.05),
  spots: { plaque: [5.3, -2.3, 0.7], bell: [-2.6, -11.7, 1.1], lantern: [-6.2, 12.8, 0.4], bowl: [5.2, 15.5, -0.5] },
});
let doorAjar = 0, doorAjarWant = 0, rattle = 0, thinking = false;
quest.onAllHome = () => after(2.4, () => { doorAjarWant = 0.1; voice(['b5'], { hold: 3 }); });

// Cinematic controls: a long-lens multiplier on the field of view, and letterbox bars.
let baseFov = 52, fovMul = 1, fovWant = 1;
let windTired = -1;  // last wind level sent for it
let clockT = 0;
function fitCamera() {
  const a = innerWidth / innerHeight;
  camera.aspect = a;
  baseFov = a < 0.8 ? 58 : a < 1.2 ? 52 : 44;
  camera.fov = baseFov * fovMul;
  camera.updateProjectionMatrix();
}
fitCamera();
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth, innerHeight);
  fitCamera();
});

// ---------------------------------------------------------------- frame
const clock = new THREE.Clock();
let started = false;
const tmp = new THREE.Vector3();

function updateOutside(dt) {
  const vh = renderer.domElement.height;
  outside.update(dt);
  const portrait = camera.aspect < 0.8;

  if (state === 'title') {
    const s = stateTime;
    wantPos.set(Math.sin(s * 0.05) * 1.2, 6.2, 51);
    wantLook.set(0, 5.6, -6);
    camLag = 1.5;
    if (stateTime > 1.2) once('title', () => titleEl.classList.add('show'));
    if (stateTime > 3.2) once('hint0', () => hint('start'));
    if (takeTap() && stateTime > 1.0) {
      sound.start();
      sound.ambience({ wind: 0.7 });
      titleEl.classList.remove('show');
      hint('');
      holding = false; // the starting tap should not also walk
      INTRO_KEYS[0].splice(1, 3, camPos.x - P.x, camPos.y - P.y, camPos.z - P.z);
      INTRO_LOOK[0].splice(1, 3, camLook.x - P.x, camLook.y - P.y, camLook.z - P.z);
      document.body.classList.add('cine');
      setState('intro');
    }
  }

  // Opening shot, before the player takes over: down out of the storm, past the traveler
  // to a close look under the hat, round the side to the temple far ahead, then behind.
  if (state === 'intro') {
    const t = stateTime;
    const lastT = INTRO_KEYS[INTRO_KEYS.length - 1][0];
    // the last key is the follow camera itself, so control is handed over without a jump
    camYaw = 0; camPitch = 0.22;
    tmp.set(P.x, camY + 1.9, P.z);
    orbit(tmp, portrait ? 6.4 : 5.6, solidOut);
    INTRO_KEYS[INTRO_KEYS.length - 1].splice(1, 3, wantPos.x - P.x, wantPos.y - P.y, wantPos.z - P.z);
    INTRO_LOOK[INTRO_LOOK.length - 1].splice(1, 3, 0, 1.9, 0);
    splinePoint(wantPos, INTRO_KEYS, t).add(P);
    splinePoint(wantLook, INTRO_LOOK, t).add(P);
    wantPos.y = Math.max(wantPos.y, walkHeight(wantPos.x, wantPos.z) + 0.4);
    fovWant = splinePoint(v3, INTRO_FOV, t).x;
    camLag = 0.12;
    walker.lean = 0;
    if (t > 7.6) once('introLine', () => (lines.l1 = say('l1', 'v')));
    const { f, s } = moveInput();
    const skip = t > 2.0 && (f !== 0 || s !== 0);
    takeTap();
    if (t >= lastT || skip) {
      document.body.classList.remove('cine');
      fired.add('l1'); // the opening already said it
      setTimeout(() => { if (state === 'walk' && !fired.has('moved')) hint('move'); }, 600);
      setState('walk');
    }
  }

  if (state === 'walk') {
    // a stretch of deep snow and headwind where the traveler is worn out
    const tired = ss(P.z, 23, 26.5) * (1 - ss(P.z, 32.5, 35));
    walker.lean = 0.25 + tired * 0.55;
    // a steadier pace on the stairs, so the stride can find each tread
    const onStairs = Math.abs(P.x) < 2.4 && P.z < L.stairBottomZ + 0.4 && P.z > L.stairTopZ - 0.2;
    const sp = stepBody(P, dt, { canStand: canStandOut, speed: lerp(1.4, 1.1, tired) * (onStairs ? 0.9 : 1), runMul: onStairs ? 1.25 : lerp(1.7, 1.3, tired) });
    placeWalkerOut(dt);
    if (Math.abs(tired - windTired) > 0.04) { windTired = tired; sound.ambience({ wind: 0.55 + tired * 0.35 }); }
    const foot = walker.consumeStep();
    if (foot && sp > 0.2) {
      sound.step(false);
      const onGround = !(Math.abs(P.x) < 7 && P.z < L.stairBottomZ);
      if (onGround) {
        const side = foot === 'L' ? -0.11 : 0.11;
        prints.add(new THREE.Vector3(P.x + Math.cos(P.yaw) * side, P.y + 0.015, P.z - Math.sin(P.yaw) * side), P.yaw);
      }
    }
    if (sp > 0.3 && stateTime > 3) once('moved', () => setTimeout(() => { if (hintKey === 'move') hint(''); }, 3500));

    // story beats, by how close the traveler has come
    // Vertical lines carry no punctuation; a full-width space is the pause.
    if (P.z < 35) once('l1', () => (lines.l1 = say('l1', 'v')));
    if (P.z < 27) once('l1x', () => unsay(lines.l1));
    if (P.z < 24) once('l2', () => (lines.l2 = say('l2', 'v left')));
    if (P.z < 17) once('l2x', () => unsay(lines.l2));
    if (P.z < 14.5) once('l3', () => (lines.l3 = say('l3', 'v')));
    if (P.z < 9) once('l4', () => (lines.l4 = say('l4', 'v left')));
    if (P.z < 2.4) once('l34x', () => { unsay(lines.l3); unsay(lines.l4); });

    // camera: free orbit around the traveler
    tmp.set(P.x, camY + 1.9, P.z);
    orbit(tmp, portrait ? 6.4 : 5.6, solidOut);
    // keep the camera above the snow
    const gy = walkHeight(wantPos.x, wantPos.z) + 0.6;
    if (wantPos.y < gy) wantPos.y = gy;
    // just after the opening shot, ease into the follow camera
    camLag = lerp(1.0, 0.18, ss(stateTime, 0, 1.8));

    // back on the platform, whatever has been found flies home
    if (quest.carried.length && P.y > L.floorY - 0.3 && P.z < 0.4) quest.deliver();

    // lost things in the snow, then the door
    const item = quest.nearest(P.x, P.z);
    const nearDoor = !item && P.y > L.floorY - 0.1 && Math.hypot(P.x - DOOR.x, P.z - DOOR.y) < 1.7;
    if (item) {
      hint(`act:pick_${item.id}`);
      if (takeTap()) {
        hint('');
        holding = false;
        quest.pick(item);
        after(0.5, () => thought(`f_${item.id}`));
      }
    } else if (nearDoor) {
      // while the errand is unfinished the door offers nothing; a tap still tries it
      hint(voicing() || (quest.active && !quest.done) ? '' : 'act:door');
      if (takeTap()) {
        hint('');
        if (quest.active && !quest.done) {
          // the errand is not finished: the door gives a little and stays shut
          rattle = 0.5;
          holding = false;
          if (!thinking) { thinking = true; thought('d1', 2.8); after(3.2, () => { thinking = false; }); }
        } else {
          walker.lean = 0;
          sound.door();
          sound.musicStart(0.28); // the score drifts out through the open door
          fired.delete('fadeWarm'); fired.delete('goInside'); // the door opens more than once
          setState('opening');
        }
      }
    } else {
      if (hintKey === 'act:door' || hintKey.startsWith('act:pick')) hint('');
      takeTap();
    }
  }

  if (state === 'opening') {
    // the traveler squares up to the door, then steps through
    const k = Math.min(1, dt * 2.5);
    P.x += (0 - P.x) * k;
    if (stateTime < 1.2) P.z += (DOOR.y - 0.2 - P.z) * k;
    else P.z -= dt * 0.65;
    P.yaw = angleLerp(P.yaw, 0, k);
    placeWalkerOut(dt);
    outside.doorOpen = Math.max(doorAjar, Math.min(1, stateTime / 2.4));
    wantPos.set(0.3, L.floorY + 2.3, P.z + (portrait ? 4.2 : 3.6));
    wantLook.set(0, L.floorY + 1.5, L.facadeZ - 4);
    camLag = 1.0;
    bloom.strength = 0.5 + outside.doorOpen * 0.5;
    if (stateTime > 1.8) once('fadeWarm', () => fade(1, true, 1600));
    if (stateTime > 3.6) once('goInside', () => enterInside());
  }

  quest.update(dt, P);
  if (state !== 'opening') {
    doorAjar = damp(doorAjar, doorAjarWant, 1.5, dt);
    rattle = Math.max(0, rattle - dt);
    outside.doorOpen = doorAjar + (rattle > 0 ? Math.abs(Math.sin(rattle * 38)) * 0.025 * (rattle / 0.5) : 0);
  }

  snow.update(dt, camera.position, vh);
}

// First look around the hall, through the traveler's eyes: the door, the pillars and
// window light, up to the beams, across, and finally the Buddha. [time, yaw, pitch]
const LOOK_KEYS = [
  [0.0, 0.0, -0.04],
  [1.9, 0.78, 0.16],
  [3.7, 0.25, 0.5],
  [5.4, -0.72, 0.2],
  [7.2, 0.0, 0.07],
  [9.0, 0.0, 0.07],
];
const LOOK_END = 8.4;
let lookYaw = 0;

function enterInside() {
  activeScene = 'in';
  document.body.classList.remove('out');
  renderPass.scene = inside.scene;
  bloom.strength = 0.55;
  bloom.threshold = 0.82;
  grade.uniforms.uVig.value = 0.42;
  const again = fired.has('visited');
  fired.add('visited');
  // the singing bowl sits on its cushion only once the traveler has brought it back
  inside.singingBowl.visible = quest.items.some((it) => it.id === 'bowl' && it.state === 'home');
  setState('inLook');
  PI_.x = 0; PI_.z = INSIDE.startZ; PI_.yaw = 0; PI_.vx = PI_.vz = 0;
  walkerIn.group.position.set(PI_.x, 0, PI_.z);
  // through the traveler's eyes, just inside the door
  fpPos.set(0, EYE_Y, INSIDE.startZ + 0.5);
  aim(fpLook, fpPos, LOOK_KEYS[0][1], LOOK_KEYS[0][2]);
  camPos.copy(fpPos); camLook.copy(fpLook);
  wantPos.copy(fpPos); wantLook.copy(fpLook);
  document.body.classList.add('cine');
  sound.ambience({ wind: 0.12, drone: 0, muffle: true });
  sound.musicStart(0.28);
  sound.musicLevel(1.0, 8);
  setTimeout(() => { fadeEl.classList.remove('warm'); fade(0, true, 2600); }, 200);
  if (again) {
    // back from the snow: straight into the hall, the camera already behind the traveler
    document.body.classList.remove('cine');
    camYaw = 0; camPitch = 0.3;
    setState('inWalk');
    return;
  }
  // the hall's lines, unless the traveler has already reached the altar
  const early = () => state === 'inLook' || state === 'inWalk';
  setTimeout(() => { if (early()) lines.i1 = say('i1', 'v'); }, 2000);
  setTimeout(() => { if (early()) lines.i2 = say('i2', 'v left'); }, 3600);
}

// Talks with the Buddha. A step either just speaks ({say}) or asks: the traveler answers
// or says nothing, and the Buddha answers that.
// First, once the incense is offered: who are you, and an errand. Second, after the repair:
// no teaching, just thanks, a night's rest, and the road again tomorrow.
const TALK_FIRST = [
  { say: ['b1'] },
  { ask: ['q1'], choices: ['a1a', 'a1b'], reply: { a1a: ['r1a'], a1b: ['r1b'], sil: ['r1s'] } },
  { say: ['b2', 'b3', 'b4'] },
];
const TALK_AFTER = [
  { say: ['t1', 't2'] },
  { say: ['n1', 'n2', 'n3'] },
];
function talk(script, i, done) {
  if (i >= script.length) { done(); return; }
  const step = script[i];
  if (step.say) {
    const total = voice(step.say, { gap: 1.9, hold: 3.8 });
    after(total + 0.5, () => talk(script, i + 1, done));
    return;
  }
  const els = [];
  const n = step.ask.length;
  step.ask.forEach((k, j) => after(0.8 + j * 1.8, () => els.push(say(k, 'voice', { '--x': `${((n - 1) / 2 - j) * 2.1}em`, '--y': `${j * 1.5}em` }))));
  after(0.8 + (n - 1) * 1.8 + 2.2, () => ask(step.choices, (pick) => {
    for (const el of els) unsay(el);
    if (pick !== 'sil') thought(pick, 2.6);
    const r = step.reply[pick];
    after(pick === 'sil' ? 2.2 : 3.2, () => {
      const total = voice(r, { gap: 1.9, hold: 3.6 });
      after(total + 0.6, () => talk(script, i + 1, done));
    });
  }));
}
// Night: the camera draws back from the altar, the prologue's last words, then black.
// In the dark, one quiet line (the snow fell all night); then morning, somewhere else.
function goodNight() {
  sound.bowl(392, 0.34);
  setTimeout(() => sound.muyu(8, 0.85, 0.2), 1200);
  sound.musicLevel(1.15, 3);
  setState('ending');
}

// The errand: the traveler rises, and the view comes back up outside the closed door,
// looking out over the snow where the lost things now glow.
function leaveInside() {
  setState('leaving');
  fade(1, false, 1600);
  after(1.9, () => {
    activeScene = 'out';
    document.body.classList.add('out');
    renderPass.scene = outside.scene;
    bloom.strength = 0.5;
    bloom.threshold = 0.88;
    grade.uniforms.uVig.value = 0.32;
    sound.ambience({ wind: 0.6, drone: 0, muffle: false });
    sound.musicLevel(0.55, 4);
    quest.activate();
    document.body.classList.remove('cine');
    P.x = 0; P.z = DOOR.y + 1.85; P.yaw = Math.PI; P.vx = P.vz = 0;
    placeWalkerOut();
    doorAjar = 1; doorAjarWant = 0; // the door swings shut behind
    // from beside and behind (the hall wall pulls it in close), out down the path
    camYaw = Math.PI - 0.5; camPitch = 0.3;
    tmp.set(P.x, camY + 1.9, P.z);
    orbit(tmp, camera.aspect < 0.8 ? 6.4 : 5.6, solidOut);
    camPos.copy(wantPos); camLook.copy(wantLook);
    setState('walk');
    stateTime = 3; // already past the opening-shot ease
    fade(0, false, 2200);
  });
}

function beginTake() {
  setState('take');
  after(0.5, () => { if (state === 'take') hint('act:take'); });
}

function updateInside(dt) {
  const vh = renderer.domElement.height;
  inside.update(dt, vh);
  const portrait = camera.aspect < 0.8;

  if (state === 'inLook') {
    const t = stateTime;
    const [yaw, pitch] = lookPath(LOOK_KEYS, t);
    lookYaw = yaw;
    // a slow step forward while looking, with a little breath in the hold
    fpPos.set(0, EYE_Y + Math.sin(t * 1.3) * 0.006, INSIDE.startZ + 0.5 - ss(t, 0.5, LOOK_END) * 0.55);
    aim(wantLook, fpPos, yaw + Math.sin(t * 0.6) * 0.008, pitch + Math.sin(t * 0.9) * 0.005);
    wantPos.copy(fpPos);
    camLag = 0.08;
    const { f, s } = moveInput();
    const skip = stateTime > 2.6 && (f !== 0 || s !== 0);
    takeTap();
    if (stateTime > LOOK_END || skip) {
      document.body.classList.remove('cine');
      PI_.z = INSIDE.startZ;
      camYaw = lookYaw; camPitch = 0.3;
      setState('inWalk');
      setTimeout(() => { if (state === 'inWalk' && !fired.has('i12x')) hint('toBuddha'); }, 1400);
    }
  }

  if (state === 'inWalk') {
    takeTap();
    const sp = stepBody(PI_, dt, { canStand: canStandIn, speed: 1.2 });
    walkerIn.group.position.set(PI_.x, 0, PI_.z);
    walkerIn.group.rotation.y = PI_.yaw;
    if (walkerIn.consumeStep() && sp > 0.2) sound.step(true);
    if (sp > 0.3) once('i12x', () => { setTimeout(() => { unsay(lines.i1); unsay(lines.i2); }, 1500); if (hintKey === 'toBuddha') hint(''); });

    tmp.set(PI_.x, 1.55, PI_.z);
    orbit(tmp, portrait ? 3.9 : 3.4, solidIn);
    // stay inside the hall
    wantPos.x = THREE.MathUtils.clamp(wantPos.x, -4.1, 4.1);
    wantPos.z = THREE.MathUtils.clamp(wantPos.z, -2.6, 5.3);
    wantPos.y = THREE.MathUtils.clamp(wantPos.y, 0.6, 4.9);
    // ease out of the eyes into the follow camera
    camLag = lerp(1.1, 0.18, ss(stateTime, 0, 2.2));

    // reaching the cushion in front of the altar begins the offering
    if (Math.abs(PI_.x) < 0.9 && PI_.z < INSIDE.stopZ + 0.45) {
      setState('settle');
      unsay(lines.i1); unsay(lines.i2);
      hint('');
    }
  }

  if (state === 'settle') {
    // step onto the cushion and face the Buddha; the view moves into the traveler's eyes
    const k = Math.min(1, dt * 3);
    PI_.x += (0 - PI_.x) * k;
    PI_.z += (INSIDE.stopZ - PI_.z) * k;
    PI_.yaw = angleLerp(PI_.yaw, 0, k);
    takeTap();
    if (stateTime > 1.4) {
      if (quest.done && !fired.has('talked2')) { fired.add('talked2'); setState('talk'); talk(TALK_AFTER, 0, goodNight); }
      else beginTake();
    }
  }

  // ---- first person at the altar
  const fp = state === 'settle' || state === 'talk' || state === 'take' || state === 'light' || state === 'offer' || state === 'leaving';
  if (fp) {
    fpPos.copy(EYE_ALTAR);
    fpLook.copy(ALTAR_LOOK);
    camLag = state === 'settle' ? 0.9 : state === 'talk' || state === 'leaving' ? 1.1 : 0.35;
  }
  // while they talk, the traveler looks up at the Buddha's face
  if (state === 'talk' || state === 'leaving') { takeTap(); fpLook.lerp(BUDDHA_FACE, 0.72); }
  // rising to go: the eyes come up off the cushion
  if (state === 'leaving') fpPos.y += ss(stateTime, 0, 1.6) * 0.12;

  if (state === 'take' && stateTime > 0.8 && takeTap()) {
    hint('');
    holding = false;
    stick.visible = true;
    flyFrom.copy(inside.cupTop).add(v3.set(0, -0.2, 0));
    flyT = 0;
    stickMode = 'flying';
    setState('light');
  }

  if (state === 'light') {
    // glance at the cup while the stick comes up into the hands
    if (stickMode === 'flying') fpLook.lerp(inside.cupTop, Math.sin(Math.PI * flyT) * 0.45);
    if (stickMode === 'hand' && !fired.has('hintLight')) { fired.add('hintLight'); hint('light'); }
    if (stickMode === 'hand' || stickMode === 'lighting') {
      if (holding) { stickMode = 'lighting'; lightProgress = Math.min(1, lightProgress + dt / 2.4); }
      else { lightProgress = Math.max(0, lightProgress - dt / 1.2); if (lightProgress === 0) stickMode = 'hand'; }
      ringEl.classList.toggle('show', lightProgress > 0.01);
      ringFill.setAttribute('stroke-dashoffset', String(RING_LEN * (1 - lightProgress)));
      if (lightProgress >= 1) {
        ringEl.classList.remove('show');
        stick.userData.emberMat.emissiveIntensity = 5;
        inside.smokeNew.active = true;
        sound.ignite();
        stickMode = 'lit';
        hint('');
        setState('offer');
      }
    } else takeTap();
  }

  // lean in toward the candle while lighting (and settle back once it is lit)
  if (fp && lightProgress > 0) {
    const flame = inside.flames[0].world;
    const k = ss(lightProgress, 0, 0.55);
    fpPos.lerp(v3.set(flame.x * 0.45, 1.5, -1.85), k);
    fpLook.lerp(flame, k);
  }

  if (state === 'offer') {
    if (stickMode === 'lit') lightProgress = Math.max(0, lightProgress - dt / 1.4);
    if (stickMode === 'lit' && lightProgress < 0.15) once('hintOffer', () => hint('act:offer'));
    if (stickMode === 'lit' && fired.has('hintOffer') && takeTap()) {
      hint('');
      stickMode = 'offering';
      flyT = 0;
      flyFrom.copy(stick.position);
    } else takeTap();
    if (stickMode === 'offering') {
      // lean toward the burner as the stick goes in
      const k = Math.sin(Math.PI * Math.min(1, flyT * 1.05));
      fpPos.lerp(v3.set(0, 1.48, -1.75), k * 0.8);
      fpLook.lerp(inside.burnerTop, k * 0.7);
    }
    if (stickMode === 'placed') {
      once('bell', () => {
        sound.bowl(392, 0.34);
        setTimeout(() => sound.bowl(294, 0.2), 2600);
      });
      // the smoke rises; then the Buddha speaks
      setState('talk');
      after(2.6, () => talk(TALK_FIRST, 0, () => after(0.8, leaveInside)));
    }
  }

  if (fp) { wantPos.copy(fpPos); wantLook.copy(fpLook); }

  if (state === 'ending') {
    takeTap();
    inside.glow = Math.min(1, stateTime / 4);
    grade.uniforms.uWarm.value = inside.glow;
    bloom.strength = 0.5 + inside.glow * 0.08;
    // first the eyes follow the smoke up to the Buddha's face...
    const up = ss(stateTime, 0.3, 3.6);
    wantLook.lerpVectors(inside.burnerTop, BUDDHA_FACE, up);
    // ...then the view rises and draws back out of the traveler, who stands before the altar
    const e = ss(stateTime, 4.2, 11.5);
    const rise = ss(e, 0, 0.55), back = ss(e, 0.12, 1);
    wantPos.set(lerp(EYE_ALTAR.x, 0.45, back), lerp(EYE_ALTAR.y, 2.95, rise), lerp(EYE_ALTAR.z, portrait ? 1.7 : 1.1, back));
    wantLook.lerp(v3.set(0, 1.5, INSIDE.altarZ - 0.2), back);
    camLag = 0.6;
    if (stateTime > 3.4) once('e1', () => (lines.e1 = say('e1', 'v')));
    if (stateTime > 5.4) once('e2', () => (lines.e2 = say('e2', 'v left')));
    if (stateTime > 11.0) once('e3', () => { unsay(lines.e1); unsay(lines.e2); fade(1, false, 3400); sound.musicLevel(0.5, 5); });
    if (stateTime > 15.0) once('e4', () => {
      // asleep: only the line, in the dark
      lines.dream = say('sutra', 'voice sutra dream', null, $('over'));
      sound.bowl(294, 0.14);
    });
    if (stateTime > 22.0) once('e5', () => unsay(lines.dream));
    if (stateTime > 24.0) once('e6', () => goValley());
  }

  if (state !== 'inWalk') { walkerIn.group.position.set(PI_.x, 0, PI_.z); walkerIn.group.rotation.y = PI_.yaw; }

}

// ---------------------------------------------------------------- 第一章 · 落花谷
let valley = null;
const canStandValley = (x, z, b) => !valleyBlocked(x, z, valley.colliders) && Math.abs(valleyHeight(x, z) - valleyHeight(b.x, b.z)) < 0.6;
const wakeFrom = new THREE.Vector3(), wakeLook = new THREE.Vector3();

function goValley() {
  if (!valley) { valley = buildValley(); renderer.compile(valley.scene, camera); }
  valley.scene.add(walker.group);
  activeScene = 'valley';
  document.body.classList.add('out');
  renderPass.scene = valley.scene;
  bloom.strength = 0.42; bloom.threshold = 0.9;
  grade.uniforms.uVig.value = 0.3; grade.uniforms.uWarm.value = 0.3;
  sound.ambience({ wind: 0.16, drone: 0, muffle: false });
  sound.musicLevel(0.75, 8);
  groundAt = valleyHeight;
  P.x = VALLEY_START.x; P.z = VALLEY_START.z; P.yaw = 0; P.vx = P.vz = 0;
  bodyY = null;
  placeWalkerOut();
  walker.lean = 0;
  // waking, through the traveler's eyes: the blossom overhead first
  wakeFrom.set(P.x, P.y + EYE_Y, P.z);
  wakeLook.copy(valley.hero).add(v3.set(0, 4.6, 0));
  camPos.copy(wakeFrom); camLook.copy(wakeLook);
  wantPos.copy(wakeFrom); wantLook.copy(wakeLook);
  camYaw = 0; camPitch = 0.2;
  titleMain = 'ch1Title'; titleSub = 'ch1Sub'; renderTitle();
  setState('wake');
}

function updateValley(dt) {
  const vh = renderer.domElement.height;
  const portrait = camera.aspect < 0.8;
  valley.update(dt, camera.position, vh);
  tmp.set(P.x, camY + 1.9, P.z);

  if (state === 'wake') {
    const t = stateTime;
    takeTap();
    // eyes opening: a slow blink out of the dark
    if (t > 0.4) once('w-open1', () => fade(0.55, false, 1600));
    if (t > 2.3) once('w-blink', () => fade(0.9, false, 450));
    if (t > 2.9) once('w-open2', () => fade(0, false, 2600));
    // the blossom overhead; then the eyes come down to the valley ahead; then the view
    // draws back out of the traveler to behind them
    orbit(tmp, portrait ? 6.4 : 5.6, null);
    const ahead = v3.set(P.x + 0.4, P.y + 1.3, P.z - 12);
    const down = ss(t, 4.2, 7.5), back = ss(t, 7.5, 12.5);
    const look = tmp.copy(wakeLook).lerp(ahead, down);
    wantLook.lerpVectors(look, wantLook, back);
    wantPos.lerpVectors(wakeFrom, wantPos, back);
    tmp.set(P.x, camY + 1.9, P.z);
    wantPos.y = Math.max(wantPos.y, valleyHeight(wantPos.x, wantPos.z) + 0.3);
    camLag = 0.5;
    if (t > 8.0) once('w-title', () => titleEl.classList.add('show'));
    if (t > 14.5) once('w-title-x', () => titleEl.classList.remove('show'));
    const { f, s } = moveInput();
    if (t > 12.5 || (t > 4 && (f !== 0 || s !== 0))) {
      setState('valley');
      after(t > 12.4 ? 3.0 : 0.5, () => { titleEl.classList.remove('show'); thought('w1', 3.6); });
      after(t > 12.4 ? 7.5 : 5, () => thought('w2', 3.6));
      setTimeout(() => { if (state === 'valley' && !fired.has('v-moved')) hint('move'); }, 4000);
    }
  }

  if (state === 'valley') {
    const sp = stepBody(P, dt, { canStand: canStandValley, speed: 1.4, runMul: 1.7 });
    placeWalkerOut(dt);
    if (walker.consumeStep() && sp > 0.2) sound.step(true);
    if (sp > 0.3 && stateTime > 2) once('v-moved', () => setTimeout(() => { if (hintKey === 'move') hint(''); }, 3000));
    takeTap();
    orbit(tmp, portrait ? 6.4 : 5.6, null);
    wantPos.y = Math.max(wantPos.y, valleyHeight(wantPos.x, wantPos.z) + 0.5);
    camLag = lerp(0.6, 0.18, ss(stateTime, 0, 2));
  }
}

/** The incense stick; runs after the camera moves, since it is held just below the view. */
const UP = new THREE.Vector3(0, 1, 0);
// lighting: the stick reaches in from the front and a little to the right, tip in the flame
const LIGHT_DIR = new THREE.Vector3(-0.18, 0.88, -0.42).normalize();
const qHeld = new THREE.Quaternion(), qLight = new THREE.Quaternion().setFromUnitVectors(UP, LIGHT_DIR);
const qPlaced = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.05);
const stickTip = new THREE.Vector3();
function updateStick(dt) {
  const portrait = camera.aspect < 0.8;
  const len = stick.userData.len;
  HELD.set(portrait ? 0.13 : 0.2, -0.42, -0.6);
  const held = camera.localToWorld(HELD.clone());
  // held sticks lean in a little toward the middle of the view
  qHeld.setFromAxisAngle(v3.set(0, 0, 1), 0.12);
  let k = 0;
  if (stickMode === 'flying') {
    flyT = Math.min(1, flyT + dt / 1.0);
    k = flyT * flyT * (3 - 2 * flyT);
    stickPos.lerpVectors(flyFrom, held, k);
    stickPos.y += Math.sin(Math.PI * k) * 0.18;
    stick.quaternion.identity().slerp(qHeld, k);
    if (flyT >= 1) stickMode = 'hand';
  } else if (stickMode === 'hand' || stickMode === 'lighting' || stickMode === 'lit') {
    const flame = inside.flames[0].world;
    stickTip.set(flame.x, flame.y - 0.006, flame.z + 0.012);
    v3.copy(stickTip).addScaledVector(LIGHT_DIR, -len);
    k = ss(lightProgress, 0.15, 0.75);
    stickPos.lerpVectors(held, v3, k);
    stick.quaternion.slerpQuaternions(qHeld, qLight, k);
  } else if (stickMode === 'offering') {
    flyT = Math.min(1, flyT + dt / 1.8);
    k = flyT * flyT * (3 - 2 * flyT);
    v3.copy(inside.burnerTop).add(tmp.set(-0.05, -0.09, 0.02));
    stickPos.lerpVectors(flyFrom, v3, k);
    stickPos.y += Math.sin(Math.PI * k) * 0.1;
    stick.quaternion.slerpQuaternions(qHeld, qPlaced, k);
    if (flyT >= 1) stickMode = 'placed';
  } else if (stickMode === 'placed') {
    stick.quaternion.copy(qPlaced);
  }
  if (stickMode !== 'none') {
    stick.position.copy(stickPos);
    // smoke rises from the tip
    inside.smokeNew.source.copy(UP).applyQuaternion(stick.quaternion).multiplyScalar(len + 0.01).add(stick.position);
    if (stick.userData.emberMat.emissiveIntensity > 0) {
      stick.userData.emberMat.emissiveIntensity = 4.5 + Math.sin(performance.now() * 0.003) * 1.2;
    }
  }
}

function frame() {
  tick(Math.min(0.05, clock.getDelta()));
  composer.render();
  if (!started) {
    started = true;
    $('loading').style.opacity = 0;
    cornerEl.classList.add('show');
    fade(0, false, 2400);
  }
  requestAnimationFrame(frame);
}

let debugCam = null;
function tick(dt) {
  stateTime += dt;
  clockT += dt;
  clockNow = clockT;
  runTimers();
  fovWant = 1;
  if (activeScene === 'out') { updateOutside(dt); walker.update(dt); }
  else if (activeScene === 'in') { updateInside(dt); walkerIn.update(dt); }
  else { updateValley(dt); walker.update(dt); }
  updateTask();

  if (debugCam) { wantPos.copy(debugCam.pos); wantLook.copy(debugCam.look); camLag = 0.05; }
  const a = 1 - Math.exp(-dt / Math.max(0.05, camLag) * 2.2);
  camPos.lerp(wantPos.lengthSq() ? wantPos : camPos, a);
  camLook.lerp(wantLook.lengthSq() ? wantLook : camLook, a);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  fovMul = damp(fovMul, fovWant, 1.6, dt);
  if (Math.abs(camera.fov - baseFov * fovMul) > 0.01) { camera.fov = baseFov * fovMul; camera.updateProjectionMatrix(); }
  camera.updateMatrixWorld();

  if (activeScene === 'valley') {
    // the traveler is hidden while the view is behind their eyes
    v3.set(P.x, P.y + EYE_Y, P.z);
    walker.group.visible = camera.position.distanceTo(v3) > 0.75;
  }
  if (activeScene === 'in') {
    updateStick(dt);
    // first person: hide the traveler while the camera is behind their eyes
    v3.copy(walkerIn.group.position).y += EYE_Y;
    walkerIn.group.visible = camera.position.distanceTo(v3) > 0.75;
  }

  grade.uniforms.uTime.value = (grade.uniforms.uTime.value + dt) % 100;
}

// Pre-compile both scenes so the door transition does not hitch.
renderer.compile(outside.scene, camera);
renderer.compile(inside.scene, camera);
requestAnimationFrame(frame);

// Debug hook for verification: window.__game.jump('ending') etc.
window.__game = {
  get state() { return state; },
  get inside() { return inside; },
  get outside() { return outside; },
  get sound() { return sound; },
  get actors() { return [walker, walkerIn]; },
  // inspect from a fixed viewpoint: cam([x,y,z],[x,y,z]); cam() to release
  cam(pos, look) { debugCam = pos ? { pos: new THREE.Vector3(...pos), look: new THREE.Vector3(...look) } : null; },
  get debug() {
    return { stickMode, lightProgress, holding, stateTime, keys: [...keys], camYaw, camPitch,
      out: [P.x, P.y, P.z].map((v) => +v.toFixed(2)), in: [PI_.x, PI_.z].map((v) => +v.toFixed(2)), fov: camera.fov };
  },
  // Fast-forward the simulation (for testing while the tab is throttled).
  // input: {hold, keys: ['KeyW', ...], yaw}
  advance(sec, input = {}) {
    const h = holding; const k0 = new Set(keys);
    if (input.hold !== undefined) holding = input.hold;
    if (input.keys) { keys.clear(); input.keys.forEach((c) => keys.add(c)); }
    if (input.yaw !== undefined) camYaw = input.yaw;
    for (let t = 0; t < sec; t += 1 / 30) tick(1 / 30);
    holding = h; keys.clear(); k0.forEach((c) => keys.add(c));
  },
  tap() { tapQueued = true; },
  get quest() { return quest; },
  put(x, z, yaw = 0) { P.x = x; P.z = z; P.yaw = yaw; P.vx = P.vz = 0; placeWalkerOut(); },
  answer(k) { answer(k); },
  look(dx, dy) { lookBy(dx, dy); },
  jump(target) {
    titleEl.classList.remove('show');
    hint('');
    // finish the errand without the "进来吧" that would otherwise talk over the scene
    const quietComplete = () => { const f = quest.onAllHome; quest.onAllHome = null; quest.completeAll(); quest.onAllHome = f; };
    if (target === 'walk') { setState('walk'); }
    if (target === 'repaired') { fired.add('visited'); quest.completeAll(); outside.lanternsOn = 1; doorAjarWant = doorAjar = 0.1; P.x = 0; P.z = DOOR.y + 1.2; P.yaw = 0; placeWalkerOut(); setState('walk'); }
    if (target === 'errand') { enterInside(); leaveInside(); }
    if (target === 'talk') { enterInside(); document.body.classList.remove('cine'); PI_.x = 0; PI_.z = INSIDE.stopZ + 0.3; PI_.yaw = 0; camPos.copy(EYE_ALTAR); setState('take'); }
    if (target === 'valley') { fade(1, false, 10); goValley(); }
    if (target === 'valleyWalk') { fade(1, false, 10); goValley(); stateTime = 12.4; }
    if (target === 'talk1') {
      // the incense already offered, the first talk begins
      enterInside(); document.body.classList.remove('cine'); PI_.x = 0; PI_.z = INSIDE.stopZ; PI_.yaw = 0; walkerIn.group.position.set(PI_.x, 0, PI_.z);
      stick.visible = true; stickMode = 'placed';
      stickPos.copy(inside.burnerTop).add(new THREE.Vector3(-0.05, -0.09, 0.02)); stick.userData.emberMat.emissiveIntensity = 5; inside.smokeNew.active = true;
      camPos.copy(EYE_ALTAR); setState('talk');
      after(1.2, () => talk(TALK_FIRST, 0, () => after(0.8, leaveInside)));
    }
    if (target === 'night') { fired.add('visited'); quietComplete(); enterInside(); document.body.classList.remove('cine'); PI_.x = 0; PI_.z = INSIDE.stopZ; PI_.yaw = 0; camPos.copy(EYE_ALTAR); goodNight(); }
    if (target === 'talk2') { fired.add('visited'); quietComplete(); enterInside(); PI_.x = 0; PI_.z = INSIDE.stopZ + 0.3; PI_.yaw = 0; camPos.copy(EYE_ALTAR); setState('settle'); }
    if (target === 'door') { P.x = 0; P.z = DOOR.y + 0.6; P.yaw = 0; placeWalkerOut(); setState('walk'); }
    if (target === 'intro') { setState('title'); stateTime = 2; tapQueued = true; }
    if (target === 'trudge') { P.x = 0; P.z = 34; P.yaw = 0; placeWalkerOut(); setState('walk'); }
    if (target === 'stairs') { P.x = 0; P.z = L.stairBottomZ + 1.2; P.yaw = 0; placeWalkerOut(); setState('walk'); }
    if (target === 'inside') { enterInside(); }
    if (target === 'walkin') { enterInside(); stateTime = 99; }
    if (target === 'altar') { enterInside(); document.body.classList.remove('cine'); PI_.z = INSIDE.stopZ; walkerIn.group.position.set(0, 0, PI_.z); camPos.copy(EYE_ALTAR); setState('take'); setTimeout(() => { unsay(lines.i1); unsay(lines.i2); }, 3500); }
    if (target === 'ending') {
      enterInside(); document.body.classList.remove('cine'); PI_.x = 0; PI_.z = INSIDE.stopZ; PI_.yaw = 0; walkerIn.group.position.set(PI_.x, 0, PI_.z);
      stick.visible = true; stickMode = 'placed';
      stickPos.copy(inside.burnerTop).add(new THREE.Vector3(-0.05, -0.09, 0.02)); stick.userData.emberMat.emissiveIntensity = 5; inside.smokeNew.active = true;
      camPos.copy(EYE_ALTAR); setState('ending');
    }
  },
};

// ---------------------------------------------------------------- test switch
// The third corner icon opens a list of every world and story point. Picking one reloads
// the page as ?at=<node>, so it always starts from a clean state.
const TEST_WORLDS = [
  ['序章 · 雪寺', [
    ['', '标题'], ['intro', '开场'], ['trudge', '风雪'], ['stairs', '台阶'], ['door', '殿门'],
    ['inside', '进殿'], ['walkin', '殿内'], ['altar', '上香'], ['talk1', '对话一'],
    ['errand', '修庙'], ['repaired', '归位'], ['talk2', '对话二'], ['night', '入夜'],
  ]],
  ['第一章 · 落花谷', [['valley', '醒来'], ['valleyWalk', '漫步']]],
  ['第二章 · 渡口', []], ['第三章 · 镜城', []], ['第四章 · 雾山', []], ['第五章 · 人间', []], ['终章', []],
];
const testAt = new URLSearchParams(location.search).get('at') || '';
{
  const wrap = document.createElement('div');
  wrap.className = 'testWrap';
  const btn = document.createElement('button');
  btn.id = 'testBtn';
  btn.className = 'icon';
  btn.type = 'button';
  btn.title = 'Test';
  btn.setAttribute('aria-label', 'Test');
  btn.setAttribute('aria-expanded', 'false');
  // a path through three stops
  btn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 18c0-4 12-2 12-6s-12-2-12-6" /><circle cx="6" cy="18" r="1.8" /><circle cx="18" cy="12" r="1.8" /><circle cx="6" cy="6" r="1.8" /></svg>';
  const menu = document.createElement('div');
  menu.id = 'testMenu';
  for (const [world, nodes] of TEST_WORLDS) {
    const w = document.createElement('div');
    w.className = 'test-world' + (nodes.length ? '' : ' empty');
    const h = document.createElement('div');
    h.className = 'test-name';
    h.textContent = nodes.length ? world : `${world}（未做）`;
    w.append(h);
    const row = document.createElement('div');
    row.className = 'test-nodes';
    for (const [id, label] of nodes) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      if (id === testAt) b.classList.add('on');
      b.addEventListener('click', () => { location.search = id ? `?at=${id}` : ''; });
      row.append(b);
    }
    w.append(row);
    menu.append(w);
  }
  wrap.append(btn, menu);
  cornerEl.prepend(wrap);
  const openTest = (open) => { menu.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); };
  btn.addEventListener('pointerdown', (e) => { e.stopPropagation(); openLangMenu(false); openTest(!menu.classList.contains('open')); });
  menu.addEventListener('pointerdown', (e) => e.stopPropagation());
  window.addEventListener('pointerdown', () => openTest(false));
  langBtn.addEventListener('pointerdown', () => openTest(false));
  if (testAt) setTimeout(() => window.__game.jump(testAt), 300);
}
