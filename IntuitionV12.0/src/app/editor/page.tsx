"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import EditorToolbar from "@/components/Editor/EditorToolbar";
import OutputPanel from "@/components/Editor/OutputPanel";
import OnScreenKeyboard from "@/components/Keyboard/OnScreenKeyboard";
import SuggestionPanel from "@/components/Autocomplete/SuggestionPanel";
import GazeProvider, { useGaze } from "@/components/EyeTracker/GazeProvider";
import GazeCursor from "@/components/EyeTracker/GazeCursor";
import CalibrationScreen from "@/components/Calibration/CalibrationScreen";
import GeminiPanel, { type CorrectResponse } from "@/components/AI/GeminiPanel";
import { getTrieEngine, type Suggestion } from "@/components/Autocomplete/TrieEngine";
import { runPython, loadPyodide, isLoaded, type ExecutionResult } from "@/lib/pyodideRunner";
import { saveFile, openFile, getFileName, clearFileHandle } from "@/lib/fileSystem";
import { nudgeGazeToward } from "@/lib/gazeUtils";

const CodeEditor = dynamic(() => import("@/components/Editor/CodeEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full flex items-center justify-center bg-editor-bg rounded-lg border border-editor-border">
      <span className="text-gray-500">Loading editor...</span>
    </div>
  ),
});

const DEFAULT_CODE = `# Welcome to AccessCode!
# Start typing Python code below

print("Hello, world!")
`;

const SETTINGS_STORAGE_KEY = "accesscode_accessibility_settings";

// Default physical keys for gaze actions
const DEFAULT_SWITCH_KEY = "ArrowRight";
const DEFAULT_RECALIBRATE_KEY = "ArrowLeft";

type ContrastMode = "normal" | "high";

type AccessibilitySettings = {
  fontSize: number;
  dwellTime: number;
  contrast: ContrastMode;
  switchKey: string;
  recalibrateKey: string;
};

const DEFAULT_SETTINGS: AccessibilitySettings = {
  fontSize: 18,
  dwellTime: 1200,
  contrast: "normal",
  switchKey: DEFAULT_SWITCH_KEY,
  recalibrateKey: DEFAULT_RECALIBRATE_KEY,
};

