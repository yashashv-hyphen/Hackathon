# AccessCode - AI-Powered Accessible Web IDE

An eye-tracking-enabled Python IDE for people with motor impairments. Uses gaze input, switch access (single-button), and AI-powered autocomplete to enable coding with minimal physical input.

## Tech Stack

- **Framework**: Next.js 14 (App Router) + TypeScript
- **Editor**: CodeMirror 6
- **Eye Tracking**: WebGazer.js
- **Code Execution**: Pyodide (CPython in WebAssembly, runs in browser)
- **Local Autocomplete**: Trie data structure + frequency-ranked heap
- **AI Features**: Google Gemini API (free tier, server-side via API routes)
- **File I/O**: File System Access API (native save/open dialogs in Chrome)
- **Styling**: Tailwind CSS
- **Deployment**: Vercel

## Project Structure

```
src/
  app/
    layout.tsx                    # Root layout, global providers
    page.tsx                      # Landing page + project intro
    editor/
      page.tsx                    # Main IDE page
    api/
      gemini/
        complete/route.ts         # AI code completion endpoint
        correct/route.ts          # AI error correction endpoint
        rewrite/route.ts          # AI block rewrite endpoint

  components/
    Calibration/
      CalibrationScreen.tsx       # 9-point eye tracking calibration
    Editor/
      CodeEditor.tsx              # CodeMirror 6 wrapper
      EditorToolbar.tsx           # Run, save, open, settings buttons
      OutputPanel.tsx             # Pyodide execution output display
    Keyboard/
      OnScreenKeyboard.tsx        # Full QWERTY gaze-compatible keyboard
      Key.tsx                     # Single key with dwell-time ring animation
    Autocomplete/
      SuggestionPanel.tsx         # Top-5 suggestions bar above keyboard
      TrieEngine.ts               # Trie + heap-based search
    EyeTracker/
      GazeProvider.tsx            # React context providing gaze (x,y)
      GazeCursor.tsx              # Translucent dot following gaze
    AI/
      GeminiPanel.tsx             # AI suggestion/diff/rewrite UI
    FileManager/
      FileActions.tsx             # Save/Open buttons using File System Access API
    Settings/
      AccessibilitySettings.tsx   # Font size, contrast, dwell time, button mapping

  lib/
    trie.ts                       # Trie data structure implementation
    dictionaries/
      python.ts                   # Python keywords + stdlib (~200 entries)
      snippets.ts                 # Common Python code templates
    gazeUtils.ts                  # Map gaze (x,y) to DOM elements
    buttonMapper.ts               # Map any physical key as switch-access button
    pyodideRunner.ts              # Pyodide initialization + code execution
    fileSystem.ts                 # File System Access API wrappers (save/open)
```

## Key Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run lint         # Lint
npx vercel           # Deploy to Vercel
```

## Environment Variables

```
GOOGLE_GEMINI_API_KEY=   # Gemini API key (server-side only, set in Vercel dashboard)
```

## Browser Target

Chrome only (required for WebGazer.js + File System Access API).
