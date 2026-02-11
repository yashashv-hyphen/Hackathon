"use client";

import { saveFile, openFile, saveFileAs, isFileSystemAccessSupported } from "@/lib/fileSystem";

interface FileActionsProps {
  code: string;
  onFileOpened: (content: string, name: string) => void;
  onFileSaved: (name: string) => void;
}

export default function FileActions({ code, onFileOpened, onFileSaved }: FileActionsProps) {
  if (!isFileSystemAccessSupported()) {
    return <span className="text-xs text-gray-500">File System API not supported</span>;
  }

  const handleSave = async () => {
    const name = await saveFile(code);
    if (name) onFileSaved(name);
  };

  const handleSaveAs = async () => {
    const name = await saveFileAs(code);
    if (name) onFileSaved(name);
  };

  const handleOpen = async () => {
    const result = await openFile();
    if (result) onFileOpened(result.content, result.name);
  };

  return (
    <div className="flex gap-1">
      <button onClick={handleOpen} className="px-2 py-1 text-xs bg-editor-border hover:bg-gray-600 rounded">
        Open
      </button>
      <button onClick={handleSave} className="px-2 py-1 text-xs bg-editor-border hover:bg-gray-600 rounded">
        Save
      </button>
      <button onClick={handleSaveAs} className="px-2 py-1 text-xs bg-editor-border hover:bg-gray-600 rounded">
        Save As
      </button>
    </div>
  );
}
