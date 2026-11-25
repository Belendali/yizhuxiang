import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { propModel, propParts } from './models.js';
import { valleyHeight, valleyPathX, NIAN } from './valley.js';

// 第一章 · 落花谷: 阿念 and her tree in full bloom. Her grandmother said she would be back
// today, and the wind is rising; 阿念 asks the traveler to keep the blossom for her.
// Holding stops the world: the falling petals hang in the air, but 阿念 and the grandmother
// far down the path stop too. Only when the traveler lets go does the grandmother come,
// and she arrives with the last gust: 落花的时候 最好看 (落花祭).
//
// 阿念 is a rigged model (idle, run, bow); until it loads, and for the grandmother, a simple
// turned figure stands in.

const ss = THREE.MathUtils.smoothstep;
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
const angleDamp = (a, b, rate, dt) => { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * (1 - Math.exp(-rate * dt)); };
const yawTo = (x, z, tx, tz) => Math.atan2(-(tx - x), -(tz - z));

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
    this.burst = null;
    this.rain = null;     // the 3D petals coming off her tree
    this.rainK = 0;       // 0..1: how hard it is falling
    this.rainWind = new THREE.Vector3(0.45, 0, 0.42);
    this.elderSpeed = 0.32; // path points per second (about 0.42 m/s, matched to her limping stride)
    this.elderLook = null; // who the grandmother turns to once she has stopped

    const tx = NIAN.x, tz = NIAN.z, ty = valleyHeight(tx, tz);
    this.treePos = new THREE.Vector3(tx, ty, tz);
    valley.colliders.push({ x: tx, z: tz, r: 0.45 });

    // ---------- 阿念: sitting on a stone in front of her tree, her back to the path ----------
    this.girl = figure({ height: 1.12, robe: 0xd98a95, sash: 0xb2413a, hair: 0x2a1d18, buns: true });
    const px = valleyPathX(tz);
    this.girlHome = new THREE.Vector3(tx + (px - tx) * 0.35, 0, tz + 2.0);
    this.girlHome.y = valleyHeight(this.girlHome.x, this.girlHome.z);
    this.girl.position.copy(this.girlHome);
    this.girlYaw = yawTo(this.girlHome.x, this.girlHome.z, tx, tz);
    this.girl.rotation.y = this.girlYaw;
    this.scene.add(this.girl);
    // the stone she sits on, just behind her feet
    const bx = Math.sin(this.girlYaw), bz = Math.cos(this.girlYaw);
    this.seatPos = new THREE.Vector3(this.girlHome.x + bx * 0.3, 0, this.girlHome.z + bz * 0.3);
    this.seatPos.y = valleyHeight(this.seatPos.x, this.seatPos.z);
    // a knee-high mound of the valley's stones (the pile model, 0.95 m across, about 0.42 m high)
    this.seat = new THREE.Group();
    this.seat.position.copy(this.seatPos);
    this.seat.rotation.y = this.girlYaw + 1.2;
    this.scene.add(this.seat);
    propModel('rocks', { width: 0.95, anchor: 'bottom' }).then((m) => this.seat.add(m))
      .catch((e) => console.warn('seat stones not loaded', e));
    this.seatCollider = { x: this.seatPos.x, z: this.seatPos.z, r: 0.4 };
    valley.colliders.push(this.seatCollider);
    this.girlCollider = { x: this.girlHome.x, z: this.girlHome.z, r: 0.3 };
    valley.colliders.push(this.girlCollider);
    this.seated = true;   // until the traveler says hello
    this.stepTo = null;   // where she steps to once she is up
    this.riseT = -1;      // time since she began to stand
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
      const rise = this.acts.Sit_to_Stand_Transition_M;
      if (rise) { rise.setLoop(THREE.LoopOnce); rise.clampWhenFinished = true; }
      this._play('Idle_9', 0);
      this.mixer.update(0);
      // measure her standing in the idle pose (a skinned box needs the bones posed first)
      m.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(m, true);
      const s = 1.12 / (box.max.y - box.min.y);
      m.scale.setScalar(s);
      m.position.y = this._foot = -box.min.y * s;
      m.rotation.y = Math.PI; // the model faces +Z; the figure convention is -Z
      // sitting (and getting up) the clips carry her back onto the seat; this shift lines the
      // end of getting up with the standing pose
      this._sitShift = 0.27 * s;
      if (this.seated) this._play('Chair_Sit_Idle_F', 0);
      m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
      this.model = m;
      this.girl.userData.body.visible = false;
      this.girl.add(m);
      if (this.seated) {
        // slide the stone right under her hips in the sitting pose
        m.position.z = -this._sitShift;
        this.mixer.update(0);
        this.girl.updateMatrixWorld(true);
        const hips = m.getObjectByName('mixamorigHips');
        if (hips) {
          const h = hips.getWorldPosition(new THREE.Vector3());
          h.x += Math.sin(this.girlYaw) * 0.12; h.z += Math.cos(this.girlYaw) * 0.12; // a little behind, clear of her feet
          this.seat.position.set(h.x, valleyHeight(h.x, h.z) - 0.03, h.z);
          this.seatCollider.x = h.x; this.seatCollider.z = h.z;
          this.seat.scale.y = Math.max(0.6, (h.y - this.seat.position.y - 0.07) / 0.42);
        }
      }
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
    // her model (assets/models/elder.glb, Meshy + Mixamo: Injured_Walk, Idle_4) replaces the stand-in
    this.elderMixer = null;
    this.elderActs = {};
    this.elderClip = null;
    new GLTFLoader().load(`./assets/models/elder.glb?v=${window.__V || ''}`, (gltf) => {
      const m = gltf.scene;
      this.elderMixer = new THREE.AnimationMixer(m);
      for (const c of gltf.animations) this.elderActs[c.name] = this.elderMixer.clipAction(c);
      this._elderPlay('Idle_4', 0);
      this.elderMixer.update(0);
      m.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(m, true);
      const sc = 1.5 / (box.max.y - box.min.y);
      m.scale.setScalar(sc);
      m.position.y = -box.min.y * sc;
      m.rotation.y = Math.PI; // the model faces +Z; the figure convention is -Z
      m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
      this.elder.userData.body.visible = false;
      stick.visible = false;
      this.elder.add(m);
    }, undefined, (e) => console.warn('grandmother model not loaded; keeping the stand-in', e));
    this.elderPath = [];
    for (let i = 0; i <= 8; i++) {
      const z = tz - 15 + i * 1.3;
      const x = valleyPathX(z);
      this.elderPath.push(new THREE.Vector3(x, valleyHeight(x, z), z));
    }
    this.elderK = 0;
    this.elderWalking = false;

    // ---------- her tree, in full bloom; the wind thins it card by card ----------
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
    });
    this._makeRain();

    // ---------- blossoms already fallen under her tree ----------
    propParts('blossom', { width: 0.24, anchor: 'bottom' }).then((parts) => {
      let sd = 5;
      const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
      const N = 16, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
      const mats = [];
      for (let i = 0, tries = 0; mats.length < N && tries < 80; tries++) {
        const a = rnd() * Math.PI * 2, r = 0.8 + rnd() * 2.6;
        const x = tx + Math.cos(a) * r, z = tz + Math.sin(a) * r;
        if (Math.hypot(x - this.girlHome.x, z - this.girlHome.z) < 1.0) continue;
        e.set((rnd() - 0.5) * 0.5, rnd() * 6.28, (rnd() - 0.5) * 0.5);
        m4.compose(v.set(x, valleyHeight(x, z) - 0.01, z), q.setFromEuler(e), sc.setScalar(0.7 + rnd() * 0.6));
        mats.push(m4.clone());
      }
      for (const p of parts) {
        const inst = new THREE.InstancedMesh(p.geometry, p.material, mats.length);
        mats.forEach((m, i) => inst.setMatrixAt(i, m));
        inst.castShadow = inst.receiveShadow = true;
        this.scene.add(inst);
      }
    }).catch((e) => console.warn('blossom model not loaded', e));

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

  /** Shuffle the foliage cards so the crown can thin evenly (a draw range over a random order). */
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
    for (const cd of list) cd.c.divideScalar(cd.n);
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
    const out = [];
    for (const cd of list) for (const t of cd.tris) out.push(idx[t], idx[t + 1], idx[t + 2]);
    geo.setIndex(new THREE.BufferAttribute(out.length > 65535 ? new Uint32Array(out) : new Uint16Array(out), 1));
    // the first 30% of cards (in draw order) are what stays after the last gust
    const baseCount = Math.floor(out.length * 0.3 / 3) * 3;
    this.crown = { geo, baseCount, full: out.length, count: out.length, want: out.length, cards: list, mesh };
    geo.setDrawRange(0, out.length);
  }

  /** The petals that fall off her tree: three curled petal shapes and a few whole flowers. */
  _makeRain() {
    const KINDS = [['p1', 0.095, 100], ['p2', 0.09, 90], ['p3', 0.095, 90], ['flower', 0.13, 26]];
    const n = KINDS.reduce((a, k) => a + k[2], 0);
    this.rainP = new Float32Array(n * 3);
    this.rainV = new Float32Array(n * 4);  // fall speed, sway phase, sway amount, spin speed
    this.rainQ = Array.from({ length: n }, () => new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6)));
    this.rainAxis = Array.from({ length: n }, () => new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize());
    this.rainS = new Float32Array(n);      // size; 0 = not falling yet
    this.rainKinds = [];
    for (let i = 0; i < n; i++) this._respawn(i, true);
    let at = 0;
    for (const [part, width, count] of KINDS) {
      const kind = { from: at, count, meshes: [] };
      at += count;
      this.rainKinds.push(kind);
      propParts('petals', { part, width, anchor: 'center' }).then((parts) => {
        for (const p of parts) {
          const mat = p.material.clone();
          mat.side = THREE.DoubleSide;
          mat.emissive = new THREE.Color(0x3a1c24); // a little glow so they read against the shade
          const inst = new THREE.InstancedMesh(p.geometry, mat, count);
          inst.frustumCulled = false;
          inst.castShadow = true;
          kind.meshes.push(inst);
          this.scene.add(inst);
        }
      }).catch((e) => console.warn('petal model not loaded', e));
    }
  }

  /** Put a petal back up in the crown (or, at the start, anywhere in the air under it). */
  _respawn(i, anywhere = false) {
    const P = this.rainP, V = this.rainV;
    const tp = this.treePos;
    let x, y, z;
    const c = this.crown;
    if (c && !anywhere && Math.random() < 0.75) {
      // off a card still on the tree
      const cd = c.cards[Math.floor(Math.random() * Math.max(1, (c.count / c.full) * c.cards.length))];
      _v.copy(cd.c); c.mesh.localToWorld(_v);
      x = _v.x; y = _v.y; z = _v.z;
    } else {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 3.4;
      x = tp.x + Math.cos(a) * r; z = tp.z + Math.sin(a) * r + 1.2;
      y = tp.y + 0.3 + Math.random() * 4.0;
    }
    P[i * 3] = x; P[i * 3 + 1] = y; P[i * 3 + 2] = z;
    V[i * 4] = 0.35 + Math.random() * 0.35;
    V[i * 4 + 1] = Math.random() * 6.28;
    V[i * 4 + 2] = 0.25 + Math.random() * 0.45;
    V[i * 4 + 3] = 1.2 + Math.random() * 2.8;
    this.rainS[i] = 0.75 + Math.random() * 0.5;
  }

  _updateRain(dt) {
    if (!this.rainKinds) return;
    const P = this.rainP, V = this.rainV, n = this.rainS.length, t = this.t, w = this.rainWind;
    const live = Math.floor(n * this.rainK);
    const tp = this.treePos;
    for (let i = 0; i < n; i++) {
      if (i >= live) continue;
      const k = i * 3;
      const sway = Math.sin(t * 1.3 + V[i * 4 + 1]) * V[i * 4 + 2];
      P[k] += (w.x + sway) * dt;
      P[k + 1] -= V[i * 4] * dt * (0.8 + Math.abs(Math.cos(t * 1.1 + V[i * 4 + 1])) * 0.4);
      P[k + 2] += (w.z + Math.cos(t * 1.7 + V[i * 4 + 1]) * V[i * 4 + 2] * 0.6) * dt;
      _q.setFromAxisAngle(this.rainAxis[i], V[i * 4 + 3] * dt);
      this.rainQ[i].premultiply(_q);
      const ground = valleyHeight(P[k], P[k + 2]) + 0.02;
      if (P[k + 1] < ground || Math.hypot(P[k] - tp.x, P[k + 2] - tp.z) > 11) this._respawn(i);
    }
    for (const kind of this.rainKinds) {
      for (let j = 0; j < kind.count; j++) {
        const i = kind.from + j;
        const on = i < live;
        _m.compose(_v.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]), this.rainQ[i], _sc.setScalar(on ? this.rainS[i] : 0));
        for (const inst of kind.meshes) inst.setMatrixAt(j, _m);
      }
      for (const inst of kind.meshes) inst.instanceMatrix.needsUpdate = true;
    }
  }

  /** The traveler said hello: she gets up from her stone (then turns, via lookAt). */
  standUp() { if (this.seated && this.riseT < 0) this.riseT = 0; }
  /** Already standing (debug jumps past the meeting). */
  standNow() { this.seated = false; this.riseT = -1; this.stepTo = null; }

  /** Cross-fade the grandmother to another clip. */
  _elderPlay(name, fade = 0.4) {
    const next = this.elderActs[name];
    if (!next || this.elderClip === name) return;
    const prev = this.elderActs[this.elderClip];
    this.elderClip = name;
    next.reset().setEffectiveWeight(1).play();
    if (name === 'Injured_Walk') next.timeScale = 1.12; // an old woman's slow, limping step
    if (prev && fade > 0) next.crossFadeFrom(prev, fade, false);
    else if (prev) prev.stop();
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

  /** How far the grandmother has come, 0..1. */
  get progress() { return this.elderK / (this.elderPath.length - 1); }

  /** The wind rises: petals start to come off, the crown thins as the grandmother nears. */
  startWind() { this.active = true; }
  /** Debug: the wind already up and the petals falling. */
  windNow() { this.active = true; this.rainK = 1; }

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
  elderComes(k = 0) {
    this.elder.visible = true; this.elderWalking = true; this.elderK = k;
    const a = this.elderPath[0], b = this.elderPath[1];
    this.elder.position.copy(a);
    this.elder.rotation.y = yawTo(a.x, a.z, b.x, b.z);
  }

  update(dt, traveler) {
    this.t += dt;
    const t = this.t;

    // the wind: more petals as it rises; the crown thins as the grandmother comes
    if (this.active) {
      this.rainK = Math.min(1, this.rainK + dt / 6);
      if (this.crown && this.burstT < 0) {
        const c = this.crown;
        const want = c.full - (c.full - c.baseCount * 2) * Math.min(1, this.progress * 1.1);
        c.want = Math.min(c.want, Math.floor(want / 3) * 3);
        c.rate = 1;
      }
    }
    this._updateRain(dt);

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
    } else if (this.stepTo) {
      // up from the stone: a few quick steps round it, so nothing stands between her and the traveler
      const dx = this.stepTo.x - g.position.x, dz = this.stepTo.z - g.position.z, d = Math.hypot(dx, dz);
      if (d > 0.04) {
        const sp = Math.min(d, 1.5 * dt);
        g.position.x += dx / d * sp; g.position.z += dz / d * sp;
        this.girlYaw = angleDamp(this.girlYaw, yawTo(0, 0, dx, dz), 10, dt);
        moving = true;
      } else this.stepTo = null;
      g.position.y = valleyHeight(g.position.x, g.position.z);
      this.girlCollider.x = g.position.x; this.girlCollider.z = g.position.z;
    } else if (this.seated) {
      // on her stone, looking at her tree, not turning round
      if (this.riseT >= 0) {
        this.riseT += dt;
        if (this.riseT > 3.1) {
          this.seated = false; this.riseT = -1;
          // step out to the side of the stone nearer the traveler, a little toward them
          const bx = Math.sin(this.girlYaw), bz = Math.cos(this.girlYaw); // her back
          const sx = bz, sz = -bx;
          const side = ((traveler.x - g.position.x) * sx + (traveler.z - g.position.z) * sz) >= 0 ? 1 : -1;
          this.stepTo = new THREE.Vector3(g.position.x + sx * side * 0.75 + bx * 0.3, 0, g.position.z + sz * side * 0.75 + bz * 0.3);
        }
      }
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
      this.model.position.z = this.seated ? -this._sitShift : damp(this.model.position.z, 0, 5, dt);
      const clip = this.seated ? (this.riseT >= 0 ? 'Sit_to_Stand_Transition_M' : 'Chair_Sit_Idle_F')
        : moving ? 'Run_02' : this.girlMode === 'wave' ? 'Formal_Bow' : 'Idle_9';
      this._play(clip, this.girlMode === 'wave' ? 0.5 : clip === 'Sit_to_Stand_Transition_M' ? 0.25 : 0.4);
      this.mixer.update(dt);
    }

    // the grandmother: a slow walk up the path, the stick ticking along
    if (this.elderWalking) {
      this.elderK = Math.min(this.elderPath.length - 1, this.elderK + dt * this.elderSpeed);
      const i = Math.floor(this.elderK), f = this.elderK - i;
      const a = this.elderPath[i], b = this.elderPath[Math.min(i + 1, this.elderPath.length - 1)];
      this.elder.position.lerpVectors(a, b, f);
      this.elder.rotation.y = angleDamp(this.elder.rotation.y, yawTo(a.x, a.z, b.x, b.z), 4, dt);
      this.elder.userData.body.position.y = Math.abs(Math.sin(t * 4)) * 0.02;
      if (this.elderK >= this.elderPath.length - 1) this.elderWalking = false;
      // she stops where 阿念 reaches her
      if (this.elder.position.distanceTo(this.girl.position) < 1.3) this.elderWalking = false;
    } else if (this.elder.visible) {
      // stopped: she turns to 阿念 (or to whoever she is talking to)
      const e = this.elder.position, gp = this.elderLook || this.girl.position;
      if (this.elderLook || Math.hypot(gp.x - e.x, gp.z - e.z) < 4) this.elder.rotation.y = angleDamp(this.elder.rotation.y, yawTo(e.x, e.z, gp.x, gp.z), 3, dt);
    }
    if (this.elderMixer && this.elder.visible) {
      this._elderPlay(this.elderWalking ? 'Injured_Walk' : 'Idle_4');
      this.elderMixer.update(dt);
    }
  }

  /** Where the grandmother is now (for the girl to run to). */
  get elderPos() { return this.elder.position; }
}
const _v = new THREE.Vector3(), _q = new THREE.Quaternion(), _m = new THREE.Matrix4(), _sc = new THREE.Vector3();
