// Load script files and evaluate in order.
const files = [
  ...['components'].map(f => `lib/${f}.js`),
  ...['tapestry'].map(c => `components/${c}.js`)
];
files.forEach(file => {
  const el = document.createElement('script');
  el.src = file;
  el.async = false;
  document.body.appendChild(el);
});
