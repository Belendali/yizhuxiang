import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Small loader for the prop models in assets/models. Each file loads once; every
// caller gets its own clone (sharing geometry and textures), fitted to a size and
// anchored so it drops into the procedural group it replaces.

const loader = new GLTFLoader();
const cache = new Map();

function load(url) {
  if (!cache.has(url)) cache.set(url, new Promise((res, rej) => loader.load(url, (g) => res(g.scene), undefined, rej)));
  return cache.get(url);
}

/**
 * @param name   file name in assets/models, without .glb
 * @param opts   height | width: target size in metres (one of them)
 *               anchor: 'top' (hangs from the origin), 'bottom' (stands on it) or 'center'
 *               own: give this clone its own materials (so it can glow on its own)
 */
export function propModel(name, { height, width, anchor = 'center', own = false } = {}) {
  return load(`./assets/models/${name}.glb`).then((src) => {
    const model = src.clone(true);
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
