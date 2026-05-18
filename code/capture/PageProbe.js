self.PageProbe = class PageProbe {
  constructor({chrome}) {
    this.chrome = chrome;
  }

  async measure(tabId) {
    const [result] = await this.chrome.scripting.executeScript({
      target: {tabId},
      func: () => {
        const captureTargetAttribute = 'data-screenshot-extension-capture-target';
        for (const element of document.querySelectorAll(`[${captureTargetAttribute}]`)) {
          element.removeAttribute(captureTargetAttribute);
        }

        self.port = chrome.runtime.connect({
          name: 'matrix'
        });

        const viewportWidth = document.documentElement.clientWidth;
        const viewportHeight = document.documentElement.clientHeight;
        const rawPageWidth = Math.max(document.body.scrollWidth, document.documentElement.scrollWidth);
        const pageWidth = viewportWidth;
        const pageHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
        const windowScrollHeight = Math.max(0, pageHeight - viewportHeight);
        const viewportArea = viewportWidth * viewportHeight;
        const backgroundColor = (() => {
          const values = [
            document.body ? getComputedStyle(document.body).backgroundColor : '',
            document.documentElement ? getComputedStyle(document.documentElement).backgroundColor : ''
          ];

          return values.find(value =>
            value &&
            value !== 'transparent' &&
            value !== 'rgba(0, 0, 0, 0)'
          ) || '#ffffff';
        })();
        const frames = Array.from(document.querySelectorAll('iframe'));
        const inaccessibleFrames = frames.filter(frame => {
          try {
            return !frame.contentWindow || !frame.contentDocument;
          }
          catch (e) {
            return true;
          }
        });
        const visibleArea = rect => {
          const width = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
          const height = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));

          return width * height;
        };
        const overlapRatio = (a, b) => {
          const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
          const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          const overlap = width * height;
          const smaller = Math.max(1, Math.min(
            Math.max(0, a.width) * Math.max(0, a.height),
            Math.max(0, b.width) * Math.max(0, b.height)
          ));

          return overlap / smaller;
        };
        const describeElement = element => [
          element.tagName,
          element.id,
          element.className,
          element.getAttribute('role'),
          element.getAttribute('aria-modal'),
          element.getAttribute('aria-label')
        ].join(' ').toLowerCase();
        const detectBlockingModal = () => {
          const bodyStyle = document.body ? getComputedStyle(document.body) : null;
          const htmlStyle = document.documentElement ? getComputedStyle(document.documentElement) : null;
          const scrollLockedByStyle = [bodyStyle, htmlStyle].some(style =>
            style && ['hidden', 'clip'].includes(style.overflowY)
          ) || bodyStyle?.position === 'fixed' || htmlStyle?.position === 'fixed';
          const modalCandidates = [];

          for (const element of document.body?.querySelectorAll('*') || []) {
            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
              continue;
            }

            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height || rect.bottom <= 0 || rect.right <= 0 || rect.top >= viewportHeight || rect.left >= viewportWidth) {
              continue;
            }

            const descriptor = describeElement(element);
            const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
            const areaRatio = visibleArea(rect) / Math.max(1, viewportArea);
            const fixedLayer = style.position === 'fixed' || style.position === 'sticky';
            const dialogSemantics = element.matches('dialog[open], [aria-modal="true"], [role="dialog"]') ||
              /dialog|modal|popup|popover|overlay|backdrop|consent|cookie/.test(descriptor);
            const coversViewport = areaRatio > 0.55 &&
              rect.top <= viewportHeight * 0.2 &&
              rect.left <= viewportWidth * 0.2 &&
              rect.bottom >= viewportHeight * 0.55 &&
              rect.right >= viewportWidth * 0.55;

            if (!dialogSemantics && !(fixedLayer && coversViewport)) {
              continue;
            }

            modalCandidates.push({
              role: element.getAttribute('role') || '',
              ariaModal: element.getAttribute('aria-modal') || '',
              position: style.position,
              areaRatio: Number(areaRatio.toFixed(3)),
              coversViewport,
              entryGate: (
                /about to enter|play zone|start playing|choose your country|select your country|age verification|verify your age/.test(text) ||
                /we think you are in|update your location|choose your location|select your location|country\/region|ship to your location/.test(text) ||
                (text.includes('continue') && /lego\.com|cookie policy|privacy policy/.test(text))
              )
            });
          }

          const hasModalCandidate = modalCandidates.some(candidate =>
            candidate.ariaModal === 'true' ||
            candidate.role === 'dialog' ||
            candidate.coversViewport
          );
          const hasEntryGate = modalCandidates.some(candidate => candidate.entryGate);
          const hasFullscreenCandidate = modalCandidates.some(candidate => candidate.coversViewport);
          const shouldStopAtViewport = hasModalCandidate && (scrollLockedByStyle || hasEntryGate);
          const reason = hasEntryGate ?
            'entry-gate-text' :
            (hasModalCandidate && scrollLockedByStyle ?
              'scroll-lock' :
              (hasModalCandidate && hasFullscreenCandidate ? 'large-dialog-uncertain' : 'none'));

          return {
            scrollLockedByStyle,
            hasModalCandidate,
            hasEntryGate,
            uncertain: reason === 'large-dialog-uncertain',
            reason,
            captureAction: shouldStopAtViewport ? 'viewport-only' : 'continue',
            likelyBlockingModal: shouldStopAtViewport,
            modalCandidateCount: modalCandidates.length,
            modalCandidates: modalCandidates.slice(0, 5)
          };
        };
        const shouldSkip = element => {
          const tagName = element.tagName;

          return tagName === 'HTML' ||
            tagName === 'BODY' ||
            tagName === 'TEXTAREA' ||
            tagName === 'INPUT' ||
            tagName === 'SELECT' ||
            tagName === 'IFRAME' ||
            element.isContentEditable;
        };
        const scrollAxes = (element, style) => {
          const overflowY = style.overflowY;
          const overflowX = style.overflowX;
          const canScrollY = ['auto', 'scroll', 'overlay'].includes(overflowY) &&
            element.scrollHeight > element.clientHeight + 1;
          const canScrollX = ['auto', 'scroll', 'overlay'].includes(overflowX) &&
            element.scrollWidth > element.clientWidth + 1;

          return {canScrollX, canScrollY};
        };
        const hasScrollableOverflow = (element, style) => {
          const axes = scrollAxes(element, style);

          return axes.canScrollY || axes.canScrollX;
        };
        const elementDescriptor = element => describeElement(element);
        const isLikelySidePanel = (element, rect) => {
          const descriptor = elementDescriptor(element);
          const edgePanel = rect.width < viewportWidth * 0.42 &&
            (rect.left <= viewportWidth * 0.08 || rect.right >= viewportWidth * 0.92);
          const panelSemantics = /sidebar|side-bar|palette|stencil|shape|library|inspector|properties|layers|navigator|toolbar/.test(descriptor);

          return edgePanel && panelSemantics;
        };
        const isLikelyEmptyWorkspace = (element, style, rect) => {
          const axes = scrollAxes(element, style);
          const descriptor = elementDescriptor(element);
          const workspaceSemantics = /canvas|workspace|diagram|graph|board|paper|editor|geDiagramContainer/i.test(descriptor);
          const sparseText = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim().length < 200;
          const broadWorkspace = rect.width >= viewportWidth * 0.45 && rect.height >= viewportHeight * 0.45;

          return axes.canScrollX && axes.canScrollY && broadWorkspace && sparseText && workspaceSemantics;
        };
        const blockingModal = detectBlockingModal();
        const detectFixedStickyAndOverlayRisk = () => {
          const fixedStickyCandidates = [];
          const visibleNavOverlayCandidates = [];

          for (const element of document.body?.querySelectorAll('*') || []) {
            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
              continue;
            }

            const rect = element.getBoundingClientRect();
            if (!rect.width || !rect.height || rect.bottom <= 0 || rect.right <= 0 || rect.top >= viewportHeight || rect.left >= viewportWidth) {
              continue;
            }

            const descriptor = describeElement(element);
            const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
            const areaRatio = visibleArea(rect) / Math.max(1, viewportArea);
            const isFixedOrSticky = style.position === 'fixed' || style.position === 'sticky';
            const hasNavSemantics = element.matches('nav, [role="navigation"], [role="banner"]') ||
              /globalnav|global-nav|navbar|nav-bar|navigation|menu|flyout|drawer|mega-menu|site-nav/.test(descriptor);
            const likelyTopChrome = rect.top <= Math.min(140, viewportHeight * 0.18) &&
              rect.width >= viewportWidth * 0.55 &&
              rect.height <= viewportHeight * 0.35 &&
              hasNavSemantics;
            const likelyVisibleNavOverlay = hasNavSemantics &&
              areaRatio >= 0.2 &&
              text.length >= 180 &&
              rect.top <= viewportHeight * 0.35;

            if (isFixedOrSticky && fixedStickyCandidates.length < 24) {
              fixedStickyCandidates.push({
                tag: element.tagName,
                id: element.id || '',
                role: element.getAttribute('role') || '',
                position: style.position,
                rect: [
                  Math.round(rect.left),
                  Math.round(rect.top),
                  Math.round(rect.width),
                  Math.round(rect.height)
                ].join(','),
                areaRatio: Number(areaRatio.toFixed(3)),
                likelyTopChrome
              });
            }

            if ((likelyVisibleNavOverlay || (isFixedOrSticky && likelyTopChrome)) && visibleNavOverlayCandidates.length < 8) {
              visibleNavOverlayCandidates.push({
                tag: element.tagName,
                id: element.id || '',
                role: element.getAttribute('role') || '',
                position: style.position,
                areaRatio: Number(areaRatio.toFixed(3)),
                textLength: text.length
              });
            }
          }

          const riskFlags = [];
          if (fixedStickyCandidates.length) {
            riskFlags.push('fixed_sticky');
          }
          if (visibleNavOverlayCandidates.length) {
            riskFlags.push('visible_nav_overlay');
          }
          if (blockingModal.captureAction === 'viewport-only') {
            riskFlags.push('blocking_modal');
          }
          if (inaccessibleFrames.length) {
            riskFlags.push('inaccessible_iframe');
          }

          return {
            riskFlags,
            fixedStickyCandidateCount: fixedStickyCandidates.length,
            fixedStickyCandidates,
            visibleNavOverlayCandidateCount: visibleNavOverlayCandidates.length,
            visibleNavOverlayCandidates
          };
        };
        const pageRisk = detectFixedStickyAndOverlayRisk();
        const createCapturePolicy = () => {
          const riskFlags = Array.isArray(pageRisk.riskFlags) ? pageRisk.riskFlags : [];
          const hasRiskFlag = flag => riskFlags.includes(flag);
          const viewportOnly = blockingModal.captureAction === 'viewport-only';
          const hasFixedSticky = hasRiskFlag('fixed_sticky');
          const hasVisibleNavOverlay = hasRiskFlag('visible_nav_overlay');
          const shouldNormalizeAfterFirstFrame = hasFixedSticky || hasVisibleNavOverlay;

          return {
            version: 1,
            mode: viewportOnly ? 'viewport-only' : 'full-page',
            reasons: riskFlags.slice(),
            preserveFirstFrame: true,
            skipLazyWarmupBeforeFirstFrame: viewportOnly || hasVisibleNavOverlay,
            firstFrame: {
              preserveUserState: true,
              normalizeFixedSticky: false,
              suppressVisibleNavOverlay: false,
              suppressRepeatedOverlays: false,
              preserveDimmedBackdrop: false
            },
            afterFirstFrame: {
              normalizeFixedSticky: shouldNormalizeAfterFirstFrame,
              suppressVisibleNavOverlay: hasVisibleNavOverlay,
              suppressRepeatedOverlays: shouldNormalizeAfterFirstFrame,
              preserveDimmedBackdrop: true
            }
          };
        };
        const capturePolicy = createCapturePolicy();
        const candidates = [];
        const splitCandidates = [];
        const splitExclusionRanges = [];
        const minScrollableY = Math.max(80, Math.min(160, viewportHeight * 0.2));

        const addSplitCandidate = (value, score) => {
          if (!Number.isFinite(value) || value <= viewportHeight * 0.5 || value >= pageHeight - viewportHeight * 0.5) {
            return;
          }

          splitCandidates.push({
            y: value,
            score
          });
        };
        const addSplitExclusionRange = (top, bottom, reason) => {
          if (
            !Number.isFinite(top) ||
            !Number.isFinite(bottom) ||
            bottom <= top ||
            bottom <= viewportHeight * 0.5 ||
            top >= pageHeight - viewportHeight * 0.5
          ) {
            return;
          }

          splitExclusionRanges.push({
            top: Math.max(0, top),
            bottom: Math.min(pageHeight, bottom),
            reason
          });
        };
	        const isSplitSensitiveBlock = element => {
	          const descriptor = [
	            element.tagName,
	            element.id,
            element.className,
            element.getAttribute('role'),
            element.getAttribute('aria-label')
          ].join(' ').toLowerCase();

	          return /card|cards|tile|product|item|listing|carousel|slide|gallery|feature|benefit|spec|promo|module/.test(descriptor) ||
	            element.matches('li, figure, article, [role="listitem"], [class*="card" i], [class*="product" i], [class*="tile" i], [class*="carousel" i], [class*="slide" i]');
	        };
	        const isHeaderGalleryModule = (element, rect) => {
	          if (rect.width < viewportWidth * 0.45 || rect.height < 180 || rect.height > viewportHeight * 2.4) {
	            return false;
	          }

	          const descriptor = [
	            element.tagName,
	            element.id,
	            element.className,
	            element.getAttribute('role'),
	            element.getAttribute('aria-label')
	          ].join(' ').toLowerCase();
	          const moduleSemantics = /section|module|gallery|carousel|card|cards|grid|incentive|values|feature|benefit|product/.test(descriptor) ||
	            element.matches('section, article, [role="region"]');
	          if (!moduleSemantics) {
	            return false;
	          }

	          const hasHeading = Boolean(element.querySelector('h1, h2, h3, [class*="headline" i], [class*="heading" i]'));
	          const hasCards = Boolean(element.querySelector([
	            '[class*="card" i]',
	            '[class*="tile" i]',
	            '[class*="gallery" i]',
	            '[class*="carousel" i]',
	            '[role="list"]',
	            '[role="listitem"]',
	            'ul',
	            'ol',
	            'article'
	          ].join(',')));

	          return hasHeading && hasCards;
	        };

        const splitSelector = [
          'main',
          'section',
          'article',
          'header',
          'footer',
          'nav',
          'aside',
          'figure',
          'picture',
          'table',
          'ul',
          'ol',
          'li',
          'h1',
          'h2',
          'h3',
          'h4',
          'p',
          'pre',
          'blockquote',
          '[role="region"]',
          '[role="main"]',
          '[class*="section"]',
          '[class*="content"]',
          '[class*="card"]',
          '[class*="tile"]',
          '[class*="grid"]'
        ].join(',');

        for (const element of document.body.querySelectorAll(splitSelector)) {
          const rect = element.getBoundingClientRect();
          const splitSensitive = isSplitSensitiveBlock(element);
          const minWidth = splitSensitive ?
            Math.min(140, viewportWidth * 0.1) :
            viewportWidth * 0.25;

          if (rect.width < minWidth || rect.height < 12) {
            continue;
          }

          const style = getComputedStyle(element);
          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.position === 'fixed' ||
            style.position === 'sticky'
          ) {
            continue;
          }

          const documentTop = rect.top + window.scrollY;
          const documentBottom = rect.bottom + window.scrollY;
          const score = Math.min(1, rect.width / Math.max(1, viewportWidth)) +
            Math.min(1, rect.height / Math.max(1, viewportHeight));

          addSplitCandidate(documentTop - 32, score + 0.2);
          addSplitCandidate(documentTop, score);
          addSplitCandidate(documentBottom, score);
          addSplitCandidate(documentBottom + 32, score + 0.1);

	          if (
	            splitSensitive &&
	            rect.height >= 80 &&
	            rect.height <= viewportHeight * 1.5
	          ) {
	            addSplitExclusionRange(documentTop + 8, documentBottom - 8, 'split-sensitive-block');
	          }

	          if (isHeaderGalleryModule(element, rect)) {
	            addSplitExclusionRange(documentTop + 8, documentBottom - 8, 'header-gallery-module');
	          }
	        }

        for (const element of document.body.querySelectorAll('*')) {
          if (shouldSkip(element)) {
            continue;
          }

          const style = getComputedStyle(element);
          if (!hasScrollableOverflow(element, style)) {
            continue;
          }

          const rect = element.getBoundingClientRect();
          const area = visibleArea(rect);
          const scrollableY = Math.max(0, element.scrollHeight - element.clientHeight);

          if (isLikelySidePanel(element, rect) || isLikelyEmptyWorkspace(element, style, rect)) {
            continue;
          }

          if (
            area < viewportArea * 0.3 ||
            rect.width < viewportWidth * 0.35 ||
            rect.height < viewportHeight * 0.35 ||
            scrollableY < minScrollableY
          ) {
            continue;
          }

          candidates.push({
            element,
            rect,
            area,
            scrollableY,
            score: area + scrollableY * viewportWidth
          });
        }

        candidates.sort((a, b) => b.score - a.score);
        const best = candidates[0];
        const second = candidates.find(candidate => {
          if (!best || candidate === best) {
            return false;
          }

          if (
            best.element.contains(candidate.element) ||
            candidate.element.contains(best.element) ||
            overlapRatio(best.rect, candidate.rect) > 0.85
          ) {
            return false;
          }

          return true;
        });
        const useInternal = blockingModal.captureAction !== 'viewport-only' &&
          Boolean(best) &&
          windowScrollHeight < viewportHeight * 0.75 &&
          (!second || second.score < best.score * 0.75);

        if (useInternal) {
          const element = best.element;
          const rect = element.getBoundingClientRect();
          element.setAttribute(captureTargetAttribute, 'main');

          return {
            width: viewportWidth,
            height: Math.max(viewportHeight, Math.max(0, rect.top) + element.scrollHeight),
            w: viewportWidth,
            h: element.clientHeight,
            scrollPlanWidth: element.clientWidth,
            scrollPlanHeight: element.scrollHeight,
            scrollPlanViewportWidth: element.clientWidth,
            scrollPlanViewportHeight: element.clientHeight,
            ratio: window.devicePixelRatio,
            backgroundColor,
            x: element.scrollLeft,
            y: element.scrollTop,
            windowX: window.scrollX,
            windowY: window.scrollY,
            captureArea: {
              x: Math.max(0, rect.left),
              y: Math.max(0, rect.top),
              width: Math.min(rect.width, viewportWidth - Math.max(0, rect.left)),
              height: Math.min(rect.height, viewportHeight - Math.max(0, rect.top))
            },
            scrollTarget: {
              type: 'element',
              composeMode: 'app-shell',
              attribute: captureTargetAttribute,
              candidateCount: candidates.length
            },
            capturePolicy,
            diagnostics: {
              iframeCount: frames.length,
              inaccessibleIframeCount: inaccessibleFrames.length,
              scrollTargetType: 'element',
              internalScrollCandidateCount: candidates.length,
              splitCandidateCount: splitCandidates.length,
              capturePolicy,
              ...pageRisk
            }
          };
        }

        const measuredHeight = blockingModal.captureAction === 'viewport-only' ?
          viewportHeight :
          pageHeight;
        const measuredScrollPlanHeight = blockingModal.captureAction === 'viewport-only' ?
          viewportHeight :
          pageHeight;

        return {
          width: pageWidth,
          height: measuredHeight,
          w: viewportWidth,
          h: viewportHeight,
          scrollPlanWidth: viewportWidth,
          scrollPlanHeight: measuredScrollPlanHeight,
          scrollPlanViewportWidth: viewportWidth,
          scrollPlanViewportHeight: viewportHeight,
          ratio: window.devicePixelRatio,
          backgroundColor,
          x: window.scrollX,
          y: window.scrollY,
          windowX: window.scrollX,
          windowY: window.scrollY,
          captureArea: null,
          scrollTarget: {
            type: 'window',
            candidateCount: candidates.length
          },
          capturePolicy,
          splitCandidates: splitCandidates
            .sort((a, b) => b.score - a.score)
            .slice(0, 800)
            .map(candidate => candidate.y),
          splitExclusionRanges: splitExclusionRanges
            .sort((a, b) => a.top - b.top)
            .slice(0, 500),
          diagnostics: {
            iframeCount: frames.length,
            inaccessibleIframeCount: inaccessibleFrames.length,
            scrollTargetType: 'window',
            internalScrollCandidateCount: candidates.length,
            splitCandidateCount: splitCandidates.length,
            splitExclusionRangeCount: splitExclusionRanges.length,
            rawPageWidth,
            measuredPageWidth: pageWidth,
            widthClampedToViewport: rawPageWidth > viewportWidth + 2,
            blockingModal,
            capturePolicy,
            ...pageRisk
          }
        };
      },
      injectImmediately: true
    });

    return result.result;
  }

  async scrollTo(tabId, x, y) {
    await this.chrome.scripting.executeScript({
      target: {tabId},
      func: async (left, top) => {
        const waitFrames = count => new Promise(resolve => {
          const tick = remaining => {
            if (remaining <= 0) {
              resolve();
              return;
            }

            requestAnimationFrame(() => tick(remaining - 1));
          };

          tick(count);
        });
        const target = document.querySelector('[data-screenshot-extension-capture-target="main"]');

        if (target) {
          target.scrollLeft = left;
          target.scrollTop = top;
          target.dispatchEvent(new Event('scroll', {bubbles: true}));
          await waitFrames(2);
          return;
        }

        window.scrollTo({
          left,
          top,
          behavior: 'instant'
        });
        await waitFrames(2);
      },
      args: [x, y],
      injectImmediately: true
    });
  }

  async readScroll(tabId) {
    const [{
      result: [x, y]
    }] = await this.chrome.scripting.executeScript({
      target: {tabId},
      func: () => {
        const target = document.querySelector('[data-screenshot-extension-capture-target="main"]');

        if (target) {
          return [
            target.scrollLeft,
            target.scrollTop
          ];
        }

        return [
          document.body.scrollLeft || document.documentElement.scrollLeft,
          document.body.scrollTop || document.documentElement.scrollTop
        ];
      },
      injectImmediately: true
    });

    return {x, y};
  }

  async restore(tabId, x, y, windowX = x, windowY = y) {
    await this.chrome.scripting.executeScript({
      target: {tabId},
      func: (left, top, originalWindowX, originalWindowY) => {
        try {
          self.port.disconnect();
        }
        catch (e) {}
        const target = document.querySelector('[data-screenshot-extension-capture-target="main"]');
        if (target) {
          target.scrollLeft = left;
          target.scrollTop = top;
          target.dispatchEvent(new Event('scroll', {bubbles: true}));
        }

        for (const element of document.querySelectorAll('[data-screenshot-extension-capture-target]')) {
          element.removeAttribute('data-screenshot-extension-capture-target');
        }

        window.scrollTo({
          left: originalWindowX,
          top: originalWindowY,
          behavior: 'instant'
        });
      },
      args: [x, y, windowX, windowY],
      injectImmediately: true
    });
  }
};
