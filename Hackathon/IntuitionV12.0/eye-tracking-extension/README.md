# Eyes as Mouse – Browser Extension

Chrome extension that uses **eye tracking** so your **eyes act as the mouse**: gaze moves an on-screen cursor, and a **blink** triggers a click at the cursor position.

Built using the same approach as the [AccessCode](../) app in this repo: **MediaPipe Face Landmarker** for iris position and blink detection (both eyes closed = click).

## How it works

- **Gaze**: MediaPipe iris landmark (474) is mapped to normalized screen coordinates; the content script draws a blue cursor at that position.
- **Blink**: When both `eyeBlinkLeft` and `eyeBlinkRight` exceed 0.5, a synthetic `click` is dispatched at the current cursor position (with a 600 ms cooldown).
- **Tracking** runs in an offscreen document; a **sandboxed** page loads MediaPipe from the CDN (Chrome’s CSP allows this for sandboxed extension pages).

## Install (Chrome)

1. Open `chrome://extensions/`.
2. Turn on **Developer mode**.
3. Click **Load unpacked** and select the `eye-tracking-extension` folder.

## Use

1. Go to any tab where you want to use gaze control.
2. Click the extension icon and press **Start tracking**.
3. Allow camera access when prompted (used only for eye tracking, not recorded).
4. A blue dot follows your gaze; **blink** to click where the dot is.
5. Click **Stop tracking** when done.

## Requirements

- **Chrome** (Manifest V3).
- **Camera** (built-in or USB) for face/eye tracking.
- **HTTPS or localhost** for the tab you’re controlling (or normal HTTP if you’ve allowed it for testing).

## Structure

```
eye-tracking-extension/
  manifest.json       # MV3, permissions: activeTab, scripting, storage, offscreen
  background.js       # Creates offscreen doc, injects content script, relays GAZE/BLINK
  popup/
    popup.html / .js  # Start / Stop tracking
  offscreen/
    offscreen.html    # Hosts sandbox iframe
    offscreen.js      # Forwards postMessage ↔ chrome.runtime
  sandbox/
    sandbox.html      # Sandboxed page (can load CDN)
    sandbox.js        # MediaPipe + camera, postMessage GAZE/BLINK to parent
  content/
    content.js        # Cursor overlay, blink → click at (x,y)
```

## Optional: icons

To add icons, create an `icons/` folder with `icon16.png`, `icon48.png`, and `icon128.png`, then add the `action.default_icon` and `icons` entries back to `manifest.json`.
