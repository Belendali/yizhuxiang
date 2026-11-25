import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { propModel, materialsOf } from './models.js';
import { makeCanvasTexture, rand } from './materials.js';
import { latticeTexture } from './exterior.js';
import { ParticleField, Smoke, lightShaft } from './fx.js';

// Simple, clean, solemn: dark timber, a small gilded Buddha, two candles, one incense already burning.
export const INSIDE = {
  startZ: 4.2,
  stopZ: -1.2,
  altarZ: -2.95,
  tableY: 1.0,
};

function plankTexture() {
  return makeCanvasTexture(512, 512, (g, w, h) => {
    const r = rand(21);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const v = 82 + r() * 22;
      g.fillStyle = `rgb(${v + 14},${v + 4},${v - 10})`;
      g.fillRect((i / n) * w, 0, w / n, h);
      for (let k = 0; k < 40; k++) {
        g.strokeStyle = `rgba(40,26,14,${0.05 + r() * 0.08})`;
        g.lineWidth = 1 + r() * 2;
        const x = (i / n) * w + r() * (w / n);
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 6, h); g.stroke();
      }
      g.fillStyle = 'rgba(20,12,6,0.6)';
      g.fillRect((i / n) * w, 0, 2, h);
      const cut = r() * h;
      g.fillRect((i / n) * w, cut, w / n, 2);
    }
  }, { repeat: [2, 2.4] });
}

function darkWoodTexture() {
  return makeCanvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = '#3a2d22'; g.fillRect(0, 0, w, h);
    const r = rand(8);
    for (let i = 0; i < 140; i++) {
      g.strokeStyle = `rgba(${r() > 0.5 ? '255,220,180' : '0,0,0'},${0.03 + r() * 0.05})`;
      g.lineWidth = 1 + r() * 2;
      const x = r() * w;
      g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 8, h * 0.4, x - 8, h * 0.6, x, h); g.stroke();
    }
  });
}

function clothTexture() {
  return makeCanvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = '#7a2a21'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c59a52'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28);
    g.lineWidth = 3; g.strokeRect(34, 34, w - 68, h - 68);
    g.fillStyle = '#c59a52';
    g.beginPath(); g.arc(w / 2, h * 0.45, 46, 0, Math.PI * 2); g.lineWidth = 6; g.stroke();
    // simple lotus mark
    for (let i = 0; i < 8; i++) {
      g.save(); g.translate(w / 2, h * 0.45); g.rotate((i / 8) * Math.PI * 2);
      g.beginPath(); g.ellipse(0, -22, 8, 18, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
  });
}

