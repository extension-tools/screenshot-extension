import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(projectRoot, '..');
const codeRoot = path.resolve(projectRoot, '..', 'code');

const readJson = file => JSON.parse(fs.readFileSync(path.join(codeRoot, file), 'utf8'));

readJson('manifest.json');

try {
  execFileSync('git', ['diff', '--quiet', '--', 'code/manifest.json'], {
    cwd: repoRoot,
    stdio: 'pipe'
  });
  execFileSync('git', ['diff', '--cached', '--quiet', '--', 'code/manifest.json'], {
    cwd: repoRoot,
    stdio: 'pipe'
  });
}
catch (_error) {
  throw new Error('release cleanup validation must not change code/manifest.json');
}

for (const dirent of fs.readdirSync(path.join(codeRoot, '_locales'), {withFileTypes: true})) {
  if (dirent.isDirectory()) {
    readJson(path.join('_locales', dirent.name, 'messages.json'));
  }
}

for (const file of [
  'worker.js',
  'content/DomMutationStack.js',
  'content/ScrollTargetFinder.js',
  'content/ScrollbarNormalizer.js',
  'content/FixedStickyNormalizer.js',
  'content/ImageReadinessProbe.js',
  'content/ContentAgent.js',
  'capture/CapabilityGuard.js',
  'capture/ContentAgentClient.js',
  'capture/NotificationService.js',
  'capture/CaptureDiagnostics.js',
  'capture/CanvasSizeGuard.js',
  'capture/SingleFileExportAttempt.js',
  'capture/QuirksLayer.js',
  'capture/LazyLoadWarmer.js',
  'capture/PageProbe.js',
  'capture/SplitBoundaryPlanner.js',
  'capture/PositionPlanner.js',
  'capture/ViewportCapture.js',
  'capture/CanvasStitcher.js',
  'capture/CanvasTiler.js',
  'capture/CleanupManager.js',
  'capture/CaptureStepper.js',
  'capture/CaptureStore.js',
  'capture/CaptureController.js',
  'data/popup/index.js',
  'data/options/index.js'
]) {
  execFileSync(process.execPath, ['--check', path.join(codeRoot, file)], {
    stdio: 'inherit'
  });
}

const assertIncludes = (value, expected, message) => {
  if (!value.includes(expected)) {
    throw new Error(message);
  }
};

