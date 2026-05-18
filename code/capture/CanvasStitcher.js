self.CanvasStitcher = class CanvasStitcher {
  constructor({page, prefs}) {
    this.page = page;
    this.prefs = prefs;
    this.outputRatio = page.ratio;
    this.canvas = new OffscreenCanvas(
      Math.ceil(page.width * page.ratio),
      Math.ceil(page.height * page.ratio)
    );
    this.ctx = this.canvas.getContext('2d');
    this.fillInitialBackground();
    this.shellDrawn = false;
    this.lastDrawPosition = null;
  }

  fillInitialBackground() {
    const backgroundColor = this.page.backgroundColor || '#ffffff';
    this.ctx.save();
    this.ctx.fillStyle = backgroundColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.restore();
  }

  async draw(blob, x, y) {
    const img = await createImageBitmap(blob);
    const scale = this.createScale(img);

    if (this.page.scrollTarget?.composeMode === 'app-shell' && this.page.captureArea) {
      if (!this.shellDrawn) {
        const viewportSource = this.createViewportSource(img, scale);
        const viewportDestination = this.createViewportDestination(viewportSource, scale);
        this.ctx.drawImage(
          img,
          viewportSource.x, viewportSource.y, viewportSource.width, viewportSource.height,
          viewportDestination.x, viewportDestination.y, viewportDestination.width, viewportDestination.height
        );
        this.shellDrawn = true;
      }

      const source = {
        x: this.page.captureArea.x * scale.sourceX,
        y: this.page.captureArea.y * scale.sourceY,
        width: this.page.captureArea.width * scale.sourceX,
        height: this.page.captureArea.height * scale.sourceY
      };

      const crop = this.getOverlapCrop({x, y, source, scale});

      this.ctx.drawImage(
        img,
        source.x + crop.sourceLeft,
        source.y + crop.sourceTop,
        source.width - crop.sourceLeft,
        source.height - crop.sourceTop,
        this.page.captureArea.x * scale.output + x * scale.output + crop.destinationLeft,
        this.page.captureArea.y * scale.output + y * scale.output + crop.destinationTop,
        this.toOutputWidth(source.width - crop.sourceLeft, scale),
        this.toOutputHeight(source.height - crop.sourceTop, scale)
      );
      return this.finishDraw({img, scale, x, y});
    }

    const source = this.page.captureArea ? {
      x: this.page.captureArea.x * scale.sourceX,
      y: this.page.captureArea.y * scale.sourceY,
      width: this.page.captureArea.width * scale.sourceX,
      height: this.page.captureArea.height * scale.sourceY
    } : this.createViewportSource(img, scale);

    const crop = this.getOverlapCrop({x, y, source, scale});

    this.ctx.drawImage(
      img,
      source.x + crop.sourceLeft,
      source.y + crop.sourceTop,
      source.width - crop.sourceLeft,
      source.height - crop.sourceTop,
      x * scale.output + crop.destinationLeft,
      y * scale.output + crop.destinationTop,
      this.toOutputWidth(source.width - crop.sourceLeft, scale),
      this.toOutputHeight(source.height - crop.sourceTop, scale)
    );
    return this.finishDraw({img, scale, x, y});
  }

  createScale(img) {
    const viewportWidth = Math.max(1, this.page.w || img.width / this.outputRatio);
    const viewportHeight = Math.max(1, this.page.h || img.height / this.outputRatio);
    const sourceScale = Math.min(img.width / viewportWidth, img.height / viewportHeight);

    return {
      sourceX: sourceScale,
      sourceY: sourceScale,
      output: this.outputRatio
    };
  }

  createViewportSource(img, scale) {
    const viewportWidth = Math.max(1, this.page.w || img.width / scale.sourceX);
    const viewportHeight = Math.max(1, this.page.h || img.height / scale.sourceY);

    return {
      x: 0,
      y: 0,
      width: Math.min(img.width, Math.ceil(viewportWidth * scale.sourceX)),
      height: Math.min(img.height, Math.ceil(viewportHeight * scale.sourceY))
    };
  }

  createViewportDestination(source, scale) {
    return {
      x: 0,
      y: 0,
      width: this.toOutputWidth(source.width, scale),
      height: this.toOutputHeight(source.height, scale)
    };
  }

	  getOverlapCrop({x, y, source, scale}) {
	    const overlap = Math.max(0, Number(this.prefs.offset) || 0);
	    const previous = this.lastDrawPosition;
	    const overlapX = x > 0 ?
	      this.getAxisOverlap({current: x, previous: previous?.x, viewportSize: this.page.w, fallback: overlap}) :
	      0;
	    const overlapY = y > 0 ?
	      this.getAxisOverlap({current: y, previous: previous?.y, viewportSize: this.page.h, fallback: overlap}) :
	      0;
	    const verticalBoundary = y > 0 ?
	      this.chooseVerticalSeamBoundary({
	        current: y,
	        defaultBoundary: y + overlapY
	      }) :
	      y;
	    const sourceLeft = x > 0 ?
	      Math.min(Math.round(overlapX * scale.sourceX), Math.max(0, source.width - 1)) :
	      0;
	    const sourceTop = y > 0 ?
	      Math.min(Math.round((verticalBoundary - y) * scale.sourceY), Math.max(0, source.height - 1)) :
	      0;

	    return {
	      sourceLeft,
	      sourceTop,
	      destinationLeft: Math.round(this.toOutputWidth(sourceLeft, scale)),
	      destinationTop: y > 0 ?
	        Math.round((verticalBoundary - y) * scale.output) :
	        Math.round(this.toOutputHeight(sourceTop, scale))
	    };
	  }

	  chooseVerticalSeamBoundary({current, defaultBoundary}) {
	    const ranges = this.normalizeExclusionRanges();
	    if (!ranges.length || !this.isInsideExclusion(defaultBoundary, ranges)) {
	      return defaultBoundary;
	    }

	    const candidates = [
	      ...this.normalizeSplitCandidates(),
	      ...ranges.flatMap(range => [range.top, range.bottom])
	    ]
	      .filter(boundary =>
	        Number.isFinite(boundary) &&
	        boundary >= current &&
	        boundary <= defaultBoundary &&
	        this.isAllowedSeamBoundary(boundary, ranges)
	      )
	      .sort((a, b) => Math.abs(defaultBoundary - a) - Math.abs(defaultBoundary - b));

	    return candidates[0] || defaultBoundary;
	  }

	  normalizeSplitCandidates() {
	    return (this.page.splitCandidates || [])
	      .map(value => Number(value))
	      .filter(value => Number.isFinite(value))
	      .sort((a, b) => a - b);
	  }

	  normalizeExclusionRanges() {
	    return (this.page.splitExclusionRanges || [])
	      .map(range => ({
	        top: Number(range?.top),
	        bottom: Number(range?.bottom),
	        reason: range?.reason
	      }))
	      .filter(range =>
	        Number.isFinite(range.top) &&
	        Number.isFinite(range.bottom) &&
	        range.bottom > range.top
	      )
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

  getAxisOverlap({current, previous, viewportSize, fallback}) {
    if (Number.isFinite(previous) && Number.isFinite(viewportSize) && viewportSize > 0) {
      return Math.max(0, previous + viewportSize - current);
    }

    return Math.max(fallback, Math.max(0, (viewportSize || 0) - current));
  }

  toOutputWidth(sourceWidth, scale) {
    return sourceWidth / scale.sourceX * scale.output;
  }

  toOutputHeight(sourceHeight, scale) {
    return sourceHeight / scale.sourceY * scale.output;
  }

  createDrawMetrics({img, scale, x, y}) {
    return {
      imageWidth: img.width,
      imageHeight: img.height,
      sourceScaleX: scale.sourceX,
      sourceScaleY: scale.sourceY,
      outputRatio: scale.output,
      x,
      y
    };
  }

  finishDraw({img, scale, x, y}) {
    this.lastDrawPosition = {x, y};
    return this.createDrawMetrics({img, scale, x, y});
  }

  async toBlob() {
    return this.canvas.convertToBlob({
      type: 'image/' + this.prefs['format-canvas'],
      quality: this.prefs.quality
    });
  }
};
