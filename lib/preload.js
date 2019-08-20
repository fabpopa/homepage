g = g || {};

// asset preloader to reliably put things in browser cache
g.preload = (() => {
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
      // straight from cache, establish validity
      clear();
      const xhr = new XMLHttpRequest();
      xhr.open('GET', url);
      xhr.responseType = 'blob';
      xhr.onreadystatechange = () => {
        if (xhr.readyState === xhr.HEADERS_RECEIVED) {
          const status = xhr.status;
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

  // src is of the form 'url(...)'
  // ffd is the FontFaceDescriptors object in the CSS Font Loading spec
  // with additional 'family', 'src', and '_original' properties
  // ffd._original is the '@font-face {...}' string if FontFace not available
  // provide optional fontGlyphs if latin chars and punctuation are not in font
  const font = (ffd, doneCb, errCb, fontGlyphs) => {
    const native = () => {
      // define font, add, preload, then delete (required for Chrome bug)
      const f = new FontFace(ffd.family, ffd.src, ffd);
      document.fonts.add(f);
      f.load().then(() => { document.fonts.delete(f); doneCb(); }).catch(errCb);
    };

    const simulated = () => {
      if (!ffd._original) throw new Error('Fallback, ffd._original required.');
      if (!fontGlyphs) fontGlyphs = 'x-1;,.@';
      const s = document.createElement('style');
      s.innerHTML = ffd._original;
      document.head.appendChild(s);
      const el = document.createElement('p');
      const propRe = /font-.+?;/g;
      let match;
      while (match = propRe.exec(ffd._original)) el.style.cssText += match[0];
      el.innerHTML = fontGlyphs;
      p.appendChild(el);

      // load font file redundantly to get an event after enough time
      const clean = () => { document.head.removeChild(s); p.removeChild(el); };
      const xhr = new XMLHttpRequest();
      xhr.open('GET', /url\(['"]?(.+?)['"]?\)/.exec(ffd.src)[1]);
      xhr.responseType = 'blob';
      xhr.onload = () => { clean(); if (doneCb) doneCb(); };
      xhr.onerror = () => { clean(); if (errCb) errCb(); }
      xhr.send();
    };

    if (window.FontFace) { native(); } else { simulated(); }
  };

  // doneCb will be called with another fn to attach the style doneCb(attachCb)
  // provide optional fontGlyphs if latin chars and punctuation are not in font
  const stylesheet = (url, doneCb, errCb, fontGlyphs) => {
    const complete = (txt) => {
      const s = document.createElement('style');
      s.innerHTML = `/* attached by stylesheet preloader */\n${txt}`;
      if (doneCb) doneCb(() => { document.head.appendChild(s); });
    };

    const fetchAssets = (txt) => {
      let match;

      const fonts = [];
      const fontRe = /@font-face[\s\S]*?}/g;
      const fontPropRe = /(font-)?([^: ]+?) ?: ?(.+?);/g;
      while (match = fontRe.exec(txt)) {
        let prop, obj = {};
        obj['_original'] = match[0].replace(/[\r\n]/g, ''); // strip newlines
        while (prop = fontPropRe.exec(obj['_original']))
          obj[prop[2].replace(/-./g, s => s[1].toUpperCase())] = prop[3];
        if (obj.family && obj.src) fonts.push(obj);
      }

      const images = [];
      const imgRe = /url\(['"]?(.+?).(tif|jpg|jpeg|png|gif|svg|webp)['"]?\)/gi;
      while (match = imgRe.exec(txt)) images.push(`${match[1]}.${match[2]}`);

      let count = fonts.length + images.length;
      if (!count) { complete(txt); return; }

      const dCb = () => { count -= 1; if (!count) complete(txt); };
      const eCb = () => { if (errCb && count !== -1) { count = -1; errCb(); } };
      fonts.forEach((f) => { font(f, dCb, eCb, fontGlyphs); });
      images.forEach((i) => { img(i, dCb, eCb); });
    };

    // fetch stylesheet data
    const xhr = new XMLHttpRequest();
    xhr.open('GET', url);
    xhr.onload = () => {
      // remove CSS comments and preload any linked assets individually
      let txt = xhr.responseText.replace(/\/\*[\s\S]*?\*\//g, '');
      fetchAssets(txt);
    };
    xhr.onerror = () => { if (errCb) errCb(); };
    xhr.send();
  };

  return {
    img: img,
    video: video,
    font: font,
    stylesheet: stylesheet
  };
})();
