/**
 * Sandboxed page: can load MediaPipe from CDN. postMessage to parent (offscreen) only.
 */

const BLINK_COOLDOWN_MS = 600;
const SMOOTH_ALPHA = 0.12;
const BLINK_THRESHOLD = 0.5;

let faceLandmarker = null;
let video = null;
let stream = null;
let animId = null;
let lastBlinkTime = 0;
let smoothX = 0.5;
let smoothY = 0.5;
let smoothInitialized = false;

function send(type, payload = {}) {
  if (window.parent !== window) {
    window.parent.postMessage({ type, ...payload }, "*");
  }
}

function smooth(x, y) {
  if (!smoothInitialized) {
    smoothX = x;
    smoothY = y;
    smoothInitialized = true;
  } else {
    smoothX = SMOOTH_ALPHA * x + (1 - SMOOTH_ALPHA) * smoothX;
    smoothY = SMOOTH_ALPHA * y + (1 - SMOOTH_ALPHA) * smoothY;
  }
  return { x: smoothX, y: smoothY };
}

function tick() {
  if (!video || !faceLandmarker || video.readyState < 2) {
    animId = requestAnimationFrame(tick);
    return;
  }
  try {
    const now = performance.now();
    const results = faceLandmarker.detectForVideo(video, now);
    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
      const landmarks = results.faceLandmarks[0];
      let blinkDetected = false;
      if (results.faceBlendshapes && results.faceBlendshapes.length > 0) {
        const cats = results.faceBlendshapes[0].categories || [];
        const leftBlink = cats.find((c) => c.categoryName === "eyeBlinkLeft");
        const rightBlink = cats.find((c) => c.categoryName === "eyeBlinkRight");
        if (
          leftBlink && rightBlink &&
          leftBlink.score > BLINK_THRESHOLD &&
          rightBlink.score > BLINK_THRESHOLD
        ) {
          blinkDetected = true;
          const t = Date.now();
          if (t - lastBlinkTime > BLINK_COOLDOWN_MS) {
            lastBlinkTime = t;
            send("BLINK");
          }
        }
      }
      if (!blinkDetected) {
        const iris = landmarks[474];
        if (iris) {
          const { x, y } = smooth(iris.x, iris.y);
          send("GAZE", {
            xNorm: Math.max(0, Math.min(1, x)),
            yNorm: Math.max(0, Math.min(1, y)),
          });
        }
      }
    }
  } catch (_) {}
  animId = requestAnimationFrame(tick);
}

async function start() {
  video = document.getElementById("cam");
  if (!video) return;
  const vision = await import("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/+esm");
  const { FaceLandmarker, FilesetResolver } = vision;
  const resolver = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
  );
  faceLandmarker = await FaceLandmarker.createFromOptions(resolver, {
    baseOptions: {
      modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numFaces: 1,
    outputFaceBlendshapes: true,
    outputFacialTransformationMatrixes: false,
  });
  stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
  });
  video.srcObject = stream;
  await new Promise((resolve) => {
    video.onloadeddata = resolve;
  });
  smoothInitialized = false;
  animId = requestAnimationFrame(tick);
  send("TRACKING_STARTED");
}

function stop() {
  if (animId) {
    cancelAnimationFrame(animId);
    animId = null;
  }
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (faceLandmarker) {
    try {
      faceLandmarker.close();
    } catch (_) {}
    faceLandmarker = null;
  }
  video = null;
  send("TRACKING_STOPPED");
}

window.addEventListener("message", (e) => {
  if (e.data && e.data.type === "START") {
    start();
  } else if (e.data && e.data.type === "STOP") {
    stop();
  }
});

window.parent.postMessage({ type: "READY" }, "*");
