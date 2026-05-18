self.CapabilityGuard = class CapabilityGuard {
  constructor({chrome}) {
    this.chrome = chrome;
  }

  assertCanCapture(tab) {
    if (!tab?.id) {
      throw new Error('No active tab to capture.');
    }

    const url = tab.url || '';
    const blockedPrefixes = [
      'chrome:',
      'chrome-extension:',
      'edge:',
      'about:'
    ];

    if (
      blockedPrefixes.some(prefix => url.startsWith(prefix)) ||
      url.startsWith('https://chrome.google.com/webstore/') ||
      url.startsWith('https://chromewebstore.google.com/')
    ) {
      throw new Error('This browser page cannot be captured.');
    }
  }
};

