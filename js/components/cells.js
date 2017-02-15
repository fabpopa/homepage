// creates cells animation component
// requires width and height in pixels
const Cells = function(width, height) {
  // animation options
  const opt = {
    sizeMin: 20,        // pixels, even number
    sizeMax: 50,        // pixels, even number
    angMin: -120,       // degrees
    angMax: -60,        // degrees
    flipTMin: 2,        // seconds
    flipTMax: 5,        // seconds
    jigMin: 1,          // pixels
    jigMax: 3,          // pixels
    jigTMin: 2,         // seconds
    jigTMax: 4,         // seconds
    buffer: 10,         // pixels
    velocity: 60,       // pixels per second
    padMax: height / 5, // pixels
    padTime: 5          // seconds
  };

  // convenience math functions
  const rnd = () => Math.random();
  const rou = (x) => Math.round(x);
  const flr = (x) => Math.floor(x);
  const cei = (x) => Math.ceil(x);
  const sin = (x) => Math.sin(x);
  const pow = (x, y) => Math.pow(x, y);
  const PI = Math.PI;

  // HTMLElement to return
  const el = document.createElement('div');
  el.setAttribute('component', 'cells');
  el.style.width = width;
  el.style.height = height;

  // stylesheet element to append to document.head
  const style = (() => {
    const c = '[component=cells]';
    const css = `
      ${c} { width: 100%; height: 100%; overflow: hidden; }
      ${c} .cell { position: absolute; width: 4em; height: 4em;
                   transform: translateX(-9999); }
      ${c} .jiggleX { animation: 1s ease-in-out infinite alternate jiggleX; }
      ${c} .jiggleY { animation: .6s ease-in-out infinite alternate jiggleY; }
      ${c} .jiggleY > * { position: absolute; border-radius: 50%; }
      ${c} .outside { width: 4em; height: 4em; background: #f27474;
                      animation: 2s linear infinite outside; }
      ${c} .inside { width: 2em; height: 2em; background: #d23a3a;
                     animation: 2s linear infinite inside; }
      @keyframes jiggleX { 0% { transform: translateX(-1em); }
                           100% { transform: translateX(1em); } }
      @keyframes jiggleY { 0% { transform: translateY(-1em); }
                           100% { transform: translateY(1em); } }
      @keyframes outside { 0%, 100% { transform: scaleY(.2); }
                           50% { transform: scaleY(1); } }
      @keyframes inside
        { 0% { transform: translate(1em, .68em) scale(.96, 0); }
          50% { transform: translate(1em, 1em) scale(1, 1); }
          100% { transform: translate(1em, 1.32em) scale(.9, 0); } }
    `;

    const el = document.createElement('style');
    el.innerHTML = css;
    return el;
  })();

  const makeCellEl = () => {
    const cell = document.createElement('div');
    const jiggleX = document.createElement('div');
    const jiggleY = document.createElement('div');
    const outside = document.createElement('div');
    const inside = document.createElement('div');
    cell.className = 'cell';
    jiggleX.className = 'jiggleX';
    jiggleY.className = 'jiggleY';
    outside.className = 'outside';
    inside.className = 'inside';
    jiggleY.appendChild(outside);
    jiggleY.appendChild(inside);
    jiggleX.appendChild(jiggleY);
    cell.appendChild(jiggleX);
    cells.appendChild(cell);
    return cell;
  };

  // canvas line at x = 0 to insert cells where they don't overlap
  const entryLine = ((canvas) => {
    const pixels = new Array(canvas.style.height);
    return {
      reset: () => {
        for (let i = 0; i < pixels.length; i++) pixels[i] = true;
      },
      mark: (from, to) => {
        if (from < 0) from = 0;
        if (to > pixels.length - 1) to = pixels.length - 1;
        for (let i = from; i <= to; i++) pixels[i] = false;
      },
      window: () => {
        // return largest continuous block of available pixels
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
  })(el);

  const sinPad = ((size, cycle) => {
    cycle *= 1000;  // convert cycle from s to ms
    let lastTime, progress, value;
    return (time) => {
      if (!lastTime) { lastTime = time; progress = 0; }
      progress = (progress + time - lastTime) % cycle;
      value = rou(size * abs(sin(progress / cycle * 2 * PI)));
      lastTime = time;
      return value;
    };
  })(opt.padMax, opt.padTime);

  const launch = (cell) => {

    cell.launchedAt = window.performance.now();
  };

  // cell elements created in advance, attached to DOM and never removed
  const cells = ((canvas) => {
    // allocate objects for theoretical max number of cells
    const width = canvas.style.width;
    const height = canvas.style.height;
    const poolCount = flr(width * height / pow(opt.sizeMin, 2));
    const pool = new Array(poolCount);
    const travelTime = flr(width / opt.velocity);

    // populate cell pool
    for (let i = 0; i < pool.length; i++) pool[i] = {
      size: null,       // pixels
      angle: null,      // degrees
      flipTime: null,   // seconds
      jiggle: null,     // pixels
      jiggleTime: null, // seconds
      jigglePhX: null,  // 0 to 1 multiple of jiggle
      jigglePhY: null,  // 0 to 1 multiple of jiggle
      y: null,          // pixels, vertical center of cell
      launchedAt: null  // ms returned from performance.now()
      el: makeCellEl()  // DOM element
    };

    const active = (i) => { return pool[i].y !== null; };

    // stack cache, hot object
    let c = {
      pad: null, space: null, cell: null, i: null,
      occupied: null, half: null, traveled: null
    };

    const addIfSpace = (time) => {
      c.pad = sinPad(time);           // advance sin pad
      if (rnd() % .3 > .02) return; // increase spread by random rejection

      entryLine.reset();
      for (c.i = 0; c.i < pool.length; c.i++) if (active(c.i)) {
        c.occupied = pool[c.i].size + pool[c.i].jiggle + opt.buffer;
        c.half = flr(c.occupied / 2);
        c.traveled = flr((time - pool[c.i].launchedAt) * opt.velocity / 1000);
        if (c.traveled > c.occupied) continue; // cell has cleared entryline
        entryLine.mark(pool[c.i].y - c.half, pool[c.i].y + c.half);
      }
      entryLine.mark(0, c.pad);
      entryLine.mark(height - c.pad, height - 1);

      c.space = entryLine.window();
      if (c.space.size < opt.sizeMin) return;

      for (c.i = 0; c.i < pool.length; c.i++) if (!active(c.i)) break;
      c.cell = pool[c.i];
      c.cell.angle = opt.angMin + rou(rnd() * abs(opt.angMax - opt.angMin));
      c.cell.flipTime = opt.flipTMin + rnd() * (opt.flipTMax - opt.flipTMin);
      c.cell.jiggle = opt.jigMin + rou(rnd() * (opt.jigMax - opt.jigMin));
      c.cell.jiggleTime = opt.jigTMin + rnd() * (opt.jigTMax - opt.jigTMin);
      c.cell.jigglePhX = rnd();
      c.cell.jigglePhY = rnd();
      c.cell.y = rou(c.space.start + (c.space.end - c.space.start) / 2);
      c.cell.size =
      launch(c.cell);
    };

    return { addIfSpace };
  })(el);

  const raf;
  const anim = (time) => {
    cells.addIfSpace(time);
    raf = window.requestAnimationFrame(anim);
  };

  this.pause = () => {
    lastTime = null;
    // css transition ?
  };
  this.unpause = () => {
    // css transition ?
    anim();
  };
  this.cleanup = () => {
    // has to be called when deleting the component
    // remove component from DOM
    // remove stylesheet from head
    // stop any event listeners and callbacks attached to page
  };

  anim();
  return el;
};
