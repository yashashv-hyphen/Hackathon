"use client";

interface AccessibilitySettingsProps {
  fontSize: number;
  onFontSizeChange: (size: number) => void;
  dwellTime: number;
  onDwellTimeChange: (ms: number) => void;
  highContrast: boolean;
  onHighContrastChange: (enabled: boolean) => void;
  onClose: () => void;
}

export default function AccessibilitySettings({
  fontSize,
  onFontSizeChange,
  dwellTime,
  onDwellTimeChange,
  highContrast,
  onHighContrastChange,
  onClose,
}: AccessibilitySettingsProps) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-editor-surface border border-editor-border rounded-xl p-6 w-[420px] space-y-5">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-bold">Accessibility Settings</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">
            X
          </button>
        </div>

        {/* Font Size */}
        <div className="space-y-2">
          <label className="text-sm text-gray-300">Font Size: {fontSize}px</label>
          <input
            type="range"
            min={14}
            max={32}
            value={fontSize}
            onChange={(e) => onFontSizeChange(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* Dwell Time */}
        <div className="space-y-2">
          <label className="text-sm text-gray-300">Dwell Time: {dwellTime}ms</label>
          <input
            type="range"
            min={400}
            max={1500}
            step={100}
            value={dwellTime}
            onChange={(e) => onDwellTimeChange(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {/* High Contrast */}
        <div className="flex items-center justify-between">
          <label className="text-sm text-gray-300">High Contrast</label>
          <button
            onClick={() => onHighContrastChange(!highContrast)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-colors ${
              highContrast
                ? "bg-editor-accent text-white"
                : "bg-editor-border text-gray-400"
            }`}
          >
            {highContrast ? "ON" : "OFF"}
          </button>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 bg-editor-accent hover:bg-blue-500 rounded-lg transition-colors mt-4"
        >
          Done
        </button>
      </div>
    </div>
  );
}
