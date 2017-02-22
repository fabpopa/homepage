// style and animate several elements together in a single step
// create new Display(cb), call style(), show(), hide(), animate(), then run()
const Display = function(cb) {
  let tasks = [];

  // e.g. style(el, { 'opacity': .5, 'color': 'cyan' })
  this.style = (el, styles) => { tasks.push({ el, styles }); };
  this.hide = (el) => { style(el, { opacity: 0 }); };
  this.show = (el) => { style(el, { opacity: 1 }); };

  // animate([element], [animation], [keyframes])
  // [animation] is a CSS animation shorthand e.g. '2s linear 1s', no 'infinite'
  // [keyframes] is a CSS @keyframes declaration in object form
  // e.g. { 0: { 'opacity': 0 }, 100: { 'opacity': 1 } }
  // e.g. { from: { ... }, 50: { ... }, to: { ... } }
  // e.g. { '0%, 100%': { ... }, '50%': { ... } }
  // NOTE: for best performance, only animate 'opacity' and 'transform'
  this.animate = (el, animation, keyframes) => {
    if (!animation || !keyframes) throw new Error('animate() args missing');
    tasks.push({ el, animation, keyframes });
  };

  let apply = (el, styles) => {
    Object.keys(styles).forEach((s) => { el.style[s] = styles[s]; });
  };

  let clear = (el, styles) => { styles.forEach((s) => { el.style[s] = ''; }); };

  this.run = () => {
    let allCb = (c => () => { c -= 1; if (!c && cb) cb(); })(tasks.length);
    tasks.forEach((task) => {
      if (task.styles) { apply(task.el, task.styles); allCb(); return; }

      // generate keyframes name, attempt to avoid collisions
      const name = 'keyframes'
        .concat('-', Math.floor(Math.random() * Math.pow(10, 17)))
        .concat('-', Date.now() % Math.pow(10, 4));

      // construct keyframes CSS and will-change
      const keyframes = [];
      const willChange = new Set();
      Object.keys(task.keyframes).forEach((time) => {
        const styles = [];
        Object.keys(task.keyframes[time]).forEach((style) => {
          styles.push(`${style}: ${task.keyframes[time][style]}`);
          willChange.add(style);
        });
        if (/^\d+$/.test(time)) time += '%';
        keyframes.push(`${time} { ${styles.join('; ')} }`);
      });

      const animObj = {};
      animObj['animation'] = `${task.animation} ${name}`;
      animObj['animation-direction'] = 'forwards';
      if (willChange.size) animObj['will-change'] = [...willChange].join(',');

      // attach keyframes CSS
      const s = document.createElement('style');
      s.innerHTML = `@keyframes ${name} { ${keyframes.join(' ')} }`;
      document.head.appendChild(s);

      // listen for animation end to move on
      task.el.addEventListener('animationend', function h() {
        task.el.removeEventListener('animationend', h);

        // apply styles from end keyframe
        Object.keys(task.keyframes).forEach((frame) => {
          if (/(to|100)/i.test(frame)) apply(task.el, task.keyframes[frame]);
        });

        clear(task.el, Object.keys(animObj));
        document.head.removeChild(s);
        allCb();
      });

      // apply animation
      apply(task.el, animObj);
    });
  };
};
