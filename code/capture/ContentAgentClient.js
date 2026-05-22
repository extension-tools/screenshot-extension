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

  async normalizeSticky(tabId, options = {}) {
    const results = await this.executeInFrames(tabId, {
      func: options => {
        if (!globalThis.__screenshotExtensionContentAgent) {
          return {
            stickyNormalization: {
              applied: false,
              normalized: 0,
              reason: 'missing-content-agent'
            },
            mutations: 0
          };
        }

        return globalThis.__screenshotExtensionContentAgent.normalizeStickyForCapture(options);
      },
      args: [options],
      injectImmediately: true
    });

    return this.aggregateFrameResults(results).stickyNormalization;
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
      dimmedBackdropRecorded: false,
      dimmedBackdropSnapshot: false,
      dimmedBackdropSource: null,
      capturePolicyApplied: false,
      suppressVisibleNavOverlay: false,
      chromeCandidates: [],
      chromeCandidateCount: 0,
      chromeCandidateKinds: [],
      stickyNormalization: {
        applied: false,
        normalized: 0,
        frameCount: results.length || 1,
        framesWithNormalizedSticky: 0,
        shadowRootCount: 0,
        ruleRootCount: 0,
        reasons: []
      }
    };

    for (const entry of results) {
      const result = entry?.result || {};
      const chromeCandidates = Array.isArray(result.chromeCandidates) ? result.chromeCandidates : [];
      const stickyNormalization = result.stickyNormalization || (
        Object.prototype.hasOwnProperty.call(result, 'applied') ||
        Object.prototype.hasOwnProperty.call(result, 'normalized') ||
        Object.prototype.hasOwnProperty.call(result, 'reason') ?
          result :
          {}
      );
      aggregate.hidden += Number(result.hidden) || 0;
      aggregate.transformed += Number(result.transformed) || 0;
      aggregate.mutations += Number(result.mutations) || 0;
      aggregate.chromeCandidateCount += Number(result.chromeCandidateCount) || chromeCandidates.length;
      aggregate.stickyNormalization.applied =
        aggregate.stickyNormalization.applied || Boolean(stickyNormalization.applied);
      aggregate.stickyNormalization.normalized += Number(stickyNormalization.normalized) || 0;
      aggregate.stickyNormalization.shadowRootCount += Number(stickyNormalization.shadowRootCount) || 0;
      aggregate.stickyNormalization.ruleRootCount += Number(stickyNormalization.ruleRootCount) || 0;
      if ((Number(stickyNormalization.normalized) || 0) > 0) {
        aggregate.stickyNormalization.framesWithNormalizedSticky += 1;
      }
      if (stickyNormalization.reason && !aggregate.stickyNormalization.reasons.includes(stickyNormalization.reason)) {
        aggregate.stickyNormalization.reasons.push(stickyNormalization.reason);
      }
      aggregate.suppressionApplied = aggregate.suppressionApplied || Boolean(result.suppressionApplied);
      aggregate.syntheticDimBackdropApplied =
        aggregate.syntheticDimBackdropApplied || Boolean(result.syntheticDimBackdropApplied);
      aggregate.dimmedBackdropRecorded =
        aggregate.dimmedBackdropRecorded || Boolean(result.dimmedBackdropRecorded);
      aggregate.dimmedBackdropSnapshot =
        aggregate.dimmedBackdropSnapshot || Boolean(result.dimmedBackdropSnapshot);
      aggregate.dimmedBackdropSource =
        aggregate.dimmedBackdropSource || result.dimmedBackdropSource || null;
      aggregate.capturePolicyApplied = aggregate.capturePolicyApplied || Boolean(result.capturePolicyApplied);
      aggregate.suppressVisibleNavOverlay =
        aggregate.suppressVisibleNavOverlay || Boolean(result.suppressVisibleNavOverlay);
      for (const candidate of chromeCandidates) {
        if (aggregate.chromeCandidates.length < 80) {
          aggregate.chromeCandidates.push(candidate);
        }
      }
      for (const kind of result.chromeCandidateKinds || []) {
        if (!aggregate.chromeCandidateKinds.includes(kind)) {
          aggregate.chromeCandidateKinds.push(kind);
        }
      }
    }

    aggregate.chromeCandidateKinds.sort();
    aggregate.stickyNormalization.reasons.sort();
    return aggregate;
  }

  async cleanup(tabId) {
    const results = await this.executeInFrames(tabId, {
      func: () => {
        if (globalThis.__screenshotExtensionContentAgent) {
          return globalThis.__screenshotExtensionContentAgent.cleanupCapture();
        }
        return {restored: true};
      },
      injectImmediately: true
    });

    return this.aggregateCleanupResults(results);
  }

  aggregateCleanupResults(results = []) {
    return {
      restored: results.every(entry => entry?.result?.restored !== false),
      frameCount: results.length || 1,
      beforeRestore: {
        stickyMarkers: results.reduce((total, entry) =>
          total + (Number(entry?.result?.beforeRestore?.stickyMarkers) || 0), 0),
        stickyNormalizationRules: results.reduce((total, entry) =>
          total + (Number(entry?.result?.beforeRestore?.stickyNormalizationRules) || 0), 0)
      },
      afterRestore: {
        stickyMarkers: results.reduce((total, entry) =>
          total + (Number(entry?.result?.afterRestore?.stickyMarkers) || 0), 0),
        stickyNormalizationRules: results.reduce((total, entry) =>
          total + (Number(entry?.result?.afterRestore?.stickyNormalizationRules) || 0), 0)
      }
    };
  }
};
