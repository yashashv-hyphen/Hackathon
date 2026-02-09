document.addEventListener('DOMContentLoaded', () => {
  // Entrance Animation
  gsap.to('#main-container', {
    duration: 1,
    opacity: 1,
    y: 0,
    ease: "power3.out"
  });

  const toggleBtn = document.getElementById('toggle');
  const statusDot = document.getElementById('status-dot');

  function updateUI(enabled) {
    if (enabled) {
      toggleBtn.textContent = 'Disable';
      statusDot.classList.add('active');
      gsap.to(statusDot, { scale: 1.2, duration: 0.3, yoyo: true, repeat: 1 });
    } else {
      toggleBtn.textContent = 'Enable';
      statusDot.classList.remove('active');
      gsap.to(statusDot, { scale: 1, duration: 0.3 });
    }
  }

  // Load initial state
  chrome.storage.sync.get(['enabled'], (result) => {
    updateUI(result.enabled);
  });

  toggleBtn.addEventListener('click', () => {
    chrome.storage.sync.get(['enabled'], (result) => {
      const enabled = !result.enabled;
      chrome.storage.sync.set({ enabled });
      updateUI(enabled);

      // Button click animation
      gsap.fromTo(toggleBtn,
        { scale: 0.95 },
        { scale: 1, duration: 0.2, ease: "back.out(1.7)" }
      );
    });
  });
});
