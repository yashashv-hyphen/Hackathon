# AccessCode - Project Status

## What's Built & Working

### Core IDE
- **Next.js 14 scaffolding** — App Router, TypeScript, Tailwind, dark theme
- **CodeMirror 6 editor** — Python syntax highlighting, dark theme, large font, line numbers, error line highlighting
- **On-screen keyboard** — Full QWERTY with shift/symbols modes, 80px keys, gap-2, special keys (Tab, Enter, Backspace, Space), click-to-type and gaze dwell-to-type both work
- **Pyodide code execution** — Loads from CDN via manual script injection, Run button executes Python in-browser, stdout/stderr/errors captured in OutputPanel
- **File save/open** — File System Access API wrappers, Save/Open/New File buttons in toolbar, filename shown in toolbar
- **Editor page** — Full IDE layout: editor + output panel + keyboard + suggestions + toolbar
- **Landing page** — Basic page with "Start Coding" button at `/`
- **API route stubs** — `/api/gemini/complete`, `/api/gemini/correct`, `/api/gemini/rewrite` exist as placeholder endpoints

### Autocomplete
- **Trie engine** — 200+ Python keywords/builtins/modules, snippet templates (for, if, def, class, try), frequency-ranked suggestions
- **SuggestionPanel** — Shows top 5 suggestions above keyboard, gaze-highlightable via `data-key-value`
- **Cursor-aware matching** — Suggestions based on the word being typed at the cursor position (not just last line), works whether typing at beginning, middle, or end of document
- **Cursor starts at end** — On editor init, cursor placed at end of document so on-screen keyboard typing appends naturally

### Eye Tracking (WORKING)
- **WebGazer.js v3.4.0** loaded from jsDelivr CDN via manual DOM script injection
- **GazeProvider** — React context providing gaze (x, y), isTracking, gazeTarget, debug info
- **Initialization** — Each WebGazer API call is separate (no chaining), each in try/catch. `begin()` is properly awaited (returns Promise in v3). Camera requested at 1920x1080 for better face detection
- **GazeCursor** — Translucent blue dot follows gaze position, fixed overlay at z-index 9999
- **Calibration** — 13-point calibration screen with 7 clicks per point (91 training samples). 4-phase flow: camera permission → intro → calibrating → done. Points at 10/90% horizontal, 12/85% vertical. Skip button at bottom center
- **Adaptive smoothing** — Exponential moving average with velocity-dependent alpha. ALPHA_SLOW=0.06 (stable gaze), ALPHA_FAST=0.3 (saccades), SACCADE_THRESHOLD=100px
- **Magnetic snapping with hysteresis** — Cursor snaps to nearest key within 55px. Once locked on a key, requires gaze to move 60% closer to a different key before switching. Prevents oscillation between adjacent keys
- **Dwell selection** — 1200ms dwell timer on keys with visual ring animation. Gaze at a key for 1.2s to type it
- **WebGazer UI hidden** — Video feed kept at 320x240 with opacity 0.001 (ML model needs it rendered but invisible). Red prediction dots hidden. Kalman filter enabled
- **Stable callbacks** — `onComplete` for calibration uses `useCallback` to prevent RAF loop re-renders from resetting timers

### Key Technical Decisions
- **jsDelivr CDN** (not Brown University) — `cdn.jsdelivr.net/npm/webgazer@3.4.0/dist/webgazer.min.js`. Brown CDN had broken minified build causing "t is not a function" errors
- **Zero method chaining** — WebGazer v3 methods cannot be chained. Each call separate with own try/catch
- **`await begin()`** — Critical fix. `begin()` returns a Promise in v3 that MUST be awaited. Without this, gaze data never flows
- **Video must stay rendered** — Setting video to `display:none` or 1x1px breaks face detection. Use `opacity: 0.001` instead

## What's Not Built Yet
- **AI features (F5)** — API routes are stubs, GeminiPanel is a stub, needs @google/generative-ai SDK wiring with `GOOGLE_GEMINI_API_KEY`
- **Button mode (F8)** — `buttonMapper.ts` for mapping a physical key as switch-access confirmation button
- **Accessibility settings (F9)** — Component exists but settings (font size, contrast, dwell time, button mapping) not wired to editor state
- **Landing page polish (F10)** — Basic version exists, needs team credits, better design
- **Deployment** — Not yet deployed to Vercel

## Known Issues / Tuning Notes
- Eye tracking accuracy is ~70% — workable but not perfect. Systematic downward bias observed in some sessions
- Suggestions panel highlights on gaze but lacks its own dwell timer (uses `onClick` not auto-fire from dwell). Works with mouse clicks; gaze selection of suggestions needs dwell logic added
- `handleAcceptSuggestion` matches by last word on the cursor line — works correctly with cursor-aware prefix detection

## Files Summary

| File | Purpose |
|------|---------|
| `src/components/EyeTracker/GazeProvider.tsx` | WebGazer init, gaze context, RAF tick loop |
| `src/components/EyeTracker/GazeCursor.tsx` | Blue dot overlay following gaze |
| `src/components/Calibration/CalibrationScreen.tsx` | 13-point calibration flow |
| `src/lib/gazeUtils.ts` | Adaptive smoothing, magnetic snapping, hit detection |
| `src/components/Keyboard/OnScreenKeyboard.tsx` | QWERTY keyboard with 3 modes |
| `src/components/Keyboard/Key.tsx` | Individual key with dwell ring animation |
| `src/components/Autocomplete/SuggestionPanel.tsx` | Top-5 suggestion bar |
| `src/components/Autocomplete/TrieEngine.ts` | Trie + frequency search |
| `src/components/Editor/CodeEditor.tsx` | CodeMirror 6 wrapper, insertAtCursor, cursor-aware onChange |
| `src/components/Editor/EditorToolbar.tsx` | Run, save, open, AI buttons |
| `src/components/Editor/OutputPanel.tsx` | Pyodide execution output |
| `src/lib/pyodideRunner.ts` | Pyodide WebAssembly loader + runner |
| `src/lib/fileSystem.ts` | File System Access API wrappers |
| `src/app/editor/page.tsx` | Main IDE page, GazeProvider wrapper |
| `src/app/page.tsx` | Landing page |
