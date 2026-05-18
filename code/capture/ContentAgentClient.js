self.ContentAgentClient = class ContentAgentClient {
  constructor({chrome}) {
    this.chrome = chrome;
  }

  async inject(tabId) {
    const injection = {
      files: [
        'content/DomMutationStack.js',
        'content/ScrollTargetFinder.js',
        'content/ScrollbarNormalizer.js',
        'content/FixedStickyNormalizer.js',
        'content/ImageReadinessProbe.js',
        'content/ContentAgent.js'
      ],
      injectImmediately: true
    };

    try {
      await this.chrome.scripting.executeScript({
        target: {tabId, allFrames: true},
        ...injection
      });
    }
    catch {
      await this.chrome.scripting.executeScript({
        target: {tabId},
        ...injection
      });
    }
  }

  async prepare(tabId, options = {}) {
    await this.inject(tabId);

    const results = await this.executeInFrames(tabId, {
      func: options => globalThis.__screenshotExtensionContentAgent.prepareCapture(options),
      args: [options],
      injectImmediately: true
    });

    return this.aggregateFrameResults(results);
  }

  async beforeFrame(tabId, options = {}) {
    const results = await this.executeInFrames(tabId, {
      func: options => {
        if (!globalThis.__screenshotExtensionContentAgent) {
          return {
            hidden: 0,
            mutations: 0
          };
        }

        return globalThis.__screenshotExtensionContentAgent.beforeFrame(options);
      },
      args: [options],
      injectImmediately: true
    });

    return this.aggregateFrameResults(results);
  }

  async waitForStableLayout(tabId, options = {}) {
    const [result] = await this.chrome.scripting.executeScript({
      target: {tabId},
      func: options => globalThis.__screenshotExtensionContentAgent.waitForStableLayout(options),
      args: [options],
      injectImmediately: true
    });

    return result.result;
  }

  async collectImageReadiness(tabId) {
    const [result] = await this.chrome.scripting.executeScript({
      target: {tabId},
      func: () => globalThis.__screenshotExtensionContentAgent.collectImageReadiness(),
      injectImmediately: true
    });

    return result.result;
  }

  async waitForImageReadiness(tabId, options = {}) {
    const [result] = await this.chrome.scripting.executeScript({
      target: {tabId},
      func: options => globalThis.__screenshotExtensionContentAgent.waitForImageReadiness(options),
      args: [options],
      injectImmediately: true
    });

    return result.result;
  }

  async cleanup(tabId) {
    await this.executeInFrames(tabId, {
      func: () => {
        if (globalThis.__screenshotExtensionContentAgent) {
          return globalThis.__screenshotExtensionContentAgent.cleanupCapture();
        }
        return {restored: true};
      },
      injectImmediately: true
    });
  }

  async executeInFrames(tabId, injection) {
    try {
      return await this.chrome.scripting.executeScript({
        target: {tabId, allFrames: true},
        ...injection
      });
    }
    catch {
      return await this.chrome.scripting.executeScript({
        target: {tabId},
        ...injection
      });
    }
  }

  aggregateFrameResults(results = []) {
    const aggregate = {
      hidden: 0,
      transformed: 0,
      mutations: 0,
      frameCount: results.length || 1,
      suppressionApplied: false,
      syntheticDimBackdropApplied: false,
      capturePolicyApplied: false,
      suppressVisibleNavOverlay: false
    };

    for (const entry of results) {
      const result = entry?.result || {};
      aggregate.hidden += Number(result.hidden) || 0;
      aggregate.transformed += Number(result.transformed) || 0;
      aggregate.mutations += Number(result.mutations) || 0;
      aggregate.suppressionApplied = aggregate.suppressionApplied || Boolean(result.suppressionApplied);
      aggregate.syntheticDimBackdropApplied =
        aggregate.syntheticDimBackdropApplied || Boolean(result.syntheticDimBackdropApplied);
      aggregate.capturePolicyApplied = aggregate.capturePolicyApplied || Boolean(result.capturePolicyApplied);
      aggregate.suppressVisibleNavOverlay =
        aggregate.suppressVisibleNavOverlay || Boolean(result.suppressVisibleNavOverlay);
    }

    return aggregate;
  }
};
