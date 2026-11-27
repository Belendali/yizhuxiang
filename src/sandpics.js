// The children's pictures in the sand, small ones drawn the way ink paintings are: 山水, 锦鲤, 荷花, 竹.
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
function picture(name, w, h, size, parts, weight = 0.32) {
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

// ---- 山水: peaks with a few texture strokes, near hills, a pine, water, a little boat, birds, a sun
const shanshui = picture('shanshui', 220, 160, 0.3, [
  ['M8 112 C24 98 36 80 50 70 C58 76 62 84 70 86 C80 66 92 40 108 28 C118 46 126 62 140 70 C150 60 158 54 166 52 C178 66 194 86 214 100'],
  ['M106 36 C100 50 98 64 102 80'], ['M113 44 C118 56 116 66 123 78'], ['M98 52 C94 60 94 68 96 76'],
  ['M52 76 C49 84 51 90 56 98'], ['M164 58 C160 70 162 80 168 88'], ['M172 66 C172 74 176 80 182 86'],
  ['M4 128 C24 116 44 112 62 120 C76 112 92 110 108 118'],
  ['M118 112 C136 104 150 104 166 112'],
  ['M31 128 C33 114 29 100 33 86'],
  ['M17 96 C25 91 35 91 47 96'], ['M19 106 C27 101 37 101 46 106'], ['M21 116 C28 112 36 112 43 116'],
  ['M66 138 C86 133 102 139 122 135'], ['M118 148 C140 143 160 149 186 144'], ['M26 152 C44 148 58 152 76 149'],
  ['M124 122 C134 130 158 130 170 122'], ['M148 121 L148 111'], ['M142 111 L148 105 L154 111'], ['M156 117 L174 132'],
  [circ(184, 26, 11)],
  ['M50 36 Q54 30 58 36 Q62 30 66 36'], ['M72 24 Q75 20 78 24 Q81 20 84 24'],
]);

// ---- 锦鲤: one little koi turning (seen from above), a few ripples
const KOI = [
  'M42 0 C36 -9 12 -15 -8 -13 C-20 -11 -30 -6 -36 0 C-30 6 -20 11 -8 13 C12 15 36 9 42 0',
  'M-35 0 C-45 -10 -57 -20 -66 -17 C-60 -9 -57 -3 -61 3 C-57 9 -61 18 -67 21 C-57 23 -45 11 -35 0',
  'M22 -10 C20 -19 13 -24 7 -23', 'M22 10 C20 19 13 24 7 23',
  'M-8 -12 C-10 -17 -16 -18 -20 -16', 'M-8 12 C-10 17 -16 18 -20 16',
  'M4 -10 Q8 0 4 10',
  'M42 -2 C46 -5 48 -9 46 -12', 'M42 2 C46 5 48 9 46 12',
  circ(34, -5, 1.6), circ(34, 5, 1.6),
];
const koi = picture('koi', 200, 200, 0.25, [
  ...KOI.filter((d) => !/^M-8 /.test(d)).map((d) => [d, { x: 106, y: 92, r: -10, s: 1.5, bend: 170 }]),
  ['M28 168 C52 158 76 158 100 168'], ['M118 180 C138 172 158 172 178 180'],
  [circ(40, 60, 4)], [circ(30, 44, 2.6)],
]);

const lotus = picture('lotus', 200, 200, 0.25, [
  ['M100 80 C88 60 90 40 100 26 C110 40 112 60 100 80'],
  ['M98 80 C80 72 70 56 70 40 C84 46 94 60 98 80'], ['M102 80 C120 72 130 56 130 40 C116 46 106 60 102 80'],
  ['M96 82 C76 82 60 72 52 60 C70 60 86 68 96 82'], ['M104 82 C124 82 140 72 148 60 C130 60 114 68 104 82'],
  ['M100 82 C102 110 98 140 102 186'],
  ['M14 142 C18 120 54 110 80 122 C92 128 94 142 86 152 C66 168 26 166 14 142'],
  ['M52 140 L22 140'], ['M52 140 L36 120'], ['M52 140 L64 118'], ['M52 140 L84 136'], ['M52 140 L70 160'], ['M52 140 L34 160'],
  ['M146 186 C144 156 148 126 150 106'], ['M150 106 C142 98 144 86 152 80 C158 88 158 98 150 106'],
  ['M160 40 L184 28'], ['M168 36 C164 26 170 22 174 32'], ['M174 33 C172 22 178 20 180 30'], ['M168 37 C170 46 176 46 174 36'],
  ['M110 192 C130 186 150 186 170 192'], ['M30 186 C46 181 62 181 78 186'],
]);

// ---- 竹: two stems with their joints, sprays of leaves, a moon
const LEAF = 'M0 0 C10 -4 22 -4 32 0 C22 3 10 3 0 0';
const stem = (x0, x1, top, segs) => {
  const out = [];
  const len = (190 - top) / segs;
  for (let i = 0; i < segs; i++) {
    const ya = 190 - i * len, yb = ya - len + 4, xa = x0 + (x1 - x0) * i / segs, xb = x0 + (x1 - x0) * (i + 1) / segs;
    out.push([`M${xa} ${ya} L${xb} ${yb}`], [`M${xb - 5} ${yb - 1} L${xb + 5} ${yb - 1}`]);
  }
  return out;
};
const bamboo = picture('bamboo', 200, 200, 0.25, [
  ...stem(70, 78, 18, 5), ...stem(116, 110, 46, 4),
  ...[[78, 60, -30], [78, 60, -60], [78, 60, 10], [76, 100, 200], [76, 100, 160], [76, 100, 220],
    [111, 80, -20], [111, 80, 20], [111, 80, -50], [112, 120, 190], [112, 120, 150]].map(([x, y, r]) => [LEAF, { x, y, r, s: 1.1 }]),
  ['M78 60 L96 46'], ['M111 80 L128 70'],
  [circ(160, 40, 14)],
]);

export const PICS = { shanshui, koi, lotus, bamboo };
