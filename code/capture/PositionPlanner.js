self.PositionPlanner = class PositionPlanner {
  constructor({offset}) {
    this.offset = offset;
  }

	  createPlan(page) {
	    const positions = [];
	    const xPositions = this.createAxisPositions(
	      page.scrollPlanWidth || page.width,
	      page.scrollPlanViewportWidth || page.w
	    );
	    const yPlan = this.createYAxisPlan(
	      page.scrollPlanHeight || page.height,
	      page.scrollPlanViewportHeight || page.h,
	      page
	    );

    for (const x of xPositions) {
      for (const y of yPlan.positions) {
        positions.push({x, y});
      }
    }

    return {
      positions,
      total: positions.length,
      splitBoundaryDiagnostics: yPlan.splitBoundaryDiagnostics
    };
  }

  createAxisPositions(totalSize, viewportSize) {
    const max = Math.max(0, totalSize - viewportSize);
    const offset = Number.isFinite(Number(this.offset)) ? Number(this.offset) : 50;
    const safeOffset = Math.min(Math.max(0, offset), Math.max(0, viewportSize - 1));
    const step = Math.max(1, viewportSize - safeOffset);
    const positions = [0];

    for (let position = step; position < max; position += step) {
      positions.push(position);
    }

    if (positions[positions.length - 1] !== max) {
      positions.push(max);
    }

	    return positions;
	  }

	  createYAxisPositions(totalSize, viewportSize, page = {}) {
	    return this.createYAxisPlan(totalSize, viewportSize, page).positions;
	  }

	  createYAxisPlan(totalSize, viewportSize, page = {}) {
	    const ranges = self.SplitBoundaryPlanner.normalizeCapturePlanRanges(page, totalSize);
	    if (!ranges.length) {
	      return {
	        positions: this.createAxisPositions(totalSize, viewportSize),
	        splitBoundaryDiagnostics: []
	      };
	    }

	    const max = Math.max(0, totalSize - viewportSize);
	    const offset = Number.isFinite(Number(this.offset)) ? Number(this.offset) : 50;
	    const safeOffset = Math.min(Math.max(0, offset), Math.max(0, viewportSize - 1));
	    const step = Math.max(1, viewportSize - safeOffset);
	    const minProgress = Math.max(120, Math.min(step, Math.floor(viewportSize * 0.25)));
	    const maxExtraOverlap = Math.max(safeOffset, Math.min(Math.floor(viewportSize * 0.55), 520));
	    const candidates = this.normalizeSplitCandidates(page.splitCandidates, totalSize);
	    const positions = [0];
	    const splitBoundaryDiagnostics = [];
	    let guard = 0;

	    while (positions[positions.length - 1] < max && guard < 10000) {
	      guard += 1;
	      const previous = positions[positions.length - 1];
	      const proposed = Math.min(max, previous + step);
	      const adjusted = this.adjustPositionForSafeSeam({
	        previous,
	        proposed,
	        max,
	        viewportSize,
	        safeOffset,
	        minProgress,
	        maxExtraOverlap,
	        candidates,
	        ranges
	      });
	      splitBoundaryDiagnostics.push(adjusted.diagnostics);

	      if (adjusted.position >= max) {
	        positions.push(max);
	        break;
	      }

	      if (adjusted.position <= previous) {
	        positions.push(Math.min(max, previous + step));
	        continue;
	      }

	      positions.push(adjusted.position);
	    }

	    if (positions[positions.length - 1] !== max) {
	      positions.push(max);
	    }

	    return {
	      positions: positions.filter((position, index, list) => index === 0 || position > list[index - 1]),
	      splitBoundaryDiagnostics
	    };
	  }

	  adjustPositionForSafeSeam({
	    previous,
	    proposed,
	    max,
	    viewportSize,
	    safeOffset,
	    minProgress,
	    maxExtraOverlap,
	    candidates,
	    ranges
	  }) {
	    const targetBoundary = previous + viewportSize;

	    if (proposed <= previous || proposed >= max) {
	      return {
	        position: proposed,
	        diagnostics: self.SplitBoundaryPlanner.createBoundaryDiagnostic({
	          targetY: targetBoundary,
	          actualY: targetBoundary,
	          severity: 'safe',
	          confidence: 0.9,
	          reason: proposed >= max ? 'last-frame' : 'no-adjustment'
	        })
	      };
	    }

	    const lowerPositionLimit = previous + minProgress;
	    const safeBoundary = self.SplitBoundaryPlanner.chooseSafeSplitBoundary({
	      targetY: targetBoundary,
	      minY: lowerPositionLimit + safeOffset,
	      maxY: targetBoundary,
	      ranges,
	      candidates,
	      searchWindowPx: maxExtraOverlap
	    });
	    const adjusted = Math.min(
	      proposed,
	      Math.max(lowerPositionLimit, Math.floor(safeBoundary.actualY - Math.max(1, safeOffset)))
	    );

	    if (adjusted <= previous || adjusted > proposed) {
	      return {
	        position: proposed,
	        diagnostics: self.SplitBoundaryPlanner.createBoundaryDiagnostic({
	          targetY: targetBoundary,
	          actualY: targetBoundary,
	          severity: safeBoundary.severity,
	          confidence: 0.25,
	          reason: 'safe-boundary-out-of-position-limits'
	        })
	      };
	    }

	    return {
	      position: adjusted,
	      diagnostics: self.SplitBoundaryPlanner.createBoundaryDiagnostic({
	        targetY: targetBoundary,
	        actualY: safeBoundary.actualY,
	        severity: safeBoundary.severity,
	        confidence: safeBoundary.confidence,
	        reason: safeBoundary.reason
	      })
	    };
	  }

	  normalizeSplitCandidates(values = [], totalSize) {
	    return values
	      .map(value => Number(value))
	      .filter(value => Number.isFinite(value) && value > 0 && value < totalSize)
	      .sort((a, b) => a - b);
	  }

	  isInsideExclusion(value, ranges) {
	    return ranges.some(range => value > range.top && value < range.bottom);
	  }

	  isAllowedSeamBoundary(value, ranges) {
	    if (!this.isInsideExclusion(value, ranges)) {
	      return true;
	    }

	    const isRangeEdge = ranges.some(range => value === range.top || value === range.bottom);
	    if (!isRangeEdge) {
	      return false;
	    }

	    return !ranges.some(range =>
	      range.reason === 'split-sensitive-block' &&
	      value > range.top &&
	      value < range.bottom
	    );
	  }
	};
