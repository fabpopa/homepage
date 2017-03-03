// red blood cell animation component
const Cells = function() {
  const opt = {
    sizeMin: .24,   // multiple of height
    sizeMax: .34,   // multiple of height
    angMin: -120,   // degrees
    angMax: -60,    // degrees
    flipTMin: 2,    // seconds
    flipTMax: 4,    // seconds
    jigMin: .5,     // pixels
    jigMax: 2,      // pixels
    jigTMin: .8,    // seconds
    jigTMax: 1.4,   // seconds
    buffer: 12,     // pixels
    velocity: 40,   // pixels per second, can't be 0
    padMax: .21,    // multiple of height
    padTime: 10     // seconds, tweak based on velocity
  };

  // convenience math functions
  const rnd = () => Math.random();
  const rou = (x) => Math.round(x);
  const flr = (x) => Math.floor(x);
  const cei = (x) => Math.ceil(x);
  const sin = (x) => Math.sin(x);
  const abs = (x) => Math.abs(x);
  const min = (x, y) => Math.min(x, y);
  const pow = (x, y) => Math.pow(x, y);
  const PI = Math.PI;

  // HTMLElement to return
  const el = document.createElement('div');
  el.setAttribute('component', 'cells');
  el.style['width'] = '100%';
  el.style['height'] = '100%';

  // component state
  let width, height, style, cells;

  const initStyle = () => {
    const c = '[component=cells]';
    const css = `
      ${c} { position: relative; width: 100%; height: 100%; overflow: hidden; }
      ${c}.paused *, ${c} .paused * { animation-play-state: paused !important; }
      ${c} .cell.paused { opacity: 0; }
      ${c} .cell { position: absolute; width: 4em; height: 4em;
                   transform: translate3d(-100%, 0, 0); }
      ${c} .cell * { width: 100%; height: 100%; }
      ${c} .cell, ${c} .cell * { will-change: opacity, transform; }
      ${c} .jiggleY > * { position: absolute; border-radius: 50%; }
      ${c} .outside { width: 4em; height: 4em; background: #f27474; }
      ${c} .inside { width: 2em; height: 2em; background: #d23a3a; }
      @keyframes move {
        from { transform: translate3d(-100%, 0, 0); opacity: 0; }
        8% { opacity: 0; }
        30%, 70% { opacity: 1; }
        92% { opacity: 0; }
        to { transform: translate3d(${width}px, 0, 0); opacity: 0; } }
      @keyframes jiggleX { from { transform: translate3d(-1em, 0, 0); }
                           to { transform: translate3d(1em, 0, 0); } }
      @keyframes jiggleY { from { transform: translate3d(0, -1em, 0); }
                           to { transform: translate3d(0, 1em, 0); } }
      @keyframes outside { 0%, 100% { transform: scale3d(1, .2, 1); }
                           50% { transform: scale3d(1, 1, 1); } }
      @keyframes inside
        { 0% { transform: translate3d(1em, .68em, 0) scale3d(.96, 0, 1); }
          50% { transform: translate3d(1em, 1em, 0) scale3d(1, 1, 1); }
          100% { transform: translate3d(1em, 1.32em, 0) scale3d(.9, 0, 1); } }
    `;

    style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);
  };

  const makeCellEl = () => {
    const cell = document.createElement('div');
    const angle = document.createElement('div');
    const jiggleX = document.createElement('div');
    const jiggleY = document.createElement('div');
    const outside = document.createElement('div');
    const inside = document.createElement('div');
    cell.className = 'cell';
    angle.className = 'angle';
    jiggleX.className = 'jiggleX';
    jiggleY.className = 'jiggleY';
    outside.className = 'outside';
    inside.className = 'inside';
    jiggleY.appendChild(outside);
    jiggleY.appendChild(inside);
    jiggleX.appendChild(jiggleY);
    angle.appendChild(jiggleX);
    cell.appendChild(angle);
    cell['angle'] = angle;
    cell['jiggleX'] = jiggleX;
    cell['jiggleY'] = jiggleY;
    cell['outside'] = outside;
    cell['inside'] = inside;
    cell.classList.add('paused');
    el.appendChild(cell);
    return cell;
  };

  // all the element styling to facilitate animation
  const launch = (cell) => {
    cell.el.style['font-size'] = `${cell.size / 4}px`;
    cell.el.outside.style['font-size'] = `${cell.size / 4}px`;
    cell.el.inside.style['font-size'] = `${cell.size / 4}px`;
    cell.el.angle.style['transform'] = `rotate(${cell.angle}deg)`;
    cell.el.style['padding'] = `${cell.jiggle}px`;
    cell.el.jiggleX.style['font-size'] = `${cell.jiggle}px`;
    cell.el.style['top'] = `${cell.y - cell.size / 2 - cell.jiggle}px`;

    cell.el.addEventListener('animationend', function h() {
      cell.el.removeEventListener('animationend', h);
      cell.el.classList.add('paused');
      cell.el.style['animation'] = '';
      cell.el.outside.style['animation'] = '';
      cell.el.inside.style['animation'] = '';
      cell.el.jiggleX.style['animation'] = '';
      cell.el.jiggleY.style['animation'] = '';
      window.requestAnimationFrame(() => cell.y = null); // frame between reuse
    });

    cell.el.classList.remove('paused');
    cell.el.outside.style['animation'] =
      `${cell.flipTime}s linear infinite outside`;
    cell.el.inside.style['animation'] =
      `${cell.flipTime}s linear infinite inside`;
    cell.el.jiggleX.style['animation'] =
      `${cell.jiggleTime}s ease-in-out infinite alternate jiggleX`;
    cell.el.jiggleY.style['animation'] =
      `${cell.jiggleTime}s ease-in-out infinite alternate jiggleY`;
    cell.el.style['animation'] = `${cell.travelTime}s linear move`;
  };

  const initCells = () => {
    // line at x = 0 to insert cells where they don't overlap
    const entryLine = (() => {
      const pixels = new Array(height);
      return {
        reset: () => {
          for (let i = 0; i < pixels.length; i++) pixels[i] = true;
        },
        mark: (from, to) => {
          from = Math.round(from);
          to = Math.round(to);
          if (from < 0) from = 0;
          if (to > pixels.length - 1) to = pixels.length - 1;
          for (let i = from; i <= to; i++) pixels[i] = false;
        },
        window: () => {
          // return largest continuous block of empty pixels
          let space = { start: 0, end: 0, size: 0 };
          for (let i = 0, j = 1; j <= pixels.length; j++)
            if (j == pixels.length || pixels[j - 1] != pixels[j])
              if (pixels[j - 1]) {
                if (j - i > space.size) {
                  space.start = i;
                  space.end = j - 1;
                  space.size = j - i;
                }
              } else i = j;
          return space;
        }
      };
    })();

    // sin wave of side padding to create an organic shape for stream of cells
    const sinPad = ((size, cycle) => {
      let time = 0;
      return (dt) => {
        time = (time + dt) % cycle;
        return rou(size * abs(sin(time / cycle * 2 * PI)));
      };
    })(opt.padMax * height, opt.padTime * 1000);

    // allocate for theoretical max number of cells on canvas
    const minCellSize = opt.sizeMin * height + 2 * opt.jigMin + opt.buffer;
    const poolCount = flr(width * height / pow(minCellSize, 2));
    const pool = new Array(poolCount);

    // populate cell pool
    for (let i = 0; i < pool.length; i++) pool[i] = {
      size: null,        // pixels
      angle: null,       // degrees
      flipTime: null,    // seconds
      jiggle: null,      // pixels
      jiggleTime: null,  // seconds
      jigglePhX: null,   // time phase shift within 0-jiggleTime seconds
      jigglePhY: null,   // time phase shift within 0-jiggleTime seconds
      y: null,           // pixels, vertical center of cell
      travelDist: null,  // pixels to travel from -100% to width across canvas
      travelTime: null,  // seconds to travel from -100% to width across canvas
      el: makeCellEl()   // DOM element
    };

    // circular buffer for last launched cell indexes
    const lastLaunched = ((size) => {
      const buffer = new Array(size);
      let i = 0;
      buffer.add = (item) => { buffer[i] = item; i = (i + 1) % buffer.length; };
      return buffer;
    })(cei(height / minCellSize));

    const active = (i) => typeof i == 'number' && pool[i].y !== null;

    // cache, hot object
    const c = {
      pad: null, space: null, cell: null, i: null, li: null,
      leftEdge: null, occup: null, half: null
    };

    cells = (dt) => {
      c.pad = sinPad(dt);     // advance sin pad
      if (rnd() > .3) return; // increase cell spread

      entryLine.reset();
      c.leftEdge = el.getBoundingClientRect().left + opt.buffer;
      c.leftEdge += opt.buffer; // increase cell spread
      for (c.li = 0; c.li < lastLaunched.length; c.li++) {
        c.i = lastLaunched[c.li];
        if (!active(c.i)) continue;
        c.cell = pool[c.i];
        if (c.cell.el.getBoundingClientRect().left > c.leftEdge) continue;
        c.occup = c.cell.size + c.cell.jiggle * 2 + opt.buffer;
        c.half = c.occup / 2;
        entryLine.mark(c.cell.y - c.half, c.cell.y + c.half);
      }

      entryLine.mark(0, c.pad);
      entryLine.mark(height - c.pad - 1, height - 1);
      c.space = entryLine.window();
      if (c.space.size < minCellSize) return;

      for (c.i = 0; c.i < pool.length; c.i++) if (!active(c.i)) break;
      if (c.i === pool.length) return;

      c.cell = pool[c.i];
      c.cell.angle = opt.angMin + rou(rnd() * abs(opt.angMax - opt.angMin));
      c.cell.flipTime = opt.flipTMin + rnd() * (opt.flipTMax - opt.flipTMin);
      c.cell.jiggle = opt.jigMin + rnd() * (opt.jigMax - opt.jigMin);
      c.cell.jiggleTime = opt.jigTMin + rnd() * (opt.jigTMax - opt.jigTMin);
      c.cell.jigglePhX = rnd() * c.cell.jiggleTime;
      c.cell.jigglePhY = rnd() * c.cell.jiggleTime;
      c.cell.size = min(opt.sizeMax, c.space.size / height) - opt.sizeMin;
      c.cell.size = (opt.sizeMin + rnd() * c.cell.size) * height;
      c.cell.y = c.space.start + rnd() * (c.space.size - c.cell.size);
      c.cell.y += c.cell.size / 2;
      c.cell.travelDist = width + c.cell.size + 2 * c.cell.jiggle;
      c.cell.travelTime = c.cell.travelDist / opt.velocity;

      launch(c.cell);
      lastLaunched.add(c.i);
    };
  };

  const tw = (t, b, c, d) => b + t / d * c;
  let vT, vB, vC, vD;
  let bT, bB, bC, bD;
  const initIntro = () => {
    vT = 0; vB = opt.velocity * 4.4; vC = opt.velocity - vB; vD = 4000;
    bT = 0; bB = 6; bC = opt.buffer - bB; bD = 2000;
  };

  let raf, lastTime, dt;
  const anim = (time) => {
    if (!lastTime) lastTime = time;
    dt = time - lastTime;
    if (vT <= vD) { opt.velocity = tw(vT, vB, vC, vD); vT += dt; }
    if (bT <= bD) { opt.buffer = tw(bT, bB, bC, bD); bT += dt; }
    cells(dt);
    lastTime = time;
    raf = window.requestAnimationFrame(anim);
  };

  el.pause = () => {
    window.cancelAnimationFrame(raf);
    lastTime = null;
    el.classList.add('paused');
  };

  el.unpause = () => {
    if (lastTime) return;
    const restart = (time) => { anim(time); el.classList.remove('paused'); };
    raf = window.requestAnimationFrame(restart);
  };

  // pause animation on visibility change as some browsers do automatically
  let v = () => { if (document.hidden) { el.pause(); } else { el.unpause(); } };
  document.addEventListener('visibilitychange', v);

  el.cleanup = () => {
    el.pause();
    if (document.head.contains(style)) document.head.removeChild(style);
    document.removeEventListener('visibilitychange', v);
  };

  // set global dimensions and start animation
  const dimension = () => {
    const comp = window.getComputedStyle(el);
    width = parseInt(comp['width'], 10);
    height = parseInt(comp['height'], 10);
    if (!width || !height) { window.requestAnimationFrame(dimension); return; }
    initStyle();
    initCells();
    initIntro();
    el.unpause();
  };

  // wait for el to be appended to parent node to get dimensions and start
  const checkParent = () => {
    if (el.parentNode) { dimension(); return; }
    window.requestAnimationFrame(checkParent);
  };

  checkParent();
  return el;
};
