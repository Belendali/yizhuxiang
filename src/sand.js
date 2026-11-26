import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { valleyHeight, SAND_AT } from './valley.js';
import { propModel } from './models.js';

// 第一章 · 沙上画: a little further down the path from 阿念's tree, a patch of pale sand beside
// the path where a child sits drawing. The traveler is handed a brush and draws whatever they
// like; when they say it is done, the wind lifts the sand and carries the drawing off.

export const SAND = { x: SAND_AT.x, z: SAND_AT.z, w: 4.6, d: 3.4 };
// where the traveler kneels to draw (the near edge, facing up the valley) and where the child sits
export const SAND_SPOT = { x: SAND.x - 0.35, z: SAND.z + SAND.d / 2 + 0.45 };
export const KID_SPOT = { x: SAND.x + 1.15, z: SAND.z - SAND.d / 2 - 0.3 };

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

    // ---- sand lifted by the wind
    const N = 1400;
    const pg = new THREE.BufferGeometry();
    this.pPos = new Float32Array(N * 3);
    this.pVel = new Float32Array(N * 3);
    this.pLife = new Float32Array(N).fill(-1);
    pg.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    const dot = document.createElement('canvas'); dot.width = dot.height = 32;
    const dc = dot.getContext('2d'), gr = dc.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    dc.fillStyle = gr; dc.fillRect(0, 0, 32, 32);
    this.pMat = new THREE.PointsMaterial({ color: 0xe9d8b6, size: 0.05, map: new THREE.CanvasTexture(dot), transparent: true, depthWrite: false, opacity: 0.9 });
    this.points = new THREE.Points(pg, this.pMat);
    this.points.frustumCulled = false;
    this.group.add(this.points);

    // ---- the brush (bamboo handle, dark hair tip), shown only while the traveler draws
    this.brush = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.26, 8), new THREE.MeshStandardMaterial({ color: 0xa88a55, roughness: 0.6 }));
    handle.position.y = 0.17;
    const ferrule = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.011, 0.03, 8), new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.5 }));
    ferrule.position.y = 0.045;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.011, 0.045, 10), new THREE.MeshStandardMaterial({ color: 0x1d1812, roughness: 0.9 }));
    tip.rotation.x = Math.PI; tip.position.y = 0.0;
    this.brush.add(handle, ferrule, tip);
    for (const m of this.brush.children) m.position.y += 0.022;
    this.brush.visible = false;
    this.group.add(this.brush);

    // ---- the child (a stand-in made from 阿念's model, in other colours, until their own model)
    this.kid = new THREE.Group();
    this.kid.position.set(KID_SPOT.x, valleyHeight(KID_SPOT.x, KID_SPOT.z), KID_SPOT.z);
    this.kid.rotation.y = Math.PI; // facing +Z, toward the sand and the traveler
    this.group.add(this.kid);
    this.kidSeat = new THREE.Group();
    this.kidSeat.position.copy(this.kid.position).add(new THREE.Vector3(0, -0.03, -0.12));
    this.group.add(this.kidSeat);
    this._seatModel = propModel('rocks', { width: 0.6, anchor: 'bottom' }).then((m) => { this.kidSeat.add(m); return m; }).catch(() => null);
    this.colliders = [{ x: KID_SPOT.x, z: KID_SPOT.z, r: 0.45 }];
    this.mixer = null;
    new GLTFLoader().load(`./assets/models/anian.glb?v=${window.__V || ''}`, (gltf) => {
      const m = gltf.scene;
      this.mixer = new THREE.AnimationMixer(m);
      const sit = gltf.animations.find((c) => c.name === 'Chair_Sit_Idle_F');
      if (sit) this.mixer.clipAction(sit).play();
      this.mixer.update(0);
      m.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(m, true);
      const s = 0.98 / (box.max.y - box.min.y);
      m.scale.setScalar(s);
      m.position.y = -box.min.y * s - 0.05;
      m.position.z = -0.25 * s;
      m.rotation.y = Math.PI;
      m.traverse((o) => {
        if (!o.isMesh) return;
        o.castShadow = true; o.frustumCulled = false;
        o.material = o.material.clone();
        o.material.color.setHex(0x9fc0c4); // a blue-green cotton instead of her pink
      });
      this.kid.add(m);
      // a low pile of stones right under the child's hips, as for 阿念
      this.kid.updateMatrixWorld(true);
      const hips = m.getObjectByName('mixamorigHips');
      this._seatModel.then((rock) => {
        if (!hips || !rock) return;
        const h = hips.getWorldPosition(new THREE.Vector3());
        const gy = valleyHeight(h.x, h.z);
        this.kidSeat.position.set(h.x, gy - 0.03, h.z);
        const rh = new THREE.Box3().setFromObject(rock).getSize(new THREE.Vector3()).y / this.kidSeat.scale.y || 0.25;
        this.kidSeat.scale.y = Math.max(0.5, (h.y - gy - 0.06) / rh);
      });
    });

    // drawing state
    this.strokes = [];      // traveler's points in world space (for the wind to lift)
    this.ink = 0;           // how much the traveler has drawn, in canvas px
    this.last = null;       // last canvas point of the current stroke
    this.stroke = null;     // the traveler's stroke in progress (canvas points)
    this.kidLine = null;    // the child's stroke in progress
    this.kidPic = -1; this.kidStroke = 0; this.kidT = 0; this.kidPts = [];
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
    if (this.kidLine) this._groove(this.cctx, this.kidLine, 0.8);
    this.dirty = true;
  }
  _commit() {
    if (this.stroke && this.stroke.length > 1) this._groove(this.lctx, this.stroke);
    if (this.kidLine && this.kidLine.length > 1) this._groove(this.lctx, this.kidLine, 0.8);
    this.stroke = null; this.kidLine = null;
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

  /** The child begins the next picture. */
  kidBegins() {
    this.kidPic = (this.kidPic + 1) % KID_PICS.length;
    this.kidStroke = 0; this.kidT = 0;
    this.kidPts = KID_PICS[this.kidPic].map((s) => s.map(([dx, dz]) => toPx(KID_SPOT.x + dx, KID_SPOT.z + dz)));
  }

  _kidUpdate(dt) {
    if (this.kidPic < 0 || this.kidStroke >= this.kidPts.length) return;
    const st = this.kidPts[this.kidStroke];
    const prev = Math.floor(this.kidT);
    this.kidT += dt * 7; // points per second
    const now = Math.min(st.length - 1, Math.floor(this.kidT));
    if (now !== prev || !this.kidLine) { this.kidLine = st.slice(0, now + 1); this._redrawCurrent(); }
    if (this.kidT >= st.length - 1) {
      this._groove(this.lctx, st, 0.8);
      this.kidLine = null; this._redrawCurrent();
      this.kidStroke++; this.kidT = 0;
    }
  }

  /** The wind comes: the grooves smear away downwind and the sand lifts off them. */
  blow() {
    this._commit();
    this.blowing = 0.001;
    this.last = null;
    // the child's lines go too
    const pts = this.strokes.length ? this.strokes : [];
    for (const st of this.kidPts) for (const [px, py] of st) pts.push(toWorld(px, py, new THREE.Vector3()));
    this._lift = pts;
  }

  /** After the wind: the sand is smooth again. */
  calm() {
    this.blowing = 0;
    this.lctx.clearRect(0, 0, CW, CH);
    this.stroke = null; this.kidLine = null; this.cctx.clearRect(0, 0, CW, CH);
    this.strokes = []; this.ink = 0; this.kidPts = []; this.kidStroke = 0;
    this.dirty = true;
  }

  update(dt) {
    if (this.mixer) this.mixer.update(dt);
    if (!this.blowing) this._kidUpdate(dt);
    if (this.blowing) {
      this.blowing += dt;
      const t = this.blowing;
      // smear the grooves downwind (+x on the canvas), fading as they go
      const sc = this.scratch.getContext('2d');
      sc.clearRect(0, 0, CW, CH);
      sc.drawImage(this.layer, 0, 0);
      const l = this.lctx;
      l.clearRect(0, 0, CW, CH);
      // it starts as a stir at the edges of the lines and grows into a steady blow over ~3 s
      const k = THREE.MathUtils.smoothstep(t, 0, 1.2);
      l.globalAlpha = Math.exp(-dt * (0.15 + 1.05 * k));
      l.drawImage(this.scratch, (20 + 130 * k) * dt, -8 * k * dt, CW * (1 + 0.05 * k * dt), CH);
      l.globalAlpha = 0.18 * k;
      l.drawImage(this.scratch, (70 + 260 * k) * dt, -20 * k * dt);
      l.globalAlpha = 1;
      this.dirty = true;
      // sand grains off the lines
      if (this._lift && this._lift.length && t < 4) {
        const n = Math.round(dt * 600 * THREE.MathUtils.smoothstep(t, 0, 0.8) * (1 - t / 4));
        for (let j = 0; j < n; j++) this._spawn(this._lift[(Math.random() * this._lift.length) | 0]);
      }
    }
    // grains
    let alive = false;
    for (let i = 0; i < this.pLife.length; i++) {
      if (this.pLife[i] < 0) { this.pPos[i * 3 + 1] = -999; continue; }
      alive = true;
      this.pLife[i] += dt;
      const v = this.pVel;
      v[i * 3] += dt * 1.6; v[i * 3 + 1] -= dt * 0.25;
      this.pPos[i * 3] += v[i * 3] * dt; this.pPos[i * 3 + 1] += v[i * 3 + 1] * dt; this.pPos[i * 3 + 2] += v[i * 3 + 2] * dt;
      if (this.pLife[i] > 2.6) this.pLife[i] = -1;
    }
    if (alive || this.blowing) this.points.geometry.attributes.position.needsUpdate = true;
    this.pMat.opacity = this.blowing ? 0.85 * (1 - THREE.MathUtils.smoothstep(this.blowing, 4, 6.5)) : 0.85;
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

  _spawn(p) {
    const L = this.pLife;
    let i = L.indexOf(-1);
    if (i < 0) return;
    L[i] = 0;
    this.pPos[i * 3] = p.x + (Math.random() - 0.5) * 0.05;
    this.pPos[i * 3 + 1] = p.y + 0.01;
    this.pPos[i * 3 + 2] = p.z + (Math.random() - 0.5) * 0.05;
    this.pVel[i * 3] = 0.6 + Math.random() * 1.2;
    this.pVel[i * 3 + 1] = 0.25 + Math.random() * 0.55;
    this.pVel[i * 3 + 2] = (Math.random() - 0.6) * 0.5;
  }
}