// Inner component that consumes GazeContext
function EditorInner() {
  const { gazeTarget, isTracking, x: gazeX, y: gazeY } = useGaze();

  const [code, setCode] = useState(DEFAULT_CODE);
  const [output, setOutput] = useState<ExecutionResult>({
    stdout: "",
    stderr: "",
    error: null,
    errorLine: null,
  });
  const [isRunning, setIsRunning] = useState(false);
  const [isPyodideLoading, setIsPyodideLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(true);
  const [showCalibration, setShowCalibration] = useState(true);
  const [editorPanePercent, setEditorPanePercent] = useState(72);
  const [dwellTime, setDwellTime] = useState(DEFAULT_SETTINGS.dwellTime);
  const [fontSize, setFontSize] = useState(DEFAULT_SETTINGS.fontSize);
  const [contrastMode, setContrastMode] = useState<ContrastMode>(DEFAULT_SETTINGS.contrast);
  const [switchKey, setSwitchKey] = useState(DEFAULT_SETTINGS.switchKey);
  const [recalibrateKey, setRecalibrateKey] = useState(DEFAULT_SETTINGS.recalibrateKey);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showMacroTip, setShowMacroTip] = useState(false);
  const [showHintModal, setShowHintModal] = useState(false);
  const [fixErrorTraceback, setFixErrorTraceback] = useState<string | null>(null);
  const [isFixLoading, setIsFixLoading] = useState(false);
  const [fixPreview, setFixPreview] = useState<CorrectResponse | null>(null);
  const [fixError, setFixError] = useState<string | null>(null);
  const aiRequestIdRef = useRef(0);

  const editorContainerRef = useRef<HTMLDivElement>(null);
  const mainSplitRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const trieEngine = useRef(getTrieEngine());
  const gazeTargetRef = useRef<string | null>(null);
  const suggestionsRef = useRef<Suggestion[]>([]);
  const settingsLoadedRef = useRef(false);
  const gazeXRef = useRef(0);
  const gazeYRef = useRef(0);
  const showCalibrationRef = useRef(true);

  // Ref for handler callbacks to avoid stale closures in keydown listener
  const handlersRef = useRef({
    handleRun: () => {},
    handleSave: () => {},
    handleOpen: () => {},
    handleNewFile: () => {},
    handleAiComplete: () => {},
    handleAiFix: () => {},
    toggleSettings: () => {},
  });

  // Keep refs in sync so the keydown listener always sees current values
  useEffect(() => { gazeTargetRef.current = gazeTarget; }, [gazeTarget]);
  useEffect(() => { suggestionsRef.current = suggestions; }, [suggestions]);
  useEffect(() => { gazeXRef.current = gazeX; }, [gazeX]);
  useEffect(() => { gazeYRef.current = gazeY; }, [gazeY]);
  useEffect(() => { showCalibrationRef.current = showCalibration; }, [showCalibration]);

  // Load Pyodide on mount
  useEffect(() => {
    setIsPyodideLoading(true);
    loadPyodide()
      .then(() => setIsPyodideLoading(false))
      .catch(() => setIsPyodideLoading(false));
  }, []);

  // Load accessibility settings
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<AccessibilitySettings>;
      if (typeof parsed.fontSize === "number") setFontSize(parsed.fontSize);
      if (typeof parsed.dwellTime === "number") setDwellTime(parsed.dwellTime);
      if (parsed.contrast === "normal" || parsed.contrast === "high") setContrastMode(parsed.contrast);
      if (typeof parsed.switchKey === "string") setSwitchKey(parsed.switchKey);
      if (typeof parsed.recalibrateKey === "string") setRecalibrateKey(parsed.recalibrateKey);
    } catch {
      // Ignore malformed settings
    } finally {
      settingsLoadedRef.current = true;
    }
  }, []);

  // Persist accessibility settings
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!settingsLoadedRef.current) return;
    const payload: AccessibilitySettings = {
      fontSize,
      dwellTime,
      contrast: contrastMode,
      switchKey,
      recalibrateKey,
    };
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
  }, [fontSize, dwellTime, contrastMode, switchKey, recalibrateKey]);

  // Update CSS variables for dwell and editor font size
  useEffect(() => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--dwell-time", `${dwellTime}ms`);
    root.style.setProperty("--font-size-editor", `${fontSize}px`);
  }, [dwellTime, fontSize]);

  // Macro tip on first load
  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem("accesscode_seen_macro_tip");
    if (!seen) setShowMacroTip(true);
  }, []);

  const dismissMacroTip = useCallback(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("accesscode_seen_macro_tip", "1");
    }
    setShowMacroTip(false);
  }, []);

  const handleHintClick = useCallback(() => {
    setShowHintModal(true);
  }, []);

  // Auto-dismiss macro tip after 5 seconds
  useEffect(() => {
    if (!showMacroTip) return;
    const timer = window.setTimeout(() => {
      dismissMacroTip();
    }, 5000);
    return () => window.clearTimeout(timer);
  }, [showMacroTip, dismissMacroTip]);

  // Global key listener: switch key activates gaze target, recalibrate key opens calibration
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // --- Recalibrate key ---
      if (e.key === recalibrateKey) {
        e.preventDefault();
        e.stopPropagation();
        setShowCalibration(true);
        return;
      }

      // --- Switch key (activate gaze target) ---
      if (e.key !== switchKey) return;

      e.preventDefault();
      e.stopPropagation();

      // Guard: ignore switch key during calibration
      if (showCalibrationRef.current) return;

      const target = gazeTargetRef.current;

      // No keyboard key targeted — try clicking any button/link under the gaze
      if (!target) {
        const el = document.elementFromPoint(gazeXRef.current, gazeYRef.current);
        if (el) {
          const clickable = (el.closest("button") || el.closest("a") || el.closest("[role='button']")) as HTMLElement | null;
          if (clickable) {
            clickable.classList.add("gaze-click-flash");
            setTimeout(() => clickable.classList.remove("gaze-click-flash"), 200);
            clickable.click();
          }
        }
        return;
      }

      // Toolbar buttons — delegate to handler refs
      if (target.startsWith("toolbar-")) {
        const btn = document.querySelector(`[data-key-value="${target}"]`) as HTMLElement | null;
        if (btn) {
          btn.classList.add("gaze-click-flash");
          setTimeout(() => btn.classList.remove("gaze-click-flash"), 200);
        }
        const handlers = handlersRef.current;
        switch (target) {
          case "toolbar-run": handlers.handleRun(); break;
          case "toolbar-save": handlers.handleSave(); break;
          case "toolbar-open": handlers.handleOpen(); break;
          case "toolbar-new": handlers.handleNewFile(); break;
          case "toolbar-complete": handlers.handleAiComplete(); break;
          case "toolbar-fix": handlers.handleAiFix(); break;
          case "toolbar-settings": handlers.toggleSettings(); break;
        }
        return;
      }

      // Suggestion button — click it directly (SuggestionButton has onClick)
      if (target.startsWith("suggestion-")) {
        const idx = parseInt(target.replace("suggestion-", ""), 10);
        const s = suggestionsRef.current[idx];
        if (s) {
          const el = document.querySelector(`[data-key-value="${target}"]`) as HTMLElement;
          el?.click();
        }
        return;
      }

      // NAV_SUGGESTIONS — nudge gaze toward suggestion-0
      if (target === "NAV_SUGGESTIONS") {
        const suggEl = document.querySelector('[data-key-value="suggestion-0"]') as HTMLElement | null;
        if (suggEl) {
          const rect = suggEl.getBoundingClientRect();
          nudgeGazeToward(rect.left + rect.width / 2, rect.top + rect.height / 2);
        }
        return;
      }

      // Keyboard special keys — click the DOM element to trigger flash animation
      if (target === "SHIFT" || target === "SYM") {
        const el = document.querySelector(`[data-key-value="${target}"]`) as HTMLElement;
        el?.click();
        return;
      }

      // BACKSPACE — click the DOM element for flash animation
      if (target === "BACKSPACE") {
        const el = document.querySelector(`[data-key-value="BACKSPACE"]`) as HTMLElement;
        el?.click();
        return;
      }

      // Regular character key — click the DOM element for flash animation
      // The Key component's onClick calls onKeyPress which inserts the text
      const el = document.querySelector(`[data-key-value="${CSS.escape(target)}"]`) as HTMLElement;
      el?.click();
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [recalibrateKey, switchKey]);
  // Update suggestions as user types — check word at cursor position
  const handleCodeChange = useCallback((newCode: string, cursorPos: number) => {
    setCode(newCode);

    const textBeforeCursor = newCode.slice(0, cursorPos);
    const match = textBeforeCursor.match(/(\w+)$/);
    if (match && match[1].length >= 2) {
      const results = trieEngine.current.getSuggestions(match[1], 5);
      setSuggestions(results);
    } else {
      setSuggestions([]);
    }
  }, []);

  const keyOptions = [
    { value: "ArrowLeft", label: "Arrow Left (\u2190)" },
    { value: "ArrowRight", label: "Arrow Right (\u2192)" },
    { value: "ArrowUp", label: "Arrow Up (\u2191)" },
    { value: "ArrowDown", label: "Arrow Down (\u2193)" },
    { value: "Enter", label: "Enter" },
    { value: " ", label: "Space" },
    { value: "Tab", label: "Tab" },
  ];

  const formatKeyLabel = (key: string) => {
    switch (key) {
      case "ArrowLeft":
        return "\u2190";
      case "ArrowRight":
        return "\u2192";
      case "ArrowUp":
        return "\u2191";
      case "ArrowDown":
        return "\u2193";
      case " ":
        return "Space";
      default:
        return key;
    }
  };


  const insertText = useCallback((text: string) => {
    const el = editorContainerRef.current?.querySelector("[class*='cm-editor']")?.parentElement;
    if (el && (el as HTMLDivElement & { insertAtCursor?: (t: string) => void }).insertAtCursor) {
      (el as HTMLDivElement & { insertAtCursor: (t: string) => void }).insertAtCursor(text);
    }
  }, []);

  const replaceCurrentLine = useCallback((text: string) => {
    const el = editorContainerRef.current?.querySelector("[class*='cm-editor']")?.parentElement;
    if (el && (el as HTMLDivElement & { replaceCurrentLine?: (t: string) => void }).replaceCurrentLine) {
      (el as HTMLDivElement & { replaceCurrentLine: (t: string) => void }).replaceCurrentLine(text);
    }
  }, []);

  const getCursorInfo = useCallback(() => {
    const el = editorContainerRef.current?.querySelector("[class*='cm-editor']")?.parentElement;
    if (el && (el as HTMLDivElement & { getCursorInfo?: () => { pos: number; ch: number; lineFrom: number; lineTo: number; lineText: string; lineIndent: string } | null }).getCursorInfo) {
      return (el as HTMLDivElement & { getCursorInfo: () => { pos: number; ch: number; lineFrom: number; lineTo: number; lineText: string; lineIndent: string } | null }).getCursorInfo();
    }
    return null;
  }, []);

  const handleBackspace = useCallback(() => {
    const el = editorContainerRef.current?.querySelector("[class*='cm-editor']")?.parentElement;
    if (el && (el as HTMLDivElement & { handleBackspace?: () => void }).handleBackspace) {
      (el as HTMLDivElement & { handleBackspace: () => void }).handleBackspace();
    }
  }, []);

  const handleKeyPress = useCallback(
    (value: string) => {
      // If Enter key from on-screen keyboard, try macro expansion first
      if (value === "\n") {
        const el = editorContainerRef.current?.querySelector("[class*='cm-editor']")?.parentElement;
        if (el && (el as HTMLDivElement & { expandMacroIfMatch?: () => boolean }).expandMacroIfMatch) {
          const expanded = (el as HTMLDivElement & { expandMacroIfMatch: () => boolean }).expandMacroIfMatch();
          if (expanded) {
            // Macro was expanded, don't insert newline
            return;
          }
        }
      }
      // Normal character or Enter with no macro match
      insertText(value);
    },
    [insertText]
  );

  const handleAcceptSuggestion = useCallback(
    (suggestion: Suggestion) => {
      const lines = code.split("\n");
      const lastLine = lines[lines.length - 1] || "";
      const match = lastLine.match(/(\w+)$/);

      if (match) {
        const prefix = match[1];
        if (suggestion.snippet) {
          const textToInsert = suggestion.snippet.code.slice(prefix.length);
          insertText(textToInsert);
        } else {
          const textToInsert = suggestion.text.slice(prefix.length);
          insertText(textToInsert);
        }
        trieEngine.current.recordUsage(suggestion.text);
      }
      setSuggestions([]);
    },
    [code, insertText]
  );

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setOutput({ stdout: "", stderr: "", error: null, errorLine: null });
    setFixPreview(null);
    setFixError(null);
    setFixErrorTraceback(null);
    try {
      const result = await runPython(code);
      setOutput(result);
    } catch (err) {
      setOutput({
        stdout: "",
        stderr: "",
        error: `Failed to run code: ${err}`,
        errorLine: null,
      });
    } finally {
      setIsRunning(false);
    }
  }, [code]);

  const handleSave = useCallback(async () => {
    const name = await saveFile(code);
    if (name) setFileName(name);
  }, [code]);

  const handleOpen = useCallback(async () => {
    const result = await openFile();
    if (result) {
      setCode(result.content);
      setFileName(result.name);
    }
  }, []);

  const handleNewFile = useCallback(() => {
    if (code !== DEFAULT_CODE && code.trim() !== "") {
      if (!window.confirm("Discard unsaved changes?")) return;
    }
    setCode("");
    setFileName(null);
    clearFileHandle();
    setOutput({ stdout: "", stderr: "", error: null, errorLine: null });
  }, [code]);

  const handleAiComplete = useCallback(async () => {
    if (aiLoading) return;
    const cursorInfo = getCursorInfo();
    const pos = cursorInfo?.pos ?? code.length;
    const indent = cursorInfo?.lineIndent ?? "";
    const prefix = code.slice(0, pos);
    const suffix = code.slice(pos);
    const requestId = aiRequestIdRef.current + 1;
    aiRequestIdRef.current = requestId;
    setAiLoading(true);
    setAiError(null);

    // Calculate cursor line number for scrolling
    const cursorLineNumber = code.slice(0, pos).split('\n').length;

    try {
      const response = await fetch("/api/gemini/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          cursor: pos,
          indent,
          mode: "blockComplete",
        }),
      });
      const text = await response.text();
      if (requestId !== aiRequestIdRef.current) return;
      setAiPreview(text?.trim() ? text : null);

      // Scroll to cursor line where suggestion will appear
      const editorContainer = editorContainerRef.current?.querySelector("[class*='cm-editor']")?.parentElement;
      if (editorContainer && (editorContainer as HTMLDivElement & { scrollToLine?: (line: number) => void }).scrollToLine) {
        (editorContainer as HTMLDivElement & { scrollToLine: (line: number) => void }).scrollToLine(cursorLineNumber);
      }
    } catch {
      if (requestId !== aiRequestIdRef.current) return;
      setAiError("AI Complete failed. Retry?");
      setAiPreview(null);
    } finally {
      if (requestId === aiRequestIdRef.current) setAiLoading(false);
    }
  }, [aiLoading, code, getCursorInfo]);
  const handleAiFix = useCallback(async () => {
    if (isFixLoading || !output.error) return;
    
    setFixErrorTraceback(output.error);
    setIsFixLoading(true);
    setFixError(null);
    setFixPreview(null);

    try {
      const response = await fetch("/api/gemini/correct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          traceback: output.error,
          constraints: {
            minimalChange: true,
            doNotRefactor: true,
            pyodideOnly: true,
          },
        }),
      });

      const data = await response.json() as unknown;
      
      if (!response.ok) {
        setFixError("Failed to get AI suggestion");
        return;
      }

      const result = data as CorrectResponse;
      setFixPreview(result);

      const targetLine = result.edits?.[0]?.startLine ?? output.errorLine;
      if (targetLine && targetLine > 0) {
        const editorContainer = editorContainerRef.current?.querySelector("[class*='cm-editor']")?.parentElement;
        if (editorContainer && (editorContainer as HTMLDivElement & { scrollToLine?: (line: number) => void }).scrollToLine) {
          (editorContainer as HTMLDivElement & { scrollToLine: (line: number) => void }).scrollToLine(targetLine);
        }
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setFixError(`Error: ${errorMsg}`);
    } finally {
      setIsFixLoading(false);
    }
  }, [isFixLoading, output.error, output.errorLine, code]);

  // Convert fix edits to ghost text preview
  const getFixGhostText = useCallback((): string | null => {
    if (!fixPreview || !fixPreview.edits.length) return null;

    const lines = code.split("\n");
    const sortedEdits = [...fixPreview.edits].sort((a, b) => b.startLine - a.startLine);

    for (const edit of sortedEdits) {
      const lineIdx = edit.startLine - 1;
      const endIdx = edit.endLine - 1;

      if (lineIdx < 0 || lineIdx >= lines.length || endIdx < lineIdx || endIdx >= lines.length) {
        continue;
      }

      const newLines = edit.insert.split("\n");
      lines.splice(lineIdx, endIdx - lineIdx + 1, ...newLines);
    }

    return lines.join("\n");
  }, [fixPreview, code]);

  const handleAcceptFix = useCallback(() => {
    const fixedCode = getFixGhostText();
    if (!fixedCode) return;

    setCode(fixedCode);
    setFixPreview(null);
    setFixErrorTraceback(null);
    setFixError(null);
  }, [fixPreview, code, getFixGhostText]);

  const handleDismissFix = useCallback(() => {
    setFixPreview(null);
    setFixError(null);
  }, []);

  const handleAcceptAi = useCallback(() => {
    if (!aiPreview) return;
    const cursorInfo = getCursorInfo();
    const indent = cursorInfo?.lineIndent ?? "";
    const lineText = cursorInfo?.lineText ?? "";
    const ch = cursorInfo?.ch ?? 0;
    const pos = cursorInfo?.pos ?? code.length;

    const applyIndent = (text: string, indentValue: string) =>
      text
        .split("\n")
        .map((line) => {
          if (line.length === 0) return line;
          return line.startsWith(indentValue) ? line : `${indentValue}${line}`;
        })
        .join("\n");

    const lines = code.split("\n");
    const lineIndex = code.slice(0, pos).split("\n").length - 1;
    const currentLine = lines[lineIndex] ?? "";
    const currentIndent = currentLine.match(/^\s*/)?.[0] ?? "";
    let blockIndent = currentLine.trim().length > 0 ? currentIndent : "";
    if (!blockIndent && lineIndex > 0) {
      for (let i = lineIndex - 1; i >= 0; i -= 1) {
        const prevLine = lines[i] ?? "";
        if (prevLine.trim().length > 0) {
          blockIndent = prevLine.match(/^\s*/)?.[0] ?? "";
          break;
        }
      }
    }

    if (lineText.trim() === "pass") {
      const replacement = applyIndent(aiPreview, indent);
      replaceCurrentLine(replacement);
    } else if (blockIndent && currentIndent.length < blockIndent.length) {
      // Outside the current block; do not apply block completion.
      setAiPreview(null);
      setAiError("AI Complete canceled (outside block)");
      return;
    } else if (currentLine.trim().length === 0) {
      const replacement = applyIndent(aiPreview, blockIndent || indent);
      replaceCurrentLine(replacement);
    } else {
      let insertValue = aiPreview;
      const linePrefix = lineText.slice(0, ch);
      const effectiveIndent = blockIndent || indent;

      if (linePrefix.trim().length > 0 && !insertValue.startsWith("\n")) {
        insertValue = `\n${effectiveIndent}${insertValue}`;
        insertText(insertValue);
      } else if (linePrefix.trim().length === 0) {
        const replacement = applyIndent(insertValue, effectiveIndent);
        replaceCurrentLine(replacement);
      } else {
        // Insert at end-of-block
        let insertAt = code.length;
        for (let i = lineIndex + 1; i < lines.length; i += 1) {
          const nextLine = lines[i] ?? "";
          if (nextLine.trim().length === 0) continue;
          const nextIndent = nextLine.match(/^\s*/)?.[0] ?? "";
          if (nextIndent.length < effectiveIndent.length) {
            insertAt = code.slice(0, code.length).split("\n").
              slice(0, i).join("\n").length + (i > 0 ? 1 : 0);
            break;
          }
        }

        let insertion = applyIndent(insertValue, effectiveIndent);
        if (!insertion.endsWith("\n")) insertion += "\n";
        const nextCode = `${code.slice(0, insertAt)}${insertion}${code.slice(insertAt)}`;
        setCode(nextCode);
      }
    }
    setAiPreview(null);
    setAiError(null);
  }, [aiPreview, code, getCursorInfo, insertText, replaceCurrentLine]);

  const handleDismissAi = useCallback(() => {
    setAiPreview(null);
    setAiError(null);
  }, []);

  const handleCalibrationComplete = useCallback(() => {
    setShowCalibration(false);
  }, []);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      if (!isResizingRef.current) return;
      const container = mainSplitRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width);
      const percent = (x / rect.width) * 100;
      const clamped = Math.min(Math.max(percent, 50), 85);
      setEditorPanePercent(clamped);
    };

    const handleUp = () => {
      isResizingRef.current = false;
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, []);

  const handleSplitKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" ? -2 : 2;
    setEditorPanePercent((prev) => Math.min(Math.max(prev + delta, 50), 85));
  }, []);

  const toggleSettings = useCallback(() => {
    setShowSettings((s) => !s);
  }, []);

  // Keep handlersRef in sync with the latest callbacks
  useEffect(() => {
    handlersRef.current = {
      handleRun,
      handleSave,
      handleOpen,
      handleNewFile,
      handleAiComplete,
      handleAiFix,
      toggleSettings,
    };
  }, [handleRun, handleSave, handleOpen, handleNewFile, handleAiComplete, handleAiFix, toggleSettings]);

  return (
    <div className={`flex flex-col h-screen bg-gray-950 ${contrastMode === "high" ? "high-contrast" : ""}`}>
      {/* Calibration overlay */}
      {showCalibration && (
        <CalibrationScreen onComplete={handleCalibrationComplete} />
      )}

      {/* Gaze cursor overlay */}
      <GazeCursor />

      {/* Toolbar */}
      <EditorToolbar
        onRun={handleRun}
        onSave={handleSave}
        onOpen={handleOpen}
        onNewFile={handleNewFile}
        onAiComplete={handleAiComplete}
        onAiFix={handleAiFix}
        onHint={handleHintClick}
        onSettings={toggleSettings}
        fileName={fileName || getFileName()}
        isRunning={isRunning}
        isPyodideLoading={isPyodideLoading && !isLoaded()}
        gazeTarget={gazeTarget}
      />

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden p-2 gap-2">
        {/* Editor + Output + Webcam */}
        <div ref={mainSplitRef} className="flex-1 flex gap-2 min-h-[250px]">
          <div
            ref={editorContainerRef}
            className="min-w-0 relative flex-shrink-0"
            style={{ flexBasis: `${editorPanePercent}%` }}
          >
            <CodeEditor
              code={code}
              onChange={handleCodeChange}
              errorLine={output.errorLine}
              onEditDetected={() => setOutput(prev => ({ ...prev, errorLine: null }))}
              fontSize={fontSize}
              ghostText={getFixGhostText() || aiPreview}
              onGhostCommit={fixPreview ? handleAcceptFix : handleAcceptAi}
              onGhostCancel={fixPreview ? handleDismissFix : handleDismissAi}
              ghostDwellMs={3000}
              onMacroExpanded={dismissMacroTip}
            />
            {(getFixGhostText() || aiPreview || isFixLoading || aiLoading || fixError || aiError) && (
              <div className="absolute bottom-3 right-3 z-30 flex items-center gap-2 rounded-lg border border-editor-border bg-editor-surface/90 px-2.5 py-1.5 text-xs">
                {isFixLoading && <span className="text-gray-400">AI fixing error...</span>}
                {fixError && <span className="text-editor-warning">{fixError}</span>}
                {getFixGhostText() && <span className="text-yellow-300">AI fix preview</span>}
                {aiLoading && <span className="text-gray-400">AI completing...</span>}
                {aiError && <span className="text-editor-warning">{aiError}</span>}
                {aiPreview && !fixPreview && <span className="text-gray-300">AI preview</span>}
                {getFixGhostText() && (
                  <button
                    onClick={handleAcceptFix}
                    className="px-2 py-1 bg-editor-success/20 text-editor-success hover:bg-editor-success/30 rounded"
                  >
                    Accept
                  </button>
                )}
                {getFixGhostText() && (
                  <button
                    onClick={handleDismissFix}
                    className="px-2 py-1 bg-editor-border hover:bg-gray-600 rounded"
                  >
                    Dismiss
                  </button>
                )}
                {aiPreview && !fixPreview && (
                  <button
                    onClick={handleAcceptAi}
                    className="px-2 py-1 bg-editor-success/20 text-editor-success hover:bg-editor-success/30 rounded"
                  >
                    Accept
                  </button>
                )}
                {aiPreview && !fixPreview && (
                  <button
                    onClick={handleDismissAi}
                    className="px-2 py-1 bg-editor-border hover:bg-gray-600 rounded"
                  >
                    Dismiss
                  </button>
                )}
                {aiError && (
                  <button
                    onClick={handleAiComplete}
                    className="px-2 py-1 bg-editor-border hover:bg-gray-600 rounded"
                  >
                    Retry
                  </button>
                )}
              </div>
            )}
          </div>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize editor and output"
            tabIndex={0}
            onPointerDown={() => {
              isResizingRef.current = true;
            }}
            onKeyDown={handleSplitKeyDown}
            className="w-2 -mx-1 cursor-col-resize rounded bg-gray-800 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-white"
          />
          <div
            className="min-w-0 flex flex-col gap-2 flex-shrink-0"
            style={{ flexBasis: `${100 - editorPanePercent}%` }}
          >
            <OutputPanel
              stdout={output.stdout}
              stderr={output.stderr}
              error={output.error}
              isRunning={isRunning}
            />
            {/* Webcam feed — video element is appended here by GazeProvider */}
            <div id="webcam-container" className="shrink-0 rounded-lg overflow-hidden border border-editor-border bg-black relative" style={{ height: "100px" }} />
          </div>
        </div>

        {/* Bottom section: Suggestions + Keyboard */}
        {showKeyboard && (
          <div className="shrink-0">
            <SuggestionPanel
              suggestions={suggestions}
              onAccept={handleAcceptSuggestion}
              gazeTarget={gazeTarget}
              dwellTime={dwellTime}
              dwellEnabled={false}
            />
            <OnScreenKeyboard
              onKeyPress={handleKeyPress}
              onBackspace={handleBackspace}
              gazeTarget={gazeTarget}
              dwellTime={dwellTime}
              dwellEnabled={false}
              hasSuggestions={suggestions.length > 0}
            />
          </div>
        )}
      </div>

      {/* Bottom bar: keyboard toggle + eye tracking toggle */}
      <div className="fixed bottom-2 right-2 flex gap-2 z-50">
        <span className="px-3 py-1 text-xs bg-gray-800 border border-editor-border rounded text-gray-400">
          Select: <span className="text-editor-accent font-bold">{formatKeyLabel(switchKey)}</span> / Wink &nbsp; Recalibrate: <span className="text-editor-accent font-bold">{formatKeyLabel(recalibrateKey)}</span>
        </span>
        <button
          onClick={() => setShowCalibration(true)}
          className={`px-3 py-1 text-xs border rounded transition-colors ${
            isTracking
              ? "bg-editor-accent/20 border-editor-accent text-editor-accent"
              : "bg-editor-surface border-editor-border text-gray-400 hover:bg-gray-700"
          }`}
        >
          {isTracking ? "Head Tracking ON" : "Calibrate"}
        </button>
        <button
          onClick={() => setShowKeyboard(!showKeyboard)}
          className="px-3 py-1 text-xs bg-editor-surface border border-editor-border rounded hover:bg-gray-700 transition-colors"
        >
          {showKeyboard ? "Hide Keyboard" : "Show Keyboard"}
        </button>
      </div>

      {showMacroTip && (
        <div className="fixed bottom-4 left-4 z-50 max-w-sm rounded-lg border border-editor-border bg-editor-surface/95 px-4 py-3 text-sm text-gray-200 shadow-lg">
          <div className="font-semibold text-gray-100">Tip: Type fn name args then press Enter to expand.</div>
          <div className="text-gray-400 mt-1">Example: fn sum_list nums</div>
          <button
            onClick={dismissMacroTip}
            className="mt-3 px-3 py-1 text-xs bg-editor-border hover:bg-gray-700 rounded"
          >
            Got it
          </button>
        </div>
      )}

      {showHintModal && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
          onClick={() => setShowHintModal(false)}
        >
          <div
            // High-contrast surface, clear hierarchy, and semantic labels for screen readers.
            className="bg-gray-950 border-2 border-gray-200 rounded-xl p-5 w-[360px] text-sm text-gray-100 shadow-xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="macro-shortcuts-title"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="macro-shortcuts-title" className="text-base font-semibold text-white">
                  Macro Shortcuts
                </h2>
                {/* Plain-language hint reduces cognitive load and explains interaction. */}
                <p className="mt-1 text-xs text-gray-300">
                  Type a macro, press Enter to expand.
                </p>
              </div>
              <button
                onClick={() => setShowHintModal(false)}
                className="px-2 py-1 text-xs border border-gray-400 rounded hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="Close macro shortcuts"
              >
                Close
              </button>
            </div>

            {/* Definition list improves scanability and helps screen readers. */}
            <dl className="mt-4 space-y-3">
              <div className="flex items-start justify-between gap-4">
                <dt className="font-mono text-sm text-white">fn name args</dt>
                <dd className="text-xs text-gray-300">function</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-mono text-sm text-white">cls Name Base</dt>
                <dd className="text-xs text-gray-300">class</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-mono text-sm text-white">init name age</dt>
                <dd className="text-xs text-gray-300">constructor</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-mono text-sm text-white">for x y</dt>
                <dd className="text-xs text-gray-300">loop</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-mono text-sm text-white">if a gt b</dt>
                <dd className="text-xs text-gray-300">condition</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="font-mono text-sm text-white">dbg x</dt>
                <dd className="text-xs text-gray-300">debug print</dd>
              </div>
            </dl>
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-editor-surface border border-editor-border rounded-xl p-6 w-96 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white"
              >
                X
              </button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-200">Font size</div>
                <input
                  type="range"
                  min={14}
                  max={28}
                  step={1}
                  value={fontSize}
                  onChange={(event) => setFontSize(Number(event.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-gray-400">{fontSize}px</div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-200">Dwell time</div>
                <input
                  type="range"
                  min={500}
                  max={3000}
                  step={100}
                  value={dwellTime}
                  onChange={(event) => setDwellTime(Number(event.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-gray-400">{dwellTime}ms</div>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-200">Contrast</div>
                <select
                  value={contrastMode}
                  onChange={(event) => setContrastMode(event.target.value as ContrastMode)}
                  className="w-full bg-editor-surface border border-editor-border rounded px-2 py-1 text-sm"
                >
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                </select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium text-gray-200">Button mapping</div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="text-xs text-gray-400">Select</div>
                    <select
                      value={switchKey}
                      onChange={(event) => setSwitchKey(event.target.value)}
                      className="w-full bg-editor-surface border border-editor-border rounded px-2 py-1 text-sm"
                    >
                      {keyOptions.map((option) => (
                        <option key={`switch-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-gray-400">Recalibrate</div>
                    <select
                      value={recalibrateKey}
                      onChange={(event) => setRecalibrateKey(event.target.value)}
                      className="w-full bg-editor-surface border border-editor-border rounded px-2 py-1 text-sm"
                    >
                      {keyOptions.map((option) => (
                        <option key={`recalibrate-${option.value}`} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setShowSettings(false)}
              className="w-full py-2 bg-editor-accent hover:bg-blue-500 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Outer wrapper that provides GazeContext
export default function EditorPage() {
  return (
    <GazeProvider>
      <EditorInner />
    </GazeProvider>
  );
}
