import * as THREE from 'three';
import { propModel, materialsOf } from './models.js';

// 修庙: four things the temple has lost lie in the snow around it. They lie dark until the
// Buddha asks for them (activate); then each glows faintly until the traveler picks it up; picked-up things drift along at the traveler's shoulder
// and, once the traveler is back on the temple platform, fly home one by one.

const ss = THREE.MathUtils.smoothstep;
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,236,200,1)');
  grd.addColorStop(0.25, 'rgba(255,190,120,0.55)');
  grd.addColorStop(1, 'rgba(255,170,90,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A bronze singing bowl (颂钵): turned stand-in, replaced by the sculpted bowl once it loads. */
function singingBowl() {
  const g = new THREE.Group();
  const bronze = new THREE.MeshStandardMaterial({ color: 0x9a7440, metalness: 0.85, roughness: 0.38 });
  const prof = [[0, 0], [0.07, 0], [0.12, 0.03], [0.145, 0.08], [0.14, 0.1], [0.125, 0.05], [0, 0.025]].map(([x, y]) => new THREE.Vector2(x, y));
  const turned = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), bronze);
  turned.castShadow = true;
  g.add(turned);
  propModel('singing-bowl', { width: 0.3, anchor: 'bottom' }).then((m) => {
    // less mirror-like, so its outside reads as bronze in the snow light instead of black
    for (const mt of materialsOf(m)) { mt.metalness = 0.5; mt.roughness = 0.42; }
    g.add(m);
    turned.visible = false;
  }).catch(() => {});
  return g;
}

