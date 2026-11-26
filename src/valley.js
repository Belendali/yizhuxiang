import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rand, makeNoise2D } from './materials.js';
import { ParticleField } from './fx.js';
import { propModel, propParts, instancesFromModel } from './models.js';

// 第一章 · 落花谷: the valley the traveler wakes in. A spring morning, blossom trees along a
// winding earth path, petals always falling. The traveler walks from +Z toward -Z, as at the temple.

const noise = makeNoise2D(21);
const ss = THREE.MathUtils.smoothstep;

export const VALLEY_START = { x: 2.3, z: 6.2 };
const HERO = { x: 4.4, z: 4.6, s: 1.75 }; // the old tree the traveler wakes under
// 阿念's tree, a little way down the path (her story lives in anian.js); kept clear of other trees
export const NIAN = { x: 0.6, z: -24 };
// where 阿念's fallen sprigs lie, relative to her tree
export const SPRIGS = [[-6.5, 3.5], [5.5, -6], [9.5, 2.5], [-2.5, -12.5], [12, -11], [-9.5, -4.5], [3, 9.5]];

export function valleyPathX(z) {
  return Math.sin(z * 0.045) * 3.2 + Math.sin(z * 0.11) * 0.8;
}
// further on, a patch of sand beside the path where a child draws (its story lives in sand.js)
export const SAND_AT = { x: valleyPathX(-56) + 3.5, z: -56 };
const nearSand = (x, z, r) => Math.hypot(x - SAND_AT.x, z - SAND_AT.z) < r;

