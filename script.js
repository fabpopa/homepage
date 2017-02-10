// expects window.site.loading to contain a custom object
// expects window.site.raceLoad to contain an ID returned by setTimeout
// expects window.preload to contain a custom object after loading preload.js
// expects window.Display to contain a constructor function after display.js
// expects window.Director to contain a constructor function after director.js
// expects window.Cells to contain a constructor after loading cells.js

window.site.go = (attachStyle) => {
  const direct = new Director();

  // make cells
  direct.addStep((cb) => {
    // make canvas wrapper and elements
    const wrapper = document.createElement('div');
    wrapper.id = 'cells';
    const gradient = document.createElement('div');
    gradient.id = 'gradient';
    wrapper.appendChild(gradient);
    const location = document.querySelector('#introduction p');
    location.insertAdjacentElement('afterend', wrapper);

    // refresh everything, canvas requires steady dimensions
    const makeCells = (() => {
      let cells;
      return (canvas) => {
        // computed style may only be available on the next frame
        window.requestAnimationFrame(() => {
          if (cells) cells.cleanup();
          canvas.width = /\d+/.exec(getComputedStyle(canvas).width)[0];
          canvas.height = /\d+/.exec(getComputedStyle(canvas).height)[0];
          cells = new Cells(canvas);
        });
      };
    })();

    // wrapper element controls cells animation in response to custom events
    let canvas;
    wrapper.addEventListener('removecells', () => {
      gradient.style.display = 'none';
      wrapper.style.background = '#fbfbfb';
      if (canvas) wrapper.removeChild(canvas);
    });
    wrapper.addEventListener('makecells', () => {
      gradient.style.display = '';
      wrapper.style.background = '';
      cellsHidden = false;
      canvas = document.createElement('canvas');
      wrapper.appendChild(canvas);
      makeCells(canvas);
    });

    // refresh cells on resize
    let resizeTimer;
    let cellsHidden = false;
    window.addEventListener('resize', () => {
      // hide cells while resizing
      if (!cellsHidden) {
        wrapper.dispatchEvent(new Event('removecells'));
        cellsHidden = true;
      }

      // debounce resize event
      if (resizeTimer) window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        wrapper.dispatchEvent(new Event('makecells'));
      }, 400);
    });

    cb();
  });

  // make works
  direct.addStep((cb) => {
    // media overlay object


    // list of work items
    const makeWorks = (works) => {
      if (!works || !Object.keys(works).length) return;
      const wrapper = document.createElement('div');
      wrapper.id = 'works';
      const list = document.createElement('ul');
      wrapper.appendChild(list);

      Object.keys(works).forEach((type) => {
        works[type].forEach((item) => {
          const el = document.createElement('li');
          const a = document.createElement('a');
          a.href = `${type}/${item.id}`;
          a.id = `${type}-${item.id}`;
          a.innerHTML = item.title;
          a.data = item;
          el.appendChild(a);
          list.appendChild(el);
        });
      });

      const intro = document.querySelector('#introduction');
      intro.insertAdjacentElement('afterend', wrapper);
    };

    // fetch index of works
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'works/index.json');
    xhr.responseType = 'json';
    xhr.onload = () => { makeWorks(xhr.response); cb(); }
    xhr.onerror = () => { cb(); };
    xhr.send();
  });

  // prepare reveal
  direct.addStep((cb) => {
    cb();
  });

  // hide loading
  direct.addStep((cb) => {
    window.clearTimeout(window.site.raceLoad);
    window.site.loading.hide(() => {
      attachStyle();
      document.querySelector('#cells').dispatchEvent(new Event('makecells'));
      cb();
    });
  });

  // reveal
  direct.addStep((cb) => {
    cb();
  });

  direct.start();
};

(() => {
  // preload style
  const style = () => {
    preload.stylesheet('style.css', (att) => { window.site.go(att); });
  };

  // preload scripts
  const scripts = ['preload', 'director', 'display', 'cells'];
  const sCb = (c => () => { c -= 1; if (!c) style(); })(scripts.length);
  scripts.forEach((s) => {
    const el = document.createElement('script');
    el.onload = sCb;
    el.src = `js/${s}.js`;
    document.head.appendChild(el);
  });
})();
