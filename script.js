// expects g.loading to contain a custom object
// expects g.raceLoad to contain an ID returned by setTimeout
// expects g.preload to contain a custom object after loading preload.js
// expects g.Display to contain a constructor function after display.js
// expects g.Director to contain a constructor function after director.js
// expects g.Cells to contain a constructor after loading component
// expects g.Audio to contain a constructor after loading component

g.go = (attachStyle) => {
  const direct = new g.Director();

  // DOM selector, returns single element, array of elements, or null
  const $ = (q, asArray) => {
    const elements = document.querySelectorAll(q);
    if (elements.length === 0) return null;
    if (elements.length === 1 && !asArray) return elements[0];
    return Array.prototype.slice.call(elements);
  };

  // make cells
  direct.addStep((cb) => {
    let cells;
    const wrap = document.createElement('div');
    wrap.id = 'cells';
    const location = $('#introduction h1');
    location.insertAdjacentElement('afterend', wrap);

    const removeCells = () => {
      if (!cells) return;
      wrap.style['background'] = '#fbfbfb';
      cells.cleanup();
      wrap.removeChild(cells);
      cells = null;
    };

    const makeCells = () => {
      if (cells) removeCells();
      wrap.style['background'] = '';
      cells = new g.Cells();
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
      let clickedEl;
      const sheet = document.createElement('div');
      sheet.id = 'exhibit';
      const close = document.createElement('button');
      close.className = 'close';
      close.innerHTML = '&times;';
      const title = document.createElement('h2');
      const description = document.createElement('p');
      const media = document.createElement('div');
      media.className = 'media';
      sheet.appendChild(title);
      sheet.appendChild(description);
      sheet.appendChild(media);
      sheet.appendChild(close);

      const component = (work) => {
        const srcPrefix = 'works/';
        switch (work.type) {
          case 'songs': return new g.Audio(srcPrefix + work.src);
        }
      };

      const show = (el, hash) => {
        if (clickedEl) return;
        clickedEl = el;
        clickedEl.classList.add('clicked');

        const work = el.data;
        if (!work) return;
        if (!work.title) work.title = '';
        if (!work.description) work.description = '';

        const mainEl = $('#introduction > *, #works > *');
        const exhibitEl = [title, description, media];
        const steps = new g.Director();

        // hide main page elements
        steps.addStep((cb) => {
          const d = new g.Display(cb);
          const key = { 0: { 'opacity': '1' }, 100: { 'opacity': '0' } };
          mainEl.forEach((e, i) => d.animate(e, `.4s ${i * .08}s`, key));
          d.run();
        });

        // show exhibit title and description
        steps.addStep((cb) => {
          title.innerHTML = work.title;
          description.innerHTML = work.description;
          $('#cells').dispatchEvent(new Event('pause'));
          exhibitEl.forEach(e => e.style['opacity'] = 0);
          close.style['opacity'] = 0;
          if (!document.body.contains(sheet)) document.body.appendChild(sheet);
          window.location.hash = hash;
          const d = new g.Display(cb);
          const key = { 0: { 'opacity': '0' }, 100: { 'opacity': '1' } };
          exhibitEl.forEach((e, i) => d.animate(e, `.4s ${i * .08}s`, key));
          window.requestAnimationFrame(d.run);
        });

        // show media and close button
        steps.addStep((cb) => {
          media.appendChild(component(work));
          close.style['opacity'] = 1;
          cb();
        });

        steps.start();
      };

      const hide = () => {
        const mainEl = $('#introduction > *, #works > *');
        const exhibitEl = [close, title, description, media];
        const steps = new g.Director();

        // unpause cells and hide exhibit title and description
        steps.addStep((cb) => {
          $('#cells').dispatchEvent(new Event('unpause'));
          const d = new g.Display(cb);
          const key = { 0: { 'opacity': '1' }, 100: { 'opacity': '0' } };
          exhibitEl.forEach((e, i) => d.animate(e, `.4s ${i * .08}s`, key));
          d.run();
        });

        // hide exhibit
        steps.addStep((cb) => {
          window.location.hash = '';
          if (document.body.contains(sheet)) document.body.removeChild(sheet);
          if (media.hasChildNodes()) media.removeChild(media.firstChild);
          cb();
        });

        // show main page elements
        steps.addStep((cb) => {
          clickedEl.classList.remove('clicked');
          const d = new g.Display(() => { clickedEl = null; cb(); });
          const key = { 0: { 'opacity': '0' }, 100: { 'opacity': '1' } };
          mainEl.forEach((e, i) => d.animate(e, `.4s ${i * .08}s`, key));
          d.run();
        });

        steps.start();
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
          const icon = new g.Icon(type);
          const title = document.createElement('span');
          const hash = `#${type}/${item.id}`;
          title.innerHTML = item.title;
          a.href = hash;
          a.id = `${type}-${item.id}`;
          a.data = item;
          a.data.type = type;
          a.onclick = (e) => { e.preventDefault(); exhibit.show(a, hash); };
          a.appendChild(icon);
          a.appendChild(title);
          el.appendChild(a);
          list.appendChild(el);
        });
      });

      $('#introduction').insertAdjacentElement('afterend', wrap);
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
    const d = new g.Display(cb);
    const hide = (s) => $(s, true).forEach(el => d.hide(el));
    hide('#introduction h1');
    hide('#introduction ul li');
    hide('#works ul li');
    d.run();
  });

  // hide loading
  direct.addStep((cb) => {
    window.clearTimeout(g.raceLoad);
    g.loading.hide(cb);
  });

  // start cells
  direct.addStep((cb) => {
    attachStyle();
    $('#cells').dispatchEvent(new Event('makecells'));
    cb();
  });

  // open direct links to work items
  direct.addStep((cb) => {
    if (!!window.location.hash) window.requestAnimationFrame(() => {
      const id = window.location.hash.replace('#', '').replace('/','-');
      $(`#${id}`).dispatchEvent(new Event('click'));
    });
    cb();
  });

  // reveal
  direct.addStep((cb) => {
    const delay = 4.8;
    const name = $('#introduction h1');
    const socials = $('#introduction ul li', true);
    const works = $('#works ul li', true);

    const up = { 0: { 'opacity': 0, 'transform': 'translate3d(0, 12px, 0)' },
                 100: { 'opacity': 1, 'transform': 'translate3d(0, 0, 0)' } };
    const down = { 0: { 'opacity': 0, 'transform': 'translate3d(0, -12px, 0)' },
                   100: { 'opacity': 1, 'transform': 'translate3d(0, 0, 0)' } };
    const show = { 0: { 'opacity': 0, 'transform': 'translate3d(0, 0, 0)' },
                   100: { 'opacity': 1, 'transform': 'translate3d(0, 0, 0)' } };

    const d = new g.Display(cb);
    d.animate(name, `1.5s ease-out ${delay}s`, up);
    const timeSocials = (i) => `1.2s ease-out ${delay + 1.1 + i * .1}s`;
    socials.forEach((el, i) => d.animate(el, timeSocials(i), down));
    const timeWorks = (i) => `1.2s ease-out ${delay + 1.9 + i * .1}s`;
    works.forEach((el, i) => d.animate(el, timeWorks(i), show));
    d.run();
  });

  direct.start();
};

(() => {
  // preload style
  const style = () => g.preload.stylesheet('style.css', at => g.go(at));

  // preload js
  const components = ['cells', 'audio', 'icon'];
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