export function buildInterior(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x171009);
  scene.fog = new THREE.Fog(0x2a1d12, 8, 22);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55; // r163+; harmless on older
  const r = rand(77);

  const W = 9, D = 11, H = 5.4;
  const z0 = 5.5, z1 = z0 - D; // front (entrance) and back wall
  const wood = new THREE.MeshStandardMaterial({ map: darkWoodTexture(), color: 0xa58a72, roughness: 0.78, envMapIntensity: 0.3 });
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x5a2219, roughness: 0.45, envMapIntensity: 0.6 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x2b1f16, roughness: 0.9, envMapIntensity: 0.2 });
  const bronze = new THREE.MeshStandardMaterial({ color: 0x8a6a3c, metalness: 0.85, roughness: 0.42, envMapIntensity: 1.2 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xc39a52, metalness: 0.8, roughness: 0.38, envMapIntensity: 1.4, emissive: 0x2a1a06, emissiveIntensity: 0.4 });

  // Floor / walls / ceiling
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: plankTexture(), roughness: 0.72, envMapIntensity: 0.4 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = (z0 + z1) / 2;
  floor.receiveShadow = true;
  scene.add(floor);
  const wallGeoSide = new THREE.PlaneGeometry(D, H);
  for (const sx of [-1, 1]) {
    const w = new THREE.Mesh(wallGeoSide, wood);
    w.rotation.y = -sx * Math.PI / 2;
    w.position.set(sx * W / 2, H / 2, (z0 + z1) / 2);
    w.receiveShadow = true;
    scene.add(w);
  }
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wood);
  back.position.set(0, H / 2, z1);
  scene.add(back);
  const front = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wood);
  front.rotation.y = Math.PI;
  front.position.set(0, H / 2, z0);
  scene.add(front);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), darkMat);
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, H, (z0 + z1) / 2);
  scene.add(ceil);
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(W, 0.28, 0.3), darkMat);
    b.position.set(0, H - 0.14, z0 - 0.8 - i * 1.9);
    scene.add(b);
  }
  // skirting + upper beam on side walls
  for (const sx of [-1, 1]) {
    const sk = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.5, D), darkMat);
    sk.position.set(sx * (W / 2 - 0.05), 0.25, (z0 + z1) / 2);
    scene.add(sk);
  }

  // Pillars (deep red lacquer) on stone bases
  const stoneBase = new THREE.MeshStandardMaterial({ color: 0x5e5a52, roughness: 0.9 });
  for (const x of [-3.1, 3.1]) for (const z of [2.2, -1.6]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, H, 16), lacquer);
    p.position.set(x, H / 2, z);
    p.castShadow = p.receiveShadow = true;
    scene.add(p);
    const b = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.16, 16), stoneBase);
    b.position.set(x, 0.08, z);
    scene.add(b);
  }

  // Side lattice windows lit by cold snow-light
  const winTex = latticeTexture({ cols: 5, rows: 6 });
  const winEm = latticeTexture({ cols: 5, rows: 6, emissive: true });
  const winMat = new THREE.MeshStandardMaterial({ map: winTex, emissiveMap: winEm, emissive: 0xcfe0ee, emissiveIntensity: 1.25, roughness: 1 });
  const shafts = [];
  for (const sx of [-1, 1]) for (const z of [2.6, -0.6]) {
    const w = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.0), winMat);
    w.rotation.y = -sx * Math.PI / 2;
    w.position.set(sx * (W / 2 - 0.02), 2.6, z);
    scene.add(w);
    const sh = lightShaft({ width: 1.6, length: 5.2, color: 0xbdd2e2, opacity: 0.045 });
    sh.position.set(sx * (W / 2 - 0.1), 3.5, z);
    sh.rotation.set(0, -sx * Math.PI / 2, 0);
    sh.rotateX(-0.75);
    sh.rotation.y += sx * 0.35;
    scene.add(sh);
    shafts.push(sh);
  }

  // Round moon window behind the Buddha
  const moon = new THREE.Mesh(new THREE.CircleGeometry(1.15, 48), new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xd9e6ee, emissiveIntensity: 1.1, emissiveMap: latticeTexture({ cols: 6, rows: 6, emissive: true }) }));
  moon.position.set(0, 2.75, z1 + 0.02);
  scene.add(moon);
  const moonRing = new THREE.Mesh(new THREE.TorusGeometry(1.18, 0.08, 10, 60), darkMat);
  moonRing.position.copy(moon.position);
  scene.add(moonRing);

  // Hanging banners
  const bannerMat = new THREE.MeshStandardMaterial({ map: clothTexture(), roughness: 0.95, side: THREE.DoubleSide });
  const banners = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.PlaneGeometry(0.7, 3.0, 1, 12);
    g.translate(0, -1.5, 0);
    const b = new THREE.Mesh(g, bannerMat);
    b.position.set(sx * 2.15, H - 0.3, z1 + 0.6);
    b.castShadow = true;
    scene.add(b);
    banners.push(b);
  }

  // ---------- Altar ----------
  const tz = INSIDE.altarZ, ty = INSIDE.tableY;
  const table = new THREE.Group();
  scene.add(table);
  const top = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.12, 1.2), lacquer);
  top.position.set(0, ty - 0.06, tz);
  top.castShadow = top.receiveShadow = true;
  table.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.12, ty - 0.12, 0.12), lacquer);
    leg.position.set(sx * 1.45, (ty - 0.12) / 2, tz + sz * 0.5);
    table.add(leg);
  }
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.86), new THREE.MeshStandardMaterial({ map: clothTexture(), roughness: 0.95 }));
  apron.position.set(0, ty - 0.55, tz + 0.61);
  table.add(apron);
  // Raised dais behind for the Buddha
  const dais = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.35, 0.75), lacquer);
  dais.position.set(0, ty + 0.175, tz - 0.25);
  dais.castShadow = dais.receiveShadow = true;
  scene.add(dais);

  // ---------- Small gilded Buddha ----------
  const buddha = new THREE.Group();
  buddha.position.set(0, ty + 0.35, tz - 0.25);
  scene.add(buddha);
  // procedural figure: a fallback until (or if) the sculpted model loads
  const figure = new THREE.Group();
  buddha.add(figure);
  // lotus seat
  const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.14, 32), gold);
  seat.position.y = 0.07;
  figure.add(seat);
  const petalGeo = new THREE.SphereGeometry(1, 12, 8);
  for (let row = 0; row < 2; row++) {
    const n = row ? 14 : 12;
    for (let i = 0; i < n; i++) {
      const a = ((i + row * 0.5) / n) * Math.PI * 2;
      const pt = new THREE.Mesh(petalGeo, gold);
      pt.scale.set(0.09, 0.05, 0.16);
      const rad = row ? 0.38 : 0.44;
      pt.position.set(Math.sin(a) * rad, 0.06 + row * 0.08, Math.cos(a) * rad);
      pt.rotation.set(0, a, 0);
      pt.rotateX(-0.6 - row * 0.25);
      figure.add(pt);
    }
  }
  const bodyProfile = [[0.0, 0.0], [0.36, 0.0], [0.38, 0.06], [0.34, 0.14], [0.22, 0.18], [0.2, 0.26], [0.215, 0.38], [0.2, 0.48], [0.15, 0.53], [0.06, 0.57], [0.0, 0.58]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const bodyGeo = new THREE.LatheGeometry(bodyProfile, 32);
  const bp = bodyGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) bp.setZ(i, bp.getZ(i) * (bp.getY(i) < 0.17 ? 0.85 : 0.7));
  bodyGeo.computeVertexNormals();
  const body = new THREE.Mesh(bodyGeo, gold);
  body.position.y = 0.17;
  body.castShadow = true;
  figure.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1, 24, 18), gold);
  head.position.y = 0.17 + 0.67;
  head.scale.set(1, 1.12, 1);
  figure.add(head);
  const ush = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), gold);
  ush.position.y = 0.17 + 0.79;
  figure.add(ush);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), gold);
    ear.scale.set(0.5, 1.6, 0.8);
    ear.position.set(sx * 0.1, 0.17 + 0.64, 0);
    figure.add(ear);
  }
  const hands = new THREE.Mesh(new THREE.SphereGeometry(0.07, 14, 10), gold);
  hands.scale.set(1.3, 0.5, 0.8);
  hands.position.set(0, 0.17 + 0.2, 0.18);
  figure.add(hands);
  const haloMat = new THREE.MeshStandardMaterial({ color: 0xc8a560, metalness: 0.7, roughness: 0.35, emissive: 0xffc070, emissiveIntensity: 0.25, envMapIntensity: 1.2 });
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 8, 48), haloMat);
  halo.position.set(0, 0.17 + 0.69, -0.12);
  buddha.add(halo);
  const mandorla = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.014, 8, 64), haloMat);
  mandorla.scale.set(0.95, 1.18, 1);
  mandorla.position.set(0, 0.17 + 0.42, -0.16);
  buddha.add(mandorla);

  // ---------- Candles ----------
  const flames = [];
  const flameMat = new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffc679, emissiveIntensity: 7 });
  const candleMat = new THREE.MeshStandardMaterial({ color: 0xa8392c, roughness: 0.6 });
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(sx * 0.95, ty, tz + 0.15);
    const stickProfile = [[0, 0], [0.11, 0], [0.11, 0.02], [0.04, 0.05], [0.03, 0.22], [0.07, 0.25], [0.07, 0.27], [0, 0.27]].map(([x, y]) => new THREE.Vector2(x, y));
    const holder = new THREE.Mesh(new THREE.LatheGeometry(stickProfile, 18), bronze);
    const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.3, 14), candleMat);
    candle.position.y = 0.42;
    const flame = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), flameMat);
    flame.scale.set(0.022, 0.06, 0.022);
    flame.position.y = 0.62;
    g.add(holder, candle, flame);
    scene.add(g);
    const pl = new THREE.PointLight(0xffa860, 2.4, 7, 1.7);
    pl.position.set(sx * 0.95, ty + 0.75, tz + 0.3);
    pl.castShadow = sx < 0;
    if (pl.castShadow) { pl.shadow.mapSize.set(1024, 1024); pl.shadow.bias = -0.002; pl.shadow.radius = 4; }
    scene.add(pl);
    flames.push({ flame, light: pl, base: 2.4, seed: sx * 3.1, world: new THREE.Vector3(sx * 0.95, ty + 0.62, tz + 0.15) });
  }

  // ---------- Incense burner ----------
  const burner = new THREE.Group();
  burner.position.set(0, ty, tz + 0.3);
  scene.add(burner);
  const bowlProfile = [[0, 0.06], [0.14, 0.06], [0.2, 0.1], [0.23, 0.18], [0.22, 0.25], [0.24, 0.27], [0.2, 0.27], [0.0, 0.25]].map(([x, y]) => new THREE.Vector2(x, y));
  const bowl = new THREE.Mesh(new THREE.LatheGeometry(bowlProfile, 28), bronze);
  bowl.castShadow = true;
  burner.add(bowl);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.018, 0.1, 8), bronze);
    foot.position.set(Math.sin(a) * 0.12, 0.05, Math.cos(a) * 0.12);
    burner.add(foot);
  }
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 6, 12, Math.PI), bronze);
    ear.position.set(sx * 0.2, 0.28, 0);
    ear.rotation.y = Math.PI / 2;
    burner.add(ear);
  }
  const ash = new THREE.Mesh(new THREE.CircleGeometry(0.205, 28), new THREE.MeshStandardMaterial({ color: 0xb8ad97, roughness: 1 }));
  ash.rotation.x = -Math.PI / 2;
  ash.position.y = 0.245;
  burner.add(ash);
  const burnerTop = new THREE.Vector3(0, ty + 0.245, tz + 0.3);

  // incense stick factory
  const stickMat = new THREE.MeshStandardMaterial({ color: 0x6b3b22, roughness: 0.8 });
  const stickHandleMat = new THREE.MeshStandardMaterial({ color: 0xa3332a, roughness: 0.6 });
  const makeStick = (len = 0.42) => {
    const g = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 5), stickHandleMat);
    handle.position.y = 0.06;
    const body2 = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len - 0.12, 6), stickMat);
    body2.position.y = 0.12 + (len - 0.12) / 2;
    const emberMat = new THREE.MeshStandardMaterial({ color: 0x1a0a04, emissive: 0xff5a1a, emissiveIntensity: 0 });
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), emberMat);
    ember.position.y = len;
    g.add(handle, body2, ember);
    g.userData = { ember, emberMat, len };
    return g;
  };
  // the one already burning
  const oldStick = makeStick(0.3);
  oldStick.position.copy(burnerTop).add(new THREE.Vector3(0.05, -0.08, 0));
  oldStick.rotation.z = -0.06;
  oldStick.userData.emberMat.emissiveIntensity = 5;
  scene.add(oldStick);

  // the stick cup (where the traveler takes one)
  const cup = new THREE.Group();
  cup.position.set(-1.3, ty, tz + 0.25);
  scene.add(cup);
  const cupMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.2, 18), bronze);
  cupMesh.position.y = 0.1;
  cup.add(cupMesh);
  for (let i = 0; i < 11; i++) {
    const s = makeStick(0.42);
    s.position.set((r() - 0.5) * 0.06, 0.02, (r() - 0.5) * 0.06);
    s.rotation.set((r() - 0.5) * 0.25, 0, (r() - 0.5) * 0.25);
    cup.add(s);
  }
  // the stick the player will offer
  const newStick = makeStick(0.42);
  newStick.visible = false;
  scene.add(newStick);

  // offering bowls
  const fruitMat = new THREE.MeshStandardMaterial({ color: 0xd9822b, roughness: 0.55 });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xe8e2d6, roughness: 0.4 });
  for (const sx of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.1, 0.05, 20), plateMat);
    plate.position.set(sx * 0.55, ty + 0.025, tz - 0.05);
    scene.add(plate);
    for (const [dx, dy, dz] of [[-0.05, 0.08, 0.03], [0.06, 0.08, 0.02], [0, 0.08, -0.06], [0.0, 0.17, 0]]) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.058, 14, 10), fruitMat);
      f.position.set(sx * 0.55 + dx, ty + dy, tz - 0.05 + dz);
      f.castShadow = true;
      scene.add(f);
    }
  }
  // singing bowl (磬) on its cushion
  const bowlCushion = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.06, 16), new THREE.MeshStandardMaterial({ color: 0x7a2a21 }));
  bowlCushion.position.set(1.3, ty + 0.03, tz + 0.25);
  scene.add(bowlCushion);
  const sbProfile = [[0.0, 0.0], [0.08, 0.0], [0.13, 0.04], [0.15, 0.1], [0.14, 0.12], [0.12, 0.05], [0, 0.03]].map(([x, y]) => new THREE.Vector2(x, y));
  const singingBowl = new THREE.Group(); // lost in the snow at first; main.js shows it once it is back
  singingBowl.position.set(1.3, ty + 0.06, tz + 0.25);
  scene.add(singingBowl);
  const sb = new THREE.Mesh(new THREE.LatheGeometry(sbProfile, 28), bronze);
  singingBowl.add(sb);
  propModel('singing-bowl', { width: 0.27, anchor: 'bottom' }).then((m) => { singingBowl.add(m); sb.visible = false; }).catch(() => {});

  // kneeling cushion
  const cushion = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.45, 0.16, 28), new THREE.MeshStandardMaterial({ color: 0x8c6a38, roughness: 1 }));
  cushion.position.set(0, 0.08, INSIDE.stopZ - 0.05);
  cushion.receiveShadow = true;
  scene.add(cushion);
  // the carved golden lotus seat (assets/models/cushion.glb) on a red rug before the altar
  propModel('cushion', { width: 0.82, anchor: 'bottom' }).then((m) => {
    m.position.set(0, 0.02, INSIDE.stopZ - 0.05);
    for (const mt of materialsOf(m)) { mt.color.setHex(0xc9ae86); mt.roughness = 0.5; mt.envMapIntensity = 0.8; }
    scene.add(m);
    cushion.visible = false;
  }).catch(() => {});
  propModel('rug', { width: 2.3, anchor: 'bottom' }).then((m) => {
    m.scale.y = 0.25; // a flat rug, not a quilt
    m.position.set(0, 0.004, INSIDE.stopZ - 0.75);
    scene.add(m);
  }).catch(() => {});

  // ---------- Warm lamps: lotus lamps on the floor, paper lanterns overhead ----------
  const lamps = [];
  const addLamp = (x, z, { width = 0.42, light = 1.6 } = {}) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    scene.add(g);
    const pl = new THREE.PointLight(0xffa458, light, 4.2, 1.6);
    pl.position.set(x, 0.45, z);
    scene.add(pl);
    const L = { group: g, light: pl, base: light, seed: x * 1.7 + z, mats: [], on: 1 };
    lamps.push(L);
    propModel('lotus-lamp', { width, anchor: 'bottom', own: true }).then((m) => {
      g.add(m);
      for (const mt of materialsOf(m)) {
        mt.emissive = new THREE.Color(0xffb066);
        mt.emissiveMap = mt.map;
        mt.emissiveIntensity = 0.9;
        L.mats.push(mt);
      }
    }).catch(() => {});
    return L;
  };
  for (const sx of [-1, 1]) {
    addLamp(sx * 2.05, tz + 0.9);
    addLamp(sx * 2.3, 0.9, { light: 1.3 });
  }
  const hanging = [];
  for (const sx of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(sx * 2.3, H - 0.3, -0.3);
    scene.add(g);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 5), darkMat);
    cord.position.y = -0.25;
    g.add(cord);
    const pl = new THREE.PointLight(0xffa860, 2.6, 7.5, 1.6);
    pl.position.set(sx * 2.3, H - 1.15, -0.3);
    scene.add(pl);
    hanging.push({ light: pl, base: 2.6, seed: sx * 2.3 });
    propModel('lantern', { height: 0.62, anchor: 'top', own: true }).then((m) => {
      m.position.y = -0.48;
      g.add(m);
      for (const mt of materialsOf(m)) { mt.emissive = new THREE.Color(0xff9a4a); mt.emissiveMap = mt.map; mt.emissiveIntensity = 1.2; }
    }).catch(() => {});
  }

  // ---------- The daybed by the left wall, under the window (shown at bedtime) ----------
  const BED = { x: -3.72, z: 0.3 };
  const bed = new THREE.Group();
  bed.position.set(BED.x, 0, BED.z);
  bed.rotation.y = Math.PI / 2; // the bolster to the wall
  bed.visible = false;
  scene.add(bed);
  const bedMats = [];
  propModel('daybed', { width: 1.95, anchor: 'bottom', own: true }).then((m) => {
    bed.add(m);
    for (const mt of materialsOf(m)) { mt.roughness = Math.max(0.6, mt.roughness); mt.envMapIntensity = 0.5; bedMats.push(mt); }
  }).catch(() => {});
  const bedLamp = addLamp(BED.x + 0.15, BED.z - 1.25, { width: 0.4, light: 0 });
  bedLamp.on = 0;
  bedLamp.group.visible = false;

  // ---------- Light ----------
  scene.add(new THREE.HemisphereLight(0xc9b9a6, 0x3a2617, 0.85));
  const win = new THREE.DirectionalLight(0xcfe0f0, 0.9);
  win.position.set(-6, 6, 2);
  win.target.position.set(0, 0, -1);
  win.castShadow = true;
  win.shadow.mapSize.set(1024, 1024);
  Object.assign(win.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 20 });
  win.shadow.bias = -0.001;
  scene.add(win, win.target);
  const moonLight = new THREE.PointLight(0xd6e4ee, 2.5, 6, 1.5);
  moonLight.position.set(0, 2.8, z1 + 0.5);
  scene.add(moonLight);
  const fill = new THREE.PointLight(0xffb470, 0.8, 9, 1.4); // a warm glow on the altar; swells after the offering
  fill.position.set(0, 2.4, tz + 1.2);
  scene.add(fill);

  // the room's warm wash, from the front of the hall
  const warm = new THREE.PointLight(0xffb878, 1.4, 12, 1.2);
  warm.position.set(0, 3.6, 2.4);
  scene.add(warm);

  // ---------- FX ----------
  const dust = new ParticleField({
    count: 700, box: new THREE.Vector3(8.5, 5, 10), color: 0xffe2b8, fall: [0.01, 0.06], size: [0.012, 0.035],
    sway: 0.25, wind: new THREE.Vector3(0.04, 0, -0.02), opacity: 0.55, fadeNear: 0.3, fadeFar: 14, additive: true, seed: 9,
  });
  dust.uniforms.uCenter.value.set(0, 2.5, 0);
  scene.add(dust.points);
  const smokeOld = new Smoke({ rate: 18, maxSize: 0.42, opacity: 0.14 });
  smokeOld.source.copy(oldStick.position).add(new THREE.Vector3(-0.018, 0.3, 0));
  smokeOld.active = true;
  scene.add(smokeOld.points);
  const smokeNew = new Smoke({ rate: 24, maxSize: 0.5, opacity: 0.17 });
  scene.add(smokeNew.points);

  // ---------- Sculpted Buddha (assets/models/buddha.glb) ----------
  // Replaces the procedural figure once loaded. STATUE tunes the fit on the dais.
  // tint: multiplies the texture (warm aged ivory so it sits in the candlelit room)
  const STATUE = { url: `./assets/models/buddha.glb?v=${window.__V || ''}`, height: 1.0, turn: 0, tint: 0xe2d6c2, roughness: 0.7, env: 0.5 };
  new GLTFLoader().load(STATUE.url, (gltf) => {
    const model = gltf.scene;
    model.rotation.y = STATUE.turn;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const s = STATUE.height / size.y;
    model.scale.setScalar(s);
    // stand it on the dais, centred
    model.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
    model.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const m = o.material;
      m.color.setHex(STATUE.tint);
      m.roughness = STATUE.roughness;
      m.envMapIntensity = STATUE.env;
      m.side = THREE.FrontSide; // the scan is closed; skip back faces
      m.emissiveMap = null; m.emissive.setHex(0); // the export ships an all-black emissive map
    });
    buddha.add(model);
    figure.visible = false;
    api.statue = model;
  }, undefined, (err) => console.warn('Buddha model not loaded; keeping the procedural one.', err));

  let t = 0;
  const api = {
    scene, buddha, cup, bed, bedPos: new THREE.Vector3(BED.x, 0.45, BED.z), newStick, singingBowl, burnerTop, flames, fill, smokeOld, smokeNew, moon, halo: haloMat,
    cupTop: new THREE.Vector3(-1.3, ty + 0.4, tz + 0.25),
    glow: 0, // 0..1 after offering
    /** Bedtime: the daybed and its lamp fade in (k 0..1). */
    showBed(k) {
      bed.visible = k > 0;
      bedLamp.group.visible = k > 0;
      bedLamp.on = k;
      for (const mt of bedMats) { mt.transparent = k < 1; mt.opacity = k; mt.depthWrite = k > 0.5; }
      for (const mt of bedLamp.mats) { mt.transparent = k < 1; mt.opacity = k; }
    },
    update(dt, vh) {
      t += dt;
      for (const f of flames) {
        const k = 1 + Math.sin(t * 9 + f.seed) * 0.08 + Math.sin(t * 23 + f.seed * 2) * 0.05 + (Math.random() - 0.5) * 0.04;
        f.light.intensity = f.base * k * (1 + api.glow * 0.6);
        f.flame.scale.y = 0.06 * (0.92 + k * 0.1);
        f.flame.position.x = Math.sin(t * 5 + f.seed) * 0.004;
      }
      for (const b of banners) {
        const p = b.geometry.attributes.position;
        if (!b.userData.base) b.userData.base = Float32Array.from(p.array);
        const base = b.userData.base;
        for (let i = 0; i < p.count; i++) {
          const y = base[i * 3 + 1];
          p.setZ(i, base[i * 3 + 2] + Math.sin(t * 0.8 + y * 1.5 + b.position.x) * 0.03 * (-y / 3));
        }
        p.needsUpdate = true;
      }
      for (const s of shafts) s.material.uniforms.uTime.value = t;
      fill.intensity = 0.8 + api.glow * 1.0;
      for (const L of lamps) {
        const k = 1 + Math.sin(t * 7 + L.seed) * 0.06 + Math.sin(t * 17 + L.seed * 2) * 0.04;
        L.light.intensity = (L.base || 1.4) * k * L.on;
        for (const mt of L.mats) mt.emissiveIntensity = 0.9 * k * L.on;
      }
      for (const h of hanging) h.light.intensity = h.base * (1 + Math.sin(t * 5 + h.seed) * 0.04);
      haloMat.emissiveIntensity = 0.25 + api.glow * 0.3;
      dust.update(dt, dust.uniforms.uCenter.value, vh);
      dust.uniforms.uCenter.value.set(0, 2.5, 0);
      smokeOld.update(dt, vh);
      smokeNew.update(dt, vh);
      // ember of the burning sticks
      oldStick.userData.emberMat.emissiveIntensity = 4 + Math.sin(t * 2.3) * 1.2;
    },
  };
  return api;
}
