// expects window.site.loading to contain a custom object
// expects window.site.raceLoad to contain an ID returned by setTimeout
// expects window.preload to contain a custom object after loading preload.js
// expects window.Display to contain a constructor function after display.js
// expects window.Director to contain a constructor function after director.js
// expects window.Cells to contain a constructor after loading component
// expects window.Audio to contain a constructor after loading component

window.site.go = (attachStyle) => {
  const direct = new Director();

  // make cells
  direct.addStep((cb) => {
    let cells;
    const wrap = document.createElement('div');
    wrap.id = 'cells';
    const location = document.querySelector('#introduction p');
    location.insertAdjacentElement('afterend', wrap);

    const removeCells = () => {
      if (!cells) return;
      wrap.style['background'] = '#fbfbfb';
      cells.cleanup();
      wrap.removeChild(cells);
      cells = null;
    };

    const makeCells = () => {
      return;
      if (cells) removeCells();
      wrap.style['background'] = '';
      cells = new Cells();
      wrap.appendChild(cells);
    };

    // wrapper element controls cells animation in response to custom events
    wrap.addEventListener('removecells', removeCells);
    wrap.addEventListener('makecells', makeCells);
    wrap.addEventListener('pause', () => { if (cells) cells.pause(); });
    wrap.addEventListener('unpause', () => { if (cells) cells.unpause(); });

    // refresh cells on resize
    let debounce, hid = false;
    window.addEventListener('resize', () => {
      if (!hid) { wrap.dispatchEvent(new Event('removecells')); hid = true; }
      if (debounce) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        wrap.dispatchEvent(new Event('makecells'));
        hid = false;
      }, 400);
    });

    cb();
  });

  // make works
  direct.addStep((cb) => {
    // media overlay object
    const exhibit = (() => {
      const sheet = document.createElement('div');
      sheet.id = 'exhibit';
      const close = document.createElement('button');
      close.className = 'close';
      close.innerHTML = '&times;'
      const content = document.createElement('div');
      content.className = 'content';
      const title = document.createElement('h3');
      const description = document.createElement('p');
      const media = document.createElement('div');
      media.className = 'media';
      sheet.appendChild(close);
      sheet.appendChild(content);
      content.appendChild(title);
      content.appendChild(description);
      content.appendChild(media);

      const component = (work) => {
        const srcPrefix = 'works/';
        switch (work.type) {
          case 'songs': return new Audio(srcPrefix + work.src);
        }
      };

      const show = (work, hash) => {
        if (!work) return;
        if (!work.title) work.title = '';
        if (!work.description) work.description = '';
        title.innerHTML = work.title;
        description.innerHTML = work.description;
        media.appendChild(component(work));
        document.querySelector('#cells').dispatchEvent(new Event('pause'));
        if (!document.body.contains(sheet)) document.body.appendChild(sheet);
        window.location.hash = hash;
      };

      const hide = () => {
        document.querySelector('#cells').dispatchEvent(new Event('unpause'));
        if (document.body.contains(sheet)) document.body.removeChild(sheet);
        media.removeChild(media.firstChild);
        window.location.hash = '';
      };

      close.onclick = (e) => { e.preventDefault(); hide(); };
      return { show, hide };
    })();

    // list of work items
    const makeWorks = (works) => {
      if (!works || !Object.keys(works).length) return;
      const wrap = document.createElement('div');
      wrap.id = 'works';
      const list = document.createElement('ul');
      wrap.appendChild(list);

      Object.keys(works).forEach(type => {
        works[type].forEach(item => {
          const el = document.createElement('li');
          const a = document.createElement('a');
          const hash = `#${type}/${item.id}`
          a.href = hash;
          a.id = `${type}-${item.id}`;
          a.innerHTML = item.title;
          a.data = item;
          a.data.type = type;
          a.onclick = (e) => { e.preventDefault(); exhibit.show(item, hash); };
          el.appendChild(a);
          list.appendChild(el);
        });
      });

      const intro = document.querySelector('#introduction');
      intro.insertAdjacentElement('afterend', wrap);
    };

    // fetch index of works
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'works/index.json');
    xhr.responseType = 'json';
    xhr.onload = () => { makeWorks(xhr.response); cb(); }
    xhr.onerror = () => cb();
    xhr.send();
  });

  // prepare reveal
  direct.addStep((cb) => {
    cb();
  });

  // hide loading
  direct.addStep((cb) => {
    window.clearTimeout(window.site.raceLoad);
    window.site.loading.hide(cb);
  });

  // reveal
  direct.addStep((cb) => {
    attachStyle();
    document.querySelector('#cells').dispatchEvent(new Event('makecells'));

    // if it's a direct link to a works item, open it
    if (!!window.location.hash) window.requestAnimationFrame(() => {
      const id = window.location.hash.replace('#', '').replace('/','-');
      document.querySelector(`#${id}`).dispatchEvent(new Event('click'));
    });

    cb();
  });

  direct.start();
};

(() => {
  // preload style
  const style = () => preload.stylesheet('style.css', at => window.site.go(at));

  // preload js
  const components = ['cells', 'audio'];
  const scripts = ['preload', 'director', 'display'];
  const js = [...scripts, ...components.map(s => `components/${s}`)];
  const readyToStyle = (c => () => { c -= 1; if (!c) style(); })(js.length);
  js.forEach(s => {
    const el = document.createElement('script');
    el.onload = readyToStyle;
    el.src = `js/${s}.js`;
    document.head.appendChild(el);
  });
})();
