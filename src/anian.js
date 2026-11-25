import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { propModel } from './models.js';
import { valleyHeight, valleyPathX, NIAN, SPRIGS } from './valley.js';

// 第一章 · 落花谷: 阿念 and her tree. Her blossom is falling and her grandmother is not back
// yet; she asks the traveler to put the fallen sprigs back. Each sprig found flies home to
// the tree and that part of the crown blooms again. When the tree is full a gust takes it
// all, and the grandmother walks in: she came back for the falling (落花祭).
//
// 阿念 is a rigged model (idle, run, bow); until it loads, and for the grandmother, a simple
// turned figure stands in.

const ss = THREE.MathUtils.smoothstep;
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const angleDamp = (a, b, rate, dt) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * (1 - Math.exp(-rate * dt)); };
const yawTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));
const NOTES = [523, 587, 659, 784, 880, 1047, 1175]; // pentatonic, rising: each sprig home is the next note

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,240,244,1)');
  grd.addColorStop(0.3, 'rgba(255,190,210,0.5)');
  grd.addColorStop(1, 'rgba(255,170,195,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function petalTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath();
  g.ellipse(16, 16, 13, 8, 0.5, 0, Math.PI * 2);
  g.fill();
  const t = new THREE.CanvasTexture(c);
  return t;
}

/** A small turned figure: robe, sleeves, head, hair. Faces -Z at yaw 0, like the traveler. */
function figure({ height, robe, sash, hair, skin = 0xf0d3be, bent = 0, buns = false, white = false }) {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const k = height / 1.15;
  const mat = (c, r = 0.9) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const robeProf = [[0, 0], [0.24, 0], [0.25, 0.04], [0.2, 0.32], [0.15, 0.6], [0.13, 0.74], [0.07, 0.8], [0, 0.8]].map(([x, y]) => new THREE.Vector2(x * k, y * k));
  const robeM = new THREE.Mesh(new THREE.LatheGeometry(robeProf, 20), mat(robe));
  body.add(robeM);
  const sashM = new THREE.Mesh(new THREE.CylinderGeometry(0.152 * k, 0.16 * k, 0.07 * k, 20), mat(sash));
  sashM.position.y = 0.55 * k;
  body.add(sashM);
  for (const s of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.05 * k, 0.3 * k, 4, 10), mat(robe));
    arm.position.set(s * 0.16 * k, 0.6 * k, 0);
    arm.rotation.z = s * 0.28;
    body.add(arm);
    arm.userData.side = s;
    g.userData[s < 0 ? 'armL' : 'armR'] = arm;
  }
  const head = new THREE.Group();
  head.position.y = 0.92 * k;
  body.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.12 * k, 20, 14), mat(skin, 0.7)));
  // hair: a cap that covers the back and top, leaving the face (toward -Z) open
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.128 * k, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), mat(white ? 0xe6e1da : hair, 0.8));
  cap.rotation.x = 0.55;
  cap.position.z = 0.012 * k;
  head.add(cap);
  if (buns) {
    for (const s of [-1, 1]) {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.055 * k, 12, 10), mat(hair, 0.8));
      bun.position.set(s * 0.1 * k, 0.09 * k, 0.03 * k);
      head.add(bun);
      const tie = new THREE.Mesh(new THREE.TorusGeometry(0.035 * k, 0.012 * k, 6, 12), mat(0xc8553d, 0.7));
      tie.position.set(s * 0.085 * k, 0.06 * k, 0.03 * k);
      tie.rotation.set(0.4, s * 0.8, 0);
      head.add(tie);
    }
  } else {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.06 * k, 12, 10), mat(white ? 0xe6e1da : hair, 0.8));
    bun.position.set(0, 0.06 * k, 0.11 * k);
    head.add(bun);
  }
  body.rotation.x = -bent;
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.body = body;
  g.userData.head = head;
  return g;
}

