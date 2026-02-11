/**
 * Background: create offscreen doc for camera/MediaPipe, relay GAZE/BLINK to active tab.
 */

const OFFSCREEN_DOC = "offscreen/offscreen.html";
let offscreenCreated = false;
let trackingTabId = null;

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (existing) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOC,
    reasons: [chrome.offscreen.Reason.USER_MEDIA],
    justification: "Eye tracking camera and MediaPipe for gaze and blink detection.",
  });
  offscreenCreated = true;
}

async function closeOffscreen() {
  if (!(await chrome.offscreen.hasDocument())) return;
  await chrome.offscreen.closeDocument();
  offscreenCreated = false;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_TRACKING") {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          sendResponse({ ok: false, error: "No active tab" });
          return;
        }
        await ensureOffscreen();
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ["content/content.js"],
        });
        trackingTabId = tab.id;
        await chrome.storage.local.set({ tracking: true });
        await new Promise((r) => setTimeout(r, 300));
        chrome.runtime.sendMessage({ type: "START_OFFSCREEN_TRACKING" }).catch(() => {});
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: (e && e.message) || String(e) });
      }
    })();
    return true;
  }

  if (msg.type === "STOP_TRACKING") {
    (async () => {
      chrome.runtime.sendMessage({ type: "STOP_OFFSCREEN_TRACKING" }).catch(() => {});
      await chrome.storage.local.set({ tracking: false });
      trackingTabId = null;
      if (offscreenCreated) {
        await closeOffscreen();
      }
      sendResponse({ ok: true });
    })();
    return true;
  }

  if (msg.type === "GAZE" || msg.type === "BLINK") {
    if (trackingTabId != null) {
      chrome.tabs.sendMessage(trackingTabId, msg).catch(() => {
        trackingTabId = null;
      });
    }
    return false;
  }

  if (msg.type === "TRACKING_STARTED" || msg.type === "TRACKING_STOPPED") {
    return false;
  }

  return false;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === trackingTabId) {
    trackingTabId = null;
  }
});
