// several fn(cb)'s are grouped into a step as tasks
// tasks in a step run concurrently, steps run in sequence
// create new Director(cb), call addStep() several times, then start() once
const Director = function(doneCb) {
  let steps = [];
  let currentStep = -1;

  // run next step
  const advance = () => {
    currentStep += 1;
    if (currentStep === steps.length) { if (doneCb) doneCb(); return; }
    let step = steps[currentStep];
    let allCb = (c => () => { c -= 1; if (!c) advance(); })(step.length);
    step.forEach((task) => {
      if (typeof task !== 'function') throw new Error('Task not a fn(cb)');
      task(allCb);
    });
  };

  // add a bunch of fn(cb) to a step to be run together
  this.addStep = (...fn) => {
    if (!fn.length) throw new Error('addStep() called with no arguments');
    steps.push(fn);
  };

  this.start = () => { advance(); };
};
