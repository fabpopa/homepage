// SVG icons with encapsulated styling and motion
const Icon = function(type) {
  // helpers
  const svgNS = 'http://www.w3.org/2000/svg';
  const svgEl = (el) => document.createElementNS(svgNS, el);
  const setAtt = (e, a) => Object.keys(a).forEach(k => e.setAttribute(k, a[k]));

  // element to return
  const svg = svgEl('svg');
  setAtt(svg, { 'component': 'icon' });

  // global state
  let width, height, icon;

  // build SVG bezier curve
  const curve = (startX, startY) => {
    let d = `M ${startX},${startY}`;
    const bezier = (type, xC1, yC1, xC2, yC2, x, y) =>
      d += ` ${type} ${xC1},${yC1} ${xC2},${yC2} ${x},${y}`;
    const C = (...args) => bezier('C', ...args);
    const c = (...args) => bezier('c', ...args);
    const L = (x, y) => d += ` L ${x},${y}`;
    const l = (x, y) => d += ` l ${x},${y}`;
    const close = () => d += ` Z`;
    const open = () => d;
    return { C, c, L, l, close, open };
  };

  // song icon
  const song = () => {
    const start = () => {
      // vertical relative values for waveform points
      const y = [0, 0, -1, 1, -2, 2, -3, 3, -1, 1, -1.5, 1, 0, 0];
      const max = y.map(i => Math.abs(i)).reduce((a, v) => Math.max(a, v));
      const uW = width / (y.length - 1);
      const uH = height / 2.3 / max;
      const ctl = 0; // bezier handle length for peak roundness
      let lastX = 0, lastY = height / 2 + y[0] * uH, nextX, nextY;
      const c = curve(lastX, lastY);
      for (let i = 1; i < y.length; i++) c.L(i * uW, height / 2 + y[i] * uH);
      const path = svgEl('path');
      setAtt(path, { 'fill': 'none', 'stroke': '#222', 'stroke-width': '1.3' });
      setAtt(path, { 'stroke-linejoin': 'round', 'stroke-linecap': 'round' });
      setAtt(path, { 'd': c.open() });
      svg.appendChild(path);
    };

    const cleanup = () => { };
    return { start, cleanup };
  };

  switch (type) {
    case 'songs': icon = song(); break;
    default: return;
  }

  const dimension = () => {
    const style = window.getComputedStyle(svg);
    width = parseInt(style['width'], 10);
    height = parseInt(style['height'], 10);
    if (!width || !height) { window.requestAnimationFrame(dimension); return; }
    setAtt(svg, { 'width': width, 'height': height });
    const cleanup = (ob) => { ob.disconnect(); icon.cleanup(); };
    const ob = new MutationObserver(() => { cleanup(ob); });
    ob.observe(svg.parentNode, { childList: true });
    icon.start();
  };

  // wait for el to be appended to parent node to get dimensions and first draw
  const checkParent = () => {
    if (svg.parentNode) { dimension(); return; }
    window.requestAnimationFrame(checkParent);
  };

  checkParent();
  return svg;
};
