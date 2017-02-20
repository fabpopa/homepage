const Audio = function(src) {
  const opt = {
    peakWidth: 20,      // pixels width for a peak on the sound curve
    barHeightMax: 20    // pixels height for the base bar
  };

  // convenience math functions
  const flr = x => Math.floor(x);
  const cei = x => Math.ceil(x);
  const abs = x => Math.abs(x);

  // HTMLElement to return
  const el = document.createElement('div');
  el.setAttribute('component', 'audio');
  el.style['width'] = '100%';
  el.style['height'] = '100%';

  // detect features
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const features = AudioContext && !!Audio && !!MutationObserver;

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

  //TODO build element

  // event dispatchers
  const dispatch = (e) => { el.dispatchEvent(e); };
  const event = (type) => { dispatch(new Event(type)); };
  const error = (m) => {
    //TODO display error state
    dispatch(new ErrorEvent('error', { message: m }));
  };

  const display = () => {

    //TODO hide progress if it's somehow stuck
  };

  // playing requires display peaks to be computed and Audio elem ready
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

    // divide samples into as many buckets as peaks can visually fit in width
    // average samples inside a bucket and across channels
    let buckets = new Array(bucketCount);
    const bucketSize = cei(data.pcm.length / bucketCount);
    const ch = new Array(data.pcm.numberOfChannels);
    for (let i = 0; i < ch.length; i++) ch[i] = data.pcm.getChannelData(i);
    for (let i = 0, j, chAvg, bkt, bktI, bktAvg; i < data.pcm.length; i++) {
      // get a channel average for abs values of samples in all channels at i
      chAvg = 0;
      for (j = 0; j < ch.length; j++) chAvg += abs(ch[j][i]);
      chAvg /= ch.length;

      // continuously save the bucket average of channel averages in the bucket
      bkt = flr(i / bucketSize);
      bktI = i % bucketSize;
      bktAvg = buckets[bkt];
      if (!bktAvg) { bktAvg = chAvg; }
      else { bktAvg = bktI / (bktI + 1) * bktAvg + 1 / (bktI + 1) * chAvg; }
      buckets[bkt] = bktAvg;
    }

    // normalize values to 0 - 1 interval
    const bktMax = Math.max(...buckets);
    const bktMin = Math.min(...buckets);
    let bktNorm = x => (x - bktMin) / (bktMax - bktMin);
    if (bktMax === bktMin) bktNorm = x => 1;
    buckets = buckets.map(bktNorm);

    data.peaks = buckets;
    readyToPlay();
  };

  // wave mapping checkpoint, requires parent node and the decoded PCM peaks
  let readyToMap = (c => () => { c -= 1; if (!c) map(); })(2);

  // decode audio data for waveform visual and create media elem for playback
  const parseAudio = (encoded) => {
    const ac = new AudioContext();
    const decodeOk = (pcm) => { data.pcm = pcm; readyToMap(); };
    const decodeErr = () => { error('Error decoding media'); };
    ac.decodeAudioData(encoded).then(decodeOk).catch(decodeErr);

    // const audio = new Audio();
    //TODO src and playback
    //readyToPlay();
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
