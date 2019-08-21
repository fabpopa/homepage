// Monitor DOM and hydrate elements.
class Components {
  constructor() {
    this._componentByTag = {};
    this._monitor();
  }

  add(tag, component) {
    if (this._componentByTag[tag]) throw Error('Component already registered');
    this._componentByTag[tag] = component;
    this._crawlAndAttachTag(tag);
  }

  _monitor() {
    this._mo = new MutationObserver(ms => this._crawlAndAttachMutations(ms));
    this._mo.observe(document.body, { childList: true, subtree: true });
  }

  _crawlAndAttachMutations(mutations) {
    const added = [];
    mutations.forEach(m => added.push(...m.addedNodes));
    const tagElPairs = [];
    added.forEach(el => tagElPairs.push([el.getAttribute('component'), el]));
    const taggedPairs = tagElPairs.filter(pair => !!pair[0]);
    if (taggedPairs.length) taggedPairs.forEach(p => this._attach(p[0], p[1]));
  }

  _crawlAndAttachTag(tag) {
    const els = [...document.querySelectorAll(`[component="${tag}"]`)];
    if (els.length) els.forEach(el => this._attach(tag, el));
  }

  _attach(tag, el) {
    const component = this._componentByTag[tag];
    if (!component) return;
    el.component = new component(el);
  }
}

app.components = new Components();
