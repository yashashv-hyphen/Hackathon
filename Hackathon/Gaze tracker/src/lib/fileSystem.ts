"use client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fileHandle: any = null;

export function getFileHandle() {
  return fileHandle;
}

export function getFileName(): string | null {
  return fileHandle?.name || null;
}

export function clearFileHandle(): void {
  fileHandle = null;
}

export async function saveFile(content: string): Promise<string | null> {
  try {
    if (fileHandle) {
      // Save to existing file
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();
      return fileHandle.name;
    } else {
      return await saveFileAs(content);
    }
  } catch (err) {
    if ((err as Error).name === "AbortError") return null;
    throw err;
  }
}

export async function saveFileAs(content: string): Promise<string | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handle = await (window as any).showSaveFilePicker({
      suggestedName: "untitled.py",
      types: [
        {
          description: "Python Files",
          accept: { "text/x-python": [".py"] },
        },
      ],
    });
    fileHandle = handle;
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    return handle.name;
  } catch (err) {
    if ((err as Error).name === "AbortError") return null;
    throw err;
  }
}

export async function openFile(): Promise<{
  content: string;
  name: string;
} | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [handle] = await (window as any).showOpenFilePicker({
      types: [
        {
          description: "Python Files",
          accept: { "text/x-python": [".py"] },
        },
      ],
    });
    fileHandle = handle;
    const file = await handle.getFile();
    const content = await file.text();
    return { content, name: handle.name };
  } catch (err) {
    if ((err as Error).name === "AbortError") return null;
    throw err;
  }
}

export function isFileSystemAccessSupported(): boolean {
  return "showSaveFilePicker" in window;
}
