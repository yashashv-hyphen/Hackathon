"use client";

import { useGaze } from "./GazeProvider";

export default function GazeCursor() {
  const { x, y, isTracking, gazeTarget } = useGaze();

  // Don't render until we have a real calibrated position
  if (!isTracking || (x === 0 && y === 0)) return null;

  // Determine cursor zone:
  // - Keyboard key (not suggestion/toolbar/NAV_SUGGESTIONS) → circle
  // - Suggestion, toolbar, or no target → pointer arrow
  const isKeyboardKey =
    !!gazeTarget &&
    !gazeTarget.startsWith("suggestion-") &&
    !gazeTarget.startsWith("toolbar-") &&
    gazeTarget !== "NAV_SUGGESTIONS";

  if (isKeyboardKey) {
    // Circle cursor for keyboard zone
    return (
      <div
        className="gaze-cursor"
        style={{
          left: x - 12,
          top: y - 12,
          width: 24,
          height: 24,
          border: "3px solid #fff",
          backgroundColor: "rgba(56, 139, 253, 0.6)",
          boxShadow: "0 0 12px rgba(56, 139, 253, 0.8)",
        }}
      />
    );
  }

  // Pointer cursor for non-keyboard zones
  const hasTarget = !!gazeTarget;
  const fillColor = hasTarget
    ? "rgba(56, 139, 253, 0.9)"
    : "rgba(56, 139, 253, 0.5)";
  const strokeColor = hasTarget ? "#fff" : "rgba(56, 139, 253, 1)";
  const glowSize = hasTarget ? 12 : 6;

  return (
    <div
      className="gaze-cursor"
      style={{
        left: x - 4,
        top: y - 2,
        width: 28,
        height: 32,
        border: "none",
        backgroundColor: "transparent",
        borderRadius: 0,
        boxShadow: "none",
        filter: `drop-shadow(0 0 ${glowSize}px rgba(56, 139, 253, 0.7))`,
      }}
    >
      <svg
        width="28"
        height="32"
        viewBox="0 0 28 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2 2L2 24L8 18L14 28L18 26L12 16L20 16L2 2Z"
          fill={fillColor}
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
