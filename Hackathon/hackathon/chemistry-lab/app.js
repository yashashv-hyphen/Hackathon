(function () {
  'use strict';

  const API_BASE = 'http://localhost:8000';

  const el = (id) => document.getElementById(id);
  const viewUpload = el('view-upload');
  const viewLab = el('view-lab');
  const pdfInput = el('pdf-input');
  const btnUpload = el('btn-upload');
  const uploadStatus = el('upload-status');
  const apparatusContainer = el('apparatus-container');
  const procedureSteps = el('procedure-steps');
  const statusText = el('status-text');
  const feedbackBox = el('feedback-box');
  const observationBox = el('observation-box');
  const observationArea = el('observation-area');
  const btnBackUpload = el('btn-back-upload');
  const chatbotFab = el('chatbot-fab');
  const chatbotModal = el('chatbot-modal');
  const chatbotRecord = el('chatbot-record');
  const chatbotStop = el('chatbot-stop');
  const chatbotRecordingStatus = el('chatbot-recording-status');
  const chatbotResponse = el('chatbot-response');
  const chatbotClose = el('chatbot-close');

  let experiment = null;
  let currentStep = 1;

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

  function normalizeIconName(name) {
    return String(name).toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  function getIconUrl(key) {
    const n = normalizeIconName(key);
    return 'icons/' + n + '.svg';
  }

  function renderMaterials(data) {
    if (!data || !apparatusContainer) return;
    const apparatus = data.apparatus || [];
    const chemicals = data.chemicals || [];
    apparatusContainer.innerHTML = '';

    apparatus.forEach((key) => {
      const div = document.createElement('div');
      div.className = 'apparatus';
      div.dataset.apparatus = key;
      div.setAttribute('title', key.replace(/_/g, ' '));
      const img = document.createElement('img');
      img.src = getIconUrl(key);
      img.alt = key.replace(/_/g, ' ');
      img.className = 'apparatus-icon';
      img.onerror = () => { img.style.display = 'none'; };
      const label = document.createElement('span');
      label.className = 'apparatus-label';
      label.textContent = key.replace(/_/g, ' ');
      div.appendChild(img);
      div.appendChild(label);
      apparatusContainer.appendChild(div);
    });

    chemicals.forEach((key) => {
      const name = typeof key === 'string' ? key : (key.name || key);
      const div = document.createElement('div');
      div.className = 'chemical';
      div.dataset.chemical = name;
      div.setAttribute('title', name.replace(/_/g, ' '));
      const span = document.createElement('span');
      span.className = 'chemical-label';
      span.textContent = name.replace(/_/g, ' ');
      div.appendChild(span);
      apparatusContainer.appendChild(div);
    });
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
    var key = (apparatusKey || '').toLowerCase();
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
      '5_burette': 'recorded final burette reading'
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
    feedbackBox.classList.remove('hidden');
    observationBox.classList.add('hidden');
    feedbackBox.className = 'feedback-box';
    if (res.is_correct) {
      feedbackBox.classList.add('correct');
      feedbackBox.textContent = '';
      observationBox.classList.remove('hidden');
      observationBox.className = 'observation-box correct';
      observationBox.textContent = res.observation || 'Step completed.';
      observationArea.innerHTML = '';
      const img = document.createElement('img');
      img.src = 'icons/observation.svg';
      img.alt = 'Observation';
      img.className = 'observation-icon';
      observationArea.appendChild(img);
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
    feedbackBox.classList.add('hidden');
    feedbackBox.className = 'feedback-box';
    observationBox.classList.add('hidden');
    observationBox.className = 'observation-box';
    observationArea.innerHTML = '';
  }

  function onApparatusClick(e) {
    if (!experiment) return;
    const target = e.target.closest('.apparatus, .chemical');
    if (!target) return;
    const apparatusKey = target.dataset.apparatus || target.dataset.chemical;
    if (!apparatusKey) return;

    const action = buildActionFromClick(apparatusKey);
    statusText.textContent = 'Checking your action…';
    clearFeedback();

    sendAction(experiment.experiment_metadata.experiment_id, action).then((res) => {
      if (res.is_correct) {
        currentStep += 1;
        updateStepHighlight();
        statusText.textContent = 'Correct! ' + (res.observation || '');
        showFeedback(res);
        const total = (experiment.procedure || []).length;
        if (currentStep > total) {
          statusText.textContent = 'Experiment complete. Well done!';
        }
      } else {
        statusText.textContent = 'Try the current step again.';
        showFeedback(res);
      }
    });
  }

  async function uploadPdf() {
    const file = pdfInput && pdfInput.files[0];
    if (!file) {
      setUploadStatus('Please choose a PDF file.', true);
      return;
    }
    setUploadStatus('Uploading…');
    btnUpload.disabled = true;

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch(API_BASE + '/', {
        method: 'POST',
        body: form
      });
      if (!res.ok) {
        var err = await res.text();
        try {
          var j = JSON.parse(err);
          if (j.detail) err = j.detail;
        } catch (_) {}
        throw new Error(err || res.statusText);
      }
      const data = await res.json();
      experiment = data;
      currentStep = 1;

      el('lab-title').textContent = data.experiment_metadata?.title || 'Virtual Lab';
      el('lab-objective').textContent = data.experiment_metadata?.objective || '';

      renderMaterials(data.materials_required || {});
      renderProcedure(data.procedure || []);
      renderPrecautions(data.precautions || []);
      updateStepHighlight();
      clearFeedback();
      statusText.textContent = 'Complete the current step using the lab equipment.';
      observationArea.innerHTML = '';

      showView('lab');
      setUploadStatus('');
    } catch (e) {
      var msg = e.message || 'Unknown error';
      setUploadStatus('Upload failed: ' + msg, true);
    } finally {
      btnUpload.disabled = false;
    }
  }

  pdfInput.addEventListener('change', () => {
    btnUpload.disabled = !(pdfInput.files && pdfInput.files.length);
    setUploadStatus('');
  });
  btnUpload.addEventListener('click', uploadPdf);
  btnBackUpload.addEventListener('click', () => showView('upload'));

  apparatusContainer.addEventListener('click', onApparatusClick);

  // Gaze for upload view
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
        if (gazeHint) gazeHint.textContent = 'Pointer follows mouse (or gaze). Stare to click, blink, or Space.';
      }
    });
    window.onGazeTrackingStarted = function () {
      btnEyes.classList.add('eyes-on');
      if (btnEyesLabel) btnEyesLabel.textContent = 'Eyes on';
      if (gazeHint) gazeHint.textContent = 'Pointer follows mouse (or gaze). Stare to click, blink, or Space.';
    };
    window.onGazeTrackingStopped = function () {
      btnEyes.classList.remove('eyes-on');
      if (btnEyesLabel) btnEyesLabel.textContent = 'Use eyes (stare or blink to click)';
      if (gazeHint) gazeHint.textContent = '';
    };
  }

  // Gaze for lab view
  const btnEyesLab = el('btn-eyes-lab');
  const btnEyesLabelLab = el('btn-eyes-label-lab');
  const gazeHintLab = el('gaze-hint-lab');
  if (btnEyesLab && window.GazeControl) {
    btnEyesLab.addEventListener('click', function () {
      if (window.GazeControl.isActive()) {
        window.GazeControl.stop();
        btnEyesLab.classList.remove('eyes-on');
        if (btnEyesLabelLab) btnEyesLabelLab.textContent = 'Use eyes';
        if (gazeHintLab) gazeHintLab.textContent = '';
      } else {
        window.GazeControl.start();
        btnEyesLab.classList.add('eyes-on');
        if (btnEyesLabelLab) btnEyesLabelLab.textContent = 'Eyes on';
        if (gazeHintLab) gazeHintLab.textContent = 'Stare to click, blink, or Space.';
      }
    });
  }

  // Chatbot: voice record and send base64 (match backend stt.py: accepts base64, optional data URL prefix, decodes and saves as .webm)
  let mediaRecorder = null;
  let recordedChunks = [];

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
      body: JSON.stringify({
        experiment_id: experiment.experiment_metadata.experiment_id,
        audio: base64Audio
      })
    })
      .then((r) => r.json())
      .then((data) => {
        chatbotResponse.textContent = data.response || 'No response.';
      })
      .catch(() => {
        chatbotResponse.textContent = 'Could not reach server.';
      });
  }

  function startRecording() {
    recordedChunks = [];
    setChatbotStatus('Recording…');
    navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        const options = { mimeType: 'audio/webm' };
        try {
          mediaRecorder = new MediaRecorder(stream, options);
        } catch (e) {
          mediaRecorder = new MediaRecorder(stream);
        }
        mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
        mediaRecorder.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
          const reader = new FileReader();
          reader.onloadend = () => {
            let base64 = reader.result;
            if (typeof base64 === 'string' && base64.indexOf(',') >= 0) base64 = base64.split(',')[1];
            sendAudioToChatbot(base64);
            setChatbotStatus('Sent.');
          };
          reader.readAsDataURL(blob);
        };
        mediaRecorder.start();
        chatbotRecord.classList.add('hidden');
        if (chatbotStop) chatbotStop.classList.remove('hidden');
      })
      .catch(() => {
        setChatbotStatus('Microphone access denied.');
      });
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      chatbotRecord.classList.remove('hidden');
      if (chatbotStop) chatbotStop.classList.add('hidden');
    }
  }

  chatbotFab.addEventListener('click', () => {
    chatbotModal.classList.remove('hidden');
    chatbotResponse.textContent = '';
    setChatbotStatus('');
  });
  chatbotClose.addEventListener('click', () => chatbotModal.classList.add('hidden'));
  chatbotRecord.addEventListener('click', startRecording);
  chatbotStop.addEventListener('click', stopRecording);
})();
