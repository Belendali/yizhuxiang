import * as THREE from 'three';
import { snowyMaterial } from './materials.js';

// The traveler: red cloak, straw hat hung with paper strips, a ringed staff.
// Faces -Z. Root sits at the feet.
export class Traveler {
  constructor({ snowy = true } = {}) {
    this.group = new THREE.Group();
    this.phase = 0;
    this.speed = 0;
    this.bow = 0;
    this.time = 0;

    const cloakMat = snowy
      ? snowyMaterial({ color: 0x8c2c22, threshold: 0.72, softness: 0.08, noiseScale: 3, noiseAmt: 0.5, variation: 0.18 })
      : new THREE.MeshStandardMaterial({ color: 0x8c2c22, roughness: 0.9 });
    const strawMat = snowy
      ? snowyMaterial({ color: 0xa88f5c, threshold: 0.42, softness: 0.08, noiseScale: 5, noiseAmt: 0.5, variation: 0.2 })
      : new THREE.MeshStandardMaterial({ color: 0xa88f5c, roughness: 0.95 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x24282a, roughness: 0.85 });
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xece6d6, roughness: 0.8, side: THREE.DoubleSide });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x8a7a4e, roughness: 0.45, metalness: 0.7 });

    // Legs (pivot at the hip so they can swing)
    this.legs = [];
    for (const sx of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(0.11 * sx, 0.42, 0);
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.42, 10), darkMat);
      leg.position.y = -0.21;
      const boot = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.08, 0.2), darkMat);
      boot.position.set(0, -0.4, -0.04);
      pivot.add(leg, boot);
      leg.castShadow = boot.castShadow = true;
      this.group.add(pivot);
      this.legs.push(pivot);
    }

    // Upper body pivots at the waist (used for bowing)
    this.upper = new THREE.Group();
    this.upper.position.y = 0.78;
    this.group.add(this.upper);

    const cloakProfile = [
      [0.0, 0.72], [0.12, 0.71], [0.22, 0.66], [0.29, 0.55], [0.31, 0.35],
      [0.34, 0.05], [0.39, -0.3], [0.44, -0.5], [0.45, -0.56], [0.0, -0.56],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const cloakGeo = new THREE.LatheGeometry(cloakProfile, 28);
    // Flatten front/back a little so the silhouette reads as a body, not a bell.
    const p = cloakGeo.attributes.position;
    for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) * 0.82);
    cloakGeo.computeVertexNormals();
    this.cloak = new THREE.Mesh(cloakGeo, cloakMat);
    this.cloak.castShadow = true;
    this.upper.add(this.cloak);

    // Hood / head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), darkMat);
    head.position.y = 0.8;
    head.castShadow = true;
    this.upper.add(head);

    // Straw hat
    this.hat = new THREE.Group();
    this.hat.position.y = 0.88;
    const hatTop = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.3, 28, 1, true), strawMat);
    hatTop.position.y = 0.05;
    hatTop.castShadow = true;
    const hatUnder = new THREE.Mesh(new THREE.ConeGeometry(0.455, 0.27, 28, 1, true), new THREE.MeshStandardMaterial({ color: 0x6d5a35, roughness: 1, side: THREE.BackSide }));
    hatUnder.position.y = 0.04;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), strawMat);
    knob.position.y = 0.21;
    this.hat.add(hatTop, hatUnder, knob);
    // Paper strips around the brim
    this.strips = [];
    const stripGeo = new THREE.PlaneGeometry(0.06, 0.15);
    stripGeo.translate(0, -0.075, 0);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const s = new THREE.Mesh(stripGeo, paperMat);
      s.position.set(Math.sin(a) * 0.43, -0.1, Math.cos(a) * 0.43);
      s.rotation.y = a;
      s.userData.a = a;
      this.hat.add(s);
      this.strips.push(s);
    }
    this.upper.add(this.hat);

    // Sash rope across the back, hung with paper
    const sashCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.27, 0.55, 0.05), new THREE.Vector3(-0.15, 0.4, 0.27),
      new THREE.Vector3(0.1, 0.18, 0.29), new THREE.Vector3(0.31, 0.0, 0.12),
    ]);
    const sash = new THREE.Mesh(new THREE.TubeGeometry(sashCurve, 24, 0.022, 6), strawMat);
    this.upper.add(sash);
    for (let i = 1; i < 7; i++) {
      const pt = sashCurve.getPoint(i / 7);
      const s = new THREE.Mesh(stripGeo, paperMat);
      s.position.copy(pt).add(new THREE.Vector3(0, -0.01, 0.015));
      s.scale.setScalar(0.8);
      s.userData.a = i;
      this.upper.add(s);
      this.strips.push(s);
    }

    // Staff with rings at the top (held on the right side)
    this.staff = new THREE.Group();
    this.staff.position.set(0.4, -0.78, -0.18);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 2.05, 8), darkMat);
    pole.position.y = 1.02;
    pole.castShadow = true;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.012, 8, 20), metalMat);
    ring.position.y = 2.12;
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 14), metalMat);
    ring2.position.set(0.07, 2.04, 0);
    const ring3 = ring2.clone();
    ring3.position.x = -0.07;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 8), metalMat);
    tip.position.y = 2.24;
    this.staff.add(pole, ring, ring2, ring3, tip);
    this.upper.add(this.staff);

    // Where held objects (the incense stick) attach.
    this.hand = new THREE.Object3D();
    this.hand.position.set(-0.1, 0.42, -0.36);
    this.upper.add(this.hand);
  }

  /** speed: 0..1 walking intensity */
  update(dt, speed) {
    this.time += dt;
    this.speed += (speed - this.speed) * Math.min(1, dt * 6);
    const s = this.speed;
    this.phase += dt * 5.2 * s;
    const sw = Math.sin(this.phase);
    this.legs[0].rotation.x = sw * 0.45 * s;
    this.legs[1].rotation.x = -sw * 0.45 * s;
    this.upper.position.y = 0.78 + Math.abs(Math.cos(this.phase)) * 0.035 * s;
    this.upper.rotation.z = sw * 0.025 * s;
    this.upper.rotation.x = -this.bow * 0.75 - 0.05 * s;
    this.staff.rotation.x = Math.sin(this.phase + 0.6) * 0.12 * s;
    // Paper strips flutter in the wind
    for (const st of this.strips) {
      st.rotation.x = 0.15 + Math.sin(this.time * 3.1 + st.userData.a * 1.7) * 0.18 + s * 0.15;
    }
  }

  /** Called on each footfall so the caller can play crunch sounds / place prints */
  consumeStep() {
    const step = Math.floor(this.phase / Math.PI);
    if (this._lastStep === undefined) this._lastStep = step;
    if (step !== this._lastStep) {
      this._lastStep = step;
      return step % 2 === 0 ? 'L' : 'R';
    }
    return null;
  }
}
