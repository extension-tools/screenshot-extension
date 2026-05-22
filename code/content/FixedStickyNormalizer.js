(function() {
  class FixedStickyNormalizer {
    constructor({stack}) {
      this.stack = stack;
      this.hiddenElements = new WeakSet();
      this.normalizedStickyElements = new WeakSet();
      this.stickyNormalizationRuleRoots = new WeakSet();
      this.stickyNormalizationPrepared = false;
      this.repeatOverlaySuppressionApplied = false;
      this.dimmedBackdropSnapshot = null;
      this.syntheticDimBackdrop = null;
      this.repeatedEdgeOverlaySnapshots = [];
    }

    beforeFrame({frameIndex = 0, stage = null, capturePolicy = null} = {}) {
      const policy = this.normalizeCapturePolicy(capturePolicy);
      const afterFirstFramePolicy = policy.afterFirstFrame || {};
      const isFirstFrame = Number(frameIndex) === 0;
      const dimmedBackdropRecorded = isFirstFrame && afterFirstFramePolicy.preserveDimmedBackdrop !== false ?
        this.recordDimmedBackdropState({frameIndex, capturePolicy: policy}) :
        false;
      const repeatedEdgeOverlaySuppression = afterFirstFramePolicy.suppressRepeatedOverlays !== false ?
        (isFirstFrame ?
          this.recordRepeatedEdgeOverlaySnapshots() :
          this.hideRepeatedEdgeOverlays({frameIndex})) :
        {
          snapshotCount: this.repeatedEdgeOverlaySnapshots.length,
          hiddenCount: 0
        };
      const dimmedBackdropPanelsHidden = !isFirstFrame && afterFirstFramePolicy.preserveDimmedBackdrop !== false ?
        this.preserveDimmedBackdropState({frameIndex}) :
        0;
      const suppressionApplied = !isFirstFrame && afterFirstFramePolicy.suppressRepeatedOverlays !== false ?
        this.ensureRepeatOverlaySuppression({frameIndex}) :
        false;
      const syntheticDimBackdropApplied = !isFirstFrame && afterFirstFramePolicy.preserveDimmedBackdrop !== false ?
        this.ensureSyntheticDimmedBackdrop({frameIndex}) :
        false;
      const candidates = this.findCandidates({frameIndex, capturePolicy: policy});
      const chromeDiagnostics = this.collectChromeDiagnostics({
        frameIndex,
        stage,
        capturePolicy: policy,
        candidates
      });
      let hidden = repeatedEdgeOverlaySuppression.hiddenCount;
      let transformed = 0;

      for (const candidate of candidates) {
        const element = candidate.element || candidate;
        if (this.hiddenElements.has(element)) {
          continue;
        }

        const action = candidate.action || 'hide';
        this.applyElementAction(element, action, candidate.rect);
        this.hiddenElements.add(element);
        if (action === 'hide') {
          hidden += 1;
        }
        else {
          transformed += 1;
        }
      }

      return {
        hidden,
        transformed,
        suppressionApplied,
        dimmedBackdropPanelsHidden,
        syntheticDimBackdropApplied,
        dimmedBackdropRecorded,
        dimmedBackdropSnapshot: Boolean(this.dimmedBackdropSnapshot),
        dimmedBackdropSource: this.dimmedBackdropSnapshot?.source || null,
        capturePolicyApplied: Boolean(capturePolicy),
        suppressVisibleNavOverlay: !isFirstFrame && Boolean(afterFirstFramePolicy.suppressVisibleNavOverlay),
        repeatedEdgeOverlaySuppression,
        chromeCandidates: chromeDiagnostics.candidates,
        chromeCandidateCount: chromeDiagnostics.candidateCount,
        chromeCandidateKinds: chromeDiagnostics.kinds
      };
    }

    normalizeCapturePolicy(capturePolicy) {
      if (capturePolicy && typeof capturePolicy === 'object') {
        return capturePolicy;
      }

      return {
        version: 1,
        mode: 'full-page',
        reasons: [],
        preserveFirstFrame: true,
        firstFrame: {
          preserveUserState: true,
          normalizeFixedSticky: false,
          suppressVisibleNavOverlay: false,
          suppressRepeatedOverlays: false,
          preserveDimmedBackdrop: false
        },
        afterFirstFrame: {
          normalizeFixedSticky: true,
          suppressVisibleNavOverlay: false,
          suppressRepeatedOverlays: true,
          preserveDimmedBackdrop: true
        }
      };
    }

    prepareStickyNormalization({capturePolicy = null} = {}) {
      if (this.stickyNormalizationPrepared || !document.body) {
        return {
          applied: false,
          normalized: 0,
          reason: this.stickyNormalizationPrepared ? 'already-prepared' : 'missing-body'
        };
      }

      const policy = this.normalizeCapturePolicy(capturePolicy);
      if (policy.mode === 'viewport-only') {
        return {
          applied: false,
          normalized: 0,
          reason: 'viewport-only'
        };
      }

      this.stickyNormalizationPrepared = true;

      const normalizedElements = [];
      const roots = new Set();
      const shadowRoots = new Set();
      for (const element of this.collectElements(document.body)) {
        if (this.normalizedStickyElements.has(element) || this.shouldSkipBlanketStickyNormalization(element)) {
          continue;
        }

        const style = getComputedStyle(element);
        if (style.position !== 'sticky') {
          continue;
        }

        this.stack.setAttribute(element, 'data-screenshot-extension-sticky-normalized', 'true');
        this.convertStickyToRelative(element);
        this.normalizedStickyElements.add(element);
        normalizedElements.push(element);

        const root = element.getRootNode ? element.getRootNode() : document;
        if (root) {
          roots.add(root);
          if (root !== document) {
            shadowRoots.add(root);
          }
        }
      }

      for (const root of roots) {
        this.installStickyNormalizationRule(root);
      }

      return {
        applied: true,
        normalized: normalizedElements.length,
        shadowRootCount: shadowRoots.size,
        ruleRootCount: roots.size,
        reason: 'blanket-sticky-to-relative'
      };
    }

    shouldSkipBlanketStickyNormalization(element) {
      return !element ||
        element === document.documentElement ||
        element === document.body ||
        element.hasAttribute('data-screenshot-extension-quirk-capture-root') ||
        element.hasAttribute('data-screenshot-extension-quirk-fixed-background') ||
        element.hasAttribute('data-screenshot-extension-sticky-normalized') ||
        element.hasAttribute('data-screenshot-extension-preserve-dim-backdrop') ||
        element.hasAttribute('data-screenshot-extension-preserve-dim-container');
    }

    installStickyNormalizationRule(root = document) {
      if (!root || this.stickyNormalizationRuleRoots.has(root)) {
        return false;
      }

      const parent = root === document ?
        (document.head || document.documentElement) :
        root;
      if (!parent || !parent.appendChild) {
        return false;
      }

      const style = document.createElement('style');
      style.setAttribute('data-screenshot-extension-sticky-normalization', 'true');
      style.textContent = `
        [data-screenshot-extension-sticky-normalized="true"] {
          position: relative !important;
          top: auto !important;
          right: auto !important;
          bottom: auto !important;
          left: auto !important;
          inset: auto !important;
          inset-block-start: auto !important;
          inset-block-end: auto !important;
          inset-inline-start: auto !important;
          inset-inline-end: auto !important;
        }
      `;

      this.stack.appendNode(parent, style);
      this.stickyNormalizationRuleRoots.add(root);
      return true;
    }

    recordRepeatedEdgeOverlaySnapshots() {
      if (this.repeatedEdgeOverlaySnapshots.length || !document.body) {
        return {
          snapshotCount: this.repeatedEdgeOverlaySnapshots.length,
          hiddenCount: 0
        };
      }

      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const snapshots = [];

      for (const element of this.collectElements(document.body)) {
        if (snapshots.length >= 10) {
          break;
        }

        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        const edge = this.repeatedEdgeOverlayEdge(rect, viewportHeight);

        if (!edge ||
          !this.isRepeatedEdgeOverlayCandidate(element, style, rect, viewportWidth, viewportHeight) ||
          this.isRepeatedEdgeOverlayProtected(element, style) ||
          !this.isVisibleRect(rect, viewportWidth, viewportHeight)
        ) {
          continue;
        }

        snapshots.push({
          element,
          edge,
          rect: this.rectSnapshot(rect)
        });
      }

      this.repeatedEdgeOverlaySnapshots = snapshots;
      return {
        snapshotCount: snapshots.length,
        hiddenCount: 0
      };
    }

    hideRepeatedEdgeOverlays({frameIndex}) {
      if (!document.body || Number(frameIndex) === 0 || !this.repeatedEdgeOverlaySnapshots.length) {
        return {
          snapshotCount: this.repeatedEdgeOverlaySnapshots.length,
          hiddenCount: 0
        };
      }

      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      let hiddenCount = 0;

      for (const snapshot of this.repeatedEdgeOverlaySnapshots) {
        const element = snapshot.element;
        if (!element || !element.isConnected || this.hiddenElements.has(element)) {
          continue;
        }

        const style = getComputedStyle(element);
        if (this.isRepeatedEdgeOverlayProtected(element, style)) {
          continue;
        }

        const rect = element.getBoundingClientRect();
        const edge = this.repeatedEdgeOverlayEdge(rect, viewportHeight);
        if (edge !== snapshot.edge ||
          !this.isVisibleRect(rect, viewportWidth, viewportHeight) ||
          !this.isRepeatedEdgeOverlayCandidate(element, style, rect, viewportWidth, viewportHeight) ||
          !this.isNearlySameRect(snapshot.rect, rect)
        ) {
          continue;
        }

        this.hideElement(element);
        this.hiddenElements.add(element);
        hiddenCount += 1;
      }

      return {
        snapshotCount: this.repeatedEdgeOverlaySnapshots.length,
        hiddenCount
      };
    }

    isRepeatedEdgeOverlayCandidate(element, style, rect, viewportWidth, viewportHeight) {
      if (!element || style.position !== 'fixed') {
        return false;
      }

      const area = rect.width * rect.height;
      const viewportArea = viewportWidth * viewportHeight;
      const wideEnough = rect.width >= viewportWidth * 0.35;
      const notFullscreen = area <= viewportArea * 0.55;
      const visibleInteractionLayer = style.pointerEvents !== 'none' &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0';

      return rect.width > 0 &&
        rect.height > 0 &&
        wideEnough &&
        notFullscreen &&
        visibleInteractionLayer;
    }

    isRepeatedEdgeOverlayProtected(element, style) {
      return !element ||
        style.position === 'sticky' ||
        element.hasAttribute('data-screenshot-extension-sticky-normalized') ||
        element.hasAttribute('data-screenshot-extension-quirk-capture-root') ||
        element.hasAttribute('data-screenshot-extension-quirk-fixed-background') ||
        element.hasAttribute('data-screenshot-extension-preserve-dim-backdrop') ||
        element.hasAttribute('data-screenshot-extension-preserve-dim-container');
    }

    repeatedEdgeOverlayEdge(rect, viewportHeight) {
      const threshold = Math.min(18, Math.max(8, viewportHeight * 0.025));
      if (rect.top <= threshold) {
        return 'top';
      }
      if (rect.bottom >= viewportHeight - threshold) {
        return 'bottom';
      }
      return null;
    }

    rectSnapshot(rect) {
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height
      };
    }

    isNearlySameRect(snapshot, rect) {
      const tolerance = 8;
      const sizeTolerance = 12;
      return Math.abs(snapshot.left - rect.left) <= tolerance &&
        Math.abs(snapshot.top - rect.top) <= tolerance &&
        Math.abs(snapshot.width - rect.width) <= sizeTolerance &&
        Math.abs(snapshot.height - rect.height) <= sizeTolerance;
    }

    ensureRepeatOverlaySuppression({frameIndex}) {
      if (this.repeatOverlaySuppressionApplied || Number(frameIndex) === 0 || !document.documentElement) {
        return false;
      }

      const style = document.createElement('style');
      style.setAttribute('data-screenshot-extension-repeat-overlay-suppression', 'true');
      style.textContent = `
        html body [role="dialog"][aria-modal="true"]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body dialog[open]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [popover]:popover-open:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body .modal.show:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body .modal-backdrop:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [class*="modal-backdrop"]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [id*="onetrust" i]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [class*="onetrust" i]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [id*="truste" i]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [class*="truste" i]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [id*="trustarc" i]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [class*="trustarc" i]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [id*="didomi" i]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [class*="didomi" i]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [id*="usercentrics" i]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [class*="usercentrics" i]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [id*="sp_message" i]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [class*="sp_message" i]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [id*="cookie-banner" i]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [class*="cookie-banner" i]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [id*="cookie-consent" i]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [class*="cookie-consent" i]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [class*="overlay"][aria-modal="true"]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [class*="popup"][aria-modal="true"]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]),
        html body [class*="popover"][aria-modal="true"]:not([data-screenshot-extension-preserve-dim-backdrop]):not([data-screenshot-extension-preserve-dim-container]) {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
      `;

      const parent = document.head || document.documentElement;
      this.stack.appendNode(parent, style);
      this.repeatOverlaySuppressionApplied = true;
      return true;
    }

    preserveDimmedBackdropState({frameIndex}) {
      if (!document.body || Number(frameIndex) === 0) {
        return 0;
      }

      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      let hiddenPanels = 0;

      for (const element of this.collectElements(document.body)) {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        if (!this.isLikelyDimmedBackdropHost(element, style, rect, viewportWidth, viewportHeight)) {
          continue;
        }

        if (!element.hasAttribute('data-screenshot-extension-preserve-dim-backdrop')) {
          this.stack.setAttribute(element, 'data-screenshot-extension-preserve-dim-backdrop', 'true');
        }
        this.preserveDimmedBackdropContainerChain(element);

        this.stack.setStyle(element, 'display', 'flex', 'important');
        this.stack.setStyle(element, 'visibility', 'visible', 'important');
        this.stack.setStyle(element, 'position', 'fixed', 'important');
        this.stack.setStyle(element, 'inset', '0', 'important');
        this.stack.setStyle(element, 'pointer-events', 'none', 'important');

        for (const panel of this.findLikelyModalPanels(element, viewportWidth, viewportHeight)) {
          this.stack.setStyle(panel, 'visibility', 'hidden', 'important');
          this.stack.setStyle(panel, 'pointer-events', 'none', 'important');
          hiddenPanels += 1;
        }
      }

      return hiddenPanels;
    }

    recordDimmedBackdropState({frameIndex = 0, capturePolicy = null} = {}) {
      if (!document.body || this.dimmedBackdropSnapshot || Number(frameIndex) !== 0) {
        return false;
      }

      const policy = this.normalizeCapturePolicy(capturePolicy);
      if (policy.mode !== 'full-page') {
        return false;
      }

      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      for (const element of this.collectElements(document.body)) {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();

        if (style.position !== 'fixed') {
          continue;
        }

        if (!this.isNearViewportCover(rect, viewportWidth, viewportHeight, 0.85, 24)) {
          continue;
        }

        if (!this.hasModalBackdropContext(element, viewportWidth, viewportHeight)) {
          continue;
        }

        if (this.hasDimmedBackdropPaint(style)) {
          this.dimmedBackdropSnapshot = {
            backgroundColor: this.createSyntheticBackdropColor(style),
            zIndex: this.createSyntheticBackdropZIndex(style),
            source: 'fixed-backdrop'
          };
          return true;
        }

        for (const child of Array.from(element.children || [])) {
          const childStyle = getComputedStyle(child);
          const childRect = child.getBoundingClientRect();

          if (!this.isNearViewportCover(childRect, viewportWidth, viewportHeight, 0.75, 32)) {
            continue;
          }

          if (!this.hasDimmedBackdropPaint(childStyle)) {
            continue;
          }

          this.dimmedBackdropSnapshot = {
            backgroundColor: this.createSyntheticBackdropColor(childStyle),
            zIndex: this.createSyntheticBackdropZIndex(style),
            source: 'direct-child-backdrop'
          };
          return true;
        }
      }

      return false;
    }

    isNearViewportCover(rect, viewportWidth, viewportHeight, minAreaRatio, insetTolerance) {
      const viewportArea = viewportWidth * viewportHeight;

      return rect.width * rect.height >= viewportArea * minAreaRatio &&
        rect.top <= insetTolerance &&
        rect.left <= insetTolerance &&
        rect.bottom >= viewportHeight - insetTolerance &&
        rect.right >= viewportWidth - insetTolerance;
    }

    hasModalBackdropContext(element, viewportWidth, viewportHeight) {
      const descriptor = [
        element.tagName,
        element.id,
        element.className,
        element.getAttribute('role'),
        element.getAttribute('aria-modal')
      ].join(' ').toLowerCase();

      return /dialog|modal|popover|popup|overlay|backdrop|consent|cookie/.test(descriptor) ||
        element.matches('dialog[open], [aria-modal="true"], [role="dialog"], [popover]') ||
        this.findLikelyModalPanels(element, viewportWidth, viewportHeight).length > 0;
    }

    ensureSyntheticDimmedBackdrop({frameIndex}) {
      if (!document.body || Number(frameIndex) === 0 || !this.dimmedBackdropSnapshot) {
        return false;
      }

      if (this.hasVisibleDimmedBackdropHost({excludeSynthetic: true})) {
        return false;
      }

      if (!this.syntheticDimBackdrop || !this.syntheticDimBackdrop.isConnected) {
        this.syntheticDimBackdrop = document.createElement('div');
        this.syntheticDimBackdrop.setAttribute('data-screenshot-extension-synthetic-dim-backdrop', 'true');
        this.syntheticDimBackdrop.setAttribute('data-screenshot-extension-preserve-dim-backdrop', 'true');
        this.stack.appendNode(document.body, this.syntheticDimBackdrop);
      }

      this.stack.setStyle(this.syntheticDimBackdrop, 'position', 'fixed', 'important');
      this.stack.setStyle(this.syntheticDimBackdrop, 'inset', '0', 'important');
      this.stack.setStyle(this.syntheticDimBackdrop, 'width', '100vw', 'important');
      this.stack.setStyle(this.syntheticDimBackdrop, 'height', '100vh', 'important');
      this.stack.setStyle(this.syntheticDimBackdrop, 'display', 'block', 'important');
      this.stack.setStyle(this.syntheticDimBackdrop, 'visibility', 'visible', 'important');
      this.stack.setStyle(this.syntheticDimBackdrop, 'pointer-events', 'none', 'important');
      this.stack.setStyle(this.syntheticDimBackdrop, 'background', this.dimmedBackdropSnapshot.backgroundColor, 'important');
      this.stack.setStyle(this.syntheticDimBackdrop, 'z-index', String(this.dimmedBackdropSnapshot.zIndex), 'important');
      return true;
    }

    hasVisibleDimmedBackdropHost({excludeSynthetic = false} = {}) {
      if (!document.body) {
        return false;
      }

      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      for (const element of this.collectElements(document.body)) {
        if (excludeSynthetic && element === this.syntheticDimBackdrop) {
          continue;
        }

        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden') {
          continue;
        }

        const rect = element.getBoundingClientRect();
        if (this.isLikelyDimmedBackdropHost(element, style, rect, viewportWidth, viewportHeight)) {
          return true;
        }
      }

      return false;
    }

    preserveDimmedBackdropContainerChain(element) {
      let current = element.parentElement;

      while (current && current !== document.body && current !== document.documentElement) {
        if (this.isLikelyDimmedBackdropContainer(current)) {
          this.stack.setAttribute(current, 'data-screenshot-extension-preserve-dim-container', 'true');
        }
        current = current.parentElement;
      }
    }

    findCandidates({frameIndex, capturePolicy = null}) {
      if (!document.body || Number(frameIndex) === 0) {
        return [];
      }

      const afterFirstFramePolicy = (capturePolicy || this.normalizeCapturePolicy()).afterFirstFrame || {};
      if (
        afterFirstFramePolicy.normalizeFixedSticky === false &&
        afterFirstFramePolicy.suppressVisibleNavOverlay === false &&
        afterFirstFramePolicy.suppressRepeatedOverlays === false
      ) {
        return [];
      }

      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const viewportArea = viewportWidth * viewportHeight;
      const edgeThreshold = 16;
      const elements = this.collectElements(document.body);
      const candidates = [];

      for (const element of elements) {
        const style = getComputedStyle(element);

        if (style.display === 'none' || style.visibility === 'hidden') {
          continue;
        }

        if (element.hasAttribute('data-screenshot-extension-quirk-capture-root')) {
          continue;
        }

        if (element.hasAttribute('data-screenshot-extension-quirk-fixed-background')) {
          continue;
        }

        const rect = element.getBoundingClientRect();

        if (!this.isVisibleRect(rect, viewportWidth, viewportHeight)) {
          continue;
        }

        const fullscreenOverlayHost = this.isLikelyFullscreenOverlayHost(
          element,
          style,
          rect,
          viewportWidth,
          viewportHeight
        );

        if (rect.width * rect.height > viewportArea * 0.95 && !fullscreenOverlayHost) {
          continue;
        }

        const action = this.classifyElementAction(
          element,
          style,
          rect,
          viewportWidth,
          viewportHeight,
          edgeThreshold,
          frameIndex,
          fullscreenOverlayHost,
          capturePolicy
        );

        if (!action) {
          continue;
        }

        candidates.push({element, action, rect});
      }

      return candidates;
    }

    collectChromeDiagnostics({frameIndex = 0, stage = null, capturePolicy = null, candidates = []} = {}) {
      if (!document.body || stage === 'before-scroll') {
        return {
          candidates: [],
          candidateCount: 0,
          kinds: []
        };
      }

      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const edgeThreshold = 16;
      const actionByElement = new WeakMap();
      for (const candidate of candidates || []) {
        if (candidate?.element) {
          actionByElement.set(candidate.element, candidate.action || 'observe');
        }
      }

      const diagnostics = [];
      const kinds = new Set();
      let candidateCount = 0;

      for (const element of this.collectElements(document.body).slice(0, 900)) {
        if (element === document.documentElement || element === document.body) {
          continue;
        }

        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          continue;
        }

        const rect = element.getBoundingClientRect();
        if (!this.isVisibleRect(rect, viewportWidth, viewportHeight)) {
          continue;
        }

        const kind = this.classifyChromeDiagnosticKind(
          element,
          style,
          rect,
          viewportWidth,
          viewportHeight,
          edgeThreshold,
          capturePolicy
        );
        if (!kind) {
          continue;
        }

        candidateCount += 1;
        kinds.add(kind);

        if (diagnostics.length >= 24) {
          continue;
        }

        diagnostics.push(this.createChromeDiagnosticCandidate({
          element,
          style,
          rect,
          kind,
          action: actionByElement.get(element) || 'observe',
          frameIndex
        }));
      }

      return {
        candidates: diagnostics,
        candidateCount,
        kinds: Array.from(kinds).sort()
      };
    }

    classifyChromeDiagnosticKind(element, style, rect, viewportWidth, viewportHeight, edgeThreshold, capturePolicy) {
      if (
        element.hasAttribute('data-screenshot-extension-quirk-capture-root') ||
        element.hasAttribute('data-screenshot-extension-quirk-fixed-background') ||
        element.hasAttribute('data-screenshot-extension-sticky-normalized') ||
        element.hasAttribute('data-screenshot-extension-preserve-dim-backdrop') ||
        element.hasAttribute('data-screenshot-extension-preserve-dim-container')
      ) {
        return null;
      }

      if (this.isLikelyEdgeConsentOverlay(element, style, rect, viewportWidth, viewportHeight, edgeThreshold)) {
        return 'cookie_strip';
      }

      if (this.isLikelyFloatingEdgeWidget(element, style, rect, viewportWidth, viewportHeight, edgeThreshold)) {
        return 'floating_widget';
      }

      if (this.isLikelySideChrome(element, style, rect, viewportWidth, viewportHeight)) {
        return this.isLikelyFilterPanelChrome(element) ? 'filter_panel' : 'side_sidebar';
      }

      if (this.isLikelyTopNavigationChrome(element, style, rect, viewportWidth, viewportHeight, edgeThreshold)) {
        return 'top_header';
      }

      const policy = this.normalizeCapturePolicy(capturePolicy);
      const afterFirstFramePolicy = policy.afterFirstFrame || {};
      if (
        afterFirstFramePolicy.suppressVisibleNavOverlay &&
        this.isLikelyVisibleNavOverlay(element, style, rect, viewportWidth, viewportHeight) &&
        !this.isLikelyProductOrMediaContent(element, rect, viewportWidth, viewportHeight)
      ) {
        return 'visible_nav_overlay';
      }

      if (style.position === 'fixed' && this.isPinnedToViewportEdge(rect, viewportWidth, viewportHeight, edgeThreshold)) {
        return 'fixed_unknown';
      }

      if (style.position === 'sticky' && this.isPinnedToViewportEdge(rect, viewportWidth, viewportHeight, edgeThreshold)) {
        return 'sticky_unknown';
      }

      return null;
    }

    isLikelyFilterPanelChrome(element) {
      const descriptor = [
        element.tagName,
        element.id,
        element.className,
        element.getAttribute('role'),
        element.getAttribute('aria-label')
      ].join(' ').toLowerCase();
      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

      return /filter|filters|facet|facets|refine|category|categories/.test(descriptor) ||
        text.includes('store pickup') ||
        text.includes('ship to address') ||
        text.startsWith('filter');
    }

    createChromeDiagnosticCandidate({element, style, rect, kind, action, frameIndex}) {
      const descriptor = [
        element.tagName,
        element.id,
        element.className,
        element.getAttribute('role'),
        element.getAttribute('aria-label')
      ].join(' ').replace(/\s+/g, ' ').trim().slice(0, 240);
      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 320);
      const edge = this.chromeEdgeBucket(rect);
      const size = `${Math.round(rect.width / 20) * 20}x${Math.round(rect.height / 20) * 20}`;
      const descriptorHash = this.hashString(descriptor);
      const textHash = this.hashString(text);

      return {
        frameIndex: Number(frameIndex) || 0,
        kind,
        action,
        position: style.position || 'static',
        edge,
        size,
        rect: [
          Math.round(rect.left),
          Math.round(rect.top),
          Math.round(rect.width),
          Math.round(rect.height)
        ].join(','),
        textLength: text.length,
        signature: `${kind}:${edge}:${size}:${descriptorHash}:${textHash}`
      };
    }

    chromeEdgeBucket(rect) {
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

      if (rect.top <= Math.min(140, viewportHeight * 0.16)) {
        return 'top';
      }

      if (rect.bottom >= viewportHeight - Math.min(96, viewportHeight * 0.12)) {
        return 'bottom';
      }

      if (rect.left <= viewportWidth * 0.24) {
        return 'left';
      }

      if (rect.right >= viewportWidth * 0.76) {
        return 'right';
      }

      return 'center';
    }

    hashString(value) {
      const input = String(value || '');
      let hash = 0;

      for (let index = 0; index < input.length; index += 1) {
        hash = ((hash << 5) - hash + input.charCodeAt(index)) | 0;
      }

      return Math.abs(hash).toString(36);
    }

    applyElementAction(element, action, rect) {
      if (action === 'fixed-to-absolute') {
        this.convertFixedToAbsolute(element, rect);
        return;
      }

      if (action === 'sticky-to-relative') {
        this.convertStickyToRelative(element);
        return;
      }

      this.hideElement(element);
    }

    hideElement(element) {
      if (this.isLikelyOpenDialogHost(element)) {
        this.stack.setStyle(element, 'display', 'none', 'important');
        return;
      }

      this.stack.setStyle(element, 'visibility', 'hidden', 'important');
    }

    convertFixedToAbsolute(element, rect) {
      this.stack.setStyle(element, 'position', 'absolute', 'important');
      this.stack.setStyle(element, 'top', `${Math.max(0, Math.round(rect.top))}px`, 'important');
      this.stack.setStyle(element, 'right', 'auto', 'important');
      this.stack.setStyle(element, 'bottom', 'auto', 'important');
      this.stack.setStyle(element, 'left', `${Math.max(0, Math.round(rect.left))}px`, 'important');
      this.stack.setStyle(element, 'width', `${Math.round(rect.width)}px`, 'important');
      this.stack.setStyle(element, 'height', `${Math.round(rect.height)}px`, 'important');
      this.stack.setStyle(element, 'transform', 'none', 'important');
    }

    convertStickyToRelative(element) {
      this.stack.setStyle(element, 'position', 'relative', 'important');
      this.stack.setStyle(element, 'top', 'auto', 'important');
      this.stack.setStyle(element, 'right', 'auto', 'important');
      this.stack.setStyle(element, 'bottom', 'auto', 'important');
      this.stack.setStyle(element, 'left', 'auto', 'important');
      this.stack.setStyle(element, 'inset', 'auto', 'important');
      this.stack.setStyle(element, 'inset-block-start', 'auto', 'important');
      this.stack.setStyle(element, 'inset-block-end', 'auto', 'important');
      this.stack.setStyle(element, 'inset-inline-start', 'auto', 'important');
      this.stack.setStyle(element, 'inset-inline-end', 'auto', 'important');
    }

    collectElements(root) {
      const elements = [];
      const stack = [root];

      while (stack.length) {
        const current = stack.pop();

        if (!current || !current.querySelectorAll) {
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

    classifyElementAction(element, style, rect, viewportWidth, viewportHeight, edgeThreshold, frameIndex, fullscreenOverlayHost = false, capturePolicy = null) {
      const policy = this.normalizeCapturePolicy(capturePolicy);
      const afterFirstFramePolicy = policy.afterFirstFrame || {};

      if (
        element.hasAttribute('data-screenshot-extension-quirk-capture-root') ||
        element.hasAttribute('data-screenshot-extension-quirk-fixed-background') ||
        element.hasAttribute('data-screenshot-extension-sticky-normalized') ||
        element.hasAttribute('data-screenshot-extension-preserve-dim-backdrop') ||
        element.hasAttribute('data-screenshot-extension-preserve-dim-container')
      ) {
        return null;
      }

      if (fullscreenOverlayHost || this.isLikelyOpenDialogHost(element)) {
        return 'hide';
      }

      if (this.isLikelyShippingOrCountryOverlay(element, style, rect, viewportWidth, viewportHeight)) {
        return 'hide';
      }

      if (this.isLikelyEdgeConsentOverlay(element, style, rect, viewportWidth, viewportHeight, edgeThreshold) ||
        this.isLikelyFloatingEdgeWidget(element, style, rect, viewportWidth, viewportHeight, edgeThreshold)) {
        return 'hide';
      }

      if (
        afterFirstFramePolicy.suppressVisibleNavOverlay &&
        this.isLikelyVisibleNavOverlay(element, style, rect, viewportWidth, viewportHeight) &&
        !this.isLikelyProductOrMediaContent(element, rect, viewportWidth, viewportHeight)
      ) {
        return 'hide';
      }

      if (style.position === 'fixed') {
        if (afterFirstFramePolicy.normalizeFixedSticky === false) {
          return null;
        }

        if (this.isLikelyProductOrMediaContent(element, rect, viewportWidth, viewportHeight)) {
          return null;
        }

        if (Number(frameIndex) > 0 && this.isLikelyFixedTopHeader(element, style, rect, viewportWidth, viewportHeight)) {
          return 'hide';
        }

        return 'fixed-to-absolute';
      }

      if (this.isInsidePageFooter(element)) {
        return null;
      }

      if (style.position === 'sticky') {
        return null;
      }

      if (afterFirstFramePolicy.suppressRepeatedOverlays === false) {
        return null;
      }

      if (this.isLikelyTopNavigationChrome(element, style, rect, viewportWidth, viewportHeight, edgeThreshold)) {
        return 'hide';
      }

      if (this.isLikelySideChrome(element, style, rect, viewportWidth, viewportHeight)) {
        return 'hide';
      }

      return null;
    }

    shouldHideElement(element, style, rect, viewportWidth, viewportHeight, edgeThreshold, frameIndex) {
      return Boolean(this.classifyElementAction(
        element,
        style,
        rect,
        viewportWidth,
        viewportHeight,
        edgeThreshold,
        frameIndex
      ));
    }

    isVisibleRect(rect, viewportWidth, viewportHeight) {
      return rect.width > 1 &&
        rect.height > 1 &&
        rect.bottom > 0 &&
        rect.right > 0 &&
        rect.top < viewportHeight &&
        rect.left < viewportWidth;
    }

    isPinnedToViewportEdge(rect, viewportWidth, viewportHeight, threshold) {
      return rect.top <= threshold ||
        rect.left <= threshold ||
        rect.bottom >= viewportHeight - threshold ||
        rect.right >= viewportWidth - threshold;
    }

    isLikelyOpenDialogHost(element) {
      if (element.tagName === 'DETAILS') {
        return false;
      }

      const descriptor = [
        element.tagName,
        element.id,
        element.className,
        element.getAttribute('role'),
        element.getAttribute('aria-modal')
      ].join(' ').toLowerCase();
      const dialogLike = /dialog|modal|popover|popup|promo|consent|cookie/.test(descriptor);
      const explicitlyOpen = element.hasAttribute('open') ||
        element.matches('dialog[open], [aria-modal="true"], [role="dialog"], [popover]');

      return dialogLike && explicitlyOpen;
    }

    isLikelyFullscreenOverlayHost(element, style, rect, viewportWidth, viewportHeight) {
      if (style.position !== 'fixed') {
        return false;
      }

      const viewportArea = viewportWidth * viewportHeight;
      const rectArea = rect.width * rect.height;
      const coversViewport = rectArea >= viewportArea * 0.85 &&
        rect.top <= 24 &&
        rect.left <= 24 &&
        rect.bottom >= viewportHeight - 24 &&
        rect.right >= viewportWidth - 24;

      if (!coversViewport) {
        return false;
      }

      const zIndex = Number.parseInt(style.zIndex, 10);
      const hasOverlayLayering = Number.isNaN(zIndex) || zIndex >= 10;

      if (!hasOverlayLayering) {
        return false;
      }

      const descriptor = [
        element.tagName,
        element.id,
        element.className,
        element.getAttribute('role'),
        element.getAttribute('aria-modal')
      ].join(' ').toLowerCase();
      const hasOverlayDescriptor = /dialog|modal|popover|popup|promo|overlay|backdrop|consent|cookie/.test(descriptor);

      return hasOverlayDescriptor || this.hasLikelyModalPanel(element, viewportWidth, viewportHeight);
    }

    isLikelyDimmedBackdropHost(element, style, rect, viewportWidth, viewportHeight) {
      if (style.position !== 'fixed') {
        return false;
      }

      const viewportArea = viewportWidth * viewportHeight;
      const coversViewport = rect.width * rect.height >= viewportArea * 0.85 &&
        rect.top <= 24 &&
        rect.left <= 24 &&
        rect.bottom >= viewportHeight - 24 &&
        rect.right >= viewportWidth - 24;
      if (!coversViewport || !this.hasDimmedBackdropPaint(style)) {
        return false;
      }

      const descriptor = [
        element.tagName,
        element.id,
        element.className,
        element.getAttribute('role'),
        element.getAttribute('aria-modal')
      ].join(' ').toLowerCase();
      const hasBackdropSemantics = /dialog|modal|popover|popup|promo|overlay|backdrop|consent|cookie/.test(descriptor) ||
        element.matches('dialog[open], [aria-modal="true"], [role="dialog"], [popover]');
      const zIndex = Number.parseInt(style.zIndex, 10);
      const hasOverlayLayering = !Number.isNaN(zIndex) && zIndex >= 10;

      return hasBackdropSemantics || hasOverlayLayering ||
        this.findLikelyModalPanels(element, viewportWidth, viewportHeight).length > 0;
    }

    isLikelyDimmedBackdropContainer(element) {
      const descriptor = [
        element.tagName,
        element.id,
        element.className,
        element.getAttribute('role'),
        element.getAttribute('aria-modal')
      ].join(' ').toLowerCase();

      return /onetrust|truste|trustarc|didomi|usercentrics|sp_message|consent|cookie|dialog|modal|popover|popup|overlay|backdrop/.test(descriptor);
    }

    hasDimmedBackdropPaint(style) {
      const match = String(style.backgroundColor || '').match(/rgba?\(([^)]+)\)/i);
      if (!match) {
        return false;
      }

      const parts = match[1].split(',').map(part => Number.parseFloat(part.trim()));
      const red = parts[0];
      const green = parts[1];
      const blue = parts[2];
      const alpha = parts.length >= 4 ? parts[3] : 1;
      const opacity = Number.parseFloat(style.opacity);
      const darkColor = [red, green, blue].every(value => Number.isFinite(value)) &&
        red <= 90 &&
        green <= 90 &&
        blue <= 90;

      return darkColor && (
        (alpha >= 0.18 && alpha <= 0.92) ||
        (alpha === 1 && Number.isFinite(opacity) && opacity >= 0.18 && opacity <= 0.92)
      );
    }

    createSyntheticBackdropColor(style) {
      const match = String(style.backgroundColor || '').match(/rgba?\(([^)]+)\)/i);
      if (!match) {
        return 'rgba(0, 0, 0, 0.5)';
      }

      const parts = match[1].split(',').map(part => Number.parseFloat(part.trim()));
      const red = Number.isFinite(parts[0]) ? Math.max(0, Math.min(255, Math.round(parts[0]))) : 0;
      const green = Number.isFinite(parts[1]) ? Math.max(0, Math.min(255, Math.round(parts[1]))) : 0;
      const blue = Number.isFinite(parts[2]) ? Math.max(0, Math.min(255, Math.round(parts[2]))) : 0;
      const alpha = parts.length >= 4 ? parts[3] : 1;
      const opacity = Number.parseFloat(style.opacity);
      const effectiveAlpha = alpha < 1 ? alpha :
        (Number.isFinite(opacity) && opacity >= 0 && opacity < 1 ? opacity : 0.5);

      return `rgba(${red}, ${green}, ${blue}, ${Math.max(0.18, Math.min(0.92, effectiveAlpha))})`;
    }

    createSyntheticBackdropZIndex(style) {
      const zIndex = Number.parseInt(style.zIndex, 10);
      if (!Number.isNaN(zIndex)) {
        return Math.min(2147483000, Math.max(10, zIndex));
      }

      return 2147483000;
    }

    findLikelyModalPanels(element, viewportWidth, viewportHeight) {
      const viewportArea = viewportWidth * viewportHeight;
      const panels = [];

      for (const child of Array.from(element.querySelectorAll('*')).slice(0, 120)) {
        const rect = child.getBoundingClientRect();
        if (!this.isVisibleRect(rect, viewportWidth, viewportHeight)) {
          continue;
        }

        const area = rect.width * rect.height;
        const panelSized = area >= viewportArea * 0.025 &&
          area <= viewportArea * 0.75 &&
          rect.width >= Math.min(240, viewportWidth * 0.22) &&
          rect.height >= Math.min(120, viewportHeight * 0.14);
        if (!panelSized) {
          continue;
        }

        const childStyle = getComputedStyle(child);
        const hasPanelSurface = childStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
          childStyle.boxShadow !== 'none' ||
          Number.parseFloat(childStyle.borderTopWidth) > 0 ||
          Number.parseFloat(childStyle.borderRightWidth) > 0 ||
          Number.parseFloat(childStyle.borderBottomWidth) > 0 ||
          Number.parseFloat(childStyle.borderLeftWidth) > 0;
        const text = (child.innerText || child.textContent || '').replace(/\s+/g, ' ').trim();
        const hasContent = text.length >= 20 || Boolean(child.querySelector('button, a, input, img, svg'));

        if (hasPanelSurface && hasContent) {
          panels.push(child);
        }
      }

      return panels;
    }

    hasLikelyModalPanel(element, viewportWidth, viewportHeight) {
      const viewportArea = viewportWidth * viewportHeight;
      const children = Array.from(element.querySelectorAll('*')).slice(0, 80);

      for (const child of children) {
        const rect = child.getBoundingClientRect();

        if (!this.isVisibleRect(rect, viewportWidth, viewportHeight)) {
          continue;
        }

        const area = rect.width * rect.height;
        const panelSized = area >= viewportArea * 0.04 &&
          area <= viewportArea * 0.8 &&
          rect.width >= Math.min(260, viewportWidth * 0.3) &&
          rect.height >= Math.min(140, viewportHeight * 0.18);

        if (!panelSized) {
          continue;
        }

        const childStyle = getComputedStyle(child);
        const hasPanelSurface = childStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' ||
          childStyle.boxShadow !== 'none' ||
          Number.parseFloat(childStyle.borderTopWidth) > 0 ||
          Number.parseFloat(childStyle.borderRightWidth) > 0 ||
          Number.parseFloat(childStyle.borderBottomWidth) > 0 ||
          Number.parseFloat(childStyle.borderLeftWidth) > 0;
        const text = (child.innerText || child.textContent || '').replace(/\s+/g, ' ').trim();

        if (hasPanelSurface && text.length >= 20) {
          return true;
        }
      }

      return false;
    }

    isLikelyEdgeConsentOverlay(element, style, rect, viewportWidth, viewportHeight, threshold) {
      const nearTopOrBottom = rect.top <= threshold || rect.bottom >= viewportHeight - threshold;
      const wideEnough = rect.width >= Math.min(viewportWidth * 0.18, 280);
      const notTooTall = rect.height <= viewportHeight * 0.55;
      const zIndex = Number.parseInt(style.zIndex, 10);
      const hasOverlayLayering = !Number.isNaN(zIndex) && zIndex >= 10;
      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

      if (!nearTopOrBottom || !wideEnough || !notTooTall || text.length > 1400) {
        return false;
      }

	      const hasConsentText = [
	        'cookie',
	        'cookies',
	        'consent',
        'privacy',
        'accept all',
        'reject all',
        'decline optional',
        'change preferences',
        'your data, your choice',
	        'manage cookies',
	        'we use cookies'
	      ].some(marker => text.includes(marker));
	      const hasExplicitConsentAction = [
	        'cookie',
	        'cookies',
	        'consent',
	        'accept all',
	        'reject all',
	        'decline optional',
	        'change preferences',
	        'manage cookies',
	        'we use cookies'
	      ].some(marker => text.includes(marker));
	      const overlayPosition = style.position !== 'static' || hasOverlayLayering;

	      return hasConsentText &&
	        (overlayPosition || hasExplicitConsentAction) &&
	        (overlayPosition || rect.height <= viewportHeight * 0.2);
	    }

    isInsidePageFooter(element) {
      return Boolean(element.closest?.('footer, [role="contentinfo"]'));
    }

    isLikelyShippingOrCountryOverlay(element, style, rect, viewportWidth, viewportHeight) {
      const viewportArea = viewportWidth * viewportHeight;
      const area = rect.width * rect.height;
      const zIndex = Number.parseInt(style.zIndex, 10);
      const hasOverlayLayering = Number.isNaN(zIndex) || zIndex >= 10;
      const centeredPanel = area >= viewportArea * 0.04 &&
        area <= viewportArea * 0.65 &&
        rect.width >= Math.min(280, viewportWidth * 0.25) &&
        rect.width <= viewportWidth * 0.9 &&
        rect.height >= Math.min(140, viewportHeight * 0.18) &&
        rect.left > viewportWidth * 0.05 &&
        rect.right < viewportWidth * 0.95;

      if (!centeredPanel || !hasOverlayLayering) {
        return false;
      }

      const descriptor = [
        element.tagName,
        element.id,
        element.className,
        element.getAttribute('role'),
        element.getAttribute('aria-modal')
      ].join(' ').toLowerCase();
      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const hasOverlaySemantics = /dialog|modal|popover|popup|overlay|country|locale|region|shipping/.test(descriptor) ||
        element.matches('[role="dialog"], [aria-modal="true"]') ||
        style.position === 'fixed';
      const hasShippingText = [
        'where are we shipping',
        'shipping to',
        'select your country',
        'choose your country',
        'change country',
        'purchasing from your country'
      ].some(marker => text.includes(marker));

      return hasShippingText && hasOverlaySemantics;
    }

    isLikelyVisibleNavOverlay(element, style, rect, viewportWidth, viewportHeight) {
      const viewportArea = viewportWidth * viewportHeight;
      const areaRatio = (rect.width * rect.height) / Math.max(1, viewportArea);
      if (
        rect.top > viewportHeight * 0.38 ||
        rect.width < viewportWidth * 0.55 ||
        areaRatio < 0.12
      ) {
        return false;
      }

      const descriptor = [
        element.tagName,
        element.id,
        element.className,
        element.getAttribute('role'),
        element.getAttribute('aria-label')
      ].join(' ').toLowerCase();
      const hasNavSemantics = element.matches('nav, [role="navigation"], [role="banner"]') ||
        /globalnav|global-nav|navbar|nav-bar|navigation|menu|flyout|drawer|mega-menu|site-nav/.test(descriptor);
      if (!hasNavSemantics) {
        return false;
      }

      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
      const lowerText = text.toLowerCase();
      const hasMenuText = /store|shop|mac|ipad|iphone|watch|airpods|support|search|learn|overview|docs|products/.test(lowerText);
      const overlayPosition = style.position === 'fixed' || style.position === 'sticky' ||
        !Number.isNaN(Number.parseInt(style.zIndex, 10));
      const largeTopPanel = rect.height >= Math.min(140, viewportHeight * 0.16) ||
        areaRatio >= 0.2;

      return overlayPosition && largeTopPanel && text.length >= 80 && hasMenuText;
    }

    isLikelyTopNavigationChrome(element, style, rect, viewportWidth, viewportHeight, threshold) {
      const topLimit = Math.max(threshold, Math.min(110, viewportHeight * 0.14));

      if (rect.top > topLimit || rect.width < viewportWidth * 0.55 || rect.height > viewportHeight * 0.22) {
        return false;
      }

      const descriptor = [
        element.tagName,
        element.id,
        element.className,
        element.getAttribute('role'),
        element.getAttribute('aria-label')
      ].join(' ').toLowerCase();
      const hasChromeSemantics = /globalheader|navbar|nav-bar|navigation|site-nav|topbar|top-bar|app-bar|menu/.test(descriptor) ||
        element.matches('nav, [role="banner"], [role="navigation"]');

      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
      const lowerText = text.toLowerCase();
      const hasNavText = /\b(men|women|sale|shop|about|support|learn|cart|search)\b/.test(lowerText) &&
        (lowerText.includes('men') || lowerText.includes('shop') || lowerText.includes('sale'));
      const sparseChrome = text.length <= 320;
      const staticContentHeader = style.position === 'static' &&
        element.matches('header') &&
        Boolean(element.closest?.('main, section, article'));
      const nearTopLayer = style.position !== 'static' ||
        !Number.isNaN(Number.parseInt(style.zIndex, 10)) ||
        rect.height <= 120;

      return !staticContentHeader && sparseChrome && nearTopLayer && (hasChromeSemantics || hasNavText);
    }

    isLikelyFixedTopHeader(element, style, rect, viewportWidth, viewportHeight) {
      if (style.position !== 'fixed') {
        return false;
      }

      const topAligned = rect.top < 22;
      const wideEnough = rect.width >= viewportWidth * 0.55;
      const notViewportOverlay = rect.height < viewportHeight - rect.top - 22;
      const compactEnough = rect.height <= Math.min(220, viewportHeight * 0.32);

      return topAligned && wideEnough && notViewportOverlay && compactEnough;
    }

    isLikelyStickySideChrome(element, style, rect, viewportWidth, viewportHeight, threshold) {
      if (style.position !== 'sticky') {
        return false;
      }

      return this.isLikelySideChrome(element, style, rect, viewportWidth, viewportHeight);
    }

	    isLikelySideChrome(element, style, rect, viewportWidth, viewportHeight) {
	      const pinnedToSide = rect.left <= viewportWidth * 0.22 || rect.right >= viewportWidth * 0.78;
	      const sidePanelWidth = rect.width <= viewportWidth * 0.42;
	      const persistentSideLayout = style.position !== 'static' || rect.height >= viewportHeight * 0.58;
	      const descriptor = [
	        element.tagName,
	        element.id,
        element.className,
        element.getAttribute('role'),
        element.getAttribute('aria-label')
      ].join(' ').toLowerCase();
	      const sideChromeDescriptor = /toc|table-of-contents|contents|sidebar|side-bar|sidenav|side-nav|navigation|menu|brand|anchor|anchors|outline|index|filter|filters|facet|facets|refine|category|categories/.test(descriptor) ||
	        element.matches('aside, [aria-label*="contents" i], [aria-label*="navigation" i], [aria-label*="filter" i], [aria-label*="filters" i]');
	      const plainNavigation = element.matches('nav, [role="navigation"]');
	      const plainNavigationInSideContext = Boolean(element.closest?.([
	        'aside',
	        '[class*="sidebar" i]',
	        '[class*="side-bar" i]',
	        '[class*="sidenav" i]',
	        '[class*="side-nav" i]',
	        '[class*="toc" i]',
	        '[class*="table-of-contents" i]',
	        '[class*="filter" i]',
	        '[class*="facet" i]'
	      ].join(',')));
	      const plainNavigationLooksPersistent = plainNavigation &&
	        (plainNavigationInSideContext || rect.height >= viewportHeight * 0.8);
      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
      const sparseText = text.length <= 2600;
      const lowerText = text.toLowerCase();
      const sideChromeContent =
        /^(filter|filters|table of contents|on this page)\b/.test(lowerText) ||
        (lowerText.includes('store pickup') && lowerText.includes('ship to address')) ||
        (lowerText.includes('filter by categories') && lowerText.includes('backpacks')) ||
        (lowerText.includes('getting started') && lowerText.includes('installation') && lowerText.length <= 1800);
	      const sideChromeSemantics = sideChromeDescriptor || plainNavigationLooksPersistent || sideChromeContent;
	      if (this.isLikelyProductOrMediaContent(element, rect, viewportWidth, viewportHeight, descriptor)) {
	        return false;
	      }

	      return persistentSideLayout && pinnedToSide && sidePanelWidth && sparseText && sideChromeSemantics;
	    }

    isLikelyProductOrMediaContent(element, rect, viewportWidth, viewportHeight, descriptorOverride = '') {
      const descriptor = descriptorOverride || [
        element.tagName,
        element.id,
        element.className,
        element.getAttribute('role'),
        element.getAttribute('aria-label')
      ].join(' ').toLowerCase();
      const mediaCount = element.querySelectorAll('img, picture, video, canvas, svg').length;
      const mediaHeavy = mediaCount >= 2 || (
        mediaCount >= 1 &&
        rect.width >= viewportWidth * 0.28 &&
        rect.height >= viewportHeight * 0.35
      );
      const productContentSemantics = /product|gallery|media|image|photo|hero|carousel|preview|viewer/.test(descriptor);

      return mediaHeavy || productContentSemantics;
    }

    isLikelyFloatingEdgeWidget(element, style, rect, viewportWidth, viewportHeight, threshold) {
      const edgeThreshold = Math.max(threshold, Math.min(72, viewportWidth * 0.06));
      const pinnedToSide = rect.left <= edgeThreshold || rect.right >= viewportWidth - edgeThreshold;
      const smallWidget = rect.width <= 140 && rect.height <= 260;
      const awayFromMainNav = rect.top > threshold * 2;
      const zIndex = Number.parseInt(style.zIndex, 10);
      const hasOverlayLayering = !Number.isNaN(zIndex) && zIndex >= 10;
      const hasOverlayPosition = style.position === 'absolute' || style.position === 'relative' || style.position === 'sticky';
      const hasWidgetSemantics = element.matches('[role="button"], button, [aria-label], [title]');
      const descriptor = [
        element.tagName,
        element.id,
        element.className,
        element.getAttribute('role'),
        element.getAttribute('aria-label'),
        element.getAttribute('title')
      ].join(' ').toLowerCase();
      const hasWidgetDescriptor = /chat|help|support|assistant|launcher|widget|float|floating|contact|feedback|customer-service|customer_service/.test(descriptor);
      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
      const iconLike = text.length <= 40 &&
        element.querySelectorAll('svg, img, picture, canvas, button, [role="button"]').length <= 4;

      return pinnedToSide &&
        smallWidget &&
        awayFromMainNav &&
        text.length <= 120 &&
        (hasOverlayLayering || hasOverlayPosition || hasWidgetSemantics || hasWidgetDescriptor || iconLike);
    }
  }

  globalThis.ScreenshotExtensionFixedStickyNormalizer = FixedStickyNormalizer;
})();
