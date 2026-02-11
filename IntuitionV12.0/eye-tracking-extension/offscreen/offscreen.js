/**
 * Offscreen document: hosts sandbox iframe, forwards messages to background.
 * Sandbox loads MediaPipe from CDN (allowed in sandboxed pages).
 */

const iframe = document.getElementById("sandbox");
iframe.src = chrome.runtime.getURL("sandbox/sandbox.html");
let sandboxReady = false;
let pendingStart = false;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "START_OFFSCREEN_TRACKING") {
    try {
      if (sandboxReady && iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: "START" }, "*");
      } else {
        pendingStart = true;
      }
      sendResponse();
    } catch (e) {
      sendResponse(e);
    }
    return false;
  }
  if (msg.type === "STOP_OFFSCREEN_TRACKING") {
    try {
      pendingStart = false;
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: "STOP" }, "*");
      }
      sendResponse();
    } catch (e) {
      sendResponse(e);
    }
    return false;
  }
  return false;
});

window.addEventListener("message", (e) => {
  if (e.source !== iframe.contentWindow) return;
  const d = e.data;
  if (!d || typeof d.type !== "string") return;
  if (d.type === "READY") {
    sandboxReady = true;
    if (pendingStart) {
      pendingStart = false;
      iframe.contentWindow.postMessage({ type: "START" }, "*");
    }
  } else if (d.type === "GAZE") {
    chrome.runtime.sendMessage({ type: "GAZE", xNorm: d.xNorm, yNorm: d.yNorm }).catch(() => {});
  } else if (d.type === "BLINK") {
    chrome.runtime.sendMessage({ type: "BLINK" }).catch(() => {});
  } else if (d.type === "TRACKING_STARTED" || d.type === "TRACKING_STOPPED") {
    chrome.runtime.sendMessage({ type: d.type }).catch(() => {});
  }
});
