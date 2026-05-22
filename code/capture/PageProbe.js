self.PageProbe = class PageProbe {
  constructor({chrome}) {
    this.chrome = chrome;
  }

  async measure(tabId, quirkHints = {}, attempt = 0) {
    let results;

    try {
      results = await this.chrome.scripting.executeScript({
        target: {tabId},
        func: (quirkHints = {}) => {
        try {
        quirkHints = quirkHints || {};
        const captureTargetAttribute = 'data-screenshot-extension-capture-target';
        const quirkCaptureRootAttribute = quirkHints.captureRootAttribute ||
          'data-screenshot-extension-quirk-capture-root';
        const activeQuirks = {
          version: 1,
          applied: Array.isArray(quirkHints.applied) ? quirkHints.applied.slice() : [],
          preserveFixedBackground: Boolean(quirkHints.preserveFixedBackground),
          fixedBackgroundCandidateCount: Number(quirkHints.fixedBackgroundCandidateCount) || 0,
          fixedBackgroundCandidates: Array.isArray(quirkHints.fixedBackgroundCandidates) ?
            quirkHints.fixedBackgroundCandidates.slice(0, 5) :
            [],
          fixedBackgroundAttribute: quirkHints.fixedBackgroundAttribute ||
            'data-screenshot-extension-quirk-fixed-background',
          lightboxRoot: quirkHints.lightboxRoot || {
            found: false,
            attribute: quirkCaptureRootAttribute
          },
          captureRootAttribute: quirkCaptureRootAttribute
        };
        for (const element of document.querySelectorAll(`[${captureTargetAttribute}]`)) {
          element.removeAttribute(captureTargetAttribute);
        }

        if (!document.documentElement || !document.body) {
          return {
            __pageProbeRetryable: true,
            message: 'document body is not ready',
            readyState: document.readyState || ''
          };
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
        const compactDescriptor = element => {
          if (!element) {
            return '';
          }

          const tag = String(element.tagName || '').toLowerCase();
          const id = element.id ? `#${element.id}` : '';
          const classes = String(element.className || '')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(className => `.${className}`)
            .join('');
          const role = element.getAttribute('role') ? `[role="${element.getAttribute('role')}"]` : '';
          const aria = element.getAttribute('aria-label') ?
            `[aria-label="${element.getAttribute('aria-label').slice(0, 48)}"]` :
            '';

          return `${tag}${id}${classes}${role}${aria}`;
        };
        const ancestorPositionFlags = element => {
          let hasFixedAncestor = false;
          let hasStickyAncestor = false;

          for (let ancestor = element?.parentElement; ancestor && ancestor !== document.body && ancestor !== document.documentElement; ancestor = ancestor.parentElement) {
            const position = getComputedStyle(ancestor).position;
            if (position === 'fixed') {
              hasFixedAncestor = true;
            }
            else if (position === 'sticky') {
              hasStickyAncestor = true;
            }

            if (hasFixedAncestor && hasStickyAncestor) {
              break;
            }
          }

          return {
            hasFixedAncestor,
            hasStickyAncestor
          };
        };
        const roundedRect = rect => ({
          left: Math.round(rect.left),
          top: Math.round(rect.top),
          width: Math.round(rect.width),
          height: Math.round(rect.height)
        });
        const summarizeScrollCandidate = (candidate, selected = false) => {
          if (!candidate?.element) {
            return null;
          }

          const element = candidate.element;
          const style = getComputedStyle(element);
          const rect = candidate.rect || element.getBoundingClientRect();

          return {
            selected,
            descriptor: compactDescriptor(element),
            position: style.position || 'static',
            rect: roundedRect(rect),
            scrollHeight: element.scrollHeight,
            clientHeight: element.clientHeight,
            scrollableY: Math.max(0, element.scrollHeight - element.clientHeight),
            ...ancestorPositionFlags(element)
          };
        };
        const detectBlockingModal = () => {
          const bodyStyle = document.body ? getComputedStyle(document.body) : null;
          const htmlStyle = document.documentElement ? getComputedStyle(document.documentElement) : null;
          const scrollLockSources = [];
          if (bodyStyle && ['hidden', 'clip'].includes(bodyStyle.overflowY)) {
            scrollLockSources.push(`body.overflowY=${bodyStyle.overflowY}`);
          }
          if (htmlStyle && ['hidden', 'clip'].includes(htmlStyle.overflowY)) {
            scrollLockSources.push(`html.overflowY=${htmlStyle.overflowY}`);
          }
          if (bodyStyle?.position === 'fixed') {
            scrollLockSources.push('body.position=fixed');
          }
          if (htmlStyle?.position === 'fixed') {
            scrollLockSources.push('html.position=fixed');
          }
          const scrollLockedByStyle = scrollLockSources.length > 0;
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
              tag: element.tagName,
              descriptor: compactDescriptor(element),
              role: element.getAttribute('role') || '',
              ariaModal: element.getAttribute('aria-modal') || '',
              position: style.position,
              rect: roundedRect(rect),
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
          const hasFullscreenOverlayGeometryCandidate = modalCandidates.some(candidate =>
            candidate.coversViewport &&
            (candidate.position === 'fixed' || candidate.position === 'sticky')
          );
          const shouldStopAtViewport = hasModalCandidate && scrollLockedByStyle;
          const runtimeViewportProbe = !shouldStopAtViewport &&
            hasFullscreenOverlayGeometryCandidate &&
            Math.abs(window.scrollY || 0) <= 2 &&
            windowScrollHeight >= Math.max(80, viewportHeight * 0.12);
          const entryGateBlocking = hasEntryGate && shouldStopAtViewport;
          const reason = shouldStopAtViewport ?
            'scroll-lock' :
            (runtimeViewportProbe ? 'large-dialog-runtime-probe' :
              (hasModalCandidate && hasFullscreenCandidate ? 'large-dialog-uncertain' : 'none'));
          const modalDecision = {
            scrollY: Math.round(window.scrollY || 0),
            scrollX: Math.round(window.scrollX || 0),
            atPageTop: Math.abs(window.scrollY || 0) <= 2,
            windowScrollableY: windowScrollHeight,
            scrollLockSources,
            hasModalCandidate,
            hasEntryGate,
            entryGateBlocking,
            hasFullscreenCandidate,
            hasFullscreenOverlayGeometryCandidate,
            runtimeViewportProbe,
            shouldStopAtViewport,
            reason
          };

          return {
            scrollLockedByStyle,
            scrollLockSources,
            hasModalCandidate,
            hasEntryGate,
            entryGateBlocking,
            hasFullscreenCandidate,
            hasFullscreenOverlayGeometryCandidate,
            runtimeViewportProbe,
            uncertain: reason === 'large-dialog-uncertain' || reason === 'large-dialog-runtime-probe',
            reason,
            captureAction: shouldStopAtViewport ? 'viewport-only' : 'continue',
            likelyBlockingModal: shouldStopAtViewport,
            modalDecision,
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
        const isEdgeAnchoredNarrowScrollCandidate = rect =>
          rect.width < viewportWidth * 0.65 &&
          (rect.left <= viewportWidth * 0.08 || rect.right >= viewportWidth * 0.92);
        const blockingModal = detectBlockingModal();
        const detectFixedStickyAndOverlayRisk = () => {
          const fixedStickyCandidates = [];
          const visibleOverlayCandidates = [];

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

            if (likelyVisibleNavOverlay && visibleOverlayCandidates.length < 8) {
              visibleOverlayCandidates.push({
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
          if (blockingModal.captureAction === 'viewport-only' && !activeQuirks.lightboxRoot?.found) {
            riskFlags.push('blocking_modal');
          }
          if (inaccessibleFrames.length) {
            riskFlags.push('inaccessible_iframe');
          }

          return {
            riskFlags,
            fixedStickyCandidateCount: fixedStickyCandidates.length,
            fixedStickyCandidates,
            visibleOverlayCandidateCount: visibleOverlayCandidates.length,
            visibleOverlayCandidates
          };
        };
        const pageRisk = detectFixedStickyAndOverlayRisk();
        const createCapturePolicy = () => {
          const riskFlags = Array.isArray(pageRisk.riskFlags) ? pageRisk.riskFlags : [];
          const hasRiskFlag = flag => riskFlags.includes(flag);
          const knownLightboxRoot = Boolean(activeQuirks.lightboxRoot?.found);
          const viewportOnly = !knownLightboxRoot && blockingModal.captureAction === 'viewport-only';
          const hasFixedSticky = hasRiskFlag('fixed_sticky');
          const shouldNormalizeAfterFirstFrame = hasFixedSticky;

          return {
            version: 1,
            mode: viewportOnly ? 'viewport-only' : 'full-page',
            reasons: riskFlags.slice(),
            viewportBlockingProbe: blockingModal.runtimeViewportProbe,
            preserveFirstFrame: true,
            skipLazyWarmupBeforeFirstFrame: viewportOnly,
            firstFrame: {
              preserveUserState: true,
              normalizeFixedSticky: false,
              suppressVisibleNavOverlay: false,
              suppressRepeatedOverlays: false,
              preserveDimmedBackdrop: false
            },
            afterFirstFrame: {
              normalizeFixedSticky: shouldNormalizeAfterFirstFrame,
              suppressVisibleNavOverlay: false,
              suppressRepeatedOverlays: !viewportOnly,
              preserveDimmedBackdrop: true
            },
            quirks: {
              preserveFixedBackground: activeQuirks.preserveFixedBackground,
              fixedBackgroundAttribute: activeQuirks.fixedBackgroundAttribute,
              knownLightboxRoot
            }
          };
        };
        const capturePolicy = createCapturePolicy();
        const candidates = [];
        const splitCandidates = [];
        const splitExclusionRanges = [];
        const windowScrollThreshold = Math.max(40, viewportHeight * 0.05);
        const minScrollableY = windowScrollThreshold;

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
        const summarizeSplitExclusionRanges = () => {
          const byReason = {};
          let maxHeight = 0;
          let totalHeight = 0;

          for (const range of splitExclusionRanges) {
            const reason = range.reason || 'unknown';
            const height = Math.max(0, range.bottom - range.top);
            maxHeight = Math.max(maxHeight, height);
            totalHeight += height;
            byReason[reason] = (byReason[reason] || 0) + 1;
          }

          return {
            count: splitExclusionRanges.length,
            byReason,
            maxHeight: Math.round(maxHeight),
            totalHeight: Math.round(totalHeight),
            samples: splitExclusionRanges.slice(0, 12).map(range => ({
              top: Math.round(range.top),
              bottom: Math.round(range.bottom),
              height: Math.round(Math.max(0, range.bottom - range.top)),
              reason: range.reason || 'unknown'
            }))
          };
        };
        const normalizeAvoidRangeReason = reason => {
          if (reason === 'docs-card') {
            return 'docs-card';
          }

          if (reason === 'grid-row') {
            return 'grid-row';
          }

          if (reason === 'heading' || reason === 'section-heading' || reason === 'text-section') {
            return 'text-block';
          }

          if (reason === 'split-sensitive-block' || reason === 'card') {
            return 'card';
          }

          return null;
        };
        const createCapturePlan = () => {
          const avoidRanges = splitExclusionRanges
            .filter(range =>
              Number.isFinite(range.top) &&
              Number.isFinite(range.bottom) &&
              range.bottom > range.top
            )
            .sort((a, b) => a.top - b.top)
            .slice(0, 500)
            .map(range => {
              const reason = normalizeAvoidRangeReason(range.reason);
              if (!reason) {
                return null;
              }

              return {
                yStartCssPx: Math.max(0, range.top),
                yEndCssPx: Math.min(pageHeight, range.bottom),
                reason
              };
            })
            .filter(Boolean);

          return {
            version: 1,
            page: {
              widthCssPx: pageWidth,
              heightCssPx: pageHeight,
              devicePixelRatio: window.devicePixelRatio,
              url: window.location.href,
              title: document.title || '',
              capturedAt: new Date().toISOString()
            },
            avoidRanges,
            splits: []
          };
        };
        const summarizeCapturePlan = capturePlan => {
          const byReason = {};
          let maxHeight = 0;
          let totalHeight = 0;

          for (const range of capturePlan.avoidRanges || []) {
            const reason = range.reason || 'unknown';
            const height = Math.max(0, range.yEndCssPx - range.yStartCssPx);
            maxHeight = Math.max(maxHeight, height);
            totalHeight += height;
            byReason[reason] = (byReason[reason] || 0) + 1;
          }

          return {
            version: capturePlan.version,
            avoidRangeCount: capturePlan.avoidRanges.length,
            avoidRangeReasons: byReason,
            maxAvoidRangeHeightCssPx: Math.round(maxHeight),
            totalAvoidRangeHeightCssPx: Math.round(totalHeight)
          };
        };
        const detectSplitLayoutRisk = () => {
          const empty = {
            splitLayoutRisk: false,
            splitLayoutRiskReason: '',
            mediaColumnLike: false,
            tallColumnRatio: 0,
            stickyLikeDetected: false,
            shortColumnSide: '',
            heightRatio: 0
          };
          if (!document.body || viewportWidth < 720) {
            return empty;
          }

          const visibleRectEnough = rect => rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < viewportHeight &&
            rect.left < viewportWidth;
          const hasMediaLikeDescendant = element => {
            if (element.matches?.('img, picture, video, canvas, svg')) {
              return true;
            }

            const media = element.querySelector?.('img, picture, video, canvas, svg');
            if (!media) {
              return false;
            }

            const mediaRect = media.getBoundingClientRect();
            return visibleRectEnough(mediaRect);
          };
          const sideOf = rect =>
            rect.left + rect.width / 2 < viewportWidth / 2 ? 'left' : 'right';
          const verticalOverlapRatio = (a, b) => {
            const overlap = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
            return overlap / Math.max(1, Math.min(a.height, b.height));
          };
          const horizontalGap = (a, b) => {
            if (a.right <= b.left) {
              return b.left - a.right;
            }
            if (b.right <= a.left) {
              return a.left - b.right;
            }
            return 0;
          };

          const candidates = [];
          const queue = Array.from(document.body.children || []).map(element => ({
            element,
            depth: 0
          }));
          const seen = new Set();

          while (queue.length && seen.size < 260) {
            const item = queue.shift();
            const element = item?.element;
            if (!element || seen.has(element)) {
              continue;
            }
            seen.add(element);

            const style = getComputedStyle(element);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
              continue;
            }

            const rect = element.getBoundingClientRect();
            if (!visibleRectEnough(rect)) {
              continue;
            }

            if (item.depth < 3) {
              for (const child of Array.from(element.children || []).slice(0, 24)) {
                queue.push({
                  element: child,
                  depth: item.depth + 1
                });
              }
            }

            const area = visibleArea(rect);
            if (
              area < viewportArea * 0.08 ||
              rect.width < viewportWidth * 0.2 ||
              rect.height < viewportHeight * 0.22 ||
              rect.width > viewportWidth * 0.92
            ) {
              continue;
            }

            candidates.push({
              element,
              rect,
              style,
              mediaColumnLike: hasMediaLikeDescendant(element),
              stickyLikeDetected: style.position === 'sticky' ||
                style.position === 'fixed' ||
                (rect.top <= viewportHeight * 0.12 &&
                  rect.height >= viewportHeight * 0.35 &&
                  rect.height <= viewportHeight * 1.35)
            });
          }

          for (let leftIndex = 0; leftIndex < candidates.length; leftIndex += 1) {
            for (let rightIndex = leftIndex + 1; rightIndex < candidates.length; rightIndex += 1) {
              const first = candidates[leftIndex];
              const second = candidates[rightIndex];
              if (first.element.contains(second.element) || second.element.contains(first.element)) {
                continue;
              }

              const sideBySide = sideOf(first.rect) !== sideOf(second.rect) &&
                verticalOverlapRatio(first.rect, second.rect) >= 0.35 &&
                horizontalGap(first.rect, second.rect) <= viewportWidth * 0.12;
              if (!sideBySide) {
                continue;
              }

              const firstHeight = Math.max(first.rect.height, first.element.scrollHeight || 0);
              const secondHeight = Math.max(second.rect.height, second.element.scrollHeight || 0);
              const short = firstHeight <= secondHeight ? first : second;
              const tallHeight = Math.max(firstHeight, secondHeight);
              const shortHeight = Math.max(1, Math.min(firstHeight, secondHeight));
              const heightRatio = tallHeight / shortHeight;
              const mediaColumnLike = short.mediaColumnLike;
              const stickyLikeDetected = short.stickyLikeDetected;

              if (
                heightRatio < 1.6 ||
                tallHeight - shortHeight < viewportHeight * 0.35 ||
                !mediaColumnLike ||
                !stickyLikeDetected
              ) {
                continue;
              }

              return {
                splitLayoutRisk: true,
                splitLayoutRiskReason: 'two-column-sticky-media-mismatch',
                mediaColumnLike,
                tallColumnRatio: Number(heightRatio.toFixed(2)),
                stickyLikeDetected,
                shortColumnSide: sideOf(short.rect),
                heightRatio: Number(heightRatio.toFixed(2))
              };
            }
          }

          return empty;
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
        const isSkippableGeometryElement = (element, rect, style) => {
          if (!element || element === document.documentElement || element === document.body) {
            return true;
          }

          if (
            style.display === 'none' ||
            style.visibility === 'hidden' ||
            style.opacity === '0' ||
            style.position === 'fixed' ||
            style.position === 'sticky'
          ) {
            return true;
          }

          if (
            !Number.isFinite(rect.width) ||
            !Number.isFinite(rect.height) ||
            rect.width <= 0 ||
            rect.height <= 0
          ) {
            return true;
          }

          return false;
        };
        const shouldSkipGeometrySubtree = style =>
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.opacity === '0' ||
          style.position === 'fixed' ||
          style.position === 'sticky';
        const hasVisibleBoxStyling = style => {
          const borderWidth =
            parseFloat(style.borderTopWidth || '0') +
            parseFloat(style.borderRightWidth || '0') +
            parseFloat(style.borderBottomWidth || '0') +
            parseFloat(style.borderLeftWidth || '0');
          const radius =
            parseFloat(style.borderTopLeftRadius || '0') +
            parseFloat(style.borderTopRightRadius || '0') +
            parseFloat(style.borderBottomRightRadius || '0') +
            parseFloat(style.borderBottomLeftRadius || '0');
          const hasBackground = style.backgroundColor &&
            style.backgroundColor !== 'transparent' &&
            style.backgroundColor !== 'rgba(0, 0, 0, 0)';

          return borderWidth > 0 ||
            radius > 0 ||
            hasBackground ||
            (style.boxShadow && style.boxShadow !== 'none') ||
            style.overflow === 'hidden';
        };
        const hasSubstantialChildBox = (element, rect) => {
          const children = Array.from(element.children || []).slice(0, 12);
          return children.some(child => {
            const childRect = child.getBoundingClientRect();
            return childRect.width >= rect.width * 0.45 &&
              childRect.height >= Math.min(120, rect.height * 0.28);
          });
        };
        const isGeometryCardLikeBlock = (element, rect, style) => {
          if (rect.width < Math.min(160, viewportWidth * 0.12)) {
            return false;
          }

          if (rect.height < 96 || rect.height > viewportHeight * 1.35) {
            return false;
          }

          if (rect.width > viewportWidth * 0.72 || rect.width * rect.height > viewportArea * 0.48) {
            return false;
          }

          const display = style.display || '';
          const blockLikeDisplay = display.includes('block') ||
            display.includes('flex') ||
            display.includes('grid') ||
            display.includes('list-item') ||
            display.includes('table');
          if (!blockLikeDisplay) {
            return false;
          }

          return hasVisibleBoxStyling(style) || hasSubstantialChildBox(element, rect);
        };
        const addGeometryCardAvoidRanges = () => {
          const startedAt = performance.now();
          const withElapsed = diagnostics => ({
            ...diagnostics,
            elapsedMs: Math.round(Math.max(0, performance.now() - startedAt) * 10) / 10
          });

          if (!document.body) {
            return withElapsed({
              scanned: 0,
              cardAdded: 0,
              gridRowAdded: 0
            });
          }

          const maxScanned = 700;
          const maxAdded = 180;
          const rangeSafetyMargins = {
            card: 48,
            'grid-row': 72
          };
          const queue = Array.from(document.body.children || []);
          const accepted = [];
          let scanned = 0;
          let cardAdded = 0;
          let gridRowAdded = 0;

          const addAcceptedRange = (top, bottom, reason) => {
            if (accepted.length >= maxAdded) {
              return false;
            }

            if (!Number.isFinite(top) || !Number.isFinite(bottom) || bottom <= top) {
              return false;
            }

            const margin = rangeSafetyMargins[reason] || 0;
            const expandedTop = Math.max(0, top - margin);
            const expandedBottom = Math.min(pageHeight, bottom + margin);
            const duplicate = accepted.some(range =>
              expandedTop >= range.top - 2 &&
              expandedBottom <= range.bottom + 2
            );
            if (duplicate) {
              return false;
            }

            accepted.push({top: expandedTop, bottom: expandedBottom});
            addSplitExclusionRange(expandedTop, expandedBottom, reason);
            return true;
          };

          const collectDirectChildCards = element => {
            const cards = [];
            const children = Array.from(element.children || []).slice(0, 24);

            for (const child of children) {
              const childStyle = getComputedStyle(child);
              if (shouldSkipGeometrySubtree(childStyle)) {
                continue;
              }

              const childRect = child.getBoundingClientRect();
              if (
                isSkippableGeometryElement(child, childRect, childStyle) ||
                !isGeometryCardLikeBlock(child, childRect, childStyle)
              ) {
                continue;
              }

              cards.push({
                top: childRect.top,
                bottom: childRect.bottom,
                width: childRect.width
              });
            }

            return cards;
          };

          const collectGridRowRange = element => {
            const cards = collectDirectChildCards(element);
            if (cards.length < 2) {
              return null;
            }

            const rowTolerance = 24;
            const rows = [];

            for (const card of cards) {
              let row = rows.find(candidate =>
                Math.abs(candidate.top - card.top) <= rowTolerance ||
                Math.abs(candidate.bottom - card.bottom) <= rowTolerance ||
                (card.top < candidate.bottom - rowTolerance && card.bottom > candidate.top + rowTolerance)
              );

              if (!row) {
                row = {
                  top: card.top,
                  bottom: card.bottom,
                  count: 0,
                  widthSum: 0
                };
                rows.push(row);
              }

              row.top = Math.min(row.top, card.top);
              row.bottom = Math.max(row.bottom, card.bottom);
              row.count += 1;
              row.widthSum += card.width;
            }

            const best = rows
              .filter(row => {
                const rowHeight = row.bottom - row.top;
                return row.count >= 2 &&
                  rowHeight >= 140 &&
                  rowHeight <= viewportHeight * 1.35 &&
                  row.widthSum >= viewportWidth * 0.45;
              })
              .sort((a, b) => {
                if (b.count !== a.count) {
                  return b.count - a.count;
                }

                return b.widthSum - a.widthSum;
              })[0];

            if (!best) {
              return null;
            }

            return {
              top: best.top + window.scrollY,
              bottom: best.bottom + window.scrollY
            };
          };

          for (
            let index = 0;
            index < queue.length && scanned < maxScanned && accepted.length < maxAdded;
            index += 1
          ) {
            const element = queue[index];
            if (!element) {
              continue;
            }

            scanned += 1;
            const style = getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            if (shouldSkipGeometrySubtree(style)) {
              continue;
            }

            const gridRowRange = collectGridRowRange(element);
            if (gridRowRange && addAcceptedRange(gridRowRange.top, gridRowRange.bottom, 'grid-row')) {
              gridRowAdded += 1;
            }

            for (const child of Array.from(element.children || []).slice(0, 24)) {
              queue.push(child);
            }

            if (isSkippableGeometryElement(element, rect, style) || !isGeometryCardLikeBlock(element, rect, style)) {
              continue;
            }

            const documentTop = rect.top + window.scrollY;
            const documentBottom = rect.bottom + window.scrollY;
            if (addAcceptedRange(documentTop, documentBottom, 'card')) {
              cardAdded += 1;
            }
          }

          return withElapsed({
            scanned,
            cardAdded,
            gridRowAdded,
            safetyMarginCssPx: rangeSafetyMargins
          });
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

        const geometryAvoidRangeDiagnostics = addGeometryCardAvoidRanges();

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

          if (isEdgeAnchoredNarrowScrollCandidate(rect)) {
            continue;
          }

          if (
            area < viewportArea * 0.5 ||
            rect.width < viewportWidth * 0.65 ||
            rect.height < viewportHeight * 0.55 ||
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
        const splitExclusionSummary = summarizeSplitExclusionRanges();
        const capturePlan = createCapturePlan();
        const capturePlanSummary = summarizeCapturePlan(capturePlan);
        const splitLayoutRisk = detectSplitLayoutRisk();
        const scrollCandidateDiagnostics = candidates
          .slice(0, 12)
          .map(candidate => summarizeScrollCandidate(candidate, candidate === best))
          .filter(Boolean);
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
        const hasCloseSecondCandidate = Boolean(second && second.score >= best.score * 0.75);
        const useInternal = blockingModal.captureAction !== 'viewport-only' &&
          Boolean(best) &&
          windowScrollHeight <= windowScrollThreshold &&
          !hasCloseSecondCandidate;

        const quirkCaptureRoot = document.querySelector(`[${quirkCaptureRootAttribute}]`);
        if (quirkCaptureRoot) {
          const rect = quirkCaptureRoot.getBoundingClientRect();
          const style = getComputedStyle(quirkCaptureRoot);
          const rootVisible = style.display !== 'none' &&
            style.visibility !== 'hidden' &&
            style.opacity !== '0' &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < viewportHeight &&
            rect.left < viewportWidth;

          if (rootVisible) {
            const scrollPlanHeight = Math.max(
              quirkCaptureRoot.scrollHeight,
              quirkCaptureRoot.clientHeight,
              Math.round(rect.height),
              viewportHeight
            );
            const scrollPlanWidth = Math.max(
              quirkCaptureRoot.scrollWidth,
              quirkCaptureRoot.clientWidth,
              Math.round(rect.width)
            );
            quirkCaptureRoot.setAttribute(captureTargetAttribute, 'main');

            return {
              width: viewportWidth,
              height: Math.max(viewportHeight, Math.max(0, rect.top) + scrollPlanHeight),
              w: viewportWidth,
              h: Math.max(1, Math.round(Math.min(rect.height, viewportHeight - Math.max(0, rect.top)))),
              scrollPlanWidth,
              scrollPlanHeight,
              scrollPlanViewportWidth: Math.max(1, quirkCaptureRoot.clientWidth || Math.round(rect.width)),
              scrollPlanViewportHeight: Math.max(1, quirkCaptureRoot.clientHeight || Math.round(rect.height)),
              ratio: window.devicePixelRatio,
              backgroundColor,
              x: quirkCaptureRoot.scrollLeft,
              y: quirkCaptureRoot.scrollTop,
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
                composeMode: 'lightbox-root',
                attribute: captureTargetAttribute,
                quirk: 'known-lightbox-root',
                candidateCount: candidates.length
              },
              capturePolicy,
              diagnostics: {
                iframeCount: frames.length,
                inaccessibleIframeCount: inaccessibleFrames.length,
                scrollTargetType: 'element',
                scrollTargetComposeMode: 'lightbox-root',
                internalScrollCandidateCount: candidates.length,
                windowScrollHeight,
                windowScrollThreshold,
                selectedScrollCandidate: summarizeScrollCandidate({
                  element: quirkCaptureRoot,
                  rect
                }, true),
                internalScrollCandidates: scrollCandidateDiagnostics,
                splitCandidateCount: splitCandidates.length,
                splitExclusionRangeCount: splitExclusionRanges.length,
                splitExclusionSummary,
                geometryAvoidRangeDiagnostics,
                ...splitLayoutRisk,
                capturePolicy,
                quirks: activeQuirks,
                ...pageRisk
              }
            };
          }
        }

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
              windowScrollHeight,
              windowScrollThreshold,
              selectedScrollCandidate: summarizeScrollCandidate(best, true),
              internalScrollCandidates: scrollCandidateDiagnostics,
              splitCandidateCount: splitCandidates.length,
              splitExclusionRangeCount: splitExclusionRanges.length,
              splitExclusionSummary,
              geometryAvoidRangeDiagnostics,
              ...splitLayoutRisk,
              capturePolicy,
              quirks: activeQuirks,
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
          capturePlan,
          diagnostics: {
            iframeCount: frames.length,
            inaccessibleIframeCount: inaccessibleFrames.length,
            scrollTargetType: 'window',
            internalScrollCandidateCount: candidates.length,
            windowScrollHeight,
            windowScrollThreshold,
            selectedScrollCandidate: null,
            internalScrollCandidates: scrollCandidateDiagnostics,
            splitCandidateCount: splitCandidates.length,
            splitExclusionRangeCount: splitExclusionRanges.length,
            splitExclusionSummary,
            geometryAvoidRangeDiagnostics,
            capturePlanSummary,
            ...splitLayoutRisk,
            rawPageWidth,
            measuredPageWidth: pageWidth,
            widthClampedToViewport: rawPageWidth > viewportWidth + 2,
            blockingModal,
            capturePolicy,
            quirks: activeQuirks,
            ...pageRisk
          }
        };
        }
        catch (error) {
          return {
            __pageProbeError: true,
            message: error?.message || String(error),
            stack: error?.stack || ''
          };
        }
        },
        args: [quirkHints || {}],
        injectImmediately: true
      });
    }
    catch (error) {
      throw new Error(`PageProbe executeScript failed: ${error?.message || error}`);
    }

    const result = Array.isArray(results) ? results[0] : null;
    if (!result) {
      throw new Error('PageProbe returned no executeScript result.');
    }

    if (!result.result || typeof result.result !== 'object') {
      throw new Error(`PageProbe returned empty measurement result: ${String(result.result)}`);
    }

    if (result.result.__pageProbeRetryable) {
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 200));
        return this.measure(tabId, quirkHints, attempt + 1);
      }

      throw new Error(`PageProbe measurement not ready: ${result.result.message || 'unknown retryable state'}`);
    }

    if (result.result.__pageProbeError) {
      throw new Error(`PageProbe injected probe failed: ${result.result.message || 'unknown error'}`);
    }

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
    const [executionResult] = await this.chrome.scripting.executeScript({
      target: {tabId},
      func: () => {
        const bodyStyle = document.body ? getComputedStyle(document.body) : null;
        const htmlStyle = document.documentElement ? getComputedStyle(document.documentElement) : null;
        const compactDescriptor = element => {
          if (!element) {
            return '';
          }

          const tag = String(element.tagName || '').toLowerCase();
          const id = element.id ? `#${element.id}` : '';
          const className = String(element.className || '')
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(value => `.${value}`)
            .join('');

          return `${tag}${id}${className}`;
        };
        const buildState = ({
          x,
          y,
          targetType,
          targetDescriptor = '',
          scrollWidth,
          scrollHeight,
          clientWidth,
          clientHeight
        }) => {
          const maxX = Math.max(0, Math.round((Number(scrollWidth) || 0) - (Number(clientWidth) || 0)));
          const maxY = Math.max(0, Math.round((Number(scrollHeight) || 0) - (Number(clientHeight) || 0)));
          const roundedX = Math.round(Number(x) || 0);
          const roundedY = Math.round(Number(y) || 0);

          return {
            x: roundedX,
            y: roundedY,
            targetType,
            targetDescriptor,
            maxX,
            maxY,
            atMaxX: maxX - roundedX <= 2,
            atMaxY: maxY - roundedY <= 2,
            scrollWidth: Math.round(Number(scrollWidth) || 0),
            scrollHeight: Math.round(Number(scrollHeight) || 0),
            clientWidth: Math.round(Number(clientWidth) || 0),
            clientHeight: Math.round(Number(clientHeight) || 0),
            bodyOverflowY: bodyStyle?.overflowY || '',
            htmlOverflowY: htmlStyle?.overflowY || '',
            bodyPosition: bodyStyle?.position || '',
            htmlPosition: htmlStyle?.position || ''
          };
        };
        const target = document.querySelector('[data-screenshot-extension-capture-target="main"]');

        if (target) {
          return buildState({
            x: target.scrollLeft,
            y: target.scrollTop,
            targetType: 'element',
            targetDescriptor: compactDescriptor(target),
            scrollWidth: target.scrollWidth,
            scrollHeight: target.scrollHeight,
            clientWidth: target.clientWidth,
            clientHeight: target.clientHeight
          });
        }

        const scrollingElement = document.scrollingElement || document.documentElement || document.body;
        const scrollWidth = Math.max(
          scrollingElement?.scrollWidth || 0,
          document.documentElement?.scrollWidth || 0,
          document.body?.scrollWidth || 0
        );
        const scrollHeight = Math.max(
          scrollingElement?.scrollHeight || 0,
          document.documentElement?.scrollHeight || 0,
          document.body?.scrollHeight || 0
        );

        return buildState({
          x: window.scrollX || document.documentElement.scrollLeft || document.body.scrollLeft || 0,
          y: window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0,
          targetType: 'window',
          targetDescriptor: compactDescriptor(scrollingElement),
          scrollWidth,
          scrollHeight,
          clientWidth: window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth || 0,
          clientHeight: window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight || 0
        });
      },
      injectImmediately: true
    });

    if (!executionResult?.result || typeof executionResult.result !== 'object') {
      throw new Error(`PageProbe readScroll returned empty result: ${String(executionResult?.result)}`);
    }

    return executionResult.result;
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
