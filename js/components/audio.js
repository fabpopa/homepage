const Audio = function(src) {
  const opt = {
    peakWidth: 20,      // pixels width for a peak on the sound curve
    barHeightMax: 20    // pixels height for the base bar
  };

  // convenience math functions
  const flr = x => Math.floor(x);
  const cei = x => Math.ceil(x);

  // HTMLElement to return
  const el = document.createElement('div');
  el.setAttribute('component', 'audio');
  el.style['width'] = '100%';
  el.style['height'] = '100%';

  // detect features
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const features = AudioContext && !!Audio && !!Worker && !!Blob;

  // fall back to audio element if web audio api unavailable
  if (!features) {
    const fallBack = document.createElement('audio');
    fallBack.setAttribute('controls', '');
    fallBack.src = src;
    const fallBackLink = document.createElement('a');
    fallBackLink.href = src;
    fallBackLink.innerHTML = 'Download here';
    fallBack.appendChild(fallBackLink);
    el.appendChild(fallBack);
    return el;
  }

  // state
  const data = { pcm: null, peaks: null };
  let audio;

  //TODO build element

  // event dispatchers
  const dispatch = (e) => { el.dispatchEvent(e); };
  const event = (type) => { dispatch(new Event(type)); };
  const error = (m) => {
    //TODO display error state
    dispatch(new ErrorEvent('error', { message: m }));
  };

  const display = () => {
    console.log('ready to play');
    console.log(data.peaks);
    //TODO hide progress if it's somehow stuck
  };

  // playable checkpoint, requires computed peaks and audio playback element
  let readyToPlay = (c => () => { c -= 1; if (!c) display(); })(2);

  // extract peaks from decoded audio data at the set resolution
  const map = () => {
    const style = window.getComputedStyle(el);
    const width = parseInt(style['width'], 10);
    const height = parseInt(style['height'], 10);
    const bucketCount = cei(width / opt.peakWidth);
    if (!width || !height || bucketCount < 3) {
      error('Error sizing audio component');
      return;
    }

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

    // processing peaks may take 3 sec or more, send to separate worker thread
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

  // wave mapping checkpoint, requires parent node and decoded PCM peaks
  let readyToMap = (c => () => { c -= 1; if (!c) map(); })(2);

  const parseAudio = (encoded) => {
    // decode audio data for waveform visual
    const ac = new AudioContext();
    const decodeOk = (pcm) => { data.pcm = pcm; readyToMap(); };
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

  const downloadProgress = (e) => {
    // console.log(e.lengthComputable);
    // console.log(Math.round(e.loaded / e.total * 100));
  };

  // fetch raw audio media bytes
  const xhr = new XMLHttpRequest();
  xhr.open('GET', src);
  xhr.responseType = 'arraybuffer';
  xhr.onprogress = downloadProgress;
  xhr.onload = () => {
    if (xhr.status >= 400) { error(`HTTP error ${xhr.status}`); return; }
    parseAudio(xhr.response);
  };
  xhr.onerror = () => { error('Error fetching audio media'); };
  xhr.send();

  // wait for el to be appended to parent node to get dimensions and first draw
  const checkParent = () => {
    if (el.parentNode) { readyToMap(); return; }
    window.requestAnimationFrame(checkParent);
  };

  checkParent();
  return el;
};
