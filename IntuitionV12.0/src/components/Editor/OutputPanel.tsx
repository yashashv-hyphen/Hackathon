"use client";

interface OutputPanelProps {
  stdout: string;
  stderr: string;
  error: string | null;
  isRunning: boolean;
}

export default function OutputPanel({
  stdout,
  stderr,
  error,
  isRunning,
}: OutputPanelProps) {
  return (
    <div className="flex flex-col h-full bg-editor-bg border border-editor-border rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-editor-surface border-b border-editor-border">
        <span className="text-sm font-semibold text-gray-300">Output</span>
        {isRunning && (
          <span className="text-xs text-editor-warning animate-pulse">
            Running...
          </span>
        )}
      </div>
      <div className="flex-1 overflow-auto p-4 font-mono text-sm">
        {stdout && (
          <pre className="text-gray-200 whitespace-pre-wrap">{stdout}</pre>
        )}
        {stderr && (
          <pre className="text-editor-warning whitespace-pre-wrap mt-2">
            {stderr}
          </pre>
        )}
        {error && (
          <pre className="text-editor-error whitespace-pre-wrap mt-2">
            {error}
          </pre>
        )}
        {!stdout && !stderr && !error && !isRunning && (
          <span className="text-gray-500 italic">
            Click &quot;Run&quot; to execute your Python code
          </span>
        )}
      </div>
    </div>
  );
}
