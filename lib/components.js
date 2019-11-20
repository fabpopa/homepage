class ComponentManager {
  constructor() {
    this._componentByTag = {};
    this._monitor();
  }

  add(tag, component) {
    if (this._componentByTag[tag]) throw Error('Component already registered');
    this._componentByTag[tag] = component;
    this._crawlTag(tag);
  }

  _monitor() {
    this._mo = new MutationObserver(ms => this._crawlMutations(ms));
    this._mo.observe(document.body, { childList: true, subtree: true });
  }

  _crawlMutations(mutations) {
    const added = [];
    const removed = [];
    mutations.forEach(m => {
      added.push(...m.addedNodes);
      removed.push(...m.removedNodes);
    });
    if (added.length) this._crawlAddedNodes(added);
    if (removed.length) this._crawlRemovedNodes(removed);
  }

  _crawlAddedNodes(nodes) {
    const comps = this._crawlNodeList(nodes);
    const elTagPairs = comps.map(el => [el, el.getAttribute('component')]);
    elTagPairs.forEach(pair => this._attach(pair[0], pair[1]));
  }

  _crawlRemovedNodes(nodes) {
    const comps = this._crawlNodeList(nodes);
    comps.forEach(el => this._detach(el));
  }

  _crawlTag(tag) {
    const els = this._crawlNode(document.body, tag);
    els.forEach(el => this._attach(el, tag));
  }

  _crawlNodeList(nodes) {
    const components = [];
    nodes.forEach(el => components.push(...this._crawlNode(el)));
    return components;
  }

  _crawlNode(el, tag) {
    const c = el.querySelectorAll(tag ? `[component="${tag}"]` : '[component]');
    const tagSelf = el.getAttribute('component');
    const addSelf = tagSelf && (!tag || tagSelf === tag);
    return addSelf ? [el, ...c] : [...c];
  }

  _attach(el, tag) {
    if (!tag || el.component) return;
    const component = this._componentByTag[tag];
    if (component) el.component = new component(el);
  }

  _detach(el) {
    if (!el.component) return;
    if (el.component.cleanup) el.component.cleanup();
    delete el.component;
  }
}

app.components = new ComponentManager();
