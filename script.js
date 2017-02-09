// expects window.site.loading to contain a custom object
// expects window.site.raceLoad to contain an ID returned by setTimeout
// expects window.preload to contain a custom object after loading preload.js
// expects window.Display to contain a constructor function after display.js
// expects window.Director to contain a constructor function after director.js
// expects window.site.cells to contain a custom object after loading cells.js

(() => {
  const reveal = () => {

  };

  const makeItems = () => {
    // make canvas wrapper and elements
    const cellWrap = document.createElement('div');
    cellWrap.id = 'cells';
    const gradient = document.createElement('div');
    gradient.id = 'gradient';
    cellWrap.appendChild(gradient);
    const location = document.querySelector('#introduction p');
    location.insertAdjacentElement('afterend', cellWrap);

    // refresh cells animation as it requires steady canvas width and height
    const makeCells = (() => {
      let cells;
      return (canvas, cb) => {
        // computed style information will only be available on the next frame
        window.requestAnimationFrame(() => {
          if (cells) cells.cleanup();
          canvas.width = /\d+/.exec(getComputedStyle(canvas).width)[0];
          canvas.height = /\d+/.exec(getComputedStyle(canvas).height)[0];
          cells = new Cells(canvas, cb);
        });
      };
    })();

    let canvas;
    const refreshCanvas = () => {
      canvas = document.createElement('canvas');
      cellWrap.appendChild(canvas);
      makeCells(canvas);
    };

    // refresh cells on resize
    let resizeTimer;
    let cellsHidden = false;
    window.addEventListener('resize', () => {
      // hide cells while resizing
      if (!cellsHidden) {
        gradient.style.display = 'none';
        cellWrap.style.background = '#fbfbfb';
        if (canvas) cellWrap.removeChild(canvas);
        cellsHidden = true;
      }

      // debounce resize event
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        gradient.style.display = '';
        cellWrap.style.background = '';
        cellsHidden = false;
        refreshCanvas();
      }, 400);
    });

    refreshCanvas();
  };

  const prepStyle = () => {
    preload.stylesheet('style.css', (attach) => {
      makeItems();

      // prepare for reveal

      // clear raceLoad, hide loading, remove display none on body elements
      window.clearTimeout(window.site.raceLoad);
      window.site.loading.hide(() => { attach(); reveal(); });
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
