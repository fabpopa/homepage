const Audio = function(src) {
  const opt = {
    peakWidth: 20,          // pixels width for a peak on the sound curve
    peakCountMin: 3,        // count of peaks to display at a minimum
    heightUnitMin: 4,       // pixels height min for the height unit
    heightUnitMax: 16,      // pixels height max for the height unit
    barHULoading: .5,       // height unit multiple for bar when loading
    barHUWave: 1,           // height unit multiple for bar when part of wave
    waveHU: 5,              // height unit multiple for full waveform
    peakCurveHandle: 1,     // pixels length of bezier curve handle at peak
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

  // HTMLElement to return
  const el = document.createElement('div');
  el.setAttribute('component', 'audio');
  el.style['width'] = '100%';
  el.style['height'] = '100%';

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
  let width, height, heightUnit;
  let audio;

  // draw audio component in different states
  const draw = (() => {
    let state = 'none'; // none → init → reveal → load → analyze → complete
    let svg, bg, bar, clip, shape;

    // build SVG bezier curve
    const curve = (startX, startY) => {
      let d = `M ${startX},${startY}`;
      const bezier = (type, xC1, yC1, xC2, yC2, x, y) =>
        { d += ` ${type} ${xC1},${yC1} ${xC2},${yC2} ${x},${y}`; };
      const C = (...args) => { bezier('C', ...args); };
      const c = (...args) => { bezier('c', ...args); };
      const L = (x, y) => { d += ` L ${x},${y}`; };
      const l = (x, y) => { d += ` l ${x},${y}`; };
      const close = () => { d += ` Z`; return d; }
      return { C, c, l, close };
    };

    // set multiple attributes on an element
    const setAttr = (elem, attr) => {
      Object.keys(attr).forEach(k => { elem.setAttribute(k, attr[k]); });
    };

    const init = () => {
      if (state !== 'none') return;
      const svgNS = 'http://www.w3.org/2000/svg';
      const svgEl = (elem) => { return document.createElementNS(svgNS, elem); };
      svg = svgEl('svg');
      setAttr(svg, { 'width': width, 'height': height });
      g = svgEl('g');
      bg = svgEl('rect');
      bar = svgEl('path');
      clip = svgEl('clipPath');
      shape = svgEl('path');
      clip.id = `clip-${+Date.now()}${rou(rnd() * pow(10, 5))}`;
      setAttr(g, { 'clip-path': `url(#${clip.id})` });
      clip.appendChild(shape);
      g.appendChild(bg);
      g.appendChild(bar);
      svg.appendChild(clip);
      svg.appendChild(g);

      const barHeight = opt.barHULoading * heightUnit;
      const barHalf = barHeight / 2;
      const barCtl = barHalf * 4 / 3 * tan(PI / 8); // handles for circular end
      const barWidth = width * opt.loadingWidthRatio;
      const barWidthDiffHalf = width * (1 - opt.loadingWidthRatio) / 2;
      const cv = curve(barWidthDiffHalf, height / 2);
      cv.c(0, -barCtl, barHalf - barCtl, -barHalf, barHalf, -barHalf);
      cv.l(barWidth - 2 * barHalf, 0);
      cv.c(barCtl, 0, barHalf, barHalf - barCtl, barHalf, barHalf);
      cv.c(0, barCtl, -barHalf + barCtl, barHalf, -barHalf, barHalf);
      cv.l(-barWidth + 2 * barHalf, 0);
      cv.c(-barCtl, 0, -barHalf, -barHalf + barCtl, -barHalf, -barHalf);
      const loadShape = cv.close();
      setAttr(bg, { 'x': 0, 'y': 0, 'width': width, 'height': height });
      setAttr(bar, { 'd': loadShape });
      setAttr(shape, { 'd': loadShape });

      setAttr(bg, { 'fill': opt.bgColor });
      setAttr(bar, { 'fill': opt.barColor });
      bar.style['transform'] = 'translateX(-100%)';
      bar.style['transition'] = 'transform .3s';
      svg.style['opacity'] = 0;
      svg.style['transform'] = 'scale(.8, .8)';
      svg.style['transition'] = 'opacity .4s, transform .3s';

      el.appendChild(svg);
      state = 'init';
    };

    const reveal = () => {
      state = 'reveal';
      svg.style['opacity'] = 1;
      svg.style['transform'] = 'scale(1, 1)';
      svg.addEventListener('transitionend', function h() {
        state = 'load';
        svg.removeEventListener('transitionend', h);
      });
    };

    // progress param within 0-1 interval
    const seek = (progress) => {
      const position = rou(0 - 100 * (1 - progress));
      bar.style['transform'] = `translateX(${position}%)`;
    };

    const preload = (progress) => {
      if (state === 'init') { reveal(); return; }
      if (state !== 'reveal' && state !== 'load') return;
      seek(progress);
    }

    const analyze = () => {
      // straighten out progress bar layer
      // const cv = curve(0, 0);
      // cv.l(width, 0);
      // cv.l(0, height);
      // cv.l(-width, 0);
      // cv.l(0, -height);
      // const barShape = cv.close();
      // setAttr(bar, { 'd': barShape });


    };

    const complete = () => {

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
    const bucketCount = cei(width / opt.peakWidth);
    const ok = bucketCount >= opt.peakCountMin;
    if (!ok) { fallBack(); error('Error peak count'); return; }

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
    const workerData = { ch, length: data.pcm.length, bucketCount };
    worker.postMessage(workerData);
  };

  const parseAudio = (encoded) => {
    // decode audio data for waveform visual
    const ac = new AudioContext();
    const decodeOk = (pcm) => { data.pcm = pcm; map(); };
    const decodeErr = () => { error('Error decoding media'); };
    ac.decodeAudioData(encoded, decodeOk, decodeErr);

    // create media element for playback
    const audioExt = /\.(.+)$/.exec(src)[1];
    const audioBlob = new Blob([encoded], { type: `audio/${audioExt}` });
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
      draw.analyze();
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
    const ok = !!width && !!height && heightUnit >= opt.heightUnitMin;
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
