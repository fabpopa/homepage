// Steps are arrays of fn(cb) tasks to be run together.
// Tasks in a step run concurrently, steps run in sequence.
// Create new Director(cb), call addStep() several times, then start() once.
class Director {
  constructor(doneCb) {
    this._steps = [];
    this._currentStep = -1;
    this._doneCb = doneCb;
    this._started = false;
  }

  addStep(...fn) {
    if (!fn.length) throw new Error('addStep() called with no arguments');
    this._steps.push(fn);
  }

  start() {
    if (this._started) throw new Error('Director already started');
    this._started = true;
    this._advance();
  }

  _advance() {
    this._currentStep += 1;
    if (this._currentStep === this._steps.length) {
      if (this._doneCb) this._doneCb();
      return;
    }

    let step = this._steps[this._currentStep];
    let stepCb = (c => () => { c -= 1; if (!c) this._advance(); })(step.length);
    step.forEach(task => {
      if (typeof task !== 'function') throw new Error('Task not a fn(cb)');
      task(stepCb);
    });
  }
}

app.Director = Director;
