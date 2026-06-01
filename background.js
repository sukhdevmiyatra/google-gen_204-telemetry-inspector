// background.js — MV3 service worker.
// Opens the side panel on toolbar click.
// On browser start: resets capture state and clears previous session logs.

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error('[Telemetry Inspector] side panel setup failed:', err));

chrome.runtime.onStartup.addListener(function() {
  // Clear logs from the previous browser session and reset capture state.
  // There is no reliable "browser closing" event in MV3, so onStartup is
  // the right place to start fresh — logs are gone before the user sees them.
  chrome.storage.local.remove(['events', 'aioEvents', 'logBodies']);
  chrome.storage.local.set({ captureEnabled: false });
});
