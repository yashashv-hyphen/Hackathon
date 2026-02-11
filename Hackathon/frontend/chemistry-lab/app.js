(function () {
  'use strict';

  const API_BASE = 'http://localhost:8000';
  const BURETTE_FULL_ML = 25;
  const DROP_ML = 0.04;
  const FLASK_PINK_AFTER_DROPS = 120;
  const FLASK_LEVEL_PER_DROP = 0.0048;
  const FLASK_CLIP_FULL_HEIGHT = 130;
  const FLASK_CLIP_TOP = 45;

  const el = (id) => document.getElementById(id);
  const viewUpload = el('view-upload');
  const viewLab = el('view-lab');
  const pdfInput = el('pdf-input');
  const btnUpload = el('btn-upload');
  const uploadStatus = el('upload-status');
  const procedureSteps = el('procedure-steps');
  const statusText = el('status-text');
  const feedbackBox = el('feedback-box');
  const observationBox = el('observation-box');
  const observationArea = el('observation-area');
  const volumeDisplay = el('volume-display');
  const btnBackUpload = el('btn-back-upload');
  const btnRecord = el('btn-record-reading');
  const chatbotFab = el('chatbot-fab');
  const chatbotModal = el('chatbot-modal');
  const chatbotRecord = el('chatbot-record');
  const chatbotStop = el('chatbot-stop');
  const chatbotRecordingStatus = el('chatbot-recording-status');
  const chatbotResponse = el('chatbot-response');
  const chatbotClose = el('chatbot-close');

  let experiment = null;
  let currentStep = 1;
  let animationBusy = false;

  var buretteVolume = 0;
  var tapOpen = false;
  var dropCount = 0;
  var flaskFillLevel = 0;
  var dripInterval = null;

  function showView(name) {
    if (name === 'upload') {
      viewUpload.classList.remove('hidden');
      viewLab.classList.add('hidden');
    } else {
      viewUpload.classList.add('hidden');
      viewLab.classList.remove('hidden');
    }
  }

  function setUploadStatus(msg, isError) {
    if (!uploadStatus) return;
    uploadStatus.textContent = msg;
    uploadStatus.className = 'upload-status' + (isError ? ' error' : '');
  }

  function renderProcedure(procedure) {
    if (!procedureSteps) return;
    procedureSteps.innerHTML = '';
    (procedure || []).forEach((step) => {
      const li = document.createElement('li');
      li.dataset.step = step.step_number;
      li.innerHTML = '<span class="step-num">' + step.step_number + '</span> ' + escapeHtml(step.instruction);
      procedureSteps.appendChild(li);
    });
  }

  function renderPrecautions(precautions) {
    const list = el('precautions-list');
    if (!list) return;
    list.innerHTML = '';
    (precautions || []).forEach((text) => {
      const li = document.createElement('li');
      li.textContent = text;
      list.appendChild(li);
    });
  }

  function escapeHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function updateStepHighlight() {
    document.querySelectorAll('#procedure-steps li').forEach((li) => {
      const n = parseInt(li.getAttribute('data-step'), 10);
      li.classList.toggle('current', n === currentStep);
      li.classList.toggle('done', n < currentStep);
    });
  }

  function buildActionFromClick(apparatusKey) {
    var key = (apparatusKey || '').toLowerCase().replace(/-/g, '_');
    var step = currentStep;
    var titrationMap = {
      '1_burette': 'cleaned and rinsed burette with water',
      '1_beaker': 'filled burette with NaOH',
      '2_pipette': 'added HCl to conical flask using pipette',
      '2_conical_flask': 'placed HCl in conical flask',
      '3_dropper': 'added indicator to flask',
      '3_conical_flask': 'added phenolphthalein indicator to flask',
      '4_burette': 'opened burette tap and added NaOH dropwise',
      '4_conical_flask': 'swirled flask during titration',
      '5_burette': 'recorded final burette reading',
      '5_stand': 'adjusted stand'
    };
    var mapKey = step + '_' + key;
    if (titrationMap[mapKey]) return titrationMap[mapKey];
    var label = key.replace(/_/g, ' ');
    return 'used ' + label;
  }

  async function sendAction(experimentId, action) {
    try {
      const res = await fetch(API_BASE + '/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ experiment_id: experimentId, action: action })
      });
      if (!res.ok) throw new Error(res.statusText);
      return await res.json();
    } catch (e) {
      return { is_correct: false, is_dangerous: false, message: 'Network error: ' + (e.message || 'Could not reach server.') };
    }
  }

  function showFeedback(res) {
    if (!feedbackBox) return;
    feedbackBox.classList.remove('hidden');
    if (observationBox) observationBox.classList.add('hidden');
    feedbackBox.className = 'feedback-box';
    if (res.is_correct) {
      feedbackBox.classList.add('correct');
      feedbackBox.textContent = '';
      if (observationBox) {
        observationBox.classList.remove('hidden');
        observationBox.className = 'observation-box correct';
        observationBox.textContent = res.observation || 'Step completed.';
      }
      if (observationArea) {
        observationArea.innerHTML = '';
        var img = document.createElement('img');
        img.src = 'icons/observation.svg';
        img.alt = 'Observation';
        img.className = 'observation-icon';
        observationArea.appendChild(img);
      }
    } else {
      if (res.is_dangerous) {
        feedbackBox.classList.add('danger');
        feedbackBox.textContent = res.message || 'That could be dangerous in a real lab.';
      } else {
        feedbackBox.classList.add('wrong');
        feedbackBox.textContent = res.message || 'Try again.';
      }
    }
  }

  function clearFeedback() {
    if (feedbackBox) { feedbackBox.classList.add('hidden'); feedbackBox.className = 'feedback-box'; }
    if (observationBox) { observationBox.classList.add('hidden'); observationBox.className = 'observation-box'; }
    if (observationArea) observationArea.innerHTML = '';
  }

  function setVolume(ml) {
    buretteVolume = Math.max(0, Math.min(BURETTE_FULL_ML, ml));
    if (volumeDisplay) volumeDisplay.textContent = buretteVolume > 0 ? 'Burette: ' + buretteVolume.toFixed(2) + ' mL' : 'Burette: — mL';
  }

  function getBenchRect() {
    var bench = document.querySelector('.bench-surface');
    return bench ? bench.getBoundingClientRect() : { left: 0, top: 0 };
  }

  function buretteLiquidHeight() {
    var maxH = 195, minY = 60;
    var pct = buretteVolume / BURETTE_FULL_ML;
    var h = pct * maxH, y = 255 - h;
    return { y: Math.max(minY, y), h: Math.min(h, 255 - minY) };
  }

  function updateBuretteLiquid() {
    var bl = el('burette-liquid');
    if (!bl) return;
    var bh = buretteLiquidHeight();
    bl.setAttribute('y', bh.y);
    bl.setAttribute('height', bh.h);
  }

  function getBuretteTapCenter() {
    var buretteEl = el('burette');
    if (!buretteEl) return { left: 0, top: 0 };
    var rect = buretteEl.getBoundingClientRect();
    var bench = getBenchRect();
    return { left: rect.left - bench.left + rect.width / 2 - 3, top: rect.bottom - bench.top - 26 };
  }

  function getFlaskMouthTop() {
    var flaskEl = el('flask');
    if (!flaskEl) return { left: 0, top: 0 };
    var rect = flaskEl.getBoundingClientRect();
    var bench = getBenchRect();
    return { left: rect.left - bench.left + rect.width / 2 - 3, top: rect.top - bench.top + 12 };
  }

  function createDrop(startLeft, startTop, isIndicator, endLeft, endTop) {
    var dropContainer = el('drop-container');
    if (!dropContainer) return;
    var drop = document.createElement('div');
    drop.className = isIndicator ? 'drop drop-indicator' : 'drop';
    drop.style.left = startLeft + 'px';
    drop.style.top = startTop + 'px';
    var dx = endLeft != null ? endLeft - startLeft : 0;
    var dy = endTop != null ? endTop - startTop : 0;
    drop.style.setProperty('--drop-dx', dx + 'px');
    drop.style.setProperty('--drop-dy', dy + 'px');
    dropContainer.appendChild(drop);
    setTimeout(function () { drop.remove(); }, 650);
  }

  function updateFlaskLiquidClip() {
    var clip = el('flask-liquid-clip-rect');
    if (!clip) return;
    var level = Math.max(0, Math.min(1, flaskFillLevel));
    var height = level * FLASK_CLIP_FULL_HEIGHT;
    var y = FLASK_CLIP_TOP + (FLASK_CLIP_FULL_HEIGHT - height);
    clip.setAttribute('y', y);
    clip.setAttribute('height', height);
  }

  function setFlaskLiquidVisible(visible) {
    var clip = el('flask-liquid-clip-rect');
    var flaskEl = el('flask');
    if (!clip || !flaskEl) return;
    if (!visible) {
      flaskFillLevel = 0;
      clip.setAttribute('y', 175);
      clip.setAttribute('height', 0);
      flaskEl.classList.add('flask-empty');
      return;
    }
    flaskEl.classList.remove('flask-empty');
    updateFlaskLiquidClip();
  }

  function dripOne() {
    var tap = getBuretteTapCenter();
    var mouth = getFlaskMouthTop();
    createDrop(tap.left, tap.top, false, mouth.left, mouth.top);
    setVolume(buretteVolume - DROP_ML);
    updateBuretteLiquid();
    dropCount += 1;
    flaskFillLevel += FLASK_LEVEL_PER_DROP;
    updateFlaskLiquidClip();
    var flaskEl = el('flask');
    var btnRecordEl = el('btn-record-reading');
    if (flaskEl && dropCount >= FLASK_PINK_AFTER_DROPS) {
      flaskEl.classList.add('titration-endpoint');
      if (statusText) statusText.textContent = 'Pink! Close the tap and click "Record final reading".';
      if (btnRecordEl) btnRecordEl.disabled = false;
    }
  }

  function startDripping() {
    if (dripInterval) return;
    dripOne();
    dripInterval = setInterval(function () {
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

  function runBeakerPourAnimation(cb) {
    var beakerNaoh = el('beaker-naoh');
    var pourStream = el('pour-stream');
    var beakerLiquid = el('beaker-naoh-liquid');
    if (animationBusy || !beakerNaoh) { if (cb) cb(); return; }
    animationBusy = true;
    beakerNaoh.classList.remove('pour-enter', 'pour-pickup', 'pour-tilt', 'pour-return');
    beakerNaoh.classList.add('pour-enter');
    setTimeout(function () {
      beakerNaoh.classList.remove('pour-enter');
      beakerNaoh.classList.add('pour-pickup');
      setTimeout(function () {
        beakerNaoh.classList.remove('pour-pickup');
        beakerNaoh.classList.add('pour-tilt');
        if (pourStream) pourStream.classList.add('is-pouring');
        var durationMs = 1200, steps = 24, stepMs = durationMs / steps;
        var beakerStartY = 30, beakerStartH = 70, beakerEndY = 72, beakerEndH = 28;
        var step = 0;
        var iv = setInterval(function () {
          step += 1;
          var t = step / steps;
          var ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
          if (beakerLiquid) {
            beakerLiquid.setAttribute('y', beakerStartY + (beakerEndY - beakerStartY) * ease);
            beakerLiquid.setAttribute('height', beakerStartH + (beakerEndH - beakerStartH) * ease);
          }
          setVolume(BURETTE_FULL_ML * ease);
          updateBuretteLiquid();
          if (step >= steps) {
            clearInterval(iv);
            setVolume(BURETTE_FULL_ML);
            updateBuretteLiquid();
            if (beakerLiquid) { beakerLiquid.setAttribute('y', beakerEndY); beakerLiquid.setAttribute('height', beakerEndH); }
            if (pourStream) pourStream.classList.remove('is-pouring');
            beakerNaoh.classList.remove('pour-tilt');
            beakerNaoh.classList.add('pour-return');
            setTimeout(function () {
              beakerNaoh.classList.remove('pour-return');
              animationBusy = false;
              if (cb) cb();
            }, 860);
          }
        }, stepMs);
      }, 520);
    }, 620);
  }

  function runPipetteAnimation(cb) {
    var pipetteEl = el('pipette');
    var pipetteLiquid = el('pipette-liquid');
    if (animationBusy || !pipetteEl) { if (cb) cb(); return; }
    animationBusy = true;
    pipetteEl.classList.add('pick-up');
    setTimeout(function () {
      pipetteEl.classList.remove('pick-up');
      pipetteEl.classList.add('move-to-flask');
      setTimeout(function () {
        pipetteEl.classList.remove('move-to-flask');
        pipetteEl.classList.add('dispense');
        if (pipetteLiquid) { pipetteLiquid.setAttribute('y', 78); pipetteLiquid.setAttribute('height', 57); }
        setTimeout(function () {
          setFlaskLiquidVisible(true);
          flaskFillLevel = 0.22;
          updateFlaskLiquidClip();
          pipetteEl.classList.remove('dispense');
          pipetteEl.classList.add('return-rest');
          if (pipetteLiquid) { pipetteLiquid.setAttribute('y', 50); pipetteLiquid.setAttribute('height', 85); }
          setTimeout(function () {
            pipetteEl.classList.remove('return-rest');
            animationBusy = false;
            if (cb) cb();
          }, 680);
        }, 620);
      }, 780);
    }, 460);
  }

  function runDropperAnimation(cb) {
    var dropperEl = el('dropper');
    var mouth = getFlaskMouthTop();
    if (animationBusy || !dropperEl) { if (cb) cb(); return; }
    animationBusy = true;
    dropperEl.classList.add('pick-up');
    setTimeout(function () {
      dropperEl.classList.remove('pick-up');
      dropperEl.classList.add('move-over-flask');
      setTimeout(function () {
        dropperEl.classList.remove('move-over-flask');
        dropperEl.classList.add('squeeze-drop');
        setTimeout(function () { createDrop(mouth.left, mouth.top - 48, true, mouth.left, mouth.top); }, 160);
        setTimeout(function () {
          dropperEl.classList.remove('squeeze-drop');
          dropperEl.classList.add('return-rest');
          setTimeout(function () {
            dropperEl.classList.remove('return-rest');
            animationBusy = false;
            if (cb) cb();
          }, 560);
        }, 520);
      }, 720);
    }, 420);
  }

  function runAnimationForCompletedStep(completedStep) {
    if (completedStep === 1) runBeakerPourAnimation();
    else if (completedStep === 2) runPipetteAnimation();
    else if (completedStep === 3) runDropperAnimation();
  }

  function onApparatusClick(e) {
    if (!experiment) return;
    var target = e.target.closest('.apparatus');
    if (!target) return;
    var apparatusKey = target.dataset.apparatus || target.id;
    if (!apparatusKey) return;
    if (animationBusy) return;

    var action = buildActionFromClick(apparatusKey);
    if (statusText) statusText.textContent = 'Checking your action…';
    clearFeedback();

    sendAction(experiment.experiment_metadata.experiment_id, action).then(function (res) {
      if (res.is_correct) {
        var completedStep = currentStep;
        currentStep += 1;
        updateStepHighlight();
        if (statusText) statusText.textContent = 'Correct! ' + (res.observation || '');
        showFeedback(res);
        runAnimationForCompletedStep(completedStep);
        var total = (experiment.procedure || []).length;
        if (currentStep > total && statusText) statusText.textContent = 'Experiment complete. Well done!';
      } else {
        if (statusText) statusText.textContent = 'Try the current step again.';
        showFeedback(res);
      }
    });
  }

  function onBuretteClick(e) {
    e.stopPropagation();
    if (!experiment || currentStep < 4) return;
    var buretteEl = el('burette');
    if (!buretteEl) return;
    buretteEl.classList.add('tap-press');
    setTimeout(function () { buretteEl.classList.remove('tap-press'); }, 200);
    if (tapOpen) {
      tapOpen = false;
      buretteEl.classList.remove('tap-open');
      stopDripping();
      if (statusText) statusText.textContent = 'Tap closed. If you saw pink, click "Record final reading".';
      return;
    }
    tapOpen = true;
    buretteEl.classList.add('tap-open');
    startDripping();
    if (statusText) statusText.textContent = 'Tap open — NaOH dripping. Swirl flask. Click burette again to close when pink.';
    clearFeedback();
    var action = buildActionFromClick('burette');
    sendAction(experiment.experiment_metadata.experiment_id, action).then(function (res) {
      if (res.is_correct) {
        currentStep += 1;
        updateStepHighlight();
        showFeedback(res);
        if (statusText) statusText.textContent = 'Correct! ' + (res.observation || '') + ' Close tap when pink, then Record final reading.';
      } else {
        showFeedback(res);
        if (statusText) statusText.textContent = 'Try again.';
      }
    });
  }

  function onFlaskClick(e) {
    e.stopPropagation();
    var flaskEl = el('flask');
    if (!flaskEl) return;
    flaskEl.classList.add('swirl');
    setTimeout(function () { flaskEl.classList.remove('swirl'); }, 680);
  }

  function onStandClick(e) {
    e.stopPropagation();
    var standEl = el('stand');
    if (standEl) {
      standEl.classList.add('stand-adjust');
      setTimeout(function () { standEl.classList.remove('stand-adjust'); }, 520);
    }
    var action = buildActionFromClick('stand');
    if (!experiment) return;
    clearFeedback();
    statusText.textContent = 'Checking your action…';
    sendAction(experiment.experiment_metadata.experiment_id, action).then(function (res) {
      if (res.is_correct) {
        currentStep += 1;
        updateStepHighlight();
        showFeedback(res);
        statusText.textContent = 'Correct! ' + (res.observation || '');
      } else {
        showFeedback(res);
        statusText.textContent = 'Try again.';
      }
    });
  }

  function onRecordReadingClick() {
    var flaskEl = el('flask');
    if (!experiment || !flaskEl || !flaskEl.classList.contains('titration-endpoint')) return;
    var action = 'recorded final burette reading';
    clearFeedback();
    statusText.textContent = 'Checking…';
    sendAction(experiment.experiment_metadata.experiment_id, action).then(function (res) {
      if (res.is_correct) {
        currentStep += 1;
        updateStepHighlight();
        var used = (BURETTE_FULL_ML - buretteVolume).toFixed(2);
        statusText.textContent = 'Experiment complete. Volume of NaOH used = ' + used + ' mL';
        showFeedback(res);
        if (btnRecord) btnRecord.disabled = true;
      } else {
        showFeedback(res);
        statusText.textContent = 'Try again.';
      }
    });
  }

  async function uploadPdf() {
    var file = pdfInput && pdfInput.files[0];
    if (!file) {
      setUploadStatus('Please choose a PDF file.', true);
      return;
    }
    setUploadStatus('Uploading…');
    btnUpload.disabled = true;
    var form = new FormData();
    form.append('file', file);
    try {
      var res = await fetch(API_BASE + '/', { method: 'POST', body: form });
      if (!res.ok) {
        var err = await res.text();
        try { var j = JSON.parse(err); if (j.detail) err = j.detail; } catch (_) {}
        throw new Error(err || res.statusText);
      }
      var data = await res.json();
      experiment = data;
      currentStep = 1;
      buretteVolume = 0;
      tapOpen = false;
      dropCount = 0;
      flaskFillLevel = 0;
      stopDripping();
      if (el('lab-title')) el('lab-title').textContent = data.experiment_metadata?.title || 'Virtual Lab';
      if (el('lab-objective')) el('lab-objective').textContent = data.experiment_metadata?.objective || '';
      renderProcedure(data.procedure || []);
      renderPrecautions(data.precautions || []);
      updateStepHighlight();
      clearFeedback();
      if (statusText) statusText.textContent = 'Complete the current step using the lab equipment.';
      if (observationArea) observationArea.innerHTML = '';
      setVolume(0);
      updateBuretteLiquid();
      setFlaskLiquidVisible(false);
      var flaskEl = el('flask');
      if (flaskEl) flaskEl.classList.remove('titration-endpoint');
      if (btnRecord) btnRecord.disabled = true;
      var dropContainer = el('drop-container');
      if (dropContainer) while (dropContainer.firstChild) dropContainer.firstChild.remove();
      var beakerLiquid = el('beaker-naoh-liquid');
      if (beakerLiquid) { beakerLiquid.setAttribute('y', 30); beakerLiquid.setAttribute('height', 70); }
      var pipetteLiquid = el('pipette-liquid');
      if (pipetteLiquid) { pipetteLiquid.setAttribute('y', 50); pipetteLiquid.setAttribute('height', 85); }
      showView('lab');
      setUploadStatus('');
    } catch (e) {
      setUploadStatus('Upload failed: ' + (e.message || 'Unknown error'), true);
    } finally {
      btnUpload.disabled = false;
    }
  }

  pdfInput.addEventListener('change', function () {
    btnUpload.disabled = !(pdfInput.files && pdfInput.files.length);
    setUploadStatus('');
  });
  btnUpload.addEventListener('click', uploadPdf);
  btnBackUpload.addEventListener('click', function () { showView('upload'); });

  var benchSurface = document.querySelector('#view-lab .bench-surface');
  if (benchSurface) {
    benchSurface.addEventListener('click', function (e) {
      var t = e.target.closest('.apparatus');
      if (!t) return;
      var id = t.id;
      if (id === 'burette') { onBuretteClick(e); return; }
      if (id === 'flask') { onFlaskClick(e); return; }
      if (id === 'stand') { onStandClick(e); return; }
      onApparatusClick(e);
    });
  }
  if (btnRecord) btnRecord.addEventListener('click', onRecordReadingClick);

  if (el('btn-eyes') && window.GazeControl) {
    var btnEyes = el('btn-eyes');
    var btnEyesLabel = el('btn-eyes-label');
    var gazeHint = el('gaze-hint');
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
        if (gazeHint) gazeHint.textContent = 'Pointer follows mouse or gaze. Stare to click, blink, or Space.';
      }
    });
    window.onGazeTrackingStarted = function () {
      btnEyes.classList.add('eyes-on');
      if (btnEyesLabel) btnEyesLabel.textContent = 'Eyes on';
      if (gazeHint) gazeHint.textContent = 'Pointer follows mouse or gaze. Stare to click, blink, or Space.';
    };
    window.onGazeTrackingStopped = function () {
      btnEyes.classList.remove('eyes-on');
      if (btnEyesLabel) btnEyesLabel.textContent = 'Use eyes to click';
      if (gazeHint) gazeHint.textContent = '';
    };
  }

  if (el('btn-eyes-lab') && window.GazeControl) {
    var btnEyesLab = el('btn-eyes-lab');
    var btnEyesLabelLab = el('btn-eyes-label-lab');
    var gazeHintLab = el('gaze-hint-lab');
    btnEyesLab.addEventListener('click', function () {
      if (window.GazeControl.isActive()) {
        window.GazeControl.stop();
        btnEyesLab.classList.remove('eyes-on');
        if (btnEyesLabelLab) btnEyesLabelLab.textContent = 'Use eyes to click';
        if (gazeHintLab) gazeHintLab.textContent = '';
      } else {
        window.GazeControl.start();
        btnEyesLab.classList.add('eyes-on');
        if (btnEyesLabelLab) btnEyesLabelLab.textContent = 'Eyes on';
        if (gazeHintLab) gazeHintLab.textContent = 'Stare to click, blink, or Space.';
      }
    });
  }

  var mediaRecorder = null;
  var recordedChunks = [];
  function setChatbotStatus(msg) {
    if (chatbotRecordingStatus) chatbotRecordingStatus.textContent = msg;
  }
  function sendAudioToChatbot(base64Audio) {
    if (!experiment) {
      if (chatbotResponse) chatbotResponse.textContent = 'Start an experiment first.';
      return;
    }
    chatbotResponse.textContent = 'Sending…';
    fetch(API_BASE + '/chatbot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experiment_id: experiment.experiment_metadata.experiment_id, audio: base64Audio })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) { chatbotResponse.textContent = data.response || 'No response.'; })
      .catch(function () { chatbotResponse.textContent = 'Could not reach server.'; });
  }
  function startRecording() {
    recordedChunks = [];
    setChatbotStatus('Recording…');
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      try { mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' }); } catch (e) { mediaRecorder = new MediaRecorder(stream); }
      mediaRecorder.ondataavailable = function (e) { if (e.data.size > 0) recordedChunks.push(e.data); };
      mediaRecorder.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        var blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        var reader = new FileReader();
        reader.onloadend = function () {
          var base64 = reader.result;
          if (typeof base64 === 'string' && base64.indexOf(',') >= 0) base64 = base64.split(',')[1];
          sendAudioToChatbot(base64);
          setChatbotStatus('Sent.');
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorder.start();
      chatbotRecord.classList.add('hidden');
      if (chatbotStop) chatbotStop.classList.remove('hidden');
    }).catch(function () { setChatbotStatus('Microphone access denied.'); });
  }
  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      chatbotRecord.classList.remove('hidden');
      if (chatbotStop) chatbotStop.classList.add('hidden');
    }
  }
  chatbotFab.addEventListener('click', function () {
    chatbotModal.classList.remove('hidden');
    chatbotResponse.textContent = '';
    setChatbotStatus('');
  });
  chatbotClose.addEventListener('click', function () { chatbotModal.classList.add('hidden'); });
  chatbotRecord.addEventListener('click', startRecording);
  chatbotStop.addEventListener('click', stopRecording);
})();
