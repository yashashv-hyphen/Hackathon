"use client";

import { useEffect, useRef, useCallback } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, type KeyBinding, WidgetType } from "@codemirror/view";
import { EditorState, StateEffect, StateField } from "@codemirror/state";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { bracketMatching, foldGutter } from "@codemirror/language";
import { Decoration, type DecorationSet, ViewPlugin, type ViewUpdate } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { expandSemanticMacroLine } from "@/components/AI/GeminiPanel";

interface CodeEditorProps {
  code: string;
  onChange: (code: string, cursorPos: number) => void;
  errorLine?: number | null;
  onEditDetected?: () => void;
  fontSize?: number;
  ghostText?: string | null;
  onGhostCommit?: () => void;
  onGhostCancel?: () => void;
  ghostDwellMs?: number;
  onMacroExpanded?: () => void;
}

const errorLineDeco = Decoration.line({ class: "cm-error-line" });

const setGhostTextEffect = StateEffect.define<string | null>();
const setHidingGhostTextEffect = StateEffect.define<string | null>();

class GhostTextWidget extends WidgetType {
  static onCommit?: () => void;
  static onCancel?: () => void;
  static dwellMs = 3000;
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private leaveTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(private text: string, private isHiding: boolean = false) {
    super();
  }
  toDOM() {
    const container = document.createElement("span");
    container.style.display = "inline-block";
    container.style.padding = "2px 6px";
    container.style.borderRadius = "6px";
    container.style.border = "1px solid rgba(156, 163, 175, 0.35)";
    container.style.background = "rgba(156, 163, 175, 0.08)";

    const span = document.createElement("span");
    span.className = "cm-ghost-text";
    if (this.isHiding) {
      span.classList.add("cm-ghost-text--hiding");
    }
    span.style.opacity = "0.7";
    span.style.whiteSpace = "pre";
    span.style.color = "#9ca3af";
    span.style.backgroundImage = "linear-gradient(currentColor, currentColor)";
    span.style.backgroundRepeat = "no-repeat";
    span.style.backgroundPosition = "0 100%";
    span.style.backgroundSize = "0% 2px";
    span.style.transition = `background-size ${GhostTextWidget.dwellMs}ms linear`;
    span.textContent = this.text;
    container.appendChild(span);

    const cancel = () => {
      if (this.leaveTimeoutId) {
        clearTimeout(this.leaveTimeoutId);
        this.leaveTimeoutId = null;
      }
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
        this.timeoutId = null;
      }
      span.style.backgroundSize = "0% 2px";
      GhostTextWidget.onCancel?.();
    };

    const scheduleCancel = () => {
      if (this.leaveTimeoutId) clearTimeout(this.leaveTimeoutId);
      this.leaveTimeoutId = setTimeout(() => {
        this.leaveTimeoutId = null;
        cancel();
      }, 120);
    };

    container.addEventListener("mouseenter", () => {
      if (this.leaveTimeoutId) {
        clearTimeout(this.leaveTimeoutId);
        this.leaveTimeoutId = null;
      }
      if (this.timeoutId) clearTimeout(this.timeoutId);
      span.style.backgroundSize = "100% 2px";
      this.timeoutId = setTimeout(() => {
        this.timeoutId = null;
        GhostTextWidget.onCommit?.();
      }, GhostTextWidget.dwellMs);
    });

    container.addEventListener("mouseleave", () => {
      scheduleCancel();
    });

    return container;
  }

  destroy() {
    if (this.leaveTimeoutId) {
      clearTimeout(this.leaveTimeoutId);
      this.leaveTimeoutId = null;
    }
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }
}

const hidingGhostTextField = StateField.define<string | null>({
  create() {
    return null;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setHidingGhostTextEffect)) return effect.value;
    }
    return value;
  },
});

const ghostTextField = StateField.define<string | null>({
  create() {
    return null;
  },
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setGhostTextEffect)) return effect.value;
    }
    return value;
  },
  provide: (field) =>
    EditorView.decorations.compute([field, hidingGhostTextField], (state) => {
      const visibleValue = state.field(field);
      const hidingValue = state.field(hidingGhostTextField);
      const pos = state.selection.main.from;
      
      if (visibleValue) {
        const deco = Decoration.widget({ widget: new GhostTextWidget(visibleValue, false), side: 1 });
        return Decoration.set([deco.range(pos)]);
      }
      
      if (hidingValue) {
        const deco = Decoration.widget({ widget: new GhostTextWidget(hidingValue, true), side: 1 });
        return Decoration.set([deco.range(pos)]);
      }
      
      return Decoration.none;
    }),
});

