const libs = ['registry'];
const components = ['tapestry'];

const files = [
  ...libs.map(f => `lib/${f}.js`),
  ...components.map(c => `components/${c}.js`)
];

// Load script files in parallel and evaluate in order.
files.forEach(file => {
  const el = document.createElement('script');
  el.src = file;
  el.async = false;
  document.body.appendChild(el);
});