export function valleyHeight(x, z) {
  let h = (noise.fbm(x * 0.035 + 3, z * 0.035) - 0.5) * 3.2 + (noise.fbm(x * 0.2, z * 0.2 + 5) - 0.5) * 0.3;
  const dp = Math.abs(x - valleyPathX(z));
  h *= 1 - (1 - ss(dp, 1.5, 9)) * 0.85;               // the valley floor is gentle near the path
  // soft slopes rising either side and behind where the traveler wakes; they level off
  // low, so the far mountains and the sky stay open above them
  h += ss(dp, 20, 75) * 13 + ss(dp, 60, 140) * 6;
  h += ss(z, 16, 60) * 12;
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

  // ---------- Sky: soft spring blue overhead, thin drifting cloud, warm glow toward the sun,
  // melting into the haze at the horizon (the horizon colour is the fog colour) ----------
  const sunDir = new THREE.Vector3(-30, 36, 24).normalize();
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 48, 24),
    new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uTop: { value: new THREE.Color(0x7fa6c4) }, uMid: { value: new THREE.Color(0xc9d8e0) },
        uHor: { value: fogColor.clone() }, uSun: { value: sunDir }, uTime: { value: 0 },
      },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 uTop; uniform vec3 uMid; uniform vec3 uHor; uniform vec3 uSun; uniform float uTime; varying vec3 vP;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
        float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 7.1; a *= 0.5; } return v; }
        void main(){
          float y = max(vP.y, 0.0);
          vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.22, y));
          c = mix(c, uTop, smoothstep(0.18, 0.85, y));
          // thin, wind-drawn cloud: stretched noise on a plane above
          vec2 uv = vP.xz / (vP.y + 0.18) * 0.9;
          uv.x *= 0.45;
          float cl = fbm(uv * 1.2 + vec2(uTime * 0.004, 0.0));
          cl = smoothstep(0.5, 0.82, cl) * smoothstep(0.03, 0.25, y);
          c = mix(c, vec3(1.0, 0.975, 0.97), cl * 0.65);
          // warm light around the sun, and a faint rose band low in the sky
          float sd = max(dot(normalize(vP), uSun), 0.0);
          c += vec3(1.0, 0.86, 0.72) * (pow(sd, 40.0) * 0.35 + pow(sd, 6.0) * 0.12);
          c = mix(c, vec3(0.97, 0.86, 0.86), (1.0 - smoothstep(0.02, 0.3, y)) * 0.18);
          c = mix(uHor, c, smoothstep(-0.02, 0.06, vP.y));
          gl_FragColor = vec4(c, 1.0);
        }`,
    })
  );
  sky.renderOrder = -2;
  scene.add(sky);

  // ---------- Far mountains: three soft layers of ridge, nearer ones a little deeper in
  // colour, each fading into the haze at its foot (no fog: their colour is painted) ----------
  {
    const mr = rand(5);
    const layers = [
      { R: 300, top: 0x9db2c2, amp: 70, base: 18, seed: 1.3 },
      { R: 240, top: 0x8ea4b3, amp: 52, base: 10, seed: 4.1 },
      { R: 190, top: 0x86998f, amp: 34, base: 4, seed: 8.7 },
    ];
    const ph = Array.from({ length: 12 }, () => mr() * 6.28);
    for (const L of layers) {
      const N = 360, pos = [], col = [], idx = [];
      const top = new THREE.Color(L.top);
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        // ridge line: a few broad swells and sharper peaks
        let h = 0.55 + 0.25 * Math.sin(a * 2 + ph[0] + L.seed) + 0.18 * Math.sin(a * 5 + ph[1] * L.seed)
          + 0.12 * Math.abs(Math.sin(a * 11 + ph[2] + L.seed * 2)) + 0.06 * Math.sin(a * 23 + ph[3]);
        // lower where the valley opens ahead (down the path, -Z) so the eye travels far
        h *= 0.55 + 0.45 * (1 - Math.max(0, -Math.cos(a - Math.PI / 2)) * 0.6);
        const x = Math.cos(a) * L.R, z = Math.sin(a) * L.R - 40;
        pos.push(x, -12, z, x, L.base + h * L.amp, z);
        col.push(fogColor.r, fogColor.g, fogColor.b, top.r, top.g, top.b);
        if (i < N) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      // mist at the foot: the bottom colour is the haze, the top the mountain
      const mat = new THREE.ShaderMaterial({
        side: THREE.DoubleSide, fog: false, depthWrite: true,
        uniforms: { uHaze: { value: fogColor.clone() } },
        vertexShader: 'attribute vec3 color; varying vec3 vC; varying float vY; void main(){ vC = color; vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform vec3 uHaze; varying vec3 vC; varying float vY;
          void main(){ float m = smoothstep(${(L.base - 6).toFixed(1)}, ${(L.base + L.amp * 0.6).toFixed(1)}, vY); gl_FragColor = vec4(mix(uHaze, vC, m * 0.85), 1.0); }`,
      });
      const mesh = new THREE.Mesh(g, mat);
      mesh.renderOrder = -1;
      mesh.frustumCulled = false;
      scene.add(mesh);
    }
  }

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
    if (Math.hypot(x - NIAN.x, z - NIAN.z) < 5.5) continue;
    if (nearSand(x, z, 5.5)) { r(); continue; } // (the draw it would have used, so the rest keeps its layout)
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

  // The cherry models (sakura.glb: big / small / small2) take over once they load: the big
  // leaning one for the hero, the two small ones (alternating) for the rest. The turned stand-ins above stay until then.
  const others = trees.slice(1);
  const kinds = [
    { part: 'small', height: 3.9, list: others.filter((_, i) => i % 2 === 0) },
    { part: 'small2', height: 4.3, list: others.filter((_, i) => i % 2 === 1) },
  ];
  Promise.all([
    propModel('sakura', { part: 'big', height: 6.6, anchor: 'bottom' }).then((m) => {
      m.position.set(HERO.x, valleyHeight(HERO.x, HERO.z) - 0.08, HERO.z);
      m.rotation.y = 2.2;
      scene.add(m);
    }),
    ...kinds.map((k) => propParts('sakura', { part: k.part, height: k.height, anchor: 'bottom' }).then((parts) => {
      const tm = new THREE.Matrix4(), tq = new THREE.Quaternion(), tv = new THREE.Vector3(), ts = new THREE.Vector3();
      for (const p of parts) {
        const inst = new THREE.InstancedMesh(p.geometry, p.material, k.list.length);
        k.list.forEach((t, i) => {
          tq.setFromAxisAngle(tv.set(0, 1, 0), (t.x * 12.9898 + t.z * 78.233) % (Math.PI * 2));
          const sc = t.s * (0.9 + ((t.x * 3.7 + t.z * 1.3) % 1 + 1) % 1 * 0.25);
          tm.compose(tv.set(t.x, valleyHeight(t.x, t.z) - 0.08, t.z), tq, ts.set(sc, sc, sc));
          inst.setMatrixAt(i, tm);
        });
        inst.castShadow = inst.receiveShadow = true;
        scene.add(inst);
      }
    })),
  ]).then(() => {
    woodMesh.visible = false; blossom.visible = false;
    // a touch of warm self-light, like the old blossom had, so the crowns read pink in the shade
    scene.traverse((o) => {
      if (!o.isMesh || o.material.name !== 'foliage' || o.material.userData.lit) return;
      o.material.userData.lit = true;
      o.material.emissive = new THREE.Color(0x3a2228);
    });
  })
    .catch((e) => console.warn('cherry models not loaded; keeping the turned trees', e));

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

  // ---------- A few mossy stones (a scanned rock pile, placed many times) ----------
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x8b9184, roughness: 0.95, flatShading: true });
  const rockGeo = new THREE.DodecahedronGeometry(1, 0).scale(0.5, 0.4, 0.45).translate(0, 0.25, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 30);
  const rm = new THREE.Matrix4(), rq = new THREE.Quaternion(), rs = new THREE.Vector3(), rp = new THREE.Vector3();
  let ri = 0;
  for (let i = 0; i < 30; i++) {
    const z = 12 - r() * 120, side = r() > 0.5 ? 1 : -1;
    const x = valleyPathX(z) + side * (2.4 + r() * 14);
    const s = 0.25 + r() * 0.6;
    r(); const yaw = r() * 6.28; r(); // (three draws, as before, so the rest of the valley keeps its layout)
    if (Math.hypot(x - NIAN.x, z - NIAN.z) < 3) continue;
    if (nearSand(x, z, 3.8)) continue;
    rq.setFromAxisAngle(rs.set(0, 1, 0), yaw);
    rm.compose(rp.set(x, valleyHeight(x, z) - s * 0.08, z), rq, rs.setScalar(s * 1.7));
    rocks.setMatrixAt(ri++, rm);
    if (s > 0.5) colliders.push({ x, z, r: s * 0.8 });
  }
  rocks.count = ri;
  rocks.castShadow = rocks.receiveShadow = true;
  scene.add(rocks);
  instancesFromModel('rocks', { width: 1, anchor: 'bottom' }, rocks, scene).catch((e) => console.warn('rock model not loaded', e));

  // ---------- Grass clumps and a few wild flowers (one draw per kind) ----------
  {
    const gr = rand(31);
    const kinds = [
      { part: 'grass0', height: 0.55, n: 70 }, { part: 'grass1', height: 0.5, n: 60 },
      { part: 'grass2', height: 0.5, n: 60 }, { part: 'grass3', height: 0.5, n: 60 },
      { part: 'grass4', height: 0.5, n: 60 }, { part: 'flowerY', height: 0.5, n: 26 }, { part: 'flowerB', height: 0.45, n: 30 },
    ];
    const clear = SPRIGS.map(([dx, dz]) => [NIAN.x + dx, NIAN.z + dz]);
    const m4 = new THREE.Matrix4(), q4 = new THREE.Quaternion(), s4 = new THREE.Vector3(), p4 = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
    for (const k of kinds) {
      const mats = [];
      for (let tries = 0; mats.length < k.n && tries < k.n * 6; tries++) {
        const z = 10 - Math.pow(gr(), 1.3) * 95;
        const x = valleyPathX(z) + (gr() > 0.5 ? 1 : -1) * (1.3 + gr() * 15);
        if (clear.some(([cx, cz]) => Math.hypot(x - cx, z - cz) < 1.4)) continue;
        if (Math.hypot(x - NIAN.x, z - NIAN.z) < 1.2) continue;
        if (nearSand(x, z, 3.2)) { gr(); gr(); continue; }
        const sc = 0.75 + gr() * 0.6;
        m4.compose(p4.set(x, valleyHeight(x, z) - 0.02, z), q4.setFromAxisAngle(up, gr() * 6.28), s4.setScalar(sc));
        mats.push(m4.clone());
      }
      propParts('grass', { part: k.part, height: k.height, anchor: 'bottom' }).then((parts) => {
        for (const pt of parts) {
          // the scan's greens are deep; lift them toward the valley's soft, sunlit ground
          if (!pt.material.userData.lifted) {
            pt.material.userData.lifted = true;
            pt.material.color.multiply(new THREE.Color(1.7, 1.75, 1.3));
            pt.material.emissive = new THREE.Color(0x1c2410);
          }
          const inst = new THREE.InstancedMesh(pt.geometry, pt.material, mats.length);
          mats.forEach((m, i) => inst.setMatrixAt(i, m));
          inst.receiveShadow = true;
          scene.add(inst);
        }
      }).catch((e) => console.warn('grass not loaded', e));
    }
  }

  // ---------- Falling petals ----------
  const petals = new ParticleField({
    count: 2600, box: new THREE.Vector3(44, 20, 44), color: 0xf3bccb, color2: 0xfff0f3,
    fall: [0.25, 0.6], size: [0.1, 0.2], sway: 1.1, wind: new THREE.Vector3(0.55, 0, 0.3),
    opacity: 0.95, fadeNear: 0.5, fadeFar: 40, petal: true, seed: 9,
  });
  scene.add(petals.points);

  return {
    scene, colliders, petals,
    hero: new THREE.Vector3(HERO.x, valleyHeight(HERO.x, HERO.z), HERO.z),
    update(dt, center, vh) { petals.update(dt, center, vh); sky.material.uniforms.uTime.value += dt; },
  };
}
