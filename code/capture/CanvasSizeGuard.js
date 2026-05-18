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
    const exclusionRanges = (page.splitExclusionRanges || [])
      .map(range => ({
        top: Math.round(range.top * page.ratio),
        bottom: Math.round(range.bottom * page.ratio),
        reason: range.reason
      }))
      .filter(range => Number.isFinite(range.top) && Number.isFinite(range.bottom) && range.bottom > range.top)
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
    const searchWindow = Math.min(2400, Math.max(720, Math.floor(tilePixelHeight * 0.18)));
    const minBoundary = y + minHeight;
    const maxBoundary = hardLimit;
    const preferredStart = Math.max(minBoundary, hardLimit - searchWindow);
    const remainingAfterHardLimit = height - hardLimit;

    if (remainingAfterHardLimit > 0 && remainingAfterHardLimit < minHeight) {
      return hardLimit;
    }

    const blockingRange = exclusionRanges.find(range =>
      hardLimit > range.top &&
      hardLimit < range.bottom &&
      range.bottom - range.top < tilePixelHeight
    );

    if (blockingRange && blockingRange.top >= minBoundary) {
      const beforeRange = candidates
        .filter(candidate =>
          candidate >= minBoundary &&
          candidate <= blockingRange.top &&
          !this.isInsideExclusion(candidate, exclusionRanges)
        )
        .sort((a, b) => Math.abs(blockingRange.top - a) - Math.abs(blockingRange.top - b))[0];

      return beforeRange || blockingRange.top;
    }

    const nearby = candidates
      .filter(candidate =>
        candidate >= preferredStart &&
        candidate <= maxBoundary &&
        !this.isInsideExclusion(candidate, exclusionRanges)
      )
      .sort((a, b) => Math.abs(hardLimit - a) - Math.abs(hardLimit - b))[0];

    return nearby || hardLimit;
  }

  isInsideExclusion(value, exclusionRanges) {
    return exclusionRanges.some(range => value > range.top && value < range.bottom);
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
