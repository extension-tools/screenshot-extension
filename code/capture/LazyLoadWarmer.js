self.LazyLoadWarmer = class LazyLoadWarmer {
  constructor({chrome, pageProbe, contentAgent}) {
    this.chrome = chrome;
    this.pageProbe = pageProbe;
    this.contentAgent = contentAgent;
  }

  async warm({tab, page, plan, prefs}) {
    if (prefs.lazyWarmupEnabled === false || plan.positions.length <= 1) {
      return {
        skipped: true,
        reason: prefs.lazyWarmupSkipReason || 'not-needed'
      };
    }

    const started = Date.now();
    const timeoutMs = prefs.lazyWarmupTimeout || 3500;
    const stepDelay = prefs.lazyWarmupStepDelay || 100;
    const stabilizationTimeout = prefs.lazyWarmupStabilizationTimeout || 500;
    const positions = this.createWarmupPositions({page, plan});
    let visited = 0;

    this.chrome.action.setBadgeText({
      tabId: tab.id,
      text: 'W'
    });

    try {
      for (const position of positions) {
        if (this.remainingMs(started, timeoutMs) <= stepDelay) {
          break;
        }

        await this.pageProbe.scrollTo(tab.id, position.x, position.y);
        visited += 1;
        await this.wait(Math.min(stepDelay, this.remainingMs(started, timeoutMs)));

        const remaining = this.remainingMs(started, timeoutMs);
        if (remaining <= 0) {
          break;
        }

        await this.contentAgent.waitForStableLayout(tab.id, {
          timeoutMs: Math.min(stabilizationTimeout, remaining),
          frameCount: 1,
          maxImages: 12
        }).catch(() => {});
      }
    }
    finally {
      await this.pageProbe.scrollTo(tab.id, page.x, page.y).catch(() => {});
      await this.wait(Math.min(stepDelay, Math.max(0, this.remainingMs(started, timeoutMs)))).catch(() => {});
      await this.contentAgent.waitForStableLayout(tab.id, {
        timeoutMs: Math.min(stabilizationTimeout, Math.max(0, this.remainingMs(started, timeoutMs))),
        frameCount: 1,
        maxImages: 12
      }).catch(() => {});
    }

    return {
      skipped: false,
      visited,
      elapsedMs: Date.now() - started,
      timedOut: this.remainingMs(started, timeoutMs) <= 0
    };
  }

  createWarmupPositions({page, plan}) {
    const seen = new Set();
    const positions = [];

    for (const position of plan.positions) {
      const x = Math.max(0, Math.min(position.x || page.x, page.width - page.w));
      const y = Math.max(0, Math.min(position.y, page.height - page.h));
      const key = `${x}:${y}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      positions.push({
        x,
        y
      });
    }

    return positions.sort((a, b) => a.y - b.y || a.x - b.x);
  }

  remainingMs(started, timeoutMs) {
    return timeoutMs - (Date.now() - started);
  }

  wait(ms) {
    if (ms <= 0) {
      return Promise.resolve();
    }

    return new Promise(resolve => setTimeout(resolve, ms));
  }
};
