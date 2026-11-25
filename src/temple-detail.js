import * as THREE from 'three';
import { propModel } from './models.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { snowyMaterial, makeCanvasTexture } from './materials.js';

// Architectural detail for the snow temple: bracket sets under the eaves, rafters,
// a painted beam, the name plaque, lacquered pillars on carved bases, timber-framed
// plaster walls, wind chimes at the roof corners, a stepped finial, the platform's
// stone balustrade and the sloped stair borders.
//
// The palette stays muted: soot-dark timber, faded teal and ochre paint, old red lacquer.

const m4 = new THREE.Matrix4();
const qq = new THREE.Quaternion();
const vA = new THREE.Vector3(), vB = new THREE.Vector3(), vS = new THREE.Vector3();
const Y = new THREE.Vector3(0, 1, 0);

/** An arm of a bracket set: a beam whose ends curve up underneath (2D profile, extruded). */
function armGeometry(len, h, depth) {
  const s = new THREE.Shape();
  const e = Math.min(0.16, len * 0.18);
  s.moveTo(-len / 2, h);
  s.lineTo(len / 2, h);
  s.lineTo(len / 2, h * 0.5);
  s.quadraticCurveTo(len / 2 - e * 0.15, 0, len / 2 - e, 0);
  s.lineTo(-len / 2 + e, 0);
  s.quadraticCurveTo(-len / 2 + e * 0.15, 0, -len / 2, h * 0.5);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 6 });
  g.translate(0, 0, -depth / 2);
  return g;
}

/** One bracket set (dougong), local: x along the wall, +z outward, y up from the beam top. */
function bracketSetGeometries() {
  const blocks = [], arms = [];
  const box = (w, h, d, x, y, z) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); blocks.push(b); };
  // big bearing block, its waist cut in
  box(0.36, 0.12, 0.36, 0, 0.06, 0);
  box(0.3, 0.08, 0.3, 0, 0.16, 0);
  // first tier: an arm along the wall and one reaching out
  const a1 = armGeometry(1.0, 0.13, 0.15); a1.translate(0, 0.2, 0); arms.push(a1);
  const o1 = armGeometry(1.0, 0.13, 0.15); o1.rotateY(Math.PI / 2); o1.translate(0, 0.2, 0.24); arms.push(o1);
  // small blocks on the arm ends
  for (const x of [-0.42, 0.42]) box(0.19, 0.1, 0.19, x, 0.38, 0);
  box(0.19, 0.1, 0.19, 0, 0.38, 0.66);
  box(0.2, 0.1, 0.2, 0, 0.38, 0);
  // second tier: a longer arm along the wall, and a cross arm at the outer end carrying the eave beam
  const a2 = armGeometry(1.45, 0.13, 0.15); a2.translate(0, 0.43, 0); arms.push(a2);
  const c2 = armGeometry(1.1, 0.13, 0.15); c2.translate(0, 0.43, 0.66); arms.push(c2);
  const o2 = armGeometry(1.25, 0.13, 0.15); o2.rotateY(Math.PI / 2); o2.translate(0, 0.43, 0.32); arms.push(o2);
  for (const x of [-0.64, 0.64]) box(0.18, 0.1, 0.18, x, 0.61, 0);
  for (const x of [-0.46, 0.46]) box(0.18, 0.1, 0.18, x, 0.61, 0.66);
  return { blocks: mergeGeometries(blocks), arms: mergeGeometries(arms) };
}

