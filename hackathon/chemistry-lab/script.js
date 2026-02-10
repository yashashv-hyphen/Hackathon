(function () {
  'use strict';

  const BURETTE_FULL_ML = 25;
  const DROP_ML = 0.04;
  const FLASK_PINK_AFTER_DROPS = 120;

  const STEPS = {
    FILL_BURETTE: 1,
    ADD_ACID: 2,
    ADD_INDICATOR: 3,
    TITRATE: 4,
    RECORD_READING: 5
  };

  const el = (id) => document.getElementById(id);
  const buretteEl = document.getElementById('burette');
  const flaskEl = document.getElementById('flask');
  const beakerNaohEl = document.getElementById('beaker-naoh');
  const pipetteEl = document.getElementById('pipette');
  const dropperEl = document.getElementById('dropper');
  const standEl = document.getElementById('stand');
  const dropContainer = el('drop-container');
  const btnRecord = el('btn-record-reading');
  const btnReset = el('btn-reset');
  const statusText = el('status-text');
  const volumeDisplay = el('volume-display');
  const resultDisplay = el('result-display');
  const buretteLiquid = el('burette-liquid');

  let step = STEPS.FILL_BURETTE;
  let buretteVolume = 0;
  let initialReading = null;
  let tapOpen = false;
  let dropCount = 0;
  let indicatorAdded = false;
  let acidAdded = false;
  let dripInterval = null;

  function setStep(s) {
    step = s;
    document.querySelectorAll('.steps li').forEach((li) => {
      const n = parseInt(li.getAttribute('data-step'), 10);
      li.classList.toggle('current', n === step);
      li.classList.toggle('done', n < step);
    });
  }

  function setStatus(msg) {
    statusText.textContent = msg;
  }

  function setVolume(ml) {
    buretteVolume = Math.max(0, Math.min(BURETTE_FULL_ML, ml));
    const str = buretteVolume > 0 ? `Burette: ${buretteVolume.toFixed(2)} mL` : 'Burette: — mL';
    volumeDisplay.textContent = str;
  }

  function showResult(msg) {
    resultDisplay.textContent = msg;
    resultDisplay.classList.add('visible');
  }

  function buretteLiquidHeight() {
    const maxH = 195;
    const minY = 60;
    const pct = buretteVolume / BURETTE_FULL_ML;
    const h = pct * maxH;
    const y = 255 - h;
    return { y: Math.max(minY, y), h: Math.min(h, 255 - minY) };
  }

  function updateBuretteLiquid() {
    if (!buretteLiquid) return;
    const { y, h } = buretteLiquidHeight();
    buretteLiquid.setAttribute('y', y);
    buretteLiquid.setAttribute('height', h);
  }

  function createDrop(leftPx, topPx) {
    const drop = document.createElement('div');
    drop.className = 'drop';
    drop.style.left = leftPx + 'px';
    drop.style.top = topPx + 'px';
    dropContainer.appendChild(drop);
    setTimeout(() => drop.remove(), 900);
  }

  function getBuretteTapCenter() {
    const rect = buretteEl.getBoundingClientRect();
    const bench = document.querySelector('.bench-surface').getBoundingClientRect();
    return {
      left: rect.left - bench.left + rect.width / 2 - 4,
      top: rect.bottom - bench.top - 35
    };
  }

  function dripOne() {
    const { left, top } = getBuretteTapCenter();
    createDrop(left, top);
    setVolume(buretteVolume - DROP_ML);
    updateBuretteLiquid();
    dropCount += 1;
    if (acidAdded && indicatorAdded && dropCount >= FLASK_PINK_AFTER_DROPS) {
      flaskEl.classList.add('titration-endpoint');
      setStatus('Pink! Close the tap and click "Record final reading".');
      btnRecord.disabled = false;
    }
  }

  function startDripping() {
    if (dripInterval) return;
    dripOne();
    dripInterval = setInterval(() => {
      if (!tapOpen || buretteVolume <= 0) {
        clearInterval(dripInterval);
        dripInterval = null;
        return;
      }
      dripOne();
    }, 350);
  }

  function stopDripping() {
    if (dripInterval) {
      clearInterval(dripInterval);
      dripInterval = null;
    }
  }

  function resetLab() {
    stopDripping();
    buretteEl.classList.remove('tap-open');
    flaskEl.classList.add('flask-empty');
    flaskEl.classList.remove('titration-endpoint');
    tapOpen = false;
    dropCount = 0;
    acidAdded = false;
    indicatorAdded = false;
    initialReading = null;
    setStep(STEPS.FILL_BURETTE);
    setVolume(0);
    updateBuretteLiquid();
    setStatus('Start: Click the NaOH beaker to fill the burette.');
    resultDisplay.textContent = '';
    resultDisplay.classList.remove('visible');
    btnRecord.disabled = true;
    while (dropContainer.firstChild) dropContainer.firstChild.remove();
  }

  function onFillBurette() {
    setVolume(BURETTE_FULL_ML);
    initialReading = BURETTE_FULL_ML;
    updateBuretteLiquid();
    setStep(STEPS.ADD_ACID);
    setStatus('Burette filled. Now add HCl to the flask (click the pipette).');
  }

  function onAddAcid() {
    flaskEl.classList.remove('flask-empty');
    acidAdded = true;
    setStep(STEPS.ADD_INDICATOR);
    setStatus('HCl added. Add 2–3 drops of phenolphthalein (click the dropper).');
  }

  function onAddIndicator() {
    indicatorAdded = true;
    setStep(STEPS.TITRATE);
    setStatus('Open the burette tap to add NaOH. Swirl the flask. Stop when you see the first permanent pink.');
    btnRecord.disabled = true;
  }

  function onBuretteClick() {
    if (step < STEPS.TITRATE) return;
    buretteEl.style.transform = 'scale(0.96)';
    setTimeout(() => { buretteEl.style.transform = ''; }, 120);
    tapOpen = !tapOpen;
    buretteEl.classList.toggle('tap-open', tapOpen);
    if (tapOpen) {
      setStatus('Tap open — NaOH is dripping. Swirl the flask. Click the burette again to close when pink.');
      startDripping();
    } else {
      stopDripping();
      setStatus('Tap closed. If you saw pink, click "Record final reading". Otherwise open the tap again.');
    }
  }

  function onFlaskClick() {
    flaskEl.classList.add('swirl');
    setTimeout(() => flaskEl.classList.remove('swirl'), 500);
    if (step === STEPS.TITRATE && tapOpen) {
      setStatus('Swirling to mix. Keep adding NaOH until the first permanent pink.');
    } else if (step === STEPS.TITRATE) {
      setStatus('Open the burette tap to add NaOH, then swirl the flask.');
    }
  }

  function onRecordReading() {
    const finalReading = buretteVolume;
    const used = (initialReading != null ? initialReading : BURETTE_FULL_ML) - finalReading;
    setStep(STEPS.RECORD_READING);
    setStatus('Experiment complete. You used ' + used.toFixed(2) + ' mL of NaOH.');
    showResult('Volume of NaOH used = ' + used.toFixed(2) + ' mL');
    btnRecord.disabled = true;
  }

  // ----- Apparatus click handlers -----
  beakerNaohEl.addEventListener('click', () => {
    if (step !== STEPS.FILL_BURETTE) return;
    beakerNaohEl.classList.add('pour');
    setTimeout(() => beakerNaohEl.classList.remove('pour'), 600);
    onFillBurette();
  });

  pipetteEl.addEventListener('click', () => {
    if (step !== STEPS.ADD_ACID) return;
    pipetteEl.classList.add('squeeze');
    setTimeout(() => pipetteEl.classList.remove('squeeze'), 700);
    onAddAcid();
  });

  dropperEl.addEventListener('click', () => {
    if (step !== STEPS.ADD_INDICATOR) return;
    dropperEl.classList.add('drop-squeeze');
    setTimeout(() => dropperEl.classList.remove('drop-squeeze'), 500);
    onAddIndicator();
  });

  buretteEl.addEventListener('click', (e) => {
    e.stopPropagation();
    onBuretteClick();
  });

  flaskEl.addEventListener('click', (e) => {
    e.stopPropagation();
    onFlaskClick();
  });

  standEl.addEventListener('click', (e) => {
    e.stopPropagation();
    standEl.style.transform = 'translateY(-2px) scale(1.02)';
    setStatus('Stand adjusted.');
    setTimeout(() => { standEl.style.transform = ''; }, 300);
  });

  btnRecord.addEventListener('click', () => {
    if (step !== STEPS.TITRATE && step !== STEPS.RECORD_READING) return;
    if (flaskEl.classList.contains('titration-endpoint')) {
      if (initialReading === null) initialReading = BURETTE_FULL_ML;
      onRecordReading();
    }
  });

  btnReset.addEventListener('click', resetLab);

  // Set initial reading when they first fill (for volume-used calc)
  setStep(STEPS.FILL_BURETTE);
  setVolume(0);
  updateBuretteLiquid();
  btnRecord.disabled = true;

  // ----- Eyes mode (motor disability: gaze pointer, stare or blink to click) -----
  const btnEyes = el('btn-eyes');
  const btnEyesLabel = el('btn-eyes-label');
  const gazeHint = el('gaze-hint');
  if (btnEyes && window.GazeControl) {
    btnEyes.addEventListener('click', function () {
      if (window.GazeControl.isActive()) {
        window.GazeControl.stop();
        btnEyes.classList.remove('eyes-on');
        if (btnEyesLabel) btnEyesLabel.textContent = 'Use eyes (stare or blink to click)';
        if (gazeHint) gazeHint.textContent = '';
      } else {
        window.GazeControl.start();
        btnEyes.classList.add('eyes-on');
        if (btnEyesLabel) btnEyesLabel.textContent = 'Eyes on';
        if (gazeHint) gazeHint.textContent = 'Pointer follows mouse (or gaze if camera works). Stare to click, blink, or press Space.';
      }
    });
    window.onGazeTrackingStarted = function () {
      btnEyes.classList.add('eyes-on');
      if (btnEyesLabel) btnEyesLabel.textContent = 'Eyes on';
      if (gazeHint) gazeHint.textContent = 'Pointer follows mouse (or gaze if camera works). Stare to click, blink, or press Space.';
    };
    window.onGazeTrackingStopped = function () {
      btnEyes.classList.remove('eyes-on');
      if (btnEyesLabel) btnEyesLabel.textContent = 'Use eyes (stare or blink to click)';
      if (gazeHint) gazeHint.textContent = '';
    };
  }
})();
