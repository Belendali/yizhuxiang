import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rand, makeNoise2D } from './materials.js';
import { ParticleField } from './fx.js';

// 第一章 · 落花谷: the valley the traveler wakes in. A spring morning, blossom trees along a
// winding earth path, petals always falling. The traveler walks from +Z toward -Z, as at the temple.

const noise = makeNoise2D(21);
const ss = THREE.MathUtils.smoothstep;

export const VALLEY_START = { x: 2.3, z: 6.2 };
const HERO = { x: 4.4, z: 4.6, s: 1.75 }; // the old tree the traveler wakes under

export function valleyPathX(z) {
  return Math.sin(z * 0.045) * 3.2 + Math.sin(z * 0.11) * 0.8;
}

export function valleyHeight(x, z) {
  let h = (noise.fbm(x * 0.035 + 3, z * 0.035) - 0.5) * 3.2 + (noise.fbm(x * 0.2, z * 0.2 + 5) - 0.5) * 0.3;
  const dp = Math.abs(x - valleyPathX(z));
  h *= 1 - (1 - ss(dp, 1.5, 9)) * 0.85;               // the valley floor is gentle near the path
  h += Math.pow(Math.max(0, dp - 20), 1.4) * 0.38;     // slopes rising either side
  h += Math.pow(Math.max(0, z - 16), 1.3) * 0.4;       // and behind where the traveler wakes
  return h;
}

export function valleyBlocked(x, z, colliders) {
  if (Math.abs(x - valleyPathX(z)) > 24 || z > 17 || z < -140) return true;
  for (const c of colliders) {
    const dx = x - c.x, dz = z - c.z;
    if (dx * dx + dz * dz < c.r * c.r) return true;
  }
  return false;
}

/** A blossom tree: a branching trunk, and the places where blossom clusters sit. */
function blossomTree(rr, scale) {
  const wood = [];
  const tips = [];
  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion();
  const grow = (start, dir, len, rad, depth) => {
    const end = start.clone().addScaledVector(dir, len);
    const c = new THREE.CylinderGeometry(rad * 0.68, rad, len, 7, 1).toNonIndexed();
    c.deleteAttribute('uv');
    q.setFromUnitVectors(up, dir);
    c.applyQuaternion(q);
    c.translate((start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2);
    wood.push(c);
    if (depth === 0) { tips.push({ p: end, r: (0.75 + rr() * 0.4) * scale }); return; }
    if (depth <= 1 && rr() < 0.5) tips.push({ p: start.clone().lerp(end, 0.6), r: (0.55 + rr() * 0.3) * scale });
    const n = depth === 3 ? 3 : 2 + (rr() < 0.4 ? 1 : 0);
    const turn = rr() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = turn + (i / n) * Math.PI * 2 + (rr() - 0.5) * 0.8;
      const tilt = 0.5 + rr() * 0.45;
      // spread outward, a little upward: the wide umbrella of a blossom tree
      const d = new THREE.Vector3(Math.cos(a) * Math.sin(tilt), Math.cos(tilt) * 0.85, Math.sin(a) * Math.sin(tilt));
      d.lerp(dir, 0.25).normalize();
      grow(end, d, len * (0.68 + rr() * 0.12), rad * 0.6, depth - 1);
    }
  };
  const lean = new THREE.Vector3((rr() - 0.5) * 0.35, 1, (rr() - 0.5) * 0.35).normalize();
  grow(new THREE.Vector3(0, -0.3, 0), lean, 1.9 * scale, 0.22 * scale, 3);
  return { wood: mergeGeometries(wood), tips };
}

