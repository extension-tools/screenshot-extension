self.CaptureDiagnostics = class CaptureDiagnostics {
  create({tab, prefs}) {
    return {
      version: 2,
      status: 'running',
      command: 'capture-entire',
      startedAt: new Date().toISOString(),
      tab: {
        id: tab?.id || null,
        url: tab?.url || null,
        title: tab?.title || null
      },
      prefs: {
        format: prefs.format,
        canvasFormat: prefs['format-canvas'],
        quality: prefs.quality,
        offset: prefs.offset,
        delay: prefs.delay,
        stabilizationTimeout: prefs.stabilizationTimeout,
        lazyWarmupEnabled: prefs.lazyWarmupEnabled,
        lazyWarmupTimeout: prefs.lazyWarmupTimeout
      },
      page: null,
      output: null,
      scrollTarget: null,
      singleFileExportAttempt: null,
      imageReadinessSummary: null,
      export: {
        status: 'not_started',
        files: [],
        errors: []
      },
      failureReason: null,
      errorMessage: null,
      completedAt: null
    };
  }

  attachPage(diagnostics, page, stage) {
    const pageInfo = {
      stage,
      cssWidth: page.width,
      cssHeight: page.height,
      viewportWidth: page.w,
      viewportHeight: page.h,
      dpr: page.ratio,
      bitmapWidth: Math.ceil(page.width * page.ratio),
      bitmapHeight: Math.ceil(page.height * page.ratio),
      scroll: {
        x: page.x,
        y: page.y,
        windowX: page.windowX,
        windowY: page.windowY
      },
      capturePolicy: page.capturePolicy || page.diagnostics?.capturePolicy || null
    };

    if (!diagnostics.initialPage) {
      diagnostics.initialPage = pageInfo;
    }

    diagnostics.page = pageInfo;
    diagnostics.scrollTarget = {
      type: page.scrollTarget?.type || 'window',
      composeMode: page.scrollTarget?.composeMode || null,
      candidateCount: page.scrollTarget?.candidateCount || page.diagnostics?.internalScrollCandidateCount || 0,
      diagnostics: page.diagnostics || null,
      capturePolicy: page.capturePolicy || page.diagnostics?.capturePolicy || null,
      captureArea: page.captureArea || null
    };
  }

  attachStrategy(diagnostics, strategy, page) {
    diagnostics.output = {
      strategy: strategy.mode,
      bitmapWidth: strategy.width,
      bitmapHeight: strategy.height,
      bitmapArea: strategy.area,
      dpr: page?.ratio || diagnostics.page?.dpr || null,
      tileCount: strategy.tileCount || 1,
      tilePixelHeight: strategy.tilePixelHeight || null,
      maxTileHeight: strategy.tiles ? Math.max(...strategy.tiles.map(tile => tile.height)) : strategy.height
    };
  }

  attachSingleFileExportAttempt(diagnostics, attempt) {
    diagnostics.singleFileExportAttempt = attempt;
  }

  attachImageReadinessSummary(diagnostics, legacyDiagnostics) {
    const imageReadiness = legacyDiagnostics.imageReadiness || {};
    const frames = legacyDiagnostics.stepper?.frames || [];
    const frameReadiness = frames
      .map(frame => ({
        frameIndex: frame.frameIndex,
        imageReadiness: frame.imageReadiness
      }))
      .filter(frame => frame.imageReadiness);
    const worstFrame = frameReadiness
      .slice()
      .sort((a, b) => {
        const aScore = this.pendingScore(a.imageReadiness);
        const bScore = this.pendingScore(b.imageReadiness);
        return bScore - aScore;
      })[0] || null;

    diagnostics.imageReadinessSummary = {
      beforeWarmup: imageReadiness.beforeWarmup || null,
      afterWarmup: imageReadiness.afterWarmup || null,
      frameCount: frameReadiness.length,
      worstFrame
    };
  }

  attachExportStatus(diagnostics, status) {
    diagnostics.export = status;
  }

  markSuccess(diagnostics) {
    diagnostics.status = 'success';
    diagnostics.completedAt = new Date().toISOString();
  }

  markFailure(diagnostics, error) {
    diagnostics.status = 'failed';
    diagnostics.failureReason = this.classifyFailure(error);
    diagnostics.errorMessage = error?.message || String(error);
    diagnostics.completedAt = new Date().toISOString();

    if (diagnostics.export?.status === 'not_started') {
      diagnostics.export.status = 'not_started';
    }
  }

  pendingScore(readiness) {
    return (readiness.pendingImages || 0) +
      (readiness.brokenImages || 0) +
      (readiness.placeholderBlocks || 0);
  }

  classifyFailure(error) {
    const message = String(error?.message || error || '').toLowerCase();

    if (message.includes('browser page cannot be captured')) {
      return 'unsupported_url';
    }

    if (message.includes('too wide')) {
      return 'too_wide_for_vertical_tiling';
    }

    if (message.includes('would require') && message.includes('image parts')) {
      return 'too_many_output_parts';
    }

    if (message.includes('too large')) {
      return 'too_large_for_supported_output';
    }

    if (message.includes('capturevisibletab') || message.includes('capture visible tab')) {
      return 'capture_visible_tab_failed';
    }

    if (message.includes('scroll target did not move')) {
      return 'scroll_target_stuck';
    }

    if (message.includes('download')) {
      return 'download_failed';
    }

    if (message.includes('content') || message.includes('script')) {
      return 'content_script_failed';
    }

    return 'unknown';
  }
};
