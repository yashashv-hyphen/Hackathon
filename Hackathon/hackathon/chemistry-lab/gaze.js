/**
 * Eye tracking for Chemistry Lab — motor disability friendly.
 * Pointer always follows: mouse (reliable) or gaze (when camera works).
 * Click: dwell, blink, or press Space.
 */
(function () {
  'use strict';

  const BLINK_COOLDOWN_MS = 700;
  const BLINK_THRESHOLD = 0.45;
  const SMOOTH_ALPHA = 0.2;
  const DWELL_MS = 1400;
  const DWELL_RADIUS_PX = 60;

  let faceLandmarker = null;
  let video = null;
  let stream = null;
  let animId = null;
  let cursorEl = null;
  let dwellRingEl = null;
  let statusEl = null;
  let lastBlinkTime = 0;
  let smoothX = 0.5;
  let smoothY = 0.5;
  let smoothInit = false;
  let lastGazeX = 0.5;
  let lastGazeY = 0.5;
  let dwellTarget = null;
  let dwellStartTime = 0;
  let useGaze = false;
  let lastMouseX = -1;
  let lastMouseY = -1;

  function setStatus(msg) {
    if (statusEl) statusEl.textContent = msg;
  }

  function smooth(x, y) {
    if (!smoothInit) {
      smoothX = x;
      smoothY = y;
      smoothInit = true;
    } else {
      smoothX = SMOOTH_ALPHA * x + (1 - SMOOTH_ALPHA) * smoothX;
      smoothY = SMOOTH_ALPHA * y + (1 - SMOOTH_ALPHA) * smoothY;
    }
    return { x: smoothX, y: smoothY };
  }

  function ensureCursor() {
    if (cursorEl) return cursorEl;
    cursorEl = document.createElement('div');
    cursorEl.id = 'gaze-cursor';
    cursorEl.setAttribute('aria-hidden', 'true');
    cursorEl.className = 'gaze-cursor';
    cursorEl.innerHTML = '<svg class="gaze-cursor-pointer" viewBox="0 0 28 32" xmlns="http://www.w3.org/2000/svg"><path d="M2 2v20l6-4 4 10 4-2-4-10 12 .5L2 2z" fill="currentColor" stroke="rgba(255,255,255,0.95)" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cursorEl);

    dwellRingEl = document.createElement('div');
    dwellRingEl.id = 'gaze-dwell-ring';
    dwellRingEl.className = 'gaze-dwell-ring';
    dwellRingEl.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dwellRingEl);

    statusEl = document.createElement('div');
    statusEl.id = 'gaze-status';
    statusEl.className = 'gaze-status';
    statusEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(statusEl);

    return cursorEl;
  }

  function getClickableUnder(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el) return null;
    var clickable = el.closest('a, button, .apparatus, .btn, [role="button"], input, select, textarea, [onclick], [tabindex="0"]');
    return clickable || el;
  }

  function performClick(x, y) {
    var target = getClickableUnder(x, y);
    if (!target) return;
    var rect = target.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var opts = { bubbles: true, cancelable: true, view: window, clientX: cx, clientY: cy, detail: 1 };
    target.dispatchEvent(new MouseEvent('mousedown', opts));
    target.dispatchEvent(new MouseEvent('mouseup', opts));
    target.dispatchEvent(new MouseEvent('click', opts));
    showClickFeedback(cx, cy);
  }

  function showClickFeedback(x, y) {
    var flash = document.createElement('div');
    flash.className = 'gaze-click-flash';
    flash.style.left = (x - 16) + 'px';
    flash.style.top = (y - 16) + 'px';
    document.body.appendChild(flash);
    setTimeout(function () { flash.remove(); }, 350);
  }

  function blinkClick() {
    var el = document.getElementById('gaze-cursor');
    if (!el) return;
    var x = parseFloat(el.dataset.gazeX || '0');
    var y = parseFloat(el.dataset.gazeY || '0');
    performClick(x, y);
  }

  function moveCursor(xNorm, yNorm) {
    var w = window.innerWidth;
    var h = window.innerHeight;
    var x = Math.max(0, Math.min(w, xNorm * w));
    var y = Math.max(0, Math.min(h, yNorm * h));
    lastGazeX = x;
    lastGazeY = y;
    var el = ensureCursor();
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.dataset.gazeX = String(x);
    el.dataset.gazeY = String(y);
    el.style.display = 'block';
    el.classList.remove('gaze-cursor-hidden');

    var clickable = getClickableUnder(x, y);
    if (dwellRingEl) {
      dwellRingEl.style.left = (x - DWELL_RADIUS_PX) + 'px';
      dwellRingEl.style.top = (y - DWELL_RADIUS_PX) + 'px';
      if (clickable) {
        if (dwellTarget !== clickable) {
          dwellTarget = clickable;
          dwellStartTime = Date.now();
          dwellRingEl.classList.remove('gaze-dwell-done');
        }
        var elapsed = Date.now() - dwellStartTime;
        var pct = Math.min(1, elapsed / DWELL_MS);
        dwellRingEl.style.setProperty('--dwell-pct', String(pct));
        dwellRingEl.classList.add('gaze-dwell-active');
      } else {
        dwellTarget = null;
        dwellRingEl.classList.remove('gaze-dwell-active', 'gaze-dwell-done');
      }
    }
  }

  function updateDwell() {
    if (!dwellRingEl || !dwellTarget) return;
    var elapsed = Date.now() - dwellStartTime;
    if (elapsed >= DWELL_MS) {
      var x = lastGazeX;
      var y = lastGazeY;
      dwellTarget = null;
      dwellRingEl.classList.remove('gaze-dwell-active');
      dwellRingEl.classList.add('gaze-dwell-done');
      performClick(x, y);
    }
  }

  function tick() {
    var w = window.innerWidth;
    var h = window.innerHeight;
    if (useGaze && video && faceLandmarker && video.readyState >= 2) {
      try {
        var now = performance.now();
        var results = faceLandmarker.detectForVideo(video, now);
        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          var landmarks = results.faceLandmarks[0];
          var blinkDetected = false;
          if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
            var cats = results.faceBlendshapes[0].categories || [];
            var leftBlink = cats.find(function (c) { return c.categoryName === 'eyeBlinkLeft'; });
            var rightBlink = cats.find(function (c) { return c.categoryName === 'eyeBlinkRight'; });
            if (leftBlink && rightBlink && leftBlink.score > BLINK_THRESHOLD && rightBlink.score > BLINK_THRESHOLD) {
              blinkDetected = true;
              var t = Date.now();
              if (t - lastBlinkTime > BLINK_COOLDOWN_MS) {
                lastBlinkTime = t;
                blinkClick();
              }
            }
          }
          if (!blinkDetected && landmarks.length > 0) {
            var irisR = landmarks[474];
            var irisL = landmarks[468];
            var nose = landmarks[1];
            var xNorm, yNorm;
            if (irisR && typeof irisR.x === 'number') {
              var ix = irisR.x;
              var iy = irisR.y;
              if (irisL && typeof irisL.x === 'number') {
                ix = (ix + irisL.x) / 2;
                iy = (iy + irisL.y) / 2;
              }
              xNorm = 1 - ix;
              yNorm = iy;
              var out = smooth(xNorm, yNorm);
              var sx = 0.5 + (out.x - 0.5) / 0.65;
              var sy = 0.5 + (out.y - 0.5) / 0.65;
              moveCursor(Math.max(0, Math.min(1, sx)), Math.max(0, Math.min(1, sy)));
            } else if (nose && typeof nose.x === 'number') {
              xNorm = 1 - nose.x;
              yNorm = nose.y;
              var outNose = smooth(xNorm, yNorm);
              var sx2 = 0.5 + (outNose.x - 0.5) / 0.65;
              var sy2 = 0.5 + (outNose.y - 0.5) / 0.65;
              moveCursor(Math.max(0, Math.min(1, sx2)), Math.max(0, Math.min(1, sy2)));
            } else {
              moveCursor(lastGazeX / w, lastGazeY / h);
            }
          } else {
            moveCursor(lastGazeX / w, lastGazeY / h);
          }
        } else {
          moveCursor(lastGazeX / w, lastGazeY / h);
        }
      } catch (e) {
        useGaze = false;
        setStatus('Gaze error — pointer follows mouse. Stare or Space to click.');
        if (lastMouseX >= 0) moveCursor(lastMouseX / w, lastMouseY / h);
      }
    } else {
      if (lastMouseX >= 0 && lastMouseY >= 0) {
        moveCursor(lastMouseX / w, lastMouseY / h);
      } else {
        moveCursor(lastGazeX / w, lastGazeY / h);
      }
    }
    updateDwell();
    animId = requestAnimationFrame(tick);
  }

  function onMouseMove(e) {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }

  function onKeyDown(e) {
    if (e.code === 'Space' && cursorEl && cursorEl.style.display === 'block') {
      e.preventDefault();
      var x = parseFloat(cursorEl.dataset.gazeX || '0');
      var y = parseFloat(cursorEl.dataset.gazeY || '0');
      performClick(x, y);
    }
  }

  async function start() {
    ensureCursor();
    lastGazeX = window.innerWidth * 0.5;
    lastGazeY = window.innerHeight * 0.5;
    lastMouseX = window.innerWidth * 0.5;
    lastMouseY = window.innerHeight * 0.5;
    smoothInit = false;
    moveCursor(0.5, 0.5);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('keydown', onKeyDown);

    setStatus('Pointer follows mouse. Stare at a button to click, or press Space. Loading camera…');

    try {
      video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.style.cssText = 'position:fixed;width:320px;height:240px;opacity:0.001;pointer-events:none;top:0;left:0;';
      document.body.appendChild(video);

      var vision = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/+esm');
      var FilesetResolver = vision.FilesetResolver;
      var FaceLandmarker = vision.FaceLandmarker;
      var resolver = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
      );
      faceLandmarker = await FaceLandmarker.createFromOptions(resolver, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: false
      });
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
      });
      video.srcObject = stream;
      await new Promise(function (resolve, reject) {
        video.onloadeddata = resolve;
        video.onerror = reject;
      });
      video.play().catch(function () {});
      useGaze = true;
      smoothInit = false;
      setStatus('Gaze on — pointer follows your eyes. Stare to click, blink, or press Space.');
    } catch (e) {
      var msg = (e && e.message) ? e.message : String(e);
      setStatus('Camera unavailable — pointer follows mouse. Stare at a button to click, or press Space.');
      useGaze = false;
    }

    animId = requestAnimationFrame(tick);
    if (typeof window.onGazeTrackingStarted === 'function') {
      window.onGazeTrackingStarted();
    }
  }

  function stop() {
    useGaze = false;
    if (animId) {
      cancelAnimationFrame(animId);
      animId = null;
    }
    window.removeEventListener('mousemove', onMouseMove);
    window.removeEventListener('keydown', onKeyDown);
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    if (faceLandmarker) {
      try { faceLandmarker.close(); } catch (_) {}
      faceLandmarker = null;
    }
    if (video && video.parentNode) {
      video.parentNode.removeChild(video);
    }
    video = null;
    dwellTarget = null;
    if (cursorEl) {
      cursorEl.style.display = 'none';
      cursorEl.classList.add('gaze-cursor-hidden');
    }
    if (dwellRingEl) {
      dwellRingEl.classList.remove('gaze-dwell-active', 'gaze-dwell-done');
    }
    if (statusEl) {
      statusEl.textContent = '';
    }
    if (typeof window.onGazeTrackingStopped === 'function') {
      window.onGazeTrackingStopped();
    }
  }

  window.GazeControl = {
    start: start,
    stop: stop,
    isActive: function () {
      return cursorEl !== null && cursorEl.style.display === 'block';
    }
  };
})();
