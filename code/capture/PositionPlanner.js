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
	    const yPositions = this.createYAxisPositions(
	      page.scrollPlanHeight || page.height,
	      page.scrollPlanViewportHeight || page.h,
	      page
	    );

    for (const x of xPositions) {
      for (const y of yPositions) {
        positions.push({x, y});
      }
    }

    return {
      positions,
      total: positions.length
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
	    const ranges = this.normalizeExclusionRanges(page.splitExclusionRanges, totalSize);
	    if (!ranges.length) {
	      return this.createAxisPositions(totalSize, viewportSize);
	    }

	    const max = Math.max(0, totalSize - viewportSize);
	    const offset = Number.isFinite(Number(this.offset)) ? Number(this.offset) : 50;
	    const safeOffset = Math.min(Math.max(0, offset), Math.max(0, viewportSize - 1));
	    const step = Math.max(1, viewportSize - safeOffset);
	    const minProgress = Math.max(120, Math.min(step, Math.floor(viewportSize * 0.25)));
	    const maxExtraOverlap = Math.max(safeOffset, Math.min(Math.floor(viewportSize * 0.55), 520));
	    const candidates = this.normalizeSplitCandidates(page.splitCandidates, totalSize);
	    const positions = [0];
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

	      if (adjusted >= max) {
	        positions.push(max);
	        break;
	      }

	      if (adjusted <= previous) {
	        positions.push(Math.min(max, previous + step));
	        continue;
	      }

	      positions.push(adjusted);
	    }

	    if (positions[positions.length - 1] !== max) {
	      positions.push(max);
	    }

	    return positions.filter((position, index, list) => index === 0 || position > list[index - 1]);
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
	    if (proposed <= previous || proposed >= max) {
	      return proposed;
	    }

	    const defaultBoundary = previous + viewportSize;
	    const blockingRange = ranges.find(range => this.isInsideExclusion(defaultBoundary, [range]));
	    if (!blockingRange) {
	      return proposed;
	    }

	    const lowerPositionLimit = previous + minProgress;
	    const preferredBoundaries = [
	      ...candidates,
	      blockingRange.top,
	      blockingRange.bottom,
	      ...ranges.flatMap(range => [range.top, range.bottom])
	    ]
	      .filter(boundary =>
	        Number.isFinite(boundary) &&
	        boundary > previous &&
	        boundary <= defaultBoundary &&
	        this.isAllowedSeamBoundary(boundary, ranges)
	      )
	      .sort((a, b) => Math.abs(defaultBoundary - a) - Math.abs(defaultBoundary - b));

	    for (const boundary of preferredBoundaries) {
	      if (defaultBoundary - boundary > maxExtraOverlap) {
	        continue;
	      }

	      const adjusted = Math.min(
	        proposed,
	        Math.max(lowerPositionLimit, Math.floor(boundary - Math.max(1, safeOffset)))
	      );

	      if (adjusted > previous && adjusted <= proposed && adjusted <= boundary) {
	        return adjusted;
	      }
	    }

	    return proposed;
	  }

	  normalizeSplitCandidates(values = [], totalSize) {
	    return values
	      .map(value => Number(value))
	      .filter(value => Number.isFinite(value) && value > 0 && value < totalSize)
	      .sort((a, b) => a - b);
	  }

	  normalizeExclusionRanges(values = [], totalSize) {
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