export class RepairQuest {
  /**
   * @param outside  the exterior api (scene, parts, lanternsOn)
   * @param ground   (x, z) => height of the walkable surface
   * @param sound    the Sound instance
   * @param spots    { plaque, lantern, bell, bowl }: [x, z, yaw] where each lies
   * @param door     THREE.Vector3, where the singing bowl goes (into the hall)
   */
  constructor({ outside, ground, sound, spots, door }) {
    this.outside = outside;
    this.sound = sound;
    this.items = [];
    this.flights = [];
    this.lanternWant = 0;
    this.onPlaced = null;   // (id) => {}
    this.onAllHome = null;  // () => {}
    const scene = outside.scene;
    const tex = glowTexture();

    const add = (id, obj, scale, lieEuler, lift) => {
      const [x, z, yaw] = spots[id];
      const home = { pos: obj.position.clone(), quat: obj.quaternion.clone(), scale: obj.scale.x, parent: obj.parent };
      const lie = {
        pos: new THREE.Vector3(x, ground(x, z) + lift, z),
        quat: new THREE.Quaternion().setFromEuler(new THREE.Euler(lieEuler[0], yaw, lieEuler[2], 'YXZ')),
        scale,
      };
      // the object is moved to the scene root while it is away from home
      if (obj.parent !== scene) scene.attach(obj);
      obj.position.copy(lie.pos);
      obj.quaternion.copy(lie.quat);
      obj.scale.setScalar(lie.scale);
      obj.userData.loose = true;
      obj.visible = true;
      // a soft light and a few rising motes, so it can be found in the storm
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffb35c, blending: THREE.NormalBlending, depthWrite: false, transparent: true, fog: false }));
      glow.scale.setScalar(1.5);
      glow.position.copy(lie.pos).y += 0.15;
      scene.add(glow);
      // a warm pool of light on the snow under it, like the stone lanterns cast
      const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: tex, color: 0xffa54a, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      pool.rotation.x = -Math.PI / 2;
      pool.position.set(x, ground(x, z) + 0.03, z);
      scene.add(pool);
      const N = 22;
      const mg = new THREE.BufferGeometry();
      mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      const motes = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xf29a3c, size: 0.1, transparent: true, opacity: 0.9, depthWrite: false }));
      motes.position.copy(lie.pos);
      motes.frustumCulled = false;
      scene.add(motes);
      const seeds = Array.from({ length: N }, (_, i) => [Math.random() * 6.28, 0.1 + Math.random() * 0.35, i / N]);
      glow.visible = pool.visible = motes.visible = false; // dark until the Buddha asks
      const item = { id, obj, home, lie, glow, pool, motes, seeds, state: 'lying', carry: new THREE.Vector3().copy(lie.pos), slot: 0, carriedScale: scale * 0.6 };
      this.items.push(item);
      return item;
    };

    const P = outside.parts;
    // the name plaque, fallen face up
    add('plaque', P.plaque, 1, [-Math.PI / 2 + 0.12, 0, 0.08], 0.05);
    // the left paper lantern, rolled onto its side
    add('lantern', P.lanterns[0], 1, [0, 0, Math.PI / 2 - 0.1], 0.22);
    // the bronze chime from the front-left corner (small, so shown a little larger while away)
    add('bell', P.chimes[0], 1.7, [0, 0, Math.PI / 2 - 0.2], 0.2);
    // the singing bowl from the hall's cushion; it goes in through the door and waits there
    const bowl = singingBowl();
    bowl.position.copy(door);
    scene.add(bowl);
    const bw = add('bowl', bowl, 1.4, [0.12, 0, 0.1], 0.02);
    bw.home.scale = 0.001; // not seen again outside: it is back on its cushion in the hall
    bw.home.pos.copy(door);

    outside.lanternsOn = 0;
    this.active = false;
    this.t = 0;
    this._q = new THREE.Quaternion();
    this._e = new THREE.Euler();
  }

  /** The Buddha has asked: the lost things begin to glow and can be picked up. */
  activate() {
    this.active = true;
    for (const it of this.items) if (it.state === 'lying') it.glow.visible = it.pool.visible = it.motes.visible = true;
  }

  get carried() { return this.items.filter((it) => it.state === 'carried'); }
  get done() { return this.items.every((it) => it.state === 'home'); }
  get found() { return this.items.filter((it) => it.state !== 'lying').length; }

  /** The lying item within reach of (x, z), or null. */
  nearest(x, z, reach = 1.5) {
    if (!this.active) return null;
    let best = null, bd = reach;
    for (const it of this.items) {
      if (it.state !== 'lying') continue;
      const d = Math.hypot(it.lie.pos.x - x, it.lie.pos.z - z);
      if (d < bd) { bd = d; best = it; }
    }
    return best;
  }

  pick(it) {
    it.state = 'carried';
    it.slot = this.carried.length - 1;
    it.carry.copy(it.obj.position);
    this.sound.bowl(880, 0.08);
  }

  /** Send everything carried home, one after another. */
  deliver() {
    const list = this.carried;
    list.forEach((it, i) => {
      it.state = 'flying';
      this.flights.push({ it, t: -i * 0.8, from: it.obj.position.clone(), fromQ: it.obj.quaternion.clone(), fromS: it.obj.scale.x });
    });
  }

  /** Put everything home at once (debug). */
  completeAll() {
    this.active = true;
    for (const it of this.items) if (it.state !== 'home') this._home(it);
    this.flights.length = 0;
  }

  _home(it) {
    it.state = 'home';
    const { obj, home } = it;
    if (home.parent && home.parent !== obj.parent) home.parent.attach(obj);
    obj.position.copy(home.pos);
    obj.quaternion.copy(home.quat);
    obj.scale.setScalar(home.scale);
    obj.userData.loose = false;
    if (it.id === 'bowl') obj.visible = false;
    if (it.id === 'lantern') this.lanternWant = 1;
    it.glow.visible = false;
    it.motes.visible = false;
    it.pool.visible = false;
    if (it.id === 'bell') { this.sound.bowl(1320, 0.1); setTimeout(() => this.sound.bowl(1568, 0.07), 380); }
    else if (it.id === 'lantern') this.sound.bowl(523, 0.1);
    else if (it.id === 'bowl') { this.sound.bowl(440, 0.16); setTimeout(() => this.sound.bowl(880, 0.05), 60); }
    else this.sound.bowl(392, 0.12);
    if (this.onPlaced) this.onPlaced(it.id);
    if (this.done && this.onAllHome) this.onAllHome();
  }

  update(dt, traveler) {
    this.t += dt;
    const t = this.t;
    this.outside.lanternsOn = damp(this.outside.lanternsOn, this.lanternWant, 1.2, dt);
    let ci = 0;
    const n = this.carried.length;
    for (const it of this.items) {
      const { obj, glow, motes } = it;
      if (it.state === 'lying' && this.active) {
        const pulse = 0.7 + Math.sin(t * 1.8 + it.lie.pos.x) * 0.3;
        glow.material.opacity = 0.3 + pulse * 0.3;
        glow.scale.setScalar(1.3 + pulse * 0.4);
        it.pool.material.opacity = 0.32 + pulse * 0.22;
        // motes drift up from the object and fade
        const arr = motes.geometry.attributes.position.array;
        it.seeds.forEach(([a, r, o], i) => {
          const k = (t * 0.25 + o) % 1;
          arr[i * 3] = Math.cos(a + k * 2) * r * (1 - k * 0.5);
          arr[i * 3 + 1] = 0.05 + k * 2.6;
          arr[i * 3 + 2] = Math.sin(a + k * 2) * r * (1 - k * 0.5);
        });
        motes.geometry.attributes.position.needsUpdate = true;
      }
      if (it.state === 'carried') {
        // things carried float at the shoulder in a small arc, turning slowly
        const side = n === 1 ? 0.55 : -0.6 + (ci / (n - 1)) * 1.2;
        const a = traveler.yaw + Math.PI + side;
        it.carry.set(traveler.x + Math.sin(a) * 0.75, traveler.y + 1.45 + Math.sin(t * 1.6 + ci) * 0.06, traveler.z + Math.cos(a) * 0.75);
        obj.position.lerp(it.carry, 1 - Math.exp(-dt * 4));
        obj.scale.setScalar(damp(obj.scale.x, it.carriedScale, 3, dt));
        // carried upright, turning slowly
        it.spin = (it.spin || 0) + dt * 0.6;
        this._q.setFromEuler(this._e.set(0, it.spin, 0));
        obj.quaternion.slerp(this._q, 1 - Math.exp(-dt * 3));
        glow.position.copy(obj.position);
        glow.material.opacity = 0.45;
        glow.scale.setScalar(0.9);
        motes.visible = false;
        it.pool.visible = false;
        ci++;
      }
    }
    // flights home: an arc up and over, easing into place
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      f.t += dt;
      if (f.t < 0) continue;
      const it = f.it;
      const homeW = it.home.parent ? it.home.parent.localToWorld(it.home.pos.clone()) : it.home.pos;
      const k = ss(f.t / 1.8, 0, 1);
      it.obj.position.lerpVectors(f.from, homeW, k);
      it.obj.position.y += Math.sin(Math.PI * k) * 1.2;
      it.obj.quaternion.slerpQuaternions(f.fromQ, it.home.quat, k);
      it.obj.scale.setScalar(THREE.MathUtils.lerp(f.fromS, it.home.scale, k));
      it.glow.position.copy(it.obj.position);
      it.glow.material.opacity = 0.6 * (1 - k);
      if (f.t >= 1.8) { this.flights.splice(i, 1); this._home(it); }
    }
  }
}
