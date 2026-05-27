self.CaptureController = class CaptureController {
  constructor({chrome, notifications}) {
    this.chrome = chrome;
    this.notifications = notifications;
    this.guard = new self.CapabilityGuard({chrome});
    this.captureDiagnostics = new self.CaptureDiagnostics();
    this.pageProbe = new self.PageProbe({chrome});
    this.quirks = new self.QuirksLayer({chrome});
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
    this.pdfExporter = new self.PdfExporter();
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
      'lazyWarmupStabilizationTimeout': 500,
      'diagnosticsMode': 'production',
      'qaDiagnostics': false
    });
    const diagnosticsMode = this.captureDiagnostics.normalizeDiagnosticsMode(prefs);
    const platformInfo = await this.readPlatformInfo();
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
    let quirks = null;
    let postWarmupQuirks = null;
    const diagnostics = {
      imageReadiness: {},
      quirks: {}
    };
    const diagnosticsV2 = this.captureDiagnostics.create({tab, prefs, platformInfo});
    diagnosticsV2.diagnosticsMode = diagnosticsMode;
    const timePhase = async (name, action, extra = {}) => {
      const started = Date.now();
      try {
        return await action();
      }
      finally {
        this.captureDiagnostics.recordTiming(diagnosticsV2, name, Date.now() - started, extra);
      }
    };
    const timePhaseSync = (name, action, extra = {}) => {
      const started = Date.now();
      try {
        return action();
      }
      finally {
        this.captureDiagnostics.recordTiming(diagnosticsV2, name, Date.now() - started, extra);
      }
    };

    try {
      timePhaseSync('capability_guard', () => this.guard.assertCanCapture(tab));
      quirks = await timePhase('quirks_before_measure', () => this.quirks.beforeMeasure(tab.id).catch(() => null));
      diagnostics.quirks.beforeMeasure = quirks;
      page = await timePhase('page_probe_initial', () => this.pageProbe.measure(tab.id, quirks));
      this.assertMeasuredPage(page, 'initial');
      capturePolicy = page.capturePolicy || page.diagnostics?.capturePolicy || null;
      originalPage = page;
      this.captureDiagnostics.attachPage(diagnosticsV2, page, 'initial');
      largePageNoticeShown = await this.notifyLargePageStrategy(
        tab,
        this.canvasSizeGuard.createStrategy(page),
        largePageNoticeShown
      );

      await timePhase('content_prepare', () => this.contentAgent.prepare(tab.id, {
        captureId: String(Date.now()),
        capturePolicy
      }));
      diagnostics.imageReadiness.beforeWarmup = await timePhase(
        'image_readiness_before_warmup',
        () => this.contentAgent.collectImageReadiness(tab.id).catch(() => null)
      );

      const planner = new self.PositionPlanner({offset: prefs.offset});
      let plan = timePhaseSync('position_plan_initial', () => planner.createPlan(page));
      if (diagnosticsV2.timing?.phases?.position_plan_initial) {
        diagnosticsV2.timing.phases.position_plan_initial.positions = plan.positions.length;
      }
      const warmupPrefs = capturePolicy?.skipLazyWarmupBeforeFirstFrame ?
        {
          ...prefs,
          lazyWarmupEnabled: false,
          lazyWarmupSkipReason: 'capture-policy-preserve-first-frame'
        } :
        prefs;
      diagnostics.lazyWarmup = await timePhase(
        'lazy_warmup',
        () => this.lazyLoadWarmer.warm({tab, page, plan, prefs: warmupPrefs})
      );
      postWarmupQuirks = await timePhase(
        'quirks_after_warmup',
        () => this.quirks.afterWarmup(tab.id).catch(() => null)
      );
      diagnostics.quirks.afterWarmup = postWarmupQuirks;
      page = await timePhase('page_probe_post_warmup', () => this.pageProbe.measure(tab.id, postWarmupQuirks || quirks));
      this.assertMeasuredPage(page, 'post-warmup');
      capturePolicy = this.mergeCapturePolicies(capturePolicy, page.capturePolicy || page.diagnostics?.capturePolicy || null);
      page = {
        ...page,
        capturePolicy,
        diagnostics: {
          ...this.mergePageRiskDiagnostics(originalPage?.diagnostics, page.diagnostics),
          capturePolicy
        }
      };
      this.captureDiagnostics.attachPage(diagnosticsV2, page, 'post-warmup');
      diagnostics.imageReadiness.afterWarmup = await timePhase(
        'image_readiness_after_warmup',
        () => this.contentAgent.collectImageReadiness(tab.id).catch(() => null)
      );
      plan = timePhaseSync('position_plan_post_warmup', () => planner.createPlan(page));
      if (diagnosticsV2.timing?.phases?.position_plan_post_warmup) {
        diagnosticsV2.timing.phases.position_plan_post_warmup.positions = plan.positions.length;
      }
      const viewportBlockingFallback = await timePhase(
        'viewport_blocking_fallback_probe',
        () => this.probeViewportBlockingFallback(tab, page, plan, capturePolicy, prefs)
      );
      diagnostics.viewportBlockingFallback = viewportBlockingFallback;
      diagnosticsV2.viewportBlockingFallback = viewportBlockingFallback;

      if (viewportBlockingFallback.triggered) {
        capturePolicy = {
          ...capturePolicy,
          mode: 'viewport-only',
          reasons: [
            ...new Set([
              ...(Array.isArray(capturePolicy?.reasons) ? capturePolicy.reasons : []),
              viewportBlockingFallback.reason
            ])
          ],
          viewportBlockingFallback
        };
        page = {
          ...page,
          height: page.h,
          scrollHeight: page.h,
          scrollPlanWidth: page.w,
          scrollPlanHeight: page.h,
          scrollPlanViewportWidth: page.w,
          scrollPlanViewportHeight: page.h,
          splitCandidates: [],
          splitExclusionRanges: [],
          capturePlan: null,
          capturePolicy,
          diagnostics: {
            ...(page.diagnostics || {}),
            capturePolicy,
            viewportBlockingFallback
          }
        };
        this.captureDiagnostics.attachPage(diagnosticsV2, page, 'viewport-fallback');
        plan = timePhaseSync('position_plan_viewport_fallback', () => planner.createPlan(page));
        if (diagnosticsV2.timing?.phases?.position_plan_viewport_fallback) {
          diagnosticsV2.timing.phases.position_plan_viewport_fallback.positions = plan.positions.length;
        }
      }

      strategy = timePhaseSync('canvas_strategy', () => this.canvasSizeGuard.createStrategy(page));
      this.captureDiagnostics.attachStrategy(diagnosticsV2, strategy, page);
      diagnostics.singleFileExportAttempt = timePhaseSync(
        'single_file_export_decision',
        () => this.singleFileExportAttempt.evaluate({strategy, prefs})
      );
      this.captureDiagnostics.attachSingleFileExportAttempt(diagnosticsV2, diagnostics.singleFileExportAttempt);
      largePageNoticeShown = await this.notifyLargePageStrategy(tab, strategy, largePageNoticeShown);
      const postPlanSticky = await timePhase('sticky_normalization', () => this.contentAgent.normalizeSticky(tab.id, {
        capturePolicy
      }));
      diagnostics.stickyNormalization = {
        postPlan: postPlanSticky,
        active: postPlanSticky
      };

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
      diagnostics.stepper = await timePhase('capture_stepper', () => stepper.run({tab, plan}), {
        framesPlanned: plan.total
      });
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
        const cleanupDiagnostics = await timePhase('cleanup_restore', () => this.cleanup.restore({
          tabId: tab.id,
          originalX: originalPage.x,
          originalY: originalPage.y,
          originalWindowX: originalPage.windowX,
          originalWindowY: originalPage.windowY
        }));
        diagnostics.cleanup = cleanupDiagnostics;
        diagnosticsV2.cleanup = cleanupDiagnostics;
      }
      if (tab?.id) {
        await this.quirks.cleanup(tab.id).catch(() => {});
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
          files: await timePhase('render_output_files', () => stitcher.toFiles()),
          strategy,
          diagnostics,
          diagnosticsV2,
          diagnosticsMode
        };
      }

      return {
        mode: 'single-canvas',
        blob: await timePhase('render_output_blob', () => stitcher.toBlob()),
        strategy,
        diagnostics,
        diagnosticsV2,
        diagnosticsMode
      };
    }
    catch (error) {
      this.captureDiagnostics.markFailure(diagnosticsV2, error);
      error.captureDiagnostics = diagnosticsV2;
      error.legacyDiagnostics = diagnostics;
      throw error;
    }
  }

  async runCommand(cmd, tab, options = {}) {
    if (cmd !== 'capture-entire') {
      throw new Error('Unsupported command: ' + cmd);
    }

    const exportFormat = options.exportFormat === 'pdf' ? 'pdf' : 'png';

    let result;

    try {
      result = await this.captureEntire(tab);
      const exportStarted = Date.now();
      const {exportStatus, exportSummary} = await this.saveCaptureResult(result, tab, exportFormat);
      this.captureDiagnostics.recordTiming(result.diagnosticsV2, 'download_export', Date.now() - exportStarted, {
        fileCount: exportStatus.files?.length || 0
      });

      this.captureDiagnostics.attachExportStatus(result.diagnosticsV2, exportStatus);
      if (exportSummary) {
        result.diagnosticsV2.export = result.diagnosticsV2.export || {};
        result.diagnosticsV2.export.format = 'pdf';
        result.diagnosticsV2.export.pdf = exportSummary;
      }
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

  // Keep export branching below the capture pipeline.
  async saveCaptureResult(result, tab, exportFormat) {
    const normalizedExportFormat = exportFormat === 'pdf' ? 'pdf' : 'png';

    if (normalizedExportFormat === 'pdf') {
      return this.exportPdfResult(result, tab);
    }

    return {
      exportStatus: await this.savePngResult(result, tab),
      exportSummary: null
    };
  }

  // Preserve the existing PNG save path unchanged.
  async savePngResult(result, tab) {
    if (result.files) {
      return this.store.saveMultiple(result.files, tab);
    }

    return this.store.save(result.blob, tab);
  }

  // PDF v1 emits one final file plus bounded summary metadata.
  async exportPdfResult(result, tab) {
    const pdfResult = await this.pdfExporter.export({result});

    return {
      exportStatus: await this.store.save(pdfResult.blob, tab),
      exportSummary: pdfResult.summary
    };
  }

  async storeCaptureDiagnostics(result) {
    await this.chrome.storage.local.set({
      lastCaptureDiagnostics: {
        ...this.captureDiagnostics.serializeForStorage({
          mode: result.diagnosticsMode || result.diagnosticsV2?.diagnosticsMode,
          strategy: result.strategy,
          diagnostics: result.diagnostics,
          captureDiagnostics: result.diagnosticsV2
        })
      }
    });
  }

  async readPlatformInfo() {
    if (!this.chrome?.runtime?.getPlatformInfo) {
      return null;
    }

    try {
      return await new Promise(resolve => {
        const maybePromise = this.chrome.runtime.getPlatformInfo(info => resolve(info || null));

        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(info => resolve(info || null)).catch(() => resolve(null));
        }
      });
    }
    catch (_error) {
      return null;
    }
  }

  async probeViewportBlockingFallback(tab, page, plan, capturePolicy, prefs = {}) {
    if (!capturePolicy?.viewportBlockingProbe || capturePolicy?.mode === 'viewport-only') {
      return {triggered: false, skipped: true, reason: 'probe-disabled'};
    }

    const firstScrollPosition = plan?.positions?.find(position =>
      Number(position?.y || 0) > 0
    );

    if (!firstScrollPosition) {
      return {triggered: false, skipped: true, reason: 'single-frame-plan'};
    }

    const plannedY = Math.max(0, Number(firstScrollPosition.y || 0));
    const plannedX = Math.max(0, Number(firstScrollPosition.x || 0));
    const startScroll = await this.pageProbe.readScroll(tab.id);

    await this.pageProbe.scrollTo(tab.id, plannedX, plannedY);

    const delayMs = Math.max(120, Math.min(450, Number(prefs?.delay || 180)));
    await new Promise(resolve => setTimeout(resolve, delayMs));

    const probeScroll = await this.pageProbe.readScroll(tab.id);

    await this.pageProbe.scrollTo(
      tab.id,
      Math.max(0, Number(startScroll?.x || 0)),
      Math.max(0, Number(startScroll?.y || 0))
    );
    await new Promise(resolve => setTimeout(resolve, 80));

    const actualY = Math.max(0, Number(probeScroll?.y || 0));
    const expectedY = Math.max(1, plannedY);
    const movedEnough = actualY >= Math.min(expectedY * 0.5, Math.max(48, page.h * 0.18));

    if (movedEnough) {
      return {
        triggered: false,
        reason: 'probe-scroll-moved',
        plannedY,
        actualY
      };
    }

    return {
      triggered: true,
      reason: 'viewport-blocking-overlay-scroll-stuck',
      plannedY,
      actualY
    };
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

  assertMeasuredPage(page, stage) {
    if (page && typeof page === 'object') {
      return;
    }

    throw new Error(`PageProbe returned no measurement during ${stage || 'capture'} stage.`);
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
      viewportBlockingProbe: Boolean(primary.viewportBlockingProbe || secondary.viewportBlockingProbe),
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
      },
      quirks: {
        ...(primary.quirks || {}),
        ...(secondary.quirks || {}),
        preserveFixedBackground: Boolean(
          primary.quirks?.preserveFixedBackground ||
          secondary.quirks?.preserveFixedBackground
        ),
        fixedBackgroundAttribute: secondary.quirks?.fixedBackgroundAttribute ||
          primary.quirks?.fixedBackgroundAttribute,
        knownLightboxRoot: Boolean(
          primary.quirks?.knownLightboxRoot ||
          secondary.quirks?.knownLightboxRoot
        )
      }
    };
  }

  mergePageRiskDiagnostics(initialDiagnostics = {}, currentDiagnostics = {}) {
    const initialRiskFlags = Array.isArray(initialDiagnostics.riskFlags) ? initialDiagnostics.riskFlags : [];
    const currentRiskFlags = Array.isArray(currentDiagnostics.riskFlags) ? currentDiagnostics.riskFlags : [];
    const riskFlags = Array.from(new Set([...initialRiskFlags, ...currentRiskFlags]));
    const fixedStickyCandidateCount = Math.max(
      Number(initialDiagnostics.fixedStickyCandidateCount) || 0,
      Number(currentDiagnostics.fixedStickyCandidateCount) || 0
    );
    const visibleOverlayCandidateCount = Math.max(
      Number(initialDiagnostics.visibleOverlayCandidateCount) || 0,
      Number(currentDiagnostics.visibleOverlayCandidateCount) || 0
    );

    return {
      ...(initialDiagnostics || {}),
      ...(currentDiagnostics || {}),
      riskFlags,
      fixedStickyCandidateCount,
      fixedStickyCandidates: (currentDiagnostics.fixedStickyCandidates || []).length ?
        currentDiagnostics.fixedStickyCandidates :
        (initialDiagnostics.fixedStickyCandidates || []),
      visibleOverlayCandidateCount,
      visibleOverlayCandidates: (currentDiagnostics.visibleOverlayCandidates || []).length ?
        currentDiagnostics.visibleOverlayCandidates :
        (initialDiagnostics.visibleOverlayCandidates || [])
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
