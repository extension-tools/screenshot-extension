self.SplitBoundaryPlanner = class SplitBoundaryPlanner {
  static get DEFAULTS() {
    return {
      stepPx: 8,
      searchWindowPx: 240,
      hardPenalty: 10000,
      softPenalty: 1200,
      movePenaltyPerPx: 0.15,
      safeReward: 1000,
      minHardInsetPx: 24,
      maxHardInsetPx: 96,
      hardInsetRatio: 0.2,
      edgeBufferPx: 80,
      maxEdgeBufferPx: 160,
      edgeBufferRatio: 0.12
    };
  }

  static chooseSafeSplitBoundary({
    targetY,
    minY,
    maxY,
    ranges,
    candidates = [],
    searchWindowPx = this.DEFAULTS.searchWindowPx
  }) {
    const lower = Math.max(minY, targetY - searchWindowPx);
    const upper = Math.min(maxY, targetY + searchWindowPx);
    const values = new Set();

    values.add(Math.round(targetY));

    for (const candidate of candidates || []) {
      if (candidate >= lower && candidate <= upper) {
        values.add(Math.round(candidate));
      }
    }

    for (const range of ranges || []) {
      const edgeBuffer = this.getRangeEdgeBuffer(range);
      for (const edge of [
        range.top,
        range.bottom,
        Number(range.top) - edgeBuffer,
        Number(range.bottom) + edgeBuffer
      ]) {
        if (edge >= lower && edge <= upper) {
          values.add(Math.round(edge));
        }
      }
    }

    for (let y = Math.floor(lower); y <= upper; y += this.DEFAULTS.stepPx) {
      values.add(y);
    }

    let best = null;

    for (const y of values) {
      if (!Number.isFinite(y) || y < lower || y > upper) {
        continue;
      }

      const score = this.scoreSplitBoundary(y, targetY, ranges);
      if (!best || score.total > best.score.total) {
        best = {actualY: y, score};
      }
    }

    if (!best) {
      return {
        actualY: targetY,
        severity: 'unknown',
        confidence: 0,
        reason: 'no-boundary-candidates'
      };
    }

    return {
      actualY: best.actualY,
      severity: best.score.severity,
      confidence: best.score.confidence,
      reason: best.score.reason
    };
  }

  static scoreSplitBoundary(y, targetY, ranges) {
    let hardCutCount = 0;
    let softRiskCount = 0;

    for (const range of ranges || []) {
      const top = Number(range.top);
      const bottom = Number(range.bottom);
      const height = bottom - top;

      if (!Number.isFinite(top) || !Number.isFinite(bottom) || height <= 0) {
        continue;
      }

      const edgeBuffer = this.getRangeEdgeBuffer(range);
      const nearRange = y > top - edgeBuffer && y < bottom + edgeBuffer;
      if (!nearRange) {
        continue;
      }

      const insideRange = y > top && y < bottom;
      const hardInset = Math.min(
        this.DEFAULTS.maxHardInsetPx,
        Math.max(this.DEFAULTS.minHardInsetPx, height * this.DEFAULTS.hardInsetRatio)
      );
      const deepInside = y > top + hardInset && y < bottom - hardInset;

      if (deepInside) {
        hardCutCount += 1;
      }
      else if (insideRange) {
        softRiskCount += 2;
      }
      else {
        softRiskCount += 1;
      }
    }

    const movePenalty = Math.abs(y - targetY) * this.DEFAULTS.movePenaltyPerPx;
    const hardPenalty = hardCutCount * this.DEFAULTS.hardPenalty;
    const softPenalty = softRiskCount * this.DEFAULTS.softPenalty;
    const safeReward = hardCutCount === 0 && softRiskCount === 0 ? this.DEFAULTS.safeReward : 0;
    const total = safeReward - hardPenalty - softPenalty - movePenalty;

    if (hardCutCount > 0) {
      return {
        total,
        severity: 'hard_cut',
        confidence: 0.2,
        reason: 'inside-avoid-range'
      };
    }

    if (softRiskCount > 0) {
      return {
        total,
        severity: 'soft_risk',
        confidence: 0.55,
        reason: 'near-avoid-range-edge'
      };
    }

    return {
      total,
      severity: 'safe',
      confidence: 0.9,
      reason: 'between-avoid-ranges'
    };
  }

  static getRangeEdgeBuffer(range) {
    const top = Number(range?.top);
    const bottom = Number(range?.bottom);
    const height = bottom - top;

    if (!Number.isFinite(height) || height <= 0) {
      return this.DEFAULTS.edgeBufferPx;
    }

    return Math.min(
      this.DEFAULTS.maxEdgeBufferPx,
      Math.max(this.DEFAULTS.edgeBufferPx, height * this.DEFAULTS.edgeBufferRatio)
    );
  }

  static createBoundaryDiagnostic({targetY, actualY, severity, confidence, reason}) {
    return {
      targetY: Math.round(targetY),
      actualY: Math.round(actualY),
      shiftPx: Math.round(actualY - targetY),
      severity,
      confidence,
      reason
    };
  }

  static normalizeCapturePlanRanges(page = {}, totalSize) {
    const capturePlanRanges = (page.capturePlan?.avoidRanges || [])
      .map(range => ({
        top: Number(range?.yStartCssPx),
        bottom: Number(range?.yEndCssPx),
        reason: range?.reason
      }));
    const normalizedCapturePlanRanges = this.normalizeExclusionRanges(capturePlanRanges, totalSize);

    if (normalizedCapturePlanRanges.length) {
      return normalizedCapturePlanRanges;
    }

    return this.normalizeExclusionRanges(page.splitExclusionRanges, totalSize);
  }

  static normalizeExclusionRanges(values = [], totalSize) {
    return values
      .map(range => ({
        top: Number(range?.top),
        bottom: Number(range?.bottom),
        reason: range?.reason
      }))
      .filter(range =>
        Number.isFinite(range.top) &&
        Number.isFinite(range.bottom) &&
        range.bottom > range.top &&
        range.bottom > 0 &&
        range.top < totalSize
      )
      .map(range => ({
        ...range,
        top: Math.max(0, range.top),
        bottom: Math.min(totalSize, range.bottom)
      }))
      .sort((a, b) => a.top - b.top);
  }
};
