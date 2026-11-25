import * as THREE from 'three';
import { rand } from './materials.js';

/**
 * Falling particles that wrap around a moving center (snow outside, dust motes inside).
 * All motion happens in the vertex shader.
 */
export class ParticleField {
  constructor({
    count = 5000, box = new THREE.Vector3(70, 34, 70), color = 0xffffff,
    fall = [0.9, 2.2], size = [0.08, 0.2], sway = 0.6, wind = new THREE.Vector3(0.9, 0, 0.4),
    opacity = 0.9, fadeNear = 1.4, fadeFar = 55, additive = false, seed = 3, petal = false, color2 = null,
  } = {}) {
    const r = rand(seed);
    const pos = new Float32Array(count * 3);
    const att = new Float32Array(count * 3); // speed, size, phase
    for (let i = 0; i < count; i++) {
      pos[i * 3] = r() * box.x; pos[i * 3 + 1] = r() * box.y; pos[i * 3 + 2] = r() * box.z;
      att[i * 3] = fall[0] + r() * (fall[1] - fall[0]);
      att[i * 3 + 1] = size[0] + Math.pow(r(), 2.2) * (size[1] - size[0]);
      att[i * 3 + 2] = r() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAtt', new THREE.BufferAttribute(att, 3));
    this.uniforms = {
      uTime: { value: 0 },
      uCenter: { value: new THREE.Vector3() },
      uBox: { value: box.clone() },
      uWind: { value: wind.clone() },
      uSway: { value: sway },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uScale: { value: 600 },
      uFade: { value: new THREE.Vector2(fadeNear, fadeFar) },
      uFloor: { value: -1e5 },
      uColor2: { value: new THREE.Color(color2 ?? color) },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      transparent: true,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      vertexShader: /* glsl */ `
        attribute vec3 aAtt;
        uniform float uTime; uniform vec3 uCenter; uniform vec3 uBox; uniform vec3 uWind;
        uniform float uSway; uniform float uScale; uniform vec2 uFade; uniform float uFloor;
        varying float vAlpha; varying float vRot; varying float vTint;
        void main() {
          vec3 p = position;
          vRot = aAtt.z * 3.0 + uTime * (0.6 + aAtt.x * 0.8);
          vTint = fract(aAtt.z * 7.31);
          float t = uTime;
          p.y -= t * aAtt.x;
          p.x += t * uWind.x * (0.6 + aAtt.x * 0.25) + sin(t * 0.9 + aAtt.z) * uSway;
          p.z += t * uWind.z * (0.6 + aAtt.x * 0.25) + cos(t * 0.7 + aAtt.z * 1.3) * uSway * 0.6;
          vec3 lo = uCenter - uBox * 0.5;
          p = lo + mod(p - lo, uBox);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          float d = -mv.z;
          vAlpha = smoothstep(uFade.x, uFade.x + 1.2, d) * (1.0 - smoothstep(uFade.y * 0.55, uFade.y, d));
          vAlpha *= step(uFloor, p.y);
          gl_PointSize = aAtt.y * uScale / max(d, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform vec3 uColor2; uniform float uOpacity;
        varying float vAlpha; varying float vRot; varying float vTint;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          ${petal ? `
          // a turning petal: a narrow oval, seen edge-on now and then, with a notch at the tip
          float s = sin(vRot), k = cos(vRot);
          c = vec2(k * c.x - s * c.y, s * c.x + k * c.y);
          float flip = 0.25 + 0.75 * abs(sin(vRot * 0.7));
          vec2 e = vec2(c.x / (0.26 * flip), c.y / 0.46);
          float a = smoothstep(1.0, 0.7, length(e)) * (1.0 - smoothstep(0.06, 0.0, abs(c.x)) * step(0.3, c.y));
          vec3 col = mix(uColor, uColor2, vTint) * (0.85 + 0.15 * flip);` : `
          float r = length(c);
          float a = smoothstep(0.5, 0.05, r);
          vec3 col = uColor;`}
          gl_FragColor = vec4(col, a * vAlpha * uOpacity);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 10;
  }
  update(dt, center, viewportHeight) {
    this.uniforms.uTime.value += dt;
    this.uniforms.uCenter.value.copy(center);
    this.uniforms.uScale.value = viewportHeight * 0.55;
  }
}

/**
 * Incense smoke: thin rising thread that curls and spreads as it climbs.
 * CPU-simulated small pool of soft sprites.
 */
export class Smoke {
  constructor({ max = 220, rate = 26, color = 0xd9dcda, rise = 0.32, life = 6.5, maxSize = 0.55, opacity = 0.16 } = {}) {
    this.max = max; this.rate = rate; this.rise = rise; this.life = life; this.maxSize = maxSize;
    this.source = new THREE.Vector3();
    this.active = false;
    this.acc = 0;
    this.time = 0;
    this.parts = [];
    this.cursor = 0;
    const pos = new Float32Array(max * 3);
    const ageA = new Float32Array(max * 2); // age01, seed
    for (let i = 0; i < max; i++) { this.parts.push({ alive: false, age: 0, p: new THREE.Vector3(), seed: Math.random() * 100 }); ageA[i * 2] = 1; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aAge', new THREE.BufferAttribute(ageA, 2));
    this.geo = geo;
    this.uniforms = {
      uColor: { value: new THREE.Color(color) },
      uScale: { value: 600 },
      uMax: { value: maxSize },
      uOpacity: { value: opacity },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, depthWrite: false,
      vertexShader: /* glsl */ `
        attribute vec2 aAge; uniform float uScale; uniform float uMax;
        varying float vA; varying float vSeed;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          float a = aAge.x;
          vA = a < 1.0 ? smoothstep(0.0, 0.08, a) * (1.0 - smoothstep(0.45, 1.0, a)) : 0.0;
          vSeed = aAge.y;
          float s = mix(0.02, uMax, pow(a, 1.4));
          gl_PointSize = s * uScale / max(-mv.z, 0.1);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; uniform float uOpacity; varying float vA; varying float vSeed;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float r = length(c);
          float a = smoothstep(0.5, 0.0, r);
          a *= a;
          gl_FragColor = vec4(uColor, a * vA * uOpacity);
        }`,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 12;
  }
  update(dt, viewportHeight) {
    this.time += dt;
    this.uniforms.uScale.value = viewportHeight * 0.55;
    if (this.active) {
      this.acc += dt * this.rate;
      while (this.acc >= 1) {
        this.acc -= 1;
        const q = this.parts[this.cursor];
        this.cursor = (this.cursor + 1) % this.max;
        q.alive = true; q.age = 0; q.p.copy(this.source); q.seed = Math.random() * 100;
      }
    }
    const pos = this.geo.attributes.position.array;
    const age = this.geo.attributes.aAge.array;
    const t = this.time;
    for (let i = 0; i < this.max; i++) {
      const q = this.parts[i];
      if (!q.alive) { age[i * 2] = 1; continue; }
      q.age += dt / this.life;
      if (q.age >= 1) { q.alive = false; age[i * 2] = 1; continue; }
      const h = q.p.y - this.source.y;
      // Laminar near the tip, turbulent higher up.
      const turb = Math.min(1, h / 0.9);
      q.p.y += this.rise * dt * (1 - q.age * 0.5);
      q.p.x += (Math.sin(t * 0.8 + h * 3.1 + q.seed * 0.02) * 0.05 + Math.sin(t * 1.7 + q.seed) * 0.12 * turb) * dt;
      q.p.z += (Math.cos(t * 0.6 + h * 2.3) * 0.04 + Math.cos(t * 1.3 + q.seed * 1.7) * 0.1 * turb) * dt;
      pos[i * 3] = q.p.x; pos[i * 3 + 1] = q.p.y; pos[i * 3 + 2] = q.p.z;
      age[i * 2] = q.age; age[i * 2 + 1] = q.seed;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.aAge.needsUpdate = true;
  }
}

/** Footprints pressed into snow behind the traveler. */
export class Footprints {
  constructor(scene, max = 90) {
    this.max = max;
    const geo = new THREE.CircleGeometry(0.1, 14);
    geo.rotateX(-Math.PI / 2);
    geo.scale(0.75, 1, 1.45);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x8fa3ad, roughness: 1, transparent: true, opacity: 0.45, depthWrite: false,
      polygonOffset: true, polygonOffsetFactor: -2,
    });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
    this.i = 0;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    scene.add(this.mesh);
  }
  add(pos, yaw) {
    this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    this.m.compose(pos, this.q, new THREE.Vector3(1, 1, 1));
    this.mesh.setMatrixAt(this.i, this.m);
    this.i = (this.i + 1) % this.max;
    this.mesh.count = Math.min(this.max, this.mesh.count + 1);
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { this.mesh.count = 0; this.i = 0; }
}

/** Soft additive light shaft (a tapered quad) for god rays through windows. */
export function lightShaft({ width = 1.2, length = 6, color = 0xcfe0ea, opacity = 0.12 } = {}) {
  const geo = new THREE.PlaneGeometry(width, length, 1, 8);
  geo.translate(0, -length / 2, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: opacity }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 uColor; uniform float uOpacity; uniform float uTime; varying vec2 vUv;
      void main(){
        float edge = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x);
        float along = smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.85, vUv.y);
        float flick = 0.85 + 0.15 * sin(uTime * 0.6 + vUv.y * 4.0);
        gl_FragColor = vec4(uColor, edge * along * uOpacity * flick);
      }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 11;
  return m;
}
