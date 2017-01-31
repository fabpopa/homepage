// asset preloader to reliably put things in browser cache
const preload = (() => {
  // confirm browser environment
  try { window.document } catch (e) { return; }

  // invisible container for preloaded elements
  const p = document.createElement('div');
  p.style.cssText =
    'position:fixed;width:0;height:0;top:-1px;left:-1px;overflow:hidden';
  document.body.appendChild(p);

  const img = (url, doneCb, errCb) => {
    const i = document.createElement('img');
    i.onload = () => { p.removeChild(i); if (doneCb) doneCb(); };
    i.onerror = () => { p.removeChild(i); if (errCb) errCb(); };
    i.src = url;
    p.appendChild(i);
  };

  const video = (url, doneCb, errCb) => {
    let checkInterval;
    const v = document.createElement('video');
    const clear = () => {
      window.clearInterval(checkInterval);
      v.onprogress = null;
      v.onsuspend = null;
      v.onerror = null;
      p.removeChild(v);
    };
    const resetTimeout = () => {
      window.clearInterval(checkInterval);
      checkInterval = window.setInterval(() => {
        if (!v.readyState || !v.buffered.length) v.onerror();
      }, 10000);
    };
    v.autoplay = true;
    v.muted = true;
    v.preload = 'auto';
    v.onprogress = () => {
      resetTimeout();
      if (!v.buffered.length) return;
      if (v.buffered.end(0) === v.duration) { clear(); if (doneCb) doneCb(); }
    };
    v.onsuspend = () => {
      clear();
      let xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.responseType = 'blob';
      xhr.onreadystatechange = () => {
        if (xhr.readyState === xhr.HEADERS_RECEIVED) {
          let status = xhr.status;
          xhr.abort();
          if (status >= 200 && status < 300) { if (doneCb) doneCb(); }
          else { if (errCb) errCb(); }
        }
      };
      xhr.onerror = () => { if (errCb) errCb(); };
      xhr.send();
    };
    v.onerror = () => { clear(); if (errCb) errCb(); };
    v.src = url;
    p.appendChild(v);
    resetTimeout();
  };

  const font = (url, onComplete, onError) => {

  };

  const fromStylesheet = () => {

  };

  return {
    img: img,
    video: video,
    font: font,
    fromStylesheet: fromStylesheet
  };
})();
