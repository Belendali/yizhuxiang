import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/addons/utils/SkeletonUtils.js';
import { Traveler } from './traveler.js';

// The player character: a rigged glTF with Mixamo clips (in place, no root motion).
//
// Motion is kept to what reads naturally:
//  1. Locomotion blend: idle <-> walk <-> run, weighted by the actual ground speed.
//     Walk and run share one phase so the feet never fight, and the cycle rate follows
//     the speed (stride length x cadence), so the feet do not slide.
//  2. Idle variation: after standing a while, a look-around plays and blends back.
//  3. One procedural layer: a small forward lean (`lean` 0..1), used for the tired
//     trudge through the snow.
//  4. Per-clip ground offsets so every clip keeps the feet on the floor, and `feet`
//     reports where each foot is and how high it is lifted, so the game can keep both
//     feet on top of uneven ground such as stairs.

const CLIPS = {
  idle: 'Idle_4',
  look: 'Short_Breathe_and_Look_Around',
  walk: 'Walking',
  run: 'Running',
};
const ss = THREE.MathUtils.smoothstep;
const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));

/** Measure a clip once: ground offset, natural speed, left/right heel-strike phases. */
function analyse(scene, clip) {
  const mixer = new THREE.AnimationMixer(scene);
  const action = mixer.clipAction(clip);
  action.play();
  const lf = scene.getObjectByName('mixamorigLeftFoot');
  const rf = scene.getObjectByName('mixamorigRightFoot');
  const lt = scene.getObjectByName('mixamorigLeftToeBase');
  const rt = scene.getObjectByName('mixamorigRightToeBase');
  const N = 72, D = clip.duration;
  const v = new THREE.Vector3();
  let minY = Infinity, lMaxZ = -Infinity, rMaxZ = -Infinity, lPh = 0, rPh = 0;
  const lz = [], rz = [], ly = [], ry = [];
  for (let i = 0; i < N; i++) {
    mixer.setTime((D * i) / N);
    scene.updateMatrixWorld(true);
    for (const b of [lf, rf, lt, rt]) minY = Math.min(minY, b.getWorldPosition(v).y);
    const l = lf.getWorldPosition(new THREE.Vector3()), r = rf.getWorldPosition(new THREE.Vector3());
    lz.push(l.z); rz.push(r.z);
    ly.push(lt.getWorldPosition(v).y); ry.push(rt.getWorldPosition(v).y);
    if (l.z > lMaxZ) { lMaxZ = l.z; lPh = i / N; }
    if (r.z > rMaxZ) { rMaxZ = r.z; rPh = i / N; }
  }
  // in-place speed: how fast a foot slides backward while it is on the ground
  // (stance frames only; a run's flight phase would understate it)
  const floor = Math.min(...ly, ...ry);
  const vz = [];
  for (let i = 1; i < N; i++) {
    for (const [z, y] of [[lz, ly], [rz, ry]]) {
      if (y[i] < floor + 0.025 && y[i - 1] < floor + 0.025) vz.push(-(z[i] - z[i - 1]) / (D / N));
    }
  }
  if (!vz.length) vz.push(0);
  vz.sort((a, b) => a - b);
  action.stop();
  mixer.uncacheRoot(scene);
  return { minY, speed: Math.max(0, vz[vz.length >> 1]), lPh, rPh };
}

