(async function () {
  // Load MediaPipe directly
  async function loadDependencies() {
    const loadScript = (src) => {
      return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });
    };

    try {
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/face_mesh.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');
      await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js');
      console.log('[Eye Cursor Extension] MediaPipe scripts loaded');
    } catch (e) {
      console.error('[Eye Cursor Extension] Failed to load scripts', e);
    }
  }

  await loadDependencies();

  // Create Simple Floating UI
  const dock = document.createElement('div');
  dock.id = 'eye-tracking-dock';
  Object.assign(dock.style, {
    position: 'fixed',
    top: '20px',
    right: '20px',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    background: 'rgba(25, 25, 25, 0.9)',
    borderRadius: '8px',
    fontFamily: 'sans-serif',
    transition: 'transform 0.3s ease'
  });

  // Status Indicator
  const statusDot = document.createElement('div');
  Object.assign(statusDot.style, {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#ff4757', // Red
    transition: 'background 0.3s ease'
  });

  // Start/Stop Button
  const actionBtn = document.createElement('button');
  actionBtn.textContent = 'Start';
  Object.assign(actionBtn.style, {
    background: '#007bff',
    border: 'none',
    borderRadius: '4px',
    padding: '8px 16px',
    color: 'white',
    fontSize: '14px',
    cursor: 'pointer'
  });

  dock.appendChild(statusDot);
  dock.appendChild(actionBtn);
  document.body.appendChild(dock);

  // Hover Effect (CSS)
  dock.onmouseenter = () => dock.style.transform = 'scale(1.05)';
  dock.onmouseleave = () => dock.style.transform = 'scale(1)';

  // Core Logic Vars
  let video;
  let isTracking = false;
  let camera = null;

  // Create Virtual Cursor
  const cursor = document.createElement('div');
  Object.assign(cursor.style, {
    position: 'fixed',
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    border: '2px solid white',
    backgroundColor: 'rgba(0, 123, 255, 0.5)',
    pointerEvents: 'none',
    zIndex: '2147483647',
    transform: 'translate(-50%, -50%)',
    top: '0',
    left: '0',
    display: 'none', // Hidden initially
    willChange: 'transform' // Optimize rendering
  });
  document.body.appendChild(cursor);


  actionBtn.onclick = async () => {
    if (!isTracking) {
      // START TRACKING
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        video = document.createElement('video');
        video.style.display = 'none';
        video.srcObject = stream;
        video.autoplay = true;
        document.body.appendChild(video);

        statusDot.style.background = '#2ed573'; // Green
        actionBtn.textContent = 'Stop';
        actionBtn.style.background = '#ff4757';

        cursor.style.display = 'block';

        startTrackingLogic();
        isTracking = true;

      } catch (e) {
        alert(`Camera access denied: ${e.name}\nPlease test on HTTPS sites.`);
        console.error(e);
      }
    } else {
      location.reload();
    }
  };

  // Wait for MediaPipe to load
  function waitForFaceMesh() {
    return new Promise(resolve => {
      const check = () => {
        if (window.FaceMesh) {
          resolve();
        } else {
          setTimeout(check, 200);
        }
      };
      check();
    });
  }

  async function startTrackingLogic() {
    await waitForFaceMesh();

    const faceMesh = new window.FaceMesh({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });
    faceMesh.setOptions({
      maxNumFaces: 1,
      refineLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    // Indices
    const LEFT_IRIS = [474, 475, 476, 477];
    const RIGHT_IRIS = [469, 470, 471, 472];

    let previousGazeX = 0.5;
    let previousGazeY = 0.5;
    const SMOOTHING_FACTOR = 0.1;

    function getAverage(landmarks, indices) {
      let sumX = 0;
      let sumY = 0;
      for (const index of indices) {
        const p = landmarks[index];
        sumX += p.x;
        sumY += p.y;
      }
      return { x: sumX / indices.length, y: sumY / indices.length };
    }

    function estimateGaze(landmarks) {
      const leftIrisCenter = getAverage(landmarks, LEFT_IRIS);
      const rightIrisCenter = getAverage(landmarks, RIGHT_IRIS);

      const rInner = landmarks[133];
      const rOuter = landmarks[33];
      const lInner = landmarks[362];
      const lOuter = landmarks[263];

      const rRatio = (rightIrisCenter.x - rOuter.x) / (rInner.x - rOuter.x);
      const lRatio = (leftIrisCenter.x - lInner.x) / (lOuter.x - lInner.x);
      const avgRatioX = (rRatio + lRatio) / 2;

      const rTop = landmarks[159];
      const rBot = landmarks[145];
      const lTop = landmarks[386];
      const lBot = landmarks[374];

      const rRatioY = (rightIrisCenter.y - rTop.y) / (rBot.y - rTop.y);
      const lRatioY = (leftIrisCenter.y - lTop.y) / (lBot.y - lTop.y);
      const avgRatioY = (rRatioY + lRatioY) / 2;

      const sensitivityX = 2.0;
      const sensitivityY = 2.0;

      let gazeX = (avgRatioX - 0.5) * sensitivityX + 0.5;
      let gazeY = (avgRatioY - 0.5) * sensitivityY + 0.5;

      gazeX = Math.max(0, Math.min(1, gazeX));
      gazeY = Math.max(0, Math.min(1, gazeY));

      previousGazeX += (gazeX - previousGazeX) * SMOOTHING_FACTOR;
      previousGazeY += (gazeY - previousGazeY) * SMOOTHING_FACTOR;

      return {
        x: (1 - previousGazeX) * window.innerWidth,
        y: previousGazeY * window.innerHeight
      };
    }

    let isBlinking = false;
    const BLINK_THRESHOLD = 0.012; // vertical distance / face height approx or just raw ratio if normalized
    // Actually normalized landmarks are 0.0-1.0. 
    // Eye-lid distance usually around 0.02-0.03 when open, < 0.01 when closed.

    function detectBlink(landmarks) {
      // Right eye: 159 (top), 145 (bot)
      // Left eye: 386 (top), 374 (bot)
      const rTop = landmarks[159];
      const rBot = landmarks[145];
      const lTop = landmarks[386];
      const lBot = landmarks[374];

      // Calculate distances
      const rDist = Math.sqrt(Math.pow(rTop.x - rBot.x, 2) + Math.pow(rTop.y - rBot.y, 2));
      const lDist = Math.sqrt(Math.pow(lTop.x - lBot.x, 2) + Math.pow(lTop.y - lBot.y, 2));

      const avgDist = (rDist + lDist) / 2;

      return avgDist < BLINK_THRESHOLD;
    }

    function triggerClick(x, y) {
      const element = document.elementFromPoint(x, y);
      if (element) {
        // Visual feedback
        cursor.style.backgroundColor = '#ff4757';
        cursor.style.transform = `translate(${x}px, ${y}px) scale(0.8)`;
        setTimeout(() => {
          cursor.style.backgroundColor = 'rgba(0, 123, 255, 0.5)';
          cursor.style.transform = `translate(${x}px, ${y}px) scale(1)`;
        }, 200);

        console.log('[Eye Cursor] Click triggered on:', element);
        element.click();
        element.focus();
      }
    }

    faceMesh.onResults(results => {
      if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const gaze = estimateGaze(landmarks);
        cursor.style.transform = `translate(${gaze.x}px, ${gaze.y}px)`;

        // Blink Detection
        const blinking = detectBlink(landmarks);
        if (blinking && !isBlinking) {
          isBlinking = true;
          triggerClick(gaze.x, gaze.y);
        } else if (!blinking) {
          isBlinking = false;
        }
      }
    });

    camera = new window.Camera(video, {
      onFrame: async () => {
        await faceMesh.send({ image: video });
      },
      width: 320,
      height: 240
    });
    camera.start();
  }
})();
