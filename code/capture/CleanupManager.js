self.CleanupManager = class CleanupManager {
  constructor({chrome, pageProbe, contentAgent}) {
    this.chrome = chrome;
    this.pageProbe = pageProbe;
    this.contentAgent = contentAgent;
  }

  async restore({tabId, originalX, originalY, originalWindowX, originalWindowY}) {
    this.chrome.action.setBadgeText({tabId, text: ''});

    const content = await this.contentAgent.cleanup(tabId).catch(error => ({
      restored: false,
      error: error?.message || String(error)
    }));
    await this.pageProbe.restore(tabId, originalX, originalY, originalWindowX, originalWindowY).catch(() => {});

    return {
      content
    };
  }
};
