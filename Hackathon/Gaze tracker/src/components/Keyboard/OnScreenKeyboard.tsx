"use client";

import { useState, useCallback } from "react";
import Key from "./Key";

interface OnScreenKeyboardProps {
  onKeyPress: (value: string) => void;
  onBackspace: () => void;
  gazeTarget: string | null;
  dwellTime: number;
  dwellEnabled: boolean;
  hasSuggestions?: boolean;
}

const ROWS_LOWER = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l", ";"],
  ["z", "x", "c", "v", "b", "n", "m", ",", ".", "/"],
];

const ROWS_UPPER = [
  ["!", "@", "#", "$", "%", "^", "&", "*", "(", ")"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", ":"],
  ["Z", "X", "C", "V", "B", "N", "M", "<", ">", "?"],
];

const SYMBOLS = [
  ["[", "]", "{", "}", "(", ")", "<", ">", "|", "\\"],
  ["+", "-", "*", "/", "=", "!", "@", "#", "$", "%"],
  ["&", "^", "~", "`", "'", '"', "_", ",", ".", ";"],
  [":", "?", "/", "\\", "-", "=", "+", "[", "]", "#"],
];

type KeyboardMode = "lower" | "upper" | "symbols";

export default function OnScreenKeyboard({
  onKeyPress,
  onBackspace,
  gazeTarget,
  dwellTime,
  dwellEnabled,
  hasSuggestions = false,
}: OnScreenKeyboardProps) {
  const [mode, setMode] = useState<KeyboardMode>("lower");

  const rows =
    mode === "upper" ? ROWS_UPPER : mode === "symbols" ? SYMBOLS : ROWS_LOWER;

  const handleKeyPress = useCallback(
    (value: string) => {
      onKeyPress(value);
    },
    [onKeyPress]
  );

  return (
    <div className="flex flex-col gap-[10px] p-3 bg-gray-900/50 rounded-xl">
      {/* Main key rows */}
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-[10px] justify-center">
          {row.map((key) => (
            <Key
              key={`${mode}-${key}`}
              value={key}
              onKeyPress={handleKeyPress}
              isGazeTarget={gazeTarget === key}
              dwellTime={dwellTime}
              dwellEnabled={dwellEnabled}
            />
          ))}
        </div>
      ))}

      {/* Bottom row: special keys */}
      <div className="flex gap-[10px] justify-center mt-1">
        {hasSuggestions && (
          <Key
            value="NAV_SUGGESTIONS"
            display="▲ Suggest"
            width="130px"
            onKeyPress={handleKeyPress}
            isGazeTarget={gazeTarget === "NAV_SUGGESTIONS"}
            dwellTime={dwellTime}
            dwellEnabled={dwellEnabled}
          />
        )}
        <Key
          value="SHIFT"
          display={mode === "upper" ? "abc" : "ABC"}
          width="130px"
          onKeyPress={() =>
            setMode((m) => (m === "lower" ? "upper" : "lower"))
          }
          isGazeTarget={gazeTarget === "SHIFT"}
          dwellTime={dwellTime}
          dwellEnabled={dwellEnabled}
        />
        <Key
          value="SYM"
          display={mode === "symbols" ? "abc" : "#+="}
          width="130px"
          onKeyPress={() =>
            setMode((m) => (m === "symbols" ? "lower" : "symbols"))
          }
          isGazeTarget={gazeTarget === "SYM"}
          dwellTime={dwellTime}
          dwellEnabled={dwellEnabled}
        />
        <Key
          value={"\t"}
          display="Tab"
          width="110px"
          onKeyPress={handleKeyPress}
          isGazeTarget={gazeTarget === "\t"}
          dwellTime={dwellTime}
          dwellEnabled={dwellEnabled}
        />
        <Key
          value=" "
          display="Space"
          width={hasSuggestions ? "260px" : "300px"}
          onKeyPress={handleKeyPress}
          isGazeTarget={gazeTarget === " "}
          dwellTime={dwellTime}
          dwellEnabled={dwellEnabled}
        />
        <Key
          value="BACKSPACE"
          display="⌫"
          width="110px"
          onKeyPress={() => onBackspace()}
          isGazeTarget={gazeTarget === "BACKSPACE"}
          dwellTime={dwellTime}
          dwellEnabled={dwellEnabled}
        />
        <Key
          value={"\n"}
          display="Enter"
          width="130px"
          onKeyPress={handleKeyPress}
          isGazeTarget={gazeTarget === "\n"}
          dwellTime={dwellTime}
          dwellEnabled={dwellEnabled}
        />
      </div>
    </div>
  );
}
