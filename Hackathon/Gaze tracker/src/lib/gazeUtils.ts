// --- Adaptive exponential smoothing ---
// When gaze is stable (low velocity), use heavy smoothing.
// When gaze jumps (saccade), use light smoothing so cursor keeps up.
const ALPHA_SLOW = 0.04; // heavy damping when stable — halved to reduce jitter
const ALPHA_FAST = 0.18; // smoother saccade tracking
const SACCADE_THRESHOLD = 80; // px — raised to avoid false saccade triggers from noise
const DEAD_ZONE = 3; // px — skip update if raw-to-smooth distance is below this

let smoothX = 0;
let smoothY = 0;
let initialized = false;

// --- Nudge hold: after a nudge, freeze then slowly blend back ---
const NUDGE_HOLD_DURATION = 60; // ~1000ms full freeze at 60fps
const NUDGE_BLEND_DURATION = 30; // ~500ms slow blend-back after freeze
const NUDGE_BLEND_ALPHA = 0.01; // very slow blend during blend-back phase
let nudgeHoldFrames = 0;
let nudgeBlendFrames = 0;

// --- Blink freeze: freeze cursor for N frames during a blink ---
const BLINK_FREEZE_DURATION = 12; // ~200ms at 60fps
let freezeFrames = 0;

export function freezeGaze(frames: number = BLINK_FREEZE_DURATION): void {
  freezeFrames = frames;
}

export function smoothGaze(x: number, y: number): { x: number; y: number } {
  // Blink freeze takes highest priority — return held position
  if (freezeFrames > 0) {
    freezeFrames--;
    return { x: smoothX, y: smoothY };
  }

  // Nudge hold — full freeze, then slow blend-back
  if (nudgeHoldFrames > 0) {
    nudgeHoldFrames--;
    if (nudgeHoldFrames === 0) nudgeBlendFrames = NUDGE_BLEND_DURATION;
    return { x: smoothX, y: smoothY };
  }
  if (nudgeBlendFrames > 0) {
    nudgeBlendFrames--;
    // Blend back extremely slowly so snap hysteresis keeps the lock
    smoothX = NUDGE_BLEND_ALPHA * x + (1 - NUDGE_BLEND_ALPHA) * smoothX;
    smoothY = NUDGE_BLEND_ALPHA * y + (1 - NUDGE_BLEND_ALPHA) * smoothY;
    return { x: smoothX, y: smoothY };
  }

  if (!initialized) {
    smoothX = x;
    smoothY = y;
    initialized = true;
  } else {
    const dx = x - smoothX;
    const dy = y - smoothY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Dead zone: skip update if movement is below noise floor
    if (dist < DEAD_ZONE) {
      return { x: smoothX, y: smoothY };
    }

    // Pick alpha based on how fast the gaze is moving
    const alpha = dist > SACCADE_THRESHOLD ? ALPHA_FAST : ALPHA_SLOW;
    smoothX = alpha * x + (1 - alpha) * smoothX;
    smoothY = alpha * y + (1 - alpha) * smoothY;
  }

  return { x: smoothX, y: smoothY };
}

export function resetSmoothing(): void {
  smoothX = 0;
  smoothY = 0;
  initialized = false;
  nudgeHoldFrames = 0;
  nudgeBlendFrames = 0;
  freezeFrames = 0;
}

// --- Nudge gaze toward a target ---
// Jumps smoothed position 100% to target and holds for NUDGE_HOLD_DURATION
// frames, giving magnetic snapping time to lock onto the suggestion.
export function nudgeGazeToward(targetX: number, targetY: number): void {
  smoothX = targetX;
  smoothY = targetY;
  initialized = true;
  nudgeHoldFrames = NUDGE_HOLD_DURATION;
  // Unlock current snap so the next frame re-evaluates
  lockedElement = null;
}

// --- Magnetic snapping with hysteresis ---
// Once locked on a key, the gaze must move significantly closer to
// a DIFFERENT key before the snap switches. This prevents the cursor
// from oscillating between neighbors.
const SNAP_RADIUS = 75; // px — how close gaze must be to initially snap (covers 110px key + half gap)
const UNLOCK_RATIO = 0.55; // to switch, gaze must be <55% of the distance to the new key vs current

