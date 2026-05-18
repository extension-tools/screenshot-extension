(function() {
  class ImageReadinessProbe {
    collect() {
      const visibleImages = Array.from(document.images)
        .filter(img => this.isVisibleRect(img.getBoundingClientRect()))
        .map(img => this.describeImage(img));
      const readyImages = visibleImages.filter(image => image.ready).length;
      const pendingImages = visibleImages.filter(image => image.pending).length;
      const pendingImagesWithSource = visibleImages.filter(image => image.pending && image.hasSource).length;
      const pendingImagesWithoutSource = visibleImages.filter(image => image.pending && !image.hasSource).length;
      const brokenImages = visibleImages.filter(image => image.broken).length;
      const placeholderBlocks = this.countVisiblePlaceholderBlocks();

      return {
        visibleImages: visibleImages.length,
        readyImages,
        pendingImages,
        pendingImagesWithSource,
        pendingImagesWithoutSource,
        brokenImages,
        placeholderBlocks,
        readinessRatio: visibleImages.length ? readyImages / visibleImages.length : 1
      };
    }

    describeImage(img) {
      const hasSource = Boolean(img.currentSrc || img.src);
      const ready = img.complete && img.naturalWidth > 0 && hasSource;
      const broken = img.complete && img.naturalWidth === 0 && hasSource;

      return {
        hasSource,
        ready,
        broken,
        pending: !ready && !broken
      };
    }

    countVisiblePlaceholderBlocks() {
      const viewportArea = (window.innerWidth || document.documentElement.clientWidth) *
        (window.innerHeight || document.documentElement.clientHeight);
      const elements = Array.from(document.body ? document.body.querySelectorAll('*') : [])
        .slice(0, 700);
      let count = 0;

      for (const element of elements) {
        const rect = element.getBoundingClientRect();
        if (!this.isVisibleRect(rect)) {
          continue;
        }

        const area = rect.width * rect.height;
        if (area < 5000 || area > viewportArea * 0.75) {
          continue;
        }

        if (this.hasReadyVisibleImage(element)) {
          continue;
        }

        const style = getComputedStyle(element);
        if (
          this.looksLikeSkeleton(element, style) ||
          this.isNeutralPlaceholderColor(style.backgroundColor)
        ) {
          count += 1;
        }
      }

      return count;
    }

    hasReadyVisibleImage(element) {
      return Array.from(element.querySelectorAll('img')).some(img => {
        return img.complete &&
          img.naturalWidth > 0 &&
          this.isVisibleRect(img.getBoundingClientRect());
      });
    }

    looksLikeSkeleton(element, style) {
      const text = [
        element.className,
        element.getAttribute('data-testid'),
        element.getAttribute('aria-label'),
        style.animationName
      ].join(' ').toLowerCase();

      return text.includes('skeleton') ||
        text.includes('placeholder') ||
        text.includes('loading') ||
        text.includes('shimmer');
    }

    isNeutralPlaceholderColor(value) {
      const match = String(value).match(/rgba?\(([^)]+)\)/);
      if (!match) {
        return false;
      }

      const [r, g, b, a = 1] = match[1]
        .split(',')
        .map(part => Number.parseFloat(part.trim()));

      if (!Number.isFinite(r) || !Number.isFinite(g) || !Number.isFinite(b) || a === 0) {
        return false;
      }

      const spread = Math.max(r, g, b) - Math.min(r, g, b);
      return spread <= 8 && r >= 215 && r <= 248;
    }

    isVisibleRect(rect) {
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      return rect.width > 1 &&
        rect.height > 1 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < viewportHeight &&
        rect.left < viewportWidth;
    }
  }

  globalThis.ScreenshotExtensionImageReadinessProbe = ImageReadinessProbe;
})();
