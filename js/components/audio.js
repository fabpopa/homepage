const Audio = function(src) {
  const opt = {
    peakWidth: 17,          // pixels width for a peak on the sound curve
    peakCountMin: 3,        // count of peaks to display at a minimum
    heightUnitMin: 4,       // pixels height min for the height unit
    heightUnitMax: 16,      // pixels height max for the height unit
    barHULoading: .4,        // height unit multiple for bar when loading
    barHUWave: 1,           // height unit multiple for bar when part of wave
    waveHU: 5,              // height unit multiple for full waveform
    peakCurveHandle: 8,     // pixels length of bezier curve handle at peak
    loadingWidthRatio: .5,  // width ratio of bar when loading to full waveform
    bgColor: '#efe8e8',
    barColor: 'lightblue'
  };

  // convenience math functions
  const rnd = () => Math.random();
  const flr = (x) => Math.floor(x);
  const cei = (x) => Math.ceil(x);
  const rou = (x) => Math.round(x);
  const sin = (x) => Math.sin(x);
  const tan = (x) => Math.tan(x);
  const min = (x, y) => Math.min(x, y);
  const pow = (x, y) => Math.pow(x, y);
  const PI = Math.PI;
  const easeOutExp = (t, b, c, d) =>
    t == d ? b + c : c * (-pow(2, -10 * t / d) + 1) + b;

  // HTMLElement to return
  const el = document.createElement('div');
  el.setAttribute('component', 'audio');
  el.style['width'] = '100%';
  el.style['height'] = '100%';
  el.style['position'] = 'relative';

  const fallBack = () => {
    const fb = document.createElement('audio');
    fb.setAttribute('controls', '');
    fb.style['width'] = '100%';
    fb.style['text-align'] = 'center';
    fb.src = src;
    const fbLink = document.createElement('a');
    fbLink.href = src;
    fbLink.innerHTML = 'Download here';
    fb.appendChild(fbLink);
    el.appendChild(fb);
  };

  // detect features
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const features = AudioContext && !!Audio && !!Worker && !!Blob;

  // fall back to audio element if web audio api unavailable
  if (!features) { fallBack(); return el; }

  // component state
  const data = { pcm: null, peaks: null };
  let width, height, heightUnit, peakCount, peakWidth;
  let audio;

  // draw audio component in different states
  const draw = (() => {
    let state = 'none'; // none → init → load → analyze → complete
    let svg, bar, shape, replay; // DOM elements
    let p; // array of (2 * peakCount + 2) {x, y} point coords (left, t, r, b)

    // set multiple attributes on an element
    const setAttr = (elem, attr) =>
      Object.keys(attr).forEach(k => elem.setAttribute(k, attr[k]));

    // build SVG bezier curve
    const curve = (startX, startY) => {
      let d = `M ${startX},${startY}`;
      const bezier = (type, xC1, yC1, xC2, yC2, x, y) =>
        d += ` ${type} ${xC1},${yC1} ${xC2},${yC2} ${x},${y}`;
      const C = (...args) => bezier('C', ...args);
      const c = (...args) => bezier('c', ...args);
      const L = (x, y) => d += ` L ${x},${y}`;
      const l = (x, y) => d += ` l ${x},${y}`;
      const close = () => d += ` Z`;
      return { C, c, L, l, close };
    };

    const init = () => {
      if (state !== 'none') return;
      const svgNS = 'http://www.w3.org/2000/svg';
      const svgEl = (el) => document.createElementNS(svgNS, el);
      svg = svgEl('svg');
      const defs = svgEl('defs');
      const clip = svgEl('clipPath');
      clip.id = `clip-${+Date.now()}${rou(rnd() * pow(10, 5))}`;
      shape = svgEl('path');
      const g = svgEl('g');
      setAttr(g, { 'clip-path': `url(#${clip.id})` });
      const bg = svgEl('rect');
      bar = svgEl('path');
      defs.appendChild(clip);
      clip.appendChild(shape);
      g.appendChild(bg);
      g.appendChild(bar);
      svg.appendChild(defs);
      svg.appendChild(g);

      setAttr(svg, { 'width': width, 'height': height });
      setAttr(bg, { 'x': 0, 'y': 0, 'width': width, 'height': height });
      setAttr(bg, { 'fill': opt.bgColor });
      setAttr(bar, { 'fill': opt.barColor });
      svg.style['opacity'] = 0;
      svg.style['transform'] = 'scale(.8, .8)';
      svg.style['transition'] = 'opacity .4s, transform .3s';

      replay = document.createElement('div');
      replay.style['position'] = 'absolute';
      replay.style['top'] = '0';
      replay.style['min-width'] = '25px';
      replay.style['width'] = '7%';
      replay.style['height'] = '100%';

      el.appendChild(svg);
      el.appendChild(replay);
      state = 'init';
    };

    let preload = (() => {
      let barWidth, barWidthDiffHalf, barHHalf, barCtl, barStraightPart;
      let lastProgress = -1;

      const sh = (barStraightPart) => {
        const sh = curve(barWidthDiffHalf, height / 2);
        sh.c(0, -barCtl, barHHalf - barCtl, -barHHalf, barHHalf, -barHHalf);
        sh.l(barStraightPart, 0);
        sh.c(barCtl, 0, barHHalf, barHHalf - barCtl, barHHalf, barHHalf);
        sh.c(0, barCtl, -barHHalf + barCtl, barHHalf, -barHHalf, barHHalf);
        sh.l(-barStraightPart, 0);
        sh.c(-barCtl, 0, -barHHalf, -barHHalf + barCtl, -barHHalf, -barHHalf);
        return sh.close();
      };

      const initAndReveal = () => {
        barWidth = width * opt.loadingWidthRatio;
        barWidthDiffHalf = (width - barWidth) / 2;
        barHHalf = opt.barHULoading * heightUnit / 2;
        barCtl = barHHalf * 4 / 3 * tan(PI / 8); // circle quarter arc
        barStraightPart = barWidth - 2 * barHHalf;
        setAttr(shape, { 'd': sh(barStraightPart) });
        svg.style['opacity'] = 1;
        svg.style['transform'] = 'scale(1, 1)';
      };

      return (progress) => {
        if (progress <= lastProgress) return;
        if (state === 'init') { initAndReveal(); state = 'load'; }
        if (state !== 'load') return;
        setAttr(bar, { 'd': sh(barStraightPart * progress) });
        lastProgress = progress;
        if (progress === 1) state = 'analyze';
      };
    })();

    // ctl params are bezier handle lengths for ends, points, and corners
    const makeShape = (p, eCtl, pCtl, cCtl) => {
      if (!eCtl || !pCtl || !cCtl) return;
      let i, cv = curve(p[0].x, p[0].y);
      cv.C(p[0].x, p[0].y - eCtl, p[1].x - cCtl, p[1].y, p[1].x, p[1].y);
      for (i = 2; i <= peakCount; i++)
        cv.C(p[i-1].x + pCtl, p[i-1].y, p[i].x - pCtl, p[i].y, p[i].x, p[i].y);
      i = peakCount + 1;  // right end
      cv.C(p[i-1].x + cCtl, p[i-1].y, p[i].x, p[i].y - eCtl, p[i].x, p[i].y);
      i += 1; // first bottom point after right end
      cv.C(p[i-1].x, p[i-1].y + eCtl, p[i].x + cCtl, p[i].y, p[i].x, p[i].y);
      for (i = peakCount + 3; i < p.length; i++)
        cv.C(p[i-1].x - pCtl, p[i-1].y, p[i].x + pCtl, p[i].y, p[i].x, p[i].y);
      i = p.length - 1;
      cv.C(p[i].x - cCtl, p[i].y, p[0].x, p[0].y + eCtl, p[0].x, p[0].y);
      return cv.close();
    };

    const prepWave = () => {
      // blow up progress bar layer
      const cv = curve(0, 0);
      cv.l(width, 0);
      cv.l(0, height);
      cv.l(-width, 0);
      cv.l(0, -height);
      const barShape = cv.close();
      setAttr(bar, { 'd': barShape });

      // make clip path into loading bar shape
      const barWidth = width * opt.loadingWidthRatio;
      const barWidthDiffHalf = (width - barWidth) / 2;
      const barHeightHalf = opt.barHULoading * heightUnit / 2;
      const topY = height / 2 - barHeightHalf;
      const btmY = height / 2 + barHeightHalf;
      const peakWidth = barWidth / peakCount;
      p = [];
      p.push({ x: barWidthDiffHalf, y: height / 2 });
      for (let i = 0; i < peakCount; i++)
        p.push({ x: barWidthDiffHalf + (i + .5) * peakWidth, y: topY });
      p.push({ x: width - barWidthDiffHalf, y: height / 2 });
      for (let i = peakCount - 1; i >= 0; i--)
        p.push({ x: barWidthDiffHalf + (i + .5) * peakWidth, y: btmY });
      paintPoints(opt.barHULoading);
    };

    let azraf;
    const analyze = () => {
      return;
      if (state === 'load')
        { preload(1); window.setTimeout(analyze, 400); return; }
      if (state !== 'analyze' || azraf) return;
      prepWave();

      let points = JSON.parse(JSON.stringify(p)); // deep copy
      let diff = new Array(points.length / 2 + 1).fill(0);
      let amplitude = opt.barHULoading * heightUnit / 2;
      let t = 0, cycle = 1400, val, i, pair;
      const render = (dt) => {
        val = amplitude * sin(t / cycle * 2 * PI);
        t = (t + dt) % cycle;
        for (i = 0; i < diff.length; i++) {
          diff[i] = (diff[i] * 2 + (i == 0 ? val : diff[i-1])) / 3;
          p[i].y = points[i].y + diff[i];
          pair = (points.length - i) % points.length;
          p[pair].y = points[pair].y + diff[i];
        }
        paintPoints(opt.barHULoading);
      };

      let lastTime;
      const anim = (t) => {
        if (!t) { azraf = window.requestAnimationFrame(anim); return; }
        if (!lastTime) lastTime = t;
        render(t - lastTime);
        lastTime = t;
        azraf = window.requestAnimationFrame(anim);
      };
      anim();
    };

    const interact = () => {
      svg.style['cursor'] = 'pointer';
      replay.style['cursor'] = 'pointer';
      svg.style['transition'] = 'transform .1s';
      svg.addEventListener('mousedown', () => {
        svg.style['transform'] = 'translateY(2px) scale(.99, .99)';
      });
      svg.addEventListener('mouseup', () => {
        svg.style['transform'] = 'translateY(0) scale(1, 1)';
      });
      replay.addEventListener('mousedown', () => {
        svg.style['transform'] = 'perspective(1000px) rotateY(-3deg)';
      });
      replay.addEventListener('mouseup', () => {
        svg.style['transform'] = 'perspective(0) rotateY(0)';
      });
    };

    const complete = () => {
      return;
      if (state === 'complete') return;
      if (state !== 'analyze') prepWave();
      state = 'complete';

      // final wave points
      const pk = data.peaks;
      const pkWidth = peakWidth;
      const peakH = (height - opt.barHUWave * heightUnit) / 2;
      const points = [];
      points.push({ x: 0, y: height / 2 });
      for (let i = 0; i < peakCount; i++)
        points.push({ x: (i + .5) * pkWidth, y: (1 - pk[i]) * peakH });
      points.push({ x: width, y: height / 2 });
      for (let i = peakCount - 1; i >= 0; i--)
        points.push({ x: (i + .5) * pkWidth, y: height - (1 - pk[i]) * peakH });

      const start = JSON.parse(JSON.stringify(p)); // deep copy
      const diff = new Array(points.length);
      for (let i = 0; i < points.length; i++)
        diff[i] = { x: points[i].x - p[i].x, y: points[i].y - p[i].y };

      let craf, t = 0, duration = 300, i;
      const render = (dt) => {
        t += dt;
        if (t >= duration) { t = duration; window.cancelAnimationFrame(craf); }

        for (i = 0; i < points.length; i++) {
          p[i].x = easeOutExp(t, start[i].x, diff[i].x, duration);
          p[i].y = easeOutExp(t, start[i].y, diff[i].y, duration);
        }

        if (azraf) window.cancelAnimationFrame(azraf);
        paintPoints(opt.barHUWave * .7);
        if (t == duration) interact();
      };

      let lastTime;
      const anim = (t) => {
        if (!t) { craf = window.requestAnimationFrame(anim); return; }
        if (!lastTime) lastTime = t;
        craf = window.requestAnimationFrame(anim);
        render(t - lastTime);
        lastTime = t;
      };
      // anim();
    };

    return { init, preload, analyze, complete };
  })();

  // event dispatchers
  const dispatch = (e) => { el.dispatchEvent(e); };
  const event = (type) => { dispatch(new Event(type)); };
  const error = (m) => {
    dispatch(new ErrorEvent('error', { message: `${m} (audio component)` }));
  };

  // playable checkpoint, requires computed peaks and audio playback element
  let readyToPlay = (c => () => { c -= 1; if (!c) draw.complete(); })(2);

  // extract peaks from decoded audio data at the set resolution
  const map = () => {
    const workerJS = `onmessage = (e) => {
      const ch = e.data.ch;
      const length = e.data.length;
      const bucketCount = e.data.bucketCount;
      const bucketSize = Math.ceil(length / bucketCount);
      let buckets = new Array(bucketCount);

      // divide samples into as many buckets as peaks can fit in width
      // average samples inside a bucket and across channels
      for (let i = 0, j, chAvg, bkt, bktI, bktAvg; i < length; i++) {
        // average of absolute values across all channels for sample i
        chAvg = 0;
        for (j = 0; j < ch.length; j++) chAvg += Math.abs(ch[j][i]);
        chAvg /= ch.length;

        // continuously save bucket average
        bkt = Math.floor(i / bucketSize);
        bktI = i % bucketSize;
        bktAvg = buckets[bkt];
        if (!bktAvg) { bktAvg = chAvg; }
        else { bktAvg = bktI / (bktI + 1) * bktAvg + 1 / (bktI + 1) * chAvg; }
        buckets[bkt] = bktAvg;
      }

      // normalize values to 0-1 interval
      const bktMax = Math.max(...buckets);
      const bktMin = Math.min(...buckets);
      let bktNorm = x => (x - bktMin) / (bktMax - bktMin);
      if (bktMax === bktMin) bktNorm = x => 0;
      buckets = buckets.map(bktNorm);

      postMessage(buckets);
    };`;

    // processing peaks may block main thread 3 sec or more, send to worker
    const workerBlob = new Blob([workerJS], { type: 'application/javascript' });
    const workerBlobURL = window.URL.createObjectURL(workerBlob);
    const worker = new Worker(workerBlobURL);
    worker.onerror = () => { error('Error inside peaks worker'); return; };
    worker.onmessage = (e) => {
      data.peaks = e.data;
      worker.terminate();
      window.URL.revokeObjectURL(workerBlobURL);
      readyToPlay();
    };

    const ch = new Array(data.pcm.numberOfChannels);
    for (let i = 0; i < ch.length; i++) ch[i] = data.pcm.getChannelData(i);
    const workerData = { ch, length: data.pcm.length, bucketCount: peakCount };
    worker.postMessage(workerData);
    draw.analyze();
  };

  const parseAudio = (encoded) => {
    const copy = encoded.slice(0);  // ff bug: empty arraybuffer after ac decode

    // decode audio data for waveform visual
    const ac = new AudioContext();
    const decodeOk = (pcm) => { data.pcm = pcm; map(); };
    const decodeErr = () => { error('Error decoding media'); };
    ac.decodeAudioData(encoded, decodeOk, decodeErr);

    // create media element for playback
    const audioExt = /\.(.+)$/.exec(src)[1];
    const audioBlob = new Blob([copy], { type: `audio/${audioExt}` });
    const audioBlobURL = window.URL.createObjectURL(audioBlob);
    audio = document.createElement('audio');
    audio.onload = () => { readyToPlay(); };
    audio.onsuspend = audio.onload; // may fire when fetching from cache
    audio.onerror = () => { error('Error passing data to audio element'); };
    audio.src = audioBlobURL;
  };

  // fetch raw audio media bytes
  const fetchData = () => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', src);
    xhr.responseType = 'arraybuffer';
    xhr.onprogress = (e) => { draw.preload(e.loaded / e.total); };
    xhr.onload = () => {
      if (xhr.status >= 400) { error(`HTTP error ${xhr.status}`); return; }
      parseAudio(xhr.response);
    };
    xhr.onerror = () => { error('Error fetching audio media'); };
    xhr.send();
  };

  // set global dimensions
  const dimension = () => {
    const style = window.getComputedStyle(el);
    width = parseInt(style['width'], 10);
    height = parseInt(style['height'], 10);
    heightUnit = min(flr(height / opt.waveHU), opt.heightUnitMax);
    peakCount = rou(width / opt.peakWidth);
    peakWidth = width / peakCount;
    let ok = !!width && !!height;
    ok = ok && heightUnit >= opt.heightUnitMin && peakCount >= opt.peakCountMin;
    if (!ok) { fallBack(); error('Error sizing'); return; }
    draw.init();
    fetchData();
  };

  // wait for el to be appended to parent node to get dimensions and first draw
  const checkParent = () => {
    if (el.parentNode) { dimension(); return; }
    window.requestAnimationFrame(checkParent);
  };

  checkParent();
  return el;
};
