"use client";

import { useState } from "react";

export type MacroExpansion = {
  expanded: string;
  cursorLineOffset: number;
  cursorCh: number;
};

export type CorrectResponse = {
  kind: "correct";
  confidence: number;
  title: string;
  explanation: string[];
  edits: Array<{
    startLine: number;
    endLine: number;
    insert: string;
  }>;
};

const INDENT_UNIT = "    ";

function toFieldName(token: string) {
  const match = token.trim().match(/^[A-Za-z_]\w*/);
  return match ? match[0] : "";
}

export function expandSemanticMacroLine(line: string): MacroExpansion | null {
  const match = line.match(/^(\s*)(.*)$/);
  if (!match) return null;
  const indent = match[1] ?? "";
  const trimmed = (match[2] ?? "").trim();

  const tokens = trimmed.split(/\s+/).filter(Boolean);

  const joinArgs = (args: string[]) => args.join(", ");

  const mapOperator = (op: string) => {
    switch (op) {
      case "gt":
        return ">";
      case "lt":
        return "<";
      case "ge":
        return ">=";
      case "le":
        return "<=";
      case "eq":
        return "==";
      case "ne":
        return "!=";
      case "and":
        return "and";
      case "or":
        return "or";
      case "not":
        return "not";
      default:
        return op;
    }
  };

  const fnMatch = trimmed.match(/^fn\s+([A-Za-z_]\w*)\s*\((.*)\)\s*$/);
  if (fnMatch) {
    const name = fnMatch[1];
    const args = fnMatch[2].trim();
    const defLine = `${indent}def ${name}(${args}):`;
    const bodyLine = `${indent}${INDENT_UNIT}pass`;
    return {
      expanded: [defLine, bodyLine].join("\n"),
      cursorLineOffset: 1,
      cursorCh: bodyLine.length,
    };
  }

  if (tokens[0] === "fn" && tokens.length >= 2) {
    const name = tokens[1];
    const args = tokens.slice(2);
    const defLine = `${indent}def ${name}(${joinArgs(args)}):`;
    const bodyLine = `${indent}${INDENT_UNIT}pass`;
    return {
      expanded: [defLine, bodyLine].join("\n"),
      cursorLineOffset: 1,
      cursorCh: bodyLine.length,
    };
  }

  const clsMatch = trimmed.match(/^cls\s+([A-Za-z_]\w*)(?:\s*\(\s*([A-Za-z_]\w*)\s*\))?\s*$/);
  if (clsMatch) {
    const name = clsMatch[1];
    const base = clsMatch[2];
    const header = base ? `${indent}class ${name}(${base}):` : `${indent}class ${name}:`;
    const bodyLine = `${indent}${INDENT_UNIT}pass`;
    return {
      expanded: [header, bodyLine].join("\n"),
      cursorLineOffset: 1,
      cursorCh: bodyLine.length,
    };
  }

  if (tokens[0] === "cls" && tokens.length >= 2) {
    const name = tokens[1];
    const base = tokens[2];
    const header = base ? `${indent}class ${name}(${base}):` : `${indent}class ${name}:`;
    const bodyLine = `${indent}${INDENT_UNIT}pass`;
    return {
      expanded: [header, bodyLine].join("\n"),
      cursorLineOffset: 1,
      cursorCh: bodyLine.length,
    };
  }

  const initMatch = trimmed.match(/^init\s*\((.*)\)\s*$/);
  if (initMatch) {
    const rawArgs = initMatch[1].trim();
    const args = rawArgs ? rawArgs.split(",").map((arg) => arg.trim()).filter(Boolean) : [];
    const defLine = `${indent}def __init__(self${args.length ? ", " + args.join(", ") : ""}):`;
    const assignments = args
      .map((arg) => toFieldName(arg))
      .filter(Boolean)
      .map((field) => `${indent}${INDENT_UNIT}self.${field} = ${field}`);
    const body = assignments.length ? assignments : [`${indent}${INDENT_UNIT}pass`];
    return {
      expanded: [defLine, ...body].join("\n"),
      cursorLineOffset: 1,
      cursorCh: body[0].length,
    };
  }

  if (tokens[0] === "init") {
    const args = tokens.slice(1);
    const defLine = `${indent}def __init__(self${args.length ? ", " + joinArgs(args) : ""}):`;
    const assignments = args
      .map((arg) => toFieldName(arg))
      .filter(Boolean)
      .map((field) => `${indent}${INDENT_UNIT}self.${field} = ${field}`);
    const body = assignments.length ? assignments : [`${indent}${INDENT_UNIT}pass`];
    return {
      expanded: [defLine, ...body].join("\n"),
      cursorLineOffset: 1,
      cursorCh: body[0].length,
    };
  }

  if (trimmed === "main") {
    const defLine = `${indent}def main():`;
    const bodyLine = `${indent}${INDENT_UNIT}pass`;
    const guardLine = `${indent}if __name__ == "__main__":`;
    const callLine = `${indent}${INDENT_UNIT}main()`;
    return {
      expanded: [defLine, bodyLine, "", guardLine, callLine].join("\n"),
      cursorLineOffset: 1,
      cursorCh: bodyLine.length,
    };
  }

  const forMatch = trimmed.match(/^for\s+(.+)\s+in\s+(.+)\s*$/);
  if (forMatch) {
    const header = `${indent}for ${forMatch[1]} in ${forMatch[2]}:`;
    const bodyLine = `${indent}${INDENT_UNIT}pass`;
    return {
      expanded: [header, bodyLine].join("\n"),
      cursorLineOffset: 1,
      cursorCh: bodyLine.length,
    };
  }

  if (tokens[0] === "for" && tokens.length >= 3) {
    const variable = tokens[1];
    const iterable = tokens.slice(2).join(" ");
    const header = `${indent}for ${variable} in ${iterable}:`;
    const bodyLine = `${indent}${INDENT_UNIT}pass`;
    return {
      expanded: [header, bodyLine].join("\n"),
      cursorLineOffset: 1,
      cursorCh: bodyLine.length,
    };
  }

  if (tokens[0] === "if" && tokens.length >= 2) {
    const condition = tokens.slice(1).map(mapOperator).join(" ");
    const header = `${indent}if ${condition}:`;
    const bodyLine = `${indent}${INDENT_UNIT}pass`;
    return {
      expanded: [header, bodyLine].join("\n"),
      cursorLineOffset: 1,
      cursorCh: bodyLine.length,
    };
  }

  const ifMatch = trimmed.match(/^if\s+(.+)\s*$/);
  if (ifMatch) {
    const header = `${indent}if ${ifMatch[1]}:`;
    const bodyLine = `${indent}${INDENT_UNIT}pass`;
    return {
      expanded: [header, bodyLine].join("\n"),
      cursorLineOffset: 1,
      cursorCh: bodyLine.length,
    };
  }

  if (trimmed === "try") {
    const tryLine = `${indent}try:`;
    const passLine = `${indent}${INDENT_UNIT}pass`;
    const exceptLine = `${indent}except Exception as e:`;
    const raiseLine = `${indent}${INDENT_UNIT}raise`;
    return {
      expanded: [tryLine, passLine, exceptLine, raiseLine].join("\n"),
      cursorLineOffset: 1,
      cursorCh: passLine.length,
    };
  }

  const withMatch = trimmed.match(/^with\s+open\s*\((.*)\)\s*$/);
  if (withMatch) {
    const header = `${indent}with open(${withMatch[1]}) as f:`;
    const bodyLine = `${indent}${INDENT_UNIT}pass`;
    return {
      expanded: [header, bodyLine].join("\n"),
      cursorLineOffset: 1,
      cursorCh: bodyLine.length,
    };
  }

  const dbgMatch = trimmed.match(/^dbg\s*\((.*)\)\s*$/);
  if (dbgMatch) {
    const content = dbgMatch[1].trim();
    const lineOut = `${indent}print(${content || "\"\""})`;
    return {
      expanded: lineOut,
      cursorLineOffset: 0,
      cursorCh: lineOut.length,
    };
  }

  if (tokens[0] === "dbg" && tokens.length >= 2) {
    const name = tokens.slice(1).join(" ");
    const lineOut = `${indent}print(f"${name} = {${name}}")`;
    return {
      expanded: lineOut,
      cursorLineOffset: 0,
      cursorCh: lineOut.length,
    };
  }

  return null;
}

