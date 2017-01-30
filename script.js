// expects window.site.hideAll to contain a <style> element
// expects window.site.loading to contain a custom object
// expects window.site.raceLoad to contain an ID returned by setTimeout

window.clearTimeout(window.site.raceLoad);
window.site.loading.hide();
