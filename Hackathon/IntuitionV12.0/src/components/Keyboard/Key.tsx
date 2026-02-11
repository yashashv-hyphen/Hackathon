"use client";

import { useState, useRef, useEffect, useCallback } from "react";

interface KeyProps {
  value: string;
  display?: string;
  width?: string;
  onKeyPress: (value: string) => void;
  isGazeTarget?: boolean;
  dwellTime?: number;
  dwellEnabled?: boolean;
}

export default function Key({
  value,
  display,
  width = "110px",
  onKeyPress,
  isGazeTarget = false,
  dwellTime = 800,
  dwellEnabled = true,
}: KeyProps) {
  const [isDwelling, setIsDwelling] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);
  const keyRef = useRef<HTMLButtonElement>(null);

  const triggerPress = useCallback(() => {
    setIsPressed(true);
    onKeyPress(value);
    setTimeout(() => setIsPressed(false), 150);
  }, [onKeyPress, value]);

  // Handle gaze dwell
  useEffect(() => {
    if (isGazeTarget && dwellEnabled) {
      setIsDwelling(true);
      dwellTimerRef.current = setTimeout(() => {
        triggerPress();
        setIsDwelling(false);
      }, dwellTime);
    } else {
      setIsDwelling(false);
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
        dwellTimerRef.current = null;
      }
    }

    return () => {
      if (dwellTimerRef.current) {
        clearTimeout(dwellTimerRef.current);
      }
    };
  }, [isGazeTarget, dwellEnabled, dwellTime, triggerPress]);

  return (
    <button
      ref={keyRef}
      data-key-value={value}
      onClick={() => triggerPress()}
      className={`
        key-btn relative flex items-center justify-center
        rounded-lg border-2 font-mono text-base font-semibold
        transition-all duration-100 select-none
        ${
          isPressed
            ? "bg-editor-accent border-editor-accent text-white scale-95"
            : isGazeTarget
            ? "bg-gray-700 border-editor-accent text-white"
            : "bg-editor-surface border-editor-border text-gray-200 hover:bg-gray-700 hover:border-gray-500"
        }
      `}
      style={{
        width,
        height: "70px",
        minWidth: width,
      }}
    >
      {/* Dwell ring SVG */}
      {isDwelling && (
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 100 100"
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="rgba(56, 139, 253, 0.4)"
            strokeWidth="4"
            strokeDasharray="283"
            strokeDashoffset="283"
            className="dwell-ring"
            style={
              { "--dwell-time": `${dwellTime}ms` } as React.CSSProperties
            }
          />
        </svg>
      )}
      <span className="z-10">{display || value}</span>
    </button>
  );
}
