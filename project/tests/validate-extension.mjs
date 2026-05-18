import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(projectRoot, '..');
const codeRoot = path.resolve(projectRoot, '..', 'code');

const readJson = file => JSON.parse(fs.readFileSync(path.join(codeRoot, file), 'utf8'));

readJson('manifest.json');

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
  'capture/LazyLoadWarmer.js',
  'capture/PageProbe.js',
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

const runnerSource = fs.readFileSync(path.join(projectRoot, 'tests', 'real-site-runner.mjs'), 'utf8');
const captureFlowSource = fs.readFileSync(path.join(projectRoot, 'tests', 'capture-flow.mjs'), 'utf8');
const pageProbeSource = fs.readFileSync(path.join(codeRoot, 'capture/PageProbe.js'), 'utf8');
const positionPlannerSource = fs.readFileSync(path.join(codeRoot, 'capture/PositionPlanner.js'), 'utf8');
const canvasStitcherSource = fs.readFileSync(path.join(codeRoot, 'capture/CanvasStitcher.js'), 'utf8');
const canvasTilerSource = fs.readFileSync(path.join(codeRoot, 'capture/CanvasTiler.js'), 'utf8');
const canvasSizeGuardSource = fs.readFileSync(path.join(codeRoot, 'capture/CanvasSizeGuard.js'), 'utf8');
const fixedStickyNormalizerSource = fs.readFileSync(path.join(codeRoot, 'content/FixedStickyNormalizer.js'), 'utf8');
const contentAgentSource = fs.readFileSync(path.join(codeRoot, 'content/ContentAgent.js'), 'utf8');
const contentAgentClientSource = fs.readFileSync(path.join(codeRoot, 'capture/ContentAgentClient.js'), 'utf8');

assertIncludes(
  pageProbeSource,
  'splitExclusionRanges',
  'PageProbe must expose split exclusion ranges for card/section-safe multi-part boundaries'
);
assertIncludes(
  pageProbeSource,
  'riskFlags',
  'PageProbe must expose cheap risk flags for fixed/sticky and visible nav-overlay capture policy'
);
assertIncludes(
  pageProbeSource,
  'createCapturePolicy',
  'PageProbe must convert riskFlags into an explicit capturePolicy'
);
assertIncludes(
  pageProbeSource,
  'skipLazyWarmupBeforeFirstFrame',
  'PageProbe capturePolicy must preserve first-frame visible nav overlays from pre-capture warmup'
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
  positionPlannerSource,
  'createYAxisPositions',
  'PositionPlanner must use split exclusion ranges when planning vertical capture seams'
);
assertIncludes(
  positionPlannerSource,
  'adjustPositionForSafeSeam',
  'PositionPlanner must be able to add overlap when a viewport seam would cut split-sensitive content'
);
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
  'isInsideExclusion',
  'CanvasSizeGuard must avoid placing tiled-output boundaries inside split exclusion ranges'
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
  'FixedStickyNormalizer must use transform-first normalization for fixed chrome instead of only hiding'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'convertStickyToRelative',
  'FixedStickyNormalizer must convert sticky chrome to relative after the first frame'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'normalizeCapturePolicy',
  'FixedStickyNormalizer must apply explicit capturePolicy gates instead of hidden global behavior'
);
assertIncludes(
  fixedStickyNormalizerSource,
  'isLikelyVisibleNavOverlay',
  'FixedStickyNormalizer must suppress visible nav overlays after frame 0 when capturePolicy requests it'
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
for (const flag of ['fixed_sticky', 'visible_nav_overlay', 'blocking_modal', 'inaccessible_iframe']) {
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
for (const siteName of ['Cloudflare Blog', 'Dyson Vacuums', 'Next.js Docs']) {
  const baseline = goldenBaselines.find(candidate => candidate.name === siteName);
  if (!baseline) {
    throw new Error(`golden baselines must include ${siteName}`);
  }
  if (!fs.existsSync(path.join(repoRoot, 'project/tests/golden-baselines', baseline.file))) {
    throw new Error(`golden baseline file missing for ${siteName}: ${baseline.file}`);
  }
}

const realSites = readRepoJson('project/tests/real-sites.json').sites;
for (const siteName of ['Cloudflare Blog', 'Dyson Vacuums', 'Next.js Docs']) {
  const site = realSites.find(candidate => candidate.name === siteName);
  if (!site?.goldenBaseline?.file) {
    throw new Error(`${siteName} must reference its golden baseline from real-sites.json`);
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
