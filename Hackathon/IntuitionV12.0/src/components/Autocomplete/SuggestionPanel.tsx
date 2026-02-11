"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { type Suggestion } from "./TrieEngine";

interface SuggestionPanelProps {
  suggestions: Suggestion[];
  onAccept: (suggestion: Suggestion) => void;
  gazeTarget: string | null;
  dwellTime: number;
  dwellEnabled: boolean;
}

function SuggestionButton({
  suggestion,
  index,
  isTarget,
  dwellTime,
  dwellEnabled,
  onAccept,
}: {
  suggestion: Suggestion;
  index: number;
  isTarget: boolean;
  dwellTime: number;
  dwellEnabled: boolean;
  onAccept: (suggestion: Suggestion) => void;
}) {
  const [isDwelling, setIsDwelling] = useState(false);
  const dwellTimerRef = useRef<NodeJS.Timeout | null>(null);

  const triggerAccept = useCallback(() => {
    onAccept(suggestion);
  }, [onAccept, suggestion]);

  useEffect(() => {
    if (isTarget && dwellEnabled) {
      setIsDwelling(true);
      dwellTimerRef.current = setTimeout(() => {
        triggerAccept();
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
      if (dwellTimerRef.current) clearTimeout(dwellTimerRef.current);
    };
  }, [isTarget, dwellEnabled, dwellTime, triggerAccept]);

  return (
    <button
      data-key-value={`suggestion-${index}`}
      onClick={() => onAccept(suggestion)}
      className={`
        relative px-3 py-1.5 rounded-lg text-sm font-mono
        transition-all duration-100 border
        ${
          isTarget
            ? "bg-editor-accent/30 border-editor-accent text-white"
            : "bg-editor-surface border-editor-border text-gray-300 hover:bg-gray-700 hover:border-gray-500"
        }
        ${suggestion.type === "snippet" ? "italic" : ""}
      `}
    >
      {suggestion.type === "snippet" && (
        <span className="text-purple-400 mr-1">{"{ }"}</span>
      )}
      {suggestion.text}
      {/* Dwell progress bar */}
      {isDwelling && (
        <span
          className="absolute bottom-0 left-0 h-0.5 bg-editor-accent rounded-full dwell-bar"
          style={{ "--dwell-time": `${dwellTime}ms` } as React.CSSProperties}
        />
      )}
    </button>
  );
}

export default function SuggestionPanel({
  suggestions,
  onAccept,
  gazeTarget,
  dwellTime,
  dwellEnabled,
}: SuggestionPanelProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex gap-2 px-3 py-2 bg-gray-900/50 rounded-lg mb-2">
      <span className="text-xs text-gray-500 self-center mr-1">
        Suggestions:
      </span>
      {suggestions.map((suggestion, index) => (
        <SuggestionButton
          key={`${suggestion.text}-${index}`}
          suggestion={suggestion}
          index={index}
          isTarget={gazeTarget === `suggestion-${index}`}
          dwellTime={dwellTime}
          dwellEnabled={dwellEnabled}
          onAccept={onAccept}
        />
      ))}
    </div>
  );
}
