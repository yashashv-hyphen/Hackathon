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
  const pourStream = el('pour-stream');
  const btnRecord = el('btn-record-reading');
  const btnReset = el('btn-reset');
  const statusText = el('status-text');
  const volumeDisplay = el('volume-display');
  const resultDisplay = el('result-display');
  const buretteLiquid = el('burette-liquid');
  const beakerLiquid = el('beaker-naoh-liquid');
  const pipetteLiquid = el('pipette-liquid');
  const flaskLiquidClipRect = el('flask-liquid-clip-rect');

  let step = STEPS.FILL_BURETTE;
  let buretteVolume = 0;
  let initialReading = null;
  let tapOpen = false;
  let dropCount = 0;
  let indicatorAdded = false;
  let acidAdded = false;
  let dripInterval = null;
  let animationBusy = false;
  let flaskFillLevel = 0;

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
    volumeDisplay.textContent = buretteVolume > 0 ? `Burette: ${buretteVolume.toFixed(2)} mL` : 'Burette: — mL';
  }

  function showResult(msg) {
    resultDisplay.textContent = msg;
    resultDisplay.classList.add('visible');
  }

  function getBenchRect() {
    return document.querySelector('.bench-surface').getBoundingClientRect();
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

  function getBuretteTapCenter() {
    const rect = buretteEl.getBoundingClientRect();
    const bench = getBenchRect();
    return {
      left: rect.left - bench.left + rect.width / 2 - 3,
      top: rect.bottom - bench.top - 26
    };
  }

  function getFlaskMouthTop() {
    const rect = flaskEl.getBoundingClientRect();
    const bench = getBenchRect();
    return {
      left: rect.left - bench.left + rect.width / 2 - 3,
      top: rect.top - bench.top + 12
    };
  }

  function createDrop(startLeft, startTop, isIndicator, endLeft, endTop) {
    const drop = document.createElement('div');
    drop.className = isIndicator ? 'drop drop-indicator' : 'drop';
    drop.style.left = startLeft + 'px';
    drop.style.top = startTop + 'px';
    const dx = endLeft != null ? endLeft - startLeft : 0;
    const dy = endTop != null ? endTop - startTop : 0;
    drop.style.setProperty('--drop-dx', dx + 'px');
    drop.style.setProperty('--drop-dy', dy + 'px');
    dropContainer.appendChild(drop);
    setTimeout(() => drop.remove(), 650);
  }

  const FLASK_LEVEL_PER_DROP = 0.0048;

  function dripOne() {
    const tap = getBuretteTapCenter();
    const mouth = getFlaskMouthTop();
    createDrop(tap.left, tap.top, false, mouth.left, mouth.top);
    setVolume(buretteVolume - DROP_ML);
    updateBuretteLiquid();
    dropCount += 1;
    flaskFillLevel += FLASK_LEVEL_PER_DROP;
    updateFlaskLiquidClip();
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
    }, 370);
  }

  function stopDripping() {
    if (dripInterval) {
      clearInterval(dripInterval);
      dripInterval = null;
    }
  }

  const FLASK_CLIP_FULL_HEIGHT = 130;
  const FLASK_CLIP_TOP = 45;

  function setFlaskLiquidVisible(visible) {
    if (!flaskLiquidClipRect) return;
    if (!visible) {
      flaskFillLevel = 0;
      flaskLiquidClipRect.setAttribute('y', 175);
      flaskLiquidClipRect.setAttribute('height', 0);
      return;
    }
    updateFlaskLiquidClip();
  }

  function updateFlaskLiquidClip() {
    if (!flaskLiquidClipRect) return;
    const level = Math.max(0, Math.min(1, flaskFillLevel));
    const height = level * FLASK_CLIP_FULL_HEIGHT;
    const y = FLASK_CLIP_TOP + (FLASK_CLIP_FULL_HEIGHT - height);
    flaskLiquidClipRect.setAttribute('y', y);
    flaskLiquidClipRect.setAttribute('height', height);
  }

  function resetLab() {
    stopDripping();
    buretteEl.classList.remove('tap-open', 'tap-press');
    flaskEl.classList.add('flask-empty');
    flaskEl.classList.remove('titration-endpoint');
    flaskFillLevel = 0;
    setFlaskLiquidVisible(false);
    tapOpen = false;
    dropCount = 0;
    acidAdded = false;
    indicatorAdded = false;
    initialReading = null;
    animationBusy = false;
    setStep(STEPS.FILL_BURETTE);
    setVolume(0);
    updateBuretteLiquid();
    setStatus('Start: Click the NaOH beaker to fill the burette.');
    resultDisplay.textContent = '';
    resultDisplay.classList.remove('visible');
    btnRecord.disabled = true;
    while (dropContainer.firstChild) dropContainer.firstChild.remove();
    if (pourStream) pourStream.classList.remove('is-pouring');
    if (beakerLiquid) {
      beakerLiquid.setAttribute('y', 30);
      beakerLiquid.setAttribute('height', 70);
    }
    if (pipetteLiquid) {
      pipetteLiquid.setAttribute('y', 50);
      pipetteLiquid.setAttribute('height', 85);
    }
    beakerNaohEl.classList.remove('pour-enter', 'pour-pickup', 'pour-tilt', 'pour-return', 'pour');
    pipetteEl.classList.remove('pick-up', 'move-to-flask', 'dispense', 'return-rest');
    dropperEl.classList.remove('pick-up', 'move-over-flask', 'squeeze-drop', 'return-rest');
  }

  function onFillBurette() {
    setVolume(BURETTE_FULL_ML);
    initialReading = BURETTE_FULL_ML;
    updateBuretteLiquid();
    setStep(STEPS.ADD_ACID);
    setStatus('Burette filled. Now add HCl to the flask (click the pipette).');
  }

  function runBeakerPourSequence() {
    if (animationBusy || step !== STEPS.FILL_BURETTE) return;
    animationBusy = true;
    beakerNaohEl.classList.remove('pour', 'pour-pickup', 'pour-tilt', 'pour-return');
    beakerNaohEl.classList.add('pour-enter');
    setTimeout(() => {
      beakerNaohEl.classList.remove('pour-enter');
      beakerNaohEl.classList.add('pour-pickup');
      setTimeout(() => {
        beakerNaohEl.classList.remove('pour-pickup');
        beakerNaohEl.classList.add('pour-tilt');
        if (pourStream) pourStream.classList.add('is-pouring');
        animatePourLiquid();
        setTimeout(() => {
          onFillBurette();
          if (pourStream) pourStream.classList.remove('is-pouring');
          beakerNaohEl.classList.remove('pour-tilt');
          beakerNaohEl.classList.add('pour-return');
          setTimeout(() => {
            beakerNaohEl.classList.remove('pour-return');
            animationBusy = false;
          }, 860);
        }, 1280);
      }, 520);
    }, 620);
  }

  function animatePourLiquid() {
    const durationMs = 1200;
    const steps = 24;
    const stepMs = durationMs / steps;
    const beakerStartY = 30;
    const beakerStartH = 70;
    const beakerEndY = 72;
    const beakerEndH = 28;
    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      const t = step / steps;
      const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      const y = beakerStartY + (beakerEndY - beakerStartY) * ease;
      const h = beakerStartH + (beakerEndH - beakerStartH) * ease;
      if (beakerLiquid) {
        beakerLiquid.setAttribute('y', y);
        beakerLiquid.setAttribute('height', h);
      }
      const vol = BURETTE_FULL_ML * ease;
      setVolume(vol);
      updateBuretteLiquid();
      if (step >= steps) {
        clearInterval(interval);
        setVolume(BURETTE_FULL_ML);
        updateBuretteLiquid();
        if (beakerLiquid) {
          beakerLiquid.setAttribute('y', beakerEndY);
          beakerLiquid.setAttribute('height', beakerEndH);
        }
      }
    }, stepMs);
  }

  function runPipetteSequence() {
    if (animationBusy || step !== STEPS.ADD_ACID) return;
    animationBusy = true;
    pipetteEl.classList.add('pick-up');
    setTimeout(() => {
      pipetteEl.classList.remove('pick-up');
      pipetteEl.classList.add('move-to-flask');
      setTimeout(() => {
        pipetteEl.classList.remove('move-to-flask');
        pipetteEl.classList.add('dispense');
        if (pipetteLiquid) {
          pipetteLiquid.setAttribute('y', 78);
          pipetteLiquid.setAttribute('height', 57);
        }
        setTimeout(() => {
          onAddAcid();
          pipetteEl.classList.remove('dispense');
          pipetteEl.classList.add('return-rest');
          if (pipetteLiquid) {
            pipetteLiquid.setAttribute('y', 50);
            pipetteLiquid.setAttribute('height', 85);
          }
          setTimeout(() => {
            pipetteEl.classList.remove('return-rest');
            animationBusy = false;
          }, 680);
        }, 620);
      }, 780);
    }, 460);
  }

  function runDropperSequence() {
    if (animationBusy || step !== STEPS.ADD_INDICATOR) return;
    animationBusy = true;
    dropperEl.classList.add('pick-up');
    setTimeout(() => {
      dropperEl.classList.remove('pick-up');
      dropperEl.classList.add('move-over-flask');
      setTimeout(() => {
        dropperEl.classList.remove('move-over-flask');
        dropperEl.classList.add('squeeze-drop');
        const mouth = getFlaskMouthTop();
        setTimeout(() => {
          createDrop(mouth.left, mouth.top - 48, true, mouth.left, mouth.top);
        }, 160);
        setTimeout(() => {
          onAddIndicator();
          dropperEl.classList.remove('squeeze-drop');
          dropperEl.classList.add('return-rest');
          setTimeout(() => {
            dropperEl.classList.remove('return-rest');
            animationBusy = false;
          }, 560);
        }, 520);
      }, 720);
    }, 420);
  }

  function onAddAcid() {
    flaskEl.classList.remove('flask-empty');
    flaskFillLevel = 0.22;
    setFlaskLiquidVisible(true);
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
    buretteEl.classList.add('tap-press');
    setTimeout(() => buretteEl.classList.remove('tap-press'), 200);
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
    setTimeout(() => flaskEl.classList.remove('swirl'), 680);
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

  beakerNaohEl.addEventListener('click', () => runBeakerPourSequence());
  pipetteEl.addEventListener('click', () => runPipetteSequence());
  dropperEl.addEventListener('click', () => runDropperSequence());
  buretteEl.addEventListener('click', (e) => { e.stopPropagation(); onBuretteClick(); });
  flaskEl.addEventListener('click', (e) => { e.stopPropagation(); onFlaskClick(); });
  standEl.addEventListener('click', (e) => {
    e.stopPropagation();
    standEl.classList.add('stand-adjust');
    setStatus('Stand adjusted.');
    setTimeout(() => standEl.classList.remove('stand-adjust'), 520);
  });
  btnRecord.addEventListener('click', () => {
    if ((step !== STEPS.TITRATE && step !== STEPS.RECORD_READING) || !flaskEl.classList.contains('titration-endpoint')) return;
    if (initialReading === null) initialReading = BURETTE_FULL_ML;
    onRecordReading();
  });
  btnReset.addEventListener('click', resetLab);

  setStep(STEPS.FILL_BURETTE);
  setVolume(0);
  updateBuretteLiquid();
  setFlaskLiquidVisible(false);
  btnRecord.disabled = true;

  const btnEyes = el('btn-eyes');
  const btnEyesLabel = el('btn-eyes-label');
  const gazeHint = el('gaze-hint');
  if (btnEyes && window.GazeControl) {
    btnEyes.addEventListener('click', function () {
      if (window.GazeControl.isActive()) {
        window.GazeControl.stop();
        btnEyes.classList.remove('eyes-on');
        if (btnEyesLabel) btnEyesLabel.textContent = 'Use eyes to click';
        if (gazeHint) gazeHint.textContent = '';
      } else {
        window.GazeControl.start();
        btnEyes.classList.add('eyes-on');
        if (btnEyesLabel) btnEyesLabel.textContent = 'Eyes on';
        if (gazeHint) gazeHint.textContent = 'Pointer follows mouse or gaze. Stare to click, blink, or press Space.';
      }
    });
    window.onGazeTrackingStarted = function () {
      btnEyes.classList.add('eyes-on');
      if (btnEyesLabel) btnEyesLabel.textContent = 'Eyes on';
      if (gazeHint) gazeHint.textContent = 'Pointer follows mouse or gaze. Stare to click, blink, or press Space.';
    };
    window.onGazeTrackingStopped = function () {
      btnEyes.classList.remove('eyes-on');
      if (btnEyesLabel) btnEyesLabel.textContent = 'Use eyes to click';
      if (gazeHint) gazeHint.textContent = '';
    };
  }
})();
