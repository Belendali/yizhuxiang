import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { snowyMaterial, makeCanvasTexture, rand, makeNoise2D } from './materials.js';
import { addTempleDetail } from './temple-detail.js';
import { propModel, materialsOf } from './models.js';

// World layout (meters). Traveler walks from +Z toward the temple at -Z.
export const LAYOUT = {
  startZ: 40,
  stairBottomZ: 4.3,
  stairTopZ: -0.7,
  stairRise: 0.3,
  stairCount: 8,
  floorY: 2.4,
  facadeZ: -3.6,
  doorStopZ: -2.75,
  hallCZ: -6.8,
};

const noise = makeNoise2D(7);

export function groundHeight(x, z) {
  // Gentle drifts, flattened along the path and courtyard, rising into the valley walls.
  let h = (noise.fbm(x * 0.06, z * 0.06) - 0.5) * 2.2 + (noise.fbm(x * 0.25 + 9, z * 0.25) - 0.5) * 0.35;
  const pathW = THREE.MathUtils.smoothstep(Math.abs(x - pathX(z)), 2.2, 7);
  const court = THREE.MathUtils.smoothstep(Math.hypot(x * 0.8, (z + 3) * 0.9), 9, 16);
  const flat = Math.max(z > -2 ? 1 - pathW : 0, 1 - court);
  h *= 1 - flat * 0.97;
  const side = Math.max(0, Math.abs(x) - 13);
  h += Math.pow(side, 1.35) * 0.32;
  const back = Math.max(0, -z - 16);
  h += Math.pow(back, 1.3) * 0.22;
  return h;
}

// ---------- Walkable surface + blocking (used by free movement) ----------
export function walkHeight(x, z) {
  const L = LAYOUT;
  if (Math.abs(x) < 7 && z > -12.7 && z < L.stairTopZ) return L.floorY;
  // the stairs are 4.4 wide; a hair of margin so walking along their edge does not flicker to the snow
  if (Math.abs(x) < 2.24 && z >= L.stairTopZ && z <= L.stairBottomZ) return pathY(z);
  return groundHeight(x, z);
}

export function isBlockedOut(x, z, colliders) {
  if (Math.abs(x) > 17 || z > 46 || z < -15) return true;
  // the hall itself (entered only through the door trigger)
  if (Math.abs(x) < 4.15 && z < LAYOUT.facadeZ + 0.25 && z > -10.4) return true;
  // the platform's balustrade (front, either side of the stairs, and down both sides)
  const onPlat = Math.abs(x) < 7.2 && z < -0.4 && z > -12.9;
  if (onPlat && ((z > -1.15 && Math.abs(x) > 2.5) || Math.abs(x) > 6.55)) return true;
  // the sloped stone borders beside the stairs
  if (z > -0.8 && z < LAYOUT.stairBottomZ + 0.45 && Math.abs(x) > 2.02 && Math.abs(x) < 2.75) return true;
  for (const c of colliders) {
    const dx = x - c.x, dz = z - c.z;
    if (dx * dx + dz * dz < c.r * c.r) return true;
  }
  return false;
}

export function pathX(z) {
  if (z <= 6) return 0;
  const k = Math.min(1, (z - 6) / 8);
  return Math.sin((z - 6) * 0.14) * 0.9 * k;
}

export function pathY(z) {
  const L = LAYOUT;
  if (z >= L.stairBottomZ) return groundHeight(pathX(z), z) * 0; // path is flattened to 0
  if (z <= L.stairTopZ) return L.floorY;
  const run = (L.stairBottomZ - L.stairTopZ) / L.stairCount;
  // the top of the tread under z: step i is a box rise*(i+1) high
  const q = (L.stairBottomZ - z) / run;
  return L.stairRise * Math.min(L.stairCount, Math.floor(q) + 1);
}

function stoneTexture() {
  return makeCanvasTexture(512, 256, (g, w, h) => {
    g.fillStyle = '#7b847b'; g.fillRect(0, 0, w, h);
    const r = rand(11);
    for (let i = 0; i < 2500; i++) {
      const v = 100 + r() * 50;
      g.fillStyle = `rgba(${v},${v + 6},${v},0.18)`;
      g.fillRect(r() * w, r() * h, 2 + r() * 6, 2 + r() * 6);
    }
    g.strokeStyle = 'rgba(30,36,32,0.55)'; g.lineWidth = 3;
    const rows = 4;
    for (let y = 0; y < rows; y++) {
      const y0 = (y / rows) * h;
      g.beginPath(); g.moveTo(0, y0); g.lineTo(w, y0); g.stroke();
      const off = (y % 2) * 64;
      for (let x = -off; x < w; x += 128 + r() * 30) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x, y0 + h / rows); g.stroke(); }
    }
  }, { repeat: [3, 1] });
}

function woodTexture(base = '#2c2a24') {
  return makeCanvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const r = rand(5);
    for (let i = 0; i < 160; i++) {
      const x = r() * w;
      g.strokeStyle = `rgba(${r() > 0.5 ? '255,240,210' : '0,0,0'},${0.03 + r() * 0.05})`;
      g.lineWidth = 1 + r() * 3;
      g.beginPath(); g.moveTo(x, 0);
      g.bezierCurveTo(x + (r() - 0.5) * 20, h * 0.3, x + (r() - 0.5) * 20, h * 0.7, x + (r() - 0.5) * 10, h);
      g.stroke();
    }
  });
}

