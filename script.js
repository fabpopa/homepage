// expects window.site.loading to contain a custom object
// expects window.site.raceLoad to contain an ID returned by setTimeout
// expects window.preload to contain a custom object after loading preload.js
// expects window.Display to contain a constructor function after display.js
// expects window.Director to contain a constructor function after director.js
// expects window.site.cells to contain a custom object after loading cells.js

(() => {
  const styleOk = (attach) => {
    // start reveal
    attach();
  };

  const scriptsOk = () => {
    preload.stylesheet('style.css', (attach) => {
      // clear raceLoad and hide loading
      window.clearTimeout(window.site.raceLoad);
      window.site.loading.hide(() => { styleOk(attach); });
    });
  };

  // attach scripts
  const scripts = ['preload', 'director', 'display', 'cells'];
  const sCb = (c => () => { c -= 1; if (!c) scriptsOk(); })(scripts.length);
  scripts.forEach((s) => {
    const el = document.createElement('script');
    el.onload = sCb;
    el.src = `js/${s}.js`;
    document.head.appendChild(el);
  });
})();
