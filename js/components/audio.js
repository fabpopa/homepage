const Audio = function(src) {
  // options
  const opt = {
    peakWidth: 20,      // pixels width for a peak on the sound curve
    peakCountMin: 3,    // count of peaks to display at a minimum
    heightUnitMin: 4,   // pixels height min for the height unit
    heightUnitMax: 30,  // pixels height max for the height unit
    barHULoading: 2,    // height unit multiple for bar when loading
    barHUWave: 1,       // height unit multiple for bar when part of waveform
    waveHU: 5,          // height unit multiple for full waveform
    peakCurveHandle: 1  // pixels length of bezier curve handle at tip of peak
  };

  // convenience math functions
  const flr = x => Math.floor(x);
  const cei = x => Math.ceil(x);
  const min = (x, y) => Math.min(x, y);

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
    return el;
  };

  // detect features
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const features = AudioContext && !!Audio && !!Worker && !!Blob;

  // fall back to audio element if web audio api unavailable
  if (!features) fallBack();

  // state
  const data = { pcm: null, peaks: null };
  let width, height, heightUnit;
  let audio;

  // draw audio component in different states
  const draw = (() => {
    // progress param within 0-1 interval
    const preload = (progress) => {};

    const analyze = () => {};

    const complete = () => {};

    return { preload, analyze, complete };
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
    ac.decodeAudioData(encoded).then(decodeOk).catch(decodeErr);

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
    draw.preload(0);
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
