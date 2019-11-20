const abs = x => Math.abs(x);
const floor = x => Math.floor(x);
const ceil = x => Math.ceil(x);
const sqrt = x => Math.sqrt(x);
const pow = (x, p) => Math.pow(x, 2);
const min = (...n) => Math.min(...n);
const max = (...n) => Math.max(...n);
const rnd = () => Math.random();

const symbols = [{
  href: 'work/rhcp',
  svg: `
  <svg width="20" height="20" viewBox="0 0 20 20">
    <g fill="none" fill-rule="evenodd">
      <rect width="20" height="20" fill="#FFF"/>
      <path stroke="#E64646" d="M12.45 15.917V18.9a.6.6 0 0 1-.6.6h-3.7a.6.6 0 0 1-.6-.6v-2.983l-2.11 2.11a.6.6 0 0 1-.848 0l-2.617-2.618a.6.6 0 0 1 0-.849l2.109-2.109H1.1a.6.6 0 0 1-.6-.6V8.149a.6.6 0 0 1 .6-.6h2.983l-2.11-2.11a.6.6 0 0 1 0-.848l2.618-2.617a.6.6 0 0 1 .849 0l2.109 2.109V1.1a.6.6 0 0 1 .6-.6h3.702a.6.6 0 0 1 .6.6v2.983l2.11-2.11a.6.6 0 0 1 .848 0l2.617 2.618a.6.6 0 0 1 0 .849l-2.109 2.11H18.9a.6.6 0 0 1 .6.6v3.701a.6.6 0 0 1-.6.6h-2.983l2.11 2.11a.6.6 0 0 1 0 .848l-2.618 2.617a.6.6 0 0 1-.849 0l-2.11-2.109z"/>
    </g>
  </svg>
`}, {
  href: 'generic-slash',
  svg: `
  <svg width="20" height="20" viewBox="0 0 20 20">
    <g fill="none" fill-rule="evenodd">
      <rect width="20" height="20" fill="#FFF"/>
      <path stroke="#E7E100" d="M2.5 9.216v5.318l15-3.75V5.466l-15 3.75z"/>
    </g>
  </svg>
`}, {
  href: 'generic-triangle',
  svg: `
  <svg width="20" height="20" viewBox="0 0 20 20">
    <g fill="none" fill-rule="evenodd">
      <rect width="20" height="20" fill="#FFF"/>
      <path stroke="#7ABCF5" d="M4.782 14.207a.2.2 0 0 0 .177.293h10.082a.2.2 0 0 0 .177-.293L10.177 4.63a.2.2 0 0 0-.354 0l-5.04 9.577z"/>
    </g>
  </svg>
`}];

const css = `
  [component="tapestry"] {
    position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1;
  }
  [component="tapestry"] .point {
    position: absolute;
  }
  [component="tapestry"] .point .symbol {
    opacity: 0.001; /* Quirk: Not quite 0 to keep layer primed for animation. */
    position: absolute;
    top: 0;
    transition-property: opacity;
    transition-duration: 2s;
    transition-timing-function: ease-in-out;
    will-change: opacity;
  }
`;

class Tapestry {
  constructor(el) {
    this._size = 20; // Point size.
    this._pad = 14; // Padding around points.
    this._ospad = 30; // Padding around occupied space.
    this._root = document.documentElement; // Global page root element.
    this._width = null; // Global page width.
    this._height = null; // Global page height.
    this._canvas = el; // Use the component root as a canvas to paint on.
    this._els = null; // Elements on canvas.
    this._standbyIid = null; // Interval id if standby animation is running.

    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);

    // Reinitialize on window resize.
    let debounceTid;
    window.addEventListener('resize', () => {
      if (this._els) {
        this._stopStandbyAnimation();
        this._els.forEach(el => this._canvas.removeChild(el));
        this._els = null;
      }

      if (debounceTid) window.clearTimeout(debounceTid);
      debounceTid = window.setTimeout(() => this._initialize(), 400);
    });

