self.CanvasSizeGuard = class CanvasSizeGuard {
  constructor({
    maxDimension = 16384,
    maxArea = 100000000,
    maxOutputTiles = 20
  } = {}) {
    this.maxDimension = maxDimension;
    this.maxArea = maxArea;
    this.maxOutputTiles = maxOutputTiles;
  }

  measureOutput(page) {
    const width = Math.ceil(page.width * page.ratio);
    const height = Math.ceil(page.height * page.ratio);
    const area = width * height;

    return {width, height, area};
  }

  createStrategy(page) {
    const output = this.measureOutput(page);
    const {width, height, area} = output;

    if (width <= this.maxDimension && height <= this.maxDimension && area <= this.maxArea) {
      return {
        mode: 'single-canvas',
        ...output
      };
    }

    if (width > this.maxDimension) {
      throw new Error(
        'This page is too wide to capture with vertical tiling. ' +
        `Output would be ${width}x${height}px.`
      );
    }

    const tilePixelHeight = Math.min(this.maxDimension, Math.floor(this.maxArea / width));
    if (tilePixelHeight <= 0) {
      throw new Error(
        'This page is too large to capture safely. ' +
        `Output would be ${width}x${height}px.`
      );
    }

    const tiles = this.createTiles({page, height, tilePixelHeight});
    if (tiles.length > this.maxOutputTiles) {
      throw new Error(
        'This page is too large to capture safely. ' +
        `Output would require ${tiles.length} image parts. ` +
        `Current limit is ${this.maxOutputTiles} parts.`
      );
    }

    return {
      mode: 'tiled-output',
      ...output,
      tilePixelHeight,
      tileCount: tiles.length,
      tiles
    };
  }

  createTiles({page, height, tilePixelHeight}) {
    const candidates = (page.splitCandidates || [])
      .map(value => Math.round(value * page.ratio))
      .filter(value => Number.isFinite(value) && value > 0 && value < height)
      .sort((a, b) => a - b);
    const capturePlanRanges = (page.capturePlan?.avoidRanges || [])
      .map(range => ({
        top: Math.round(range.yStartCssPx * page.ratio),
        bottom: Math.round(range.yEndCssPx * page.ratio),
        reason: range.reason
      }))
      .filter(range => Number.isFinite(range.top) && Number.isFinite(range.bottom) && range.bottom > range.top);
    const legacyRanges = (page.splitExclusionRanges || [])
      .map(range => ({
        top: Math.round(range.top * page.ratio),
        bottom: Math.round(range.bottom * page.ratio),
        reason: range.reason
      }))
      .filter(range => Number.isFinite(range.top) && Number.isFinite(range.bottom) && range.bottom > range.top);
    const exclusionRanges = (capturePlanRanges.length ? capturePlanRanges : legacyRanges)
      .sort((a, b) => a.top - b.top);
    const tiles = [];
    let y = 0;

    while (y < height) {
      const hardLimit = Math.min(height, y + tilePixelHeight);
      const boundary = hardLimit >= height ?
        height :
        this.findSafeBoundary({
          y,
          hardLimit,
          height,
          tilePixelHeight,
          candidates,
          exclusionRanges
        });

      tiles.push({
        index: tiles.length,
        y,
        height: boundary - y
      });
      y = boundary;
    }

    return tiles;
  }

  findSafeBoundary({y, hardLimit, height, tilePixelHeight, candidates, exclusionRanges = []}) {
    const minHeight = Math.max(1200, Math.floor(tilePixelHeight * 0.45));
    const minBoundary = y + minHeight;
    const maxBoundary = hardLimit;
    const remainingAfterHardLimit = height - hardLimit;

    if (remainingAfterHardLimit > 0 && remainingAfterHardLimit < minHeight) {
      return hardLimit;
    }

    if (!self.SplitBoundaryPlanner) {
      return hardLimit;
    }

    const planned = self.SplitBoundaryPlanner.chooseSafeSplitBoundary({
      targetY: hardLimit,
      minY: minBoundary,
      maxY: maxBoundary,
      ranges: exclusionRanges,
      candidates,
      searchWindowPx: Math.max(0, hardLimit - minBoundary)
    });

    return Number.isFinite(planned?.actualY) ? planned.actualY : hardLimit;
  }

  assertCanCreateSingleCanvas(page) {
    const {width, height, area} = this.measureOutput(page);

    if (width > this.maxDimension || height > this.maxDimension || area > this.maxArea) {
      throw new Error(
        'This page is too large to capture as one image. ' +
        `Output would be ${width}x${height}px. ` +
        'The tiled-output path should be used for supported tall pages.'
      );
    }

    return {
      width,
      height,
      area
    };
  }
};
