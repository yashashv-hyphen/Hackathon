"use client";

type ButtonCallback = () => void;

let mappedKey: string = " "; // Default: Space
let listener: ((e: KeyboardEvent) => void) | null = null;
let callback: ButtonCallback | null = null;

export function getMappedKey(): string {
  return mappedKey;
}

export function setMappedKey(key: string): void {
  mappedKey = key;
  // Re-register listener with new key
  if (callback) {
    registerButtonListener(callback);
  }
}

export function registerButtonListener(cb: ButtonCallback): void {
  callback = cb;

  // Remove existing listener
  if (listener) {
    window.removeEventListener("keydown", listener);
  }

  listener = (e: KeyboardEvent) => {
    if (e.key === mappedKey) {
      e.preventDefault();
      e.stopPropagation();
      cb();
    }
  };

  window.addEventListener("keydown", listener);
}

export function unregisterButtonListener(): void {
  if (listener) {
    window.removeEventListener("keydown", listener);
    listener = null;
  }
  callback = null;
}

export function getKeyDisplayName(key: string): string {
  const names: Record<string, string> = {
    " ": "Space",
    Enter: "Enter",
    Tab: "Tab",
    Escape: "Esc",
    ArrowUp: "Up",
    ArrowDown: "Down",
    ArrowLeft: "Left",
    ArrowRight: "Right",
  };
  return names[key] || key.toUpperCase();
}