class Actor {
  constructor(gltf, info) {
    this.group = new THREE.Group();
    this.model = cloneSkinned(gltf.scene);
    this.model.rotation.y = Math.PI; // Mixamo faces +Z; the game's yaw 0 faces -Z
    this.group.add(this.model);
    this.model.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
        o.frustumCulled = false; // skinned bounds don't follow the animation
        o.material.envMapIntensity = 0.7;
      }
    });
    const bone = (n) => this.model.getObjectByName('mixamorig' + n);
    this.b = {
      spine: [bone('Spine'), bone('Spine1'), bone('Spine2')],
      head: bone('Head'),
      lFoot: bone('LeftFoot'), lToe: bone('LeftToeBase'),
      rFoot: bone('RightFoot'), rToe: bone('RightToeBase'),
    };

    // bones the lean writes to (restored to the animated pose every frame)
    this._touched = [...this.b.spine];
    this._saved = this._touched.map((bn) => bn.quaternion.clone());

    this.mixer = new THREE.AnimationMixer(this.model);
    this.info = info;
    this.act = {};
    for (const [key, name] of Object.entries(CLIPS)) {
      const clip = gltf.animations.find((c) => c.name === name);
      if (!clip) continue;
      const a = this.mixer.clipAction(clip);
      a.enabled = true;
      a.setEffectiveWeight(0);
      a.play();
      this.act[key] = a;
    }
    // walk and run are driven by a shared phase, not by the mixer clock
    for (const k of ['walk', 'run']) if (this.act[k]) this.act[k].timeScale = 0;
    if (this.act.look) { this.act.look.setLoop(THREE.LoopOnce); this.act.look.clampWhenFinished = true; }

    this.lean = 0;           // 0..1 forward lean (tired trudge)
    this.speed = 0;
    this.phase = 0;
    this.still = 0;          // seconds standing still
    this.lookW = 0; this.lookOn = false;
    this.leanW = 0;
    this.steps = [];
    this.lastPos = null;
    this.staff = new THREE.Group(); // compatibility; this traveler carries no staff
    // world x/z of each foot and how high it is lifted off the floor it stands on
    this.feet = [{ x: 0, z: 0, h: 0 }, { x: 0, z: 0, h: 0 }];

    this._v = new THREE.Vector3();
    this._q = new THREE.Quaternion(); this._q2 = new THREE.Quaternion(); this._q3 = new THREE.Quaternion();
    this._qw = new THREE.Quaternion();
  }

  /**
   * Advance the animation. The ground speed is measured from how the group moved,
   * so scripted moves (stepping onto the cushion, walking through the door) animate too.
   */
  update(dt) {
    if (dt <= 0) return;
    const pos = this.group.position;
    let measured = 0;
    if (this.lastPos) {
      const d = Math.hypot(pos.x - this.lastPos.x, pos.z - this.lastPos.z);
      measured = d > 1.0 ? 0 : d / dt; // ignore teleports
    } else this.lastPos = new THREE.Vector3();
    this.lastPos.copy(pos);
    this.speed = damp(this.speed, measured, 10, dt);
    const s = this.speed;
    const { walk, run, idle, look } = this.act;
    const W = this.info.walk, R = this.info.run;

    // ---- locomotion weights
    const moving = ss(s, 0.06, 0.55);
    // walk below ~2 m/s, full run from ~3.6 m/s (the game's walk is 1.7, its run 4.1)
    const runMix = ss(s, 2.0, 3.6);
    // ---- shared phase: cycle length in metres blends from walk to run
    const cycle = THREE.MathUtils.lerp(W.speed * walk.getClip().duration, R.speed * run.getClip().duration, runMix);
    const prev = this.phase;
    this.phase = (this.phase + (Math.max(s, 0.45 * moving) * dt) / cycle) % 1;
    walk.time = ((this.phase + W.lPh) % 1) * walk.getClip().duration;
    run.time = ((this.phase + R.lPh) % 1) * run.getClip().duration;
    // footfalls: left heel at phase 0, right heel at the walk's right-strike offset
    const rOff = (W.rPh - W.lPh + 1) % 1;
    if (moving > 0.4) {
      if (this.phase < prev) this.steps.push('L');
      if (prev < rOff && this.phase >= rOff) this.steps.push('R');
    }

    // ---- idle variation: look around after standing a while
    this.still = moving < 0.05 ? this.still + dt : 0;
    if (look && !this.lookOn && this.still > 9) {
      this.lookOn = true; look.reset(); look.play(); this.still = 0;
    }
    if (this.lookOn && (moving > 0.05 || look.time > look.getClip().duration - 1.0)) this.lookOn = false;
    this.lookW = damp(this.lookW, this.lookOn ? 1 : 0, 2.2, dt);

    const wIdle = 1 - moving;
    idle.setEffectiveWeight(wIdle * (1 - this.lookW));
    if (look) look.setEffectiveWeight(wIdle * this.lookW);
    walk.setEffectiveWeight(moving * (1 - runMix));
    run.setEffectiveWeight(moving * runMix);

    // The mixer only rewrites a bone when its animated value changes, so undo last
    // frame's lean first; otherwise it would pile up frame after frame.
    const touched = this._touched;
    for (let i = 0; i < touched.length; i++) touched[i].quaternion.copy(this._saved[i]);
    this.mixer.update(dt);
    for (let i = 0; i < touched.length; i++) this._saved[i].copy(touched[i].quaternion);

    // ---- keep feet on the floor: blend each clip's measured offset by its weight
    const g = this.info.ground;
    let y = 0;
    for (const [k, a] of Object.entries(this.act)) y += (g[k] || 0) * a.getEffectiveWeight();
    this.model.position.y = y;
    this.model.updateMatrixWorld(true);

    // ---- tired lean
    this.leanW = damp(this.leanW, this.lean, 3, dt);
    if (this.leanW > 0.001) this._lean(this.leanW * 0.5);

    // ---- feet: position and lift above the floor
    const base = pos.y + this.info.footFloor;
    const v = this._v;
    const sides = [[this.b.lFoot, this.b.lToe], [this.b.rFoot, this.b.rToe]];
    for (let i = 0; i < 2; i++) {
      const [f, t] = sides[i];
      t.getWorldPosition(v);
      const toeY = v.y, tx = v.x, tz = v.z;
      f.getWorldPosition(v);
      const ft = this.feet[i];
      // the ball of the foot, halfway between ankle and toe, is what lands on a tread
      ft.x = (v.x + tx) / 2; ft.z = (v.z + tz) / 2;
      ft.h = Math.max(0, Math.min(v.y, toeY) - base);
    }
  }

  consumeStep() { return this.steps.shift() || null; }

  /** Rotate a bone by a world-space rotation `qw`. */
  _rotateWorld(bone, qw) {
    const parentQ = bone.parent.getWorldQuaternion(this._q2);
    const boneW = this._q3.copy(parentQ).multiply(bone.quaternion);
    boneW.premultiply(qw);
    bone.quaternion.copy(parentQ.invert().multiply(boneW));
    bone.updateMatrixWorld(true);
  }

  _lean(angle) {
    // forward bend about the body's right axis, spread over the spine
    const right = this._v.set(1, 0, 0).applyQuaternion(this.group.getWorldQuaternion(this._q));
    const qw = this._qw.setFromAxisAngle(right, -angle / this.b.spine.length);
    for (const sp of this.b.spine) this._rotateWorld(sp, qw);
  }
}

