self.CanvasTiler = class CanvasTiler {
  constructor({page, prefs, strategy}) {
    this.page = page;
    this.prefs = prefs;
    this.strategy = strategy;
    this.outputRatio = page.ratio;
    this.shellDrawn = false;
    this.lastDrawPosition = null;
    this.tiles = strategy.tiles.map(tile => {
      const canvas = new OffscreenCanvas(strategy.width, tile.height);
      const ctx = canvas.getContext('2d');
      const normalizedTile = {
        ...tile,
        canvas,
        ctx
      };
      this.fillTileBackground(normalizedTile);
      return normalizedTile;
    });
  }

  fillTileBackground(tile) {
    const backgroundColor = this.page.backgroundColor || '#ffffff';
    tile.ctx.save();
    tile.ctx.fillStyle = backgroundColor;
    tile.ctx.fillRect(0, 0, tile.canvas.width, tile.canvas.height);
    tile.ctx.restore();
  }

  async draw(blob, x, y) {
    const img = await createImageBitmap(blob);
    const scale = this.createScale(img);

    if (this.page.scrollTarget?.composeMode === 'app-shell' && this.page.captureArea) {
      if (!this.shellDrawn) {
        const viewportSource = this.createViewportSource(img, scale);
        this.drawIntoTiles(img, {
          x: viewportSource.x,
          y: viewportSource.y,
          width: viewportSource.width,
          height: viewportSource.height
        }, {
          x: 0,
          y: 0,
          width: this.toOutputWidth(viewportSource.width, scale),
          height: this.toOutputHeight(viewportSource.height, scale)
        });
        this.shellDrawn = true;
      }

      const source = {
        x: this.page.captureArea.x * scale.sourceX,
        y: this.page.captureArea.y * scale.sourceY,
        width: this.page.captureArea.width * scale.sourceX,
        height: this.page.captureArea.height * scale.sourceY
      };

      const crop = this.getOverlapCrop({x, y, source, scale});

      this.drawIntoTiles(img, {
        x: source.x + crop.sourceLeft,
        y: source.y + crop.sourceTop,
        width: source.width - crop.sourceLeft,
        height: source.height - crop.sourceTop
      }, {
        x: this.page.captureArea.x * scale.output + x * scale.output + crop.destinationLeft,
        y: this.page.captureArea.y * scale.output + y * scale.output + crop.destinationTop,
        width: this.toOutputWidth(source.width - crop.sourceLeft, scale),
        height: this.toOutputHeight(source.height - crop.sourceTop, scale)
      });
      return this.finishDraw({img, scale, x, y});
    }

    const source = this.page.captureArea ? {
      x: this.page.captureArea.x * scale.sourceX,
      y: this.page.captureArea.y * scale.sourceY,
      width: this.page.captureArea.width * scale.sourceX,
      height: this.page.captureArea.height * scale.sourceY
    } : this.createViewportSource(img, scale);

    const crop = this.getOverlapCrop({x, y, source, scale});

    this.drawIntoTiles(img, {
      x: source.x + crop.sourceLeft,
      y: source.y + crop.sourceTop,
      width: source.width - crop.sourceLeft,
      height: source.height - crop.sourceTop
    }, {
      x: x * scale.output + crop.destinationLeft,
      y: y * scale.output + crop.destinationTop,
      width: this.toOutputWidth(source.width - crop.sourceLeft, scale),
      height: this.toOutputHeight(source.height - crop.sourceTop, scale)
    });
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
	    if (!ranges.length || !self.SplitBoundaryPlanner) {
	      return defaultBoundary;
	    }

	    const planned = self.SplitBoundaryPlanner.chooseSafeSplitBoundary({
	      targetY: defaultBoundary,
	      minY: current,
	      maxY: defaultBoundary,
	      ranges,
	      candidates: this.normalizeSplitCandidates(),
	      searchWindowPx: Math.max(0, defaultBoundary - current)
	    });

	    return Number.isFinite(planned?.actualY) ? planned.actualY : defaultBoundary;
	  }

	  normalizeSplitCandidates() {
	    return (this.page.splitCandidates || [])
	      .map(value => Number(value))
	      .filter(value => Number.isFinite(value))
	      .sort((a, b) => a - b);
	  }

	  normalizeExclusionRanges() {
	    const capturePlanRanges = (this.page.capturePlan?.avoidRanges || [])
	      .map(range => ({
	        top: Number(range?.yStartCssPx),
	        bottom: Number(range?.yEndCssPx),
	        reason: range?.reason
	      }))
	      .filter(range =>
	        Number.isFinite(range.top) &&
	        Number.isFinite(range.bottom) &&
	        range.bottom > range.top
	      );
	    const legacyRanges = (this.page.splitExclusionRanges || [])
	      .map(range => ({
	        top: Number(range?.top),
	        bottom: Number(range?.bottom),
	        reason: range?.reason
	      }))
	      .filter(range =>
	        Number.isFinite(range.top) &&
	        Number.isFinite(range.bottom) &&
	        range.bottom > range.top
	      );

	    return (capturePlanRanges.length ? capturePlanRanges : legacyRanges)
	      .sort((a, b) => a.top - b.top);
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

  drawIntoTiles(img, source, destination) {
    for (const tile of this.tiles) {
      const intersection = this.intersect(destination, {
        x: 0,
        y: tile.y,
        width: this.strategy.width,
        height: tile.height
      });

      if (!intersection) {
        continue;
      }

      const sourceScaleX = source.width / destination.width;
      const sourceScaleY = source.height / destination.height;
      const sourceX = source.x + (intersection.x - destination.x) * sourceScaleX;
      const sourceY = source.y + (intersection.y - destination.y) * sourceScaleY;

      tile.ctx.drawImage(
        img,
        sourceX,
        sourceY,
        intersection.width * sourceScaleX,
        intersection.height * sourceScaleY,
        intersection.x,
        intersection.y - tile.y,
        intersection.width,
        intersection.height
      );
    }
  }

  intersect(a, b) {
    const x = Math.max(a.x, b.x);
    const y = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.width, b.x + b.width);
    const bottom = Math.min(a.y + a.height, b.y + b.height);

    if (right <= x || bottom <= y) {
      return null;
    }

    return {
      x,
      y,
      width: right - x,
      height: bottom - y
    };
  }

  async toFiles() {
    const pad = String(this.tiles.length).length;
    const files = [];

    for (const tile of this.tiles) {
      const blob = await tile.canvas.convertToBlob({
        type: 'image/' + this.prefs['format-canvas'],
        quality: this.prefs.quality
      });

      files.push({
        blob,
        suffix: `part-${String(tile.index + 1).padStart(Math.max(3, pad), '0')}`,
        index: tile.index,
        total: this.tiles.length,
        width: this.strategy.width,
        height: tile.height
      });
    }

    return files;
  }
};
