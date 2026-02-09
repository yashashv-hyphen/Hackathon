// Inject webcam and eye tracking logic

console.log('[Eye Cursor Extension] content.js loaded');
// Inject inject.js into page context for camera access
const script = document.createElement('script');
script.src = chrome.runtime.getURL('inject.js');
script.type = 'text/javascript';
script.onload = () => {
	console.log('[Eye Cursor Extension] inject.js injected');
};
script.onerror = () => {
	console.error('[Eye Cursor Extension] Failed to inject inject.js');
};
document.documentElement.appendChild(script);
