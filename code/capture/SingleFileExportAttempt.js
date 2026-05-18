self.SingleFileExportAttempt = class SingleFileExportAttempt {
  evaluate({strategy, prefs}) {
    const format = prefs['format-canvas'] || prefs.format || 'png';
    const base = {
      format,
      strategyMode: strategy.mode,
      bitmapWidth: strategy.width,
      bitmapHeight: strategy.height,
      tileCount: strategy.tileCount || 1,
      attemptedAt: new Date().toISOString()
    };

    if (strategy.mode === 'single-canvas') {
      return {
        ...base,
        decision: 'single-file',
        safe: true,
        attempted: true,
        reason: 'single_canvas_within_limits'
      };
    }

    if (strategy.mode === 'tiled-output') {
      return {
        ...base,
        decision: 'parts',
        safe: false,
        attempted: false,
        reason: 'single_canvas_exceeds_limits',
        fallback: 'multi_png_parts'
      };
    }

    return {
      ...base,
      decision: 'unsupported',
      safe: false,
      attempted: false,
      reason: 'unsupported_strategy'
    };
  }
};
