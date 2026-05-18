self.CaptureStepper = class CaptureStepper {
  constructor({chrome, pageProbe, contentAgent, viewportCapture, stitcher, prefs, capturePolicy = null}) {
    this.chrome = chrome;
    this.pageProbe = pageProbe;
    this.contentAgent = contentAgent;
    this.viewportCapture = viewportCapture;
    this.stitcher = stitcher;
    this.prefs = prefs;
    this.capturePolicy = capturePolicy;
  }

  async run({tab, plan, startFrameIndex = 0}) {
    let completed = 0;
    const frames = [];
    let readinessBudgetRemaining = Math.max(0, Number(this.prefs.frameReadinessTotalBudget) || 0);

    for (const position of plan.positions) {
      completed += 1;
      const frameIndex = startFrameIndex + completed - 1;
      const completedTotal = startFrameIndex + completed;
      this.chrome.action.setBadgeText({
        tabId: tab.id,
        text: (completedTotal / plan.total * 100).toFixed(0) + '%'
      });

      const beforeScrollFrame = frameIndex > 0 ?
        await this.contentAgent.beforeFrame(tab.id, {
          frameIndex,
          frameTotal: plan.total,
          position,
          stage: 'before-scroll',
          capturePolicy: this.capturePolicy
        }) :
        null;

      await this.chrome.tabs.update(tab.id, {
        highlighted: true
      });
      await this.chrome.windows.update(tab.windowId, {
        focused: true
      });
      await this.pageProbe.scrollTo(tab.id, position.x, position.y);
      let scroll = await this.waitForScroll(tab.id, position);
      if (!this.isCloseToPosition(scroll, position)) {
        await this.pageProbe.scrollTo(tab.id, position.x, position.y);
        scroll = await this.waitForScroll(tab.id, position);
      }
      await new Promise(resolve => setTimeout(resolve, this.prefs.delay));
      const beforeFrame = await this.contentAgent.beforeFrame(tab.id, {
        frameIndex,
        frameTotal: plan.total,
        position,
        capturePolicy: this.capturePolicy
      });
      if (frameIndex === 0 && Number(this.prefs.firstFrameSettleDelay) > 0) {
        await new Promise(resolve => setTimeout(resolve, Number(this.prefs.firstFrameSettleDelay)));
      }
      const stabilization = await this.contentAgent.waitForStableLayout(tab.id, {
        timeoutMs: this.prefs.stabilizationTimeout,
        frameCount: 2,
        maxImages: 16
      });
      const readiness = await this.waitForFrameReadiness(tab.id, {
        budgetMs: readinessBudgetRemaining
      });
      readinessBudgetRemaining = Math.max(0, readinessBudgetRemaining - readiness.spentMs);
      const beforeCaptureFrame = await this.contentAgent.beforeFrame(tab.id, {
        frameIndex,
        frameTotal: plan.total,
        position,
        stage: 'before-capture',
        capturePolicy: this.capturePolicy
      });

      scroll = await this.pageProbe.readScroll(tab.id);
      this.assertScrollProgress({
        frameIndex,
        position,
        scroll,
        previousFrame: frames[frames.length - 1]
      });
      const frame = {
        frameIndex,
        position,
        scroll,
        scrollSettled: this.isCloseToPosition(scroll, position),
        beforeFrame: this.mergeBeforeFrameResults(beforeScrollFrame, beforeFrame, beforeCaptureFrame),
        beforeScrollFrame,
        beforeCaptureFrame,
        stabilization,
        readinessRetries: readiness.retries,
        readinessRetrySpentMs: readiness.spentMs,
        readinessBudgetRemaining,
        imageReadiness: readiness.imageReadiness
      };
      frames.push(frame);

      const blob = await this.viewportCapture.capture(this.prefs);
      frame.draw = await this.stitcher.draw(blob, scroll.x, scroll.y);
    }

    return {frames};
  }

  mergeBeforeFrameResults(...results) {
    const normalized = results.filter(Boolean);

    return {
      ...(normalized[0] || {}),
      hidden: normalized.reduce((total, result) => total + (Number(result.hidden) || 0), 0),
      transformed: normalized.reduce((total, result) => total + (Number(result.transformed) || 0), 0),
      mutations: Math.max(0, ...normalized.map(result => Number(result.mutations) || 0)),
      frameCount: Math.max(0, ...normalized.map(result => Number(result.frameCount) || 0)) || undefined,
      suppressionApplied: normalized.some(result => Boolean(result.suppressionApplied)),
      syntheticDimBackdropApplied: normalized.some(result => Boolean(result.syntheticDimBackdropApplied)),
      capturePolicyApplied: normalized.some(result => Boolean(result.capturePolicyApplied)),
      suppressVisibleNavOverlay: normalized.some(result => Boolean(result.suppressVisibleNavOverlay))
    };
  }

  async waitForScroll(tabId, position) {
    const started = Date.now();
    const timeout = Math.max(250, Math.min(1200, this.prefs.stabilizationTimeout || 800));
    let last = await this.pageProbe.readScroll(tabId);

    while (Date.now() - started < timeout) {
      if (this.isCloseToPosition(last, position)) {
        return last;
      }

      await new Promise(resolve => setTimeout(resolve, 50));
      last = await this.pageProbe.readScroll(tabId);
    }

    return last;
  }

  isCloseToPosition(scroll, position) {
    return Math.abs((scroll?.x || 0) - (position?.x || 0)) <= 2 &&
      Math.abs((scroll?.y || 0) - (position?.y || 0)) <= 2;
  }

  assertScrollProgress({frameIndex, position, scroll, previousFrame}) {
    if (frameIndex === 0 || this.isCloseToPosition(scroll, position) || !previousFrame) {
      return;
    }

    const plannedMoved = Math.abs((position?.x || 0) - (previousFrame.position?.x || 0)) > 2 ||
      Math.abs((position?.y || 0) - (previousFrame.position?.y || 0)) > 2;
    const actualMoved = Math.abs((scroll?.x || 0) - (previousFrame.scroll?.x || 0)) > 2 ||
      Math.abs((scroll?.y || 0) - (previousFrame.scroll?.y || 0)) > 2;

    if (plannedMoved && !actualMoved) {
      const plannedForwardY = (position?.y || 0) - (previousFrame.position?.y || 0) > 2;
      const actualAlreadyPastPreviousY = plannedForwardY &&
        (scroll?.y || 0) > (previousFrame.position?.y || 0) + 2;
      const plannedForwardX = (position?.x || 0) - (previousFrame.position?.x || 0) > 2;
      const actualAlreadyPastPreviousX = plannedForwardX &&
        (scroll?.x || 0) > (previousFrame.position?.x || 0) + 2;
      const initialScrollStuck = frameIndex <= 1 &&
        Math.abs(scroll?.x || 0) <= 2 &&
        Math.abs(scroll?.y || 0) <= 2;

      if (!initialScrollStuck || actualAlreadyPastPreviousY || actualAlreadyPastPreviousX) {
        return;
      }

      throw new Error(
        'Scroll target did not move during capture. ' +
        `Frame ${frameIndex}: planned ${position?.x || 0},${position?.y || 0}; ` +
        `actual ${scroll?.x || 0},${scroll?.y || 0}.`
      );
    }
  }

  async waitForFrameReadiness(tabId, options = {}) {
    const maxRetries = Math.max(0, Number(this.prefs.frameReadinessMaxRetries) || 0);
    const retryTimeout = Math.max(0, Number(this.prefs.frameReadinessRetryTimeout) || 0);
    const started = Date.now();
    let imageReadiness = await this.contentAgent.collectImageReadiness(tabId).catch(() => null);
    let retries = 0;
    let budgetMs = Math.max(0, Number(options.budgetMs) || 0);

    while (this.needsReadinessRetry(imageReadiness) && retries < maxRetries && retryTimeout > 0 && budgetMs > 0) {
      retries += 1;
      const attemptTimeout = Math.min(retryTimeout, budgetMs);
      const attemptStarted = Date.now();
      const result = await this.contentAgent.waitForImageReadiness(tabId, {
        timeoutMs: attemptTimeout,
        maxImages: 32
      });
      budgetMs = Math.max(0, budgetMs - (Date.now() - attemptStarted));
      imageReadiness = result.imageReadiness ||
        await this.contentAgent.collectImageReadiness(tabId).catch(() => imageReadiness);
    }

    return {
      retries,
      spentMs: Date.now() - started,
      imageReadiness
    };
  }

  needsReadinessRetry(imageReadiness) {
    if (!imageReadiness) {
      return false;
    }

    if ((imageReadiness.pendingImages || 0) > 0) {
      return true;
    }

    return (imageReadiness.placeholderBlocks || 0) > 0 &&
      (imageReadiness.visibleImages || 0) > 0 &&
      (imageReadiness.readyImages || 0) < (imageReadiness.visibleImages || 0);
  }
};