    // Stop work when window is not visible.
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this._stopStandbyAnimation();
      } else {
        this._startStandbyAnimation();
      }
    });

    this._initialize();
  }

  // Returns object { left, right, top, bottom }.
  _getOccupiedSpaceTotal() {
    const getRect = el => el.getBoundingClientRect();
    const topLevel = Array.from(document.body.children).map(getRect);
    const sized = topLevel.filter(r => r.left && r.top && r.width && r.height);
    let left, right, top, bottom;
    sized.forEach(r => {
      if (!r.left && !r.right && !r.top && !r.bottom) return;
      left = left ? min(left, r.left) : r.left;
      right = right ? max(right, r.right) : r.right;
      top = top ? min(top, r.top) : r.top;
      bottom = bottom ? max(bottom, r.bottom) : r.bottom;
    });
    return { left, right, top, bottom };
  }

  // Returns array of objects { left, right, top, bottom }.
  _getOccupiedSpaces() {
    const getRect = el => el.getBoundingClientRect();
    const topLevel = Array.from(document.body.children).map(getRect);
    const sized = topLevel.filter(r => r.left && r.top && r.width && r.height);
    const rs = sized.map(r => ({
      left: r.left, right: r.right, top: r.top, bottom: r.bottom
    }));
    const fillers = [];
    rs.forEach((r, i) => {
      if (!i) return;
      fillers.push({
        left: (r.left + rs[i-1].left) / 2,
        right: (r.right + rs[i-1].right) / 2,
        top: rs[i-1].bottom,
        bottom: r.top,
      });
    });
    return rs.concat(fillers);
  }

  // Params point { x, y }, occupied spaces array { left, right, top, bottom }.
  // Returns boolean.
  _pointOutsideOccupiedSpaces(p, oss) {
    const x = p.x + this._width / 2;
    const y = p.y + this._height / 2;
    const limLeft = x + this._size / 2 + this._pad + this._ospad;
    const limRight = x - this._size / 2 - this._pad - this._ospad;
    const limTop = y + this._size / 2 + this._pad + this._ospad;
    const limBottom = y - this._size / 2 - this._pad - this._ospad;
    const outsideX = (p, os) => limLeft <= os.left || limRight >= os.right;
    const outsideY = (p, os) => limTop <= os.top || limBottom >= os.bottom;
    return oss.every(os => outsideX(p, os) || outsideY(p, os));
  }

  // Params width, height, square size, padding between. Centered at { 0, 0 }.
  // Returns array of objects { x, y, i } to fill the space, i = ring index.
  _makeRayPattern() {
    const w = this._width;
    const h = this._height;
    const size = this._size;
    const pad = this._pad;
    const halfSize = size / 2;
    const halfDiag = sqrt(2 * pow(halfSize, 2));

    // Pad radius, outermost line of a ring.
    const pr = x => sqrt(pow(x + halfSize + pad, 2) + pow(halfSize + pad, 2));

    // Opposite coordinates in all quadrants.
    const four = ({ x, y, i }) => [
      { x: x, y: y, i }, { x: -x || 0, y: -y || 0, i }, // Avoid -0.
      { x: -y || 0, y: x, i }, { x: y, y: -x || 0, i }
    ];

    // Check intermediary positions between two points on the same circle.
    const inter = (p1, p2) => {
      const r = sqrt(pow(p1.x, 2) + pow(p1.y, 2)); // Circle radius.
      const a = (p1.y + p2.y) / (p1.x + p2.x); // Bisector slope.
      const x = r / sqrt(1 + pow(a, 2));
      const y = a * x;
      const d = sqrt(pow(x - p1.x, 2) + pow(p1.y - y, 2)); // Point distance.
      if (d < 2 * halfDiag + pad) return []; // No space.
      const p = { x, y, i: p1.i };
      return [p, ...inter(p1, p), ...inter(p, p2)];
    };

    // Fill space.
    let i = 0;
    let points = [{ x: 0, y: 0, i }];
    const stepSpace = (w + h) / 2; // Run over, will be cropped.
    const steps = floor(stepSpace / (size + pad));
    let lpr = pr(0); // Last pad radius.
    for (let j = 1; j <= steps; j++) {
      const x = j * (size + pad);
      if ((x - halfDiag) >= lpr) {
        i += 1;
        points.push(...four({ x, y: 0, i })); // Paint points on main axes.
        const fours = inter({ x: 0, y: x, i }, { x, y: 0, i }).map(four);
        fours.forEach(f => points.push(...f));
        lpr = pr(x);
      }
    }

    // Crop points to fit bounds.
    const lW = w / 2 - halfSize - 4; // A few pixels short of hitting side.
    const lH = h / 2 - halfSize - 4;
    const inside = p => p.x >= -lW && p.x <= lW && p.y >= -lH && p.y <= lH;
    points = points.filter(inside);

    return points;
  }

  // Params width, height, square size, padding between. Centered at { 0, 0 }.
  // Returns array of objects { x, y, i } to fill the space, i = ring index.
  _makeSquarePattern() {
    const w = this._width;
    const h = this._height;
    const size = this._size;
    const pad = this._pad;
    const full = size + pad;
    const diag = sqrt(2 * pow(full, 2));
    const halfSize = size / 2;
    const halfPad = pad / 2;
    const halfFull = full / 2;

    // Opposite coordinates in all quadrants.
    const four = ({ x, y, i }) => [
      { x: x, y: y, i }, { x: -x || 0, y: -y || 0, i }, // Avoid -0.
      { x: -y || 0, y: x, i }, { x: y, y: -x || 0, i }
    ];

    // Fill space.
    let points = [];
    const halfSquareSpaceDiag = sqrt(2 * pow(max(w, h), 2)) / 2;
    const stepSpace = ceil(halfSquareSpaceDiag / diag);
    for (let i = 0; i < stepSpace; i++) {
      const x = halfFull + i * full;
      points.push(...four({ x, y: x, i }));
      for (let j = x - full; j > 0; j -= full) {
        points.push(...four({ x, y: j, i }));
        points.push(...four({ x: j, y: x, i }));
      }
    }

    // Crop points to fit bounds.
    const lW = w / 2 - halfSize - halfPad; // A few pixels short of hitting side.
    const lH = h / 2 - halfSize - halfPad;
    const inside = p => p.x >= -lW && p.x <= lW && p.y >= -lH && p.y <= lH;
    points = points.filter(inside);

    return points;
  }

  // Params centered point { x, y, i }, canvas width and height, element size.
  // Returns positioned element with coordinates translated to top-left.
  _makePointElement(point) {
    const el = document.createElement('div');
    el.className = 'point';
    el.style.cssText = `
      top: ${point.y + this._height / 2 - this._size / 2}px;
      left: ${point.x + this._width / 2 - this._size / 2}px;
      width: ${this._size}px;
      height: ${this._size}px;
    `;
    el.point = point;
    el.nextTid = null;
    el.symbols = [];
    symbols.forEach(symbol => {
      const sel = document.createElement('div');
      sel.className = 'symbol';
      sel.innerHTML = symbol.svg;
      sel.href = symbol.href;
      el.symbols.push(sel);
      el.appendChild(sel);
    });
    return el;
  }

  _attachLinkListeners() {
    const hrefs = symbols.map(s => s.href);
    const qs = hrefs.map(s => `[href*="${s}"]`).join(',');
    const els = Array.from(document.querySelectorAll(qs));
    const findHref = elHref => hrefs.find(h => elHref.includes(h));
    let debounceTid;
    const debounce = cb => () => {
      if (debounceTid) window.clearTimeout(debounceTid);
      debounceTid = window.setTimeout(() => cb(), 400);
    };
    const over = el => {
      this._stopStandbyAnimation();
      this._animateBurst({ href: findHref(el.href) });
    };
    const out = () => {
      this._animateBurst();
      this._startStandbyAnimation();
    };
    els.forEach(el => {
      el.addEventListener('mouseover', debounce(() => over(el)));
      el.addEventListener('mouseout', debounce(() => out()));
    });
  }

  // Params element, transform CSS string, delay in seconds.
  _animatePointTransform(el, transform, delay) {
    if (el.nextTid) window.clearTimeout(nextTid);
    if (delay === undefined) delay = 0;
    window.setTimeout(() => el.style.transform = transform, delay * 1000);
  }

  // Params element, symbol href, opacity, delay in seconds.
  _animateSymbolOpacity(el, href, opacity, delay) {
    if (el.nextTid) window.clearTimeout(nextTid);
    if (opacity === 0) opacity = 0.001; // Quirk: Prime layer for animation.
    if (delay === undefined) delay = 0;
    window.setTimeout(() => el.symbols.forEach(symbol => {
      symbol.style.opacity = (symbol.href === href) ? opacity : 0.001;
    }), delay * 1000);
  }

  // Params symbol href, delay in seconds.
  _animateBurst({ href, delay } = {}) {
    if (!this._els) return;
    const hrefOrGen = () => href || symbols[floor(rnd() * symbols.length)].href;
    if (delay === undefined) delay = 0;
    const firstRing = this._els[0].point.i;
    const ring = el => el.point.i - firstRing;
    const opacity = () => rnd() * 0.7;
    window.setTimeout(() => this._els.forEach(el => this._animateSymbolOpacity(
      el, hrefOrGen(), opacity(), ring(el) * 0.02
    )), delay * 1000);
  }

  _animateStandby() {
    if (!this._els) return;
    const href = () => symbols[floor(rnd() * symbols.length)].href; // Generic.
    const opacity = () => rnd() * 0.7;
    this._els.forEach(el => this._animateSymbolOpacity(el, href(), opacity()));
  }

  _startStandbyAnimation() {
    if (this._standbyIid) return;
    this._standbyIid = window.setInterval(() => this._animateStandby(), 4000);
  }

  _stopStandbyAnimation() {
    if (this._standbyIid) window.clearInterval(this._standbyIid);
    this._standbyIid = null;
  }

  _initialize() {
    this._width = max(this._root.clientWidth, window.innerWidth || 0);
    this._height = max(this._root.clientHeight, window.innerHeight || 0);
    const oss = this._getOccupiedSpaces();
    const unoccupied = p => this._pointOutsideOccupiedSpaces(p, oss);
    let points = this._makeRayPattern().filter(unoccupied);
    const firstRing = points[0].i;
    const lastRing = points[points.length - 1].i;
    const ringCount = lastRing - firstRing + 1;
    const knockout = p => rnd() < 0.3 + (p.i - firstRing + 1) / ringCount * 0.7;
    points = points.filter(knockout);
    this._els = points.map(p => this._makePointElement(p));
    this._els.forEach(el => this._canvas.appendChild(el));
    this._attachLinkListeners();
    this._animateBurst({ delay: 0.5 });
    this._startStandbyAnimation();
  }
}

app.components.add('tapestry', Tapestry);
document.body.insertAdjacentHTML(
  'beforeend',
  '<div component="tapestry"></div>'
);
