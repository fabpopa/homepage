var site = {};

site.init = function() {
  // DOM selector
  // returns single element, array of elements, or null
  var $ = function(q) {
    var elements = document.querySelectorAll(q);
    if (elements.length === 0) { return null; }
    if (elements.length === 1) { return elements[0]; }
    return Array.prototype.slice.call(elements);
  };
  
  // construct to sync callbacks
  // 'done' called when group callback has been called 'count' times
  var groupCallback = function(count, done) {
    return function() {
      count -= 1;
      if (count === 0) { done(); }
    };
  };
  
  var dayTime = function() {
    // 5h segments
    var dayTimes = ['night', 'morning', 'day', 'afternoon', 'evening'];
    return dayTimes[Math.floor((new Date()).getHours() / 5)];
  };
  
  // asset preloader, reliably put things in browser cache
  // or at least make sure they're already there by loading a second time invisibly
  var preload = (function() {
    var p = document.createElement('div');  // container for preloaded elements
    p.style.cssText = 
      'position: fixed; width: 0; height: 0; top: -1px; left: -1px; overflow: hidden';
    document.body.appendChild(p);
    
    var data = function(url, onComplete) {
      var xhr = new XMLHttpRequest();
      if (onComplete !== undefined) { 
        xhr.onload = function() { onComplete(this.responseText); };
      }
      xhr.open('GET', url);
      xhr.send();
    };
    
    var img = function(url, onComplete, onError) {
      var i = document.createElement('img');
      i.onload = function() {
        p.removeChild(i);
        if (onComplete !== undefined) { onComplete(); }
      };
      i.onerror = function() {
        p.removeChild(i);
        if (onError !== undefined) { onError(); }
      };
      p.appendChild(i);
      i.src = url;
    };
    
    var video = function(url, onComplete, onError) {
      var v = document.createElement('video');
      v.oncanplaythrough = function() { 
        if (p.contains(v)) { p.removeChild(v); }
        if (onComplete !== undefined) { onComplete(); }
      };
      p.appendChild(v);
      v.src = url;
      setTimeout(function() {
        if (p.contains(v) && (v.readyState === undefined || v.readyState === 0)) {
          p.removeChild(v);
          if (onError !== undefined) { onError(); }
        }
      }, 5000);
    };
    
    return {
      data: data,
      img: img,
      video: video
    };
  })();
  
  // several fn(cb)'s are grouped into a step as tasks
  // tasks in a step run in parallel, steps run in sequence
  var taskRunner = function() {
    var steps = [];
    var currentStep = -1;
    var done = function() {};
    
    // add a bunch of fn(cb) to a step to be run together
    var addStep = function() {
      if (arguments.length === 0) { 
        throw 'taskRunner.addStep() expects fn(cb)... or [fn(cb)...] arguments';
      }
      var tasks;
      if (Array.isArray(arguments[0])) { tasks = arguments[0]; }
      else { tasks = Array.prototype.slice.call(arguments); }
      steps.push(tasks);
    };
    
    // run next step
    var advance = function() {
      currentStep += 1;
      if (currentStep == steps.length) { done(); return; }
      
      var step = steps[currentStep];
      var gcb = groupCallback(step.length, advance);
      step.forEach(function(task) { task(gcb); });
    };
    
    var start = function(cb) {
      if (steps.length <= 0) { return; }
      if (cb !== undefined) { done = cb; }
      advance();
    };
    
    return {
      addStep: addStep,
      start: start
    };
  };
  
  // small library for visual changes
  // all animations here are staged for succession
  // if you need an animation outside this schedule, place it in CSS
  var display = function() {
    var tasks = [];
    
    // e.g. style(el, { opacity: .5, color: 'cyan' })
    var style = function(el, styles) {
      tasks.push({ el: el, styles: styles });
    };
    
    // e.g. animate(el, '2s infinite', { 0: { opacity: 0 }, 100: { opacity: 1 } })
    // e.g. animate(el, '2s 3', { from: { top: 0 }, 50: { top: 100 }, to: { top: 50 } })
    var animate = function(el, animation, keyframes) {
      if (animation === undefined || keyframes === undefined ) {
        throw "display.animate() requires 'animation' and 'keyframes' arguments";
      }
      tasks.push({ el: el, animation: animation, keyframes: keyframes });
    };
    
    var hide = function(el) { style(el, { opacity: 0 }); };
    var show = function(el) { style(el, { opacity: 1 }); };
    
    var run = function(cb) {
      if (typeof cb !== 'function') { throw 'display.run(cb) expects a callback argument'; }
      
      var apply = function(el, styles) {
        Object.keys(styles).forEach(function(s) { el.style[s] = styles[s]; });
      };

      var gcb = groupCallback(tasks.length, cb);
      tasks.forEach(function(task) {
        if (task.animation !== undefined) {
          // name aniamtion keyframes
          var name = 'keyframes'
            .concat('-', Math.floor(Math.random() * Math.pow(10, 17)))
            .concat('-', Date.now() % Math.pow(10, 4));  
                        
          // construct keyframe css
          var keyframes = [];
          Object.keys(task.keyframes).forEach(function(time) {
            var styles = [];
            Object.keys(task.keyframes[time]).forEach(function(style) {
              styles.push(style + ': ' + task.keyframes[time][style]);
            });
            if (/^\d+$/.test(time)) { time += '%'; }
            keyframes.push(time + ' { ' + styles.join('; ') + ' }');
          });
          
          // browser prefixes
          var animPrefix = '';
          var animEnd = 'animationend';
          var animObj = {};
          if (document.body.style.animation === undefined) {
            animPrefix = '-webkit-';
            animEnd = 'webkitAnimationEnd';
          }
          animObj[animPrefix + 'animation'] = name + ' ' + task.animation + ' forwards';               
          
          // attach keyframes css
          var css = '@' + animPrefix + 'keyframes ' + name + ' { ' + keyframes.join(' ') + ' }';
          var s = document.createElement('style');
          s.innerHTML = css;
          document.head.appendChild(s);
          
          // add animationend event listener
          task.el.addEventListener(animEnd, function() {
            task.el.removeEventListener(animEnd, arguments.callee);
            
            // apply styles from end keyframe and remove animation assets
            Object.keys(task.keyframes).forEach(function(frame) {
              if (/(to|100)/i.test(frame)) { apply(task.el, task.keyframes[frame]); }
            });
            document.head.removeChild(s);
            task.el.style.removeProperty(animPrefix + 'animation');
            gcb();
          });
            
          // apply animation          
          apply(task.el, animObj);
        } else {
          apply(task.el, task.styles);
          gcb();
        }
      });
    };
    
    return {
      style: style,
      animate: animate,
      hide: hide,
      show: show,
      run: run
    };
  };
  
  // task runner for the whole page
  var runner = taskRunner();
  
  // some animation presets
  var keyframes = {
    show: { 0: { opacity: 0 }, 100: { opacity: 1 } },
    hide: { 0: { opacity: 1 }, 100: { opacity: 0 } }
  };
  
  // make sure fonts are in cache
  runner.addStep(
    function(cb) {
      // get external stylesheets linked to the document
      var extStyleSheets = [];
      Array.prototype.slice.call(document.styleSheets).forEach(function(sheet) {
        if (sheet.href !== null) { extStyleSheets.push(sheet.href); }
      });
     
      // extract font URLs from each stylesheet and make sure they're cached
      var sheetCb = groupCallback(extStyleSheets.length, cb);
      extStyleSheets.forEach(function(sheet) {
        preload.data(sheet, function(data) {
          var re = /@font-face[^}]*url\(['"]*([^'"\)]+)/gi;
          var fontLinks = [];
          var match;
          while ((match = re.exec(data)) !== null) { fontLinks.push(match[1]); }
          var fontsCb = groupCallback(fontLinks.length, sheetCb);
          fontLinks.forEach(function(font) { preload.data(font, fontsCb); });
        });
      });
    }
  );
  
  // modify greeting for current time of day
  runner.addStep(
    function(cb) {
      var greet = $('#greeting');
      var kerning = {
        night: { 3: '0 0 0 .015em', 4: '0 .035em 0 0' },
        morning: { 3: '0 0 0 .03em', 5: '0 0 0 -.015em' },
        day: { 2: '0 -.07em 0 0' },
        afternoon: { 2: '0 -.015em 0 .055em', 5: '0 0 0 .015em', 8: '0 0 0 -.015em' }
      };
      var dt = dayTime();
      var wrapped = greet.textContent.replace('day', dt);
      var dtOffset = wrapped.length - dt.length - 1;
      wrapped = wrapped.split('').map(function(letter, i) {
        var s = '<span class="letter"';
        var kernDayTime = kerning[dt];
        if (kernDayTime) {
          var kernMargin = kernDayTime[i - dtOffset];
          if (kernMargin) { 
            s += ' style="position: relative; margin: ' + kernMargin + '"';
          }
        }
        s += '>' + letter + '</span>';
        if (letter === ' ') { s += '<span class="nobr">'; }
        return s;
      }).join('').concat('</span>');
      greet.innerHTML = wrapped;
      
      // find the day-time-appropriate hue on the color wheel
      var moment = new Date();
      var midHue = Math.round((moment.getHours() * 60 + moment.getMinutes()) / (24 * 60) * 360);
      midHue += 240;  // midnight 00:00 is hue 240 deg blue
      if (midHue > 359) { midHue -= 360; }  // going round the color circle
      var letters = $('#greeting .letter');
      var hueStep = 4; // degrees of hue between letters
      var startHue = midHue - Math.floor(letters.length / 2 - 1) * hueStep;
      
      var d = display();
      letters.forEach(function(el, i) {
        d.hide(el);
        d.style(el, { 'color': 'hsl(' + (startHue + i * hueStep) + ', 93%, 65%)' });
        if (el.textContent !== ' ') { d.style(el, { display: 'inline-block' }); }
      });
      d.run(cb);
    }
  );
  
  // animate intro and preload avatar and background
  runner.addStep(
    function(cb) {
      // animate intro
      var greet = $('#greeting');
      var letters = $('#greeting .letter');
      var d = display();
      var prefix = (document.body.style.transform === undefined) ? '-webkit-' : '';
      var frames = { 0: { opacity: 0 }, 100: { opacity: 1 } };
      frames[0][prefix + 'transform'] = 'translate(0,1rem)';
      frames[100][prefix + 'transform'] = 'translate(0,0)';
      var punctDelay;
      
      // letter animation, except punctuation
      d.show(greet);
      letters.slice(0, -1).forEach(function(el, i) {
        var delay = Math.floor(i * 100 + 200 + Math.random() * 300);
        punctDelay = delay;
        d.animate(el, '1s ' + delay + 'ms', frames);
      });
      
      // punctuation
      letters.slice(-1).forEach(function(el) {
        d.animate(el, '.5s ' + (punctDelay + 300) + 'ms', frames);
      });
      
      d.run(cb);
    },
    function(cb) {
      // preload avatar
      var avatar = $('#avatar img');
      preload.img(avatar.getAttribute('data-preload'), function() {
        avatar.src = avatar.getAttribute('data-preload');
        avatar.removeAttribute('data-preload');
        cb();
      });
    },
    function(cb) {
      var bg = $('#background');
      var ext = { video: '.mp4', img: '.jpg' };
      var settings = { 
        night: { loop: false, darken: 0.1 }, 
        morning: { loop: true, darken: 0.1 }, 
        day: { loop: true, darken: 0.1 }, 
        afternoon: { loop: true, darken: 0.1 }, 
        evening: { loop: false, darken: 0.1 }
      };
      var dt = dayTime();
      var addOverlay = function() {
        var overlay = document.createElement('div');
        overlay.style.cssText = 
          'width: 100%; height: 100%; background-color: rgba(0, 0, 0, ' + settings[dt]['darken'] + ')';
        bg.appendChild(overlay);
        cb();
      };
      var gcb = groupCallback(1, addOverlay);
      var file = 'bg/';
      if (['morning', 'day', 'afternoon'].indexOf(dt) !== -1) { file += 'day'; }
      else { file += 'evening'; }
      
      // if the device can handle it, prepare the video to substitute the image
      if (screen.width >= 1000 && !('ontouchstart' in window)) {
        var videoFile = file + ext.video;
        var video = document.createElement('video');
        if (settings[dt]['loop']) { video.setAttribute('loop', ''); }
        bg.appendChild(video);
        
        gcb = groupCallback(2, addOverlay);
        preload.video(videoFile, function() {
          video.src = videoFile;
          document.addEventListener('visibilitychange', function() {
            // spare resources when video not in view
            if (document.hidden === true) { video.pause(); } else { video.play(); }
          });
          gcb();
        }, function() {
          bg.removeChild(video);
          gcb();
        });
      }
      
      var imgFile = file + ext.img;
      var img = document.createElement('img');
      bg.appendChild(img);
      preload.img(imgFile, function() {
        // resize background to always fit the available window space
        // img is a frame of video, they have the same dimensions
        var imgRatio;
        var adjustBackgroundSize = function() {
          [].concat($('#background video, #background img')).forEach(function(el) {
            if (window.innerWidth / window.innerHeight < imgRatio) {
              if (el.style.width !== '' || el.style.height === '') {
                el.style.height = '100%';
                el.style.removeProperty('width');
              }
            } else {
              if (el.style.height !== '' || el.style.width === '') {
                el.style.width = '100%';
                el.style.removeProperty('height');
              }
            }
          });
        };
        
        img.addEventListener('load', function() {
          img.removeEventListener('load', arguments.callee);
          imgRatio = img.naturalWidth / img.naturalHeight;
          window.addEventListener('resize', adjustBackgroundSize);
          adjustBackgroundSize();
          gcb();
        });
        
        img.src = imgFile;
      });
    }
  );
  
  // keep the greeting up a bit
  runner.addStep(function(cb) { setTimeout(cb, 1000); });
  
  // big transition to show background image and white greeting
  runner.addStep(
    function(cb) {
      var img = $('#background img');
      var video = $('#background video');
      var d = display();
      if (video) { d.hide(video); }
      $('#greeting .letter').forEach(function(el) {
        d.animate(el, '2s', { 
          0: { 'color': el.style.color, 'text-shadow': '0 1px 2px rgba(0, 0, 0, 0)' }, 
          100: { 'color': 'white', 'text-shadow': '0 1px 2px rgba(0, 0, 0, .4)' }
        });
      });
      d.animate($('#background'), '2s', keyframes.show);
      d.run(cb);
    }
  );
  
  // reveal video background if available, plus avatar, small intro text, and social buttons
  runner.addStep(
    function(cb) { 
      var video = $('#background video');
      var img = $('#background img');      
      if (video) {
        var d = display();
        d.show(video);
        video.play();
        d.animate(img, '1s .5s', keyframes.hide);
        d.run(function() {
          // against flash of white when returning to tab and video is out-of-memory
          img.style.cssText += '; z-index: -1; opacity: 1';
          cb();
        });
      } else {
        cb();
      }
    },
    function(cb) {
      var avatar = $('#avatar');
      var intro = $('#intro');
      var social = $('#social');
      var d = display();
      d.hide(avatar);
      d.animate(avatar, '1s', keyframes.show);
      d.animate(intro, '1s .5s', { 0: { opacity: 0 }, 100: { opacity: 0.7 } });
      d.animate(social, '2s 2s', keyframes.show);
      d.run(cb);
    }
  );
  
  // reveal résumé hint
  runner.addStep(
    function(cb) {
      var resume = $('#resume');
      var video = $('#background video');
      var shortcuts = { mac: ['⌘', 'Option', 'I'], linux: ['Ctrl', 'Shift', 'I'], win: ['F12'] };
      var platform = navigator.platform;
      var s = resume.innerHTML;
      var d = display();
      if (video && platform) {
        // desktop
        Object.keys(shortcuts).forEach(function(os) {
          if (platform.toLowerCase().indexOf(os) !== -1) {
            s += '<br>' + os.charAt(0).toUpperCase() + os.slice(1) + ': ';
            shortcuts[os].forEach(function(key) { s += '<span class="key">' + key + '</span>'; });
          }
        });
        d.animate(resume, '1s', { 0: { opacity: 0 }, 100: { opacity: 0.8 } });
      } else {
        // mobile
        s = s.replace(/ in.*/, '');
        s = '<a href="' + site.resume + '">' + s + '</a>';
        d.animate(resume, '1s', keyframes.show);
        document.addEventListener("touchstart", function(){});  // make :active styles work on mobile
      }
      resume.innerHTML = s;
      d.run(cb);
    }
  );
  
  var lastVisit = localStorage['last-visit-time'];
  if (lastVisit && (new Date() - lastVisit) < 30 * 1000) {
    // coming back to the page after little time, skip animations
    document.body.innerHTML = localStorage['last-visit-snapshot'];
    localStorage['last-visit-time'] = +new Date();
    var video = $('#background video');
    if (video) { video.play(); }
  } else {
    // construct the page with animations and everything
    runner.start(function() {
      localStorage['last-visit-time'] = +new Date();
      localStorage['last-visit-snapshot'] = document.body.innerHTML;
    });
  }
};

// check browser is IE10+ and modern
if ((new XMLHttpRequest()).onload !== undefined) {
  // start page when all assets have loaded
  window.addEventListener('load', function() {
    window.removeEventListener('load', arguments.callee);
    site.init();
  });
} else {
  // show notice for old browsers
  document.getElementById('oldbrowser').className = 'show';
}

// résumé-downloading function
site.resume = "résumé.pdf";
var getResume = function() {
  var a = document.createElement('a');
  a.style.display = 'none';
  a.href = site.resume;
  document.body.appendChild(a);
  a.click();
  return 'loading ...';
}

// view source introduction
site.msg = "";
site.msg += "Hi, I'm Fabian. Great to have you here!" + "\n\n";
site.msg += "This site is meant to be a short demonstration \nof development and design. There are no external \ndependencies. Feel free to look around and let \nme know if I've missed anything." + "\n\n";
site.msg += "I am interested in everything that makes great \nhuman technology – front-end, back-end, embedded, \ndesign, copywriting, and everything in between." + "\n\n";
site.msg += "A printable résumé: "+ window.location.hostname + '/' + site.resume +" \n... or try typing 'getResume()' in the console." + "\n\n";
site.msg += "Have a great day!";
console.log(site.msg);