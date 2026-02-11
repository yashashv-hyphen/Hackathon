"use client";

interface EditorToolbarProps {
  onRun: () => void;
  onSave: () => void;
  onOpen: () => void;
  onNewFile: () => void;
  onAiComplete: () => void;
  onAiFix: () => void;
  onHint: () => void;
  onSettings: () => void;
  fileName: string | null;
  isRunning: boolean;
  isPyodideLoading: boolean;
  gazeTarget: string | null;
}

export default function EditorToolbar({
  onRun,
  onSave,
  onOpen,
  onNewFile,
  onAiComplete,
  onAiFix,
  onHint,
  onSettings,
  fileName,
  isRunning,
  isPyodideLoading,
  gazeTarget,
}: EditorToolbarProps) {
  const highlight = (id: string) =>
    gazeTarget === id
      ? "ring-2 ring-editor-accent bg-gray-600"
      : "";

  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-editor-surface border-b border-editor-border">
      {/* File controls */}
      <button
        data-key-value="toolbar-new"
        onClick={onNewFile}
        className={`px-3 py-1.5 text-sm bg-editor-border hover:bg-gray-600 rounded transition-colors ${highlight("toolbar-new")}`}
        title="New File"
      >
        New
      </button>
      <button
        data-key-value="toolbar-open"
        onClick={onOpen}
        className={`px-3 py-1.5 text-sm bg-editor-border hover:bg-gray-600 rounded transition-colors ${highlight("toolbar-open")}`}
        title="Open File"
      >
        Open
      </button>
      <button
        data-key-value="toolbar-save"
        onClick={onSave}
        className={`px-3 py-1.5 text-sm bg-editor-border hover:bg-gray-600 rounded transition-colors ${highlight("toolbar-save")}`}
        title="Save File"
      >
        Save
      </button>

      <div className="w-px h-6 bg-editor-border mx-1" />

      {/* Run button */}
      <button
        data-key-value="toolbar-run"
        onClick={onRun}
        disabled={isRunning || isPyodideLoading}
        className={`px-4 py-1.5 text-sm bg-editor-success/20 text-editor-success hover:bg-editor-success/30 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold ${highlight("toolbar-run")}`}
        title="Run Code (Ctrl+Enter)"
      >
        {isPyodideLoading ? "Loading..." : isRunning ? "Running..." : "▶ Run"}
      </button>

      <div className="w-px h-6 bg-editor-border mx-1" />

      {/* AI buttons */}
      <button
        data-key-value="toolbar-complete"
        onClick={onAiComplete}
        className={`px-3 py-1.5 text-sm bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 rounded transition-colors ${highlight("toolbar-complete")}`}
        title="AI Autocomplete"
      >
        ✦ Complete
      </button>
      <button
        data-key-value="toolbar-fix"
        onClick={onAiFix}
        className={`px-3 py-1.5 text-sm bg-orange-500/20 text-orange-300 hover:bg-orange-500/30 rounded transition-colors ${highlight("toolbar-fix")}`}
        title="AI Fix Error"
      >
        Fix Error
      </button>

      <button
        onClick={onHint}
        className="px-3 py-1.5 text-sm bg-editor-border hover:bg-gray-600 rounded transition-colors"
        title="Macro shortcuts"
      >
        💡 Hint
      </button>

      <div className="flex-1" />

      {/* File name */}
      {fileName && (
        <span className="text-sm text-gray-400 mr-2">{fileName}</span>
      )}

      {/* Settings */}
      <button
        data-key-value="toolbar-settings"
        onClick={onSettings}
        className={`px-3 py-1.5 text-sm bg-editor-border hover:bg-gray-600 rounded transition-colors ${highlight("toolbar-settings")}`}
        title="Settings"
      >
        Settings
      </button>
    </div>
  );
}
