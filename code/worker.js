importScripts(
  'capture/CapabilityGuard.js',
  'capture/ContentAgentClient.js',
  'capture/NotificationService.js',
  'capture/CaptureDiagnostics.js',
  'capture/CanvasSizeGuard.js',
  'capture/SingleFileExportAttempt.js',
  'capture/QuirksLayer.js',
  'capture/LazyLoadWarmer.js',
  'capture/PageProbe.js',
  'capture/SplitBoundaryPlanner.js',
  'capture/PositionPlanner.js',
  'capture/ViewportCapture.js',
  'capture/CanvasStitcher.js',
  'capture/CanvasTiler.js',
  'capture/CleanupManager.js',
  'capture/CaptureStepper.js',
  'capture/CaptureStore.js',
  'capture/CaptureController.js'
);

chrome.runtime.onConnect.addListener(p => {
  p.onDisconnect.addListener(() => {
    console.info('port is closed', p.name);
  });
});

const notificationService = new self.NotificationService({chrome});
const captureController = new self.CaptureController({
  chrome,
  notifications: notificationService
});

{
  const once = () => {
    if (once.done) {
      return;
    }
    once.done = true;

    chrome.contextMenus.create({
      'id': 'capture-entire',
      'title': 'Capture Entire Page',
      'documentUrlPatterns': ['http://*/*', 'https://*/*'],
      'contexts': ['page', 'selection', 'link']
    });
  };

  chrome.runtime.onInstalled.addListener(once);
  chrome.runtime.onStartup.addListener(once);
}

function onCommand(cmd, tab) {
  captureController.runCommand(cmd, tab).catch(e => {
    console.warn(e);
    notificationService.error(e);
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  onCommand(info.menuItemId, tab, info);
});

chrome.commands.onCommand.addListener(cmd => chrome.tabs.query({
  active: true,
  lastFocusedWindow: true
}, tabs => tabs && tabs[0] && onCommand(cmd, tabs[0])));

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.method !== 'capture-active-tab' && request.method !== 'capture-active-tab-for-test') {
    return false;
  }

  const runForTab = tab => {
    if (!tab) {
      sendResponse({
        ok: false,
        error: 'No active tab to capture.'
      });
      return;
    }

    captureController.runCommand('capture-entire', tab).then(() => {
      sendResponse({ok: true});
    }).catch(error => {
      sendResponse({
        ok: false,
        error: error.message || String(error)
      });
    });
  };

  if (request.tabId) {
    chrome.tabs.get(request.tabId, tab => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        sendResponse({
          ok: false,
          error: lastError.message || 'Could not resolve active tab.'
        });
        return;
      }

      runForTab(tab);
    });
  }
  else {
    chrome.tabs.query({
      active: true,
      lastFocusedWindow: true
    }, tabs => runForTab(tabs && tabs[0]));
  }

  return true;
});