// Lattice door / window: dark wood grid over warm translucent paper.
export function latticeTexture({ cols = 4, rows = 6, solidBottom = 0, emissive = false } = {}) {
  return makeCanvasTexture(256, 512, (g, w, h) => {
    const paperH = h * (1 - solidBottom);
    if (emissive) {
      g.fillStyle = '#000'; g.fillRect(0, 0, w, h);
      const grd = g.createRadialGradient(w / 2, paperH * 0.55, 10, w / 2, paperH * 0.55, w);
      grd.addColorStop(0, '#ffd9a0'); grd.addColorStop(1, '#c78a4a');
      g.fillStyle = grd; g.fillRect(0, 0, w, paperH);
    } else {
      g.fillStyle = '#d8c3a0'; g.fillRect(0, 0, w, paperH);
      g.fillStyle = '#2a2722'; g.fillRect(0, paperH, w, h - paperH);
    }
    g.fillStyle = emissive ? '#000' : '#26231e';
    const bar = 7;
    for (let c = 0; c <= cols; c++) g.fillRect((c / cols) * (w - bar), 0, bar, paperH);
    for (let r = 0; r <= rows; r++) g.fillRect(0, (r / rows) * (paperH - bar), w, bar);
    if (!emissive && solidBottom > 0) {
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 4;
      g.strokeRect(18, paperH + 18, w - 36, h - paperH - 36);
    }
    g.fillStyle = emissive ? '#000' : '#1f1c18';
    g.fillRect(0, 0, 12, h); g.fillRect(w - 12, 0, 12, h); g.fillRect(0, 0, w, 12); g.fillRect(0, h - 12, w, 12);
  });
}

function makeRoofGeometry({ Sx, Sz, y0, H, peak = 0.3, lift = 0.7, thick = 0.32, segU = 28, segV = 18 }) {
  // Concave pyramid roof (flat at the eaves, steep near the top) with upturned corners.
  const top = [], under = [], fascia = [];
  const sides = [
    (u, hx, hz) => [u * hx, hz],   // front (+z)
    (u, hx, hz) => [hx, -u * hz],  // right (+x)
    (u, hx, hz) => [-u * hx, -hz], // back (-z)
    (u, hx, hz) => [-hx, u * hz],  // left (-x)
  ];
  const surf = (side, u, v, dy) => {
    const hx = THREE.MathUtils.lerp(Sx, peak, v);
    const hz = THREE.MathUtils.lerp(Sz, peak, v);
    const [x, z] = sides[side](u, hx, hz);
    const y = y0 + H * Math.pow(v, 1.75) + lift * Math.pow(Math.abs(u), 4) * Math.pow(1 - v, 2) + dy;
    return [x, y, z];
  };
  const build = (arr, dy, flip) => {
    for (let s = 0; s < 4; s++) {
      for (let i = 0; i < segU; i++) {
        for (let j = 0; j < segV; j++) {
          const u0 = -1 + (2 * i) / segU, u1 = -1 + (2 * (i + 1)) / segU;
          const v0 = j / segV, v1 = (j + 1) / segV;
          const a = surf(s, u0, v0, dy), b = surf(s, u1, v0, dy), c = surf(s, u1, v1, dy), d = surf(s, u0, v1, dy);
          if (!flip) arr.push(...a, ...b, ...c, ...a, ...c, ...d);
          else arr.push(...a, ...c, ...b, ...a, ...d, ...c);
        }
      }
    }
  };
  build(top, 0, false);
  build(under, -thick, true);
  for (let s = 0; s < 4; s++) {
    for (let i = 0; i < segU; i++) {
      const u0 = -1 + (2 * i) / segU, u1 = -1 + (2 * (i + 1)) / segU;
      const a = surf(s, u0, 0, 0), b = surf(s, u1, 0, 0), c = surf(s, u1, 0, -thick), d = surf(s, u0, 0, -thick);
      fascia.push(...a, ...c, ...b, ...a, ...d, ...c);
    }
  }
  const mk = (arr) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    g.computeVertexNormals();
    return g;
  };
  // Make the top winding face outward/up.
  const topG = mk(top);
  const n = topG.attributes.normal;
  if (n.getY(Math.floor(n.count / 2)) < 0) {
    const p = topG.attributes.position.array;
    for (let i = 0; i < p.length; i += 9) for (let k = 0; k < 3; k++) { const t = p[i + 3 + k]; p[i + 3 + k] = p[i + 6 + k]; p[i + 6 + k] = t; }
    topG.computeVertexNormals();
    const pu = under; // under/fascia were built with the opposite winding, flip them too
    for (let i = 0; i < pu.length; i += 9) for (let k = 0; k < 3; k++) { const t = pu[i + 3 + k]; pu[i + 3 + k] = pu[i + 6 + k]; pu[i + 6 + k] = t; }
    for (let i = 0; i < fascia.length; i += 9) for (let k = 0; k < 3; k++) { const t = fascia[i + 3 + k]; fascia[i + 3 + k] = fascia[i + 6 + k]; fascia[i + 6 + k] = t; }
  }
  return { top: topG, under: mk(under), fascia: mk(fascia), surf };
}

function bulgyRope(points, { radius = 0.22, spans = 3, segs = 64 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points);
  const radialSegs = 22;
  const geo = new THREE.TubeGeometry(curve, segs, radius, radialSegs, false);
  const pos = geo.attributes.position;
  const radial = radialSegs + 1;
  const c = new THREE.Vector3(), v = new THREE.Vector3();
  const nSeg = spans;
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    curve.getPointAt(t, c);
    // fat in the middle of each hanging span, thin at the ties
    const local = (t * nSeg) % 1;
    const prof = 0.35 + 0.65 * Math.pow(Math.sin(Math.PI * local), 0.6);
    for (let j = 0; j < radial; j++) {
      const idx = i * radial + j;
      v.fromBufferAttribute(pos, idx).sub(c);
      const ang = (j / (radial - 1)) * Math.PI * 2;
      const twist = 1 + 0.12 * Math.sin(ang * 2 + t * 90);
      v.multiplyScalar(prof * twist);
      pos.setXYZ(idx, c.x + v.x, c.y + v.y, c.z + v.z);
    }
  }
  geo.computeVertexNormals();
  return geo;
}

