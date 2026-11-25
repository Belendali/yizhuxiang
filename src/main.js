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
import { buildValley, valleyHeight, valleyBlocked, valleyPathX, VALLEY_START } from './valley.js';
import { Nian } from './anian.js';
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
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uVig: { value: 0.32 }, uWarm: { value: 0 }, uNight: { value: 0 }, uStill: { value: 0 } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime; uniform float uVig; uniform float uWarm; uniform float uNight; uniform float uStill; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec2 d = vUv - 0.5;
      float v = smoothstep(0.85, 0.2, length(d * vec2(1.0, 1.15)));
      c.rgb *= mix(1.0 - uVig, 1.0, v);
      // night: everything cool sinks into a moonlit blue; warm light (lanterns, windows) stays
      float nl = dot(c.rgb, vec3(0.299,0.587,0.114));
      float warmth = max(smoothstep(0.04, 0.22, c.r - c.b), smoothstep(0.06, 0.2, (c.r - c.b) / max(c.r, 0.001)) * smoothstep(0.45, 0.75, nl));
      warmth = max(warmth, smoothstep(0.76, 0.86, max(c.r, max(c.g, c.b))));
      c.rgb = mix(c.rgb, c.rgb * mix(vec3(0.3, 0.37, 0.52), vec3(1.08, 1.0, 0.92), warmth), uNight);
      // held still: the colour drains toward a pale, faintly cool stillness
      float sl = dot(c.rgb, vec3(0.299,0.587,0.114));
      c.rgb = mix(c.rgb, vec3(sl) * vec3(0.97, 1.0, 1.05) * 1.04, uStill * 0.42);
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
function voice(keys, { gap = 1.6, hold = 3.4, cls = 'voice' } = {}) {
  for (const el of voiceEls) unsay(el);
  voiceEls = [];
  const n = keys.length;
  const mine = voiceEls;
  // 阿念's words stand at her right, her grandmother's at her left
  voiceAnchor = / girl/.test(cls) ? { who: 'girl', side: 1, h: 1.2 } : / elder/.test(cls) ? { who: 'elder', side: -1, h: 1.45 } : null;
  keys.forEach((k, i) => after(i * gap, () => {
    if (mine !== voiceEls) return;
    const el = say(k, cls, { '--x': `${((n - 1) / 2 - i) * 2.1}em`, '--y': `${i * 1.5}em` });
    el._i = i; el._n = n;
    voiceEls.push(el);
    placeVoices();
  }));
  const total = (n - 1) * gap + hold + 1.4;
  voiceUntil = clockNow + total;
  after(total, () => { if (mine === voiceEls) { for (const el of mine) unsay(el); voiceEls = []; } });
  return total;
}
const voicing = () => clockNow < voiceUntil;
// Pin the spoken lines beside whoever is speaking, a little to their side on screen and starting
// about at head height. Off screen (or no speaker), they fall back to their usual place.
let voiceAnchor = null;
const vaP = new THREE.Vector3(), vaS = new THREE.Vector3();
function placeVoices() {
  if (!voiceEls.length) return;
  const o = voiceAnchor && nian && nian[voiceAnchor.who];
  let ok = !!(o && o.visible && activeScene === 'valley');
  if (ok) {
    o.getWorldPosition(vaP); vaP.y += voiceAnchor.h;
    vaS.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(voiceAnchor.side * 0.3);
    vaP.add(vaS).project(camera);
    ok = vaP.z < 1 && Math.abs(vaP.x) < 1.05 && Math.abs(vaP.y) < 1.1;
  }
  const W = innerWidth, H = innerHeight, en = document.documentElement.lang === 'en';
  const ax = (vaP.x + 1) / 2 * W, ay = (1 - vaP.y) / 2 * H, side = voiceAnchor ? voiceAnchor.side : 1;
  // the columns share one top line, so the longest one decides how high they start
  let tall = 0;
  if (ok && !en) for (const el of voiceEls) tall = Math.max(tall, el.offsetHeight);
  const top = Math.max(H * 0.05, Math.min(H * 0.84 - tall, ay - tall * 0.12));
  for (const el of voiceEls) {
    if (!ok) { el.style.left = el.style.top = el.style.transform = ''; continue; }
    const w = el.offsetWidth, h = el.offsetHeight;
    let x, y;
    if (en) {
      x = side > 0 ? ax : ax - w;
      y = ay - h * 0.5 + el._i * h * 0.9;
    } else {
      // vertical columns read right to left: the first line is the rightmost one
      x = side > 0 ? ax + (el._n - 1 - el._i) * w * 0.82 : ax - (el._i + 1) * w * 0.82;
      y = top;
    }
    x = Math.max(8, Math.min(W - w - 8, x));
    if (en) y = Math.max(H * 0.05, Math.min(H * 0.84 - h, y));
    el.style.left = `${x}px`; el.style.top = `${y}px`; el.style.transform = 'none';
  }
}
// A passing thought of the traveler's, in the left column.
let thoughtEl = null;
function thought(key, hold = 4) {
  unsay(thoughtEl); // one thought at a time in the column
  const el = thoughtEl = say(key, 'v left');
  after(hold, () => { unsay(el); if (thoughtEl === el) thoughtEl = null; });
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
  if (activeScene === 'valley') { if (taskSig) { taskSig = ''; taskEl.classList.remove('show'); } return; }
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
// quiet: also offer "……" (and waiting 14 s counts as that); off for a line the traveler just says.
// wait: with quiet off, the first reply is said by itself after this many seconds.
function ask(keys, done, { quiet = true, wait = 0 } = {}) {
  choicesEl.innerHTML = '';
  const all = quiet ? [...keys, 'sil'] : [...keys];
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
  if (quiet) after(14, () => { if (choiceDone === mine) answer('sil'); });
  else if (wait) after(wait, () => { if (choiceDone === mine) answer(keys[0]); });
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
const AUTO_SHOTS = new Set(['intro', 'inLook', 'opening', 'leaving', 'rest', 'sleep', 'wake', 'vLook', 'nTalk', 'nEnd']);

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
  for (const [px, pz] of LAMPS_IN) {
    if ((x - px) ** 2 + (z - pz) ** 2 < 0.36 * 0.36) return false;
  }
  return true;
};
const PILLARS_IN = [[-3.1, 2.2], [3.1, 2.2], [-3.1, -1.6], [3.1, -1.6]];
const LAMPS_IN = [[-2.3, 0.9], [2.3, 0.9], [-2.05, -2.05], [2.05, -2.05]]; // the lotus lamps on the floor
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

  if (state === 'snowNight') {
    // a slow drift past the temple in the falling snow; the line; then away to the valley
    const t = stateTime;
    takeTap();
    walker.group.visible = false;
    wantPos.lerpVectors(SNOW_FROM, SNOW_TO, ss(t, 0, 13));
    wantLook.copy(SNOW_LOOK);
    camLag = 1.2;
    if (t > 0.3) once('sn-in', () => fade(0, false, 3200));
    if (t > 3.0) once('sn-line', () => { lines.dream = say('sutra', 'v'); sound.bowl(294, 0.14); });
    if (t > 9.5) once('sn-x', () => unsay(lines.dream));
    if (t > 10.5) once('sn-out', () => fade(1, false, 2400));
    if (t > 13.2) once('sn-go', () => goValley());
  }

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
// Night: the traveler rises and the view turns to the side of the hall, where a daybed
// has been laid out by the wall. A thank-you; then the traveler lies down, the prologue's
// last words over the ceiling, and sleep. In the dark, one quiet line (the snow fell all
// night); then morning, somewhere else.
const BED_LOOK = new THREE.Vector3(-3.72, 0.45, 0.3);
const BED_SIDE = new THREE.Vector3(-2.5, EYE_Y - 0.04, 0.45);   // standing beside the daybed
const BED_LIE = new THREE.Vector3(-3.55, 0.8, 0.95);            // lying on one side, head at the far end
const BED_UP = new THREE.Vector3(0, 1.75, -3.1);                // across the floor to the far candles and the Buddha
const restFrom = new THREE.Vector3();
function goodNight() {
  sound.bowl(392, 0.34);
  setTimeout(() => sound.muyu(8, 0.85, 0.2), 1200);
  sound.musicLevel(1.15, 3);
  setState('rest');
}

// Asleep: outside, the temple in the night snow, the lanterns lit. One line, then morning
// somewhere else.
const SNOW_FROM = new THREE.Vector3(7.2, 2.4, 13.5), SNOW_TO = new THREE.Vector3(4.6, 2.1, 12.2), SNOW_LOOK = new THREE.Vector3(-0.6, 4.9, -5);
function snowNight() {
  activeScene = 'out';
  document.body.classList.add('out');
  renderPass.scene = outside.scene;
  bloom.strength = 0.6; bloom.threshold = 0.85;
  grade.uniforms.uVig.value = 0.45; grade.uniforms.uWarm.value = 0.12; grade.uniforms.uNight.value = 1;
  sound.ambience({ wind: 0.35, drone: 0, muffle: false });
  walker.group.visible = false;
  setState('snowNight');
  camPos.copy(SNOW_FROM); camLook.copy(SNOW_LOOK);
  wantPos.copy(SNOW_FROM); wantLook.copy(SNOW_LOOK);
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

  if (state === 'rest' || state === 'sleep') {
    inside.glow = Math.min(1, inside.glow + dt / 4);
    grade.uniforms.uWarm.value = inside.glow;
    bloom.strength = 0.55 + inside.glow * 0.06;
  }
  if (state === 'rest') {
    // rising off the cushion, the eyes turn from the Buddha to the side of the hall:
    // a daybed glows in by the wall, under the window
    const t = stateTime;
    wantPos.copy(EYE_ALTAR); wantPos.y += ss(t, 0, 1.6) * 0.12;
    wantLook.lerpVectors(BUDDHA_FACE, BED_LOOK, ss(t, 0.8, 4.4));
    camLag = 0.9;
    inside.showBed(ss(t, 1.6, 4.6));
    takeTap();
    // the traveler's answer is a bubble to tap: 谢谢
    if (t > 4.8) once('r-ask', () => ask(['thx'], () => {
      thought('thx', 2.6);
      sound.bowl(523, 0.12);
      after(3.0, () => { restFrom.copy(camPos); setState('sleep'); });
    }, { quiet: false, wait: 6 }));
  }
  if (state === 'sleep') {
    takeTap();
    const t = stateTime;
    // a few slow steps to the daybed...
    const w = ss(t, 0, 5.2);
    wantPos.lerpVectors(restFrom, BED_SIDE, w);
    wantPos.y += Math.sin(t * 6.5) * 0.012 * Math.sin(w * Math.PI);
    wantLook.copy(BED_LOOK);
    // ...then down onto it, watching the far candlelight on the altar
    const l = ss(t, 5.2, 9.0);
    wantPos.lerp(BED_LIE, l);
    wantLook.lerp(BED_UP, ss(t, 5.6, 9.4));
    camLag = 0.7;
    // the body goes with the eyes (and stays hidden behind them)
    PI_.x = wantPos.x; PI_.z = wantPos.z;
    if (t > 9.4) once('e1', () => (lines.e1 = say('e1', 'v')));
    if (t > 11.4) once('e2', () => (lines.e2 = say('e2', 'v left')));
    // drowsy: the eyes fall shut, open a little, then close
    if (t > 15.6) once('z1', () => { unsay(lines.e1); unsay(lines.e2); fade(0.65, false, 1400); sound.musicLevel(0.5, 5); });
    if (t > 17.2) once('z2', () => fade(0.3, false, 1000));
    if (t > 18.4) once('z3', () => fade(1, false, 3000));
    if (t > 21.8) once('e4', snowNight);
  }

  if (state !== 'inWalk') { walkerIn.group.position.set(PI_.x, 0, PI_.z); walkerIn.group.rotation.y = PI_.yaw; }

}

// ---------------------------------------------------------------- 第一章 · 落花谷
let valley = null;
let nian = null;
const canStandValley = (x, z, b) => !valleyBlocked(x, z, valley.colliders) && Math.abs(valleyHeight(x, z) - valleyHeight(b.x, b.z)) < 0.6;
const wakeFrom = new THREE.Vector3(), wakeLook = new THREE.Vector3();

function goValley() {
  if (!valley) {
    valley = buildValley();
    nian = new Nian(valley, sound);
    renderer.compile(valley.scene, camera);
  }
  valley.scene.add(walker.group);
  activeScene = 'valley';
  document.body.classList.add('out');
  renderPass.scene = valley.scene;
  bloom.strength = 0.42; bloom.threshold = 0.9;
  grade.uniforms.uVig.value = 0.3; grade.uniforms.uWarm.value = 0.3; grade.uniforms.uNight.value = 0;
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
  valley.update(dt * flow, camera.position, vh);
  tmp.set(P.x, camY + 1.9, P.z);

  // Waking, through the traveler's eyes: a slow blink out of the dark, the blossom overhead
  // (诶 我怎么会在这里); the eyes come down to the valley and look left and right (这是哪);
  // then the view draws back out of the traveler to behind them.
  if (state === 'wake') {
    const t = stateTime;
    takeTap();
    if (t > 0.4) once('w-open1', () => fade(0.55, false, 1600));
    if (t > 2.3) once('w-blink', () => fade(0.9, false, 450));
    if (t > 2.9) once('w-open2', () => fade(0, false, 2600));
    if (t > 3.6) once('vl-w1', () => thought('w1', 4.4));
    if (t > 9.0) once('vl-w2', () => thought('w2', 4.2));
    orbit(tmp, portrait ? 6.4 : 5.6, null);
    const ahead = v3.set(P.x + 0.4, P.y + 1.3, P.z - 12);
    // a look to the left, to the right, and ahead again
    ahead.x += 7 * (ss(t, 8.2, 9.8) - 2 * ss(t, 10.4, 12.4) + ss(t, 13.0, 14.4));
    const down = ss(t, 5.2, 8.0), back = ss(t, 14.2, 18.4);
    const look = tmp.copy(wakeLook).lerp(ahead, down);
    wantLook.lerpVectors(look, wantLook, back);
    wantPos.lerpVectors(wakeFrom, wantPos, back);
    tmp.set(P.x, camY + 1.9, P.z);
    wantPos.y = Math.max(wantPos.y, valleyHeight(wantPos.x, wantPos.z) + 0.3);
    camLag = 0.5;
    if (t > 13.6) once('w-title', () => titleEl.classList.add('show'));
    const { f, s } = moveInput();
    if (t > 18.4 || (t > 14 && (f !== 0 || s !== 0))) {
      once('vl-w1', () => thought('w1', 3.0));
      setState('valley');
      after(2.6, () => titleEl.classList.remove('show'));
      setTimeout(() => { if (state === 'valley' && !fired.has('v-moved')) hint('move'); }, 3500);
    }
  }

  if (state === 'valley') {
    const sp = stepBody(P, dt, { canStand: canStandValley, speed: 1.4, runMul: 1.7 });
    placeWalkerOut(dt);
    if (walker.consumeStep() && sp > 0.2) sound.step(true);
    if (sp > 0.3 && stateTime > 2) once('v-moved', () => setTimeout(() => { if (hintKey === 'move') hint(''); }, 3000));
    orbit(tmp, portrait ? 6.4 : 5.6, null);
    wantPos.y = Math.max(wantPos.y, valleyHeight(wantPos.x, wantPos.z) + 0.5);
    camLag = lerp(0.6, 0.18, ss(stateTime, 0, 2));
    takeTap();
    // down the path, someone sitting under a tree: 那里好像有个人, 去看看好了
    const g = nian.girl.position;
    const gd = Math.hypot(P.x - g.x, P.z - g.z);
    if (gd < 21 && stateTime > 1.5 && !voicing()) once('v-see', () => { thought('s1', 3.0); after(3.4, () => thought('s2', 3.0)); });
    if (gd < 3.0) startNianTalk();
  }

  // Keeping the blossom: holding stops the world (the petals hang in the air), but 阿念 and
  // her grandmother on the path stop with it. Only letting go brings the grandmother.
  if (state === 'nHold') {
    takeTap();
    P.vx = P.vz = 0;
    placeWalkerOut(dt);
    const still = holding && stateTime > 0.6;
    flow = damp(flow, still ? 0 : 1, still ? 7 : 3.2, dt);
    grade.uniforms.uStill.value = 1 - flow;
    if (still !== wasStill) {
      wasStill = still;
      sound.ambience({ wind: still ? 0.04 : 0.34, drone: 0, muffle: still });
      if (still && !fired.has('h-first')) { fired.add('h-first'); sound.bowl(784, 0.06); }
      if (still) onFreeze();
    }
    if (still) holdTotal += dt;
    // held, the view drifts slowly in among the hanging petals; let go, it eases back
    pushK = damp(pushK, still ? 1 : 0, still ? 0.32 : 1.4, dt);
    const t = stateTime;
    // the traveler thinking aloud: what is happening, and what one might wish
    if (t > 1.4) once('m1', () => thought('m1', 3.2));
    if (t > 4.8) once('m2', () => thought('m2', 3.2));
    if (t > 8.2 && !fired.has('h-first')) once('m3', () => { thought('m3', 3.8); after(1.4, () => { if (!fired.has('h-first')) hint('keep'); }); });
    if (t > 24 && !fired.has('h-first')) once('m3b', () => { thought('m3', 3.8); hint('keep'); });
    if (still && hintKey === 'keep') hint('');
    if (!still && hintKey === 'nLet') hint('');
    // once the traveler has stopped it and let go (or after a while anyway), the petals fall
    // again and her grandmother comes into sight down the path
    if ((holdTotal > 0.8 || t > 36) && !still && !fired.has('elderGo')) {
      fired.add('elderGo');
      after(1.8, () => { nian.elderComes(1); after(2.2, () => voice(['g9'], GIRL)); });
    }
    holdCamera(t, portrait, pushK);
    // she has come far enough: the last gust, and she walks in under it
    if (fired.has('elderGo') && nian.elder.visible && nian.progress > 0.8 && !still) { hint(''); flow = 1; grade.uniforms.uStill.value = 0; setState('nEnd'); }
  }

  // the meeting: the traveler stops and turns to her; a quiet two-shot from the side
  if (state === 'nTalk' || state === 'nEnd') {
    takeTap();
    P.vx = P.vz = 0;
    placeWalkerOut(dt);
  }
  if (state === 'nTalk') {
    const g = nian.girl.position;
    P.yaw = angleLerp(P.yaw, Math.atan2(-(g.x - P.x), -(g.z - P.z)), Math.min(1, dt * 3));
    // a few more steps, to stand near her
    const gd = Math.hypot(g.x - P.x, g.z - P.z);
    if (gd > 2.1) { const st = Math.min(gd - 2.1, 1.1 * dt); P.x += (g.x - P.x) / gd * st; P.z += (g.z - P.z) / gd * st; placeWalkerOut(dt); }
    const mx = (P.x + g.x) / 2, mz = (P.z + g.z) / 2;
    const dx = g.x - P.x, dz = g.z - P.z, d = Math.hypot(dx, dz) || 1;
    // beside the pair, on the side away from her tree, a little above
    let nx = -dz / d, nz = dx / d;
    if ((nian.treePos.x - mx) * nx + (nian.treePos.z - mz) * nz > 0) { nx = -nx; nz = -nz; }
    const back = portrait ? 5.2 : 4.2;
    wantPos.set(mx + nx * back - dx / d * 1.2, valleyHeight(mx, mz) + 1.9, mz + nz * back - dz / d * 1.2);
    wantLook.set(mx, valleyHeight(mx, mz) + 1.25, mz);
    camLag = 1.0;
  }

  if (state === 'nEnd') updateNianEnd(dt, portrait);
  nian.update(dt * flow, P);
}

const GIRL = { cls: 'voice girl', gap: 1.7, hold: 3.2 };
const ELDER = { cls: 'voice elder', gap: 1.9, hold: 3.6 };
function startNianTalk() {
  if (fired.has('nTalk')) return;
  fired.add('nTalk');
  hint('');
  setState('nTalk');
  // the traveler says hello; she gets up from her stone and turns round
  thought('hi', 2.6);
  nian.lookAt = P;
  after(1.0, () => nian.standUp());
  after(5.0, () => {
    const a = voice(['g1', 'g2'], GIRL);
    after(a + 0.3, () => {
      const b = voice(['g3', 'g4'], GIRL);
      after(b + 0.2, startHold);
    });
  });
}
// The wind rises. A cut to the wide shot: the traveler beside 阿念 under her tree, the path
// beyond it where her grandmother has just come into sight, far off.
let flow = 1, wasStill = false, holdTotal = 0, pushK = 0;
function startHold() {
  const tp = nian.treePos, g = nian.girl.position;
  // a step behind her and to the side, so the view down the path stays open
  P.x = g.x - 0.75; P.z = g.z - 0.7; P.vx = P.vz = 0;
  P.yaw = Math.atan2(-(tp.x - P.x), -(tp.z - P.z));
  bodyY = null; placeWalkerOut();
  nian.lookAt = tp;
  nian.startWind();
  sound.ambience({ wind: 0.34, drone: 0, muffle: false });
  valley.petals.uniforms.uWind.value.set(1.1, 0, 0.55);
  flow = 1; wasStill = false; holdTotal = 0; pushK = 0;
  setState('nHold');
  holdCamera(0, camera.aspect < 0.8);
  camPos.copy(wantPos); camLook.copy(wantLook);
  after(1.6, () => { if (state === 'nHold') hint('keep'); });
}
// Every time the world stops, the traveler notices something: the petals, then 阿念, and once
// her grandmother is on the path, that she has stopped too, and what that means. Lines not yet
// seen come first, one after another while the hold lasts; after that the plain fact again.
let freezeId = 0;
function onFreeze() {
  const id = ++freezeId;
  const elderOn = fired.has('elderGo');
  const seq = elderOn ? ['h4', 'h3', 'r1'] : ['h1', 'h2'];
  let list = seq.filter((k) => !fired.has('t-' + k));
  if (!list.length) list = [seq[0]];
  const step = (i) => {
    if (id !== freezeId || !holding || state !== 'nHold') return;
    if (i >= list.length) { if (elderOn || fired.has('t-h2')) hint('nLet'); return; }
    fired.add('t-' + list[i]);
    thought(list[i], 3.4);
    after(i + 1 < list.length ? 3.6 : 2.6, () => step(i + 1));
  };
  after(0.4, () => step(0));
}
function holdCamera(t, portrait, push = 0) {
  const tp = nian.treePos;
  const cz = tp.z + (portrait ? 9 : 7.5);
  wantPos.set(valleyPathX(cz) + 0.8, tp.y + 2.1, cz);
  // the tree, and the path beyond it where she is coming
  wantLook.set(tp.x - 1.4, tp.y + 1.9, tp.z - 3.5);
  if (push > 0.001) {
    // in under the edge of the crown, among the petals in the air
    const k = push * push * (3 - 2 * push);
    // (from the tree's far side, so 阿念 and the traveler sit at the edge of the frame and the
    // path where the grandmother stands is clear in the middle)
    wantPos.lerp(v3.set(tp.x + 0.3, tp.y + 1.65, tp.z + 3.2), k);
    wantLook.lerp(v3.set(tp.x - 1.9, tp.y + 1.3, tp.z - 2.4), k);
  }
  camLag = 1.2;
}
// The end: the full tree; a gust takes it all; the grandmother comes up the path.
// A wide shot from beside the tree, looking down the path she comes along.
function updateNianEnd(dt, portrait) {
  const t = stateTime, tp = nian.treePos;
  // from the wide shot, the view drifts down the path to where they meet
  if (!closeShot) {
    holdCamera(t, portrait);
    wantLook.lerp(tmp.set(tp.x - 2.8, tp.y + 1.3, tp.z - 7), ss(t, 3, 9));
  }
  if (t > 0.2) once('ne2', () => {
    nian.gust();
    sound.ambience({ wind: 0.7, drone: 0, muffle: false });
    valley.petals.uniforms.uWind.value.set(3.2, 0, 1.6);
    nian.rainWind.set(2.2, 0, 1.1);
    nian.hop = 0;
  });
  if (t > 4.5) once('ne3', () => { sound.ambience({ wind: 0.22, drone: 0, muffle: false }); valley.petals.uniforms.uWind.value.set(0.55, 0, 0.3); nian.rainWind.set(0.45, 0, 0.42); });
  if (t > 2.4) once('ne5', () => voice(['o1'], ELDER));
  if (t > 4.8) once('ne6', () => { nian.lookAt = null; nian.runTo = nian.elderPos; nian.girlMode = 'run'; voice(['g7'], GIRL); });
  if (t > 9.4) once('ne7', () => voice(['g8'], GIRL));
  if (t > 12.8) once('ne8', () => voice(['o2', 'o3'], ELDER));
  // closer: the grandmother turns to the traveler and greets them
  if (t > 19.4) once('nc0', () => fade(1, false, 700));
  if (t > 20.3) once('nc1', () => {
    closeShot = true;
    const e = nian.elder.position, g = nian.girl.position;
    let ux = g.x - e.x, uz = g.z - e.z;
    const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    // the traveler a couple of steps off to her side, 阿念 at her other hand
    let sx = -uz, sz = ux;
    if (sz < 0) { sx = -sx; sz = -sz; } // the side toward the tree, where the traveler was
    P.x = e.x + sx * 1.5 - ux * 0.3; P.z = e.z + sz * 1.5 - uz * 0.3; P.vx = P.vz = 0;
    closeU.set(ux, 0, uz); closeS.set(sx, 0, sz);
    P.yaw = Math.atan2(-(e.x - P.x), -(e.z - P.z));
    bodyY = null; placeWalkerOut();
    nian.girlMode = 'idle'; nian.runTo = null;
    nian.lookAt = P; nian.elderLook = P;
    closeCamera(portrait);
    camPos.copy(wantPos); camLook.copy(wantLook);
    fade(0, false, 1000);
    after(1.4, () => {
      // thanks first; then a word about the blossom; then a send-off
      const a = voice(['o4'], ELDER);
      after(a + 0.3, () => {
        const b = voice(['o5', 'o6'], ELDER);
        after(b + 0.4, () => {
          const c = voice(['o7', 'o8'], ELDER);
          after(c + 0.6, () => {
            nian.girlMode = 'wave';
            after(3.6, () => { fadeEl.classList.add('pale'); fade(1, false, 4200); sound.musicLevel(0.4, 6); });
            after(8.6, () => {
              titleMain = 'ch1Title'; titleSub = 'ch1End'; renderTitle();
              document.body.classList.add('ended');
              titleEl.classList.add('show');
              againEl.classList.add('show');
            });
          });
        });
      });
    });
  });
  if (closeShot) closeCamera(portrait);
  if (nian.girlMode === 'run') nian.runTo = nian.elderPos;
}
let closeShot = false;
// Over the traveler's shoulder: the grandmother's face, 阿念 at her side.
const closeU = new THREE.Vector3(), closeS = new THREE.Vector3();
function closeCamera(portrait) {
  const e = nian.elder.position, back = portrait ? 1.9 : 1.25;
  const cx = P.x + closeS.x * back + closeU.x * 0.5, cz = P.z + closeS.z * back + closeU.z * 0.5;
  wantPos.set(cx, valleyHeight(P.x, P.z) + 1.62, cz);
  const lx = e.x + closeU.x * 0.45, lz = e.z + closeU.z * 0.45;
  wantLook.set(lx, valleyHeight(e.x, e.z) + 1.2, lz);
  camLag = 0.9;
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
  placeVoices();

  if (activeScene === 'valley') {
    // the traveler is hidden while the view is behind their eyes
    v3.set(P.x, P.y + EYE_Y, P.z);
    walker.group.visible = camera.position.distanceTo(v3) > 0.75;
  }
  if (activeScene === 'in') {
    updateStick(dt);
    // first person: hide the traveler while the camera is behind their eyes
    v3.copy(walkerIn.group.position).y += EYE_Y;
    walkerIn.group.visible = state !== 'sleep' && camera.position.distanceTo(v3) > 0.75;
  }

  grade.uniforms.uTime.value = (grade.uniforms.uTime.value + dt) % 100;
}

// Pre-compile both scenes so the door transition does not hitch.
renderer.compile(outside.scene, camera);
renderer.compile(inside.scene, camera);
requestAnimationFrame(frame);

// Debug hook for verification: window.__game.jump('ending') etc.
window.__game = {
  // render one frame now and return it as a JPEG (works while the tab is in the background)
  shot(q = 0.75) { composer.render(); return renderer.domElement.toDataURL('image/jpeg', q); },
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
  get nian() { return nian; },
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
    if (target === 'valleyWalk') { fade(1, false, 10); goValley(); fired.add('vl-w1'); fired.add('vl-w2'); stateTime = 18.3; }
    if (target === 'nian') {
      fade(1, false, 10); goValley(); fade(0, false, 600);
      const g = nian.girl.position; P.x = g.x - 1.5; P.z = g.z + 6; P.yaw = 0; placeWalkerOut(); setState('valley');
    }
    if (target === 'nianQuest') {
      fade(1, false, 10); goValley(); fade(0, false, 600);
      const g = nian.girl.position; P.x = g.x - 1.2; P.z = g.z + 2.5; P.yaw = 0; placeWalkerOut();
      fired.add('nTalk'); nian.standNow(); nian.ready.then(() => { startHold(); nian.windNow(); });
    }
    if (target === 'nianEnd') {
      fade(1, false, 10); goValley(); fade(0, false, 600);
      const g = nian.girl.position; P.x = g.x - 1.2; P.z = g.z + 2.2; P.yaw = 0; placeWalkerOut();
      fired.add('nTalk'); nian.standNow(); nian.ready.then(() => { startHold(); nian.windNow(); fired.add('elderGo'); nian.elderComes(0.8 * (nian.elderPath.length - 1)); hint(''); setState('nEnd'); });
    }
    if (target === 'talk1') {
      // the incense already offered, the first talk begins
      enterInside(); document.body.classList.remove('cine'); PI_.x = 0; PI_.z = INSIDE.stopZ; PI_.yaw = 0; walkerIn.group.position.set(PI_.x, 0, PI_.z);
      stick.visible = true; stickMode = 'placed';
      stickPos.copy(inside.burnerTop).add(new THREE.Vector3(-0.05, -0.09, 0.02)); stick.userData.emberMat.emissiveIntensity = 5; inside.smokeNew.active = true;
      camPos.copy(EYE_ALTAR); setState('talk');
      after(1.2, () => talk(TALK_FIRST, 0, () => after(0.8, leaveInside)));
    }
    if (target === 'snow') { fired.add('visited'); quietComplete(); enterInside(); document.body.classList.remove('cine'); fade(1, false, 10); snowNight(); }
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
      camPos.copy(EYE_ALTAR); goodNight();
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
  ['第一章 · 落花谷', [['valley', '醒来'], ['valleyWalk', '漫步'], ['nian', '阿念'], ['nianQuest', '留花'], ['nianEnd', '落花祭']]],
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
