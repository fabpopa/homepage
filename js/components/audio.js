// audio player component with waveform, progress, and playback control
const Audio = function(src) {
  const opt = {
    peakWidth: 17,          // pixels width for a peak on the sound curve
    peakCountMin: 3,        // count of peaks to display at a minimum
    heightUnitMin: 4,       // pixels height min for the height unit
    heightUnitMax: 16,      // pixels height max for the height unit
    barHULoading: .4,       // height unit multiple for bar when loading
    barHUWave: 1,           // height unit multiple for bar when part of wave
    waveHU: 5,              // height unit multiple for full waveform
    peakCurveHandle: 8,     // pixels length of bezier curve handle at peak
    loadingWidthRatio: .5,  // width ratio of bar when loading to full waveform
    bgColor: '#f8f2f2',
    barColor: '#add8e6'
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
  const easeInOutExp = (t, b, c, d) => {
    if (t == 0) return b;
    if (t == d) return b + c;
    if ((t /= d / 2) < 1) return c / 2 * pow(2, 10 * (t - 1)) + b;
    return c / 2 * (-pow(2, -10 * --t) + 2) + b;
  };

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
  const features = AudioContext && !!Audio && !!Worker && !!MutationObserver;

  // fall back to audio element if web audio api unavailable
  if (!features) { fallBack(); return el; }

  // component state
  const data = { pcm: null, peaks: null };
  let width, height, heightUnit, peakCount, peakWidth;
  let audio;

  // event dispatchers
  const dispatch = (e) => el.dispatchEvent(e);
  const event = (type) => dispatch(new Event(type));
  const error = (m) =>
    dispatch(new ErrorEvent('error', { message: `${m} (audio component)` }));

  // draw audio component in different states
  const draw = (() => {
    let state = 'none'; // none → init → load → analyze → complete
    let svg, bar, clip, replay; // DOM elements
    let pt; // array of (2 * peakCount + 2) {x, y} point coords (left, t, r, b)
    let tw; // global tween for visual transition from partial states

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

    // make balloon-like shape that morphs from loading bar to audio waveform
    // ctl params are bezier handle lengths for the 2 ends, 4 corners, and peaks
    const shape = (eCtl, cCtl, pCtl, p) => {
      if (isNaN(eCtl + cCtl + pCtl)) return;
      if (!p) p = pt;
      let i, v = curve(p[0].x, p[0].y); // start at left end
      v.C(p[0].x, p[0].y - eCtl, p[1].x - cCtl, p[1].y, p[1].x, p[1].y);
      for (i = 2; i <= peakCount; i++)
        v.C(p[i-1].x + pCtl, p[i-1].y, p[i].x - pCtl, p[i].y, p[i].x, p[i].y);
      i = peakCount + 1; // right end
      v.C(p[i-1].x + cCtl, p[i-1].y, p[i].x, p[i].y - eCtl, p[i].x, p[i].y);
      i += 1; // right bottom corner
      v.C(p[i-1].x, p[i-1].y + eCtl, p[i].x + cCtl, p[i].y, p[i].x, p[i].y);
      for (i = peakCount + 3; i < p.length; i++)
        v.C(p[i-1].x - pCtl, p[i-1].y, p[i].x + pCtl, p[i].y, p[i].x, p[i].y);
      i = p.length - 1; // left bottom corner
      v.C(p[i].x - cCtl, p[i].y, p[0].x, p[0].y + eCtl, p[0].x, p[0].y);
      return v.close();
    };

    // tweening helper, keeps running something each frame until some completion
    const tween = () => {
      let act, done, raf, lastTime, dt, frame, frameJankLimit = 50;

      const stop = (done) => {
        window.cancelAnimationFrame(raf);
        raf = null;
        lastTime = null;
        if (done) done();
      };

      const step = (time) => {
        raf = window.requestAnimationFrame(step);
        if (!time) return;
        if (!lastTime) lastTime = time;
        frame = time - lastTime
        lastTime = time;
        if (frame > frameJankLimit) { stop(); act(false); return; } // high jank
        dt += frame;
        if (act(dt)) stop(done);
      };

      // param fn(dt) must return true when complete and false otherwise
      // eg. tween(fn) will call fn(dt) every frame until it returns true
      // eg. tween(fn, cb) is like tween(fn) and calls cb() when complete
      // note fn(false) will be called to signal a high-jank situation and retry
      return (fn, cb) => { act = fn; done = cb; dt = 0; if (!raf) step(); };
    };

    const init = () => {
      if (state !== 'none') return;
      const svgNS = 'http://www.w3.org/2000/svg';
      const svgEl = (el) => document.createElementNS(svgNS, el);
      svg = svgEl('svg');
      const defs = svgEl('defs');
      const clipPath = svgEl('clipPath');
      clipPath.id = `clip-${+Date.now()}${rou(rnd() * pow(10, 5))}`;
      clip = svgEl('path');
      const g = svgEl('g');
      setAttr(g, { 'clip-path': `url(#${clipPath.id})` });
      const bg = svgEl('rect');
      bar = svgEl('path');
      defs.appendChild(clipPath);
      clipPath.appendChild(clip);
      g.appendChild(bg);
      g.appendChild(bar);
      svg.appendChild(defs);
      svg.appendChild(g);

      setAttr(svg, { 'width': width, 'height': height });
      setAttr(bg, { 'x': 0, 'y': 0, 'width': width, 'height': height });
      setAttr(bg, { 'fill': opt.bgColor });
      setAttr(bar, { 'fill': opt.barColor });
      svg.style['opacity'] = 0;
      svg.style['transform'] = 'scale(.5, .5)';
      svg.style['transition'] = 'opacity .4s, transform .3s';

      replay = document.createElement('div');
      replay.style['position'] = 'absolute';
      replay.style['top'] = '0';
      replay.style['min-width'] = '25px';
      replay.style['width'] = '7%';
      replay.style['height'] = '100%';

      el.appendChild(svg);
      el.appendChild(replay);
      pt = new Array(2 * peakCount + 2);
      for (let i = 0; i < pt.length; i++) pt[i] = { x: null, y: null };
      tw = tween();
      state = 'init';
    };

    let preload = (() => {
      let barWidth, barX, barY, barHHalf, barCtl, barStraightPart;
      let pL, pN, pD; // points last, next, diff
      let twDur = 500, lastProgress = -1;

      // updates pN to new points
      const pts = (barStraightPart) => {
        let peakSpace = barStraightPart / (peakCount - 1), i;
        pN[0].x = barX;
        pN[0].y = barY;
        for (i = 1; i <= peakCount; i++) {
          pN[i].x = barX + barHHalf + (i - 1) * peakSpace;
          pN[i].y = barY - barHHalf;
        }
        pN[i].x = barX + 2 * barHHalf + barStraightPart;
        pN[i].y = barY;
        for (i += 1; i < pN.length; i++) {
          pN[i].x = barX + barHHalf + barStraightPart;
          pN[i].y = barY + barHHalf;
          barStraightPart -= peakSpace;
        }
        return pN;
      };

      const initAndReveal = () => {
        barWidth = width * opt.loadingWidthRatio;
        barX = (width - barWidth) / 2;
        barY = height / 2;
        barHHalf = opt.barHULoading * heightUnit / 2;
        barCtl = barHHalf * 4 / 3 * tan(PI / 8); // circle quarter arc
        barStraightPart = barWidth - 2 * barHHalf;
        pN = new Array(pt.length);
        for (let i = 0; i < pt.length; i++) pN[i] = { x: null, y: null };
        pD = new Array(pt.length);
        for (let i = 0; i < pt.length; i++) pD[i] = { x: null, y: null };
        setAttr(clip, { 'd': shape(barCtl, barCtl, 0, pts(barStraightPart)) });
        pts(0);
        pN.forEach((p, i) => { pt[i].x = p.x; pt[i].y = p.y; });
        svg.style['opacity'] = 1;
        svg.style['transform'] = 'scale(1, 1)';
      };

      const move = (progress, done) => {
        pL = new Array(pt.length); // deep copy latest points
        pts(barStraightPart * progress); // update pN
        for (let i = 0; i < pt.length; i++) {
          pL[i] = { x: pt[i].x, y: pt[i].y };
          pD[i].x = pN[i].x - pL[i].x;
          pD[i].y = pN[i].y - pL[i].y;
        }

        const act = (dt) => {
          if (dt === false) { move(progress, done); return; }
          if (dt > twDur) dt = twDur;
          for (let i = 0; i < pt.length; i++) {
            pt[i].x = easeInOutExp(dt, pL[i].x, pD[i].x, twDur);
            pt[i].y = easeInOutExp(dt, pL[i].y, pD[i].y, twDur);
          }
          setAttr(bar, { 'd': shape(barCtl, barCtl, 0) });
          if (dt == twDur) return true;
          return false;
        };

        tw(act, done);
      };

      return (progress, cb) => {
        if (progress < lastProgress) return;
        if (state === 'init') { initAndReveal(); state = 'load'; }
        if (state !== 'load') return;
        lastProgress = progress;
        if (progress < 1) { move(progress); return; }
        move(1, () => { state = 'analyze'; if (cb) cb(); });
      };
    })();

    const prepWave = () => {
      // blow up progress bar layer
      const cv = curve(0, 0);
      cv.l(width, 0);
      cv.l(0, height);
      cv.l(-width, 0);
      cv.l(0, -height);
      setAttr(bar, { 'd': cv.close() });
    };

    const analyze = () => {
      if (state === 'load') { preload(1, analyze); return; }
      if (state !== 'analyze') return;
      state = 'analyze';
      prepWave();

      const pL = new Array(pt.length); // deep copy current points
      for (let i = 0; i < pt.length; i++) pL[i] = { x: pt[i].x, y: pt[i].y };
      const barHeight = opt.barHULoading * heightUnit;
      const barHHalf = barHeight / 2;
      const barCtl = barHHalf * 4 / 3 * tan(PI / 8);
      const startX = pL[0].x;
      const endX = pL[pt.length / 2].x;
      const barWidth = endX - startX;
      const amplitude = barHeight / 4;
      const period = 50; // pixels corresponding to 2*PI sine period
      const velocity = 50; // pixels per second
      const cycle = period / velocity * 1000; // msec to complete a sine period
      let entry = 0, entryDur = 800, periodAndPhase;

      const act = (dt) => {
        if (dt === false) { tw(act); return; }
        if (entry < endX) entry = easeInOutExp(dt, startX, barWidth, entryDur);
        dt %= cycle;
        for (let i = 0; i <= pt.length / 2; i++)
          if (pL[i].x <= entry) {
            periodAndPhase = -PI / 4 + dt / cycle + (pL[i].x - startX) / period;
            pt[i].y = pL[i].y + amplitude * sin(periodAndPhase * 2 * PI);
            if (i == 0 || i == pt.length / 2) continue;
            pt[pt.length - i].y = pt[i].y + barHeight;
          }
        setAttr(clip, { 'd': shape(barCtl, barCtl, 0) });
        return false; // runs indefinitely until superseded by another act fn
      };

      tw(act);
    };

    const interact = () => {
      svg.style['cursor'] = 'pointer';
      replay.style['cursor'] = 'pointer';
      svg.style['transition'] = 'transform .1s';
      bar.style['transition'] = 'transform .1s cubic-bezier(.19, 1, .22, 1)';
      svg.addEventListener('mousedown', () => {
        svg.style['transform'] = 'translateY(1px) scale(.99, .99)';
      });
      svg.addEventListener('mouseup', () => {
        svg.style['transform'] = 'translateY(0) scale(1, 1)';
        if (audio.currentTime === 0 || audio.ended) {
          bar.style['transform'] = `translateX(-100%)`;
          window.setTimeout(() => {
            audio.play();
            bar.style['transition'] = '';
          }, 300);
          return;
        }
        if (audio.paused) { audio.play(); return; }
        audio.pause();
      });
      replay.addEventListener('mousedown', () => {
        svg.style['transform'] = 'perspective(1000px) rotateY(-4deg)';
        if (audio.currentTime !== 0) audio.currentTime = 0;
      });
      replay.addEventListener('mouseup', () => {
        svg.style['transform'] = 'perspective(0) rotateY(0)';
      });

      let raf, pos;
      audio.addEventListener('timeupdate', () => {
        if (!raf) raf = requestAnimationFrame(() => {
          pos = width * (1 - audio.currentTime / audio.duration);
          bar.style['transform'] = `translateX(-${pos}px)`;
          raf = null;
        });
      });
    };

    const complete = () => {
      if (state === 'none') return;
      if (state !== 'analyze' && state !== 'complete') prepWave();
      state = 'complete';

      // if complete is the first thing called after init, set point start
      if (pt[0].x === null)
        for (let i = 0; i < pt.length; i++)
          { pt[i].x = width / 2; pt[i].y = height / 2; }

      const peakH = (height - opt.barHUWave * heightUnit) / 2;
      const barCtl = opt.barHUWave * heightUnit / 2 * 4 / 3 * tan(PI / 8);
      const pL = new Array(pt.length);
      const pN = new Array(pt.length);
      const pD = new Array(pt.length);

      // final waveform points
      pN[0] = { x: 0, y: height / 2 };
      for (let i = 0; i < peakCount; i++)
        pN[i + 1] = { x: (i + .5) * peakWidth, y: (1 - data.peaks[i]) * peakH };
      pN[pt.length / 2] = { x: width, y: height / 2 };
      for (let i = peakCount - 1; i >= 0; i--)
        pN[pt.length - i - 1] = {
          x: (i + .5) * peakWidth,
          y: height - (1 - data.peaks[i]) * peakH
        };

      // current and diff points
      for (let i = 0; i < pt.length; i++) {
        pL[i] = { x: pt[i].x, y: pt[i].y };
        pD[i] = { x: pN[i].x - pL[i].x, y: pN[i].y - pL[i].y };
      }

      const twDur = 300;
      const act = (dt) => {
        if (dt === false) { complete(); return; }
        if (dt > twDur) dt = twDur;
        for (let i = 0; i < pt.length; i++) {
          pt[i].x = easeInOutExp(dt, pL[i].x, pD[i].x, twDur);
          pt[i].y = easeInOutExp(dt, pL[i].y, pD[i].y, twDur);
        }
        setAttr(clip, { 'd': shape(barCtl, 0, opt.peakCurveHandle) });
        if (dt == twDur) return true;
        return false;
      };

      tw(act, interact);
    };

    return { init, preload, analyze, complete };
  })();

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
    draw.analyze();
    const ch = new Array(data.pcm.numberOfChannels);
    for (let i = 0; i < ch.length; i++) ch[i] = data.pcm.getChannelData(i);
    const workerData = { ch, length: data.pcm.length, bucketCount: peakCount };
    worker.postMessage(workerData);
  };

  const parseAudio = (encoded) => {
    const copy = encoded.slice(0);  // ff bug: empty arraybuffer after ac decode

    // decode audio data for waveform visual
    const ac = new AudioContext();
    const decodeOk = (pcm) => { data.pcm = pcm; map(); };
    const decodeErr = () => error('Error decoding media');
    ac.decodeAudioData(encoded, decodeOk, decodeErr);

    // create media element for playback
    const audioExt = /\.(.+)$/.exec(src)[1];
    const audioBlob = new Blob([copy], { type: `audio/${audioExt}` });
    const audioBlobURL = window.URL.createObjectURL(audioBlob);
    audio = document.createElement('audio');
    audio.onload = () => readyToPlay();
    audio.onsuspend = audio.onload; // may fire when fetching from cache
    audio.onerror = () => error('Error passing data to audio element');
    audio.src = audioBlobURL;
  };

  // fetch raw audio media bytes
  const fetchData = () => {
    const xhr = new XMLHttpRequest();
    xhr.open('GET', src);
    xhr.responseType = 'arraybuffer';
    xhr.onprogress = (e) => draw.preload(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 400) { error(`HTTP error ${xhr.status}`); return; }
      parseAudio(xhr.response);
    };
    xhr.onerror = () => error('Error fetching audio media');
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
    const cleanup = (ob) => { ob.disconnect(); if (audio) audio.pause(); };
    const ob = new MutationObserver(() => { cleanup(ob); });
    ob.observe(el.parentNode, { childList: true });
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
