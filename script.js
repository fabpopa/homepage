// expects window.site.loading to contain a custom object
// expects window.site.raceLoad to contain an ID returned by setTimeout

// attach director, animate, and cells
// preload stylesheet
// when all done, clear raceLoad, hide loading, start reveal, remove hideAll



window.clearTimeout(window.site.raceLoad);
window.site.loading.hide();
