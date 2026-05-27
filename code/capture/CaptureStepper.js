self.CaptureStepper = class CaptureStepper {
  constructor({
    chrome,
    pageProbe,
    contentAgent,
    viewportCapture,
    stitcher,
    prefs,
    capturePolicy = null,
    includeQaDiagnostics = false
  }) {
    this.chrome = chrome;
    this.pageProbe = pageProbe;
    this.contentAgent = contentAgent;
    this.viewportCapture = viewportCapture;
    this.stitcher = stitcher;
    this.prefs = prefs;
    this.capturePolicy = capturePolicy;
    this.includeQaDiagnostics = includeQaDiagnostics === true;
  }

  async run({tab, plan, startFrameIndex = 0}) {
    const runStarted = Date.now();
    let completed = 0;
    const frames = [];
    let readinessBudgetRemaining = Math.max(0, Number(this.prefs.frameReadinessTotalBudget) || 0);

    for (const position of plan.positions) {
      const frameStarted = Date.now();
      const frameTiming = {};
      completed += 1;
      const frameIndex = startFrameIndex + completed - 1;
      const completedTotal = startFrameIndex + completed;
      this.chrome.action.setBadgeText({
        tabId: tab.id,
        text: (completedTotal / plan.total * 100).toFixed(0) + '%'
      });

      const beforeScrollFrame = frameIndex > 0 ?
        await this.timeFramePhase(frameTiming, 'beforeScrollFrameMs', () => this.contentAgent.beforeFrame(tab.id, {
          frameIndex,
          frameTotal: plan.total,
          position,
          stage: 'before-scroll',
          capturePolicy: this.capturePolicy
        })) :
        null;

      await this.timeFramePhase(frameTiming, 'focusMs', async () => {
        await this.chrome.tabs.update(tab.id, {
          highlighted: true
        });
        await this.chrome.windows.update(tab.windowId, {
          focused: true
        });
      });
      let scroll;
      let scrollAfterCommand = null;
      await this.timeFramePhase(frameTiming, 'scrollMs', async () => {
        await this.pageProbe.scrollTo(tab.id, position.x, position.y);
        scroll = await this.waitForScroll(tab.id, position);
        if (!this.isCloseToPosition(scroll, position)) {
          await this.pageProbe.scrollTo(tab.id, position.x, position.y);
          scroll = await this.waitForScroll(tab.id, position);
        }
        scrollAfterCommand = scroll;
      });
      await this.timeFramePhase(frameTiming, 'delayMs', () => new Promise(resolve => setTimeout(resolve, this.prefs.delay)));
      const beforeFrame = await this.timeFramePhase(frameTiming, 'beforeFrameMs', () => this.contentAgent.beforeFrame(tab.id, {
        frameIndex,
        frameTotal: plan.total,
        position,
        capturePolicy: this.capturePolicy
      }));
      if (frameIndex === 0 && Number(this.prefs.firstFrameSettleDelay) > 0) {
        await this.timeFramePhase(
          frameTiming,
          'firstFrameSettleMs',
          () => new Promise(resolve => setTimeout(resolve, Number(this.prefs.firstFrameSettleDelay)))
        );
      }
      const stabilization = await this.timeFramePhase(frameTiming, 'stabilizationMs', () => this.contentAgent.waitForStableLayout(tab.id, {
        timeoutMs: this.prefs.stabilizationTimeout,
        frameCount: 2,
        maxImages: 16
      }));
      const readiness = await this.timeFramePhase(frameTiming, 'readinessMs', () => this.waitForFrameReadiness(tab.id, {
        budgetMs: readinessBudgetRemaining
      }));
      readinessBudgetRemaining = Math.max(0, readinessBudgetRemaining - readiness.spentMs);
      const beforeCaptureFrame = await this.timeFramePhase(frameTiming, 'beforeCaptureFrameMs', () => this.contentAgent.beforeFrame(tab.id, {
        frameIndex,
        frameTotal: plan.total,
        position,
        stage: 'before-capture',
        capturePolicy: this.capturePolicy
      }));

      scroll = await this.timeFramePhase(frameTiming, 'readScrollMs', () => this.pageProbe.readScroll(tab.id));
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
        scrollAfterCommand: this.summarizeScrollState(scrollAfterCommand, position),
        scrollDiagnostics: this.summarizeScrollState(scroll, position),
        scrollSettled: this.isCloseToPosition(scroll, position),
        beforeFrame: this.mergeBeforeFrameResults(beforeScrollFrame, beforeFrame, beforeCaptureFrame),
        beforeScrollFrame,
        beforeCaptureFrame,
        stabilization,
        readinessRetries: readiness.retries,
        readinessRetrySpentMs: readiness.spentMs,
        readinessBudgetRemaining,
        imageReadiness: readiness.imageReadiness,
        timing: frameTiming
      };
      frames.push(frame);

      const blob = await this.timeFramePhase(frameTiming, 'captureVisibleTabMs', () => this.viewportCapture.capture(this.prefs));
      frame.draw = await this.timeFramePhase(frameTiming, 'drawMs', () => this.stitcher.draw(blob, scroll.x, scroll.y));
      frameTiming.totalMs = Date.now() - frameStarted;
    }

    return {
      frames,
      repeatedChrome: this.includeQaDiagnostics ?
        this.analyzeRepeatedChrome(frames) :
        null,
      timing: this.summarizeTiming(frames, Date.now() - runStarted)
    };
  }

  async timeFramePhase(timing, name, action) {
    const started = Date.now();
    try {
      return await action();
    }
    finally {
      timing[name] = (Number(timing[name]) || 0) + Math.max(0, Date.now() - started);
    }
  }

  summarizeTiming(frames, totalMs) {
    const totals = {};

    for (const frame of frames) {
      for (const [name, value] of Object.entries(frame.timing || {})) {
        if (!name.endsWith('Ms')) {
          continue;
        }

        totals[name] = (totals[name] || 0) + (Number(value) || 0);
      }
    }

    return {
      totalMs: Math.max(0, Math.round(Number(totalMs) || 0)),
      frameCount: frames.length,
      totals: Object.fromEntries(
        Object.entries(totals)
          .map(([name, value]) => [name, Math.max(0, Math.round(value))])
          .sort(([a], [b]) => a.localeCompare(b))
      ),
      frames: frames.slice(0, 80).map(frame => ({
        frameIndex: frame.frameIndex,
        ...Object.fromEntries(
          Object.entries(frame.timing || {})
            .filter(([name]) => name.endsWith('Ms'))
            .map(([name, value]) => [name, Math.max(0, Math.round(Number(value) || 0))])
            .sort(([a], [b]) => a.localeCompare(b))
        )
      }))
    };
  }

  mergeBeforeFrameResults(...results) {
    const normalized = results.filter(Boolean);

    return {
      ...(normalized[0] || {}),
      hidden: normalized.reduce((total, result) => total + (Number(result.hidden) || 0), 0),
      transformed: normalized.reduce((total, result) => total + (Number(result.transformed) || 0), 0),
      mutations: Math.max(0, ...normalized.map(result => Number(result.mutations) || 0)),
      frameCount: Math.max(0, ...normalized.map(result => Number(result.frameCount) || 0)) || undefined,
      chromeCandidates: this.mergeChromeCandidates(normalized),
      chromeCandidateCount: normalized.reduce((total, result) => {
        const candidates = Array.isArray(result.chromeCandidates) ? result.chromeCandidates : [];
        return total + (Number(result.chromeCandidateCount) || candidates.length);
      }, 0),
      chromeCandidateKinds: this.mergeChromeCandidateKinds(normalized),
      suppressionApplied: normalized.some(result => Boolean(result.suppressionApplied)),
      syntheticDimBackdropApplied: normalized.some(result => Boolean(result.syntheticDimBackdropApplied)),
      dimmedBackdropRecorded: normalized.some(result => Boolean(result.dimmedBackdropRecorded)),
      dimmedBackdropSnapshot: normalized.some(result => Boolean(result.dimmedBackdropSnapshot)),
      dimmedBackdropSource: normalized.map(result => result.dimmedBackdropSource).find(Boolean) || null,
      capturePolicyApplied: normalized.some(result => Boolean(result.capturePolicyApplied)),
      suppressVisibleNavOverlay: normalized.some(result => Boolean(result.suppressVisibleNavOverlay))
    };
  }

  mergeChromeCandidates(results) {
    const bySignature = new Map();

    for (const result of results) {
      for (const candidate of result.chromeCandidates || []) {
        const key = `${candidate.kind || 'unknown'}:${candidate.signature || candidate.rect || ''}`;
        const previous = bySignature.get(key);
        if (!previous || (previous.action === 'observe' && candidate.action !== 'observe')) {
          bySignature.set(key, candidate);
        }
      }
    }

    return Array.from(bySignature.values()).slice(0, 80);
  }

  mergeChromeCandidateKinds(results) {
    const kinds = new Set();

    for (const result of results) {
      for (const kind of result.chromeCandidateKinds || []) {
        kinds.add(kind);
      }
    }

    return Array.from(kinds).sort();
  }

  analyzeRepeatedChrome(frames = []) {
    const bySignature = new Map();

    for (const frame of frames) {
      for (const candidate of frame.beforeFrame?.chromeCandidates || []) {
        const key = `${candidate.kind || 'unknown'}:${candidate.signature || candidate.rect || ''}`;
        if (!bySignature.has(key)) {
          bySignature.set(key, {
            kind: candidate.kind || 'unknown',
            signature: candidate.signature || '',
            action: candidate.action || 'observe',
            sampleRect: candidate.rect || null,
            frames: new Set()
          });
        }

        bySignature.get(key).frames.add(Number(frame.frameIndex) || 0);
      }
    }

    const repeated = [];
    const reasons = new Set();

    for (const entry of bySignature.values()) {
      const repeatedAfterFirstFrame = entry.frames.size >= 2 &&
        Array.from(entry.frames).some(frameIndex => frameIndex > 0);
      if (!repeatedAfterFirstFrame) {
        continue;
      }

      const reason = this.repeatedChromeReason(entry.kind);
      reasons.add(reason);
      repeated.push({
        reason,
        kind: entry.kind,
        signature: entry.signature,
        action: entry.action,
        sampleRect: entry.sampleRect,
        frames: Array.from(entry.frames).sort((a, b) => a - b)
      });
    }

    repeated.sort((a, b) => b.frames.length - a.frames.length || a.kind.localeCompare(b.kind));

    return {
      version: 1,
      candidateCount: Array.from(bySignature.values()).length,
      repeatedCount: repeated.length,
      reasons: Array.from(reasons).sort(),
      repeated: repeated.slice(0, 12)
    };
  }

  repeatedChromeReason(kind) {
    if (kind === 'top_header' || kind === 'visible_nav_overlay') {
      return 'repeated-sticky-chrome';
    }

    if (kind === 'side_sidebar' || kind === 'filter_panel') {
      return 'repeated-sidebar';
    }

    if (kind === 'cookie_strip') {
      return 'repeated-cookie-strip';
    }

    if (kind === 'floating_widget') {
      return 'repeated-floating-widget';
    }

    return 'repeated-fixed-sticky-candidate';
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

  isSettledAtScrollEnd(scroll, position) {
    const maxY = Number(scroll?.maxY);
    const plannedY = Number(position?.y) || 0;
    const actualY = Number(scroll?.y) || 0;

    return Boolean(scroll?.atMaxY) &&
      Number.isFinite(maxY) &&
      plannedY >= maxY - 2 &&
      actualY >= maxY - 2;
  }

  summarizeScrollState(scroll, position) {
    if (!scroll) {
      return null;
    }

    return {
      targetType: scroll.targetType || 'unknown',
      targetDescriptor: scroll.targetDescriptor || '',
      plannedX: Math.round(Number(position?.x) || 0),
      plannedY: Math.round(Number(position?.y) || 0),
      actualX: Math.round(Number(scroll.x) || 0),
      actualY: Math.round(Number(scroll.y) || 0),
      maxX: Math.round(Number(scroll.maxX) || 0),
      maxY: Math.round(Number(scroll.maxY) || 0),
      atMaxX: Boolean(scroll.atMaxX),
      atMaxY: Boolean(scroll.atMaxY),
      scrollHeight: Math.round(Number(scroll.scrollHeight) || 0),
      clientHeight: Math.round(Number(scroll.clientHeight) || 0),
      bodyOverflowY: scroll.bodyOverflowY || '',
      htmlOverflowY: scroll.htmlOverflowY || '',
      bodyPosition: scroll.bodyPosition || '',
      htmlPosition: scroll.htmlPosition || '',
      settledAtScrollEnd: this.isSettledAtScrollEnd(scroll, position)
    };
  }

  describeScrollState(scroll) {
    if (!scroll) {
      return 'scroll state unavailable';
    }

    const parts = [
      `target=${scroll.targetType || 'unknown'}`,
      `maxY=${scroll.maxY ?? 'n/a'}`,
      `atMaxY=${scroll.atMaxY ? 'yes' : 'no'}`
    ];

    if (scroll.bodyOverflowY || scroll.htmlOverflowY) {
      parts.push(`overflowY=body:${scroll.bodyOverflowY || 'n/a'},html:${scroll.htmlOverflowY || 'n/a'}`);
    }

    if (scroll.targetDescriptor) {
      parts.push(`descriptor=${scroll.targetDescriptor}`);
    }

    return parts.join('; ');
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
        `actual ${scroll?.x || 0},${scroll?.y || 0}; ${this.describeScrollState(scroll)}.`
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
