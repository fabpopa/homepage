// expects window.site.loading to contain a custom object
// expects window.site.raceLoad to contain an ID returned by setTimeout
// expects window.site.cells to contain custom object after loading cells.js

const scriptsOk = () => {
  // when all done, clear raceLoad, hide loading, start reveal, remove hideAll

  window.clearTimeout(window.site.raceLoad);
  window.site.loading.hide();
};

// attach scripts
const scripts = ['preload', 'director', 'display', 'cells'];
const scriptCb = (c => () => { c -= 1; if (!c) scriptsOk(); })(scripts.length);
scripts.forEach((s) => {
  const el = document.createElement('script');
  el.onload = scriptCb;
  el.src = `js/${s}.js`;
  document.head.appendChild(el);
});
