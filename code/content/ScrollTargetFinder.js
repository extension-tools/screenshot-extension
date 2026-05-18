(function() {
  class ScrollTargetFinder {
    findMainInternalScrollContainer() {
      if (!document.body) {
        return null;
      }

      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const viewportArea = viewportWidth * viewportHeight;
      const minArea = viewportArea * 0.3;
      const minScrollableY = Math.max(80, Math.min(160, viewportHeight * 0.2));
      let best = null;

      for (const element of document.body.querySelectorAll('*')) {
        if (this.shouldSkipElement(element)) {
          continue;
        }

        const style = getComputedStyle(element);
        if (!this.hasScrollableOverflow(element, style)) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        const visibleArea = this.visibleArea(rect, viewportWidth, viewportHeight);
        const scrollableY = Math.max(0, element.scrollHeight - element.clientHeight);

        if (
          visibleArea < minArea ||
          rect.width < viewportWidth * 0.35 ||
          rect.height < viewportHeight * 0.35 ||
          scrollableY < minScrollableY
        ) {
          continue;
        }

        const score = visibleArea + scrollableY * viewportWidth;

        if (!best || score > best.score) {
          best = {
            element,
            score
          };
        }
      }

      return best ? best.element : null;
    }

    shouldSkipElement(element) {
      const tagName = element.tagName;

      return tagName === 'HTML' ||
        tagName === 'BODY' ||
        tagName === 'TEXTAREA' ||
        tagName === 'INPUT' ||
        tagName === 'SELECT' ||
        tagName === 'IFRAME' ||
        element.isContentEditable;
    }

    hasScrollableOverflow(element, style) {
      const overflowY = style.overflowY;
      const overflowX = style.overflowX;
      const canScrollY = ['auto', 'scroll', 'overlay'].includes(overflowY) &&
        element.scrollHeight > element.clientHeight + 1;
      const canScrollX = ['auto', 'scroll', 'overlay'].includes(overflowX) &&
        element.scrollWidth > element.clientWidth + 1;

      return canScrollY || canScrollX;
    }

    visibleArea(rect, viewportWidth, viewportHeight) {
      const width = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
      const height = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));

      return width * height;
    }
  }

  globalThis.ScreenshotExtensionScrollTargetFinder = ScrollTargetFinder;
})();
