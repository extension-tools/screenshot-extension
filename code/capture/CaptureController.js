self.CaptureController = class CaptureController {
  constructor({chrome, notifications}) {
    this.chrome = chrome;
    this.notifications = notifications;
    this.guard = new self.CapabilityGuard({chrome});
    this.captureDiagnostics = new self.CaptureDiagnostics();
    this.pageProbe = new self.PageProbe({chrome});
    this.contentAgent = new self.ContentAgentClient({chrome});
    this.canvasSizeGuard = new self.CanvasSizeGuard();
    this.singleFileExportAttempt = new self.SingleFileExportAttempt();
    this.lazyLoadWarmer = new self.LazyLoadWarmer({
      chrome,
      pageProbe: this.pageProbe,
      contentAgent: this.contentAgent
    });
    this.viewportCapture = new self.ViewportCapture({chrome});
    this.store = new self.CaptureStore({chrome});
    this.cleanup = new self.CleanupManager({
      chrome,
      pageProbe: this.pageProbe,
      contentAgent: this.contentAgent
    });
  }

  async captureEntire(tab) {
    const prefs = await this.chrome.storage.local.get({
      'delay': 600,
      'offset': 50,
      'quality': 0.95,
      'format': 'png',
      'format-canvas': 'png',
      'stabilizationTimeout': 800,
      'frameReadinessRetryTimeout': 1800,
      'frameReadinessMaxRetries': 3,
      'frameReadinessTotalBudget': 12000,
      'firstFrameSettleDelay': 500,
      'lazyWarmupEnabled': true,
      'lazyWarmupTimeout': 3500,
      'lazyWarmupStepDelay': 100,
      'lazyWarmupStabilizationTimeout': 500
    });
    prefs.delay = Math.max(
      prefs.delay,
      1000 / this.chrome.tabs.MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND || 2
    );

    let page;
    let originalPage;
    let capturePolicy;
    let stitcher;
    let strategy;
    let largePageNoticeShown = false;
    const diagnostics = {
      imageReadiness: {}
    };
    const diagnosticsV2 = this.captureDiagnostics.create({tab, prefs});

    try {
      this.guard.assertCanCapture(tab);
      page = await this.pageProbe.measure(tab.id);
      capturePolicy = page.capturePolicy || page.diagnostics?.capturePolicy || null;
      originalPage = page;
      this.captureDiagnostics.attachPage(diagnosticsV2, page, 'initial');
      largePageNoticeShown = await this.notifyLargePageStrategy(
        tab,
        this.canvasSizeGuard.createStrategy(page),
        largePageNoticeShown
      );

      await this.contentAgent.prepare(tab.id, {
        captureId: String(Date.now()),
        capturePolicy
      });
      diagnostics.imageReadiness.beforeWarmup = await this.contentAgent.collectImageReadiness(tab.id).catch(() => null);

      const planner = new self.PositionPlanner({offset: prefs.offset});
      let plan = planner.createPlan(page);
      const warmupPrefs = capturePolicy?.skipLazyWarmupBeforeFirstFrame ?
        {
          ...prefs,
          lazyWarmupEnabled: false,
          lazyWarmupSkipReason: 'capture-policy-preserve-first-frame'
        } :
        prefs;
      diagnostics.lazyWarmup = await this.lazyLoadWarmer.warm({tab, page, plan, prefs: warmupPrefs});
      page = await this.pageProbe.measure(tab.id);
      capturePolicy = this.mergeCapturePolicies(capturePolicy, page.capturePolicy || page.diagnostics?.capturePolicy || null);
      page = {
        ...page,
        capturePolicy,
        diagnostics: {
          ...(page.diagnostics || {}),
          capturePolicy
        }
      };
      this.captureDiagnostics.attachPage(diagnosticsV2, page, 'post-warmup');
      await this.contentAgent.prepare(tab.id, {
        captureId: String(Date.now()),
        capturePolicy
      });
      diagnostics.imageReadiness.afterWarmup = await this.contentAgent.collectImageReadiness(tab.id).catch(() => null);
      strategy = this.canvasSizeGuard.createStrategy(page);
      this.captureDiagnostics.attachStrategy(diagnosticsV2, strategy, page);
      diagnostics.singleFileExportAttempt = this.singleFileExportAttempt.evaluate({strategy, prefs});
      this.captureDiagnostics.attachSingleFileExportAttempt(diagnosticsV2, diagnostics.singleFileExportAttempt);
      largePageNoticeShown = await this.notifyLargePageStrategy(tab, strategy, largePageNoticeShown);
      plan = planner.createPlan(page);

      stitcher = strategy.mode === 'tiled-output' ?
        new self.CanvasTiler({page, prefs, strategy}) :
        new self.CanvasStitcher({page, prefs});
      const stepper = new self.CaptureStepper({
        chrome: this.chrome,
        pageProbe: this.pageProbe,
        contentAgent: this.contentAgent,
        viewportCapture: this.viewportCapture,
        stitcher,
        prefs,
        capturePolicy
      });

      this.chrome.action.setBadgeText({tabId: tab.id, text: 'R'});
      diagnostics.stepper = await stepper.run({tab, plan});
      this.captureDiagnostics.attachImageReadinessSummary(diagnosticsV2, diagnostics);
    }
    catch (error) {
      this.captureDiagnostics.attachImageReadinessSummary(diagnosticsV2, diagnostics);
      this.captureDiagnostics.markFailure(diagnosticsV2, error);
      error.captureDiagnostics = diagnosticsV2;
      error.legacyDiagnostics = diagnostics;
      throw error;
    }
    finally {
      if (originalPage) {
        await this.cleanup.restore({
          tabId: tab.id,
          originalX: originalPage.x,
          originalY: originalPage.y,
          originalWindowX: originalPage.windowX,
          originalWindowY: originalPage.windowY
        });
      }
      if (tab?.id) {
        await Promise.resolve(this.chrome.action.setBadgeText({
          tabId: tab.id,
          text: ''
        })).catch(() => {});
      }
    }

    this.chrome.action.setBadgeText({tabId: tab.id, text: '...'});

    if (!stitcher) {
      const error = new Error('Capture did not produce an image.');
      this.captureDiagnostics.markFailure(diagnosticsV2, error);
      error.captureDiagnostics = diagnosticsV2;
      error.legacyDiagnostics = diagnostics;
      throw error;
    }

    try {
      if (strategy?.mode === 'tiled-output') {
        return {
          mode: 'tiled-output',
          files: await stitcher.toFiles(),
          strategy,
          diagnostics,
          diagnosticsV2
        };
      }

      return {
        mode: 'single-canvas',
        blob: await stitcher.toBlob(),
        strategy,
        diagnostics,
        diagnosticsV2
      };
    }
    catch (error) {
      this.captureDiagnostics.markFailure(diagnosticsV2, error);
      error.captureDiagnostics = diagnosticsV2;
      error.legacyDiagnostics = diagnostics;
      throw error;
    }
  }

  async runCommand(cmd, tab) {
    if (cmd !== 'capture-entire') {
      throw new Error('Unsupported command: ' + cmd);
    }

    let result;

    try {
      result = await this.captureEntire(tab);
      const exportStatus = result.files ?
        await this.store.saveMultiple(result.files, tab) :
        await this.store.save(result.blob, tab);

      this.captureDiagnostics.attachExportStatus(result.diagnosticsV2, exportStatus);
      if (exportStatus.errors?.length) {
        this.captureDiagnostics.markFailure(result.diagnosticsV2, new Error(exportStatus.errors[0]));
        await this.storeCaptureDiagnostics(result);
        throw new Error(`Download failed: ${exportStatus.errors[0]}`);
      }
      else {
        this.captureDiagnostics.markSuccess(result.diagnosticsV2);
      }

      await this.notifyImageReadinessRisk(result).catch(() => {});
      await this.storeCaptureDiagnostics(result);
      return result;
    }
    catch (error) {
      if (result?.diagnosticsV2) {
        this.captureDiagnostics.markFailure(result.diagnosticsV2, error);
        await this.storeCaptureDiagnostics(result);
      }
      else if (error.captureDiagnostics) {
        await this.storeCaptureDiagnostics({
          mode: 'failed',
          strategy: null,
          diagnostics: error.legacyDiagnostics || {},
          diagnosticsV2: error.captureDiagnostics
        });
      }

      throw error;
    }
    finally {
      if (tab?.id) {
        await Promise.resolve(this.chrome.action.setBadgeText({
          tabId: tab.id,
          text: ''
        })).catch(() => {});
      }
    }
  }

  async storeCaptureDiagnostics(result) {
    await this.chrome.storage.local.set({
      lastCaptureDiagnostics: {
        version: 2,
        mode: result.mode,
        strategy: result.strategy,
        diagnostics: result.diagnostics,
        capture: result.diagnosticsV2,
        generatedAt: new Date().toISOString()
      }
    });
  }

  async notifyLargePageStrategy(tab, strategy, alreadyShown) {
    if (strategy.mode !== 'tiled-output' || alreadyShown) {
      return alreadyShown;
    }

    await this.notifications?.info({
      event: 'capture.large-page-split',
      reason: 'canvas_tiling_required',
      message: 'This page is very large. Screenshot Extension will save it in multiple image parts for reliability.',
      data: {
        outputWidth: strategy.width,
        outputHeight: strategy.height,
        tileCount: strategy.tileCount,
        tilePixelHeight: strategy.tilePixelHeight
      }
    }).catch(() => {});

    return true;
  }

  mergeCapturePolicies(primary, secondary) {
    if (!primary) {
      return secondary || null;
    }
    if (!secondary) {
      return primary;
    }

    const reasons = Array.from(new Set([
      ...(Array.isArray(primary.reasons) ? primary.reasons : []),
      ...(Array.isArray(secondary.reasons) ? secondary.reasons : [])
    ]));
    const viewportOnly = primary.mode === 'viewport-only' || secondary.mode === 'viewport-only';

    return {
      ...secondary,
      version: Math.max(Number(primary.version) || 1, Number(secondary.version) || 1),
      mode: viewportOnly ? 'viewport-only' : (secondary.mode || primary.mode || 'full-page'),
      reasons,
      preserveFirstFrame: primary.preserveFirstFrame !== false && secondary.preserveFirstFrame !== false,
      skipLazyWarmupBeforeFirstFrame: Boolean(
        primary.skipLazyWarmupBeforeFirstFrame ||
        secondary.skipLazyWarmupBeforeFirstFrame
      ),
      firstFrame: {
        ...(secondary.firstFrame || {}),
        ...(primary.firstFrame || {})
      },
      afterFirstFrame: {
        normalizeFixedSticky: Boolean(
          primary.afterFirstFrame?.normalizeFixedSticky ||
          secondary.afterFirstFrame?.normalizeFixedSticky
        ),
        suppressVisibleNavOverlay: Boolean(
          primary.afterFirstFrame?.suppressVisibleNavOverlay ||
          secondary.afterFirstFrame?.suppressVisibleNavOverlay
        ),
        suppressRepeatedOverlays: Boolean(
          primary.afterFirstFrame?.suppressRepeatedOverlays ||
          secondary.afterFirstFrame?.suppressRepeatedOverlays
        ),
        preserveDimmedBackdrop: primary.afterFirstFrame?.preserveDimmedBackdrop !== false &&
          secondary.afterFirstFrame?.preserveDimmedBackdrop !== false
      }
    };
  }

  async notifyImageReadinessRisk(result) {
    const risk = this.summarizeImageReadinessRisk(result?.diagnostics);

    if (!risk.hasRisk) {
      return;
    }

    await this.notifications?.warning({
      event: 'capture.image-readiness-risk',
      reason: 'image_readiness_risk',
      message: 'If some images didn’t load, try again in a few seconds.',
      data: risk
    });
  }

  summarizeImageReadinessRisk(diagnostics = {}) {
    const samples = [
      diagnostics.imageReadiness?.beforeWarmup,
      diagnostics.imageReadiness?.afterWarmup,
      ...(diagnostics.stepper?.frames || []).map(frame => frame.imageReadiness)
    ].filter(Boolean);

    const summary = samples.reduce((accumulator, sample) => {
      accumulator.visibleImages = Math.max(accumulator.visibleImages, Number(sample.visibleImages) || 0);
      accumulator.pendingImagesWithSource = Math.max(
        accumulator.pendingImagesWithSource,
        Number(sample.pendingImagesWithSource) || 0
      );
      accumulator.brokenImages = Math.max(accumulator.brokenImages, Number(sample.brokenImages) || 0);
      accumulator.lowestReadinessRatio = Math.min(
        accumulator.lowestReadinessRatio,
        Number.isFinite(sample.readinessRatio) ? sample.readinessRatio : 1
      );
      return accumulator;
    }, {
      visibleImages: 0,
      pendingImagesWithSource: 0,
      brokenImages: 0,
      lowestReadinessRatio: 1
    });

    return {
      ...summary,
      hasRisk: summary.visibleImages > 0 && (
        summary.pendingImagesWithSource > 0 ||
        summary.brokenImages > 0 ||
        summary.lowestReadinessRatio < 0.98
      )
    };
  }
};
