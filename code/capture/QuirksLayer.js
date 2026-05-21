self.QuirksLayer = class QuirksLayer {
  constructor({chrome}) {
    this.chrome = chrome;
    this.captureRootAttribute = 'data-screenshot-extension-quirk-capture-root';
    this.fixedBackgroundAttribute = 'data-screenshot-extension-quirk-fixed-background';
  }

  async beforeMeasure(tabId) {
    return this.analyze(tabId, 'beforeMeasure');
  }

  async afterWarmup(tabId) {
    return this.analyze(tabId, 'afterWarmup');
  }

  async cleanup(tabId) {
    await this.chrome.scripting.executeScript({
      target: {tabId},
      func: (captureRootAttribute, fixedBackgroundAttribute) => {
        for (const attribute of [captureRootAttribute, fixedBackgroundAttribute]) {
          for (const element of document.querySelectorAll(`[${attribute}]`)) {
            element.removeAttribute(attribute);
          }
        }
      },
      args: [this.captureRootAttribute, this.fixedBackgroundAttribute],
      injectImmediately: true
    }).catch(() => {});
  }

  async analyze(tabId, stage) {
    const [result] = await this.chrome.scripting.executeScript({
      target: {tabId},
      func: (captureRootAttribute, fixedBackgroundAttribute, stageName) => {
        const viewportWidth = document.documentElement.clientWidth || window.innerWidth || 0;
        const viewportHeight = document.documentElement.clientHeight || window.innerHeight || 0;
        const viewportArea = Math.max(1, viewportWidth * viewportHeight);
        const allElements = Array.from(document.body?.querySelectorAll('*') || []);
        const descriptorFor = element => [
          element.tagName,
          element.id,
          element.className,
          element.getAttribute('role'),
          element.getAttribute('aria-modal'),
          element.getAttribute('aria-label')
        ].join(' ').toLowerCase();
        const visibleArea = rect => {
          const width = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
          const height = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));

          return width * height;
        };
        const isTransparent = value => !value ||
          value === 'transparent' ||
          value === 'rgba(0, 0, 0, 0)';
        const summarize = (element, rect, style) => ({
          tag: element.tagName,
          id: element.id || '',
          role: element.getAttribute('role') || '',
          position: style.position || '',
          rect: [
            Math.round(rect.left),
            Math.round(rect.top),
            Math.round(rect.width),
            Math.round(rect.height)
          ].join(','),
          areaRatio: Number((visibleArea(rect) / viewportArea).toFixed(3))
        });

        for (const attribute of [captureRootAttribute, fixedBackgroundAttribute]) {
          for (const element of document.querySelectorAll(`[${attribute}]`)) {
            element.removeAttribute(attribute);
          }
        }

        const fixedBackgroundCandidates = [];
        const roots = [document.documentElement, document.body].filter(Boolean);
        for (const element of roots.concat(allElements)) {
          const style = getComputedStyle(element);
          const rect = element === document.documentElement || element === document.body ?
            new DOMRect(0, 0, viewportWidth, viewportHeight) :
            element.getBoundingClientRect();
          const areaRatio = visibleArea(rect) / viewportArea;
          const descriptor = descriptorFor(element);
          const attachmentFixed = String(style.backgroundAttachment || '')
            .split(',')
            .some(value => value.trim().toLowerCase() === 'fixed');
          const hasBackgroundPaint = !isTransparent(style.backgroundColor) ||
            (style.backgroundImage && style.backgroundImage !== 'none');
          const hasDesignBackgroundSemantics = /background|bg-|bg_|parallax|ambient|hero|cover|visual/.test(descriptor);
          const passiveFixedLayer = style.position === 'fixed' &&
            areaRatio >= 0.55 &&
            (style.pointerEvents === 'none' ||
              hasDesignBackgroundSemantics ||
              (Number.parseInt(style.zIndex, 10) || 0) <= 0) &&
            !/dialog|modal|popup|popover|cookie|consent|lightbox|viewer|menu|nav|drawer/.test(descriptor);

          if (
            (attachmentFixed && hasBackgroundPaint && (roots.includes(element) || areaRatio >= 0.25)) ||
            (passiveFixedLayer && hasBackgroundPaint)
          ) {
            fixedBackgroundCandidates.push({
              element,
              summary: summarize(element, rect, style)
            });
          }
        }

        const lightboxCandidates = [];
        const lightboxSelector = '#lightbox-wrap';

        for (const element of document.body?.querySelectorAll(lightboxSelector) || []) {
          const style = getComputedStyle(element);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            continue;
          }

          const rect = element.getBoundingClientRect();
          if (
            !rect.width ||
            !rect.height ||
            rect.bottom <= 0 ||
            rect.right <= 0 ||
            rect.top >= viewportHeight ||
            rect.left >= viewportWidth
          ) {
            continue;
          }

          const zIndex = Number.parseInt(style.zIndex, 10);
          const coversAlmostFullViewport =
            Math.abs(rect.left) <= 2 &&
            Math.abs(rect.top) <= 2 &&
            Math.abs(viewportWidth - rect.width) <= 2 &&
            Math.abs(viewportHeight - rect.height) <= 2;
          const knownLightboxRoot = style.position === 'fixed' &&
            !Number.isNaN(zIndex) &&
            zIndex >= 1000 &&
            coversAlmostFullViewport;

          if (!knownLightboxRoot) {
            continue;
          }

          lightboxCandidates.push({
            element,
            score: 1,
            summary: {
              ...summarize(element, rect, style),
              scrollHeight: element.scrollHeight,
              clientHeight: element.clientHeight,
              selector: lightboxSelector
            }
          });
        }

        lightboxCandidates.sort((a, b) => b.score - a.score);
        const lightboxRoot = lightboxCandidates[0] || null;
        if (lightboxRoot) {
          lightboxRoot.element.setAttribute(captureRootAttribute, 'known-lightbox-root');
        }

        for (const candidate of fixedBackgroundCandidates) {
          candidate.element.setAttribute(fixedBackgroundAttribute, 'preserve-fixed-background');
        }

        const applied = [];
        if (fixedBackgroundCandidates.length) {
          applied.push('preserve-fixed-background');
        }
        if (lightboxRoot) {
          applied.push('known-lightbox-root');
        }

        return {
          version: 1,
          stage: stageName,
          captureRootAttribute,
          fixedBackgroundAttribute,
          applied,
          preserveFixedBackground: fixedBackgroundCandidates.length > 0,
          fixedBackgroundCandidateCount: fixedBackgroundCandidates.length,
          fixedBackgroundCandidates: fixedBackgroundCandidates
            .slice(0, 5)
            .map(candidate => ({
              ...candidate.summary,
              attribute: fixedBackgroundAttribute
            })),
          lightboxRoot: lightboxRoot ? {
            found: true,
            attribute: captureRootAttribute,
            ...lightboxRoot.summary
          } : {
            found: false,
            attribute: captureRootAttribute
          }
        };
      },
      args: [this.captureRootAttribute, this.fixedBackgroundAttribute, stage],
      injectImmediately: true
    });

    return result?.result || {
      version: 1,
      stage,
      captureRootAttribute: this.captureRootAttribute,
      fixedBackgroundAttribute: this.fixedBackgroundAttribute,
      applied: [],
      preserveFixedBackground: false,
      fixedBackgroundCandidateCount: 0,
      fixedBackgroundCandidates: [],
      lightboxRoot: {
        found: false,
        attribute: this.captureRootAttribute
      }
    };
  }
};