interface GeminiPanelProps {
  // Autocomplete suggestions (existing)
  suggestion: string | null;
  onAccept: () => void;
  onDismiss: () => void;
  isLoading: boolean;

  // Error correction (new)
  errorTraceback?: string | null;
  code?: string;
  onFixError?: () => void;
  isFixLoading?: boolean;
  fixPreview?: CorrectResponse | null;
  onAcceptFix?: () => void;
  onDismissFix?: () => void;
  fixError?: string | null;
}

function applyEditsToCode(code: string, edits: CorrectResponse["edits"]): string {
  if (!edits.length) return code;

  const lines = code.split("\n");
  
  // Sort edits by startLine descending to apply from end to start
  const sortedEdits = [...edits].sort((a, b) => b.startLine - a.startLine);

  for (const edit of sortedEdits) {
    const lineIdx = edit.startLine - 1; // Convert 1-indexed to 0-indexed
    const endIdx = edit.endLine - 1;

    if (lineIdx < 0 || lineIdx >= lines.length) continue;
    if (endIdx < lineIdx || endIdx >= lines.length) continue;

    // Replace lines [lineIdx, endIdx] with insert text
    const newLines = edit.insert.split("\n");
    lines.splice(lineIdx, endIdx - lineIdx + 1, ...newLines);
  }

  return lines.join("\n");
}