const assertNotIncludes = (value, unexpected, message) => {
  if (value.includes(unexpected)) {
    throw new Error(message);
  }
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const loadSelfClass = (source, className) => {
  const sandboxSelf = {};
  const loadedClass = Function('self', `${source}\nreturn self.${className};`)(sandboxSelf);
  if (typeof loadedClass !== 'function') {
    throw new Error(`Unable to load ${className}`);
  }

  return loadedClass;
};

const runnerSource = fs.readFileSync(path.join(projectRoot, 'tests', 'real-site-runner.mjs'), 'utf8');
const captureFlowSource = fs.readFileSync(path.join(projectRoot, 'tests', 'capture-flow.mjs'), 'utf8');
const offlinePngQaSource = fs.readFileSync(path.join(projectRoot, 'tests', 'offline-png-qa.mjs'), 'utf8');
const stickyCleanupSmokeSource = fs.readFileSync(path.join(projectRoot, 'tests', 'sticky-cleanup-smoke.mjs'), 'utf8');
const workerSource = fs.readFileSync(path.join(codeRoot, 'worker.js'), 'utf8');
const pageProbeSource = fs.readFileSync(path.join(codeRoot, 'capture/PageProbe.js'), 'utf8');
const quirkLayerSource = fs.readFileSync(path.join(codeRoot, 'capture/QuirksLayer.js'), 'utf8');
const splitBoundaryPlannerSource = fs.readFileSync(path.join(codeRoot, 'capture/SplitBoundaryPlanner.js'), 'utf8');
const positionPlannerSource = fs.readFileSync(path.join(codeRoot, 'capture/PositionPlanner.js'), 'utf8');
const canvasStitcherSource = fs.readFileSync(path.join(codeRoot, 'capture/CanvasStitcher.js'), 'utf8');
const canvasTilerSource = fs.readFileSync(path.join(codeRoot, 'capture/CanvasTiler.js'), 'utf8');
const canvasSizeGuardSource = fs.readFileSync(path.join(codeRoot, 'capture/CanvasSizeGuard.js'), 'utf8');
const fixedStickyNormalizerSource = fs.readFileSync(path.join(codeRoot, 'content/FixedStickyNormalizer.js'), 'utf8');
const contentAgentSource = fs.readFileSync(path.join(codeRoot, 'content/ContentAgent.js'), 'utf8');
const contentAgentClientSource = fs.readFileSync(path.join(codeRoot, 'capture/ContentAgentClient.js'), 'utf8');
const captureControllerSource = fs.readFileSync(path.join(codeRoot, 'capture/CaptureController.js'), 'utf8');
const captureStepperSource = fs.readFileSync(path.join(codeRoot, 'capture/CaptureStepper.js'), 'utf8');
const captureDiagnosticsSource = fs.readFileSync(path.join(codeRoot, 'capture/CaptureDiagnostics.js'), 'utf8');
const captureStoreSource = fs.readFileSync(path.join(codeRoot, 'capture/CaptureStore.js'), 'utf8');
const prepareCaptureSource = contentAgentSource.slice(
  contentAgentSource.indexOf('prepareCapture(options = {})'),
  contentAgentSource.indexOf('normalizeStickyForCapture(options = {})')
);

assertIncludes(
  captureDiagnosticsSource,
  'normalizeDiagnosticsMode',
  'CaptureDiagnostics must normalize production and QA diagnostics modes at a single boundary'
);
assertIncludes(
  captureDiagnosticsSource,
  'toProductionDiagnostics',
  'CaptureDiagnostics must expose a production diagnostics whitelist'
);
assertIncludes(
  captureDiagnosticsSource,
  'normalizePlatformOs',
  'CaptureDiagnostics must normalize platformOs to a coarse allowed value'
);
assertIncludes(
  captureControllerSource,
  "'diagnosticsMode': 'production'",
  'CaptureController must default user captures to production diagnostics mode'
);
assertIncludes(
  captureControllerSource,
  "const includeQaDiagnostics = diagnosticsMode === 'qa'",
  'CaptureController must derive includeQaDiagnostics from the normalized diagnostics mode'
);
assertIncludes(
  captureControllerSource,
  'capturePolicy,\n        includeQaDiagnostics',
  'CaptureController must pass includeQaDiagnostics to QA-only downstream diagnostics owners'
);
assertIncludes(
  captureControllerSource,
  'if (includeQaDiagnostics) {\n        this.captureDiagnostics.attachImageReadinessSummary',
  'CaptureController must build QA-only image readiness summaries only in QA diagnostics mode'
);
assertIncludes(
  captureStepperSource,
  'includeQaDiagnostics = false',
  'CaptureStepper must default QA-only diagnostics to disabled'
);
assertIncludes(
  captureStepperSource,
  'this.includeQaDiagnostics = includeQaDiagnostics === true',
  'CaptureStepper must store includeQaDiagnostics as a boolean'
);
assertIncludes(
  captureStepperSource,
  'repeatedChrome: this.includeQaDiagnostics ?',
  'CaptureStepper must gate repeated chrome diagnostics behind includeQaDiagnostics'
);
assertIncludes(
  captureStepperSource,
  'this.analyzeRepeatedChrome(frames) :\n        null',
  'CaptureStepper must return null repeatedChrome in production diagnostics mode'
);
assertIncludes(
  captureControllerSource,
  'serializeForStorage',
  'CaptureController must store shaped diagnostics instead of raw verbose diagnostics by default'
);
assertIncludes(
  runnerSource,
  "diagnosticsMode: 'qa'",
  'real-site runner must explicitly enable QA diagnostics for internal runs'
);
assertIncludes(
  captureFlowSource,
  "diagnosticsMode: 'qa'",
  'capture-flow runner must explicitly enable QA diagnostics for fixture assertions'
);
{
  const storeCaptureDiagnosticsStart = captureControllerSource.indexOf('async storeCaptureDiagnostics(result)');
  const storeCaptureDiagnosticsEnd = captureControllerSource.indexOf('async readPlatformInfo()');
  const storeCaptureDiagnosticsSource = captureControllerSource.slice(
    storeCaptureDiagnosticsStart,
    storeCaptureDiagnosticsEnd
  );

  assert(
    storeCaptureDiagnosticsStart !== -1 && storeCaptureDiagnosticsEnd > storeCaptureDiagnosticsStart,
    'CaptureController must keep diagnostics storage in a small storeCaptureDiagnostics method'
  );
  assertIncludes(
    storeCaptureDiagnosticsSource,
    'lastCaptureDiagnostics',
    'CaptureController.storeCaptureDiagnostics must own the production diagnostics storage key'
  );
  assertIncludes(
    storeCaptureDiagnosticsSource,
    'serializeForStorage',
    'CaptureController.storeCaptureDiagnostics must write only serialized diagnostics'
  );
  for (const productionRuntimeSource of [
    ['CaptureController', captureControllerSource],
    ['CaptureDiagnostics', captureDiagnosticsSource],
    ['CaptureStore', captureStoreSource]
  ]) {
    const [name, source] = productionRuntimeSource;

    assertNotIncludes(
      source,
      'debugDiagnostics',
      `${name} must not introduce a production debugDiagnostics storage path`
    );
    assertNotIncludes(
      source,
      'qaReport',
      `${name} must not introduce a production QA report storage path`
    );
    assertNotIncludes(
      source,
      'report.md',
      `${name} must not write QA report.md artifacts from the production extension runtime`
    );
    assertNotIncludes(
      source,
      'writeFile',
      `${name} must not use file-system report writes in the production extension runtime`
    );
  }
  assertNotIncludes(
    captureStoreSource,
    'lastCaptureDiagnostics',
    'CaptureStore must stay focused on downloads and must not own diagnostics storage'
  );
  assertIncludes(
    captureFlowSource,
    'report.md',
    'capture-flow may write report.md only as a QA runner artifact'
  );
  assertIncludes(
    runnerSource,
    'report.md',
    'real-site runner may write report.md only as a QA runner artifact'
  );
}

{
  const CaptureDiagnostics = loadSelfClass(captureDiagnosticsSource, 'CaptureDiagnostics');
  const diagnostics = new CaptureDiagnostics();
  const verboseCapture = {
    status: 'success',
    startedAt: '2026-05-26T00:00:00.000Z',
    completedAt: '2026-05-26T00:00:01.000Z',
    tab: {
      url: 'https://example.com',
      title: 'Example'
    },
    platform: {
      os: 'mac'
    },
    page: {
      viewportWidth: 1200,
      viewportHeight: 900,
      dpr: 2
    },
    output: {
      strategy: 'single-canvas',
      bitmapWidth: 2400,
      bitmapHeight: 3600
    },
    timing: {
      totalMs: 1234
    },
    export: {
      files: [{filename: 'example.png'}]
    },
    capturePlan: {
      avoidRanges: [{yStartCssPx: 10, yEndCssPx: 20}]
    },
    scrollTarget: {
      diagnostics: {
        selector: '.internal'
      }
    }
  };
  const productionStored = diagnostics.serializeForStorage({
    mode: 'production',
    strategy: {mode: 'single-canvas'},
    diagnostics: {stepper: {frames: [{frameIndex: 0}]}},
    captureDiagnostics: verboseCapture
  });
  const qaStored = diagnostics.serializeForStorage({
    mode: 'qa',
    strategy: {mode: 'single-canvas'},
    diagnostics: {stepper: {frames: [{frameIndex: 0}]}},
    captureDiagnostics: verboseCapture
  });
  const productionKeys = Object.keys(productionStored).sort();
  const allowedProductionKeys = [
    'captureId',
    'completedAt',
    'durationMs',
    'errorMessage',
    'failureReason',
    'outputDimensions',
    'outputFileCount',
    'outputStrategy',
    'platformOs',
    'startedAt',
    'status',
    'title',
    'url',
    'viewport'
  ].sort();

  assert(
    JSON.stringify(productionKeys) === JSON.stringify(allowedProductionKeys),
    'production stored diagnostics must contain only the release whitelist'
  );
  assert(
    productionStored.platformOs === 'mac',
    'production stored diagnostics may include only coarse platformOs'
  );
  assert(
    diagnostics.toProductionDiagnostics({
      ...verboseCapture,
      export: {files: []},
      output: {
        strategy: 'single-canvas',
        bitmapWidth: 2400,
        bitmapHeight: 3600
      }
    }).outputFileCount === 1,
    'single-canvas production diagnostics must report one output file even before export file details are attached'
  );
  assertNotIncludes(
    JSON.stringify(productionStored),
    'avoidRanges',
    'production stored diagnostics must not serialize capturePlan.avoidRanges'
  );
  assertNotIncludes(
    JSON.stringify(productionStored),
    'selector',
    'production stored diagnostics must not serialize selector-like diagnostics'
  );
  assert(
    qaStored.capture?.capturePlan?.avoidRanges?.length === 1 &&
      qaStored.diagnostics?.stepper?.frames?.length === 1,
    'QA stored diagnostics must preserve verbose diagnostics for internal runs'
  );
  assert(
    diagnostics.normalizeDiagnosticsMode({qaDiagnostics: true}) === 'qa',
    'qaDiagnostics must remain a legacy alias for diagnosticsMode: qa'
  );
  assert(
    diagnostics.normalizePlatformOs('darwin') === null,
    'exact or unsupported platform values must not be serialized as platformOs'
  );
}

assertIncludes(
  pageProbeSource,
  'splitExclusionRanges',
  'PageProbe must expose split exclusion ranges for card/section-safe multi-part boundaries'
);
for (const splitLayoutDiagnostic of [
  'detectSplitLayoutRisk',
  'splitLayoutRiskReason',
  'two-column-sticky-media-mismatch',
  'shortColumnSide',
  'tallColumnRatio'
]) {
  assertIncludes(
    pageProbeSource,
    splitLayoutDiagnostic,
    `PageProbe must expose passive split-layout diagnostics: ${splitLayoutDiagnostic}`
  );
}
assertIncludes(
  pageProbeSource,
  'riskFlags',
  'PageProbe must expose cheap risk flags for fixed/sticky and blocking-modal capture policy'
);
assertIncludes(
  pageProbeSource,
  'const windowScrollThreshold = Math.max(40, viewportHeight * 0.05)',
  'PageProbe must prefer window scroll when the page has meaningful window scroll range'
);
for (const internalScrollThreshold of [
  'area < viewportArea * 0.5',
  'rect.width < viewportWidth * 0.65',
  'rect.height < viewportHeight * 0.55',
  'windowScrollHeight <= windowScrollThreshold'
]) {
  assertIncludes(
    pageProbeSource,
    internalScrollThreshold,
    `PageProbe internal scroll selection must keep strict mechanical threshold: ${internalScrollThreshold}`
  );
}
assertNotIncludes(
  pageProbeSource,
  'isLikelySidePanel',
  'PageProbe internal scroll target selection must not use sidebar/nav/menu descriptor semantics'
);
assertNotIncludes(
  pageProbeSource,
  'isLikelyEmptyWorkspace',
  'PageProbe internal scroll target selection must not use workspace descriptor semantics'
);
assertIncludes(
  pageProbeSource,
  'createCapturePolicy',
  'PageProbe must convert riskFlags into an explicit capturePolicy'
);
assertIncludes(
  pageProbeSource,
  'skipLazyWarmupBeforeFirstFrame',
  'PageProbe capturePolicy must skip pre-frame-0 lazy warmup only for viewport-only blocking states'
);
assertIncludes(
  fixedStickyNormalizerSource,
  "policy.mode === 'viewport-only'",
  'FixedStickyNormalizer must skip blanket sticky normalization for viewport-only captures'
);
assertNotIncludes(
  pageProbeSource,
  'normalizeStickyBeforeFirstFrame',
  'PageProbe must not expose sticky normalization as an opt-in capture policy flag'
);
assertNotIncludes(
  fixedStickyNormalizerSource,
  'flag-disabled',
  'FixedStickyNormalizer must make sticky normalization the full-page default instead of a disabled flag path'
);
assertNotIncludes(
  fixedStickyNormalizerSource,
  'normalizeStickyBeforeFirstFrame',
  'FixedStickyNormalizer must not gate blanket sticky normalization on an opt-in flag'
);
assertNotIncludes(
  prepareCaptureSource,
  'prepareStickyNormalization',
  'ContentAgent.prepareCapture must remain basic and must not normalize sticky before warmup/final measure'
);
assertIncludes(
  contentAgentSource,
  'normalizeStickyForCapture',
  'ContentAgent must expose a separate post-warmup sticky normalization step'
);
assertIncludes(
  contentAgentClientSource,
  'async normalizeSticky',
  'ContentAgentClient must call sticky normalization separately from basic prepare'
);
assertIncludes(
  captureControllerSource,
  'postPlan',
  'CaptureController must run sticky normalization after final measure and capture planning'
);
assertIncludes(
  pageProbeSource,
  'visibleOverlayCandidateCount',
  'PageProbe must keep visible overlay candidates as diagnostics without making them capture-policy risk flags'
);
assertIncludes(
  workerSource,
  'capture/QuirksLayer.js',
  'worker must load QuirksLayer before CaptureController'
);
assertIncludes(
  captureControllerSource,
  'new self.QuirksLayer',
  'CaptureController must run the small QuirksLayer before page measurement'
);
assertIncludes(
  captureControllerSource,
  'beforeMeasure',
  'CaptureController must run quirks before initial PageProbe measurement'
);
assertIncludes(
  captureControllerSource,
  'afterWarmup',
  'CaptureController must run quirks after lazy warmup before final PageProbe measurement'
);
assertIncludes(
  captureControllerSource,
  'quirks.cleanup',
  'CaptureController must restore quirk marker attributes during cleanup'
);
assertIncludes(
  quirkLayerSource,
  'preserve-fixed-background',
  'QuirksLayer must expose the fixed-background preservation quirk'
);
assertIncludes(
  quirkLayerSource,
  'known-lightbox-root',
  'QuirksLayer must expose the known lightbox capture-root quirk'
);
assertIncludes(
  quirkLayerSource,
  "lightboxSelector = '#lightbox-wrap'",
  'known-lightbox-root must use a narrow known selector'
);
assertNotIncludes(
  quirkLayerSource,
  '[class*="fullscreen"',
  'known-lightbox-root must not infer from generic fullscreen classes'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'data-screenshot-extension-quirk-capture-root',
  'FixedStickyNormalizer must preserve the selected quirk capture root'
);
assertIncludes(
  pageProbeSource,
  'data-screenshot-extension-quirk-capture-root',
  'PageProbe must be able to consume QuirksLayer capture-root markers'
);
assertIncludes(
  pageProbeSource,
  "composeMode: 'lightbox-root'",
  'PageProbe must treat known lightbox roots as the capture target'
);
assertIncludes(
  contentAgentSource,
  'fixedBackgroundAttribute',
  'ContentAgent must preserve fixed background attachment only for marked QuirksLayer candidates'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'data-screenshot-extension-quirk-fixed-background',
  'FixedStickyNormalizer must preserve only fixed-background candidates marked by QuirksLayer'
);
assertNotIncludes(
  pageProbeSource,
  "riskFlags.push('visible_nav_overlay')",
  'PageProbe must not let ordinary headers or overlay candidates drive capture policy through visible_nav_overlay'
);
assertIncludes(
  captureFlowSource,
  'capturePolicy.afterFirstFrame',
  'capture-flow reports must print explicit capturePolicy decisions'
);
assertIncludes(
  pageProbeSource,
  'header-gallery-module',
  'PageProbe must protect Apple-style heading plus gallery/card sections from split boundaries'
);
assertIncludes(
  pageProbeSource,
  'gridRowAdded',
  'PageProbe must report compact diagnostics for grid-row avoid ranges'
);
assertIncludes(
  pageProbeSource,
  'elapsedMs',
  'PageProbe must report geometry avoid range pass timing'
);
assertIncludes(
  pageProbeSource,
  'safetyMarginCssPx',
  'PageProbe must report the geometry avoid range safety margin'
);
assertIncludes(
  pageProbeSource,
  "'grid-row': 72",
  'PageProbe must keep a larger safety margin around grid-row ranges'
);
assertIncludes(
  pageProbeSource,
  "'grid-row'",
  'PageProbe must add grid-row avoid ranges through the shared capture plan'
);
assertIncludes(
  captureFlowSource,
  'grid-row-boundary-shift-page',
  'capture-flow must include a fixture proving grid-row avoid ranges shift capture boundaries'
);
assertIncludes(
  captureFlowSource,
  'geometryGridRowAddedAtLeast',
  'capture-flow must assert grid-row range creation instead of relying on screenshots alone'
);
assertIncludes(
  captureFlowSource,
  'capturePlanAvoidRangeReasonAtLeast',
  'capture-flow must assert grid-row ranges enter capturePlan.avoidRanges'
);
assertIncludes(
  captureFlowSource,
  'scrollYAtMost',
  'capture-flow must assert grid-row ranges change planned frame scroll positions'
);
assertIncludes(
  positionPlannerSource,
  'createYAxisPositions',
  'PositionPlanner must use split exclusion ranges when planning vertical capture seams'
);
assertIncludes(
  workerSource,
  'capture/SplitBoundaryPlanner.js',
  'worker must load SplitBoundaryPlanner before PositionPlanner'
);
assertIncludes(
  splitBoundaryPlannerSource,
  'capturePlan?.avoidRanges',
  'PositionPlanner must prefer capturePlan.avoidRanges before falling back to splitExclusionRanges'
);
assertIncludes(
  splitBoundaryPlannerSource,
  'yStartCssPx',
  'PositionPlanner must read capturePlan avoid range start coordinates'
);
assertIncludes(
  splitBoundaryPlannerSource,
  'yEndCssPx',
  'PositionPlanner must read capturePlan avoid range end coordinates'
);
assertIncludes(
  positionPlannerSource,
  'adjustPositionForSafeSeam',
  'PositionPlanner must be able to add overlap when a viewport seam would cut split-sensitive content'
);
{
  const PositionPlanner = loadSelfClass(`${splitBoundaryPlannerSource}\n${positionPlannerSource}`, 'PositionPlanner');
  const planner = new PositionPlanner({offset: 50});
  const baselinePositions = planner.createYAxisPositions(2000, 500, {});
  const capturePlanPositions = planner.createYAxisPositions(2000, 500, {
    capturePlan: {
      avoidRanges: [{
        yStartCssPx: 460,
        yEndCssPx: 530,
        reason: 'card'
      }]
    }
  });
  const fallbackPositions = planner.createYAxisPositions(2000, 500, {
    capturePlan: {
      avoidRanges: []
    },
    splitExclusionRanges: [{
      top: 460,
      bottom: 530,
      reason: 'card'
    }]
  });
  const gridRowPositions = planner.createYAxisPositions(2000, 500, {
    capturePlan: {
      avoidRanges: [{
        yStartCssPx: 460,
        yEndCssPx: 530,
        reason: 'grid-row'
      }]
    }
  });

  assert(
    baselinePositions[1] === 450,
    'PositionPlanner test setup must start with an unshifted default first seam'
  );
  assert(
    capturePlanPositions[1] < baselinePositions[1],
    'PositionPlanner must shift seams away from capturePlan.avoidRanges'
  );
  assert(
    gridRowPositions[1] === capturePlanPositions[1],
    'PositionPlanner must shift seams away from grid-row capturePlan.avoidRanges'
  );
  assert(
    fallbackPositions[1] === capturePlanPositions[1],
    'PositionPlanner must fall back to splitExclusionRanges when capturePlan.avoidRanges is empty'
  );
}
{
  const loadCanvasClass = (source, className) => Function(
    'self',
    `${splitBoundaryPlannerSource}\n${source}\nreturn self.${className};`
  )({});
  const CanvasStitcher = loadCanvasClass(canvasStitcherSource, 'CanvasStitcher');
  const CanvasTiler = loadCanvasClass(canvasTilerSource, 'CanvasTiler');
  const CanvasSizeGuard = loadCanvasClass(canvasSizeGuardSource, 'CanvasSizeGuard');
  const seamContext = {
    normalizeExclusionRanges: () => [{
      top: 430,
      bottom: 500,
      reason: 'card'
    }],
    normalizeSplitCandidates: () => []
  };
  const seam = {
    current: 400,
    defaultBoundary: 450
  };
  const stitcherBoundary = CanvasStitcher.prototype.chooseVerticalSeamBoundary.call(seamContext, seam);
  const tilerBoundary = CanvasTiler.prototype.chooseVerticalSeamBoundary.call(seamContext, seam);

  assert(
    stitcherBoundary !== seam.defaultBoundary && stitcherBoundary <= 430,
    'CanvasStitcher must shift image seams away from capturePlan avoid ranges through SplitBoundaryPlanner'
  );
  assert(
    tilerBoundary === stitcherBoundary,
    'CanvasTiler must use the same SplitBoundaryPlanner seam decision as CanvasStitcher'
  );

  const sizeGuard = new CanvasSizeGuard();
  const partBoundary = sizeGuard.findSafeBoundary({
    y: 0,
    hardLimit: 2000,
    height: 3600,
    tilePixelHeight: 2000,
    candidates: [],
    exclusionRanges: [{
      top: 1900,
      bottom: 2100,
      reason: 'grid-row'
    }]
  });

  assert(
    partBoundary !== 2000 && partBoundary <= 1900,
    'CanvasSizeGuard must shift tiled-output part boundaries away from avoid ranges through SplitBoundaryPlanner'
  );
}
assertIncludes(
  canvasStitcherSource,
  'chooseVerticalSeamBoundary',
  'CanvasStitcher must choose safe seam boundaries inside available overlap'
);
assertIncludes(
  canvasTilerSource,
  'chooseVerticalSeamBoundary',
  'CanvasTiler must choose safe seam boundaries inside available overlap'
);
assertIncludes(
  canvasSizeGuardSource,
  'SplitBoundaryPlanner.chooseSafeSplitBoundary',
  'CanvasSizeGuard must use SplitBoundaryPlanner for tiled-output part boundaries'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'isLikelySideChrome',
  'FixedStickyNormalizer must suppress repeated side chrome after the first frame'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'isInsidePageFooter',
  'FixedStickyNormalizer must not suppress legitimate footer navigation as repeated side chrome'
);
assertNotIncludes(
  contentAgentSource,
  'animation-name: none',
  'ContentAgent must not globally disable CSS animations because scroll-revealed Apple sections can remain visually blank'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'staticContentHeader',
  'FixedStickyNormalizer must preserve static content section headers near viewport seams'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'convertFixedToAbsolute',
  'FixedStickyNormalizer must keep fixed-to-absolute as the fallback for non-header fixed elements'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'isLikelyFixedTopHeader',
  'FixedStickyNormalizer must hide repeated fixed top headers after the first frame'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'convertStickyToRelative',
  'FixedStickyNormalizer must convert sticky elements to relative during blanket sticky normalization'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'shadowRootCount',
  'FixedStickyNormalizer must report compact shadow-root coverage for sticky normalization'
);
assertIncludes(
  contentAgentSource,
  'collectCleanupState',
  'ContentAgent must expose cleanup diagnostics for temporary sticky normalization markers'
);
assertIncludes(
  contentAgentClientSource,
  'aggregateCleanupResults',
  'ContentAgentClient must aggregate cleanup diagnostics across frames'
);
assertIncludes(
  contentAgentClientSource,
  'framesWithNormalizedSticky',
  'ContentAgentClient must aggregate how many frames normalized sticky elements'
);
assertIncludes(
  captureControllerSource,
  'diagnostics.stickyNormalization',
  'CaptureController must attach compact sticky normalization diagnostics to capture diagnostics'
);
assertIncludes(
  captureDiagnosticsSource,
  'stickyNormalizationSummary',
  'CaptureDiagnostics v2 must expose sticky normalization summary'
);
assertIncludes(
  captureDiagnosticsSource,
  'recordTiming',
  'CaptureDiagnostics v2 must expose phase timing diagnostics for broad research runs'
);
assertIncludes(
  captureControllerSource,
  "timePhase('page_probe_initial'",
  'CaptureController must time the initial PageProbe phase'
);
assertIncludes(
  captureControllerSource,
  "timePhase('capture_stepper'",
  'CaptureController must time the stepper phase'
);
assertIncludes(
  captureControllerSource,
  "'download_export'",
  'CaptureController must time the download/export phase'
);
assertIncludes(
  stickyCleanupSmokeSource,
  'stack.restoreAll()',
  'sticky cleanup smoke must verify mutation-stack restoration'
);
assertIncludes(
  stickyCleanupSmokeSource,
  "data-screenshot-extension-sticky-normalized",
  'sticky cleanup smoke must assert temporary sticky marker cleanup'
);
assertIncludes(
  stickyCleanupSmokeSource,
  'shadowRootCount',
  'sticky cleanup smoke must cover sticky normalization inside open Shadow DOM'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'normalizeCapturePolicy',
  'FixedStickyNormalizer must apply explicit capturePolicy gates instead of hidden global behavior'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'isLikelyVisibleNavOverlay',
  'FixedStickyNormalizer may suppress visible nav overlays after frame 0 only when an explicit capturePolicy requests it'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'suppressVisibleNavOverlay: false',
  'FixedStickyNormalizer default policy must not treat ordinary headers as visible nav overlays'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'preserveDimmedBackdropState',
  'FixedStickyNormalizer must preserve scrollable dimmed popup backdrop state after the first frame'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'data-screenshot-extension-preserve-dim-backdrop',
  'FixedStickyNormalizer must mark dimmed backdrop hosts so broad overlay suppression does not remove page-darkening state'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'data-screenshot-extension-preserve-dim-container',
  'FixedStickyNormalizer must preserve vendor consent containers that own the dimmed backdrop layer'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'data-screenshot-extension-synthetic-dim-backdrop',
  'FixedStickyNormalizer must synthesize a preserved dim backdrop when the site removes the original during scroll'
);
assertIncludes(
  contentAgentClientSource,
  'aggregate.transformed',
  'ContentAgentClient must preserve transformed-element diagnostics from all frames'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'collectChromeDiagnostics',
  'FixedStickyNormalizer must expose passive runtime diagnostics for repeated fixed/sticky chrome'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'chromeCandidates',
  'FixedStickyNormalizer must report chrome candidates without changing capture behavior'
);
assertIncludes(
  contentAgentClientSource,
  'chromeCandidates',
  'ContentAgentClient must aggregate chrome candidate diagnostics from all frames'
);
assertIncludes(
  captureStepperSource,
  'analyzeRepeatedChrome',
  'CaptureStepper must analyze repeated chrome across captured frames'
);
assertIncludes(
  captureStepperSource,
  'summarizeTiming',
  'CaptureStepper must summarize per-frame timing diagnostics'
);
assertIncludes(
  captureStepperSource,
  'captureVisibleTabMs',
  'CaptureStepper timing must isolate captureVisibleTab time'
);
for (const repeatedReason of [
  'repeated-sticky-chrome',
  'repeated-sidebar',
  'repeated-cookie-strip',
  'repeated-floating-widget'
]) {
  assertIncludes(
    captureStepperSource,
    repeatedReason,
    `CaptureStepper must emit ${repeatedReason} diagnostics`
  );
}
assertIncludes(
  captureDiagnosticsSource,
  'repeatedChromeSummary',
  'CaptureDiagnostics must expose repeated chrome summary for reports and runner guards'
);
assertIncludes(
  captureFlowSource,
  'Repeated Chrome Diagnostics',
  'capture-flow reports must print repeated chrome diagnostics'
);
assertIncludes(
  captureFlowSource,
  'Sticky Normalization Diagnostics',
  'capture-flow reports must print compact sticky normalization diagnostics'
);
assertIncludes(
  captureFlowSource,
  'Cleanup Diagnostics',
  'capture-flow reports must print cleanup diagnostics for temporary sticky markers'
);
assertIncludes(
  runnerSource,
  'Sticky normalization:',
  'real-site runner reports must print compact sticky normalization diagnostics'
);
assertIncludes(
  runnerSource,
  'Cleanup sticky markers:',
  'real-site runner reports must print cleanup diagnostics for sticky normalization markers'
);
assertIncludes(
  runnerSource,
  'Timing Diagnostics',
  'real-site runner reports must print capture and stepper timing diagnostics'
);
assertIncludes(
  captureStoreSource,
  'waitForDownloadComplete',
  'CaptureStore must wait for download lifecycle completion before reporting saved multi-part exports'
);
assertIncludes(
  captureStoreSource,
  'chrome.downloads.onChanged',
  'CaptureStore must observe chrome download lifecycle state changes'
);
assertIncludes(
  captureStoreSource,
  'completedAt',
  'CaptureStore must expose download completion timestamps in export diagnostics'
);
assertIncludes(
  captureStoreSource,
  'downloadCompleteTimeoutMs',
  'CaptureStore download lifecycle waits must be bounded'
);
assertIncludes(
  offlinePngQaSource,
  'detectRepeatedHorizontalChromeInImage',
  'offline PNG QA must detect repeated horizontal chrome inside a single tall PNG'
);
assertIncludes(
  offlinePngQaSource,
  'detectRepeatedSideChromeInImage',
  'offline PNG QA must detect repeated sidebar/filter chrome inside a single tall PNG'
);
assertIncludes(
  offlinePngQaSource,
  'repeated-horizontal-chrome-in-image',
  'offline PNG QA must report repeated horizontal chrome inside a single image'
);
assertIncludes(
  offlinePngQaSource,
  'repeated-${candidate.side}-chrome-in-image',
  'offline PNG QA must report repeated left/right chrome inside a single image'
);
assertIncludes(
  captureFlowSource,
  'lazy-footer-links-page',
  'capture:risk must include the Allbirds-style lazy footer links fixture'
);
assertIncludes(
  captureFlowSource,
  'apple-values-three-card-carousel-page',
  'capture:risk must include the Apple-style three-card carousel missing-center fixture'
);
assertIncludes(
  captureFlowSource,
  'apple-iphone-incentive-boundary-page',
  'capture:risk must include the Apple iPhone incentive heading/subcopy split-boundary fixture'
);
assertIncludes(
  captureFlowSource,
  'apple-iphone-directory-columns-page',
  'capture:risk must include the Apple iPhone lower directory columns missing-content fixture'
);
assertIncludes(
  captureFlowSource,
  'apple-global-menu-first-frame-page',
  'capture:risk must include the Apple-style open global menu first-frame fixture'
);
assertIncludes(
  captureFlowSource,
  'rei-backpacks-product-grid-page',
  'capture:risk must include the REI-style product grid, sidebar form, and card-boundary fixture'
);
assertIncludes(
  captureFlowSource,
  'dimmed-popup-scroll-state-page',
  'capture:risk must include the scrollable dimmed-popup backdrop-state fixture'
);
assertIncludes(
  captureFlowSource,
  'fixed-top-header-page',
  'capture:risk must include a fixed top header de-duplication fixture'
);
assertIncludes(
  captureFlowSource,
  'fixed-top-small-button-page',
  'capture:risk must include a small fixed top button anti-regression fixture'
);
assertIncludes(
  captureFlowSource,
  'frameDiagnostics',
  'capture-flow must assert frame-level hidden/transformed diagnostics for fixed top header behavior'
);
assertIncludes(
  captureFlowSource,
  'fixed-background-quirk-page',
  'capture:risk must include the fixed-background preservation quirk fixture'
);
assertIncludes(
  captureFlowSource,
  'lightbox-root-quirk-page',
  'capture:risk must include the known lightbox capture-root quirk fixture'
);
assertIncludes(
  captureFlowSource,
  'fullscreen-menu-not-lightbox-page',
  'capture:risk must include a negative fullscreen-menu fixture for the known lightbox quirk'
);
assertIncludes(
  captureFlowSource,
  'quirksAppliedInclude',
  'capture-flow must be able to assert that expected QuirksLayer hooks actually applied'
);
assertIncludes(
  captureFlowSource,
  'quirksAppliedExclude',
  'capture-flow must be able to assert that unsafe QuirksLayer hooks did not apply'
);
assertIncludes(
  captureFlowSource,
  "quirksAppliedInclude: ['preserve-fixed-background']",
  'fixed-background fixture must assert the preserve-fixed-background quirk diagnostic'
);
assertIncludes(
  captureFlowSource,
  "quirksAppliedInclude: ['known-lightbox-root']",
  'lightbox-root fixture must assert the known-lightbox-root quirk diagnostic'
);
assertIncludes(
  captureFlowSource,
  "quirksAppliedExclude: ['known-lightbox-root']",
  'fullscreen-menu negative fixture must assert that known-lightbox-root did not apply'
);

assertIncludes(
  runnerSource,
  "path.join(os.homedir(), 'Desktop', 'For-Dima-from-Codex')",
  'real-site runner must publish review artifacts to /Users/<user>/Desktop/For-Dima-from-Codex by default'
);
assertIncludes(
  runnerSource,
  'process.env.REVIEW_OPTIONAL_SAMPLE_LIMIT === undefined',
  'real-site runner must only cap SAMPLE REVIEW copies when REVIEW_OPTIONAL_SAMPLE_LIMIT is explicitly set'
);
assertIncludes(
  runnerSource,
  'Number.POSITIVE_INFINITY',
  'real-site runner default SAMPLE REVIEW copy limit must be unlimited'
);
assertNotIncludes(
  runnerSource,
  "REVIEW_OPTIONAL_SAMPLE_LIMIT || '5'",
  'real-site runner must not default SAMPLE REVIEW copies to 5'
);
assertNotIncludes(
  runnerSource,
  'process.env.REVIEW_LATEST_DIR',
  'real-site runner must not publish review artifacts to a separate latest/timestamp folder; use the active review root by default'
);
assertIncludes(
  runnerSource,
  'Operational runbook: `project/tests/qa-runbook.md`',
  'real-site runner summaries must point readers to the current QA runbook'
);
assertIncludes(
  runnerSource,
  'LOOK-FIRST Markdown URLs for thread:',
  'real-site runner must print Look-first Markdown URLs as a required chat handoff block'
);
assertIncludes(
  runnerSource,
  'Required chat handoff after every run:',
  'real-site runner must write the Look-first URL handoff reminder into the Desktop README-FIRST.md'
);
assertIncludes(
  runnerSource,
  'assessDeepQaVisualGuard',
  'real-site runner must include Deep QA visual guard hooks'
);
assertIncludes(
  runnerSource,
  '## Deep QA Visual Guard',
  'real-site case reports must include Deep QA visual guard diagnostics'
);

const readProjectFile = file => fs.readFileSync(path.join(repoRoot, file), 'utf8');
const readRepoJson = file => JSON.parse(readProjectFile(file));
assertIncludes(
  readProjectFile('README.md'),
  'By default, all `SAMPLE REVIEW` captures are copied there',
  'README must document that all SAMPLE REVIEW captures are copied to the active review folder by default'
);
assertIncludes(
  readProjectFile('project/tests/test-plan.md'),
  'all `SAMPLE REVIEW` cases are copied',
  'test plan must document that all SAMPLE REVIEW captures are copied by default'
);

const qaRunbookSource = readProjectFile('project/tests/qa-runbook.md');
const currentContextSource = readProjectFile('project/docs/current-context.md');
const captureRiskPolicySource = readProjectFile('project/docs/capture-risk-policy.md');
const architectureSource = readProjectFile('project/docs/architecture.md');
assertIncludes(
  qaRunbookSource,
  '/Users/dima/Desktop/For-Dima-from-Codex',
  'QA runbook must name the active Desktop review folder'
);
assertIncludes(
  qaRunbookSource,
  'By default, copy every `SAMPLE REVIEW` case',
  'QA runbook must document that every SAMPLE REVIEW case is copied by default'
);
assertIncludes(
  qaRunbookSource,
  'Use `REVIEW_OPTIONAL_SAMPLE_LIMIT` only when the user explicitly asks for a capped subset',
  'QA runbook must make capped SAMPLE REVIEW publishing opt-in only'
);
assertIncludes(
  qaRunbookSource,
  'Do not use a per-run `latest` folder as the default review target',
  'QA runbook must forbid per-run latest folders as the default review target'
);
assertIncludes(
  qaRunbookSource,
  'LOOK-FIRST Markdown URLs for thread:',
  'QA runbook must document the mandatory Look-first URL handoff block printed by the runner'
);
assertIncludes(
  qaRunbookSource,
  '## Golden Baselines',
  'QA runbook must document when real-site golden baselines should be used'
);
assertIncludes(
  qaRunbookSource,
  'Do not use golden baselines for every user capture or every 100-site run by default',
  'QA runbook must keep golden baselines targeted rather than always-on'
);
assertIncludes(
  qaRunbookSource,
  'project/docs/capture-risk-policy.md',
  'QA runbook must point capture behavior changes to the capture risk policy source of truth'
);
assertIncludes(
  currentContextSource,
  'project/docs/capture-risk-policy.md',
  'current context must list capture-risk-policy as the source of truth for risk flags and policies'
);
for (const flag of ['fixed_sticky', 'blocking_modal', 'inaccessible_iframe']) {
  assertIncludes(
    pageProbeSource,
    flag,
    `PageProbe must emit engine risk flag ${flag}`
  );
  assertIncludes(
    captureRiskPolicySource,
    flag,
    `capture risk policy must document engine risk flag ${flag}`
  );
}
for (const quirkTerm of ['QuirksLayer', 'preserve-fixed-background', 'known-lightbox-root']) {
  assertIncludes(
    captureRiskPolicySource,
    quirkTerm,
    `capture risk policy must document ${quirkTerm}`
  );
}
assertIncludes(
  architectureSource,
  'QuirksLayer',
  'architecture docs must include the small QuirksLayer in the capture flow'
);
assertIncludes(
  captureRiskPolicySource,
  'visible_overlay_candidate',
  'capture risk policy must document visible overlay candidates as diagnostics, not runtime capture-policy flags'
);
assertIncludes(
  captureRiskPolicySource,
  'Runtime Repeated Chrome Diagnostics',
  'capture risk policy must document runtime repeated chrome diagnostics'
);
assertIncludes(
  currentContextSource,
  'runtime repeated-chrome diagnostics',
  'current context must mention the diagnostic-only repeated chrome layer'
);
assertIncludes(
  currentContextSource,
  'repeated sticky/header/sidebar chrome inside a single tall PNG',
  'current context must mention the strengthened offline PNG repeated chrome detector'
);
for (const policyTerm of [
  'capture.scrollTarget.diagnostics.riskFlags',
  "captureAction: 'viewport-only'",
  'frame 0',
  'frames 1+',
  'widthClampedToViewport',
  'splitExclusionRanges',
  'deepQa.riskTags',
  'QA tags include',
  'single-canvas',
  'tiled-output'
]) {
  assertIncludes(
    captureRiskPolicySource,
    policyTerm,
    `capture risk policy must document ${policyTerm}`
  );
}

const goldenBaselines = readRepoJson('project/tests/golden-baselines/real-sites.json').baselines;
for (const siteName of [
  'Allbirds Wool Runners',
  'Apple iPhone',
  'Apple MacBook Air',
  'Cloudflare Blog',
  'Dyson Vacuums',
  'Next.js Docs'
]) {
  const baseline = goldenBaselines.find(candidate => candidate.name === siteName);
  if (!baseline) {
    throw new Error(`golden baselines must include ${siteName}`);
  }
  if (!fs.existsSync(path.join(repoRoot, 'project/tests/golden-baselines', baseline.file))) {
    throw new Error(`golden baseline file missing for ${siteName}: ${baseline.file}`);
  }
  for (const file of baseline.files || []) {
    if (!fs.existsSync(path.join(repoRoot, 'project/tests/golden-baselines', file))) {
      throw new Error(`golden baseline part missing for ${siteName}: ${file}`);
    }
  }
}

const realSites = readRepoJson('project/tests/real-sites.json').sites;
for (const siteName of [
  'Allbirds Wool Runners',
  'Apple iPhone',
  'Apple MacBook Air',
  'Cloudflare Blog',
  'Dyson Vacuums',
  'Next.js Docs'
]) {
  const site = realSites.find(candidate => candidate.name === siteName);
  if (!site?.goldenBaseline?.file) {
    throw new Error(`${siteName} must reference its golden baseline from real-sites.json`);
  }
  if (!fs.existsSync(path.join(repoRoot, site.goldenBaseline.file))) {
    throw new Error(`${siteName} real-sites golden baseline file is missing: ${site.goldenBaseline.file}`);
  }
  for (const file of site.goldenBaseline.files || []) {
    if (!fs.existsSync(path.join(repoRoot, file))) {
      throw new Error(`${siteName} real-sites golden baseline part is missing: ${file}`);
    }
  }
}
const targetedRiskSites = realSites.filter(site => site.deepQa?.riskTags?.length);
if (targetedRiskSites.length < 15) {
  throw new Error(`targeted beta gate must include at least 15 high-risk real sites; found ${targetedRiskSites.length}`);
}

const requiredDeepQaTags = new Map([
  ['MDN Web API', 'split-boundary-text'],
  ['Next.js Docs', 'docs-sidebar-main-scroll'],
  ['Stripe Docs', 'repeated-overlay'],
  ['REI Backpacks', 'repeated-overlay'],
  ['Samsung Galaxy S', 'seam-band'],
  ['Apple MacBook Air', 'missing-content'],
  ['Sony WH-1000XM5', 'black-strip'],
  ['TypeScript Handbook', 'repeated-sidebar'],
  ['Apple iPhone', 'split-boundary-text'],
  ['LEGO Millennium Falcon', 'blocking-popup'],
  ['Nike Air Force 1', 'blocking-popup'],
  ['Microsoft Surface Pro', 'right-blank-strip'],
  ['Mermaid Live Editor', 'app-shell-readiness'],
  ['Prisma Docs', 'repeated-sidebar'],
  ['Cypress Docs', 'split-boundary-text'],
  ['FastAPI Docs', 'docs-sidebar-main-scroll'],
  ['DJI Mini 4 Pro', 'product-sticky-anti-regression'],
  ['Dyson Vacuums', 'repeated-overlay'],
  ['Laravel Docs', 'docs-sidebar-main-scroll'],
  ['MongoDB Docs', 'seam-band'],
  ['Patagonia Jackets', 'product-filter-panel']
]);
for (const [siteName, requiredTag] of requiredDeepQaTags) {
  const site = realSites.find(candidate => candidate.name === siteName);
  if (!site) {
    throw new Error(`real-sites must include ${siteName}`);
  }
  if (!(site.deepQa?.riskTags || []).includes(requiredTag)) {
    throw new Error(`${siteName} must carry deep QA risk tag ${requiredTag}`);
  }
}

const acceptedOrNeutralSites = [
  'Wikipedia Taylor Swift',
  'React Learn',
  'web.dev Articles',
  'Chrome Developers Blog',
  'Cloudflare Blog',
  'Shopify Blog',
  'Apple Watch',
  'Google Pixel Phone'
];
for (const siteName of acceptedOrNeutralSites) {
  const site = realSites.find(candidate => candidate.name === siteName);
  if (site?.deepQa?.riskTags?.length) {
    throw new Error(`${siteName} must not carry targeted deep QA tags unless a new manual regression reopens it`);
  }
}

const realSiteQaSource = readProjectFile('project/tests/real-site-qa.md');
assertIncludes(
  realSiteQaSource,
  'Operational runbook: `project/tests/qa-runbook.md`',
  'real-site QA report must point readers to the current QA runbook'
);
assertIncludes(
  realSiteQaSource,
  'Review artifacts: `/Users/dima/Desktop/For-Dima-from-Codex`',
  'real-site QA report must name the current active review folder'
);
assertNotIncludes(
  realSiteQaSource,
  'Review artifacts: `/Users/dima/Desktop/For-Dima-from-Codex/latest',
  'real-site QA report must not point readers to the retired Desktop latest folder'
);
assertNotIncludes(
  realSiteQaSource,
  'Review artifacts: `/Users/dima/Desktop/For-Dima-from-Codex/',
  'real-site QA report must not present timestamped Desktop subfolders as current review artifacts'
);

console.log('extension check ok');
