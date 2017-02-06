// expects window.site.loading to contain a custom object
// expects window.site.raceLoad to contain an ID returned by setTimeout
// expects window.preload to contain a custom object after loading preload.js
// expects window.Display to contain a constructor function after display.js
// expects window.Director to contain a constructor function after director.js
// expects window.site.cells to contain a custom object after loading cells.js

(() => {
  const header = document.querySelector('h1');
  const message = document.querySelector('p');
  const social = document.querySelectorAll('li');

  const reveal = (attach) => {
    // attach();
  };

  const prepStyle = () => {
    preload.stylesheet('style.css', (attach) => {
      // prepare for reveal
      [header, message, ...social].forEach((e) => { e.style.opacity = 0; });

      // clear raceLoad and hide loading
      window.clearTimeout(window.site.raceLoad);
      window.site.loading.hide(() => { reveal(attach); });
    });
  };

  // attach scripts
  const scripts = ['preload', 'director', 'display', 'cells'];
  const sCb = (c => () => { c -= 1; if (!c) prepStyle(); })(scripts.length);
  scripts.forEach((s) => {
    const el = document.createElement('script');
    el.onload = sCb;
    el.src = `js/${s}.js`;
    document.head.appendChild(el);
  });
})();
