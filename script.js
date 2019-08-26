// Load script files and evaluate in order.
const files = [
  ...['director', 'tapestry'].map(f => `lib/${f}.js`)
];
files.forEach(file => {
  const el = document.createElement('script');
  el.src = file;
  el.async = false;
  document.body.appendChild(el);
});
