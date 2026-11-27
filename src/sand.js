import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { valleyHeight, SAND_AT } from './valley.js';

// 第一章 · 沙上画: a little further down the path from 阿念's tree, a patch of pale sand beside
// the path where children are drawing with twigs. The boy hands the traveler his twig; they
// kneel and draw whatever they like; when they say it is done, the wind takes the drawing off.

export const SAND = { x: SAND_AT.x, z: SAND_AT.z, w: 4.6, d: 3.4 };
// where the traveler kneels to draw (the near edge, facing up the valley) and where the boy squats
export const SAND_SPOT = { x: SAND.x - 0.35, z: SAND.z + SAND.d / 2 + 0.45 };
export const KID_SPOT = { x: SAND.x + 1.0, z: SAND.z - SAND.d / 2 + 0.75 };

const CW = 1024, CH = Math.round(CW * SAND.d / SAND.w);
const x0 = SAND.x - SAND.w / 2, z0 = SAND.z - SAND.d / 2;
const toPx = (x, z) => [(x - x0) / SAND.w * CW, (z - z0) / SAND.d * CH];
const toWorld = (px, py, out) => {
  const x = x0 + px / CW * SAND.w, z = z0 + py / CH * SAND.d;
  return out.set(x, valleyHeight(x, z) + 0.03, z);
};

// The child's pictures, in metres on the sand around their seat (x right, z toward the traveler).
// Each is a list of strokes; each stroke a list of points.
function circle(cx, cz, r, n = 20, a0 = 0) {
  return Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (i / n) * Math.PI * 2; return [cx + Math.cos(a) * r, cz + Math.sin(a) * r]; });
}
const KID_PICS = [
  // a sun
  [circle(0, 0.75, 0.2), ...Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return [[Math.cos(a) * 0.28, 0.75 + Math.sin(a) * 0.28], [Math.cos(a) * 0.4, 0.75 + Math.sin(a) * 0.4]]; })],
  // a fish
  [[[-0.42, 0.8], [-0.2, 0.62], [0.12, 0.6], [0.3, 0.75], [0.12, 0.92], [-0.2, 0.9], [-0.42, 0.72]], [[-0.42, 0.72], [-0.58, 0.6], [-0.58, 0.92], [-0.42, 0.8]], [[0.16, 0.72], [0.18, 0.74]]],
];

// a girl's pictures: a flower, a little house
const RED_PICS = [
  [circle(0, 0.8, 0.07, 14), ...Array.from({ length: 5 }, (_, i) => { const a = (i / 5) * Math.PI * 2 + 0.3; return circle(Math.cos(a) * 0.15, 0.8 + Math.sin(a) * 0.15, 0.075, 12, a + Math.PI); }),
    [[0, 0.66], [0.02, 0.52], [0.0, 0.4]], [[0.01, 0.5], [0.12, 0.55], [0.15, 0.48], [0.02, 0.48]]],
  [[[-0.17, 0.45], [0.17, 0.45], [0.17, 0.72], [-0.17, 0.72], [-0.17, 0.45]], [[-0.24, 0.72], [0, 0.93], [0.24, 0.72]], [[-0.04, 0.45], [-0.04, 0.58], [0.04, 0.58], [0.04, 0.45]]],
];

const TWIG_LEN = 0.44;
// how a drawing child leans in and reaches down (radians, about their own left-right axis)
const REACH = { lean: 0.2, back: 0.55 };
const GRIP = 0.3; // a child holds their twig this far up from its tip
const DOWN = new THREE.Vector3(0, -1, 0);
const KID_SCALE = 0.72; // the models come in at grown-up height; children of seven or eight
// face: the way each child looks, [x, z]; pose: the clip they hold; t: where in it they start
const KIDS = [
  // the boy in bamboo green: asks the traveler over and hands them a twig, then draws again
  { file: 'kid-bamboo', x: KID_SPOT.x, z: KID_SPOT.z, face: [0, 1], pose: 'CrouchLookAroundBow', t: 0, r: 0.45, pics: KID_PICS },
  // a girl in red, drawing at the far corner
  { file: 'kid-red', x: SAND.x - 1.05, z: SAND.z - SAND.d / 2 + 0.8, face: [0.5, 1], pose: 'CrouchLookAroundBow', t: 2.6, r: 0.42, pics: RED_PICS },
  // a boy sitting cross-legged at the side, watching
  { file: 'kid-wander', x: SAND.x + SAND.w / 2 - 0.45, z: SAND.z + 0.35, face: [-1, -0.1], pose: 'Sit_Cross_Legged_on_Floor', t: 0.9, r: 0.45 },
];
const ss = THREE.MathUtils.smoothstep;
const angleTo = (a, b, k) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * k;

