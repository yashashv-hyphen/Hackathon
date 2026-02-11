"use client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let pyodideInstance: any = null;
let loading = false;

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  error: string | null;
  errorLine: number | null;
}

function loadPyodideScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((window as any).loadPyodide) { resolve(); return; }
    if (document.querySelector('script[src*="pyodide"]')) {
      const poll = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).loadPyodide) { clearInterval(poll); resolve(); }
      }, 100);
      setTimeout(() => { clearInterval(poll); reject(new Error("Pyodide script timed out")); }, 30000);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/pyodide.js";
    script.async = true;
    script.onload = () => {
      const poll = setInterval(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if ((window as any).loadPyodide) { clearInterval(poll); resolve(); }
      }, 50);
      setTimeout(() => { clearInterval(poll); reject(new Error("Pyodide not available after load")); }, 10000);
    };
    script.onerror = () => reject(new Error("Failed to load Pyodide script"));
    document.head.appendChild(script);
  });
}

export async function loadPyodide(): Promise<void> {
  if (pyodideInstance || loading) return;
  loading = true;

  try {
    await loadPyodideScript();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pyodideModule = await (window as any).loadPyodide({
      indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/",
    });
    pyodideInstance = pyodideModule;
  } catch (err) {
    console.error("Failed to load Pyodide:", err);
    throw err;
  } finally {
    loading = false;
  }
}

export function isLoaded(): boolean {
  return pyodideInstance !== null;
}

export function isLoading(): boolean {
  return loading;
}

export async function runPython(code: string): Promise<ExecutionResult> {
  if (!pyodideInstance) {
    await loadPyodide();
  }

  const result: ExecutionResult = {
    stdout: "",
    stderr: "",
    error: null,
    errorLine: null,
  };

  try {
    // Redirect stdout/stderr
    pyodideInstance.runPython(`
import sys
from io import StringIO
sys.stdout = StringIO()
sys.stderr = StringIO()
`);

    // Run user code
    await pyodideInstance.runPythonAsync(code);

    // Capture output
    result.stdout = pyodideInstance.runPython("sys.stdout.getvalue()");
    result.stderr = pyodideInstance.runPython("sys.stderr.getvalue()");
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    result.error = errorMessage;

    // Try to extract line number from user code frame in Python traceback
    // Match: File "<exec>", line N or File "<string>", line N
    // This avoids matching internal Pyodide frames like File "/lib/python3.11/...", line 573
    const execMatch = errorMessage.match(/File "<(?:exec|string)>", line (\d+)/);
    if (execMatch) {
      result.errorLine = parseInt(execMatch[1], 10);
    }

    // Still try to capture any stdout that was produced before the error
    try {
      result.stdout = pyodideInstance.runPython("sys.stdout.getvalue()");
      result.stderr = pyodideInstance.runPython("sys.stderr.getvalue()");
    } catch {
      // ignore
    }
  } finally {
    // Restore stdout/stderr
    try {
      pyodideInstance.runPython(`
import sys
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`);
    } catch {
      // ignore
    }
  }

  return result;
}
