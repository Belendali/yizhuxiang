import * as THREE from 'three';

// Small value-noise / fbm used by the "snow settles on upward faces" shader patch.
const NOISE_GLSL = /* glsl */ `
float yzx_hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float yzx_noise(vec3 x){
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(yzx_hash(i + vec3(0,0,0)), yzx_hash(i + vec3(1,0,0)), f.x),
                 mix(yzx_hash(i + vec3(0,1,0)), yzx_hash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(yzx_hash(i + vec3(0,0,1)), yzx_hash(i + vec3(1,0,1)), f.x),
                 mix(yzx_hash(i + vec3(0,1,1)), yzx_hash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float yzx_fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * yzx_noise(p); p *= 2.03; a *= 0.5; } return s; }
`;

/**
 * Standard material whose upward-facing surfaces are covered in snow.
 * Works for regular and instanced meshes. `flat` uses screen-space derivatives
 * for faceted, painterly rock.
 */
export function snowyMaterial({
  color = 0x7d8a78,
  snow = 0xf3f5f2,
  threshold = 0.55,
  softness = 0.1,
  noiseScale = 0.5,
  noiseAmt = 0.35,
  variation = 0.35,
  roughness = 0.95,
  metalness = 0,
  flat = false,
  emissive = 0x000000,
} = {}) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: flat, emissive });
  const uniforms = {
    uSnow: { value: new THREE.Color(snow) },
    uThresh: { value: threshold },
    uSoft: { value: softness },
    uNScale: { value: noiseScale },
    uNAmt: { value: noiseAmt },
    uVar: { value: variation },
  };
  mat.userData.snowUniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSWPos;\nvarying vec3 vSWNrm;')
      .replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
        vec4 sw_p = vec4(transformed, 1.0);
        vec3 sw_n = objectNormal;
        #ifdef USE_INSTANCING
          sw_p = instanceMatrix * sw_p;
          sw_n = mat3(instanceMatrix) * sw_n;
        #endif
        vSWPos = (modelMatrix * sw_p).xyz;
        vSWNrm = normalize(mat3(modelMatrix) * sw_n);`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vSWPos; varying vec3 vSWNrm;
        uniform vec3 uSnow; uniform float uThresh; uniform float uSoft; uniform float uNScale; uniform float uNAmt; uniform float uVar;
        ${NOISE_GLSL}`
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec3 sw_wn = ${flat ? 'normalize(cross(dFdx(vSWPos), dFdy(vSWPos)))' : 'normalize(vSWNrm)'};
        float sw_nz = yzx_fbm(vSWPos * uNScale);
        float sw_cover = smoothstep(uThresh - uSoft, uThresh + uSoft, sw_wn.y + (sw_nz - 0.5) * uNAmt * 2.0);
        float sw_var = yzx_fbm(vSWPos * uNScale * 2.7 + 7.0);
        diffuseColor.rgb *= mix(1.0 - uVar, 1.0 + uVar * 0.6, sw_var);
        diffuseColor.rgb = mix(diffuseColor.rgb, uSnow * mix(0.92, 1.0, sw_nz), sw_cover);`
      );
  };
  // Unique program per flat/smooth variant.
  mat.customProgramCacheKey = () => `snowy-${flat ? 'f' : 's'}`;
  return mat;
}

/** Canvas-generated textures (no external image assets). */
export function makeCanvasTexture(w, h, draw, { repeat = [1, 1], srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function rand(seed) {
  // Mulberry32 — deterministic so the world is the same every visit.
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// CPU value noise (matches the feel of the shader noise, not the exact values).
export function makeNoise2D(seed = 1) {
  const r = rand(seed);
  const perm = new Uint8Array(512);
  const vals = new Float32Array(256);
  for (let i = 0; i < 256; i++) { perm[i] = i; vals[i] = r(); }
  for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
  const v = (x, y) => vals[perm[(perm[x & 255] + y) & 255]];
  const s = (t) => t * t * (3 - 2 * t);
  const n = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
    const u = s(xf), w = s(yf);
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
  };
  const fbm = (x, y, oct = 4) => {
    let a = 0.5, sum = 0;
    for (let i = 0; i < oct; i++) { sum += a * n(x, y); x *= 2.02; y *= 2.02; a *= 0.5; }
    return sum;
  };
  return { n, fbm };
}