/** Fallback when the model cannot load: the procedural traveler behind the same API. */
class ProceduralActor {
  constructor(opts) {
    this.t = new Traveler(opts);
    this.group = this.t.group;
    this.staff = this.t.staff;
    this.feet = null; // no foot data; the game falls back to the ground under the body
    this.lastPos = null; this.speed = 0;
  }
  get lean() { return this.t.bow; }
  set lean(v) { this.t.bow = v * 0.5; }
  update(dt) {
    const p = this.group.position;
    let m = 0;
    if (this.lastPos) { const d = Math.hypot(p.x - this.lastPos.x, p.z - this.lastPos.z); m = d > 1 ? 0 : d / Math.max(dt, 1e-4); }
    else this.lastPos = new THREE.Vector3();
    this.lastPos.copy(p);
    this.speed += (m - this.speed) * Math.min(1, dt * 10);
    this.t.update(dt, Math.min(1, this.speed / 1.5));
  }
  consumeStep() { return this.t.consumeStep(); }
}

/** Load the character once and return `count` independent actors (or procedural fallbacks). */
export async function createActors(url, count, fallbackOpts = []) {
  try {
    const gltf = await new GLTFLoader().loadAsync(url);
    const probe = cloneSkinned(gltf.scene);
    const info = { ground: {} };
    let idleMin = 0;
    for (const [key, name] of Object.entries(CLIPS)) {
      const clip = gltf.animations.find((c) => c.name === name);
      if (!clip) continue;
      info[key] = analyse(probe, clip);
      if (key === 'idle') idleMin = info[key].minY;
    }
    for (const key of Object.keys(CLIPS)) if (info[key]) info.ground[key] = idleMin - info[key].minY;
    info.footFloor = idleMin; // height of the lowest foot bone when standing on the floor
    if (!info.idle || !info.walk || !info.run) throw new Error('character is missing idle/walk/run clips');
    return Array.from({ length: count }, () => new Actor(gltf, info));
  } catch (err) {
    console.warn('Character model not loaded; using the procedural traveler.', err);
    return Array.from({ length: count }, (_, i) => new ProceduralActor(fallbackOpts[i]));
  }
}