// Distance multiplier for priority elements (suggestions, toolbar) —
// they effectively appear 25% closer, giving them snap priority over
// keyboard keys when equidistant.
const PRIORITY_DISTANCE_SCALE = 0.75;

let lockedElement: Element | null = null;

function effectiveDistance(gazeX: number, gazeY: number, el: Element): number {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const dist = Math.sqrt((gazeX - cx) ** 2 + (gazeY - cy) ** 2);

  const keyValue = (el as HTMLElement).dataset?.keyValue || "";
  if (keyValue.startsWith("suggestion-") || keyValue.startsWith("toolbar-")) {
    return dist * PRIORITY_DISTANCE_SCALE;
  }
  return dist;
}

export function snapToTarget(
  gazeX: number,
  gazeY: number
): { x: number; y: number; snapped: boolean } {
  const keys = document.querySelectorAll("[data-key-value]");
  if (keys.length === 0) return { x: gazeX, y: gazeY, snapped: false };

  // Find nearest key and distance to current locked key
  let nearest: Element | null = null;
  let nearestDist = Infinity;
  let lockedDist = Infinity;

  for (let i = 0; i < keys.length; i++) {
    const dist = effectiveDistance(gazeX, gazeY, keys[i]);

    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = keys[i];
    }
    if (keys[i] === lockedElement) {
      lockedDist = dist;
    }
  }

  // If we're already locked on a key
  if (lockedElement && lockedDist < SNAP_RADIUS * 1.5) {
    // Stay locked unless the nearest key is substantially closer
    if (nearest !== lockedElement && nearestDist < lockedDist * UNLOCK_RATIO) {
      // Switch to the new key
      lockedElement = nearest;
    }
    // Otherwise stay on the locked key
  } else if (nearest && nearestDist < SNAP_RADIUS) {
    // Not locked yet — snap to nearest if close enough
    lockedElement = nearest;
  } else {
    // Too far from any key — unlock
    lockedElement = null;
  }

  if (lockedElement) {
    const rect = lockedElement.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      snapped: true,
    };
  }

  return { x: gazeX, y: gazeY, snapped: false };
}

export function resetSnapping(): void {
  lockedElement = null;
}

// --- Hit detection ---

export function getElementAtGaze(
  x: number,
  y: number
): HTMLElement | null {
  const element = document.elementFromPoint(x, y);
  return element as HTMLElement | null;
}

export function isGazeOnElement(
  gazeX: number,
  gazeY: number,
  element: HTMLElement,
  padding: number = 10
): boolean {
  const rect = element.getBoundingClientRect();
  return (
    gazeX >= rect.left - padding &&
    gazeX <= rect.right + padding &&
    gazeY >= rect.top - padding &&
    gazeY <= rect.bottom + padding
  );
}

export interface GazeTargetResult {
  key: string | null;
  displayX: number; // cursor display position (snapped to key center, or raw gaze)
  displayY: number;
}

export function getGazeTargetKey(
  gazeX: number,
  gazeY: number
): GazeTargetResult {
  // First try magnetic snap
  const snapped = snapToTarget(gazeX, gazeY);
  if (snapped.snapped) {
    const el = document.elementFromPoint(snapped.x, snapped.y);
    if (el) {
      let current: HTMLElement | null = el as HTMLElement;
      while (current) {
        if (current.dataset?.keyValue) {
          return { key: current.dataset.keyValue, displayX: snapped.x, displayY: snapped.y };
        }
        current = current.parentElement;
      }
    }
  }

  // Fallback: direct hit
  const element = getElementAtGaze(gazeX, gazeY);
  if (!element) return { key: null, displayX: gazeX, displayY: gazeY };

  let current: HTMLElement | null = element;
  while (current) {
    if (current.dataset.keyValue) {
      const rect = current.getBoundingClientRect();
      return {
        key: current.dataset.keyValue,
        displayX: rect.left + rect.width / 2,
        displayY: rect.top + rect.height / 2,
      };
    }
    current = current.parentElement;
  }
  return { key: null, displayX: gazeX, displayY: gazeY };
}