function errorLineHighlight(errorLine: number | null) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = this.buildDecorations(view);
      }
      update(update: ViewUpdate) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = this.buildDecorations(update.view);
        }
      }
      buildDecorations(view: EditorView): DecorationSet {
        const builder = new RangeSetBuilder<Decoration>();
        if (errorLine !== null && errorLine > 0) {
          const line = Math.min(errorLine, view.state.doc.lines);
          const lineObj = view.state.doc.line(line);
          builder.add(lineObj.from, lineObj.from, errorLineDeco);
        }
        return builder.finish();
      }
    },
    { decorations: (v) => v.decorations }
  );
}

export default function CodeEditor({
  code,
  onChange,
  errorLine = null,
  onEditDetected,
  fontSize = 18,
  ghostText = null,
  onGhostCommit,
  onGhostCancel,
  ghostDwellMs = 3000,
  onMacroExpanded,
}: CodeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const ghostTextRef = useRef<string | null>(ghostText);
  const onMacroExpandedRef = useRef(onMacroExpanded);
  const onEditDetectedRef = useRef(onEditDetected);
  const ghostHidingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  onMacroExpandedRef.current = onMacroExpanded;

  const initEditor = useCallback(() => {
    if (!editorRef.current) return;

    // Clean up previous instance
    if (viewRef.current) {
      viewRef.current.destroy();
    }

    const macroKeymap: KeyBinding = {
      key: "Enter",
      run() {
        return expandMacroIfMatch();
      },
    };

    const state = EditorState.create({
      doc: code,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        foldGutter(),
        python(),
        oneDark,
        keymap.of([macroKeymap, ...defaultKeymap, ...historyKeymap]),
        ghostTextField,
        hidingGhostTextField,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current(
              update.state.doc.toString(),
              update.state.selection.main.head
            );
            onEditDetectedRef.current?.();
          }
          if (
            ghostTextRef.current &&
            (update.docChanged || update.selectionSet || update.viewportChanged)
          ) {
            GhostTextWidget.onCancel?.();
          }
        }),
        EditorView.theme({
          "&": { fontSize: `${fontSize}px` },
          ".cm-content": { padding: "10px 0" },
          ".cm-line": { padding: "0 16px" },
        }),
        errorLineHighlight(errorLine),
      ],
    });

    const view = new EditorView({
      state,
      parent: editorRef.current,
    });

    // Place cursor at end so on-screen keyboard typing starts at the bottom
    view.dispatch({ selection: { anchor: state.doc.length } });

    viewRef.current = view;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontSize, errorLine]);

  useEffect(() => {
    initEditor();
    return () => {
      viewRef.current?.destroy();
    };
  }, [initEditor]);

  // Scroll to error line when it is set
  useEffect(() => {
    const view = viewRef.current;
    if (!view || errorLine === null || errorLine <= 0) return;
    const line = Math.min(errorLine, view.state.doc.lines);
    const lineObj = view.state.doc.line(line);
    view.dispatch({ effects: EditorView.scrollIntoView(lineObj.from, { y: "center" }) });
  }, [errorLine]);

  // Update code from outside (e.g., file open, AI suggestion)
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentCode = view.state.doc.toString();
    if (currentCode !== code) {
      view.dispatch({
        changes: { from: 0, to: currentCode.length, insert: code },
      });
    }
  }, [code]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // Clear any pending hiding animation
    if (ghostHidingTimeoutRef.current) {
      clearTimeout(ghostHidingTimeoutRef.current);
      ghostHidingTimeoutRef.current = null;
    }

    if (ghostText) {
      // Show new ghost text, clear any hiding state
      view.dispatch({
        effects: [
          setGhostTextEffect.of(ghostText),
          setHidingGhostTextEffect.of(null),
        ],
      });
    } else {
      // Transition to hiding state for animation
      const currentVisibleText = view.state.field(ghostTextField);
      if (currentVisibleText) {
        // Move text to hiding field to animate fade-out
        view.dispatch({
          effects: [
            setGhostTextEffect.of(null),
            setHidingGhostTextEffect.of(currentVisibleText),
          ],
        });

        // After animation completes, fully remove
        ghostHidingTimeoutRef.current = setTimeout(() => {
          const currentView = viewRef.current;
          if (currentView) {
            currentView.dispatch({
              effects: setHidingGhostTextEffect.of(null),
            });
          }
          ghostHidingTimeoutRef.current = null;
        }, 140); // Match CSS animation duration slightly under
      }
    }
  }, [ghostText]);

  // Cleanup hiding animation timer on unmount
  useEffect(() => {
    return () => {
      if (ghostHidingTimeoutRef.current) {
        clearTimeout(ghostHidingTimeoutRef.current);
        ghostHidingTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    onEditDetectedRef.current = onEditDetected;
  }, [onEditDetected]);

  useEffect(() => {
    ghostTextRef.current = ghostText ?? null;
  }, [ghostText]);

  useEffect(() => {
    GhostTextWidget.onCommit = onGhostCommit;
    GhostTextWidget.onCancel = onGhostCancel;
    GhostTextWidget.dwellMs = ghostDwellMs;
  }, [onGhostCommit, onGhostCancel, ghostDwellMs]);

  // Shared macro expansion function (used by both physical Enter and on-screen Enter)
  const expandMacroIfMatch = useCallback(() => {
    const view = viewRef.current;
    if (!view) return false;
    
    const selection = view.state.selection.main;
    if (!selection.empty) return false;
    
    const line = view.state.doc.lineAt(selection.from);
    const expansion = expandSemanticMacroLine(line.text);
    if (!expansion) return false;

    const offsetFromLineCh = (text: string, lineOffset: number, ch: number) => {
      let idx = 0;
      let lineCount = 0;
      while (lineCount < lineOffset) {
        const next = text.indexOf("\n", idx);
        if (next === -1) return text.length;
        idx = next + 1;
        lineCount += 1;
      }
      return Math.min(idx + ch, text.length);
    };

    const cursorOffset = offsetFromLineCh(
      expansion.expanded,
      expansion.cursorLineOffset,
      expansion.cursorCh
    );

    view.dispatch({
      changes: { from: line.from, to: line.to, insert: expansion.expanded },
      selection: { anchor: line.from + cursorOffset },
    });
    onMacroExpandedRef.current?.();
    return true;
  }, []);

  // Method to insert text at cursor (used by keyboard, autocomplete)
  const insertAtCursor = useCallback((text: string) => {
    const view = viewRef.current;
    if (!view) return;
    const { from } = view.state.selection.main;
    view.dispatch({
      changes: { from, to: from, insert: text },
      selection: { anchor: from + text.length },
    });
    view.focus();
  }, []);

  const handleBackspace = useCallback(() => {
    const view = viewRef.current;
    if (!view) return;
    const { from, to } = view.state.selection.main;
    if (from === to && from > 0) {
      view.dispatch({
        changes: { from: from - 1, to: from },
        selection: { anchor: from - 1 },
      });
    } else if (from !== to) {
      view.dispatch({
        changes: { from, to },
        selection: { anchor: from },
      });
    }
    view.focus();
  }, []);

  const getCursorInfo = useCallback(() => {
    const view = viewRef.current;
    if (!view) return null;
    const pos = view.state.selection.main.from;
    const line = view.state.doc.lineAt(pos);
    const indentMatch = line.text.match(/^\s*/);
    return {
      pos,
      ch: pos - line.from,
      lineFrom: line.from,
      lineTo: line.to,
      lineText: line.text,
      lineIndent: indentMatch ? indentMatch[0] : "",
    };
  }, []);

  const replaceCurrentLine = useCallback((text: string) => {
    const view = viewRef.current;
    if (!view) return;
    const pos = view.state.selection.main.from;
    const line = view.state.doc.lineAt(pos);
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: text },
      selection: { anchor: line.from + text.length },
    });
    view.focus();
  }, []);

  const scrollToLine = useCallback((lineNumber: number) => {
    const view = viewRef.current;
    if (!view || lineNumber <= 0) return;
    const line = Math.min(lineNumber, view.state.doc.lines);
    const lineObj = view.state.doc.line(line);
    view.dispatch({ effects: EditorView.scrollIntoView(lineObj.from, { y: "center" }) });
  }, []);

  // Expose methods via ref on the container element
  useEffect(() => {
    if (editorRef.current) {
      (editorRef.current as HTMLDivElement & { insertAtCursor?: (text: string) => void; handleBackspace?: () => void }).insertAtCursor = insertAtCursor;
      (editorRef.current as HTMLDivElement & { handleBackspace?: () => void }).handleBackspace = handleBackspace;
      (editorRef.current as HTMLDivElement & { getCursorInfo?: () => { pos: number; ch: number; lineFrom: number; lineTo: number; lineText: string; lineIndent: string } | null }).getCursorInfo = getCursorInfo;
      (editorRef.current as HTMLDivElement & { replaceCurrentLine?: (text: string) => void }).replaceCurrentLine = replaceCurrentLine;
      (editorRef.current as HTMLDivElement & { scrollToLine?: (lineNumber: number) => void }).scrollToLine = scrollToLine;
      (editorRef.current as HTMLDivElement & { expandMacroIfMatch?: () => boolean }).expandMacroIfMatch = expandMacroIfMatch;
    }
  }, [insertAtCursor, handleBackspace, getCursorInfo, replaceCurrentLine, scrollToLine, expandMacroIfMatch]);

  return (
    <div
      ref={editorRef}
      className="h-full w-full overflow-hidden rounded-lg border border-editor-border bg-editor-bg"
    />
  );
}
