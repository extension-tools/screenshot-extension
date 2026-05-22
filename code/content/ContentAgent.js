(function() {
  class ContentAgent {
    constructor() {
      this.stack = null;
      this.captureId = null;
      this.capturePolicy = null;
      this.fixedStickyNormalizer = null;
      this.scrollbarNormalizer = null;
      this.imageReadinessProbe = new globalThis.ScreenshotExtensionImageReadinessProbe();
    }

    prepareCapture(options = {}) {
      this.cleanupCapture();

      this.captureId = options.captureId || String(Date.now());
      this.capturePolicy = options.capturePolicy || null;
      this.stack = new globalThis.ScreenshotExtensionDomMutationStack();
      this.scrollbarNormalizer = new globalThis.ScreenshotExtensionScrollbarNormalizer({
        stack: this.stack
      });
      this.fixedStickyNormalizer = new globalThis.ScreenshotExtensionFixedStickyNormalizer({
        stack: this.stack
      });
      const stability = this.prepareStabilityNormalization({
        preserveFixedBackground: Boolean(this.capturePolicy?.quirks?.preserveFixedBackground),
        fixedBackgroundAttribute: this.capturePolicy?.quirks?.fixedBackgroundAttribute ||
          'data-screenshot-extension-quirk-fixed-background'
      });
      const scrollbar = this.scrollbarNormalizer.prepare();

      return {
        captureId: this.captureId,
        stability,
        scrollbar,
        mutations: this.stack.count()
      };
    }

    normalizeStickyForCapture(options = {}) {
      if (!this.stack || !this.fixedStickyNormalizer) {
        return {
          applied: false,
          normalized: 0,
          reason: 'missing-prepare'
        };
      }

      if (options.capturePolicy) {
        this.capturePolicy = options.capturePolicy;
      }

      const stickyNormalization = this.fixedStickyNormalizer.prepareStickyNormalization({
        capturePolicy: this.capturePolicy
      });

      return {
        stickyNormalization,
        mutations: this.stack.count()
      };
    }

    prepareStabilityNormalization(options = {}) {
      if (!document.documentElement) {
        return {applied: false};
      }

      const preserveFixedBackground = Boolean(options.preserveFixedBackground);
      const fixedBackgroundAttribute = options.fixedBackgroundAttribute ||
        'data-screenshot-extension-quirk-fixed-background';
      const backgroundAttachmentSelector = preserveFixedBackground ?
        `*:not([${fixedBackgroundAttribute}]),\n        *:not([${fixedBackgroundAttribute}])::before,\n        *:not([${fixedBackgroundAttribute}])::after` :
        '*,\n        *::before,\n        *::after';
      const style = document.createElement('style');
      style.setAttribute('data-screenshot-extension-stability', 'true');
      style.textContent = `
        html,
        body,
        * {
          scroll-behavior: auto !important;
        }

        *,
        *::before,
        *::after {
          transition-property: none !important;
          transition-duration: 0s !important;
          transition-delay: 0s !important;
        }

        ${backgroundAttachmentSelector} {
          background-attachment: scroll !important;
        }
      `;

      this.stack.appendNode(document.head || document.documentElement, style);
      return {
        applied: true,
        preserveFixedBackground,
        fixedBackgroundAttribute
      };
    }

    beforeFrame(options = {}) {
      if (!this.fixedStickyNormalizer) {
        return {
          hidden: 0,
          mutations: this.stack ? this.stack.count() : 0
        };
      }

      const result = this.fixedStickyNormalizer.beforeFrame({
        ...options,
        capturePolicy: options.capturePolicy || this.capturePolicy
      });

      return {
        ...result,
        mutations: this.stack ? this.stack.count() : 0
      };
    }

    async waitForStableLayout(options = {}) {
      const timeoutMs = options.timeoutMs || 500;
      const started = performance.now();

      await this.waitAnimationFrames(options.frameCount || 2);

      const fontResult = await this.waitForFonts(this.remainingMs(started, timeoutMs));
      const imageResult = await this.waitForVisibleImages(this.remainingMs(started, timeoutMs), options.maxImages || 8);
      const imageReadiness = this.collectImageReadiness();

      await this.waitAnimationFrames(1);

      return {
        waitedMs: Math.round(performance.now() - started),
        fonts: fontResult,
        images: imageResult,
        imageReadiness
      };
    }

    collectImageReadiness() {
      this.imageReadinessProbe = this.imageReadinessProbe ||
        new globalThis.ScreenshotExtensionImageReadinessProbe();

      return this.imageReadinessProbe.collect();
    }

    async waitForImageReadiness(options = {}) {
      const timeoutMs = Math.max(0, Number(options.timeoutMs) || 0);
      const pollMs = Math.max(50, Number(options.pollMs) || 150);
      const minWaitMs = Math.max(pollMs, Number(options.minWaitMs) || 600);
      const started = performance.now();
      let attempts = 0;
      let imageReadiness = this.collectImageReadiness();
      let previousScore = this.imageReadinessScore(imageReadiness);

      while (this.needsImageReadinessWait(imageReadiness) && performance.now() - started < timeoutMs) {
        attempts += 1;
        this.prioritizeVisibleImages(options.maxImages || 24);
        this.dispatchScrollSignals();

        const remaining = timeoutMs - (performance.now() - started);
        await Promise.allSettled([
          this.waitForVisibleImages(Math.min(pollMs, remaining), options.maxImages || 24),
          new Promise(resolve => setTimeout(resolve, Math.min(pollMs, remaining)))
        ]);
        await this.waitAnimationFrames(1);

        imageReadiness = this.collectImageReadiness();
        const nextScore = this.imageReadinessScore(imageReadiness);
        if (nextScore <= previousScore && attempts > 1 && performance.now() - started >= minWaitMs) {
          break;
        }
        previousScore = nextScore;
      }

      return {
        waitedMs: Math.round(performance.now() - started),
        attempts,
        timedOut: this.needsImageReadinessWait(imageReadiness),
        imageReadiness
      };
    }

    needsImageReadinessWait(imageReadiness) {
      if (!imageReadiness) {
        return false;
      }

      if ((imageReadiness.pendingImages || 0) > 0) {
        return true;
      }

      return (imageReadiness.placeholderBlocks || 0) > 0 &&
        (imageReadiness.visibleImages || 0) > 0 &&
        (imageReadiness.readyImages || 0) < (imageReadiness.visibleImages || 0);
    }

    prioritizeVisibleImages(maxImages) {
      Array.from(document.images)
        .filter(img => this.isVisibleImage(img))
        .slice(0, maxImages)
        .forEach(img => {
          this.applyLazyImageSource(img);
          img.loading = 'eager';
          img.fetchPriority = 'high';
          img.decoding = 'sync';
        });
    }

    applyLazyImageSource(img) {
      if (!img.getAttribute('src')) {
        const lazySrc = img.getAttribute('data-src') ||
          img.getAttribute('data-lazy-src') ||
          img.getAttribute('data-original');
        if (lazySrc) {
          img.setAttribute('src', lazySrc);
        }
      }

      if (!img.getAttribute('srcset')) {
        const lazySrcset = img.getAttribute('data-srcset') ||
          img.getAttribute('data-lazy-srcset');
        if (lazySrcset) {
          img.setAttribute('srcset', lazySrcset);
        }
      }
    }

    dispatchScrollSignals() {
      window.dispatchEvent(new Event('scroll'));
      window.dispatchEvent(new Event('resize'));
      document.dispatchEvent(new Event('scroll'));
    }

    imageReadinessScore(imageReadiness) {
      if (!imageReadiness) {
        return 0;
      }

      return (imageReadiness.readyImages || 0) * 4 -
        (imageReadiness.pendingImages || 0) * 2 -
        (imageReadiness.brokenImages || 0) * 2 -
        (imageReadiness.placeholderBlocks || 0);
    }

    waitAnimationFrames(count) {
      return new Promise(resolve => {
        const tick = remaining => {
          if (remaining <= 0) {
            resolve();
            return;
          }
          requestAnimationFrame(() => tick(remaining - 1));
        };
        tick(count);
      });
    }

    async waitForFonts(timeoutMs) {
      if (!document.fonts || timeoutMs <= 0 || document.fonts.status !== 'loading') {
        return {
          waited: false
        };
      }

      await this.withTimeout(document.fonts.ready, timeoutMs);

      return {
        waited: true
      };
    }

    async waitForVisibleImages(timeoutMs, maxImages) {
      if (timeoutMs <= 0) {
        return {
          waited: false,
          count: 0
        };
      }

      const images = Array.from(document.images)
        .filter(img => (!img.complete || img.naturalWidth === 0) && this.isVisibleImage(img))
        .slice(0, maxImages);

      if (!images.length) {
        return {
          waited: false,
          count: 0
        };
      }

      await this.withTimeout(Promise.allSettled(images.map(img => this.waitForImage(img))), timeoutMs);

      return {
        waited: true,
        count: images.length
      };
    }

    waitForImage(img) {
      if (img.decode) {
        return img.decode().catch(() => {});
      }

      return new Promise(resolve => {
        const done = () => {
          img.removeEventListener('load', done);
          img.removeEventListener('error', done);
          resolve();
        };
        img.addEventListener('load', done, {once: true});
        img.addEventListener('error', done, {once: true});
      });
    }

    isVisibleImage(img) {
      const rect = img.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      return rect.width > 1 &&
        rect.height > 1 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < viewportHeight &&
        rect.left < viewportWidth;
    }

    withTimeout(promise, timeoutMs) {
      return Promise.race([
        promise.catch(() => {}),
        new Promise(resolve => setTimeout(resolve, timeoutMs))
      ]);
    }

    remainingMs(started, timeoutMs) {
      return Math.max(0, timeoutMs - (performance.now() - started));
    }

    cleanupCapture() {
      const beforeRestore = this.collectCleanupState();
      if (this.stack) {
        this.stack.restoreAll();
      }
      const afterRestore = this.collectCleanupState();

      this.stack = null;
      this.captureId = null;
      this.capturePolicy = null;
      this.fixedStickyNormalizer = null;
      this.scrollbarNormalizer = null;

      return {
        restored: true,
        beforeRestore,
        afterRestore
      };
    }

    collectCleanupState() {
      if (!document.documentElement) {
        return {
          stickyMarkers: 0,
          stickyNormalizationRules: 0
        };
      }

      const roots = [document];
      for (const element of this.collectCleanupElements(document.body)) {
        if (element.shadowRoot) {
          roots.push(element.shadowRoot);
        }
      }

      return {
        stickyMarkers: roots.reduce((total, root) =>
          total + root.querySelectorAll('[data-screenshot-extension-sticky-normalized]').length, 0),
        stickyNormalizationRules: roots.reduce((total, root) =>
          total + root.querySelectorAll('[data-screenshot-extension-sticky-normalization]').length, 0)
      };
    }

    collectCleanupElements(root) {
      if (!root || !root.querySelectorAll) {
        return [];
      }

      const elements = [];
      const stack = [root];
      while (stack.length) {
        const current = stack.pop();
        if (!current?.querySelectorAll) {
          continue;
        }

        for (const element of current.querySelectorAll('*')) {
          elements.push(element);
          if (element.shadowRoot) {
            stack.push(element.shadowRoot);
          }
        }
      }

      return elements;
    }
  }

  globalThis.__screenshotExtensionContentAgent = globalThis.__screenshotExtensionContentAgent || new ContentAgent();
})();