function rockGeometry(seed, detail = 1) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.attributes.position;
  const r = rand(seed);
  const ox = r() * 50, oz = r() * 50;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = 0.75 + noise.fbm(v.x * 1.3 + ox, v.z * 1.3 + v.y * 0.7 + oz) * 0.55;
    v.multiplyScalar(d);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

function cliffGeometry(seed) {
  const g = new THREE.IcosahedronGeometry(1, 4);
  const p = g.attributes.position;
  const r = rand(seed);
  const ox = r() * 100, oy = r() * 100;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    let d = 0.72 + noise.fbm(v.x * 1.6 + ox, v.y * 1.6 + v.z * 1.1 + oy) * 0.6;
    // Terraced ledges so snow collects in bands like the reference painting.
    const ledge = Math.sin(v.y * 14 + noise.n(v.x * 3 + ox, v.z * 3) * 3) * 0.035;
    d += ledge;
    v.multiplyScalar(d);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  return g;
}

// A continuous rock wall wrapping the valley: tall faces, terraced ledges that catch snow,
// a jagged ridge line. Opening faces +Z (where the traveler comes from).
function valleyWallGeometry({ zc = 6, Rx = 36, Rz = 44, H = 46, thetaMax = 2.55, segT = 220, segY = 70, seed = 4 } = {}) {
  const r = rand(seed);
  const ox = r() * 100;
  const pos = [], idx = [];
  for (let j = 0; j <= segY; j++) {
    for (let i = 0; i <= segT; i++) {
      const th = -thetaMax + (2 * thetaMax * i) / segT;
      const v = j / segY;
      // ridge height varies along the wall; highest behind the temple
      const ridge = 0.55 + 0.45 * Math.cos(th * 0.8) + (noise.fbm(th * 2.2 + ox, 3.1) - 0.5) * 0.9;
      const y = -6 + v * H * Math.max(0.35, ridge);
      const n1 = noise.fbm(th * 6 + ox, y * 0.09);
      const n2 = noise.fbm(th * 22 + ox * 2, y * 0.35);
      // ledges: a sawtooth in y gives flat-ish shelves
      const ly = y * 0.32 + n1 * 2.5;
      const ledge = (ly - Math.floor(ly)) * 1.8;
      const lean = v * v * 7; // overhang slightly inward near the top
      const out = (n1 - 0.5) * 10 + (n2 - 0.5) * 2.4 + ledge - lean;
      const x = (Rx + out) * Math.sin(th);
      const z = zc - (Rz + out) * Math.cos(th);
      pos.push(x, y, z);
    }
  }
  const row = segT + 1;
  for (let j = 0; j < segY; j++) for (let i = 0; i < segT; i++) {
    const a = j * row + i, b = a + 1, c = a + row, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // ensure normals face the valley center
  const n = g.attributes.normal;
  const mid = Math.floor(segY / 3) * row + Math.floor(segT / 2); // behind the temple, facing +z
  if (n.getZ(mid) < 0) {
    for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
    g.setIndex(idx);
    g.computeVertexNormals();
  }
  return g.toNonIndexed();
}

/**
 * A snow-laden pine: stacked drooping skirts with ragged, needle-tipped edges.
 * Each skirt has a domed top (catches the snow) and a hollow underside (stays dark).
 */
function pineGeometry(seed = 1) {
  const rr = rand(seed);
  const pos = [];
  const tri = (a, b, c) => pos.push(...a, ...b, ...c);
  const tiers = 6 + Math.floor(rr() * 2);
  const H = 4.4 + rr() * 0.6;
  for (let i = 0; i < tiers; i++) {
    const t = i / (tiers - 1);
    const R = THREE.MathUtils.lerp(1.55, 0.34, Math.pow(t, 0.9)) * (0.9 + rr() * 0.2);
    const y0 = 0.55 + t * (H - 1.5);
    const h = THREE.MathUtils.lerp(1.15, 0.8, t);
    const n = 14;
    const turn = rr() * 6.28;
    const apex = [0, y0 + h, 0];
    const mid = [], rim = [], under = [];
    for (let k = 0; k < n; k++) {
      const a = turn + (k / n) * Math.PI * 2;
      // ragged rim: every other point a longer, lower needle tip
      const tip = k % 2 === 0;
      const rk = R * (tip ? 1.04 + rr() * 0.12 : 0.8 + rr() * 0.08);
      const droop = tip ? 0.16 + rr() * 0.12 : 0.02;
      const c = Math.cos(a), s = Math.sin(a);
      mid.push([c * rk * 0.52, y0 + h * 0.5 + rr() * 0.05, s * rk * 0.52]);
      rim.push([c * rk, y0 - droop * R, s * rk]);
      under.push([c * R * 0.28, y0 + h * 0.22, s * R * 0.28]);
    }
    for (let k = 0; k < n; k++) {
      const k2 = (k + 1) % n;
      tri(apex, mid[k2], mid[k]);
      tri(mid[k], mid[k2], rim[k2]);
      tri(mid[k], rim[k2], rim[k]);
      tri(rim[k], rim[k2], under[k2]);
      tri(rim[k], under[k2], under[k]);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  const trunk = new THREE.CylinderGeometry(0.1, 0.17, 1.1, 7).toNonIndexed();
  trunk.translate(0, 0.45, 0);
  trunk.deleteAttribute('uv'); // the skirts carry no uv
  return mergeGeometries([g, trunk]);
}

/** One flagstone: an irregular rounded slab, its top at y = 0. */
function flagstoneGeometry(rr, w, d) {
  // a rounded outline with slow lumps, not a polygon
  const n = 18;
  const p1 = rr() * 6.28, p2 = rr() * 6.28, a1 = 0.05 + rr() * 0.05, a2 = 0.03 + rr() * 0.04;
  const shape = new THREE.Shape();
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const j = 1 + a1 * Math.sin(a * 2 + p1) + a2 * Math.sin(a * 3 + p2);
    // a squarer ellipse, so neighbours sit close like laid stones
    const c = Math.cos(a), s = Math.sin(a);
    const sq = (v) => Math.sign(v) * Math.pow(Math.abs(v), 0.7);
    const x = sq(c) * w * 0.5 * j, y = sq(s) * d * 0.5 * j;
    if (k === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
  }
  shape.closePath();
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.05, bevelSegments: 2, curveSegments: 1 });
  g.rotateX(-Math.PI / 2);
  g.translate(0, -0.135, 0);
  return g;
}

export function buildExterior() {
  const L = LAYOUT;
  const scene = new THREE.Scene();
  const fogColor = new THREE.Color(0xb9c4c1);
  scene.fog = new THREE.FogExp2(fogColor, 0.0085);
  scene.background = fogColor;
  const r = rand(42);
  const colliders = []; // {x, z, r} circles the traveler cannot enter

  // ---------- Sky dome ----------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: new THREE.Color(0x6a8086) }, uHor: { value: new THREE.Color(0xc4cdca) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; varying vec3 vP;
        void main(){ float h = clamp(vP.y * 1.6, 0.0, 1.0); gl_FragColor = vec4(mix(uHor, uTop, pow(h, 0.7)), 1.0); }`,
    })
  );
  sky.renderOrder = -1;
  scene.add(sky);

  // ---------- Lights ----------
  const hemi = new THREE.HemisphereLight(0xd6e2e8, 0x6f7c73, 1.15);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xf3f1ea, 1.9);
  sun.position.set(-26, 42, 18);
  sun.target.position.set(0, 0, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -26; sc.right = 26; sc.top = 34; sc.bottom = -30; sc.near = 5; sc.far = 120;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---------- Ground ----------
  const gGeo = new THREE.PlaneGeometry(280, 280, 220, 220);
  gGeo.rotateX(-Math.PI / 2);
  gGeo.translate(0, 0, -20);
  const gp = gGeo.attributes.position;
  for (let i = 0; i < gp.count; i++) gp.setY(i, groundHeight(gp.getX(i), gp.getZ(i)));
  gGeo.computeVertexNormals();
  const groundMat = snowyMaterial({ color: 0xb9c3c3, snow: 0xf1f4f3, threshold: 0.86, softness: 0.08, noiseScale: 0.2, noiseAmt: 0.25, variation: 0.06 });
  const ground = new THREE.Mesh(gGeo, groundMat);
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- Flagstone path, half buried ----------
  // irregular rounded stones in staggered courses; some sit lower and tilt, so snow drifts over them
  const slabMat = snowyMaterial({ color: 0x69726c, snow: 0xeef2f0, threshold: 0.88, softness: 0.07, noiseScale: 1.4, noiseAmt: 0.55, variation: 0.22 });
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sv = new THREE.Vector3(), pv = new THREE.Vector3();
  const flags = [];
  let course = 0;
  for (let z = L.stairBottomZ + 0.7; z < 46; course++) {
    const depth = 0.72 + r() * 0.22;
    const widths = course % 2 ? [1.2, 1.3] : [0.85, 0.95, 0.75];
    const total = widths.reduce((a, b) => a + b, 0);
    let x0 = -total / 2;
    for (const w0 of widths) {
      const w = w0 * (0.92 + r() * 0.1);
      const g = flagstoneGeometry(r, w - 0.13, depth - 0.1);
      const sunk = r() < 0.3 ? 0.03 + r() * 0.05 : 0;
      q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.05, (r() - 0.5) * 0.18, (r() - 0.5) * 0.05));
      pv.set(pathX(z) + x0 + w0 / 2 + (r() - 0.5) * 0.06, groundHeight(pathX(z) + x0 + w0 / 2, z) + 0.07 - sunk, z + (r() - 0.5) * 0.08);
      m.compose(pv, q, sv.set(1, 1, 1));
      g.applyMatrix4(m);
      flags.push(g);
      x0 += w0;
    }
    z += depth + 0.02 + r() * 0.04;
  }
  const path = new THREE.Mesh(mergeGeometries(flags), slabMat);
  path.receiveShadow = true;
  scene.add(path);

  // ---------- Stone stairs & platform ----------
  const stoneTex = stoneTexture();
  const stairMat = snowyMaterial({ color: 0x8a948c, threshold: 0.93, softness: 0.08, noiseScale: 1.2, noiseAmt: 0.45, variation: 0.2 });
  stairMat.map = stoneTex;
  const run = (L.stairBottomZ - L.stairTopZ) / L.stairCount;
  for (let i = 0; i < L.stairCount; i++) {
    const h = L.stairRise * (i + 1);
    const step = new THREE.Mesh(new THREE.BoxGeometry(4.4, h, run + 0.02), stairMat);
    step.position.set(0, h / 2, L.stairBottomZ - run * (i + 0.5));
    step.castShadow = step.receiveShadow = true;
    scene.add(step);
  }
  const platMat = snowyMaterial({ color: 0x89928a, threshold: 0.9, softness: 0.08, noiseScale: 0.8, noiseAmt: 0.4, variation: 0.15 });
  platMat.map = stoneTex;
  const plat = new THREE.Mesh(new THREE.BoxGeometry(14, L.floorY, 12), platMat);
  plat.position.set(0, L.floorY / 2, L.hallCZ + 0.1);
  plat.castShadow = plat.receiveShadow = true;
  scene.add(plat);

  // ---------- Temple hall ----------
  const temple = new THREE.Group();
  scene.add(temple);
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x3a3a32, roughness: 0.85, map: woodTexture() });
  const darkWood = new THREE.MeshStandardMaterial({ color: 0x24261f, roughness: 0.9 });
  const hallW = 7.8, hallD = 6.4, wallH = 3.5;
  const fy = L.floorY;
  const fz = L.facadeZ;
  const backZ = fz - hallD;
  const cz = (fz + backZ) / 2;

  const addBox = (w, h, d, x, y, z, mat = woodMat, shadow = true) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(x, y, z);
    b.castShadow = shadow; b.receiveShadow = true;
    temple.add(b);
    return b;
  };
  // side & back walls: timber-framed plaster, in temple-detail.js
  // inner glow wall (seen when the doors open)
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffb873, emissiveIntensity: 0.0 });
  const glowWall = new THREE.Mesh(new THREE.PlaneGeometry(hallW - 0.4, wallH), glowMat);
  glowWall.position.set(0, fy + wallH / 2, fz - 1.2);
  temple.add(glowWall);
  // interior darkness box so the glow reads as depth
  const innerDark = new THREE.Mesh(new THREE.BoxGeometry(hallW - 0.3, wallH - 0.05, 1.1), new THREE.MeshStandardMaterial({ color: 0x120f0c, side: THREE.BackSide, roughness: 1 }));
  innerDark.position.set(0, fy + wallH / 2, fz - 0.6);
  temple.add(innerDark);

  // pillars, bases and the painted main beam are in temple-detail.js
  addBox(hallW + 0.2, 0.18, 0.3, 0, fy + wallH - 0.62, fz + 0.12, darkWood);
  // lower wainscot on side bays
  for (const sx of [-1, 1]) addBox(2.2, 0.62, 0.14, sx * 2.62, fy + 0.31, fz, darkWood);

  // lattice side windows (faintly lit from inside)
  const winTex = latticeTexture({ cols: 5, rows: 6 });
  const winEmis = latticeTexture({ cols: 5, rows: 6, emissive: true });
  const winMat = new THREE.MeshStandardMaterial({ map: winTex, emissiveMap: winEmis, emissive: 0xffc88a, emissiveIntensity: 0.35, roughness: 0.9 });
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.3), winMat);
    w.position.set(sx * 2.62, fy + 0.62 + 1.15, fz + 0.01);
    temple.add(w);
  }
  // transom above doors
  const tr = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 0.42), winMat);
  tr.position.set(0, fy + wallH - 0.36, fz + 0.01);
  temple.add(tr);

  // doors (hinged at the outer edges)
  const doorTex = latticeTexture({ cols: 3, rows: 5, solidBottom: 0.36 });
  const doorEmis = latticeTexture({ cols: 3, rows: 5, solidBottom: 0.36, emissive: true });
  const doorMat = new THREE.MeshStandardMaterial({ map: doorTex, emissiveMap: doorEmis, emissive: 0xffc88a, emissiveIntensity: 0.45, roughness: 0.85, side: THREE.DoubleSide });
  const doorH = wallH - 0.72;
  const doors = [];
  for (const sx of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(sx * 1.4, fy + doorH / 2, fz);
    const d = new THREE.Mesh(new THREE.BoxGeometry(1.4, doorH, 0.08), [darkWood, darkWood, darkWood, darkWood, doorMat, doorMat]);
    d.position.x = -sx * 0.7;
    d.castShadow = true;
    hinge.add(d);
    // ring pull
    const pull = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 16), new THREE.MeshStandardMaterial({ color: 0x8b7444, metalness: 0.8, roughness: 0.4 }));
    pull.position.set(-sx * 1.25, -0.1, 0.07);
    hinge.add(pull);
    hinge.userData.sx = sx;
    temple.add(hinge);
    doors.push(hinge);
  }

  // bracket sets under the eaves are in temple-detail.js

  // roof
  const roofY0 = fy + wallH + 0.55;
  const roof = makeRoofGeometry({ Sx: 6.4, Sz: 5.7, y0: roofY0, H: 4.3, peak: 0.32, lift: 0.75, thick: 0.34 });
  const roofTop = new THREE.Mesh(roof.top, snowyMaterial({ color: 0x2c332f, snow: 0xf4f6f4, threshold: 0.28, softness: 0.1, noiseScale: 0.9, noiseAmt: 0.6, variation: 0.2, roughness: 0.9 }));
  const roofUnder = new THREE.Mesh(roof.under, new THREE.MeshStandardMaterial({ color: 0x1f221d, roughness: 0.95, side: THREE.DoubleSide }));
  const roofFascia = new THREE.Mesh(roof.fascia, new THREE.MeshStandardMaterial({ color: 0x1b1d19, roughness: 0.9, side: THREE.DoubleSide }));
  for (const rm of [roofTop, roofUnder, roofFascia]) { rm.position.z = cz; rm.castShadow = true; rm.receiveShadow = true; temple.add(rm); }

  // hip ridges: dark beams from each upturned corner to the peak, snow along their tops
  const ridgeMat = snowyMaterial({ color: 0x22261f, snow: 0xf3f5f3, threshold: 0.55, softness: 0.1, noiseScale: 3, noiseAmt: 0.5 });
  for (let s = 0; s < 4; s++) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const p = roof.surf(s, 1, i / 16 * 0.97, 0.08);
      pts.push(new THREE.Vector3(p[0], p[1], p[2] + cz));
    }
    const ridge = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.13, 8), ridgeMat);
    ridge.castShadow = true;
    temple.add(ridge);
    // small upturned ornament at the corner tip
    const tipP = roof.surf(s, 1, 0, 0.1);
    const orn = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.5, 8), ridgeMat);
    orn.position.set(tipP[0] * 1.02, tipP[1] + 0.18, tipP[2] * 1.02 + cz);
    orn.lookAt(tipP[0] * 2, tipP[1] + 3, tipP[2] * 2 + cz);
    orn.rotateX(Math.PI / 2);
    temple.add(orn);
  }

  // snow cornice along the eave + tile ends below it
  const perim = [];
  for (let s = 0; s < 4; s++) for (let i = 0; i < 24; i++) {
    const p = roof.surf(s, -1 + (2 * i) / 24, 0.012, 0.06);
    perim.push(new THREE.Vector3(p[0] * 1.0, p[1], p[2] + cz));
  }
  const cornice = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(perim, true), 240, 0.16, 8, true),
    snowyMaterial({ color: 0xeef2f1, snow: 0xf6f8f7, threshold: -0.2, noiseScale: 2 })
  );
  cornice.scale.set(1, 1, 1);
  cornice.castShadow = true;
  temple.add(cornice);
  const tileEnds = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 10), darkWood, 160);
  let ti = 0;
  for (let s = 0; s < 4; s++) for (let i = 0; i <= 30; i++) {
    const u = -1 + (2 * i) / 30;
    const p = roof.surf(s, u, 0, -0.24);
    const p2 = roof.surf(s, u, 0.05, -0.24);
    const dir = new THREE.Vector3(p[0] - p2[0], 0, p[2] - p2[2]).normalize();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    m.compose(new THREE.Vector3(p[0] + dir.x * 0.04, p[1], p[2] + cz + dir.z * 0.04), q, new THREE.Vector3(1, 1, 1));
    tileEnds.setMatrixAt(ti++, m);
  }
  tileEnds.count = ti;
  temple.add(tileEnds);

  // finial
  const peakY = roofY0 + 4.3;
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.3, 16), darkWood);
  band.position.set(0, peakY + 0.05, cz);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), snowyMaterial({ color: 0xeef2f1, threshold: -1 }));
  cap.position.set(0, peakY + 0.2, cz);
  cap.scale.y = 0.85;
  temple.add(band, cap);

  const detail = addTempleDetail({
    scene, temple, roof: { ...roof, peakY }, roofThick: 0.34, cz, fy, fz, backZ, hallW, hallD, wallH,
    darkWood, woodTex: woodTexture('#8a5444'),
    platform: { halfW: 7, frontZ: L.hallCZ + 0.1 + 6, backZ: L.hallCZ + 0.1 - 6, topY: fy, stairHalf: 2.2, stairBottomZ: L.stairBottomZ },
  });

  // ---------- Straw rope & tassels across the facade ----------
  const ropeMat = snowyMaterial({ color: 0x9c8457, snow: 0xf1f3f1, threshold: 0.62, softness: 0.08, noiseScale: 4, noiseAmt: 0.5, variation: 0.25 });
  const ropeY = fy + wallH - 0.5, ropeZ = fz + 0.42;
  const ropePts = [];
  const ties = [-3.95, -1.3, 1.3, 3.95];
  for (let k = 0; k < ties.length; k++) {
    ropePts.push(new THREE.Vector3(ties[k], ropeY, ropeZ));
    if (k < ties.length - 1) {
      const mx = (ties[k] + ties[k + 1]) / 2;
      ropePts.push(new THREE.Vector3(mx, ropeY - 0.42, ropeZ + 0.12));
    }
  }
  // resample: catmull through ties and sag midpoints, but bulge per span
  const rope = new THREE.Mesh(bulgyRope(ropePts, { radius: 0.36, spans: 3, segs: 240 }), ropeMat);
  rope.castShadow = true;
  temple.add(rope);
  // straw tassels: a tied neck, then a long fringe of strands
  const tasselProfile = [[0.0, 0.0], [0.1, 0.02], [0.12, 0.12], [0.08, 0.2], [0.13, 0.32], [0.2, 0.7], [0.24, 1.0], [0.0, 1.0]]
    .map(([x, y]) => new THREE.Vector2(x, 0.92 - y));
  const tasselGeo = new THREE.LatheGeometry(tasselProfile, 36);
  {
    // strands: ripple the radius around the circumference, more toward the bottom
    const tp = tasselGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < tp.count; i++) {
      v.fromBufferAttribute(tp, i);
      const down = THREE.MathUtils.clamp((0.6 - v.y) / 0.7, 0, 1);
      const a = Math.atan2(v.z, v.x);
      const k = 1 + Math.sin(a * 18) * 0.08 * down;
      tp.setXYZ(i, v.x * k, v.y - Math.abs(Math.sin(a * 9)) * 0.06 * down, v.z * k);
    }
    tasselGeo.computeVertexNormals();
  }
  for (const tx of [-2.7, -0.6, 0.6, 2.7]) {
    const t = new THREE.Mesh(tasselGeo, ropeMat);
    const ry = ropeY - 0.32 - Math.abs(Math.sin(tx)) * 0.05;
    t.position.set(tx, ry - 0.95, ropeZ + 0.1);
    t.scale.set(1.05, 1.1, 1.05);
    t.castShadow = true;
    temple.add(t);
  }

  // ---------- Hanging paper lanterns at the eave corners ----------
  const lanternLights = [];
  const glbLanternMats = [];
  const lanternMat = new THREE.MeshStandardMaterial({ color: 0xf6dcb6, emissive: 0xff9c52, emissiveIntensity: 2.4, roughness: 0.7 });
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(sx * 4.9, fy + wallH - 0.35, fz + 1.6);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.9, 4), darkWood);
    cord.position.y = 0.2;
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), lanternMat);
    body.scale.y = 1.25;
    body.position.y = -0.55;
    const capT = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.08, 12), darkWood);
    capT.position.y = -0.18;
    const capB = capT.clone(); capB.position.y = -0.93;
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x9c2f25 }));
    tassel.position.y = -1.12;
    g.add(cord, body, capT, capB, tassel);
    temple.add(g);
    // the sculpted lantern replaces the paper one once it loads
    propModel('lantern', { height: 0.95, anchor: 'top', own: true }).then((m) => {
      m.position.y = -0.2;
      g.add(m);
      body.visible = capT.visible = capB.visible = tassel.visible = false;
      cord.scale.y = 0.85 / 0.9; cord.position.y = 0.225; // from the eave down to the lantern's hook
      g.userData.cord = cord;
      for (const mt of materialsOf(m)) {
        mt.emissive = new THREE.Color(0xff9a4a);
        mt.emissiveMap = mt.map;
        mt.emissiveIntensity = 1.3 * api.lanternsOn;
        glbLanternMats.push(mt);
      }
    }).catch((e) => console.warn('lantern model not loaded; keeping the paper one', e));
    const pl = new THREE.PointLight(0xffa860, 12, 11, 1.8);
    pl.position.set(sx * 4.9, fy + wallH - 0.95, fz + 1.6); // inside the lantern, so its paper is lit only from within
    scene.add(pl);
    lanternLights.push({ light: pl, mat: lanternMat, group: g, base: 12 });
  }

  // door light (rises when the doors open)
  const doorLight = new THREE.PointLight(0xffb070, 0, 14, 1.6);
  doorLight.position.set(0, fy + 1.8, fz - 0.4);
  scene.add(doorLight);

  // ---------- Stone lanterns along the path ----------
  const stoneMat = snowyMaterial({ color: 0x6d766e, threshold: 0.55, softness: 0.08, noiseScale: 2, noiseAmt: 0.5, variation: 0.2 });
  const fireMat = new THREE.MeshStandardMaterial({ color: 0x1a120a, emissive: 0xffa457, emissiveIntensity: 3.2 });
  const makeStoneLantern = () => {
    const g = new THREE.Group();
    const parts = [
      [new THREE.CylinderGeometry(0.42, 0.5, 0.25, 6), 0.125],
      [new THREE.CylinderGeometry(0.13, 0.16, 0.95, 8), 0.72],
      [new THREE.CylinderGeometry(0.38, 0.3, 0.18, 6), 1.28],
      [new THREE.BoxGeometry(0.46, 0.42, 0.46), 1.58],
      [new THREE.ConeGeometry(0.62, 0.42, 6), 2.0],
      [new THREE.SphereGeometry(0.1, 8, 6), 2.28],
    ];
    for (const [geo, y] of parts) {
      const mm = new THREE.Mesh(geo, stoneMat);
      mm.position.y = y;
      mm.castShadow = true; mm.receiveShadow = true;
      g.add(mm);
    }
    for (const rot of [0, Math.PI / 2]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.24), fireMat);
      win.position.set(0, 1.58, 0);
      win.rotation.y = rot;
      win.scale.set(1, 1, 1);
      const w2 = win.clone();
      win.translateZ(0.235); w2.rotation.y = rot + Math.PI; w2.translateZ(0.235);
      g.add(win, w2);
    }
    return g;
  };
  const stoneLanterns = [];
  for (const [x, z, lit] of [[-3.4, 7.8, true], [3.4, 7.8, true], [-3.6, 17.5, false], [3.6, 17.5, false], [-3.9, 27, false], [3.9, 27, false]]) {
    const sl = makeStoneLantern();
    sl.position.set(x + pathX(z), groundHeight(x, z) - 0.05, z);
    sl.rotation.y = r() * 0.3;
    scene.add(sl);
    stoneLanterns.push(sl);
    colliders.push({ x: sl.position.x, z, r: 0.6 });
    if (lit) {
      const pl = new THREE.PointLight(0xffa25a, 4, 7, 1.8);
      pl.position.set(sl.position.x, 1.6, z);
      scene.add(pl);
    }
  }

  // ---------- Rounded stones flanking the stairs (snow capped) ----------
  const pebbleMat = snowyMaterial({ color: 0x4f5952, threshold: 0.5, softness: 0.07, noiseScale: 2.5, noiseAmt: 0.45, variation: 0.22 });
  const capsule = new THREE.CapsuleGeometry(0.26, 0.28, 6, 12);
  capsule.translate(0, 0.4, 0);
  const stones = new THREE.InstancedMesh(capsule, pebbleMat, 120);
  let ci = 0;
  for (const sx of [-1, 1]) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 9; k++) {
        const x = sx * (3.2 + row * 0.95 + (r() - 0.5) * 0.25);
        const z = 5.4 - k * 0.95 + (r() - 0.5) * 0.3 + row * 0.2;
        if (z < -0.6 && Math.abs(x) < 7.5) continue; // platform
        const s = 0.8 + r() * 0.55;
        pv.set(x, groundHeight(x, z) - 0.12, z);
        q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.2, r() * 6, (r() - 0.5) * 0.2));
        m.compose(pv, q, new THREE.Vector3(s, s * (0.9 + r() * 0.4), s));
        stones.setMatrixAt(ci++, m);
        colliders.push({ x, z, r: 0.32 * s + 0.15 });
      }
    }
  }
  stones.count = ci;
  stones.castShadow = stones.receiveShadow = true;
  scene.add(stones);

  // ---------- Scattered rocks & rock piles ----------
  const rockMat = snowyMaterial({ color: 0x5f6961, threshold: 0.45, softness: 0.08, noiseScale: 1.2, noiseAmt: 0.5, variation: 0.25, flat: true });
  const rocks = new THREE.InstancedMesh(rockGeometry(3, 1), rockMat, 220);
  let ri = 0;
  const putRock = (x, z, s, sink = 0.3) => {
    if (ri >= 220) return;
    pv.set(x, groundHeight(x, z) - s * sink, z);
    q.setFromEuler(new THREE.Euler(r() * 3, r() * 6, r() * 3));
    m.compose(pv, q, new THREE.Vector3(s * (0.9 + r() * 0.5), s * (0.6 + r() * 0.4), s * (0.9 + r() * 0.4)));
    rocks.setMatrixAt(ri++, m);
    if (s > 0.4) colliders.push({ x, z, r: s * 0.9 + 0.15 });
  };
  // piles along the platform front
  for (let i = 0; i < 40; i++) {
    const sx = r() > 0.5 ? 1 : -1;
    putRock(sx * (2.6 + r() * 5), -1 + r() * 1.6, 0.35 + r() * 0.4, 0.25);
  }
  // scattered field rocks
  for (let i = 0; i < 120; i++) {
    const z = -10 + r() * 60;
    const sx = r() > 0.5 ? 1 : -1;
    const x = sx * (6 + Math.pow(r(), 0.8) * 16);
    putRock(x, z, 0.3 + Math.pow(r(), 2) * 1.6, 0.35);
  }
  // boulders near the valley walls
  for (let i = 0; i < 40; i++) {
    const z = -14 + r() * 50;
    const sx = r() > 0.5 ? 1 : -1;
    putRock(sx * (14 + r() * 8), z, 1.2 + r() * 2.2, 0.4);
  }
  rocks.count = ri;
  rocks.castShadow = rocks.receiveShadow = true;
  scene.add(rocks);

  // ---------- Pines ----------
  const pineMat = snowyMaterial({ color: 0x24342b, snow: 0xf2f5f3, threshold: 0.38, softness: 0.12, noiseScale: 1.7, noiseAmt: 0.55, variation: 0.22 });
  const pineKinds = [1, 2, 3].map((seed) => new THREE.InstancedMesh(pineGeometry(seed), pineMat, 40));
  pineKinds.forEach((p) => { p.count = 0; });
  const putPine = (x, z, s) => {
    let p = pineKinds[Math.floor(r() * pineKinds.length)];
    if (p.count >= 40) p = pineKinds.find((k) => k.count < 40);
    pv.set(x, groundHeight(x, z) - 0.25, z);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6);
    m.compose(pv, q, new THREE.Vector3(s, s * (0.9 + r() * 0.3), s));
    p.setMatrixAt(p.count++, m);
    colliders.push({ x, z, r: 0.5 * s + 0.2 });
  };
  for (let i = 0; i < 70; i++) {
    const sx = r() > 0.5 ? 1 : -1;
    const z = -22 + r() * 62;
    const x = sx * (9 + r() * 16);
    if (z < 2 && Math.abs(x) < 10) continue;
    putPine(x, z, 0.8 + r() * 1.1);
  }
  for (const p of pineKinds) { p.castShadow = true; p.receiveShadow = true; scene.add(p); }

  // ---------- Cliffs: the valley that holds the temple ----------
  const cliffMat = snowyMaterial({ color: 0x66746a, snow: 0xf0f3f1, threshold: 0.48, softness: 0.09, noiseScale: 0.18, noiseAmt: 0.55, variation: 0.3, flat: true });
  const wall = new THREE.Mesh(valleyWallGeometry({}), cliffMat);
  wall.receiveShadow = true;
  scene.add(wall);
  // a second, farther ridge for depth (fogs to a pale silhouette)
  const wall2 = new THREE.Mesh(valleyWallGeometry({ zc: 0, Rx: 75, Rz: 95, H: 80, thetaMax: 2.0, segT: 160, segY: 40, seed: 9 }), cliffMat);
  scene.add(wall2);
  // a few big fallen rocks at the foot of the wall
  for (const [x, z, s, seed] of [[-20, -18, 4.5, 1], [22, -16, 5, 2], [-27, 6, 4, 3], [28, 12, 4.2, 5], [-8, -27, 3.5, 6], [10, -28, 3.8, 7]]) {
    const cl = new THREE.Mesh(cliffGeometry(seed), cliffMat);
    cl.position.set(x, groundHeight(x, z) + s * 0.2, z);
    cl.scale.set(s * 1.2, s, s);
    cl.rotation.y = seed;
    cl.castShadow = cl.receiveShadow = true;
    scene.add(cl);
    colliders.push({ x, z, r: s * 1.25 });
  }

  // ---------- API ----------
  let t = 0;
  const api = {
    scene,
    colliders,
    sun,
    doors,
    doorLight,
    glowMat,
    lanternLights,
    lanternMat,
    parts: { ...detail.parts, lanterns: lanternLights.map((l) => l.group) },
    lanternsOn: 1, // 0 = dark, 1 = lit (the repair quest starts them dark)
    doorOpen: 0,
    update(dt) {
      t += dt;
      detail.update(t);
      for (const L2 of lanternLights) {
        const f = 1 + Math.sin(t * 7.3 + L2.base) * 0.04 + Math.sin(t * 13.1) * 0.03;
        L2.light.intensity = L2.base * f * api.lanternsOn;
        if (!L2.group.userData.loose) L2.group.rotation.z = Math.sin(t * 0.9 + L2.base) * 0.04;
        if (L2.group.userData.cord) L2.group.userData.cord.visible = !L2.group.userData.loose;
      }
      lanternMat.emissiveIntensity = 2.4 * api.lanternsOn;
      for (const mt of glbLanternMats) mt.emissiveIntensity = 1.3 * api.lanternsOn;
      // doors
      const o = THREE.MathUtils.smoothstep(api.doorOpen, 0, 1);
      for (const d of doors) d.rotation.y = -d.userData.sx * o * 1.35;
      glowMat.emissiveIntensity = o * 1.8;
      doorLight.intensity = o * 14;
      winMat.emissiveIntensity = 0.35 + o * 0.5;
      doorMat.emissiveIntensity = 0.45 + o * 0.6;
    },
  };
  return api;
}
