import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Small loader for the prop models in assets/models. Each file loads once; every
// caller gets its own clone (sharing geometry and textures), fitted to a size and
// anchored so it drops into the procedural group it replaces.

const loader = new GLTFLoader();
const cache = new Map();

function load(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((res, rej) => loader.load(url, (g) => {
      // the baked foliage models ship without normals (smaller files); rebuild them once
      g.scene.traverse((o) => { if (o.isMesh && !o.geometry.attributes.normal) o.geometry.computeVertexNormals(); });
      res(g.scene);
    }, undefined, rej)));
  }
  return cache.get(url);
}

/**
 * @param name   file name in assets/models, without .glb
 * @param opts   height | width: target size in metres (one of them)
 *               anchor: 'top' (hangs from the origin), 'bottom' (stands on it) or 'center'
 *               own: give this clone its own materials (so it can glow on its own)
 *               part: name of one top-level node, for files that hold a set (sakura: big / small / small2)
 */
export function propModel(name, { height, width, anchor = 'center', own = false, part } = {}) {
  return load(`./assets/models/${name}.glb?v=${window.__V || ''}`).then((src) => {
    const model = (part ? src.getObjectByName(part) : src).clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = height ? height / size.y : width / Math.max(size.x, size.z);
    model.scale.setScalar(s);
    const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
    const y = anchor === 'top' ? box.max.y : anchor === 'bottom' ? box.min.y : (box.min.y + box.max.y) / 2;
    model.position.set(-cx * s, -y * s, -cz * s);
    const wrap = new THREE.Group();
    wrap.add(model);
    wrap.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      if (own) o.material = o.material.clone();
    });
    return wrap;
  });
}

/** Every mesh material under an object. */
export function materialsOf(obj) {
  const out = [];
  obj.traverse((o) => { if (o.isMesh) out.push(o.material); });
  return out;
}

/**
 * The model's meshes as plain parts (geometry baked to the fitted size and anchor),
 * for building InstancedMeshes: one model placed many times in one draw each.
 */
export function propParts(name, opts) {
  return propModel(name, opts).then((wrap) => {
    wrap.updateMatrixWorld(true);
    const parts = [];
    wrap.traverse((o) => {
      if (!o.isMesh) return;
      const geometry = o.geometry.clone();
      // quantized files store small integers; baking a transform needs plain floats
      for (const name of Object.keys(geometry.attributes)) {
        const at = geometry.attributes[name];
        if (at.array instanceof Float32Array && !at.normalized) continue;
        const f = new Float32Array(at.count * at.itemSize);
        const get = [at.getX, at.getY, at.getZ, at.getW];
        for (let i = 0; i < at.count; i++) for (let c = 0; c < at.itemSize; c++) f[i * at.itemSize + c] = get[c].call(at, i);
        geometry.setAttribute(name, new THREE.BufferAttribute(f, at.itemSize));
      }
      geometry.applyMatrix4(o.matrixWorld);
      parts.push({ geometry, material: o.material });
    });
    return parts;
  });
}

/** Swap a set of procedural InstancedMeshes for a model, keeping every instance's placement. */
export function instancesFromModel(name, opts, from, scene) {
  return propParts(name, opts).then((parts) => {
    for (const p of parts) {
      const inst = new THREE.InstancedMesh(p.geometry, p.material, from.count);
      for (let i = 0; i < from.count; i++) { from.getMatrixAt(i, _m); inst.setMatrixAt(i, _m); }
      inst.count = from.count;
      inst.castShadow = from.castShadow;
      inst.receiveShadow = from.receiveShadow;
      scene.add(inst);
    }
    from.visible = false;
  });
}
const _m = new THREE.Matrix4();
