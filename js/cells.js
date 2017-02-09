const Cells = function(canvas, cb) {
  // convenience math functions
  const rnd = () => { return Math.random(); };
  const rou = (x) => { return Math.round(x); };
  const flr = (x) => { return Math.floor(x); };
  const cei = (x) => { return Math.ceil(x); };
  const sin = (x) => { return Math.sin(x); };
  const tan = (x) => { return Math.tan(x); };
  const abs = (x) => { return Math.abs(x); };
  const pow = (x, y) => { return Math.pow(x, y); };
  const PI = Math.PI;

  const c = canvas.getContext('2d');
  const opt = {
    sizeMin: 20,    // pixels, even number
    sizeMax: 50,    // pixels, even number
    angleMin: 60,   // degrees
    angleMax: 120,  // degrees
    flipMin: 2,     // seconds
    flipMax: 5,     // seconds
    jiggleMin: 2,   // seconds
    jiggleMax: 4,   // seconds
    buffer: 10,     // pixels, even number
    jiggle: 2,      // pixels, lower than buffer
    velocity: 60    // pixels per second
  };

  // gives function that returns 0 to 1 progress in time interval based on fps
  // should be called once per frame at the specified fps
  const timePrg = (sec, fps) => {
    const cache = new Array(sec * fps);  // memoize return values
    let index = -1;
    for (let i = 0; i < cache.length; i++)
      cache[i] = rou(i / cache.length * 1000) / 1000;
    return () => {
      index += 1;
      if (index === cache.length) index = 0;
      return cache[index];
    };
  };

  // curve approximating ref: youtube.com/watch?v=Y3GQiBllgeY
  // returns velocity multiple, has to be called per frame
  const heartbeat = ((phaseLag) => {
    // velocity multiples: velocity * (1 + phaseInterpolation)
    const phases = [0, .5, -.4, 0, 0, 0, 0];
    const cache = new Array(phaseLag * 60 * phases.length);
    const phasePrg = timePrg(phaseLag, 60);
    let ph, phNext, index = -1;
    for (let i = 0; i < cache.length; i++) {
      ph = flr(i / (phaseLag * 60));
      phNext = ph + 1;
      if (phNext === phases.length) phNext = 0;
      cache[i] =
        rou((phases[ph] + (phases[phNext] - phases[ph]) * phasePrg()) * 1000)
        / 1000;
    }
    return () => {
      index += 1;
      if (index === cache.length) index = 0;
      return 0;
    };
  })(.3);

  const cellPool = (() => {
    // choose an object pool size that will not change
    const poolCount = flr(canvas.width * canvas.height / pow(opt.sizeMin, 2));
    const pool = new Array(poolCount);
    const active = (i) => { return pool[i].x !== null; };

    // populate cell pool
    for (let i = 0; i < pool.length; i++) pool[i] = {
      size: null,       // pixels
      angle: null,      // degrees
      flip: null,       // seconds
      jigglePrg: null,  // timePrg function made by timePrg(jiggleDuration, fps)
      jigglePhX: null,
      jigglePhY: null,
      x: null,
      y: null,
      flipFrame: null
    };

    return {
      count: pool.length,
      get: (i) => { return pool[i]; },
      active: (i) => { return active(i); },
      reset: (i) => { pool[i].x = null; },
      new: (size, angle, flip, jigglePrg, jigglePhX, jigglePhY, x, y) => {
        for (let i = 0; i < pool.length; i++) if (!active(i)) {
          pool[i].size = size;
          pool[i].angle = angle;
          pool[i].flip = flip;
          pool[i].jigglePrg = jigglePrg;
          pool[i].jigglePhX = jigglePhX;
          pool[i].jigglePhY = jigglePhY;
          pool[i].x = x;
          pool[i].y = y;
          pool[i].flipFrame = 0;
          return i;
        }
        return false;   // if pool empty, should not happen
      }
    };
  })();

  // canvas line at x = 0 to decide when to insert a new cell
  const entryLine = (c) => {
    const pixels = new Array(c.canvas.height);
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
  };

  // frame-duration cache (a bit quicker garbage collection)
  let fc = {
    cell: null, entryLine: null, heartbeat: null, pad: null, padPrg: null,
    rdX: null, rdY: null, ctlX: null, ctlY: null, flipPerc: null,
    jigglePrg: null, sX: null, sY: null
  };

  const renderCellPath = (c) => {
    c.beginPath();
    c.moveTo(0, -fc.rdY);
    c.bezierCurveTo(fc.ctlX, -fc.rdY, fc.rdX, -fc.ctlY, fc.rdX, 0);
    c.bezierCurveTo(fc.rdX, fc.ctlY, fc.ctlX, fc.rdY, 0, fc.rdY);
    c.bezierCurveTo(-fc.ctlX, fc.rdY, -fc.rdX, fc.ctlY, -fc.rdX, 0);
    c.bezierCurveTo(-fc.rdX, -fc.ctlY, -fc.ctlX, -fc.rdY, 0, -fc.rdY);
  };

  const renderCellFrame = (c, cell) => {
    // compute animation state
    if (cell.flipFrame === cell.flip * 60) cell.flipFrame = -1;
    cell.flipFrame += 1;
    fc.flipPerc = cell.flipFrame / cell.flip / 60 * 100;

    // enter canvas state
    c.save();

    // compute outside path
    fc.rdX = cell.size / 2;
    fc.rdY = fc.rdX * (.2 + .8 * abs(fc.flipPerc - 50) / 50);
    fc.ctlX = 4 / 3 * tan(PI / 8) * fc.rdX;   // horizontal bezier handle
    fc.ctlY = fc.ctlX * fc.rdY / fc.rdX;      // vertical bezier handle

    // render outside path
    fc.jigglePrg = cell.jigglePrg();
    fc.sX = opt.jiggle * sin((fc.jigglePrg + cell.jigglePhX) * 2 * PI);
    fc.sY = opt.jiggle * sin((fc.jigglePrg + cell.jigglePhY) * 2 * PI);
    c.translate(cell.x + fc.sX, cell.y + fc.sY);
    c.rotate(cell.angle * PI / 180);
    renderCellPath(c);
    c.fillStyle = 'rgb(242, 116, 116)';
    c.fill();

    // center inside path towards furthest edge of outside path
    c.translate(0, fc.flipPerc < 50 ? -fc.rdY : fc.rdY);

    // compute inside path
    fc.rdX /= 2;
    fc.rdY = fc.rdX * abs(fc.flipPerc - 50) / 50;
    fc.ctlX /= 2;
    fc.ctlY = fc.ctlX * fc.rdY / fc.rdX;

    // render inside path
    if (fc.rdY !== 0) {
      // slide inside path from center of outside path to edge and back
      c.translate(0, fc.flipPerc < 50 ? fc.rdY * 2 : -fc.rdY * 2);
      renderCellPath(c);
      c.fillStyle = 'rgb(210, 58, 58)';
      c.fill();
    }

    // exit canvas state
    c.restore();

    // advance position
    cell.x += opt.velocity / 60 * (1 + fc.heartbeat);
  };

  const addCell = () => {
    if (rnd() % .3 > .02) return; // likely rejection, better spread
    let space = fc.entryLine.window();
    let size = opt.sizeMin + rou(rnd() * (opt.sizeMax - opt.sizeMin));
    if (space.size < size) return;
    cellPool.new(
      size,
      opt.angleMin + rou(rnd() * (opt.angleMax - opt.angleMin)),
      opt.flipMin + rou(rnd() * (opt.flipMax - opt.flipMin)),
      timePrg(opt.jiggleMin + rou(rnd() * (opt.jiggleMax - opt.jiggleMin)), 60),
      rnd(),
      rnd(),
      0 - size / 2,
      space.start + rou(size / 2 + rnd() * (space.size - size))
    );
  };

  const renderCells = (c) => {
    // clear canvas and render background
    c.fillStyle = 'rgb(255, 255, 255)';
    c.fillRect(0, 0, c.canvas.width, c.canvas.height);

    if (fc.entryLine === null) fc.entryLine = entryLine(c); // singleton
    fc.entryLine.reset();
    fc.heartbeat = heartbeat();

    // render cells
    for (let i = 0; i < cellPool.count; i++) {
      if (!cellPool.active(i)) continue;
      fc.cell = cellPool.get(i);
      renderCellFrame(c, fc.cell);

      // remove cell if outside of canvas
      if (fc.cell.x - fc.cell.size / 2 > c.canvas.width) cellPool.reset(i);

      // mark pieces that cross entry line
      if (fc.cell.x - fc.cell.size / 2 - opt.buffer < 0)
        fc.entryLine.mark(
          flr(fc.cell.y - fc.cell.size / 2 - opt.buffer),
          cei(fc.cell.y + fc.cell.size / 2 + opt.buffer)
        );
    }

    // take out cell buffer at beginning and end of entry line
    // plus a sin wave of padding
    if (fc.padPrg === null) fc.padPrg = timePrg(5, 60); // singleton
    fc.pad = rou(abs(c.canvas.height / 5 * sin(fc.padPrg() * 2 * PI)));
    fc.entryLine.mark(0, opt.buffer + fc.pad);
    fc.entryLine.mark(c.canvas.height - opt.buffer - fc.pad, c.canvas.height);

    // add new cell
    addCell();
  };

  // buffer for sec * 60fps ImageData frames of the same size as original canvas
  const frameBuffer = (originalCanvas, sec) => {
    const canvas = document.createElement('canvas');
    canvas.height = originalCanvas.height;
    canvas.width = originalCanvas.width;
    const ctx = canvas.getContext('2d');
    const frames = new Array(sec * 60);
    let ins = 0, ext = 0, count = 0, ret;
    return {
      addFrameIfSpace: (makeFrameOnContext) => {
        if (count === frames.length) return;
        makeFrameOnContext(ctx);
        frames[ins] = ctx.getImageData(0, 0, canvas.width, canvas.height);
        ins = (ins + 1) % frames.length;
        count += 1;
      },
      getFrameIfAvail: () => {
        if (count === 0) return;
        ret = ext;
        ext = (ext + 1) % frames.length;
        count -= 1;
        return frames[ret];
      }
    };
  };

  const fb = frameBuffer(canvas, 4);

  // pre-populate frame buffer
  for (let i = 0; i < 4 * 60; i++) fb.addFrameIfSpace(renderCells);

  // know when to stop and free for garbage collection
  let isActive = true;

  // start frame pre-renderer
  if (window.requestIdleCallback) {
    const preRender = () => {
      if (!isActive) return;
      fb.addFrameIfSpace(renderCells);
      window.requestIdleCallback(preRender);
    };
    preRender();
  } else {
    const tick = window.setInterval(() => {
      if (!isActive) { window.clearInterval(tick); return; }
      fb.addFrameIfSpace(renderCells);
    }, 10);
  }

  // start animation
  const anim = () => {
    if (!isActive) return;
    c.putImageData(fb.getFrameIfAvail(), 0, 0);
    window.requestAnimationFrame(anim);
  };

  anim();

  // detach Cells object from environment to be garbage collected
  this.cleanup = () => { isActive = false; };

  if (cb) cb();
};
