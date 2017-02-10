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

    // wrapper element controls cells animation in response to custom events
    let canvas, cells;
    wrapper.addEventListener('removecells', () => {
      gradient.style.display = 'none';
      wrapper.style.background = '#fbfbfb';
      if (canvas) wrapper.removeChild(canvas);
      if (cells) { cells.cleanup(); cells = null; }
    });
    wrapper.addEventListener('makecells', () => {
      gradient.style.display = '';
      wrapper.style.background = '';
      cellsHidden = false;
      canvas = document.createElement('canvas');
      wrapper.appendChild(canvas);
      window.requestAnimationFrame(() => {
        canvas.width = /\d+/.exec(getComputedStyle(canvas).width)[0];
        canvas.height = /\d+/.exec(getComputedStyle(canvas).height)[0];
        cells = new Cells(canvas);
      });
    });
    wrapper.addEventListener('pause', () => { if (cells) cells.pause(); });
    wrapper.addEventListener('unpause', () => { if (cells) cells.unpause(); });

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
    const media = (() => {
      const sheet = document.createElement('div');
      sheet.id = 'media';
      const close = document.createElement('button');
      close.className = 'close';
      close.innerHTML = '&times;'
      sheet.appendChild(close);
      const wrapper = document.createElement('div');
      sheet.appendChild(wrapper);
      const title = document.createElement('h3');
      wrapper.appendChild(title);
      const description = document.createElement('p');
      wrapper.appendChild(description);

      const show = (work, hash) => {
        if (!work) return;
        if (!work.title) work.title = '';
        if (!work.description) work.description = '';
        title.innerHTML = work.title;
        description.innerHTML = work.description;
        document.querySelector('#cells').dispatchEvent(new Event('pause'));
        if (!document.body.contains(sheet)) document.body.appendChild(sheet);
        window.location.hash = hash;
      };

      const hide = () => {
        document.querySelector('#cells').dispatchEvent(new Event('unpause'));
        if (document.body.contains(sheet)) document.body.removeChild(sheet);
        window.location.hash = '';
      };

      close.onclick = (e) => { e.preventDefault(); hide(); };
      return { show, hide };
    })();

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
          const hash = `#${type}/${item.id}`
          a.href = hash;
          a.id = `${type}-${item.id}`;
          a.innerHTML = item.title;
          a.data = item;
          a.onclick = (e) => { e.preventDefault(); media.show(item, hash); };
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
      if (!!window.location.hash) window.requestAnimationFrame(() => {
        const id = window.location.hash.replace('#', '').replace('/','-');
        document.querySelector(`#${id}`).dispatchEvent(new Event('click'));
      });
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
