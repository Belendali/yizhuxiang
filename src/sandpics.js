// The children's pictures in the sand, little ones drawn the way ink paintings are: 山水, 锦鲤, 荷花, 竹.
// Each is authored as SVG-like path strings in its own little canvas (x right, y down = toward
// the viewer, the way the traveler and the camera see it), then sampled into strokes in metres
// around the picture's centre: [x right, y toward the viewer]. Strokes are drawn in order.

const STEP = 0.012; // metres between sampled points

/** Sample one path ("M x y L .. C .. Q .. Z", absolute) into point lists (one per subpath). */
function sample(d, step, tf) {
  const tok = d.match(/[MLCQZ]|-?\d*\.?\d+/g);
  const out = [];
  let cur = null, x = 0, y = 0, sx = 0, sy = 0, i = 0, cmd = '';
  const num = () => parseFloat(tok[i++]);
  const push = (px, py) => cur.push(tf(px, py));
  const curve = (pts) => {
    // a rough length for the point count, then evenly in t
    let len = 0;
    for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
    const n = Math.max(2, Math.ceil(len / step));
    for (let k = 1; k <= n; k++) {
      const t = k / n, u = 1 - t;
      let px, py;
      if (pts.length === 4) {
        px = u * u * u * pts[0][0] + 3 * u * u * t * pts[1][0] + 3 * u * t * t * pts[2][0] + t * t * t * pts[3][0];
        py = u * u * u * pts[0][1] + 3 * u * u * t * pts[1][1] + 3 * u * t * t * pts[2][1] + t * t * t * pts[3][1];
      } else if (pts.length === 3) {
        px = u * u * pts[0][0] + 2 * u * t * pts[1][0] + t * t * pts[2][0];
        py = u * u * pts[0][1] + 2 * u * t * pts[1][1] + t * t * pts[2][1];
      } else { px = pts[0][0] + (pts[1][0] - pts[0][0]) * t; py = pts[0][1] + (pts[1][1] - pts[0][1]) * t; }
      push(px, py);
    }
  };
  while (i < tok.length) {
    if (/[MLCQZ]/.test(tok[i])) cmd = tok[i++];
    if (cmd === 'M') { x = sx = num(); y = sy = num(); cur = []; out.push(cur); push(x, y); cmd = 'L'; }
    else if (cmd === 'L') { const nx = num(), ny = num(); curve([[x, y], [nx, ny]]); x = nx; y = ny; }
    else if (cmd === 'C') { const p = [[x, y], [num(), num()], [num(), num()], [num(), num()]]; curve(p); [x, y] = p[3]; }
    else if (cmd === 'Q') { const p = [[x, y], [num(), num()], [num(), num()]]; curve(p); [x, y] = p[2]; }
    else if (cmd === 'Z') { curve([[x, y], [sx, sy]]); x = sx; y = sy; cmd = ''; }
    else i++;
  }
  return out.filter((s) => s.length > 1);
}

const circ = (cx, cy, r) => {
  const k = 0.5523 * r;
  return `M${cx + r} ${cy} C${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} C${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} C${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} C${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy}`;
};

/**
 * Build a picture. `size`: metres per 100 units; `parts`: [d, transform?] where transform is
 * {x, y, r (degrees), s, bend (radius; bends the part along an arc), fx (mirror)}.
 */
function picture(name, w, h, size, parts, weight = 0.24) {
  const k = size / 100, step = STEP / k;
  const strokes = [];
  for (const [d, t = {}] of parts) {
    const { x = 0, y = 0, r = 0, s = 1, bend = 0, fx = false } = t;
    const c = Math.cos(r * Math.PI / 180), sn = Math.sin(r * Math.PI / 180);
    const tf = (px, py) => {
      if (fx) px = -px;
      if (bend) { const a = px / bend, rr = bend - py; px = rr * Math.sin(a); py = bend - rr * Math.cos(a); }
      px *= s; py *= s;
      const X = x + px * c - py * sn, Y = y + px * sn + py * c;
      return [(X - w / 2) * k, (Y - h / 2) * k];
    };
    strokes.push(...sample(d, step / s, tf));
  }
  return { name, w: w * k, h: h * k, weight, strokes };
}

// They are drawn with a finger, so each is a handful of strokes, about a hand-span across.
const SIZE = 0.27; // metres per 100 units

// ---- 山水: two peaks, water below, a sun and a pair of birds
const shanshui = picture('shanshui', 100, 100, SIZE, [
  ['M4 70 C16 58 24 46 34 40 C42 48 46 54 52 56 C60 40 68 24 78 16 C86 30 92 48 98 62'],
  ['M10 82 C30 76 50 78 70 82'], ['M44 93 C60 89 76 91 92 93'],
  [circ(22, 20, 7)],
  ['M50 24 Q54 19 58 24 Q62 19 66 24'],
]);

// ---- 锦鲤: a little fish, its eye, a fin, a bubble and a ripple
const koi = picture('koi', 100, 100, SIZE, [
  ['M84 45 C76 32 52 29 34 38 C27 41 23 44 21 45 C23 46 27 49 34 52 C52 61 76 58 84 45'],
  ['M22 45 C14 36 8 31 3 33 C7 40 7 50 3 57 C8 59 14 54 22 45'],
  [circ(72, 42, 2.6)],
  ['M50 33 C47 25 41 22 35 24'],
  [circ(91, 26, 3.2)],
  ['M22 78 C40 71 58 71 76 78'],
]);

// ---- 荷花: a lotus flower on its stem, a leaf, water
const lotus = picture('lotus', 100, 100, SIZE, [
  ['M50 46 C43 36 43 24 50 12 C57 24 57 36 50 46'],
  ['M48 46 C36 42 29 32 29 21 C40 25 46 34 48 46'], ['M52 46 C64 42 71 32 71 21 C60 25 54 34 52 46'],
  ['M50 46 C52 62 48 78 50 94'],
  ['M57 80 C62 67 83 63 94 74 C89 87 67 91 57 80'],
  ['M6 94 C22 88 38 88 54 94'],
]);

// ---- 竹: one stem with its joints, a few leaves, the moon
const LEAF = 'M0 0 C10 -4 22 -4 32 0 C22 3 10 3 0 0';
const bamboo = picture('bamboo', 100, 100, SIZE, [
  ['M40 97 L41 75'], ['M41 72 L43 51'], ['M43 48 L45 28'], ['M45 25 L46 8'],
  ...[[45, 27, -30], [45, 27, -62], [43, 50, 205], [43, 50, 165], [46, 9, -40]].map(([x, y, r]) => [LEAF, { x, y, r, s: 0.9 }]),
  [circ(78, 22, 8)],
]);

export const PICS = { shanshui, koi, lotus, bamboo };
