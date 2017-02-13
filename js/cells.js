const Cells = function(canvas) {
  // convenience math functions
  const rnd = () => Math.random();
  const rou = (x) => Math.round(x);
  const flr = (x) => Math.floor(x);
  const cei = (x) => Math.ceil(x);
  const sin = (x) => Math.sin(x);
  const tan = (x) => Math.tan(x);
  const abs = (x) => Math.abs(x);
  const pow = (x, y) => Math.pow(x, y);
  const PI = Math.PI;

  const c = canvas.getContext('2d');

  // scale for hidpi screens ref: html5rocks.com/en/tutorials/canvas/hidpi
  (() => {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const backingStoreRatio = c.webkitBackingStorePixelRatio ||
      c.mozBackingStorePixelRatio || c.msBackingStorePixelRatio ||
      c.oBackingStorePixelRatio || c.backingStorePixelRatio || 1;
    const ratio = devicePixelRatio / backingStoreRatio;
    if (ratio === 1) return;
    const oldWidth = canvas.width;
    const oldHeight = canvas.height;
    canvas.width = oldWidth * ratio;
    canvas.height = oldHeight * ratio;
    canvas.style.width = `${oldWidth}px`;
    canvas.style.height = `${oldHeight}px`;
  })();

  const opt = {
    sizeMin: 20,      // pixels, even number
    sizeMax: 50,      // pixels, even number
    angleMin: 60,     // degrees
    angleMax: 120,    // degrees
    flipMin: 2,       // seconds
    flipMax: 5,       // seconds
    jiggleMin: 2,     // seconds
    jiggleMax: 4,     // seconds
    buffer: 10,       // pixels, even number
    jiggle: 2,        // pixels, lower than buffer
    velocity: 60,     // pixels per second
    sinPadHeight: canvas.height / 5,  // pixels
    sinPadDuration: 5 // seconds
  };

  // gives function that returns 0 to 1 progress in time interval based on Δt
  // should be called once per frame with the time delta in ms
  const timePrg = (totalTime) => {
    let time = 0;
    return (dt) => { time = (time + dt) % totalTime; return time / totalTime; };
  };

  // curve approximating ref: youtube.com/watch?v=Y3GQiBllgeY
  // returns velocity multiple, has to be called per frame
  const heartbeat = ((phaseDuration) => {
    // velocity multiples: velocity * (1 + phaseInterpolation)
    const phases = [0, .5, -.4, 0, 0, 0, 0];
    return (dt) => { return 0; }; //TODO heartbeat
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
      flipPrg: null,    // seconds
      jigglePrg: null,  // timePrg function
      jigglePhX: null,
      jigglePhY: null,
      x: null,
      y: null
    };

    return {
      count: pool.length,
      get: (i) => { return pool[i]; },
      active: (i) => { return active(i); },
      reset: (i) => { pool[i].x = null; },
      new: (size, angle, flipPrg, jigglePrg, jigglePhX, jigglePhY, x, y) => {
        for (let i = 0; i < pool.length; i++) if (!active(i)) {
          pool[i].size = size;
          pool[i].angle = angle;
          pool[i].flipPrg = flipPrg;
          pool[i].jigglePrg = jigglePrg;
          pool[i].jigglePhX = jigglePhX;
          pool[i].jigglePhY = jigglePhY;
          pool[i].x = x;
          pool[i].y = y;
          return i;
        }
        return false;   // if pool empty, should not happen
      }
    };
  })();

  // canvas line at x = 0 to decide when to insert a new cell
  const entryLine = (() => {
    const pixels = new Array(canvas.height);
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
  })();

  // frame-duration cache (a bit quicker garbage collection)
  let fc = {
    cell: null, heartbeat: null,
    sinPad: null, sinPadPrg: timePrg(opt.sinPadDuration * 1000),
    rdX: null, rdY: null, ctlX: null, ctlY: null, flipPerc: null, insideY: null,
    jigglePrg: null, sX: null, sY: null
  };

  const renderCellPath = () => {
    c.beginPath();
    c.moveTo(0, -fc.rdY);
    c.bezierCurveTo(fc.ctlX, -fc.rdY, fc.rdX, -fc.ctlY, fc.rdX, 0);
    c.bezierCurveTo(fc.rdX, fc.ctlY, fc.ctlX, fc.rdY, 0, fc.rdY);
    c.bezierCurveTo(-fc.ctlX, fc.rdY, -fc.rdX, fc.ctlY, -fc.rdX, 0);
    c.bezierCurveTo(-fc.rdX, -fc.ctlY, -fc.ctlX, -fc.rdY, 0, -fc.rdY);
  };

  const renderCellFrame = (dt, cell) => {
    fc.flipPerc = rou(cell.flipPrg(dt) * 100);

    // enter canvas state
    c.save();

    // compute outside path
    fc.rdX = cell.size / 2;
    fc.rdY = fc.rdX * (.2 + .8 * abs(fc.flipPerc - 50) / 50);
    fc.ctlX = 4 / 3 * tan(PI / 8) * fc.rdX;   // horizontal bezier handle
    fc.ctlY = fc.ctlX * fc.rdY / fc.rdX;      // vertical bezier handle

    // render outside path
    fc.jigglePrg = cell.jigglePrg(dt);
    fc.sX = opt.jiggle * sin((fc.jigglePrg + cell.jigglePhX) * 2 * PI);
    fc.sY = opt.jiggle * sin((fc.jigglePrg + cell.jigglePhY) * 2 * PI);
    c.translate(cell.x + fc.sX, cell.y + fc.sY);
    c.rotate(cell.angle * PI / 180);
    renderCellPath();
    c.fillStyle = 'rgb(242, 116, 116)';
    c.fill();

    // center inside path towards furthest edge of outside path
    fc.insideY = fc.flipPerc < 50 ? -fc.rdY : fc.rdY;

    // compute inside path
    fc.rdX /= 2;
    fc.rdY = fc.rdX * abs(fc.flipPerc - 50) / 50;
    fc.ctlX /= 2;
    fc.ctlY = fc.ctlX * fc.rdY / fc.rdX;

    // render inside path
    if (fc.rdY !== 0) {
      // slide inside path from center of outside path to edge and back
      fc.insideY += fc.flipPerc < 50 ? fc.rdY * 2 : -fc.rdY * 2;
      fc.insideY *= .75;  // zero before outside edge, illusion of thickness
      c.translate(0, fc.insideY);
      renderCellPath();
      c.fillStyle = 'rgb(210, 58, 58)';
      c.fill();
    }

    // exit canvas state
    c.restore();

    // advance position
    cell.x += opt.velocity * dt / 1000 * (1 + fc.heartbeat);
  };

  const addCell = () => {
    if (rnd() % .3 > .02) return; // likely rejection, better spread
    let space = entryLine.window();
    let size = opt.sizeMin + rou(rnd() * (opt.sizeMax - opt.sizeMin));
    if (space.size < size) return;
    let flipDelta = opt.flipMax - opt.flipMin;
    let jiggleDelta = opt.jiggleMax - opt.jiggleMin;
    cellPool.new(
      size,
      opt.angleMin + rou(rnd() * (opt.angleMax - opt.angleMin)),
      timePrg((opt.flipMin + rou(rnd() * flipDelta)) * 1000),
      timePrg((opt.jiggleMin + rou(rnd() * jiggleDelta)) * 1000),
      rnd(),
      rnd(),
      0 - size / 2,
      space.start + rou(size / 2 + rnd() * (space.size - size))
    );
  };

  const renderCells = (dt) => {
    // clear canvas and render background
    c.fillStyle = 'rgb(255, 255, 255)';
    c.fillRect(0, 0, canvas.width, canvas.height);
    entryLine.reset();
    fc.heartbeat = heartbeat(dt);

    // render cells
    for (let i = 0; i < cellPool.count; i++) {
      if (!cellPool.active(i)) continue;
      fc.cell = cellPool.get(i);
      renderCellFrame(dt, fc.cell);

      // remove cell if outside of canvas
      if (fc.cell.x - fc.cell.size / 2 > canvas.width) cellPool.reset(i);

      // mark pieces that cross entry line
      if (fc.cell.x - fc.cell.size / 2 - opt.buffer < 0) entryLine.mark(
        flr(fc.cell.y - fc.cell.size / 2 - opt.buffer),
        cei(fc.cell.y + fc.cell.size / 2 + opt.buffer)
      );
    }

    // take out cell buffer at beginning and end of entry line plus padding wave
    fc.sinPad = rou(abs(opt.sinPadHeight * sin(fc.sinPadPrg(dt) * 2 * PI)));
    entryLine.mark(0, opt.buffer + fc.sinPad);
    entryLine.mark(canvas.height - opt.buffer - fc.sinPad, canvas.height);

    // attempt to add cell to canvas entry line
    addCell();
  };

  let raf, lastTime = 0, dt;
  const anim = (time) => {
    dt = time - lastTime;
    lastTime = time;
    if (dt < 200) renderCells(dt); // throw away superlong frames
    raf = window.requestAnimationFrame(anim);
  };

  this.pause = () => { window.cancelAnimationFrame(raf); raf = null; };
  this.unpause = () => { if (!raf) anim(); };
  anim();
};