export function buildValley() {
  const scene = new THREE.Scene();
  const r = rand(77);
  const colliders = [];
  const fogColor = new THREE.Color(0xf1e3dc);
  scene.fog = new THREE.FogExp2(fogColor, 0.0105);
  scene.background = fogColor;

  // ---------- Sky ----------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { uTop: { value: new THREE.Color(0x93b2c6) }, uHor: { value: new THREE.Color(0xf6e6dd) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; varying vec3 vP;
        void main(){ float h = clamp(vP.y * 1.5, 0.0, 1.0); gl_FragColor = vec4(mix(uHor, uTop, pow(h, 0.8)), 1.0); }`,
    })
  );
  sky.renderOrder = -1;
  scene.add(sky);

  // ---------- Light: low morning sun from behind-left, so the blossom is lit ----------
  scene.add(new THREE.HemisphereLight(0xfff3ee, 0x8d9a74, 1.25));
  const sun = new THREE.DirectionalLight(0xffe2c6, 2.4);
  sun.position.set(-30, 36, 24);
  sun.target.position.set(0, 0, -6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -34; sc.right = 34; sc.top = 40; sc.bottom = -30; sc.near = 5; sc.far = 120;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  // ---------- Trees (placed first: the ground under them is carpeted with petals) ----------
  const trees = [{ x: HERO.x, z: HERO.z, s: HERO.s }];
  for (let i = 0; i < 64; i++) {
    const z = 14 - r() * 125;
    const side = r() > 0.5 ? 1 : -1;
    const x = valleyPathX(z) + side * (3.2 + Math.pow(r(), 1.3) * 16);
    if (Math.hypot(x - VALLEY_START.x, z - VALLEY_START.z) < 4) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 3.4)) continue;
    trees.push({ x, z, s: 0.8 + r() * 0.6 });
  }
  const woodParts = [];
  const blobs = [];
  for (const t of trees) {
    const { wood, tips } = blossomTree(r, t.s);
    const y = valleyHeight(t.x, t.z);
    const rot = r() * Math.PI * 2;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(t.x, y, t.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(1, 1, 1));
    wood.applyMatrix4(m);
    woodParts.push(wood);
    for (const tip of tips) {
      tip.p.applyMatrix4(m);
      // each cluster is a few soft blobs
      // each cluster is many small soft clumps, so the crown reads as blossom, not balls
      const k = 6 + Math.floor(r() * 4);
      for (let j = 0; j < k; j++) {
        blobs.push({
          p: tip.p.clone().add(new THREE.Vector3((r() - 0.5) * tip.r * 1.7, (r() - 0.35) * tip.r * 0.9, (r() - 0.5) * tip.r * 1.7)),
          r: tip.r * (0.3 + r() * 0.28), c: r(),
        });
      }
    }
    colliders.push({ x: t.x, z: t.z, r: 0.35 * t.s + 0.15 });
  }
  const barkMat = new THREE.MeshStandardMaterial({ color: 0x5b4339, roughness: 0.95 });
  const woodMesh = new THREE.Mesh(mergeGeometries(woodParts), barkMat);
  woodMesh.castShadow = woodMesh.receiveShadow = true;
  scene.add(woodMesh);
  const blossomMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, flatShading: true, emissive: 0x3a2228, emissiveIntensity: 1 });
  const blossom = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), blossomMat, blobs.length);
  const pinks = [new THREE.Color(0xf8cfda), new THREE.Color(0xfde4ea), new THREE.Color(0xf3b9c9), new THREE.Color(0xfff2f4), new THREE.Color(0xf6c4d2)];
  const bm = new THREE.Matrix4(), bq = new THREE.Quaternion(), be = new THREE.Euler(), bs = new THREE.Vector3();
  blobs.forEach((b, i) => {
    bq.setFromEuler(be.set(r() * 3, r() * 3, r() * 3));
    bm.compose(b.p, bq, bs.set(b.r * (0.9 + r() * 0.3), b.r * 0.72, b.r * (0.9 + r() * 0.3)));
    blossom.setMatrixAt(i, bm);
    blossom.setColorAt(i, pinks[Math.floor(b.c * pinks.length)]);
  });
  blossom.castShadow = true;
  blossom.receiveShadow = true;
  scene.add(blossom);

  // ---------- Ground: grass, an earth path, petals under the trees ----------
  const gGeo = new THREE.PlaneGeometry(300, 300, 230, 230);
  gGeo.rotateX(-Math.PI / 2);
  gGeo.translate(0, 0, -55);
  const gp = gGeo.attributes.position;
  const col = new Float32Array(gp.count * 3);
  const grassA = new THREE.Color(0x8fa36a), grassB = new THREE.Color(0x748a58), earth = new THREE.Color(0xbba486);
  const petal = new THREE.Color(0xf0c9d1), c = new THREE.Color();
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    gp.setY(i, valleyHeight(x, z));
    c.copy(grassA).lerp(grassB, noise.fbm(x * 0.08, z * 0.08 + 11));
    let pk = 0;
    for (const t of trees) {
      const d = Math.hypot(x - t.x, z - t.z) / (3.2 * t.s);
      if (d < 1) pk = Math.max(pk, (1 - d) * (0.55 + noise.n(x * 1.3, z * 1.3) * 0.45));
    }
    c.lerp(petal, Math.min(0.85, pk));
    const dp = Math.abs(x - valleyPathX(z));
    c.lerp(earth, (1 - ss(dp, 0.7, 1.5)) * (0.75 + noise.n(x * 0.9, z * 0.9) * 0.25) * (z < 12 ? 1 : 0));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  gGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  gGeo.computeVertexNormals();
  const ground = new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  ground.receiveShadow = true;
  scene.add(ground);

  // ---------- A few mossy stones ----------
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8b9184, roughness: 0.95, flatShading: true });
  const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), rockMat, 30);
  const rm = new THREE.Matrix4(), rq = new THREE.Quaternion(), rs = new THREE.Vector3(), rp = new THREE.Vector3();
  let ri = 0;
  for (let i = 0; i < 30; i++) {
    const z = 12 - r() * 120, side = r() > 0.5 ? 1 : -1;
    const x = valleyPathX(z) + side * (2.4 + r() * 14);
    const s = 0.25 + r() * 0.6;
    rq.setFromEuler(new THREE.Euler(r() * 3, r() * 3, r() * 3));
    rm.compose(rp.set(x, valleyHeight(x, z) - s * 0.35, z), rq, rs.set(s * 1.3, s * 0.8, s));
    rocks.setMatrixAt(ri++, rm);
    if (s > 0.5) colliders.push({ x, z, r: s });
  }
  rocks.count = ri;
  rocks.castShadow = rocks.receiveShadow = true;
  scene.add(rocks);

  // ---------- Far hills, pale in the haze ----------
  const hillMat = new THREE.MeshStandardMaterial({ color: 0x9da7a6, roughness: 1, flatShading: true });
  for (let i = 0; i < 16; i++) {
    const a = -Math.PI * 0.95 + (i / 15) * Math.PI * 0.9 + (r() - 0.5) * 0.1;
    const d = 95 + r() * 60;
    const hill = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 1), hillMat);
    const w = 30 + r() * 30;
    hill.scale.set(w, 18 + r() * 26, w * 0.7);
    hill.position.set(Math.cos(a) * d, -6, Math.sin(a) * d - 40);
    scene.add(hill);
  }

  // ---------- Falling petals ----------
  const petals = new ParticleField({
    count: 2600, box: new THREE.Vector3(44, 20, 44), color: 0xf3bccb, color2: 0xfff0f3,
    fall: [0.25, 0.6], size: [0.1, 0.2], sway: 1.1, wind: new THREE.Vector3(0.55, 0, 0.3),
    opacity: 0.95, fadeNear: 0.5, fadeFar: 40, petal: true, seed: 9,
  });
  scene.add(petals.points);

  return {
    scene, colliders,
    hero: new THREE.Vector3(HERO.x, valleyHeight(HERO.x, HERO.z), HERO.z),
    update(dt, center, vh) { petals.update(dt, center, vh); },
  };
}