/** The painted main beam: faded teal ground, ochre cartouche, swirl rosettes at the ends. */
function beamTexture() {
  return makeCanvasTexture(1024, 96, (g, w, h) => {
    g.fillStyle = '#26332f'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#a58c5a'; g.lineWidth = 3;
    g.strokeRect(6, 8, w - 12, h - 16);
    // central cartouche
    g.fillStyle = '#5e4c30';
    g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.2, h * 0.32, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#b39a63'; g.lineWidth = 2.5;
    g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.2, h * 0.32, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.17, h * 0.22, 0, 0, Math.PI * 2); g.stroke();
    // bands
    for (const x of [w * 0.26, w * 0.74]) {
      g.fillStyle = '#3b4f49'; g.fillRect(x - 16, 10, 32, h - 20);
      g.strokeStyle = '#a58c5a'; g.lineWidth = 2; g.strokeRect(x - 16, 10, 32, h - 20);
    }
    // swirl rosettes toward both ends
    const rosette = (cx) => {
      for (const [r, c] of [[34, '#4d665e'], [26, '#2b3934'], [18, '#7d6a45'], [9, '#2b3934']]) {
        g.fillStyle = c; g.beginPath(); g.arc(cx, h / 2, r, 0, Math.PI * 2); g.fill();
      }
      g.strokeStyle = '#b39a63'; g.lineWidth = 1.5;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        g.beginPath();
        g.arc(cx + Math.cos(a) * 22, h / 2 + Math.sin(a) * 22, 10, a + 1.2, a + 4.2);
        g.stroke();
      }
    };
    for (const cx of [w * 0.1, w * 0.9]) rosette(cx);
    // wear
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '220,210,190'},${Math.random() * 0.08})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 4, 1 + Math.random() * 3);
    }
  });
}