function renderDiffPreview(
  original: string,
  edits: CorrectResponse["edits"]
): string {
  if (!edits.length) return "No changes";

  const lines = original.split("\n");
  let preview = "";

  for (const edit of edits) {
    const lineIdx = edit.startLine - 1;
    const endIdx = edit.endLine - 1;

    if (lineIdx < 0 || lineIdx >= lines.length) continue;

    preview += `Lines ${edit.startLine}–${edit.endLine}:\n`;
    preview += "─ Removed:\n";
    for (let i = lineIdx; i <= endIdx && i < lines.length; i++) {
      preview += `  ${lines[i]}\n`;
    }
    preview += "─ Added:\n";
    for (const newLine of edit.insert.split("\n")) {
      preview += `  ${newLine}\n`;
    }
    preview += "\n";
  }

  return preview;
}

export default function GeminiPanel({
  suggestion,
  onAccept,
  onDismiss,
  isLoading,
  errorTraceback,
  code = "",
  onFixError,
  isFixLoading = false,
  fixPreview,
  onAcceptFix,
  onDismissFix,
  fixError,
}: GeminiPanelProps) {
  const [showFixDetails, setShowFixDetails] = useState(false);

  // Show nothing if no suggestions or fix previews
  if (!suggestion && !isLoading && !errorTraceback && !fixPreview && !isFixLoading && !fixError) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Error Fix Section */}
      {(errorTraceback || fixPreview || isFixLoading || fixError) && (
        <div className="border border-orange-500/30 bg-orange-500/5 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-orange-400 font-semibold text-sm">AI Error Fix</span>
              {isFixLoading && (
                <span className="text-xs text-gray-400 animate-pulse">Analyzing error...</span>
              )}
            </div>
            {fixError && (
              <span className="text-xs text-editor-error">{fixError}</span>
            )}
          </div>

          {!fixPreview && !isFixLoading && errorTraceback && onFixError && (
            <button
              onClick={onFixError}
              disabled={isFixLoading}
              className="w-full px-4 py-2 text-sm bg-orange-600/30 text-orange-300 hover:bg-orange-600/40 disabled:opacity-50 rounded transition-colors"
            >
              🔧 Fix Error
            </button>
          )}

          {fixPreview && (
            <>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="font-semibold text-orange-300">{fixPreview.title}</span>
                  <span className="ml-3 text-xs text-gray-400">
                    Confidence: {(fixPreview.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                {fixPreview.explanation.length > 0 && (
                  <div className="text-gray-300">
                    {fixPreview.explanation.map((line, idx) => (
                      <div key={idx}>• {line}</div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowFixDetails(!showFixDetails)}
                className="text-xs text-gray-400 hover:text-gray-300 underline"
              >
                {showFixDetails ? "Hide" : "Show"} code diff
              </button>

              {showFixDetails && (
                <pre className="text-xs font-mono text-gray-300 bg-gray-900/50 rounded p-2 overflow-x-auto whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {renderDiffPreview(code, fixPreview.edits)}
                </pre>
              )}

              <div className="flex gap-2">
                <button
                  onClick={onAcceptFix}
                  className="flex-1 px-4 py-2 text-sm bg-editor-success/20 text-editor-success hover:bg-editor-success/30 rounded transition-colors font-semibold"
                >
                  ✓ Accept
                </button>
                <button
                  onClick={onDismissFix}
                  className="flex-1 px-4 py-2 text-sm bg-editor-border hover:bg-gray-600 rounded transition-colors"
                >
                  ✕ Reject
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Autocomplete Suggestion Section (existing) */}
      {(suggestion || isLoading) && (
        <div className="border border-purple-500/30 bg-purple-500/10 rounded-lg p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-purple-400 font-semibold text-sm">AI Suggestion</span>
            {isLoading && (
              <span className="text-xs text-gray-400 animate-pulse">Thinking...</span>
            )}
          </div>
          {suggestion && (
            <>
              <pre className="text-sm font-mono text-gray-200 bg-gray-900/50 rounded p-3 overflow-x-auto whitespace-pre-wrap">
                {suggestion}
              </pre>
              <div className="flex gap-2">
                <button
                  onClick={onAccept}
                  className="px-4 py-1.5 text-sm bg-editor-success/20 text-editor-success hover:bg-editor-success/30 rounded transition-colors"
                >
                  Accept
                </button>
                <button
                  onClick={onDismiss}
                  className="px-4 py-1.5 text-sm bg-editor-border hover:bg-gray-600 rounded transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
