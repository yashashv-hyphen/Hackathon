# AccessCode - Project Specification

## Problem

People with severe motor impairments (ALS, quadriplegia, cerebral palsy) cannot use a standard keyboard or mouse. Existing IDEs are completely inaccessible to them. There is no good way for these users to write code independently.

## Solution

A web-based Python IDE that replaces keyboard/mouse input with eye tracking and single-button (switch access) input, augmented by aggressive AI autocomplete to minimize the number of inputs needed.

---

## Feature List

### F1: Code Editor
- CodeMirror 6 with Python syntax highlighting
- Large default font (18px+), configurable
- High contrast dark theme
- Line numbers and current-line highlight
- Error line highlighting (red underline)
- Read-only output panel below editor for execution results

### F2: On-Screen Keyboard
- Full QWERTY layout with large keys (~70px)
- Special keys: Tab, Enter, Backspace, Space, Shift
- Symbol keys: `( ) [ ] { } : ; = + - * / . , " ' # _ @`
- Two input modes (toggle via settings):
  - **Gaze + Dwell**: Look at a key for ~800ms to auto-select. Visual ring animation shows dwell progress.
  - **Gaze + Button**: Look at a key to highlight it, press a mapped physical button to confirm selection.
- Visual feedback: key background fills as dwell timer progresses
- "Smart row" at the top showing autocomplete suggestions (gaze-selectable)

### F3: Eye Tracking
- WebGazer.js webcam-based gaze detection
- 9-point calibration screen on first use
- Calibration data persisted in localStorage
- GazeCursor: translucent colored dot overlay showing current gaze position
- Gaze-to-element hit detection (maps x,y to DOM elements under gaze)
- Smoothing via moving average to reduce jitter

### F4: Local Autocomplete (Trie + Heap)
- Trie data structure storing Python keywords and standard library functions
- Dictionary includes:
  - Keywords: `if, else, elif, for, while, def, class, return, import, from, try, except, finally, with, as, yield, lambda, pass, break, continue, raise, global, nonlocal, assert, del, in, not, and, or, is, True, False, None`
  - Built-in functions: `print, len, range, int, str, float, list, dict, set, tuple, type, isinstance, input, open, sorted, reversed, enumerate, zip, map, filter, sum, min, max, abs, round, any, all, hasattr, getattr, setattr, super, property, staticmethod, classmethod`
  - Common modules: `os, sys, math, random, json, re, datetime, collections, itertools, functools, pathlib, typing`
  - Common patterns: `if __name__ == "__main__":`, `def __init__(self):`, `for i in range():`, `try: ... except Exception as e:`
- Heap-based ranking: most frequently used suggestions appear first
- Top 5 suggestions displayed in the smart row above the keyboard
- Snippet expansion: selecting a snippet template inserts full code with cursor placement

### F5: AI Features (Gemini API)
- **Smart Complete**: User types a comment or partial line, presses a "sparkle" button (or gazes at it). Gemini suggests the next 1-5 lines of code. User can accept or dismiss.
- **Error Correct**: User runs code and gets an error. "Fix with AI" button sends the code + error to Gemini. Returns corrected code with a diff view (before/after).
- **Block Rewrite**: User selects a code block and triggers "Rewrite with AI". Can describe the desired change via text or voice. Gemini rewrites the block. Shows before/after comparison.
- All API calls routed through Next.js API routes (API key never exposed to client).

### F6: Code Execution (Pyodide)
- Pyodide (CPython compiled to WebAssembly) runs Python code entirely in the browser
- No server-side execution, no external APIs
- Output displayed in a panel below the editor
- Supports standard library modules available in Pyodide
- Error messages displayed with line numbers
- Execution triggered via "Run" button (gaze-accessible)

### F7: File Management
- **Save**: File System Access API opens a native "Save As" dialog. Saves current editor content as a `.py` file to the user's computer.
- **Open**: File System Access API opens a native "Open" dialog. User picks a `.py` file, contents load into the editor.
- **New File**: Clears the editor with confirmation if unsaved changes exist.
- Filename displayed in the toolbar

### F8: Switch Access (Button Mapping)
- Any physical key can be designated as "the button" (default: Space)
- In button mode, gaze highlights UI elements, button press activates them
- Settings panel to change the mapped key
- Visual indicator in toolbar showing current mapped key
- This simulates real assistive devices (head switches, sip-and-puff, foot pedals)

### F9: Accessibility Settings Panel
- Font size slider (14px - 32px)
- High contrast toggle
- Dwell time adjustment (400ms - 1500ms)
- Gaze cursor size and color
- Button mapping configuration
- Keyboard layout size (compact / standard / large)

### F10: Landing Page
- Project name and description
- Brief explanation of the problem being solved
- "Start Coding" button that navigates to calibration → editor
- Team credits

---

## Data Flow

```
Eyes → WebGazer.js → Gaze (x,y) → GazeProvider (React Context)
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    ↓                     ↓                     ↓
          On-Screen Keyboard      Suggestion Panel        Editor Toolbar
          (hover → dwell/click)   (hover → accept)       (hover → click)
                    ↓                     ↓                     ↓
              Keystroke               Insert suggestion    Trigger action
                    └─────────────────────┼─────────────────────┘
                                          ↓
                                    CodeMirror Editor
                                          │
                         ┌────────────────┼────────────────┐
                         ↓                ↓                ↓
                   Trie Search      Gemini API         Pyodide
                   (instant)       (AI features)    (run code)
```

---

## Team Assignments (5 people)

| Person | Owns | Features |
|--------|------|----------|
| 1 | App Shell + Editor | Next.js setup, CodeMirror, EditorToolbar, Pyodide integration, Vercel deployment |
| 2 | On-Screen Keyboard | Keyboard layout, Key component, dwell-time logic, button mode, keyboard → editor connection |
| 3 | Eye Tracking | WebGazer.js, CalibrationScreen, GazeProvider, GazeCursor, gaze hit-testing |
| 4 | Autocomplete Engine | Trie implementation, Python dictionary, snippets, SuggestionPanel, heap ranking |
| 5 | AI + File + Polish | Gemini API routes, GeminiPanel, FileActions (save/open), AccessibilitySettings, landing page |

---

## Non-Goals (Out of Scope)
- C++ or Java support
- Server-side code execution
- User accounts or cloud storage
- Mobile support
- Multi-file projects
- Collaborative editing
