const floor = x => Math.floor(x);
const sqrt = x => Math.sqrt(x);
const pow = (x, p) => Math.pow(x, 2);
const min = x => Math.min(x);
const max = x => Math.max(x);

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
const getOccupiedCenter = () => {
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
  const stepSpace = max(w, h) / 2 - halfSize - pad;
  const steps = floor(stepSpace / (size + pad));
  let lpr = pr(0); // Last pad radius.
  for (let i = 1; i <= steps; i++) {
    const x = i * (size + pad);
    points.push(...four({ x, y: 0 })); // Paint points on main axes.
    if ((x - halfDiag) >= lpr) {
      points.push(...inter({ x: 0, y: x }, { x, y: 0 }).map(four));
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

console.log(getRayPattern(100, 40, 10, 2));

// construct background pattern
// display standby animation
// attach single global hover listener for a tags to check their href
// display the respective symbol on hover