export class Nian {
  constructor(valley, sound) {
    this.scene = valley.scene;
    this.valley = valley;
    this.sound = sound;
    this.active = false;
    this.done = false;
    this.t = 0;
    this.onBloom = null; // (count, total) => {}
    this.sprigs = [];
    this.flights = [];
    this.sectors = [];
    this.burst = null;

    const tx = NIAN.x, tz = NIAN.z, ty = valleyHeight(tx, tz);
    this.treePos = new THREE.Vector3(tx, ty, tz);
    valley.colliders.push({ x: tx, z: tz, r: 0.45 });

    // ---------- 阿念: on the path side of her tree, looking up at it ----------
    this.girl = figure({ height: 1.12, robe: 0xd98a95, sash: 0xb2413a, hair: 0x2a1d18, buns: true });
    const px = valleyPathX(tz);
    this.girlHome = new THREE.Vector3(tx + (px - tx) * 0.55, 0, tz + 0.6);
    this.girlHome.y = valleyHeight(this.girlHome.x, this.girlHome.z);
    this.girl.position.copy(this.girlHome);
    this.girlYaw = yawTo(this.girlHome.x, this.girlHome.z, tx, tz);
    this.girl.rotation.y = this.girlYaw;
    this.scene.add(this.girl);
    this.girlCollider = { x: this.girlHome.x, z: this.girlHome.z, r: 0.3 };
    valley.colliders.push(this.girlCollider);
    this.girlMode = 'idle'; // idle | run | wave
    this.hop = 0;
    this.lookAt = null;      // Vector3 she turns toward, or null for the tree
    this.runTo = null;
    this.mixer = null;
    this.acts = {};
    this.clip = null;
    new GLTFLoader().load(`./assets/models/anian.glb?v=${window.__V || ''}`, (gltf) => {
      const m = gltf.scene;
      this.mixer = new THREE.AnimationMixer(m);
      for (const c of gltf.animations) this.acts[c.name] = this.mixer.clipAction(c);
      const bow = this.acts.Formal_Bow;
      if (bow) { bow.setLoop(THREE.LoopOnce); bow.clampWhenFinished = true; }
      this.mixer.addEventListener('finished', (e) => { if (e.action === bow && this.girlMode === 'wave') this.girlMode = 'idle'; });
      this._play('Idle_9', 0);
      this.mixer.update(0);
      // measure her standing in the idle pose (a skinned box needs the bones posed first)
      m.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(m, true);
      const s = 1.12 / (box.max.y - box.min.y);
      m.scale.setScalar(s);
      m.position.y = this._foot = -box.min.y * s;
      m.rotation.y = Math.PI; // the model faces +Z; the figure convention is -Z
      m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
      this.model = m;
      this.girl.userData.body.visible = false;
      this.girl.add(m);
    });

    // ---------- the grandmother, far down the path, hidden until the end ----------
    this.elder = figure({ height: 1.38, robe: 0x7a6e62, sash: 0x4f463e, hair: 0x6b625a, white: true, bent: 0.22 });
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 1.05, 6), new THREE.MeshStandardMaterial({ color: 0x5d4632, roughness: 0.9 }));
    stick.position.set(0.24, 0.5, -0.12);
    stick.rotation.x = 0.12;
    stick.castShadow = true;
    this.elder.add(stick);
    this.elder.visible = false;
    this.scene.add(this.elder);
    this.elderPath = [];
    for (let i = 0; i <= 8; i++) {
      const z = tz - 15 + i * 1.3;
      const x = valleyPathX(z);
      this.elderPath.push(new THREE.Vector3(x, valleyHeight(x, z), z));
    }
    this.elderK = 0;
    this.elderWalking = false;

    // ---------- her tree: the crown is split into seven parts that bloom back one by one ----------
    this.tree = null;
    this.ready = propModel('sakura', { part: 'small2', height: 4.9, anchor: 'bottom' }).then((m) => {
      m.position.copy(this.treePos).y -= 0.06;
      m.rotation.y = 0.9;
      this.scene.add(m);
      m.updateMatrixWorld(true);
      this.tree = m;
      m.traverse((o) => {
        if (!o.isMesh || o.material.name !== 'foliage') return;
        o.material = o.material.clone();
        o.material.emissive = new THREE.Color(0x3a2228);
        this._splitCrown(o);
        this.foliageMap = o.material.map;
      });
      this._makeSprigs();
    });

    // ---------- petals blown off the tree at the end ----------
    const N = 1400;
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.burst = new THREE.Points(bg, new THREE.PointsMaterial({
      map: petalTexture(), color: 0xf6c6d2, size: 0.2, transparent: true, alphaTest: 0.3, depthWrite: false,
    }));
    this.burst.frustumCulled = false;
    this.burst.visible = false;
    this.scene.add(this.burst);
    this.burstV = new Float32Array(N * 3);
    this.burstD = new Float32Array(N);
    this.burstT = -1;
  }

  /** Reorder the foliage cards: the third still on the tree first, then seven sectors around it. */
  _splitCrown(mesh) {
    const geo = mesh.geometry = mesh.geometry.clone();
    const idx = geo.index.array;
    const pos = geo.attributes.position;
    const nv = pos.count;
    const parent = new Int32Array(nv).map((_, i) => i);
    const find = (a) => { while (parent[a] !== a) a = parent[a] = parent[parent[a]]; return a; };
    for (let t = 0; t < idx.length; t += 3) {
      const a = find(idx[t]), b = find(idx[t + 1]), c = find(idx[t + 2]);
      parent[a] = b; parent[find(b)] = find(c);
    }
    const cards = new Map();
    for (let t = 0; t < idx.length; t += 3) {
      const r = find(idx[t]);
      if (!cards.has(r)) cards.set(r, { tris: [], c: new THREE.Vector3(), n: 0 });
      const cd = cards.get(r);
      cd.tris.push(t);
      for (let j = 0; j < 3; j++) { const v = idx[t + j]; cd.c.x += pos.getX(v); cd.c.y += pos.getY(v); cd.c.z += pos.getZ(v); cd.n++; }
    }
    const list = [...cards.values()];
    const box = new THREE.Box3();
    for (const cd of list) { cd.c.divideScalar(cd.n); box.expandByPoint(cd.c); }
    const mid = box.getCenter(new THREE.Vector3());
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const base = [], rest = [];
    for (const cd of list) (rnd() < 0.3 ? base : rest).push(cd);
    rest.sort((a, b) => Math.atan2(a.c.z - mid.z, a.c.x - mid.x) - Math.atan2(b.c.z - mid.z, b.c.x - mid.x));
    const out = [];
    const push = (cd) => { for (const t of cd.tris) out.push(idx[t], idx[t + 1], idx[t + 2]); };
    base.forEach(push);
    const baseCount = out.length;
    const per = Math.ceil(rest.length / 7);
    for (let i = 0; i < 7; i++) {
      const part = rest.slice(i * per, (i + 1) * per).sort(() => rnd() - 0.5);
      const start = out.length;
      const c = new THREE.Vector3();
      for (const cd of part) { push(cd); c.add(cd.c); }
      c.divideScalar(Math.max(1, part.length));
      this.sectors.push({ start, end: out.length, centre: c, mesh, shown: false });
    }
    geo.setIndex(new THREE.BufferAttribute(out.length > 65535 ? new Uint32Array(out) : new Uint16Array(out), 1));
    this.crown = { geo, baseCount, full: out.length, count: baseCount, want: baseCount, cards: list, mid, mesh };
    geo.setDrawRange(0, baseCount);
  }

  /** Seven fallen sprigs around the valley, each a small branch of blossom lying in the grass. */
  _makeSprigs() {
    const tex = glowTexture();
    const mat = new THREE.MeshStandardMaterial({ map: this.foliageMap, alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, emissive: 0x5a2a36 });
    SPRIGS.forEach(([dx, dz], i) => {
      const x = this.treePos.x + dx, z = this.treePos.z + dz, y = valleyHeight(x, z);
      const obj = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mat);
      obj.castShadow = true;
      obj.position.set(x, y + 0.08, z);
      obj.rotation.set(-Math.PI / 2 + 0.25, 0, i * 1.7);
      obj.visible = false;
      this.scene.add(obj);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffd0dc, depthWrite: false, transparent: true, fog: false }));
      glow.scale.setScalar(2.2);
      glow.position.set(x, y + 0.25, z);
      glow.visible = false;
      this.scene.add(glow);
      const NM = 18;
      const mg = new THREE.BufferGeometry();
      mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NM * 3), 3));
      const motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xf7a9bf, size: 0.09, transparent: true, opacity: 0.9, depthWrite: false }));
      motes.position.set(x, y, z);
      motes.frustumCulled = false;
      motes.visible = false;
      this.scene.add(motes);
      const seeds = Array.from({ length: NM }, (_, j) => [Math.random() * 6.28, 0.1 + Math.random() * 0.4, j / NM]);
      this.sprigs.push({ obj, glow, motes, seeds, state: 'lying', x, z });
    });
    if (this.active) this.activate();
  }

  /** Cross-fade 阿念 to another clip. */
  _play(name, fade = 0.35) {
    const next = this.acts[name];
    if (!next || this.clip === name) return;
    const prev = this.acts[this.clip];
    this.clip = name;
    next.reset().setEffectiveWeight(1).play();
    if (prev && fade > 0) next.crossFadeFrom(prev, fade, false);
    else if (prev) prev.stop();
  }

  get total() { return 7; }
  get found() { return this.sprigs.filter((s) => s.state !== 'lying').length; }
  get bloomed() { return this.sectors.filter((s) => s.shown).length; }

  /** 阿念 has asked: the sprigs begin to glow. */
  activate() {
    this.active = true;
    for (const s of this.sprigs) if (s.state === 'lying') s.obj.visible = s.glow.visible = s.motes.visible = true;
  }

  nearest(x, z, reach = 1.6) {
    if (!this.active) return null;
    let best = null, bd = reach;
    for (const s of this.sprigs) {
      if (s.state !== 'lying') continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  /** Tap: the sprig lifts and flies to the next bare part of the crown. */
  pick(s) {
    s.state = 'flying';
    s.motes.visible = false;
    const sector = this.sectors.find((sc) => !sc.taken);
    sector.taken = true;
    const to = sector.mesh.localToWorld(sector.centre.clone());
    this.flights.push({ s, sector, t: 0, from: s.obj.position.clone(), to, q0: s.obj.quaternion.clone() });
    this.sound.bowl(1047, 0.05);
  }

  /** Everything home at once (debug). */
  completeAll() {
    this.active = true;
    for (const s of this.sprigs) { s.state = 'home'; s.obj.visible = s.glow.visible = s.motes.visible = false; }
    for (const sc of this.sectors) { sc.taken = sc.shown = true; }
    this.flights.length = 0;
    if (this.crown) { this.crown.want = this.crown.count = this.crown.full; this.crown.geo.setDrawRange(0, this.crown.full); }
    this.done = true;
  }

  /** The gust: the whole crown lets go at once. */
  gust() {
    if (!this.crown) return;
    this.crown.want = Math.floor(this.crown.baseCount * 0.25 / 3) * 3;
    this.crown.rate = 0.7; // the crown thins over a few seconds, not at once
    const arr = this.burst.geometry.attributes.position.array;
    const cards = this.crown.cards, m = this.crown.mesh;
    const v = new THREE.Vector3();
    for (let i = 0; i < arr.length / 3; i++) {
      v.copy(cards[(i * 7919) % cards.length].c);
      m.localToWorld(v);
      v.x += (Math.random() - 0.5) * 0.5; v.y += (Math.random() - 0.5) * 0.5; v.z += (Math.random() - 0.5) * 0.5;
      arr[i * 3] = v.x; arr[i * 3 + 1] = v.y; arr[i * 3 + 2] = v.z;
      this.burstV[i * 3] = 0.7 + Math.random() * 1.5;
      this.burstV[i * 3 + 1] = -0.1 + Math.random() * 0.6;
      this.burstV[i * 3 + 2] = 0.3 + Math.random() * 1.0;
      this.burstD[i] = Math.random() * 3.5; // when this one lets go
    }
    this.burst.geometry.attributes.position.needsUpdate = true;
    this.burst.visible = true;
    this.burstT = 0;
  }

  /** The grandmother starts down the path toward the tree. */
  elderComes() { this.elder.visible = true; this.elderWalking = true; this.elderK = 0; }

  update(dt, traveler) {
    this.t += dt;
    const t = this.t;

    // sprigs lying in the grass pulse softly, motes rising from them
    for (const s of this.sprigs) {
      if (s.state !== 'lying' || !this.active) continue;
      const pulse = 0.7 + Math.sin(t * 1.8 + s.x) * 0.3;
      s.glow.material.opacity = 0.5 + pulse * 0.4;
      s.glow.scale.setScalar(1.8 + pulse * 0.7);
      const arr = s.motes.geometry.attributes.position.array;
      s.seeds.forEach(([a, r, o], i) => {
        const k = (t * 0.25 + o) % 1;
        arr[i * 3] = Math.cos(a + k * 2) * r * (1 - k * 0.5);
        arr[i * 3 + 1] = 0.05 + k * 2.2;
        arr[i * 3 + 2] = Math.sin(a + k * 2) * r * (1 - k * 0.5);
      });
      s.motes.geometry.attributes.position.needsUpdate = true;
    }

    // flights: up in an arc, spinning, into the crown; then that part blooms
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      f.t += dt;
      const k = ss(f.t / 1.6, 0, 1);
      f.s.obj.position.lerpVectors(f.from, f.to, k);
      f.s.obj.position.y += Math.sin(Math.PI * k) * 1.6;
      f.s.obj.rotation.z += dt * 5;
      f.s.obj.scale.setScalar(1 - k * 0.7);
      f.s.glow.position.copy(f.s.obj.position);
      f.s.glow.material.opacity = 0.7;
      if (f.t >= 1.6) {
        this.flights.splice(i, 1);
        f.s.state = 'home';
        f.s.obj.visible = f.s.glow.visible = false;
        f.sector.shown = true;
        const n = this.bloomed;
        if (this.crown) this.crown.want = Math.max(this.crown.want, f.sector.end);
        this.sound.bowl(NOTES[n - 1], 0.11);
        this.hop = 1;
        if (n === this.total) this.done = true;
        if (this.onBloom) this.onBloom(n, this.total);
      }
    }

    // the crown fills (or empties) toward what it should show
    if (this.crown) {
      const c = this.crown;
      if (c.count !== c.want) {
        const step = Math.max(3, Math.floor(Math.abs(c.want - c.count) * Math.min(1, dt * (c.rate || 3)) / 3) * 3);
        c.count = c.count < c.want ? Math.min(c.want, c.count + step) : Math.max(c.want, c.count - step);
        c.geo.setDrawRange(0, c.count);
      }
    }

    // the gust's petals: blown downwind, sinking, swaying
    if (this.burstT >= 0) {
      this.burstT += dt;
      const arr = this.burst.geometry.attributes.position.array, V = this.burstV;
      for (let i = 0; i < arr.length / 3; i++) {
        if (this.burstT < this.burstD[i]) continue; // still on the branch
        V[i * 3 + 1] -= dt * 0.35;
        V[i * 3 + 1] = Math.max(V[i * 3 + 1], -0.7);
        arr[i * 3] += (V[i * 3] + Math.sin(t * 2 + i) * 0.4) * dt;
        arr[i * 3 + 1] = Math.max(valleyHeight(arr[i * 3], arr[i * 3 + 2]) + 0.03, arr[i * 3 + 1] + V[i * 3 + 1] * dt);
        arr[i * 3 + 2] += (V[i * 3 + 2] + Math.cos(t * 1.7 + i) * 0.4) * dt;
      }
      this.burst.geometry.attributes.position.needsUpdate = true;
      this.burst.material.opacity = 1 - ss(this.burstT, 14, 20);
      if (this.burstT > 20) { this.burst.visible = false; this.burstT = -1; }
    }

    // 阿念: turns toward the traveler when near, else up at her tree; hops when a part blooms
    const g = this.girl;
    let moving = false;
    if (this.girlMode === 'run' && this.runTo) {
      const dx = this.runTo.x - g.position.x, dz = this.runTo.z - g.position.z, d = Math.hypot(dx, dz);
      if (d > 0.9) {
        const sp = Math.min(d, 2.0 * dt);
        g.position.x += dx / d * sp; g.position.z += dz / d * sp;
        this.girlYaw = angleDamp(this.girlYaw, yawTo(g.position.x, g.position.z, this.runTo.x, this.runTo.z), 8, dt);
        g.userData.body.position.y = Math.abs(Math.sin(t * 11)) * 0.05;
        moving = true;
      } else {
        this.girlMode = 'idle';
        g.userData.body.position.y = 0;
      }
      g.position.y = valleyHeight(g.position.x, g.position.z);
      this.girlCollider.x = g.position.x; this.girlCollider.z = g.position.z;
    } else {
      const look = this.lookAt || ((Math.hypot(traveler.x - g.position.x, traveler.z - g.position.z) < 6) ? traveler : this.treePos);
      this.girlYaw = angleDamp(this.girlYaw, yawTo(g.position.x, g.position.z, look.x, look.z), 3, dt);
      this.hop = Math.max(0, this.hop - dt * 1.6);
      g.userData.body.position.y = Math.abs(Math.sin(this.hop * Math.PI * 3)) * 0.12 * this.hop;
      g.userData.body.scale.y = 1 + Math.sin(t * 2.2) * 0.008;
    }
    g.rotation.y = this.girlYaw;
    // she looks up a little at the tree while she waits
    g.userData.head.rotation.x = damp(g.userData.head.rotation.x, (this.lookAt && this.lookAt !== this.treePos) || this.girlMode === 'run' ? 0 : 0.18, 2, dt);
    if (this.girlMode === 'wave') {
      g.userData.armR.rotation.z = -2.4 + Math.sin(t * 9) * 0.35;
    } else g.userData.armR.rotation.z = damp(g.userData.armR.rotation.z, 0.28, 4, dt);
    if (this.model) {
      // the model: a little hop when a part blooms, then the right clip for what she is doing
      this.model.position.y = g.userData.body.position.y - (moving ? Math.abs(Math.sin(t * 11)) * 0.05 : 0) + this._foot;
      this._play(moving ? 'Run_02' : this.girlMode === 'wave' ? 'Formal_Bow' : 'Idle_9', this.girlMode === 'wave' ? 0.5 : 0.3);
      this.mixer.update(dt);
    }

    // the grandmother: a slow walk up the path, the stick ticking along
    if (this.elderWalking) {
      this.elderK = Math.min(this.elderPath.length - 1, this.elderK + dt * 0.45);
      const i = Math.floor(this.elderK), f = this.elderK - i;
      const a = this.elderPath[i], b = this.elderPath[Math.min(i + 1, this.elderPath.length - 1)];
      this.elder.position.lerpVectors(a, b, f);
      this.elder.rotation.y = yawTo(a.x, a.z, b.x, b.z);
      this.elder.userData.body.position.y = Math.abs(Math.sin(t * 4)) * 0.02;
      if (this.elderK >= this.elderPath.length - 1) this.elderWalking = false;
      // she stops where 阿念 reaches her
      if (this.elder.position.distanceTo(this.girl.position) < 1.3) this.elderWalking = false;
    }
  }

  /** Where the grandmother is now (for the girl to run to). */
  get elderPos() { return this.elder.position; }
}
