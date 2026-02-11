document.getElementById("startBtn").addEventListener("click", async () => {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const status = document.getElementById("status");
  startBtn.disabled = true;
  try {
    const res = await chrome.runtime.sendMessage({ type: "START_TRACKING" });
    if (res && !res.ok) {
      throw new Error(res.error || "Failed");
    }
    stopBtn.disabled = false;
    status.textContent = "Tracking on";
    status.classList.add("on");
  } catch (e) {
    status.textContent = "Error: " + (e && e.message ? e.message : "failed");
    startBtn.disabled = false;
  }
});

document.getElementById("stopBtn").addEventListener("click", async () => {
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const status = document.getElementById("status");
  stopBtn.disabled = true;
  try {
    const res = await chrome.runtime.sendMessage({ type: "STOP_TRACKING" });
    if (res && !res.ok) {
      throw new Error(res.error || "Failed");
    }
    startBtn.disabled = false;
    status.textContent = "Off";
    status.classList.remove("on");
  } catch (e) {
    status.textContent = "Error: " + (e && e.message ? e.message : "failed");
    stopBtn.disabled = false;
  }
});

async function updateUI() {
  const { tracking = false } = await chrome.storage.local.get("tracking");
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const status = document.getElementById("status");
  startBtn.disabled = tracking;
  stopBtn.disabled = !tracking;
  status.textContent = tracking ? "Tracking on" : "Off";
  if (tracking) status.classList.add("on"); else status.classList.remove("on");
}
updateUI();
