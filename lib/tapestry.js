const abs = x => Math.abs(x);
const floor = x => Math.floor(x);
const sqrt = x => Math.sqrt(x);
const pow = (x, p) => Math.pow(x, 2);
const min = (...n) => Math.min(...n);
const max = (...n) => Math.max(...n);

const symbolsByHref = {
  'sera.bio': `
  <svg viewBox="0 0 220 390">
    <g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
      <g transform="translate(-120.000000, -21.000000)" stroke="#000000" stroke-width="24">
        <path d="M229.831461,42.6997687 C227.608873,46.1404387 225.272621,49.8111596 222.840306,53.6947551 C210.124079,73.9983305 197.405539,95.8996571 185.546798,118.549852 C170.870613,146.581366 158.569193,173.774199 149.424249,199.321513 C138.079071,231.015403 132,259.08369 132,282.398876 C132,325.751473 145.751267,356.691823 169.48237,376.750256 C187.526579,392.001909 210.915956,400 229.831461,400 C248.746966,400 272.136342,392.001909 290.180551,376.750256 C313.911655,356.691823 327.662921,325.751473 327.662921,282.398876 C327.662921,259.08369 321.58385,231.015403 310.238672,199.321513 C301.093729,173.774199 288.792309,146.581366 274.116123,118.549852 C262.257382,95.8996571 249.538842,73.9983305 236.822615,53.6947551 C234.390301,49.8111596 232.054049,46.1404387 229.831461,42.6997687 Z" />
      </g>
    </g>
  </svg>
  `
};

const root = document.documentElement;
const width = max(root.clientWidth, window.innerWidth || 0);
const height = max(root.clientHeight, window.innerHeight || 0);

// Returns object { left, right, top, bottom }.
const getOccupiedSpace = () => {
  const getRect = el => el.getBoundingClientRect();
  const topLevelRects = Array.from(document.body.children).map(getRect);
  let left, right, top, bottom;
  topLevelRects.forEach(r => {
    if (!r.left && !r.right && !r.top && !r.bottom) return;
    left = left ? min(left, r.left) : r.left;
    right = right ? max(right, r.right) : r.right;
    top = top ? min(top, r.top) : r.top;
    bottom = bottom ? max(bottom, r.bottom) : r.bottom;
  });
  return { left, right, top, bottom };
};

// Params width, height, square size, padding between. Centered at { 0, 0 }.
// Returns array of objects { x, y } for square centers to fill the space.
const getRayPattern = (w, h, size, pad) => {
  const halfSize = size / 2;
  const halfDiag = sqrt(2 * pow(halfSize, 2));

  // Pad radius, outermost line of a ring.
  const pr = x => sqrt(pow(x + halfSize + pad, 2) + pow(halfSize + pad, 2));

  // Opposite coordinates in all quadrants.
  const four = ({ x, y }) => [
    { x: x, y: y }, { x: -x || 0, y: -y || 0 }, // Avoid -0.
    { x: -y || 0, y: x }, { x: y, y: -x || 0 }
  ];

  // Check intermediary positions between two points on the same circle.
  const inter = (p1, p2) => {
    const r = sqrt(pow(p1.x, 2) + pow(p1.y, 2)); // Circle radius.
    const a = (p1.y + p2.y) / (p1.x + p2.x); // Bisector slope.
    const x = r / sqrt(1 + pow(a, 2));
    const y = a * x;
    const d = sqrt(pow(x - p1.x, 2) + pow(p1.y - y, 2)); // Point distance.
    if (d < 2 * halfDiag + pad) return []; // No space.
    const p = { x, y };
    return [p, ...inter(p1, p), ...inter(p, p2)];
  };

  // Fill square space.
  let points = [{ x: 0, y: 0 }];
  const stepSpace = max(w, h) / 2 + 2 * (size + pad); // Run over, will be trimmed.
  const steps = floor(stepSpace / (size + pad));
  let lpr = pr(0); // Last pad radius.
  for (let i = 1; i <= steps; i++) {
    const x = i * (size + pad);
    if ((x - halfDiag) >= lpr) {
      points.push(...four({ x, y: 0 })); // Paint points on main axes.
      const fours = inter({ x: 0, y: x }, { x, y: 0 }).map(four);
      fours.forEach(f => points.push(...f));
      lpr = pr(x);
    }
  }

  // Crop points to given bounds.
  const lW = w / 2 - pad - halfSize;
  const lH = h / 2 - pad - halfSize;
  const inside = p => p.x >= -lW && p.x <= lW && p.y >= -lH && p.y <= lH;
  points = points.filter(inside);

  return points;
};

// Param point object with { x, y } around the center of the canvas.
// Returns positioned element with coordinates translated to top-left.
const makeElement = (point, w, h, size) => {
  const el = document.createElement('div');
  el.style.cssText = `
    position: absolute;
    top: ${point.y + h / 2 - size / 2}px;
    left: ${point.x + w / 2 - size / 2}px;
    width: ${size}px;
    height: ${size}px;
    background-color: #eee;
  `;
  return el;
};

const canvas = document.createElement('div');
canvas.style.cssText = `
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
`;

const w = width;
const h = height;
const size = 16;
const pad = 16;
const ospad = 40;
const os = getOccupiedSpace();
const ost = os.top - ospad / 2;
const osl = os.left - ospad / 2;
const osw = os.right - os.left + ospad;
const osh = os.bottom - os.top + ospad;

// const el = document.createElement('div');
// el.style.cssText = `
//   position: absolute;
//   top: ${ost}px;
//   left: ${osl}px;
//   width: ${osw}px;
//   height: ${osh}px;
//   background-color: cyan;
//   z-index: -1;
// `;
// document.body.insertAdjacentElement('beforeend', el);

const oschw = osw / 2; // Occupied space centered half width.
const oschh = osh / 2; // Occupied space centered half height.
const oscwl = oschw + size / 2 + pad; // Occupied space centered width limit.
const oschl = oschh + size / 2 + pad; // Occupied space centered height limit.
const unoccupied = p => abs(p.x) >= oscwl || abs(p.y) >= oschl;
let points = getRayPattern(w, h, size, pad).filter(unoccupied);
const els = points.map(p => makeElement(p, w, h, size));

els.forEach(el => canvas.appendChild(el));
document.body.insertAdjacentElement('beforeend', canvas);

// construct background pattern
// display standby animation
// attach single global hover listener for a tags to check their href
// display the respective symbol on hover