export class Sand {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);

    // ---- the sand: a base of fine grain and ripples, and a layer of grooves drawn on top
    this.base = document.createElement('canvas');
    this.base.width = CW; this.base.height = CH;
    this._paintBase();
    this.layer = document.createElement('canvas');
    this.layer.width = CW; this.layer.height = CH;
    this.lctx = this.layer.getContext('2d');
    // strokes still being drawn (the traveler's and the child's), redrawn whole each time so
    // a groove is one smooth path rather than a string of overlapping dabs
    this.cur = document.createElement('canvas');
    this.cur.width = CW; this.cur.height = CH;
    this.cctx = this.cur.getContext('2d');
    this.scratch = document.createElement('canvas');
    this.scratch.width = CW; this.scratch.height = CH;
    this.view = document.createElement('canvas');
    this.view.width = CW; this.view.height = CH;
    this.vctx = this.view.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.view);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    this.dirty = true;

    // a grid laid over the ground, so the sand follows the valley floor
    const nx = 46, nz = 34;
    const geo = new THREE.PlaneGeometry(SAND.w, SAND.d, nx, nz);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i) + SAND.x, z = pos.getZ(i) + SAND.z;
      pos.setXYZ(i, x, valleyHeight(x, z) + 0.025, z);
      uv.setXY(i, (x - x0) / SAND.w, 1 - (z - z0) / SAND.d);
    }
    geo.computeVertexNormals();
    this.mat = new THREE.MeshStandardMaterial({
      map: this.tex, roughness: 1, transparent: true, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.receiveShadow = true;
    this.mesh.renderOrder = 1;
    this.group.add(this.mesh);

    // ---- sand lifted by the wind: fine grains that hop and stream off the lines, and a little
    // dust above them. Plain sand colour, faded per grain (no glow, nothing bright enough to bloom).
    const dot = document.createElement('canvas'); dot.width = dot.height = 32;
    const dc = dot.getContext('2d'), gr = dc.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    dc.fillStyle = gr; dc.fillRect(0, 0, 32, 32);
    const dotTex = new THREE.CanvasTexture(dot);
    const cloud = (n, size, opacity) => {
      const g = new THREE.BufferGeometry();
      const c = {
        n, pos: new Float32Array(n * 3), vel: new Float32Array(n * 3), col: new Float32Array(n * 4),
        life: new Float32Array(n).fill(-1), max: new Float32Array(n), floor: new Float32Array(n), grav: new Float32Array(n), a: new Float32Array(n),
      };
      c.pos.fill(-999);
      g.setAttribute('position', new THREE.BufferAttribute(c.pos, 3));
      g.setAttribute('color', new THREE.BufferAttribute(c.col, 4));
      c.mat = new THREE.PointsMaterial({ size, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, opacity });
      c.points = new THREE.Points(g, c.mat);
      c.points.frustumCulled = false;
      c.points.renderOrder = 2;
      this.group.add(c.points);
      return c;
    };
    this.grains = cloud(3000, 0.032, 1);
    this.dust = cloud(120, 0.42, 0.32);

    // ---- the children: the boy in bamboo green who asks the traveler over (and hands them the
    // twig), a girl in red drawing at the far corner, and a boy sitting at the side to watch.
    const loader = new GLTFLoader();
    this.kids = KIDS.map((k) => {
      const g = new THREE.Group();
      g.position.set(k.x, valleyHeight(k.x, k.z), k.z);
      g.rotation.y = Math.atan2(k.face[0], k.face[1]);
      this.group.add(g);
      const kid = { spec: k, group: g, yaw0: g.rotation.y, mixer: null, acts: {}, cur: null, head: null };
      loader.load(`./assets/models/${k.file}.glb?v=${window.__V || ''}`, (gltf) => {
        const m = gltf.scene;
        m.scale.setScalar(KID_SCALE);
        m.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
        g.add(m);
        kid.mixer = new THREE.AnimationMixer(m);
        for (const c of gltf.animations) kid.acts[c.name] = kid.mixer.clipAction(c);
        kid.head = m.getObjectByName('mixamorigHead');
        // bones the drawing reach bends (put back to the clip's pose before each mixer update)
        kid.reachBones = ['Spine1', 'Spine2', 'RightArm', 'RightForeArm'].map((n) => m.getObjectByName('mixamorig' + n));
        kid.saved = kid.reachBones.map((b) => b.quaternion.clone());
        kid.reach = 0;
        kid.hands = [m.getObjectByName('mixamorigLeftHand'), m.getObjectByName('mixamorigRightHand')];
        if (kid === this.kids[0]) this._prepGive(kid);
        this._pose(kid, k.pose, 0);
        if (kid.cur) kid.cur.time = k.t;
        kid.mixer.update(0);
      });
      return kid;
    });
    this.kid = this.kids[0].group;

    // ---- twigs: the one the traveler draws with (still called the brush by the game; its pivot
    // at the tip), one in each drawing child's hand, and a spare lying by the boy, which he
    // picks up once he has given the traveler his own.
    this.brush = new THREE.Group();
    this.brush.visible = false;
    this.groundTwig = new THREE.Group();
    this.group.add(this.brush, this.groundTwig);
    for (const kid of this.kids) {
      if (!kid.spec.pics) continue;
      kid.twig = new THREE.Group();
      this.group.add(kid.twig);
    }
    new GLTFLoader().load(`./assets/models/twig.glb?v=${window.__V || ''}`, (g) => {
      // grip: how far up from the tip the group's origin sits
      const make = (grip) => {
        const m = g.scene.clone(true);
        const s = TWIG_LEN / 1.9;
        m.scale.set(s, s * 0.55, s * 0.55);
        m.rotation.z = Math.PI / 2; // its length along +Y, the thin end down
        m.position.y = TWIG_LEN / 2 - grip;
        m.traverse((o) => { if (o.isMesh) o.castShadow = true; });
        return m;
      };
      this.brush.add(make(0));
      this.groundTwig.add(make(TWIG_LEN / 2));
      for (const kid of this.kids) if (kid.twig) kid.twig.add(make(GRIP));
    });
    // a point at the boy's head, for his spoken lines to stand beside
    this.speaker = new THREE.Object3D();
    this.speaker.position.set(KID_SPOT.x, valleyHeight(KID_SPOT.x, KID_SPOT.z) + 0.8, KID_SPOT.z);
    this.group.add(this.speaker);
    this.colliders = KIDS.map((k) => ({ x: k.x, z: k.z, r: k.r }));
    this.giving = 0; this.picking = 0;
    this.REACH = REACH; // (for tuning from the console)
    this._q = new THREE.Quaternion();
    // a twig carried in the fist
    this._inHand = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
    // the children who draw, and what each of them draws, picture after picture
    this.drawers = this.kids.filter((k) => k.spec.pics).map((kid) => {
      const k = kid.spec;
      return kid.drawer = { kid, x: k.x, z: k.z, yaw: Math.atan2(k.face[0], k.face[1]), pics: k.pics, n: -1, s: 0, t: 0, pts: [], line: null };
    });
    this._v2 = new THREE.Vector3(); this._v3 = new THREE.Vector3(); this._v4 = new THREE.Vector3(); this._q4 = new THREE.Quaternion(); this._q2 = new THREE.Quaternion(); this._q3 = new THREE.Quaternion(); this._qw = new THREE.Quaternion();
    // drawing state
    this.strokes = [];      // traveler's points in world space (for the wind to lift)
    this.ink = 0;           // how much the traveler has drawn, in canvas px
    this.last = null;       // last canvas point of the current stroke
    this.stroke = null;     // the traveler's stroke in progress (canvas points)
    this.blowing = 0;       // seconds since the wind came; 0 = calm
    this._ray = new THREE.Raycaster();
    this._v = new THREE.Vector3();
  }

  _paintBase() {
    const c = this.base.getContext('2d');
    const img = c.createImageData(CW, CH);
    const d = img.data;
    for (let y = 0; y < CH; y++) {
      for (let x = 0; x < CW; x++) {
        const i = (y * CW + x) * 4;
        // soft wind ripples across the sand, and grain
        const rip = Math.sin(x * 0.045 + Math.sin(y * 0.02) * 2.2 + y * 0.012) * 0.5 + 0.5;
        const g = (Math.random() - 0.5) * 18;
        const v = 214 + rip * 10 + g;
        d[i] = v; d[i + 1] = v * 0.93; d[i + 2] = v * 0.8;
        // a rounded, uneven patch whose edge thins into the grass
        const ux = (x / CW) * 2 - 1, uy = (y / CH) * 2 - 1;
        const ang = Math.atan2(uy, ux);
        const rim = 0.92 + Math.sin(ang * 3 + 0.7) * 0.05 + Math.sin(ang * 7 + 2.1) * 0.03;
        const r = Math.pow(Math.pow(Math.abs(ux), 2.6) + Math.pow(Math.abs(uy), 2.6), 1 / 2.6) / rim;
        const e = Math.max(0, Math.min(1, (1 - r) / 0.22 + (Math.random() - 0.5) * 0.25));
        d[i + 3] = 255 * e * e * (3 - 2 * e);
      }
    }
    c.putImageData(img, 0, 0);
  }

  /** Canvas point under a screen position (NDC), or null if off the sand. */
  pick(ndcX, ndcY, camera) {
    this._ray.setFromCamera({ x: ndcX, y: ndcY }, camera);
    const hit = this._ray.intersectObject(this.mesh, false)[0];
    if (!hit) return null;
    const [px, py] = toPx(hit.point.x, hit.point.z);
    if (px < 30 || py < 30 || px > CW - 30 || py > CH - 30) return null;
    return { px, py, point: hit.point };
  }

  /** One groove along a whole stroke: the lip of sand pushed up beside it, the groove, its shaded floor. */
  _groove(ctx, pts, w = 1) {
    if (pts.length < 2) return;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const path = (ox, oy) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0] + ox, pts[0][1] + oy);
      for (let i = 1; i < pts.length - 1; i++) {
        // through the midpoints, so the line is smooth even where the samples are sparse
        const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
        ctx.quadraticCurveTo(pts[i][0] + ox, pts[i][1] + oy, mx + ox, my + oy);
      }
      const l = pts[pts.length - 1];
      ctx.lineTo(l[0] + ox, l[1] + oy);
      ctx.stroke();
    };
    ctx.strokeStyle = 'rgba(250,240,218,0.6)'; ctx.lineWidth = 16 * w; path(-2, -3);
    ctx.strokeStyle = 'rgba(160,128,90,0.75)'; ctx.lineWidth = 9 * w; path(0, 0);
    ctx.strokeStyle = 'rgba(112,84,56,0.55)'; ctx.lineWidth = 3.5 * w; path(1, 1);
    this.dirty = true;
  }
  _redrawCurrent() {
    this.cctx.clearRect(0, 0, CW, CH);
    if (this.stroke) this._groove(this.cctx, this.stroke);
    for (const d of this.drawers) if (d.line) this._groove(this.cctx, d.line, 0.8);
    this.dirty = true;
  }
  _commit() {
    if (this.stroke && this.stroke.length > 1) this._groove(this.lctx, this.stroke);
    for (const d of this.drawers) { if (d.line && d.line.length > 1) this._groove(this.lctx, d.line, 0.8); d.line = null; }
    this.stroke = null;
    this._redrawCurrent();
  }

  /** The traveler's brush at a canvas point; down = touching the sand. */
  drawTo(p, down) {
    if (!down || !p || this.blowing) {
      if (this.stroke) { if (this.stroke.length > 1) this._groove(this.lctx, this.stroke); this.stroke = null; this._redrawCurrent(); }
      this.last = null;
      return;
    }
    const pt = [p.px, p.py];
    if (!this.stroke) this.stroke = [pt];
    else {
      const d = Math.hypot(pt[0] - this.last[0], pt[1] - this.last[1]);
      if (d < 3) return;
      this.stroke.push(pt);
      this.ink += d;
      if (this.strokes.length < 4000) this.strokes.push(p.point.clone());
      this._redrawCurrent();
    }
    this.last = pt;
  }

  /** The children begin their next pictures. */
  kidBegins() {
    for (const d of this.drawers) {
      d.n = (d.n + 1) % d.pics.length;
      d.s = 0; d.t = 0; d.line = null;
      const c = Math.cos(d.yaw), sn = Math.sin(d.yaw);
      // the picture in front of them, turned the way they face
      d.pts = d.pics[d.n].map((st) => st.map(([dx, z]) => { const dz = z - 0.42; return toPx(d.x + dx * c + dz * sn, d.z - dx * sn + dz * c); }));
    }
  }

  _kidUpdate(dt) {
    for (const d of this.drawers) {
      if (d.n < 0 || d.s >= d.pts.length) continue;
      if (d.kid.mixer && d.kid.reach < 0.6) continue; // not until their twig is down at the sand
      const st = d.pts[d.s];
      const prev = Math.floor(d.t);
      d.t += dt * 7; // points per second
      const now = Math.min(st.length - 1, Math.floor(d.t));
      if (now !== prev || !d.line) { d.line = st.slice(0, now + 1); this._redrawCurrent(); }
      if (d.t >= st.length - 1) {
        this._groove(this.lctx, st, 0.8);
        d.line = null; this._redrawCurrent();
        d.s++; d.t = 0;
      }
    }
  }

  // ---- the children's bodies
  _pose(kid, name, fade = 0.5, once = false) {
    const a = kid.acts[name];
    if (!a || kid.cur === a) return;
    a.reset();
    a.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat);
    a.clampWhenFinished = once;
    a.play();
    if (kid.cur && fade > 0) a.crossFadeFrom(kid.cur, fade, false);
    else if (kid.cur) kid.cur.stop();
    kid.cur = a;
  }

  /** Where in his pick-up the boy's hand is lowest (and which hand): the twig lies just there. */
  _prepGive(kid) {
    const a = kid.acts.Collect_Object;
    if (!a) return;
    a.play();
    const v = new THREE.Vector3();
    let best = Infinity;
    for (let t = 0.6; t < 3.6; t += 0.05) {
      kid.mixer.setTime(t);
      kid.group.updateMatrixWorld(true);
      kid.hands[1].getWorldPosition(v);
      if (v.y < best) { best = v.y; kid.pickT = t; kid.pickAt = v.clone(); }
    }
    a.stop();
    kid.mixer.setTime(0);
    if (!kid.pickAt) return;
    const p = kid.pickAt;
    this.groundTwig.position.set(p.x, valleyHeight(p.x, p.z) + 0.02, p.z);
    this.groundTwig.rotation.set(Math.PI / 2, kid.yaw0 + 1.1, 0, 'YXZ');
  }

  /** The boy gets up and turns to the traveler (at x, z), his twig in his hand. */
  give(x, z) {
    const k = this.kids[0];
    if (!k.mixer) return;
    this.giving = 0.001;
    this.giveTo = Math.atan2(x - k.group.position.x, z - k.group.position.z);
    this._pose(k, 'Talk_with_Left_Hand_on_Hip', 0.9);
  }

  /** The traveler has his twig now: he picks up the spare one and goes back to his drawing. */
  taken() {
    const k = this.kids[0];
    if (!k.mixer || this.picking) return;
    this.giving = 0;
    this.picking = 0.001;
    if (k.twig) k.twig.visible = false;
    this._pose(k, 'Collect_Object', 0.6, true);
  }

  _rotW(bone, axis, angle) {
    const pq = bone.parent.getWorldQuaternion(this._q2);
    const bw = this._q3.copy(pq).multiply(bone.quaternion);
    bw.premultiply(this._qw.setFromAxisAngle(axis, angle));
    bone.quaternion.copy(pq.invert().multiply(bw));
    bone.updateMatrixWorld(true);
  }

  /** Two-bone reach: bend the elbow to the right length, then swing the arm onto the target. */
  _ik(arm, fore, hand, T, r) {
    const S = arm.getWorldPosition(new THREE.Vector3()), E = fore.getWorldPosition(new THREE.Vector3());
    const H = hand.getWorldPosition(new THREE.Vector3());
    const a = S.distanceTo(E), b = E.distanceTo(H);
    const d = Math.min(S.distanceTo(T), (a + b) * 0.995);
    const u = S.clone().sub(E), w = H.clone().sub(E);
    const want = Math.acos(THREE.MathUtils.clamp((a * a + b * b - d * d) / (2 * a * b), -1, 1));
    const n = u.clone().cross(w);
    if (n.lengthSq() > 1e-10) this._rotW(fore, n.normalize(), (want - u.angleTo(w)) * r);
    hand.getWorldPosition(H);
    const from = H.sub(S).normalize(), to = T.clone().sub(S).normalize();
    const ax = from.clone().cross(to);
    if (ax.lengthSq() > 1e-10) this._rotW(arm, ax.normalize(), from.angleTo(to) * r);
  }

  _kidsUpdate(dt) {
    for (const k of this.kids) {
      if (!k.mixer) continue;
      const rb = k.reachBones;
      for (let i = 0; i < rb.length; i++) rb[i].quaternion.copy(k.saved[i]);
      k.mixer.update(dt);
      for (let i = 0; i < rb.length; i++) k.saved[i].copy(rb[i].quaternion);
      // while a child is drawing, they lean in and their right hand goes down to the sand, moving
      const d = k.drawer;
      const drawing = d && !this.blowing && d.n >= 0 && d.s < d.pts.length && k.cur === k.acts[k.spec.pose];
      k.reach += ((drawing ? 1 : 0) - k.reach) * (1 - Math.exp(-dt * 3));
      if (k.reach > 0.01) {
        k.group.updateMatrixWorld(true);
        k.tt = (k.tt || 0) + dt;
        const side = this._v2.set(1, 0, 0).applyQuaternion(k.group.quaternion);
        const r = k.reach;
        this._rotW(rb[0], side, REACH.lean * r);
        this._rotW(rb[1], side, REACH.lean * r);
        // the twig's tip to the end of the line they are drawing (or where the next one starts),
        // the hand up the twig from it, back toward the child
        const pt = d.line && d.line.length ? d.line[d.line.length - 1] : d.pts[d.s] && d.pts[d.s][0];
        if (pt) {
          toWorld(pt[0], pt[1], this._v2); this._v2.y -= 0.02;
          if (!k.tip) k.tip = this._v2.clone(); else k.tip.lerp(this._v2, 1 - Math.exp(-dt * 10));
        }
        if (k.tip) {
          const fwd = this._v4.set(0, 0, 1).applyQuaternion(k.group.quaternion);
          const hand = this._v3.set(0, 1, 0).addScaledVector(fwd, -REACH.back).normalize().multiplyScalar(GRIP).add(k.tip);
          this._ik(rb[2], rb[3], k.hands[1], hand, r);
        }
      }
    }
    const k = this.kids[0];
    if (this.giving && k.mixer) {
      this.giving += dt;
      k.group.rotation.y = angleTo(k.group.rotation.y, this.giveTo, Math.min(1, dt * 1.5) * ss(this.giving, 0.6, 2.0));
    }
    if (this.picking && k.mixer) {
      this.picking += dt;
      k.group.rotation.y = angleTo(k.group.rotation.y, k.yaw0, Math.min(1, dt * 2));
      if (!k.twig.visible && this.picking >= (k.pickT || 1.5)) { this.groundTwig.visible = false; k.twig.visible = true; }
      const a = k.acts.Collect_Object;
      if (a && k.cur === a && a.time > a.getClip().duration - 0.8) { this._pose(k, k.spec.pose, 0.8); this.picking = 0; }
    }
    // each child's twig: carried in the fist, or (drawing) pointed from the hand down to the line
    for (const kid of this.kids) {
      if (!kid.twig || !kid.twig.visible || !kid.hands) continue;
      const h = kid.hands[1];
      h.getWorldPosition(kid.twig.position);
      h.getWorldQuaternion(this._q).multiply(this._inHand);
      if (kid.tip && kid.reach > 0.01) {
        const dir = this._v3.copy(kid.tip).sub(kid.twig.position).normalize();
        this._q4.setFromUnitVectors(DOWN, dir);
        this._q.slerp(this._q4, kid.reach);
      }
      kid.twig.quaternion.copy(this._q);
    }
    if (k.head) { k.head.getWorldPosition(this.speaker.position); this.speaker.position.y += 0.12; }
  }

  /** The wind comes from one side (dir = [x, z] it blows toward): the lines wear away from the
   *  upwind edge first, raggedly, and the sand of each line lifts off as it goes. */
  blow(dir = [1, 0], dur = 3.2) {
    this._commit();
    this.blowing = 0.001;
    this.last = null;
    this.wind = new THREE.Vector3(dir[0], 0, dir[1]).normalize();
    const all = this.lctx.getImageData(0, 0, CW, CH).data;
    let x0 = CW, y0 = CH, x1 = -1, y1 = -1;
    for (let y = 0; y < CH; y += 2) for (let x = 0; x < CW; x += 2) {
      if (all[(y * CW + x) * 4 + 3] > 4) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) { this._ero = null; return; }
    x0 = Math.max(0, x0 - 4); y0 = Math.max(0, y0 - 4); x1 = Math.min(CW - 1, x1 + 4); y1 = Math.min(CH - 1, y1 + 4);
    const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const img = this.lctx.getImageData(x0, y0, w, h);
    // when each pixel goes: along the wind, with a ragged, lumpy front
    const et = new Float32Array(w * h);
    const dx = this.wind.x, dy = this.wind.z;
    let smin = Infinity, smax = -Infinity;
    for (const [cx, cy] of [[x0, y0], [x1, y0], [x0, y1], [x1, y1]]) { const s = cx * dx + cy * dy; smin = Math.min(smin, s); smax = Math.max(smax, s); }
    const span = Math.max(1, smax - smin);
    const r1 = Math.random() * 9, r2 = Math.random() * 9;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const px = x + x0, py = y + y0;
      const s = (px * dx + py * dy - smin) / span;
      const n = Math.sin(px * 0.021 + py * 0.013 + r1) * 0.5 + Math.sin(px * 0.006 - py * 0.017 + r2) * 0.5;
      et[y * w + x] = 0.35 + s * dur + n * 0.35 + Math.random() * 0.22;
    }
    this._ero = { x: x0, y: y0, w, h, img, et, end: 0.35 + dur + 0.9 };
  }

  /** After the wind: the sand is smooth again. */
  calm() {
    this.blowing = 0;
    this._ero = null;
    this.lctx.clearRect(0, 0, CW, CH);
    this.stroke = null; this.cctx.clearRect(0, 0, CW, CH);
    this.strokes = []; this.ink = 0;
    for (const d of this.drawers) { d.pts = []; d.s = 0; d.line = null; }
    this.dirty = true;
  }

  /** The wind has passed; the sand stays as it is now (smooth where the lines were). */
  settle() {
    this.blowing = 0;
    this._ero = null;
    this.lctx.clearRect(0, 0, CW, CH);
    this.strokes = []; this.ink = 0;
    for (const d of this.drawers) { d.pts = []; d.s = 0; d.line = null; }
    this.dirty = true;
  }

  /** A few last grains blown off the sand toward a far point (the road ahead). */
  drift(to, n = 3, near = null) {
    for (let j = 0; j < n; j++) {
      // off the sand, low; or (near someone) floating past at about their height
      const x = near ? near.x + (Math.random() - 0.3) * 2.4 : SAND.x + (Math.random() - 0.5) * SAND.w * 0.7;
      const z = near ? near.z + (Math.random() - 0.2) * 2.4 : SAND.z + (Math.random() - 0.5) * SAND.d * 0.7;
      const d = new THREE.Vector3(to.x - x, 0, to.z - z).normalize();
      const y = valleyHeight(x, z) + (near ? 0.5 + Math.random() * 1.4 : 0.04);
      const c = near && Math.random() < 0.35 ? this.dust : this.grains;
      const i = this._grain(c, x, y, z, d, 0.7 + Math.random() * 0.6, near ? 0.05 : 0.35, 4.5);
      if (near && i >= 0) { c.floor[i] = y - 1.5; c.grav[i] = 0.02; if (c === this.dust) c.a[i] *= 0.6; }
    }
  }

  _erode(dt) {
    const e = this._ero, t = this.blowing, tp = t - dt;
    if (!e) return;
    const d = e.img.data, w = e.w, f = Math.exp(-dt * 7);
    let budget = 70, dustBudget = 1;
    for (let i = 0, n = w * e.h; i < n; i++) {
      const a = d[i * 4 + 3];
      if (!a) continue;
      const et = e.et[i];
      if (t < et) continue;
      if (tp < et && a > 60) {
        // the moment this bit of line goes, some of its sand leaves with it
        if (budget > 0 && Math.random() < 0.1) {
          budget--;
          const px = (i % w) + e.x, py = ((i / w) | 0) + e.y;
          toWorld(px, py, this._v);
          const high = Math.random() < 0.25;
          this._grain(this.grains, this._v.x, this._v.y, this._v.z, this.wind, high ? 1.4 + Math.random() * 1.2 : 0.7 + Math.random() * 0.9, high ? 0.5 + Math.random() * 0.7 : 0.08 + Math.random() * 0.3, high ? 2.8 : 1.6 + Math.random());
        }
        if (dustBudget > 0 && Math.random() < 0.003) {
          dustBudget--;
          const px = (i % w) + e.x, py = ((i / w) | 0) + e.y;
          toWorld(px, py, this._v);
          this._grain(this.dust, this._v.x, this._v.y + 0.05, this._v.z, this.wind, 0.6 + Math.random() * 0.5, 0.12 + Math.random() * 0.15, 2.4);
        }
      }
      const na = a * f;
      d[i * 4 + 3] = na < 8 ? 0 : na;
    }
    this.lctx.putImageData(e.img, e.x, e.y);
    this.dirty = true;
    if (t > e.end) { this.lctx.clearRect(0, 0, CW, CH); this._ero = null; }
  }

  _grain(c, x, y, z, dir, speed, up, life) {
    const L = c.life;
    const i = L.indexOf(-1);
    if (i < 0) return -1;
    L[i] = 0; c.max[i] = life;
    c.pos[i * 3] = x; c.pos[i * 3 + 1] = y + 0.005; c.pos[i * 3 + 2] = z;
    const side = (Math.random() - 0.5) * 0.5;
    c.vel[i * 3] = (dir.x - dir.z * side) * speed;
    c.vel[i * 3 + 1] = up;
    c.vel[i * 3 + 2] = (dir.z + dir.x * side) * speed;
    c.floor[i] = y;
    c.grav[i] = up > 0.45 ? 0.25 + Math.random() * 0.3 : 1.4 + Math.random() * 1.2;
    // sand, a little lighter or darker grain by grain
    // (linear colour: grains a shade darker than the sand so they read against it; dust the sand's own tone)
    const dust = c === this.dust, v = dust ? 0.46 + Math.random() * 0.08 : 0.24 + Math.random() * 0.14;
    c.col[i * 4] = v; c.col[i * 4 + 1] = v * 0.8; c.col[i * 4 + 2] = v * 0.56; c.col[i * 4 + 3] = 0;
    c.a[i] = dust ? 0.35 + Math.random() * 0.25 : 0.6 + Math.random() * 0.4;
    return i;
  }

  _cloudUpdate(c, dt, push) {
    let alive = false;
    for (let i = 0; i < c.n; i++) {
      if (c.life[i] < 0) continue;
      alive = true;
      const l = (c.life[i] += dt);
      if (l > c.max[i]) { c.life[i] = -1; c.pos[i * 3 + 1] = -999; c.col[i * 4 + 3] = 0; continue; }
      const k = i * 3;
      c.vel[k + 1] -= c.grav[i] * dt;
      // the wind keeps pushing, with a little flutter
      c.vel[k] += this.wind.x * push * dt + Math.sin(l * 7 + i) * 0.4 * dt;
      c.vel[k + 2] += this.wind.z * push * dt + Math.cos(l * 6 + i) * 0.4 * dt;
      c.pos[k] += c.vel[k] * dt; c.pos[k + 1] += c.vel[k + 1] * dt; c.pos[k + 2] += c.vel[k + 2] * dt;
      if (c.pos[k + 1] < c.floor[i]) { c.pos[k + 1] = c.floor[i]; c.vel[k + 1] = Math.abs(c.vel[k + 1]) * 0.35; c.vel[k] *= 0.85; c.vel[k + 2] *= 0.85; }
      const fin = Math.min(1, l / 0.12), fout = Math.min(1, (c.max[i] - l) / (c.max[i] * 0.45));
      c.col[i * 4 + 3] = c.a[i] * fin * fout;
    }
    if (alive) { c.points.geometry.attributes.position.needsUpdate = true; c.points.geometry.attributes.color.needsUpdate = true; }
  }

  update(dt) {
    this._kidsUpdate(dt);
    if (!this.blowing) this._kidUpdate(dt);
    if (this.blowing) {
      this.blowing += dt;
      this._erode(dt);
    }
    if (!this.wind) this.wind = new THREE.Vector3(1, 0, 0);
    this._cloudUpdate(this.grains, dt, 1.2);
    this._cloudUpdate(this.dust, dt, 0.5);
    if (this.dirty) {
      this.vctx.clearRect(0, 0, CW, CH);
      this.vctx.drawImage(this.base, 0, 0);
      this.vctx.globalCompositeOperation = 'source-atop';
      this.vctx.drawImage(this.layer, 0, 0);
      this.vctx.drawImage(this.cur, 0, 0);
      this.vctx.globalCompositeOperation = 'source-over';
      this.tex.needsUpdate = true;
      this.dirty = false;
    }
  }
}
