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
    return { C, c, L, l, close };
  };

  // song icon
  const song = () => {
    const start = () => {
      const rect = svgEl('rect');
      setAtt(rect, { 'x': '0', 'y': '0', 'width': width, 'height': height });
      setAtt(rect, { 'fill': '#000' });
      svg.appendChild(rect);
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
