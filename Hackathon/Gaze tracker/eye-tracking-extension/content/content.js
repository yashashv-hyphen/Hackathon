/**
 * Content script: gaze cursor overlay + blink = click at cursor position.
 * Listens for GAZE (xNorm, yNorm) and BLINK from background.
 */

let cursorEl = null;
let currentX = 0;
let currentY = 0;

function ensureCursor() {
  if (cursorEl) return cursorEl;
  cursorEl = document.createElement("div");
  cursorEl.id = "eyes-as-mouse-cursor";
  cursorEl.setAttribute("aria-hidden", "true");
  Object.assign(cursorEl.style, {
    position: "fixed",
    left: "0",
    top: "0",
    width: "24px",
    height: "24px",
    marginLeft: "-12px",
    marginTop: "-12px",
    borderRadius: "50%",
    backgroundColor: "rgba(56, 139, 253, 0.65)",
    border: "2px solid rgba(255,255,255,0.9)",
    boxShadow: "0 0 12px rgba(56, 139, 253, 0.7)",
    pointerEvents: "none",
    zIndex: "2147483647",
    transition: "none",
  });
  document.body.appendChild(cursorEl);
  return cursorEl;
}

function hideCursor() {
  if (cursorEl) {
    cursorEl.style.display = "none";
  }
}

function showCursor() {
  if (cursorEl) {
    cursorEl.style.display = "block";
  }
}

function moveCursor(xNorm, yNorm) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  currentX = Math.max(0, Math.min(w, xNorm * w));
  currentY = Math.max(0, Math.min(h, yNorm * h));
  const el = ensureCursor();
  el.style.left = currentX + "px";
  el.style.top = currentY + "px";
  showCursor();
}

function blinkClick() {
  const el = document.elementFromPoint(currentX, currentY);
  if (!el) return;
  const target = el.closest("a, button, [role='button'], input, select, textarea, [onclick], [tabindex='0']") || el;
  target.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: currentX,
      clientY: currentY,
      detail: 1,
    })
  );
  const flash = document.createElement("div");
  flash.style.cssText = "position:fixed;left:" + (currentX - 8) + "px;top:" + (currentY - 8) + "px;width:16px;height:16px;border:2px solid #4a7cff;border-radius:50%;pointer-events:none;z-index:2147483646;animation:fadeOut 0.2s ease-out forwards;";
  document.documentElement.appendChild(flash);
  if (!document.getElementById("eyes-as-mouse-style")) {
    const style = document.createElement("style");
    style.id = "eyes-as-mouse-style";
    style.textContent = "@keyframes fadeOut { to { opacity: 0; } }";
    document.head.appendChild(style);
  }
  setTimeout(() => flash.remove(), 220);
}

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === "GAZE") {
    moveCursor(msg.xNorm, msg.yNorm);
  } else if (msg.type === "BLINK") {
    blinkClick();
  } else if (msg.type === "HIDE_CURSOR") {
    hideCursor();
  }
});