/** The name plaque, written once the calligraphy font is available. */
function plaqueTexture(text) {
  const tex = makeCanvasTexture(256, 448, () => {});
  const draw = () => {
    const c = tex.image, g = c.getContext('2d'), w = c.width, h = c.height;
    g.fillStyle = '#1a1714'; g.fillRect(0, 0, w, h);
    // carved frame
    g.strokeStyle = '#8a7144'; g.lineWidth = 10; g.strokeRect(14, 14, w - 28, h - 28);
    g.strokeStyle = '#4a3c25'; g.lineWidth = 3; g.strokeRect(34, 34, w - 68, h - 68);
    g.fillStyle = '#c4a160';
    g.font = '150px "Ma Shan Zheng", "Noto Serif SC", serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    const chars = [...text];
    chars.forEach((ch, i) => g.fillText(ch, w / 2, h / 2 + (i - (chars.length - 1) / 2) * 168));
    // age
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.18})`;
      g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 5, 1 + Math.random() * 2);
    }
    tex.needsUpdate = true;
  };
  draw();
  if (document.fonts && document.fonts.load) document.fonts.load('150px "Ma Shan Zheng"', text).then(draw, () => {});
  return tex;
}

export function addTempleDetail({ scene, temple, roof, roofThick, cz, fy, fz, backZ, hallW, hallD, wallH, darkWood, woodTex, platform }) {
  const updaters = [];
  const parts = { plaque: null, chimes: [] }; // pieces the repair quest takes away and brings back
  const paint = new THREE.MeshStandardMaterial({ color: 0x4f655d, roughness: 0.85 });
  const ochre = new THREE.MeshStandardMaterial({ color: 0x7a6542, roughness: 0.8 });

  // ---------- bracket sets on the beam top, all round the hall ----------
  {
    const { blocks, arms } = bracketSetGeometries();
    const spots = [];
    const yB = fy + wallH + 0.06;
    for (const x of [-3.9, -2.67, -1.45, 0, 1.45, 2.67, 3.9]) spots.push([x, fz + 0.12, 0]);
    for (const x of [-3.9, -1.95, 0, 1.95, 3.9]) spots.push([x, backZ, Math.PI]);
    for (const sx of [-1, 1]) for (const z of [backZ + 1.3, cz - 0.9, cz + 0.9, fz - 1.15]) spots.push([sx * hallW / 2, z, sx * Math.PI / 2]);
    const bI = new THREE.InstancedMesh(blocks, darkWood, spots.length);
    const aI = new THREE.InstancedMesh(arms, paint, spots.length);
    spots.forEach(([x, z, ry], i) => {
      qq.setFromAxisAngle(Y, ry);
      m4.compose(vA.set(x, yB, z), qq, vS.set(1, 1, 1));
      bI.setMatrixAt(i, m4); aI.setMatrixAt(i, m4);
    });
    for (const im of [bI, aI]) { im.castShadow = true; im.receiveShadow = true; temple.add(im); }
    // panels between the bracket sets close the band above the beams
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x1b1e1a, roughness: 1 });
    const panel = (w, d, x, z) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, 0.72, d), panelMat);
      p.position.set(x, yB + 0.36, z);
      temple.add(p);
    };
    panel(hallW, 0.08, 0, fz + 0.06);
    panel(hallW, 0.08, 0, backZ);
    panel(0.08, hallD, -hallW / 2, cz);
    panel(0.08, hallD, hallW / 2, cz);
    // eave beam carried by the outer arms
    const eave = new THREE.MeshStandardMaterial({ color: 0x23261f, roughness: 0.9 });
    const eb = (w, d, x, z) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.16, d), eave); b.position.set(x, yB + 0.74, z); b.castShadow = true; temple.add(b); };
    eb(hallW + 1.5, 0.18, 0, fz + 0.78);
    eb(hallW + 1.5, 0.18, 0, backZ - 0.66);
    eb(0.18, hallD + 1.5, -hallW / 2 - 0.66, cz);
    eb(0.18, hallD + 1.5, hallW / 2 + 0.66, cz);
  }

  // ---------- rafters under the eaves, with painted ends ----------
  {
    const raf = new THREE.CylinderGeometry(0.045, 0.045, 1, 8);
    const capG = new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10);
    const n = 4 * 44;
    const rI = new THREE.InstancedMesh(raf, darkWood, n);
    const cI = new THREE.InstancedMesh(capG, ochre, n);
    let k = 0;
    const off = -roofThick - 0.05;
    for (let s = 0; s < 4; s++) {
      const half = s % 2 === 0 ? 6.4 : 5.7;
      const step = 0.3 / half;
      for (let u = -0.86; u <= 0.86 + 1e-6; u += step) {
        const p0 = roof.surf(s, u, 0.004, off), p1 = roof.surf(s, u, 0.3, off);
        vA.set(p0[0], p0[1], p0[2] + cz); vB.set(p1[0], p1[1], p1[2] + cz);
        const len = vA.distanceTo(vB);
        const dir = vB.clone().sub(vA).normalize();
        qq.setFromUnitVectors(Y, dir);
        m4.compose(vS.copy(vA).addScaledVector(dir, len / 2), qq, new THREE.Vector3(1, len, 1));
        rI.setMatrixAt(k, m4);
        m4.compose(vS.copy(vA).addScaledVector(dir, -0.01), qq, new THREE.Vector3(1, 1, 1));
        cI.setMatrixAt(k, m4);
        if (++k >= n) break;
      }
    }
    rI.count = cI.count = k;
    rI.castShadow = true;
    temple.add(rI, cI);
  }

  // ---------- painted main beam over the facade ----------
  {
    const tex = beamTexture();
    const beamMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(hallW + 0.6, 0.34, 0.38), [darkWood, darkWood, darkWood, darkWood, beamMat, darkWood]);
    beam.position.set(0, fy + wallH - 0.1, fz + 0.13);
    beam.castShadow = true;
    temple.add(beam);
  }

  // ---------- the name plaque ----------
  {
    // the gilded characters catch the lantern light, so they glow faintly
    const ptex = plaqueTexture('雪寺');
    const face = new THREE.MeshStandardMaterial({ map: ptex, emissiveMap: ptex, emissive: 0xc99a55, emissiveIntensity: 0.55, roughness: 0.6, metalness: 0.1 });
    const frame = new THREE.MeshStandardMaterial({ color: 0x2a2219, roughness: 0.7 });
    const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.86, 0.07), [frame, frame, frame, frame, face, frame]);
    // hung on the eave beam, in front of the bracket sets
    plaque.position.set(0, fy + wallH + 0.1, fz + 0.9); // clear of the eave above and the rope below
    plaque.rotation.x = 0.1; // hung leaning forward, as plaques are
    plaque.castShadow = true;
    temple.add(plaque);
    parts.plaque = plaque;
  }

  // ---------- lacquered pillars on carved stone bases ----------
  {
    const lacquer = new THREE.MeshStandardMaterial({ color: 0xa06a5a, map: woodTex, roughness: 0.55 });
    const pillarGeo = new THREE.CylinderGeometry(0.17, 0.19, wallH, 18);
    const baseProfile = [[0.36, 0], [0.38, 0.05], [0.38, 0.1], [0.34, 0.14], [0.3, 0.2], [0.25, 0.24], [0.21, 0.26], [0, 0.26]]
      .map(([r, y]) => new THREE.Vector2(r, y));
    const baseGeo = new THREE.LatheGeometry(baseProfile, 24);
    const baseMat = snowyMaterial({ color: 0x6f776f, threshold: 0.55, softness: 0.06, noiseScale: 3 });
    const ringGeo = new THREE.TorusGeometry(0.185, 0.02, 6, 20);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x5c4b2e, metalness: 0.5, roughness: 0.5 });
    for (const x of [-hallW / 2, -1.45, 1.45, hallW / 2]) {
      const pl = new THREE.Mesh(pillarGeo, lacquer);
      pl.position.set(x, fy + wallH / 2, fz + 0.12);
      pl.castShadow = true;
      temple.add(pl);
      const b = new THREE.Mesh(baseGeo, baseMat);
      b.position.set(x, fy, fz + 0.12);
      b.castShadow = b.receiveShadow = true;
      temple.add(b);
      // a bronze band near the foot
      const rg = new THREE.Mesh(ringGeo, ringMat);
      rg.rotation.x = Math.PI / 2;
      rg.position.set(x, fy + 0.42, fz + 0.12);
      temple.add(rg);
    }
  }

  // ---------- timber-framed plaster on the side and back walls ----------
  {
    // old lime plaster: warm grey, grimier toward the bottom, streaked where meltwater ran
    const plasterTex = makeCanvasTexture(256, 256, (g, w, h) => {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#8a8274'); grd.addColorStop(0.7, '#7a7265'); grd.addColorStop(1, '#5f584d');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        const x = Math.random() * w;
        g.strokeStyle = `rgba(40,34,26,${0.04 + Math.random() * 0.07})`;
        g.lineWidth = 2 + Math.random() * 6;
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 6, h * (0.2 + Math.random() * 0.6)); g.stroke();
      }
      for (let i = 0; i < 1600; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? '30,26,20' : '200,192,176'},${Math.random() * 0.07})`;
        g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 3, 1 + Math.random() * 3);
      }
    });
    const plaster = new THREE.MeshStandardMaterial({ color: 0xb5ab9c, map: plasterTex, roughness: 0.97 });
    const box = (w, h, d, x, y, z, mat) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; temple.add(b);
    };
    for (const sx of [-1, 1]) {
      const x = sx * hallW / 2;
      box(0.2, wallH - 0.9, hallD - 0.2, x, fy + 0.9 + (wallH - 0.9) / 2, cz, plaster);
      box(0.3, 0.9, hallD, x, fy + 0.45, cz, darkWood); // wainscot
      box(0.32, 0.14, hallD, x, fy + 0.95, cz, darkWood); // waist rail
      box(0.34, 0.26, hallD + 0.3, x, fy + wallH - 0.12, cz, darkWood); // head beam
      for (const z of [backZ + 0.1, cz - 1.6, cz, cz + 1.6]) box(0.32, wallH, 0.24, x, fy + wallH / 2, z, darkWood);
    }
    box(hallW - 0.2, wallH - 0.9, 0.2, 0, fy + 0.9 + (wallH - 0.9) / 2, backZ, plaster);
    box(hallW, 0.9, 0.3, 0, fy + 0.45, backZ, darkWood);
    box(hallW, 0.14, 0.32, 0, fy + 0.95, backZ, darkWood);
    box(hallW + 0.3, 0.26, 0.34, 0, fy + wallH - 0.12, backZ, darkWood);
    for (const x of [-1.95, 0, 1.95]) box(0.24, wallH, 0.32, x, fy + wallH / 2, backZ, darkWood);
  }

  // ---------- wind chimes at the four roof corners ----------
  {
    const bronze = new THREE.MeshStandardMaterial({ color: 0x5f5236, metalness: 0.6, roughness: 0.45 });
    const bellGeo = new THREE.LatheGeometry([[0, 0.16], [0.03, 0.16], [0.05, 0.12], [0.06, 0.04], [0.08, 0], [0.0, 0.0]].map(([x, y]) => new THREE.Vector2(x, y)), 16);
    const chainGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4);
    const leafGeo = new THREE.PlaneGeometry(0.07, 0.14);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x6a5a3a, metalness: 0.5, roughness: 0.5, side: THREE.DoubleSide });
    for (let s = 0; s < 4; s++) {
      const p = roof.surf(s, 1, 0.01, -roofThick);
      const pivot = new THREE.Group();
      pivot.position.set(p[0] * 0.985, p[1] - 0.02, p[2] * 0.985 + cz);
      const chain = new THREE.Mesh(chainGeo, darkWood); chain.position.y = -0.15;
      const bell = new THREE.Mesh(bellGeo, bronze); bell.position.y = -0.46; bell.castShadow = true;
      const leaf = new THREE.Mesh(leafGeo, leafMat); leaf.position.y = -0.6;
      pivot.add(chain, bell, leaf);
      // the cast bronze bell replaces the turned one once it loads
      propModel('bell', { height: 0.3, anchor: 'top' }).then((m) => {
        m.position.y = -0.29;
        pivot.add(m);
        bell.visible = false;
        leaf.position.y = -0.68;
      }).catch(() => {});
      temple.add(pivot);
      parts.chimes.push(pivot);
      const ph = s * 1.7;
      updaters.push((t) => {
        chain.visible = !pivot.userData.loose; // only hangs from something when it is home
        if (pivot.userData.loose) return; // fallen into the snow (or flying home)
        pivot.rotation.z = Math.sin(t * 1.3 + ph) * 0.08 + Math.sin(t * 3.1 + ph) * 0.02;
        pivot.rotation.x = Math.sin(t * 1.1 + ph * 2) * 0.06;
        leaf.rotation.y = Math.sin(t * 2.2 + ph) * 0.8;
      });
    }
  }

  // ---------- stepped finial on the peak ----------
  {
    const bronze = new THREE.MeshStandardMaterial({ color: 0x3e3829, metalness: 0.55, roughness: 0.5 });
    const prof = [[0.0, 0], [0.2, 0], [0.22, 0.06], [0.16, 0.12], [0.27, 0.22], [0.29, 0.3], [0.2, 0.4], [0.08, 0.46], [0.08, 0.52],
      [0.17, 0.55], [0.08, 0.6], [0.15, 0.64], [0.07, 0.69], [0.13, 0.73], [0.06, 0.78], [0.06, 0.82], [0.13, 0.88], [0.15, 0.96],
      [0.1, 1.06], [0.03, 1.12], [0.02, 1.4], [0, 1.45]].map(([x, y]) => new THREE.Vector2(x, y));
    const fin = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), bronze);
    fin.position.set(0, roof.peakY + 0.42, cz);
    fin.castShadow = true;
    temple.add(fin);
  }

  // ---------- platform: stone coping, balustrade, stair borders ----------
  {
    const { halfW, frontZ, backZ: pBack, topY, stairHalf, stairBottomZ } = platform;
    const coping = snowyMaterial({ color: 0x737c74, threshold: 0.6, softness: 0.06, noiseScale: 2.2, noiseAmt: 0.4, variation: 0.15 });
    const add = (geo, mat, x, y, z) => { const b = new THREE.Mesh(geo, mat); b.position.set(x, y, z); b.castShadow = b.receiveShadow = true; scene.add(b); return b; };
    // coping course round the top edge, leaving the stairs open
    const cw = halfW - stairHalf - 0.4;
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(cw, 0.16, 0.5), coping, sx * (stairHalf + 0.4 + cw / 2 + 0.06), topY - 0.07, frontZ - 0.19);
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.5, 0.16, frontZ - pBack + 0.12), coping, sx * (halfW - 0.19), topY - 0.07, (frontZ + pBack) / 2);
    // balustrade: snow-capped posts with two rails
    const postGeo = new THREE.BoxGeometry(0.2, 0.7, 0.2);
    const knobGeo = new THREE.SphereGeometry(0.11, 10, 8);
    const railGeo = new THREE.BoxGeometry(1, 1, 1);
    const posts = [], rails = [];
    const run = (x0, z0, x1, z1) => {
      const len = Math.hypot(x1 - x0, z1 - z0);
      const n = Math.max(1, Math.round(len / 1.1));
      for (let i = 0; i <= n; i++) posts.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n]);
      rails.push([x0, z0, x1, z1, len]);
    };
    const inset = 0.18;
    for (const sx of [-1, 1]) {
      run(sx * (stairHalf + 0.5), frontZ - inset, sx * (halfW - inset), frontZ - inset);
      run(sx * (halfW - inset), frontZ - inset, sx * (halfW - inset), pBack + 0.4);
    }
    const pI = new THREE.InstancedMesh(postGeo, coping, posts.length);
    const kI = new THREE.InstancedMesh(knobGeo, coping, posts.length);
    posts.forEach(([x, z], i) => {
      m4.makeTranslation(x, topY + 0.35, z); pI.setMatrixAt(i, m4);
      m4.makeTranslation(x, topY + 0.78, z); kI.setMatrixAt(i, m4);
    });
    const rI = new THREE.InstancedMesh(railGeo, coping, rails.length * 2);
    let ri = 0;
    for (const [x0, z0, x1, z1, len] of rails) {
      qq.setFromAxisAngle(Y, Math.atan2(-(z1 - z0), x1 - x0));
      for (const [y, h, d] of [[0.6, 0.1, 0.14], [0.18, 0.08, 0.1]]) {
        m4.compose(vA.set((x0 + x1) / 2, topY + y, (z0 + z1) / 2), qq, vS.set(len, h, d));
        rI.setMatrixAt(ri++, m4);
      }
    }
    for (const im of [pI, kI, rI]) { im.castShadow = true; im.receiveShadow = true; scene.add(im); }

    // sloped stone borders along both sides of the stairs
    const sh = new THREE.Shape();
    sh.moveTo(stairBottomZ + 0.35, -0.3);
    sh.lineTo(stairBottomZ + 0.35, 0.16);
    sh.lineTo(-0.05, topY + 0.14);
    sh.lineTo(frontZ - 0.05, topY + 0.14);
    sh.lineTo(frontZ - 0.05, -0.3);
    sh.closePath();
    const bw = 0.42;
    const borderGeo = new THREE.ExtrudeGeometry(sh, { depth: bw, bevelEnabled: false });
    borderGeo.rotateY(-Math.PI / 2); // shape x -> world z, extrusion -> world -x
    for (const sx of [-1, 1]) {
      const b = add(borderGeo, coping, sx > 0 ? stairHalf + bw - 0.02 : -stairHalf + 0.02, 0, 0);
      b.userData.border = true;
    }
  }

  return { parts, update(t) { for (const f of updaters) f(t); } };
}
