import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PNG} from 'pngjs';
import {chromium} from 'playwright';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(projectRoot, '..');
const codeRoot = process.env.CAPTURE_EXTENSION_ROOT ?
  path.resolve(process.env.CAPTURE_EXTENSION_ROOT) :
  path.join(repoRoot, 'code');
const configPath = process.env.REAL_SITE_CONFIG_PATH ?
  path.resolve(process.env.REAL_SITE_CONFIG_PATH) :
  path.join(projectRoot, 'tests', 'real-sites.json');
const qaReportPath = process.env.REAL_SITE_QA_REPORT_PATH ?
  path.resolve(process.env.REAL_SITE_QA_REPORT_PATH) :
  path.join(projectRoot, 'tests', 'real-site-qa.md');
const archiveRoot = process.env.REAL_SITE_ARCHIVE_ROOT ?
  path.resolve(process.env.REAL_SITE_ARCHIVE_ROOT) :
  path.join(repoRoot, 'Screenshots-for-Review');
const runsRoot = path.join(archiveRoot, 'runs');
const reportsRoot = path.join(archiveRoot, 'reports');
const latestDir = path.join(runsRoot, 'latest');
const reviewRoot = process.env.REVIEW_ARTIFACT_ROOT ?
  path.resolve(process.env.REVIEW_ARTIFACT_ROOT) :
  path.join(os.homedir(), 'Desktop', 'For-Dima-from-Codex');
const reviewLatestDir = reviewRoot;
const optionalSampleReviewLimit = process.env.REVIEW_OPTIONAL_SAMPLE_LIMIT === undefined ?
  Number.POSITIVE_INFINITY :
  Number.parseInt(process.env.REVIEW_OPTIONAL_SAMPLE_LIMIT, 10);
const preScrollY = Math.max(0, Number(process.env.REAL_SITE_PRE_SCROLL_Y) || 0);

const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site';

const downloadedArtifactName = ({downloadedFile, captureDiagnostics, index}) => {
  const diagnosticFilename = captureDiagnostics?.capture?.export?.files?.[index]?.filename;
  const filename = diagnosticFilename || path.basename(downloadedFile);

  return path.basename(filename);
};

const ensureCleanDir = async dir => {
  await fs.rm(dir, {recursive: true, force: true});
  await fs.mkdir(dir, {recursive: true});
};

const ensureCleanReviewDir = async dir => {
  await fs.mkdir(dir, {recursive: true});
  for (const name of [
    '01-LOOK-FIRST-engine-risk',
    '02-Samples',
    '03-BLOCKED-pages',
    '02-BLOCKED-pages',
    '03-OPTIONAL-samples',
    'index.md',
    'README-FIRST.md'
  ]) {
    await fs.rm(path.join(dir, name), {recursive: true, force: true}).catch(() => {});
  }
};

const copyIfPresent = async (source, targetDir) => {
  if (!source) {
    return null;
  }

  try {
    await fs.mkdir(targetDir, {recursive: true});
    const target = path.join(targetDir, path.basename(source));
    await fs.copyFile(source, target);
    return target;
  }
  catch {
    return null;
  }
};

const readPng = async file => PNG.sync.read(await fs.readFile(file));

const prepareChromePrefs = async ({userDataDir, downloadsDir}) => {
  const defaultDir = path.join(userDataDir, 'Default');
  await fs.mkdir(defaultDir, {recursive: true});
  await fs.writeFile(path.join(defaultDir, 'Preferences'), JSON.stringify({
    download: {
      default_directory: downloadsDir,
      directory_upgrade: true,
      prompt_for_download: false
    },
    safebrowsing: {
      enabled: false
    }
  }), 'utf8');
};

const copyExtensionToTempDir = async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'screenshot-extension-real-site-'));
  const extensionRoot = path.join(tempRoot, 'code');

  await fs.cp(codeRoot, extensionRoot, {recursive: true});
  const manifestPath = path.join(extensionRoot, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  manifest.host_permissions = ['<all_urls>'];
  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  return {tempRoot, extensionRoot};
};

const readExtensionId = async ({userDataDir, extensionRoot, context}) => {
  const securePreferencesPath = path.join(userDataDir, 'Default', 'Secure Preferences');
  const realExtensionRoot = await fs.realpath(extensionRoot);
  const deadline = Date.now() + 20000;

  while (Date.now() < deadline) {
    for (const worker of context?.serviceWorkers?.() || []) {
      const match = worker.url().match(/^chrome-extension:\/\/([^/]+)\//);
      if (match) {
        return match[1];
      }
    }

    try {
      const preferences = JSON.parse(await fs.readFile(securePreferencesPath, 'utf8'));
      const settings = preferences.extensions?.settings || {};

      for (const [extensionId, value] of Object.entries(settings)) {
        if (
          value.path === extensionRoot ||
          value.path === realExtensionRoot ||
          value.manifest?.name === 'Screenshot Extension'
        ) {
          return extensionId;
        }
      }
    }
    catch {}

    await Promise.race([
      context?.waitForEvent?.('serviceworker', {timeout: 250}).catch(() => null) || Promise.resolve(null),
      new Promise(resolve => setTimeout(resolve, 250))
    ]);
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error('Could not resolve loaded extension id.');
};

const launchBrowser = async ({extensionRoot, userDataDir, downloadsDir, viewport}) => {
  const options = {
    headless: process.env.REAL_SITE_HEADLESS === '1',
    viewport: null,
    acceptDownloads: true,
    downloadsPath: downloadsDir,
    ignoreDefaultArgs: ['--disable-extensions'],
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--enable-extensions',
      '--disable-features=DisableLoadExtensionCommandLineSwitch',
      `--disable-extensions-except=${extensionRoot}`,
      `--load-extension=${extensionRoot}`,
      `--window-size=${viewport.width},${viewport.height}`
    ]
  };

  if (process.env.CAPTURE_BROWSER_CHANNEL) {
    options.channel = process.env.CAPTURE_BROWSER_CHANNEL;
  }

  return chromium.launchPersistentContext(userDataDir, options);
};

const readActualViewport = async page => {
  return page.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight
  }));
};

const waitForDownloadedPngs = async ({downloadsDir, timeoutMs = 45000, quietMs = 1000}) => {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  let lastCount = 0;
  let stableSince = 0;

  while (Date.now() < deadline) {
    const entries = await fs.readdir(downloadsDir).catch(() => []);
    const hasPendingDownload = entries.some(name => name.endsWith('.crdownload'));
    const candidates = entries
      .filter(name => !name.endsWith('.crdownload'))
      .map(name => path.join(downloadsDir, name));
    const pngs = [];

    for (const file of candidates) {
      try {
        const stat = await fs.stat(file);
        if (!stat.isFile()) {
          continue;
        }

        pngs.push({
          file,
          createdAt: stat.birthtimeMs || stat.mtimeMs,
          png: await readPng(file)
        });
      }
      catch (error) {
        lastError = error;
      }
    }

    if (pngs.length > 0 && !hasPendingDownload) {
      if (pngs.length !== lastCount) {
        lastCount = pngs.length;
        stableSince = Date.now();
      }
      else if (Date.now() - stableSince >= quietMs) {
        return pngs.sort((a, b) => a.createdAt - b.createdAt);
      }
    }

    await new Promise(resolve => setTimeout(resolve, 250));
  }

  throw new Error(`PNG downloads did not complete.${lastError ? ` Last error: ${lastError.message}` : ''}`);
};

const isTransientNavigationError = error => {
  const message = error?.message || '';
  return [
    'ERR_SOCKET_NOT_CONNECTED',
    'ERR_CONNECTION_RESET',
    'ERR_CONNECTION_CLOSED',
    'ERR_CONNECTION_TIMED_OUT',
    'ERR_NETWORK_CHANGED',
    'ERR_TIMED_OUT',
    'Timeout'
  ].some(marker => message.includes(marker));
};

const gotoWithRetry = async ({page, site}) => {
  const attempts = site.navigationRetries ?? 2;
  let lastError;

  for (let attempt = 1; attempt <= attempts + 1; attempt += 1) {
    try {
      await page.goto(site.url, {
        waitUntil: site.waitUntil || 'load',
        timeout: site.timeoutMs || 45000
      });

      return {attempts: attempt};
    }
    catch (error) {
      lastError = error;
      if (attempt > attempts || !isTransientNavigationError(error)) {
        throw error;
      }

      await page.waitForTimeout(750 * attempt);
    }
  }

  throw lastError;
};

const classifyBlockedLogin = async page => {
  const text = (await page.locator('body').innerText({timeout: 3000}).catch(() => '')).toLowerCase();
  return [
    'sign in',
    'log in',
    'login',
    'create account',
    'continue with google',
    'войти',
    'авториз'
  ].some(marker => text.includes(marker));
};

const classifyBlockedAccess = async page => {
  const bodyText = await page.locator('body').innerText({timeout: 3000}).catch(() => '');
  const title = await page.title().catch(() => '');
  const text = `${title} ${bodyText}`.toLowerCase();
  return [
    'access denied',
    "you've been blocked",
    'you have been blocked',
    'blocked from accessing',
    'request blocked',
    'temporarily unavailable',
    'thank you for your patience',
    'oops! something went wrong',
    'performing security verification',
    'verify you are human',
    'security service to protect against malicious bots',
    'before you continue to youtube',
    'before you continue to google',
    'unusual traffic',
    'captcha',
    'consent.youtube.com'
  ].some(marker => text.includes(marker));
};

const inspectPreCapturePageState = async page => {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const viewportArea = Math.max(1, viewportWidth * viewportHeight);
    const isVisibleRect = rect => rect.width > 1 &&
      rect.height > 1 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < viewportHeight &&
      rect.left < viewportWidth;
    const visibleArea = rect => {
      const width = Math.max(0, Math.min(rect.right, viewportWidth) - Math.max(rect.left, 0));
      const height = Math.max(0, Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0));

      return width * height;
    };
    const descriptorFor = element => [
      element.tagName,
      element.id,
      element.className,
      element.getAttribute('role'),
      element.getAttribute('aria-modal'),
      element.getAttribute('aria-label')
    ].join(' ').toLowerCase();
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
    const documentHeight = Math.max(
      document.body?.scrollHeight || 0,
      document.documentElement?.scrollHeight || 0
    );
    const windowScrollHeight = Math.max(0, documentHeight - viewportHeight);
    const bodyText = (document.body?.innerText || '').replace(/\s+/g, ' ').trim();
    const visibleElementCount = Array.from(document.body?.querySelectorAll('*') || [])
      .slice(0, 2000)
      .filter(element => {
        const style = getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return false;
        }

        return isVisibleRect(element.getBoundingClientRect());
      }).length;
    const bodyStyle = document.body ? getComputedStyle(document.body) : null;
    const htmlStyle = document.documentElement ? getComputedStyle(document.documentElement) : null;
    const scrollLockedByStyle = [bodyStyle, htmlStyle].some(style =>
      style && ['hidden', 'clip'].includes(style.overflowY)
    ) || bodyStyle?.position === 'fixed' || htmlStyle?.position === 'fixed';
    const modalCandidates = [];
    const fixedStickyCandidates = [];
    const scrollContainerCandidates = [];
    const classifyCandidate = ({descriptor, text, rect, style, areaRatio}) => {
      const haystack = `${descriptor} ${text}`.toLowerCase();
      const leftEdge = rect.left <= viewportWidth * 0.08 && rect.width <= viewportWidth * 0.42;
      const rightEdge = rect.right >= viewportWidth * 0.92 && rect.width <= viewportWidth * 0.42;
      const topEdge = rect.top <= viewportHeight * 0.12 && rect.height <= viewportHeight * 0.35;
      const bottomEdge = rect.bottom >= viewportHeight * 0.88 && rect.height <= viewportHeight * 0.35;
      const cookieConsentLike = (
        /cookie|consent|privacy|fides|onetrust|trustarc|\bcmp\b/.test(haystack) &&
        /accept all|reject all|manage preferences|cookie preferences|cookie settings|we use cookies|your privacy|privacy choices/.test(haystack)
      ) || /fides-banner|cookie-banner|consent-banner|onetrust|trustarc|\bcmp\b/.test(descriptor);

      if (cookieConsentLike) {
        return 'cookie-consent';
      }
      if (/filter|store pickup|ship to address|select a store|nearby|zip or city/.test(haystack)) {
        return 'filter-panel';
      }
      if (/sidebar|side-nav|sidenav|toc|table of contents|on this page|nav/.test(haystack) || (leftEdge && text.split(/\s+/).length < 120)) {
        return 'sidebar-nav';
      }
      if (/dialog|modal|popup|popover|overlay|backdrop/.test(haystack) || areaRatio > 0.45) {
        return 'modal-overlay';
      }
      if (/chat|help|support|feedback|launcher/.test(haystack) || ((leftEdge || rightEdge) && (topEdge || bottomEdge))) {
        return 'floating-widget';
      }
      if (style.position === 'sticky' || style.position === 'fixed') {
        return 'sticky-chrome';
      }

      return 'unknown';
    };

    for (const element of document.body?.querySelectorAll('*') || []) {
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        continue;
      }

      const rect = element.getBoundingClientRect();
      if (!isVisibleRect(rect)) {
        continue;
      }

      const areaRatio = visibleArea(rect) / viewportArea;
      const zIndex = Number.parseInt(style.zIndex, 10);
      const fixedLayer = style.position === 'fixed' || style.position === 'sticky';
      const descriptor = descriptorFor(element);
      const maybeFixedCandidate = fixedLayer &&
        areaRatio > 0.004 &&
        fixedStickyCandidates.length < 16;
      const maybeScrollContainer = scrollContainerCandidates.length < 16 &&
        rect.height > viewportHeight * 0.25 &&
        rect.width > viewportWidth * 0.12 &&
        element.scrollHeight > element.clientHeight + 24 &&
        ['auto', 'scroll'].includes(style.overflowY);
      const descriptorDialogSemantics = element.matches('dialog[open], [aria-modal="true"], [role="dialog"]') ||
        /dialog|modal|popup|popover|overlay|backdrop|consent|cookie/.test(descriptor);
      const coversViewport = areaRatio > 0.55 &&
        rect.top <= viewportHeight * 0.2 &&
        rect.left <= viewportWidth * 0.2 &&
        rect.bottom >= viewportHeight * 0.55 &&
        rect.right >= viewportWidth * 0.55;
      const maybeModalCandidate = descriptorDialogSemantics || (fixedLayer && coversViewport);

      if (!maybeFixedCandidate && !maybeScrollContainer && !maybeModalCandidate) {
        continue;
      }

      const text = (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      const candidateKind = classifyCandidate({descriptor, text, rect, style, areaRatio});

      if (maybeFixedCandidate) {
        fixedStickyCandidates.push({
          tagName: element.tagName,
          id: element.id || '',
          className: String(element.className || '').slice(0, 120),
          role: element.getAttribute('role') || '',
          position: style.position,
          zIndex: Number.isNaN(zIndex) ? null : zIndex,
          kind: candidateKind,
          areaRatio: Number(areaRatio.toFixed(3)),
          rect: {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          },
          text: text.slice(0, 140)
        });
      }

      if (maybeScrollContainer) {
        const linkCount = element.querySelectorAll?.('a').length || 0;
        const wordCount = text ? text.split(/\s+/).filter(Boolean).length : 0;

        scrollContainerCandidates.push({
          tagName: element.tagName,
          id: element.id || '',
          className: String(element.className || '').slice(0, 120),
          role: element.getAttribute('role') || '',
          kind: candidateKind,
          position: style.position || 'static',
          linkCount,
          wordCount,
          linkDensity: Number((linkCount / Math.max(1, wordCount)).toFixed(3)),
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          scrollableY: Math.max(0, element.scrollHeight - element.clientHeight),
          ...ancestorPositionFlags(element),
          rect: {
            left: Math.round(rect.left),
            top: Math.round(rect.top),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          }
        });
      }

      if (!maybeModalCandidate) {
        continue;
      }

      modalCandidates.push({
        tagName: element.tagName,
        id: element.id || '',
        className: String(element.className || '').slice(0, 120),
        role: element.getAttribute('role') || '',
        ariaModal: element.getAttribute('aria-modal') || '',
        position: style.position,
        zIndex: Number.isNaN(zIndex) ? null : zIndex,
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
    const shouldStopAtViewport = hasModalCandidate && scrollLockedByStyle;
    const entryGateBlocking = hasEntryGate && shouldStopAtViewport;
    const reason = shouldStopAtViewport ?
      'scroll-lock' :
      (hasModalCandidate && hasFullscreenCandidate ? 'large-dialog-uncertain' : 'none');

    return {
      documentHeight,
      windowScrollHeight,
      viewportWidth,
      viewportHeight,
      hasScrollableDocument: documentHeight > viewportHeight + 10,
      bodyTextLength: bodyText.length,
      visibleElementCount,
      scrollLockedByStyle,
      modalCandidates: modalCandidates.slice(0, 8),
      fixedStickyCandidates,
      scrollContainerCandidates,
      hasModalCandidate,
      hasEntryGate,
      entryGateBlocking,
      blockingModalReason: reason,
      blockingModalUncertain: reason === 'large-dialog-uncertain',
      blockingModalCaptureAction: shouldStopAtViewport ? 'viewport-only' : 'continue',
      likelyBlockingModal: shouldStopAtViewport
    };
  }).catch(error => ({
    error: error.message || String(error),
    likelyBlockingModal: false,
    blockingModalCaptureAction: 'continue',
    blockingModalReason: 'error',
    modalCandidates: []
  }));
};

const countImageReadinessIssues = captureDiagnostics => {
  const values = [];
  const imageReadiness = captureDiagnostics?.diagnostics?.imageReadiness || {};
  if (imageReadiness.afterWarmup) {
    values.push(imageReadiness.afterWarmup);
  }

  const frames = captureDiagnostics?.diagnostics?.stepper?.frames || [];
  for (const frame of frames) {
    if (frame.imageReadiness) {
      values.push(frame.imageReadiness);
    }
  }

  return values.reduce((worst, value) => ({
    visibleImages: Math.max(worst.visibleImages, value.visibleImages || 0),
    readyImages: Math.max(worst.readyImages, value.readyImages || 0),
    pendingImages: Math.max(worst.pendingImages, value.pendingImages || 0),
    pendingImagesWithSource: Math.max(worst.pendingImagesWithSource, value.pendingImagesWithSource || 0),
    pendingImagesWithoutSource: Math.max(worst.pendingImagesWithoutSource, value.pendingImagesWithoutSource || 0),
    brokenImages: Math.max(worst.brokenImages, value.brokenImages || 0),
    brokenImageRatio: Math.max(
      worst.brokenImageRatio,
      (value.brokenImages || 0) / Math.max(1, value.visibleImages || 0)
    ),
    placeholderBlocks: Math.max(worst.placeholderBlocks, value.placeholderBlocks || 0),
    readinessRatio: Math.min(worst.readinessRatio, value.readinessRatio ?? 1)
  }), {
    visibleImages: 0,
    readyImages: 0,
    pendingImages: 0,
    pendingImagesWithSource: 0,
    pendingImagesWithoutSource: 0,
    brokenImages: 0,
    brokenImageRatio: 0,
    placeholderBlocks: 0,
    readinessRatio: 1
  });
};

const shouldSampleForHumanReview = ({site, pngs}) => {
  if (site.sampleHumanReview === false) {
    return false;
  }

  if (site.needsHumanReview === true) {
    return true;
  }

  return site.targetSegment === 'app-shell' || (pngs?.length || 0) > 1;
};

const nearlyEqual = (a, b, tolerance = 2) => Math.abs(a - b) <= tolerance;

const getExpectedBitmapWidth = ({viewport, captureDiagnostics}) => {
  const capture = captureDiagnostics?.capture;
  const outputWidth = capture?.output?.bitmapWidth;
  if (Number.isFinite(outputWidth) && outputWidth > 0) {
    return outputWidth;
  }

  const cssWidth = capture?.page?.cssWidth || viewport.width;
  const dpr = capture?.output?.dpr || capture?.page?.dpr || 1;

  return Math.round(cssWidth * dpr);
};

const assessWidthGuard = ({pngs, aggregate, viewport, visibleScreenshot, captureDiagnostics}) => {
  const expectedBitmapWidth = getExpectedBitmapWidth({viewport, captureDiagnostics});
  const viewportBitmap = visibleScreenshot ? PNG.sync.read(visibleScreenshot) : null;
  const partWidths = (pngs || []).map(item => item.png.width);
  const aggregateWidth = aggregate?.width || 0;
  const expectedViewportBitmapWidth = Math.round(viewport.width * (captureDiagnostics?.capture?.output?.dpr || captureDiagnostics?.capture?.page?.dpr || 1));
  const issues = [];

  if (expectedBitmapWidth > 0 && !nearlyEqual(aggregateWidth, expectedBitmapWidth)) {
    issues.push(`output width ${aggregateWidth}px does not match expected bitmap width ${expectedBitmapWidth}px`);
  }

  for (const [index, width] of partWidths.entries()) {
    if (expectedBitmapWidth > 0 && !nearlyEqual(width, expectedBitmapWidth)) {
      issues.push(`part ${index + 1} width ${width}px does not match expected bitmap width ${expectedBitmapWidth}px`);
    }
  }

  if (viewportBitmap && expectedViewportBitmapWidth > 0 && !nearlyEqual(viewportBitmap.width, expectedViewportBitmapWidth)) {
    issues.push(`viewport screenshot width ${viewportBitmap.width}px does not match actual viewport bitmap width ${expectedViewportBitmapWidth}px`);
  }

  if (viewportBitmap && aggregateWidth > 0 && aggregateWidth < viewportBitmap.width - 2) {
    issues.push(`capture width ${aggregateWidth}px is narrower than first viewport screenshot ${viewportBitmap.width}px`);
  }

  return {
    passed: issues.length === 0,
    expectedBitmapWidth,
    expectedViewportBitmapWidth,
    aggregateWidth,
    viewportScreenshotWidth: viewportBitmap?.width || null,
    partWidths,
    issues
  };
};

const samplePixelDistance = (a, b, ax, ay, bx, by) => {
  const aIndex = (ay * a.width + ax) * 4;
  const bIndex = (by * b.width + bx) * 4;
  const dr = Math.abs(a.data[aIndex] - b.data[bIndex]);
  const dg = Math.abs(a.data[aIndex + 1] - b.data[bIndex + 1]);
  const db = Math.abs(a.data[aIndex + 2] - b.data[bIndex + 2]);

  return (dr + dg + db) / 3;
};

const assessFirstViewportGuard = ({pngs, visibleScreenshot, captureDiagnostics}) => {
  if (!visibleScreenshot || !pngs?.length) {
    return {
      passed: true,
      skipped: true,
      reason: 'missing viewport or capture image'
    };
  }

  const viewportBitmap = PNG.sync.read(visibleScreenshot);
  const captureBitmap = pngs[0].png;
  const width = Math.min(viewportBitmap.width, captureBitmap.width);
  const height = Math.min(viewportBitmap.height, captureBitmap.height);

  if (width < 20 || height < 20) {
    return {
      passed: true,
      skipped: true,
      reason: 'image too small'
    };
  }

  const samplesX = [0.1, 0.35, 0.65, 0.9].map(value => Math.min(width - 1, Math.max(0, Math.round(width * value))));
  const samplesY = [0.15, 0.35, 0.6, 0.85].map(value => Math.min(height - 1, Math.max(0, Math.round(height * value))));
  let samples = 0;
  let changed = 0;

  for (const x of samplesX) {
    for (const y of samplesY) {
      samples += 1;
      if (samplePixelDistance(viewportBitmap, captureBitmap, x, y, x, y) > 45) {
        changed += 1;
      }
    }
  }

  const changedRatio = samples ? changed / samples : 0;
  const firstFrameHidden = captureDiagnostics?.diagnostics?.stepper?.frames?.[0]?.beforeFrame?.hidden || 0;

  return {
    passed: changedRatio <= 0.5,
    skipped: false,
    changedRatio,
    samples,
    changed,
    firstFrameHidden,
    viewportSize: `${viewportBitmap.width}x${viewportBitmap.height}`,
    captureTopSize: `${captureBitmap.width}x${captureBitmap.height}`
  };
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const analyzePngRegion = (png, region = {}) => {
  if (!png || png.width <= 0 || png.height <= 0) {
    return null;
  }

  const left = clamp(Math.floor((region.leftRatio ?? 0) * png.width), 0, png.width - 1);
  const right = clamp(Math.ceil((region.rightRatio ?? 1) * png.width), left + 1, png.width);
  const top = clamp(Math.floor((region.topRatio ?? 0) * png.height), 0, png.height - 1);
  const bottom = clamp(Math.ceil((region.bottomRatio ?? 1) * png.height), top + 1, png.height);
  const samplesX = Math.max(4, region.samplesX || 36);
  const samplesY = Math.max(4, region.samplesY || 36);
  const buckets = new Set();
  let samples = 0;
  let sumBrightness = 0;
  let sumBrightnessSquared = 0;
  let sumChroma = 0;
  let white = 0;
  let black = 0;
  let gray = 0;

  for (let yIndex = 0; yIndex < samplesY; yIndex += 1) {
    const y = clamp(Math.round(top + ((bottom - top - 1) * yIndex) / Math.max(1, samplesY - 1)), top, bottom - 1);
    for (let xIndex = 0; xIndex < samplesX; xIndex += 1) {
      const x = clamp(Math.round(left + ((right - left - 1) * xIndex) / Math.max(1, samplesX - 1)), left, right - 1);
      const index = (y * png.width + x) * 4;
      const r = png.data[index];
      const g = png.data[index + 1];
      const b = png.data[index + 2];
      const brightness = (r + g + b) / 3;
      const chroma = Math.max(r, g, b) - Math.min(r, g, b);

      samples += 1;
      sumBrightness += brightness;
      sumBrightnessSquared += brightness * brightness;
      sumChroma += chroma;
      buckets.add(`${Math.floor(r / 24)}:${Math.floor(g / 24)}:${Math.floor(b / 24)}`);

      if (brightness >= 245 && chroma <= 8) {
        white += 1;
      }
      if (brightness <= 12 && chroma <= 8) {
        black += 1;
      }
      if (brightness > 35 && brightness < 235 && chroma <= 10) {
        gray += 1;
      }
    }
  }

  const meanBrightness = samples ? sumBrightness / samples : 0;
  const variance = samples ? Math.max(0, (sumBrightnessSquared / samples) - meanBrightness * meanBrightness) : 0;
  const stddevBrightness = Math.sqrt(variance);
  const meanChroma = samples ? sumChroma / samples : 0;
  const whiteRatio = samples ? white / samples : 0;
  const blackRatio = samples ? black / samples : 0;
  const grayRatio = samples ? gray / samples : 0;
  const bucketCount = buckets.size;
  const lowEntropy = stddevBrightness < 8 && bucketCount <= 5;
  const blankLike = lowEntropy && (whiteRatio > 0.88 || blackRatio > 0.88 || grayRatio > 0.88);

  return {
    samples,
    meanBrightness: Number(meanBrightness.toFixed(1)),
    stddevBrightness: Number(stddevBrightness.toFixed(1)),
    meanChroma: Number(meanChroma.toFixed(1)),
    bucketCount,
    whiteRatio: Number(whiteRatio.toFixed(3)),
    blackRatio: Number(blackRatio.toFixed(3)),
    grayRatio: Number(grayRatio.toFixed(3)),
    lowEntropy,
    blankLike
  };
};

const regionSignature = (png, region = {}, samplesX = 8, samplesY = 8) => {
  if (!png || png.width <= 0 || png.height <= 0) {
    return null;
  }

  const left = clamp(Math.floor((region.leftRatio ?? 0) * png.width), 0, png.width - 1);
  const right = clamp(Math.ceil((region.rightRatio ?? 1) * png.width), left + 1, png.width);
  const top = clamp(Math.floor((region.topRatio ?? 0) * png.height), 0, png.height - 1);
  const bottom = clamp(Math.ceil((region.bottomRatio ?? 1) * png.height), top + 1, png.height);
  const values = [];

  for (let yIndex = 0; yIndex < samplesY; yIndex += 1) {
    const y = clamp(Math.round(top + ((bottom - top - 1) * yIndex) / Math.max(1, samplesY - 1)), top, bottom - 1);
    for (let xIndex = 0; xIndex < samplesX; xIndex += 1) {
      const x = clamp(Math.round(left + ((right - left - 1) * xIndex) / Math.max(1, samplesX - 1)), left, right - 1);
      const index = (y * png.width + x) * 4;
      values.push([
        png.data[index],
        png.data[index + 1],
        png.data[index + 2]
      ]);
    }
  }

  return values;
};

const signatureDistance = (a, b) => {
  if (!a?.length || !b?.length || a.length !== b.length) {
    return Number.POSITIVE_INFINITY;
  }

  let distance = 0;
  for (let index = 0; index < a.length; index += 1) {
    distance += (
      Math.abs(a[index][0] - b[index][0]) +
      Math.abs(a[index][1] - b[index][1]) +
      Math.abs(a[index][2] - b[index][2])
    ) / 3;
  }

  return distance / a.length;
};

const siteRiskTags = site => new Set([
  ...(site.deepQa?.riskTags || []),
  ...(site.riskTags || [])
]);

const assessDeepQaVisualGuard = ({site, pngs, aggregate, pageState, visibleScreenshot}) => {
  const tags = siteRiskTags(site);
  const issues = [];
  const signals = [];
  const viewport = visibleScreenshot ? PNG.sync.read(visibleScreenshot) : null;
  const viewportHeight = viewport?.height || pageState?.viewportHeight || 0;
  const firstCapture = pngs?.[0]?.png || null;
  const maxPartHeight = Math.max(...(pngs || []).map(item => item.png.height), 0);
  const multiPart = (pngs?.length || 0) > 1;
  const riskCandidateKinds = new Set();
  if (tags.has('repeated-overlay')) {
    riskCandidateKinds.add('cookie-consent');
    riskCandidateKinds.add('filter-panel');
    riskCandidateKinds.add('modal-overlay');
  }
  if (tags.has('product-filter-panel')) {
    riskCandidateKinds.add('filter-panel');
  }
  if (tags.has('repeated-sidebar') || tags.has('docs-sidebar-main-scroll')) {
    riskCandidateKinds.add('sidebar-nav');
  }
  const fixedRiskCandidates = (pageState?.fixedStickyCandidates || [])
    .filter(candidate => riskCandidateKinds.has(candidate.kind));
  const scrollContainers = pageState?.scrollContainerCandidates || [];
  const leftScrollContainers = scrollContainers.filter(candidate =>
    candidate.rect?.left <= (pageState?.viewportWidth || 0) * 0.18 &&
    candidate.rect?.width <= (pageState?.viewportWidth || 0) * 0.42
  );
  const widerScrollContainers = scrollContainers.filter(candidate =>
    candidate.rect?.width >= (pageState?.viewportWidth || 0) * 0.45
  );

  if (!firstCapture || !aggregate) {
    return {
      passed: true,
      skipped: true,
      reason: 'missing capture image',
      tags: [...tags],
      signals,
      issues
    };
  }

  if (tags.has('blocking-popup') && pageState?.likelyBlockingModal && aggregate.height > Math.max(1, viewportHeight) * 1.2) {
    issues.push('blocking popup risk: page state looked user-blocked but output is taller than one viewport');
  }

  if ((tags.has('repeated-overlay') || tags.has('repeated-sidebar')) && fixedRiskCandidates.length && (multiPart || aggregate.height > Math.max(1, viewportHeight) * 1.6)) {
    signals.push(`${fixedRiskCandidates.length} fixed/sticky overlay/sidebar candidates before capture`);

    for (const candidate of fixedRiskCandidates.slice(0, 6)) {
      const leftRatio = clamp(candidate.rect.left / Math.max(1, pageState?.viewportWidth || firstCapture.width), 0, 0.98);
      const topRatio = clamp(candidate.rect.top / Math.max(1, viewportHeight || firstCapture.height), 0, 0.98);
      const rightRatio = clamp((candidate.rect.left + candidate.rect.width) / Math.max(1, pageState?.viewportWidth || firstCapture.width), leftRatio + 0.01, 1);
      const bottomRatio = clamp((candidate.rect.top + candidate.rect.height) / Math.max(1, viewportHeight || firstCapture.height), topRatio + 0.01, 1);
      const source = regionSignature(firstCapture, {leftRatio, rightRatio, topRatio, bottomRatio}, 6, 6);
      const checks = [];

      for (const [partIndex, item] of (pngs || []).entries()) {
        if (partIndex === 0) {
          continue;
        }

        const target = regionSignature(item.png, {leftRatio, rightRatio, topRatio, bottomRatio}, 6, 6);
        const distance = signatureDistance(source, target);
        if (Number.isFinite(distance)) {
          checks.push(distance);
        }
      }

      if (firstCapture.height > Math.max(1, viewportHeight) * 1.5) {
        const sourceTopPx = candidate.rect.top;
        const sourceBottomPx = candidate.rect.top + candidate.rect.height;
        for (let offset = viewportHeight || 900; offset < firstCapture.height - 40; offset += Math.max(300, Math.round((viewportHeight || 900) * 0.8))) {
          const targetTopRatio = clamp((sourceTopPx + offset) / firstCapture.height, 0, 0.98);
          const targetBottomRatio = clamp((sourceBottomPx + offset) / firstCapture.height, targetTopRatio + 0.01, 1);
          const target = regionSignature(firstCapture, {
            leftRatio,
            rightRatio,
            topRatio: targetTopRatio,
            bottomRatio: targetBottomRatio
          }, 6, 6);
          const distance = signatureDistance(source, target);
          if (Number.isFinite(distance)) {
            checks.push(distance);
          }
        }
      }

      const repeated = checks.some(distance => distance <= 10);
      if (repeated) {
        issues.push(`possible repeated ${candidate.kind} candidate across output parts`);
        break;
      }
    }
  }

  if ((tags.has('repeated-sidebar') || tags.has('docs-sidebar-main-scroll')) && leftScrollContainers.length && widerScrollContainers.length) {
    signals.push(`docs-like multi-scroll layout: ${leftScrollContainers.length} left scroll container(s), ${widerScrollContainers.length} wider scroll container(s)`);

    const leftRegion = {leftRatio: 0.02, rightRatio: 0.32, topRatio: 0.08, bottomRatio: Math.min(0.92, (viewportHeight || 900) / Math.max(1, firstCapture.height))};
    const firstLeft = regionSignature(firstCapture, leftRegion, 8, 8);
    const repeatedOffsets = [];

    for (let top = viewportHeight || 900; top < firstCapture.height - 80; top += Math.max(300, Math.round((viewportHeight || 900) * 0.8))) {
      const topRatio = top / firstCapture.height;
      const bottomRatio = Math.min(1, (top + Math.min(viewportHeight || 900, 900)) / firstCapture.height);
      const distance = signatureDistance(firstLeft, regionSignature(firstCapture, {
        ...leftRegion,
        topRatio,
        bottomRatio
      }, 8, 8));

      if (distance <= 12) {
        repeatedOffsets.push(top);
      }
    }

    if (repeatedOffsets.length) {
      issues.push(`possible repeated left docs/sidebar chrome below first viewport (${repeatedOffsets.length} matching slice${repeatedOffsets.length === 1 ? '' : 's'})`);
    }
  }

  if (tags.has('split-boundary-text') && multiPart) {
    issues.push('split-boundary text risk: tagged site produced multi-part output and requires look-first until text-boundary detector is precise');
  }

  if (tags.has('seam-band') || tags.has('split-boundary-text')) {
    const stripeIssues = [];
    for (const [partIndex, item] of (pngs || []).entries()) {
      const png = item.png;
      const rowsToCheck = 24;
      const rowStep = Math.max(24, Math.floor(png.height / rowsToCheck));

      for (let y = rowStep; y < png.height - rowStep; y += rowStep) {
        const band = analyzePngRegion(png, {
          topRatio: y / png.height,
          bottomRatio: Math.min(1, (y + 10) / png.height),
          samplesX: 48,
          samplesY: 4
        });
        const above = analyzePngRegion(png, {
          topRatio: Math.max(0, (y - 40) / png.height),
          bottomRatio: Math.max(0.01, (y - 20) / png.height),
          samplesX: 24,
          samplesY: 4
        });
        const below = analyzePngRegion(png, {
          topRatio: Math.min(0.99, (y + 20) / png.height),
          bottomRatio: Math.min(1, (y + 40) / png.height),
          samplesX: 24,
          samplesY: 4
        });

        if (
          band?.stddevBrightness <= 4 &&
          band.bucketCount <= 4 &&
          Math.abs((above?.meanBrightness || 0) - band.meanBrightness) > 18 &&
          Math.abs((below?.meanBrightness || 0) - band.meanBrightness) > 18
        ) {
          stripeIssues.push(`part ${partIndex + 1} y=${y}`);
          break;
        }
      }
    }

    if (stripeIssues.length) {
      issues.push(`possible seam/horizontal band artifact (${stripeIssues.slice(0, 3).join('; ')})`);
    }
  }

  if (tags.has('black-strip') || tags.has('missing-content')) {
    const stripIssues = [];
    for (const [partIndex, item] of (pngs || []).entries()) {
      for (const [label, leftRatio, rightRatio] of [
        ['left', 0, 0.035],
        ['inner-left', 0.08, 0.115],
        ['center', 0.48, 0.52],
        ['inner-right', 0.885, 0.92],
        ['right', 0.965, 1]
      ]) {
        const strip = analyzePngRegion(item.png, {
          leftRatio,
          rightRatio,
          topRatio: 0.05,
          bottomRatio: 0.95,
          samplesX: 4,
          samplesY: 64
        });
        if (strip?.blackRatio > 0.82 && strip.lowEntropy) {
          stripIssues.push(`part ${partIndex + 1} ${label} black strip`);
        }
      }
    }

    if (stripIssues.length) {
      issues.push(`possible black/blank strip artifact (${stripIssues.slice(0, 3).join('; ')})`);
    }
  }

  if (tags.has('missing-content') && maxPartHeight > 0 && aggregate.height < Math.max(1, viewportHeight) * 1.2 && site.expect?.heightGreaterThanViewport !== false && pageState?.blockingModalCaptureAction !== 'viewport-only') {
    issues.push('missing-content risk: output is close to one viewport despite expected scrollable content');
  }

  return {
    passed: issues.length === 0,
    skipped: false,
    tags: [...tags],
    signals,
    issues
  };
};

const formatImageAnalysis = analysis => {
  if (!analysis) {
    return 'n/a';
  }

  return [
    `mean=${analysis.meanBrightness}`,
    `stddev=${analysis.stddevBrightness}`,
    `buckets=${analysis.bucketCount}`,
    `white=${Math.round(analysis.whiteRatio * 100)}%`,
    `gray=${Math.round(analysis.grayRatio * 100)}%`,
    `blankLike=${analysis.blankLike ? 'yes' : 'no'}`
  ].join(', ');
};

const assessContentGuard = ({site, pngs, visibleScreenshot}) => {
  const capture = pngs?.[0]?.png || null;
  const viewport = visibleScreenshot ? PNG.sync.read(visibleScreenshot) : null;
  const captureTopRatio = capture && viewport ?
    Math.min(1, viewport.height / Math.max(1, capture.height)) :
    1;
  const captureTop = capture ? analyzePngRegion(capture, {
    bottomRatio: captureTopRatio
  }) : null;
  const captureFull = capture ? analyzePngRegion(capture) : null;
  const viewportAnalysis = viewport ? analyzePngRegion(viewport) : null;
  const issues = [];
  const isAppShell = site.targetSegment === 'app-shell';

  if (captureFull?.blankLike) {
    issues.push(`capture appears blank or low-entropy (${formatImageAnalysis(captureFull)})`);
  }

  if (isAppShell && captureTop?.blankLike) {
    issues.push(`app-shell capture top appears not loaded (${formatImageAnalysis(captureTop)})`);
  }

  if (isAppShell && viewportAnalysis?.blankLike) {
    issues.push(`app-shell viewport appears not loaded before/after capture (${formatImageAnalysis(viewportAnalysis)})`);
  }

  return {
    passed: issues.length === 0,
    captureTop,
    captureFull,
    viewport: viewportAnalysis,
    issues
  };
};

const assessRightSideGuard = ({site, pngs, aggregate, visibleScreenshot}) => {
  const viewport = visibleScreenshot ? PNG.sync.read(visibleScreenshot) : null;
  const capture = pngs?.[0]?.png || null;
  const viewportWidth = viewport?.width || null;
  const aggregateWidth = aggregate?.width || 0;
  const issues = [];
  const rightSide = capture ? analyzePngRegion(capture, {
    leftRatio: 0.78
  }) : null;

  if (
    !site.expect?.allowWideOutput &&
    viewportWidth &&
    aggregateWidth > viewportWidth * 1.35
  ) {
    issues.push(`capture width ${aggregateWidth}px is wider than viewport screenshot ${viewportWidth}px by >35%`);
  }

  if (
    !site.expect?.allowWideOutput &&
    viewportWidth &&
    aggregateWidth > viewportWidth * 1.15 &&
    rightSide?.blankLike
  ) {
    issues.push(`right side appears blank/flat (${formatImageAnalysis(rightSide)})`);
  }

  return {
    passed: issues.length === 0,
    aggregateWidth,
    viewportScreenshotWidth: viewportWidth,
    rightSide,
    issues
  };
};

const captureDetectedBlockingModal = captureDiagnostics => {
  return captureDiagnostics?.capture?.scrollTarget?.diagnostics?.blockingModal?.captureAction === 'viewport-only';
};

const assessBlockingModalGuard = ({pageState, aggregate, visibleScreenshot, captureDiagnostics}) => {
  const detectedDuringCapture = captureDetectedBlockingModal(captureDiagnostics);
  const detectedBeforeCapture = pageState?.blockingModalCaptureAction === 'viewport-only';

  if (!detectedBeforeCapture && !detectedDuringCapture) {
    return {
      passed: true,
      skipped: true,
      reason: pageState?.blockingModalUncertain ?
        `uncertain modal detected (${pageState.blockingModalReason}); capture may continue` :
        'no scroll-locking or entry-gate modal detected',
      modalCandidates: pageState?.modalCandidates || []
    };
  }

  const viewport = visibleScreenshot ? PNG.sync.read(visibleScreenshot) : null;
  const viewportHeight = viewport?.height || pageState?.viewportHeight || 0;
  const aggregateHeight = aggregate?.height || 0;
  const passed = viewportHeight > 0 && aggregateHeight <= viewportHeight * 1.2;
  const captureBlockingModal = captureDiagnostics?.capture?.scrollTarget?.diagnostics?.blockingModal || null;

  return {
    passed,
    skipped: false,
    detectedBeforeCapture,
    detectedDuringCapture,
    reason: captureBlockingModal?.reason || pageState?.blockingModalReason || 'unknown',
    captureAction: captureBlockingModal?.captureAction || pageState?.blockingModalCaptureAction || 'viewport-only',
    viewportBitmapHeight: viewportHeight,
    aggregateHeight,
    modalCandidates: pageState?.modalCandidates || [],
    issues: passed ? [] : [
      `blocking modal was visible before capture, but output height ${aggregateHeight}px exceeds first viewport ${viewportHeight}px`
    ]
  };
};

const hasLargeNonBlockingModalCandidate = pageState => {
  return (pageState?.modalCandidates || []).some(candidate =>
    candidate.coversViewport &&
    candidate.areaRatio >= 0.9 &&
    pageState.blockingModalCaptureAction !== 'viewport-only'
  );
};

const assessDimmedBackdropContinuityGuard = ({pageState, pngs, visibleScreenshot}) => {
  if (!hasLargeNonBlockingModalCandidate(pageState)) {
    return {
      passed: true,
      skipped: true,
      reason: 'no large non-blocking modal/backdrop candidate'
    };
  }

  const capture = pngs?.[0]?.png || null;
  const viewport = visibleScreenshot ? PNG.sync.read(visibleScreenshot) : null;
  const viewportBitmapHeight = viewport?.height || 0;
  if (!capture || viewportBitmapHeight <= 0 || capture.height < viewportBitmapHeight * 1.8) {
    return {
      passed: true,
      skipped: true,
      reason: 'capture is too short for backdrop continuity comparison'
    };
  }

  const top = analyzePngRegion(capture, {
    topRatio: 0,
    bottomRatio: Math.min(1, viewportBitmapHeight / capture.height),
    samplesX: 48,
    samplesY: 48
  });
  const lowerStart = Math.min(capture.height - 1, Math.round(viewportBitmapHeight * 1.2));
  const lowerEnd = Math.min(capture.height, lowerStart + viewportBitmapHeight);
  const lower = analyzePngRegion(capture, {
    topRatio: lowerStart / capture.height,
    bottomRatio: lowerEnd / capture.height,
    samplesX: 48,
    samplesY: 48
  });
  const topLooksDimmed = top?.grayRatio >= 0.35 &&
    top.meanBrightness <= 190 &&
    top.meanChroma <= 18;
  const lowerLooksUndimmed = lower &&
    lower.meanBrightness - top.meanBrightness >= 28 &&
    top.grayRatio - lower.grayRatio >= 0.25;
  const passed = !(topLooksDimmed && lowerLooksUndimmed);

  return {
    passed,
    skipped: false,
    top,
    lower,
    viewportBitmapHeight,
    issues: passed ? [] : [
      `top viewport appears dimmed (${formatImageAnalysis(top)}) but lower capture appears undimmed (${formatImageAnalysis(lower)})`
    ]
  };
};

const assessUnexpectedShortPageRisk = ({site, pageState, viewport}) => {
  if (site.expect?.heightGreaterThanViewport === false) {
    return {
      triggered: false,
      skipped: true,
      reason: 'site does not expect multi-screen output'
    };
  }

  if (!pageState || pageState.error) {
    return {
      triggered: false,
      skipped: true,
      reason: pageState?.error ? `page-state error: ${pageState.error}` : 'missing page state'
    };
  }

  if (pageState.blockingModalCaptureAction === 'viewport-only') {
    return {
      triggered: false,
      skipped: true,
      reason: 'blocking modal intentionally limits capture to the first viewport'
    };
  }

  const viewportHeight = pageState.viewportHeight || viewport?.height || 0;
  const shortDocumentThreshold = Math.max(40, viewportHeight * 0.05);
  const documentHeight = pageState.documentHeight || 0;
  const windowScrollHeight = pageState.windowScrollHeight ?? Math.max(0, documentHeight - viewportHeight);
  const hasHighConfidenceInternalTarget = (pageState.scrollContainerCandidates || []).some(candidate => {
    const rect = candidate.rect || {};
    const widthRatio = rect.width / Math.max(1, pageState.viewportWidth || viewport?.width || 0);
    const heightRatio = rect.height / Math.max(1, viewportHeight);
    const areaRatio = (rect.width * rect.height) / Math.max(1, (pageState.viewportWidth || viewport?.width || 0) * viewportHeight);
    const edgeAnchoredNarrow = widthRatio < 0.45 &&
      (rect.left <= (pageState.viewportWidth || viewport?.width || 0) * 0.08 ||
        rect.left + rect.width >= (pageState.viewportWidth || viewport?.width || 0) * 0.92);

    return widthRatio >= 0.65 &&
      heightRatio >= 0.55 &&
      areaRatio >= 0.5 &&
      !edgeAnchoredNarrow;
  });
  const triggered = viewportHeight > 0 &&
    documentHeight <= viewportHeight + shortDocumentThreshold &&
    windowScrollHeight <= shortDocumentThreshold &&
    !hasHighConfidenceInternalTarget;

  return {
    triggered,
    skipped: false,
    documentHeight,
    viewportHeight,
    windowScrollHeight,
    shortDocumentThreshold: Math.round(shortDocumentThreshold),
    highConfidenceInternalTarget: hasHighConfidenceInternalTarget,
    reason: triggered ?
      'expected multi-screen page, but pre-capture DOM is near one viewport and no high-confidence internal scroll target was found' :
      'page has measurable document scroll or a high-confidence internal scroll target'
  };
};

const isReviewOnlyDeepQaIssue = issue => {
  return /^possible repeated (sidebar-nav|filter-panel) candidate across output parts/.test(issue) ||
    /^possible repeated left docs\/sidebar chrome below first viewport/.test(issue) ||
    /^split-boundary text risk: tagged site produced multi-part output/.test(issue);
};

const classifyDeepQaIssues = deepQaVisualGuard => {
  const issues = deepQaVisualGuard?.issues || [];
  const reviewIssues = issues.filter(isReviewOnlyDeepQaIssue);
  const unstableIssues = issues.filter(issue => !isReviewOnlyDeepQaIssue(issue));

  return {
    reviewIssues,
    unstableIssues
  };
};

const waitForAppShellLoadedState = async ({page, site}) => {
  if (site.targetSegment !== 'app-shell') {
    return {
      skipped: true,
      reason: 'site is not marked as app-shell'
    };
  }

  const timeoutMs = site.appShellReadyTimeoutMs || 10000;
  const started = Date.now();
  let lastState = null;
  let lastAnalysis = null;
  let attempts = 0;

  while (Date.now() - started < timeoutMs) {
    attempts += 1;
    lastState = await inspectPreCapturePageState(page);
    const screenshot = await page.screenshot({animations: 'disabled'}).catch(() => null);
    lastAnalysis = screenshot ? analyzePngRegion(PNG.sync.read(screenshot)) : null;

    if (
      lastAnalysis &&
      !lastAnalysis.blankLike &&
      !lastAnalysis.lowEntropy &&
      (lastState.bodyTextLength > 20 || lastState.visibleElementCount > 8)
    ) {
      return {
        skipped: false,
        timedOut: false,
        attempts,
        elapsedMs: Date.now() - started,
        state: lastState,
        screenshotAnalysis: lastAnalysis
      };
    }

    await page.waitForTimeout(500);
  }

  return {
    skipped: false,
    timedOut: true,
    attempts,
    elapsedMs: Date.now() - started,
    state: lastState,
    screenshotAnalysis: lastAnalysis
  };
};

const summarizeUnsettledScrollFrames = captureDiagnostics => {
  const frames = captureDiagnostics?.diagnostics?.stepper?.frames || [];

  return frames
    .filter(frame => frame.scrollSettled === false)
    .map(frame => {
      const planned = frame.position || {};
      const actual = frame.scroll || {};
      const state = frame.scrollDiagnostics || {};
      const maxY = state.maxY ?? actual.maxY;
      const atMaxY = state.atMaxY ?? actual.atMaxY;
      const targetType = state.targetType || actual.targetType || 'n/a';
      const clamped = state.settledAtScrollEnd ? '; settledAtScrollEnd yes' : '';
      const max = maxY === undefined ? '' : `; maxY ${maxY}; atMaxY ${atMaxY ? 'yes' : 'no'}${clamped}`;

      return `frame ${frame.frameIndex}: planned ${planned.x || 0},${planned.y || 0}; actual ${actual.x || 0},${actual.y || 0}; target ${targetType}${max}`;
    });
};

const evaluateResult = async ({site, page, png, pngs, viewport, captureDiagnostics, pageState, appShellReadiness, preCaptureVisibleScreenshot}) => {
  const assertions = [];
  const visibleScreenshot = preCaptureVisibleScreenshot ||
    await page.screenshot({animations: 'disabled'}).catch(() => null);
  const lookFirstHints = [];
  const reviewHints = [];
  const blockingModalDetectedDuringCapture = captureDetectedBlockingModal(captureDiagnostics);
  const captureBlockingModal = captureDiagnostics?.capture?.scrollTarget?.diagnostics?.blockingModal || null;
  const aggregate = pngs?.length > 1 ? {
    width: Math.max(...pngs.map(item => item.png.width)),
    height: pngs.reduce((total, item) => total + item.png.height, 0)
  } : png;

  assertions.push({
    name: 'png downloaded',
    passed: Boolean(aggregate),
    detail: aggregate ? `${aggregate.width}x${aggregate.height}` : 'missing'
  });

  if (site.expect?.heightGreaterThanViewport !== false && pageState?.blockingModalCaptureAction !== 'viewport-only') {
    assertions.push({
      name: 'height greater than viewport',
      passed: aggregate.height > viewport.height,
      detail: `${aggregate.height}px > ${viewport.height}px`
    });
  }

  if (site.expect?.widthAtLeastViewport) {
    assertions.push({
      name: 'width at least viewport',
      passed: aggregate.width >= viewport.width,
      detail: `${aggregate.width}px >= ${viewport.width}px`
    });
  }

  const widthGuard = assessWidthGuard({
    pngs,
    aggregate,
    viewport,
    visibleScreenshot,
    captureDiagnostics
  });
  assertions.push({
    name: 'bitmap width guard',
    passed: widthGuard.passed,
    detail: widthGuard.passed ?
      `${widthGuard.aggregateWidth}px matches expected ${widthGuard.expectedBitmapWidth}px` :
      widthGuard.issues.join('; ')
  });
  const firstViewportGuard = blockingModalDetectedDuringCapture ? {
    passed: true,
    skipped: true,
    reason: 'scroll-locking or entry-gate modal appeared during capture; first viewport comparison is superseded by blocking modal guard'
  } : assessFirstViewportGuard({
    pngs,
    visibleScreenshot,
    captureDiagnostics
  });
  const firstViewportAssertion = {
    name: 'first viewport similarity guard',
    passed: firstViewportGuard.passed,
    detail: firstViewportGuard.skipped ?
      `skipped: ${firstViewportGuard.reason}` :
      `${Math.round(firstViewportGuard.changedRatio * 100)}% sampled pixels changed`
  };
  assertions.push(firstViewportAssertion);
  const contentGuard = assessContentGuard({
    site,
    pngs,
    visibleScreenshot
  });
  const dynamicModalAppearance = !firstViewportGuard.passed &&
    (
      contentGuard.captureTop?.grayRatio > 0.42 ||
      (
        contentGuard.captureTop?.grayRatio > 0.25 &&
        contentGuard.viewport?.meanBrightness - contentGuard.captureTop?.meanBrightness > 28
      )
    ) &&
    contentGuard.captureTop?.stddevBrightness > 20 &&
    contentGuard.viewport?.whiteRatio > 0.25;

  if (dynamicModalAppearance) {
    firstViewportGuard.passed = true;
    firstViewportGuard.dynamicModalAppearance = true;
    firstViewportAssertion.passed = true;
    firstViewportAssertion.detail = 'dynamic modal/overlay appeared during capture; classified for review instead of hard FAIL';
    lookFirstHints.push('dynamic modal/overlay appeared during capture');
  }

  assertions.push({
    name: 'blank/app-shell content guard',
    passed: contentGuard.passed,
    detail: contentGuard.passed ?
      `capture ${formatImageAnalysis(contentGuard.captureFull)}` :
      contentGuard.issues.join('; ')
  });
  const rightSideGuard = assessRightSideGuard({
    site,
    pngs,
    aggregate,
    visibleScreenshot
  });
  assertions.push({
    name: 'width/right-side sanity guard',
    passed: rightSideGuard.passed,
    detail: rightSideGuard.passed ?
      `${rightSideGuard.aggregateWidth}px vs viewport ${rightSideGuard.viewportScreenshotWidth || 'n/a'}px` :
      rightSideGuard.issues.join('; ')
  });
  const blockingModalGuard = assessBlockingModalGuard({
    pageState,
    aggregate,
    visibleScreenshot,
    captureDiagnostics
  });
  assertions.push({
    name: 'blocking modal capture-state guard',
    passed: blockingModalGuard.passed,
    detail: blockingModalGuard.skipped ?
      `skipped: ${blockingModalGuard.reason}` :
      (blockingModalGuard.passed ?
        `${blockingModalGuard.aggregateHeight}px stays within first viewport ${blockingModalGuard.viewportBitmapHeight}px` :
        blockingModalGuard.issues.join('; '))
  });
  const unexpectedShortPageRisk = assessUnexpectedShortPageRisk({
    site,
    pageState,
    viewport
  });
  if (unexpectedShortPageRisk.triggered) {
    lookFirstHints.push(`unexpected short page risk: ${unexpectedShortPageRisk.reason}`);
  }
  const dimmedBackdropGuard = assessDimmedBackdropContinuityGuard({
    pageState,
    pngs,
    visibleScreenshot
  });
  assertions.push({
    name: 'dimmed backdrop continuity guard',
    passed: dimmedBackdropGuard.passed,
    detail: dimmedBackdropGuard.skipped ?
      `skipped: ${dimmedBackdropGuard.reason}` :
      (dimmedBackdropGuard.passed ?
        `top ${formatImageAnalysis(dimmedBackdropGuard.top)}; lower ${formatImageAnalysis(dimmedBackdropGuard.lower)}` :
        dimmedBackdropGuard.issues.join('; '))
  });
  if (!dimmedBackdropGuard.passed) {
    lookFirstHints.push(`dimmed backdrop continuity: ${dimmedBackdropGuard.issues.join('; ')}`);
  }
  const deepQaVisualGuard = assessDeepQaVisualGuard({
    site,
    pngs,
    aggregate,
    pageState,
    visibleScreenshot
  });
  const deepQaIssueClassification = classifyDeepQaIssues(deepQaVisualGuard);
  deepQaVisualGuard.unstableIssues = deepQaIssueClassification.unstableIssues;
  deepQaVisualGuard.reviewIssues = deepQaIssueClassification.reviewIssues;
  if (deepQaIssueClassification.unstableIssues.length) {
    lookFirstHints.push(`deep QA visual guard: ${deepQaIssueClassification.unstableIssues.join('; ')}`);
  }
  if (deepQaIssueClassification.reviewIssues.length) {
    reviewHints.push(`deep QA visual guard: ${deepQaIssueClassification.reviewIssues.join('; ')}`);
  }
  if (appShellReadiness && !appShellReadiness.skipped) {
    assertions.push({
      name: 'app-shell loaded-state guard',
      passed: !appShellReadiness.timedOut,
      detail: appShellReadiness.timedOut ?
        `timed out after ${appShellReadiness.elapsedMs}ms; screenshot ${formatImageAnalysis(appShellReadiness.screenshotAnalysis)}` :
        `ready after ${appShellReadiness.elapsedMs}ms; screenshot ${formatImageAnalysis(appShellReadiness.screenshotAnalysis)}`
    });
  }
  const unsettledScrollFrames = summarizeUnsettledScrollFrames(captureDiagnostics);
  if (unsettledScrollFrames.length) {
    reviewHints.push(`unsettled scroll frames: ${unsettledScrollFrames.slice(0, 5).join('; ')}`);
  }

  if (pageState?.blockingModalUncertain || captureBlockingModal?.uncertain) {
    reviewHints.push('uncertain large modal detected; capture continued for manual review');
  }

  if (aggregate.width <= 0 || aggregate.height <= 0) {
    lookFirstHints.push('invalid PNG size');
  }

  const capture = captureDiagnostics?.capture;
  if (capture?.status && capture.status !== 'success') {
    lookFirstHints.push(`capture status ${capture.status}`);
  }

  if (capture?.failureReason) {
    lookFirstHints.push(`failure reason ${capture.failureReason}`);
  }

  if (capture?.export?.status && capture.export.status !== 'saved') {
    lookFirstHints.push(`export status ${capture.export.status}`);
  }

  const readiness = countImageReadinessIssues(captureDiagnostics);
  if (readiness.pendingImagesWithSource > 2) {
    lookFirstHints.push(`${readiness.pendingImagesWithSource} pending visible images with source`);
  }
  if (readiness.brokenImages > 2 || readiness.brokenImageRatio > 0.2) {
    lookFirstHints.push(`${readiness.brokenImages} broken visible images`);
  }
  if (
    readiness.placeholderBlocks > 8 &&
    site.targetSegment !== 'app-shell' &&
    (readiness.pendingImagesWithSource > 0 || readiness.readinessRatio < 0.95)
  ) {
    lookFirstHints.push(`${readiness.placeholderBlocks} placeholder blocks`);
  }

  const failed = assertions.filter(assertion => !assertion.passed);
  const blockedLogin = await classifyBlockedLogin(page);
  const blockedAccess = await classifyBlockedAccess(page);

  if (blockedLogin && site.requiresLogin !== false) {
    return {
      status: 'BLOCKED LOGIN',
      assertions,
      visibleScreenshot,
      widthGuard,
      firstViewportGuard,
      contentGuard,
      rightSideGuard,
      blockingModalGuard,
      unexpectedShortPageRisk,
      dimmedBackdropGuard,
      deepQaVisualGuard,
      pageState,
      appShellReadiness,
      reason: 'Page appears to require sign-in or account access.'
    };
  }

  if (blockedAccess) {
    return {
      status: 'BLOCKED ACCESS',
      assertions,
      visibleScreenshot,
      widthGuard,
      firstViewportGuard,
      contentGuard,
      rightSideGuard,
      blockingModalGuard,
      unexpectedShortPageRisk,
      dimmedBackdropGuard,
      deepQaVisualGuard,
      pageState,
      appShellReadiness,
      reason: 'Page appears to show an access, bot-protection, or consent-blocking screen.'
    };
  }

  if (failed.length) {
    return {
      status: 'FAIL',
      assertions,
      visibleScreenshot,
      widthGuard,
      firstViewportGuard,
      contentGuard,
      rightSideGuard,
      blockingModalGuard,
      unexpectedShortPageRisk,
      dimmedBackdropGuard,
      deepQaVisualGuard,
      pageState,
      appShellReadiness,
      reason: failed.map(assertion => assertion.name).join(', ')
    };
  }

  if (lookFirstHints.length) {
    return {
      status: 'UNSTABLE SITE',
      assertions,
      visibleScreenshot,
      widthGuard,
      firstViewportGuard,
      contentGuard,
      rightSideGuard,
      blockingModalGuard,
      unexpectedShortPageRisk,
      dimmedBackdropGuard,
      deepQaVisualGuard,
      pageState,
      appShellReadiness,
      reason: lookFirstHints.join(', ')
    };
  }

  if (reviewHints.length) {
    return {
      status: 'SAMPLE REVIEW',
      assertions,
      visibleScreenshot,
      widthGuard,
      firstViewportGuard,
      contentGuard,
      rightSideGuard,
      blockingModalGuard,
      unexpectedShortPageRisk,
      dimmedBackdropGuard,
      deepQaVisualGuard,
      pageState,
      appShellReadiness,
      reason: reviewHints.join(', ')
    };
  }

  if (shouldSampleForHumanReview({site, pngs})) {
    return {
      status: 'SAMPLE REVIEW',
      assertions,
      visibleScreenshot,
      widthGuard,
      firstViewportGuard,
      contentGuard,
      rightSideGuard,
      blockingModalGuard,
      unexpectedShortPageRisk,
      dimmedBackdropGuard,
      deepQaVisualGuard,
      pageState,
      appShellReadiness,
      reason: 'Auto checks passed; sampled for human visual review because this target is complex or explicitly marked.'
    };
  }

  return {
    status: 'PASS_AUTO',
    assertions,
    visibleScreenshot,
    widthGuard,
    firstViewportGuard,
    contentGuard,
    rightSideGuard,
    blockingModalGuard,
    unexpectedShortPageRisk,
    dimmedBackdropGuard,
    deepQaVisualGuard,
    pageState,
    appShellReadiness,
    reason: 'Auto checks passed.'
  };
};

const formatReadiness = value => {
  if (!value) {
    return 'n/a';
  }

  return [
    `visible=${value.visibleImages}`,
    `ready=${value.readyImages}`,
    `pending=${value.pendingImages}`,
    `withSource=${value.pendingImagesWithSource || 0}`,
    `withoutSource=${value.pendingImagesWithoutSource || 0}`,
    `broken=${value.brokenImages}`,
    `placeholders=${value.placeholderBlocks}`,
    `ratio=${Math.round(value.readinessRatio * 100)}%`
  ].join(', ');
};

const summarizeFrameReadiness = diagnostics => {
  const frames = diagnostics?.diagnostics?.stepper?.frames || [];
  return frames
    .filter(frame => frame.imageReadiness)
    .sort((a, b) => {
      const aPending = a.imageReadiness.pendingImages + a.imageReadiness.brokenImages + a.imageReadiness.placeholderBlocks;
      const bPending = b.imageReadiness.pendingImages + b.imageReadiness.brokenImages + b.imageReadiness.placeholderBlocks;
      return bPending - aPending;
    })
    .slice(0, 5);
};

const summarizeStepperFrames = diagnostics => {
  const frames = diagnostics?.diagnostics?.stepper?.frames || [];

  return frames.slice(0, 12).map(frame => {
    const planned = frame.position || {};
    const actual = frame.scroll || {};
    const draw = frame.draw ?
      `, bitmap=${frame.draw.imageWidth}x${frame.draw.imageHeight}, scale=${Number(frame.draw.sourceScaleX).toFixed(3)}x${Number(frame.draw.sourceScaleY).toFixed(3)}` :
      '';
    const afterCommand = frame.scrollAfterCommand || {};
    const afterCommandMeta = Number.isFinite(Number(afterCommand.actualY)) &&
      Number(afterCommand.actualY) !== Number(actual.y || 0) ?
      `, afterScroll=${afterCommand.actualX || 0},${afterCommand.actualY || 0}` :
      '';
    const syntheticDim = frame.beforeFrame?.syntheticDimBackdropApplied ? ', syntheticDim=yes' : '';
    const policy = frame.beforeFrame?.capturePolicyApplied ? ', policy=yes' : '';
    const navSuppress = frame.beforeFrame?.suppressVisibleNavOverlay ? ', navSuppress=yes' : '';
    const scrollState = frame.scrollDiagnostics || {};
    const maxY = scrollState.maxY ?? actual.maxY;
    const targetType = scrollState.targetType || actual.targetType;
    const scrollMeta = targetType || maxY !== undefined ?
      `, target=${targetType || 'n/a'}, maxY=${maxY ?? 'n/a'}, atMaxY=${(scrollState.atMaxY ?? actual.atMaxY) ? 'yes' : 'no'}, settledAtEnd=${scrollState.settledAtScrollEnd ? 'yes' : 'no'}` :
      '';
    const timing = frame.timing?.totalMs ?
      `, frameMs=${Math.round(frame.timing.totalMs)}` :
      '';

    return `frame ${frame.frameIndex}: hidden=${frame.beforeFrame?.hidden || 0}, transformed=${frame.beforeFrame?.transformed || 0}${syntheticDim}${policy}${navSuppress}, planned=${planned.x || 0},${planned.y || 0}, actual=${actual.x || 0},${actual.y || 0}${afterCommandMeta}${scrollMeta}, settled=${frame.scrollSettled === false ? 'no' : 'yes'}${timing}${draw}`;
  });
};

const formatTimingMs = value => {
  const number = Number(value);
  return Number.isFinite(number) ? `${Math.round(number)}ms` : 'n/a';
};

const formatTimingPhases = phases => Object.entries(phases || {})
  .map(([name, value]) => ({
    name,
    elapsedMs: Number(value?.elapsedMs) || 0,
    value
  }))
  .sort((a, b) => b.elapsedMs - a.elapsedMs || a.name.localeCompare(b.name));

const writeCaseReport = async ({caseDir, result}) => {
  const lines = [
    `# Real-Site QA: ${result.name}`,
    '',
    `Generated: ${new Date().toISOString()}`,
    `Status: ${result.status}`,
    '',
    `- Type: ${result.type || 'n/a'}`,
    `- URL: ${result.url}`,
    `- Scenario: ${result.scenario || 'n/a'}`,
    `- Verify: ${result.verify || 'n/a'}`,
    `- Reason: ${result.reason || 'n/a'}`,
    ...(result.preScrollY ? [`- Pre-scroll Y: ${result.preScrollY}px`] : []),
    `- Navigation attempts: ${result.navigationAttempts || 'n/a'}`,
    `- Actual viewport: ${result.viewport ? `${result.viewport.width}x${result.viewport.height}` : 'n/a'}`,
    `- Extension PNG: ${result.extensionPng ? path.basename(result.extensionPng) : 'n/a'}`,
    `- Extension PNG parts: ${result.extensionPngs ? result.extensionPngs.map(file => path.basename(file)).join(', ') : 'n/a'}`,
    `- Viewport screenshot: ${result.viewportPng ? path.basename(result.viewportPng) : 'n/a'}`,
    ''
  ];

  if (result.png) {
    lines.push(`- PNG size: ${result.png.width}x${result.png.height}`, '');
  }

  if (result.pngs) {
    lines.push(`- PNG parts: ${result.pngs.map(png => `${png.width}x${png.height}`).join(', ')}`, '');
  }

  if (result.assertions?.length) {
    lines.push('## Assertions', '');
    for (const assertion of result.assertions) {
      lines.push(`- ${assertion.passed ? 'PASS' : 'FAIL'} ${assertion.name}: ${assertion.detail}`);
    }
    lines.push('');

    const stepperFrames = summarizeStepperFrames(result.captureDiagnostics);
    if (stepperFrames.length) {
      lines.push('## Frame Diagnostics', '');
      for (const frame of stepperFrames) {
        lines.push(`- ${frame}`);
      }
      lines.push('');
    }
  }

  if (result.widthGuard) {
    lines.push('## Width Guard', '');
    lines.push(`- Status: ${result.widthGuard.passed ? 'PASS' : 'FAIL'}`);
    lines.push(`- Expected bitmap width: ${result.widthGuard.expectedBitmapWidth || 'n/a'}`);
    lines.push(`- Aggregate PNG width: ${result.widthGuard.aggregateWidth || 'n/a'}`);
    lines.push(`- Viewport screenshot width: ${result.widthGuard.viewportScreenshotWidth || 'n/a'}`);
    lines.push(`- Part widths: ${result.widthGuard.partWidths?.length ? result.widthGuard.partWidths.join(', ') : 'n/a'}`);
    if (result.widthGuard.issues?.length) {
      lines.push(`- Issues: ${result.widthGuard.issues.join('; ')}`);
    }
    lines.push('');
  }

  if (result.firstViewportGuard) {
    lines.push('## First Viewport Guard', '');
    lines.push(`- Status: ${result.firstViewportGuard.passed ? 'PASS' : 'FAIL'}`);
    if (result.firstViewportGuard.skipped) {
      lines.push(`- Skipped: ${result.firstViewportGuard.reason}`);
    }
    else {
      lines.push(`- Viewport screenshot: ${result.firstViewportGuard.viewportSize}`);
      lines.push(`- Capture top image: ${result.firstViewportGuard.captureTopSize}`);
      lines.push(`- Changed samples: ${result.firstViewportGuard.changed}/${result.firstViewportGuard.samples}`);
      lines.push(`- Changed ratio: ${Math.round(result.firstViewportGuard.changedRatio * 100)}%`);
      if (result.firstViewportGuard.dynamicModalAppearance) {
        lines.push('- Dynamic modal appearance: yes');
      }
      if (result.firstViewportGuard.firstFrameHidden) {
        lines.push(`- First-frame hidden elements: ${result.firstViewportGuard.firstFrameHidden}`);
      }
    }
    lines.push('');
  }

  if (result.contentGuard) {
    lines.push('## Blank / App-Shell Guard', '');
    lines.push(`- Status: ${result.contentGuard.passed ? 'PASS' : 'FAIL'}`);
    lines.push(`- Capture full: ${formatImageAnalysis(result.contentGuard.captureFull)}`);
    lines.push(`- Capture top: ${formatImageAnalysis(result.contentGuard.captureTop)}`);
    lines.push(`- Viewport: ${formatImageAnalysis(result.contentGuard.viewport)}`);
    if (result.contentGuard.issues?.length) {
      lines.push(`- Issues: ${result.contentGuard.issues.join('; ')}`);
    }
    lines.push('');
  }

  if (result.rightSideGuard) {
    lines.push('## Width / Right-Side Guard', '');
    lines.push(`- Status: ${result.rightSideGuard.passed ? 'PASS' : 'FAIL'}`);
    lines.push(`- Aggregate PNG width: ${result.rightSideGuard.aggregateWidth || 'n/a'}`);
    lines.push(`- Viewport screenshot width: ${result.rightSideGuard.viewportScreenshotWidth || 'n/a'}`);
    lines.push(`- Right-side analysis: ${formatImageAnalysis(result.rightSideGuard.rightSide)}`);
    if (result.rightSideGuard.issues?.length) {
      lines.push(`- Issues: ${result.rightSideGuard.issues.join('; ')}`);
    }
    lines.push('');
  }

  if (result.blockingModalGuard) {
    lines.push('## Blocking Modal Guard', '');
    lines.push(`- Status: ${result.blockingModalGuard.passed ? 'PASS' : 'FAIL'}`);
    if (result.blockingModalGuard.skipped) {
      lines.push(`- Skipped: ${result.blockingModalGuard.reason}`);
    }
    else {
      lines.push(`- Aggregate PNG height: ${result.blockingModalGuard.aggregateHeight || 'n/a'}`);
      lines.push(`- Viewport bitmap height: ${result.blockingModalGuard.viewportBitmapHeight || 'n/a'}`);
      lines.push(`- Detected before capture: ${result.blockingModalGuard.detectedBeforeCapture ? 'yes' : 'no'}`);
      lines.push(`- Detected during capture: ${result.blockingModalGuard.detectedDuringCapture ? 'yes' : 'no'}`);
      lines.push(`- Reason: ${result.blockingModalGuard.reason || 'n/a'}`);
      lines.push(`- Capture action: ${result.blockingModalGuard.captureAction || 'n/a'}`);
      if (result.blockingModalGuard.issues?.length) {
        lines.push(`- Issues: ${result.blockingModalGuard.issues.join('; ')}`);
      }
    }
    lines.push('');
  }

  if (result.unexpectedShortPageRisk) {
    lines.push('## Unexpected Short Page Risk', '');
    lines.push(`- Status: ${result.unexpectedShortPageRisk.triggered ? 'WARN' : 'PASS'}`);
    if (result.unexpectedShortPageRisk.skipped) {
      lines.push(`- Skipped: ${result.unexpectedShortPageRisk.reason}`);
    }
    else {
      lines.push(`- Reason: ${result.unexpectedShortPageRisk.reason}`);
      lines.push(`- Document height: ${result.unexpectedShortPageRisk.documentHeight || 'n/a'}`);
      lines.push(`- Viewport height: ${result.unexpectedShortPageRisk.viewportHeight || 'n/a'}`);
      lines.push(`- Window scrollHeight delta: ${result.unexpectedShortPageRisk.windowScrollHeight ?? 'n/a'}`);
      lines.push(`- Short-page threshold: ${result.unexpectedShortPageRisk.shortDocumentThreshold || 'n/a'}`);
      lines.push(`- High-confidence internal target: ${result.unexpectedShortPageRisk.highConfidenceInternalTarget ? 'yes' : 'no'}`);
    }
    lines.push('');
  }

  if (result.dimmedBackdropGuard) {
    lines.push('## Dimmed Backdrop Continuity Guard', '');
    lines.push(`- Status: ${result.dimmedBackdropGuard.passed ? 'PASS' : 'FAIL'}`);
    if (result.dimmedBackdropGuard.skipped) {
      lines.push(`- Skipped: ${result.dimmedBackdropGuard.reason}`);
    }
    else {
      lines.push(`- Top viewport: ${formatImageAnalysis(result.dimmedBackdropGuard.top)}`);
      lines.push(`- Lower capture: ${formatImageAnalysis(result.dimmedBackdropGuard.lower)}`);
      if (result.dimmedBackdropGuard.issues?.length) {
        lines.push(`- Issues: ${result.dimmedBackdropGuard.issues.join('; ')}`);
      }
    }
    lines.push('');
  }

  if (result.deepQaVisualGuard) {
    const hasUnstableIssues = Boolean(result.deepQaVisualGuard.unstableIssues?.length);
    const hasReviewIssues = Boolean(result.deepQaVisualGuard.reviewIssues?.length);
    lines.push('## Deep QA Visual Guard', '');
    lines.push(`- Status: ${result.deepQaVisualGuard.passed ? 'PASS' : (hasUnstableIssues ? 'UNSTABLE' : 'REVIEW')}`);
    if (result.deepQaVisualGuard.skipped) {
      lines.push(`- Skipped: ${result.deepQaVisualGuard.reason}`);
    }
    lines.push(`- Risk tags: ${result.deepQaVisualGuard.tags?.length ? result.deepQaVisualGuard.tags.join(', ') : 'none'}`);
    if (result.deepQaVisualGuard.signals?.length) {
      lines.push(`- Signals: ${result.deepQaVisualGuard.signals.join('; ')}`);
    }
    if (result.deepQaVisualGuard.issues?.length) {
      lines.push(`- Issues: ${result.deepQaVisualGuard.issues.join('; ')}`);
    }
    if (hasUnstableIssues) {
      lines.push(`- Look-first issues: ${result.deepQaVisualGuard.unstableIssues.join('; ')}`);
    }
    if (hasReviewIssues) {
      lines.push(`- Review-only issues: ${result.deepQaVisualGuard.reviewIssues.join('; ')}`);
    }
    lines.push('');
  }

  if (result.appShellReadiness && !result.appShellReadiness.skipped) {
    lines.push('## App-Shell Loaded-State Guard', '');
    lines.push(`- Status: ${result.appShellReadiness.timedOut ? 'FAIL' : 'PASS'}`);
    lines.push(`- Attempts: ${result.appShellReadiness.attempts || 'n/a'}`);
    lines.push(`- Elapsed: ${result.appShellReadiness.elapsedMs ?? 'n/a'}ms`);
    lines.push(`- Screenshot analysis: ${formatImageAnalysis(result.appShellReadiness.screenshotAnalysis)}`);
    if (result.appShellReadiness.state) {
      lines.push(`- Body text length: ${result.appShellReadiness.state.bodyTextLength ?? 'n/a'}`);
      lines.push(`- Visible element count: ${result.appShellReadiness.state.visibleElementCount ?? 'n/a'}`);
    }
    lines.push('');
  }

  if (result.pageState) {
    lines.push('## Pre-Capture Page State', '');
    if (result.pageState.error) {
      lines.push(`- Error: ${result.pageState.error}`);
    }
    else {
      lines.push(`- Document height: ${result.pageState.documentHeight || 'n/a'}`);
      lines.push(`- Viewport: ${result.pageState.viewportWidth || 'n/a'}x${result.pageState.viewportHeight || 'n/a'}`);
      lines.push(`- Scrollable document: ${result.pageState.hasScrollableDocument ? 'yes' : 'no'}`);
      lines.push(`- Scroll locked by style: ${result.pageState.scrollLockedByStyle ? 'yes' : 'no'}`);
      lines.push(`- Likely blocking modal: ${result.pageState.likelyBlockingModal ? 'yes' : 'no'}`);
      lines.push(`- Modal reason: ${result.pageState.blockingModalReason || 'n/a'}`);
      lines.push(`- Modal capture action: ${result.pageState.blockingModalCaptureAction || 'n/a'}`);
      lines.push(`- Uncertain modal: ${result.pageState.blockingModalUncertain ? 'yes' : 'no'}`);
      lines.push(`- Body text length: ${result.pageState.bodyTextLength ?? 'n/a'}`);
      lines.push(`- Visible element count: ${result.pageState.visibleElementCount ?? 'n/a'}`);
      lines.push(`- Modal candidates: ${result.pageState.modalCandidates?.length || 0}`);
      for (const candidate of result.pageState.modalCandidates || []) {
        lines.push(`  - ${candidate.tagName}${candidate.id ? `#${candidate.id}` : ''} role=${candidate.role || 'n/a'} ariaModal=${candidate.ariaModal || 'n/a'} position=${candidate.position || 'n/a'} area=${candidate.areaRatio} entryGate=${candidate.entryGate ? 'yes' : 'no'}`);
      }
      lines.push(`- Fixed/sticky candidates: ${result.pageState.fixedStickyCandidates?.length || 0}`);
      for (const candidate of result.pageState.fixedStickyCandidates || []) {
        lines.push(`  - ${candidate.kind}: ${candidate.tagName}${candidate.id ? `#${candidate.id}` : ''} position=${candidate.position || 'n/a'} area=${candidate.areaRatio} rect=${candidate.rect?.left || 0},${candidate.rect?.top || 0},${candidate.rect?.width || 0}x${candidate.rect?.height || 0}`);
      }
      lines.push(`- Scroll-container candidates: ${result.pageState.scrollContainerCandidates?.length || 0}`);
      lines.push(`- Window scrollHeight delta: ${result.pageState.windowScrollHeight ?? 'n/a'}`);
      for (const candidate of result.pageState.scrollContainerCandidates || []) {
        lines.push(`  - ${candidate.kind}: ${candidate.tagName}${candidate.id ? `#${candidate.id}` : ''} role=${candidate.role || 'n/a'} position=${candidate.position || 'n/a'} fixedAncestor=${candidate.hasFixedAncestor ? 'yes' : 'no'} stickyAncestor=${candidate.hasStickyAncestor ? 'yes' : 'no'} links=${candidate.linkCount || 0} words=${candidate.wordCount || 0} rect=${candidate.rect?.left || 0},${candidate.rect?.top || 0},${candidate.rect?.width || 0}x${candidate.rect?.height || 0} scroll=${candidate.clientHeight || 0}/${candidate.scrollHeight || 0}`);
      }
    }
    lines.push('');
  }

  if (result.captureDiagnostics) {
    const capture = result.captureDiagnostics.capture;
    if (capture) {
      lines.push('## Capture Diagnostics v2', '');
      lines.push(`- Status: ${capture.status}`);
      lines.push(`- Failure reason: ${capture.failureReason || 'n/a'}`);
      lines.push(`- CSS page: ${capture.page ? `${capture.page.cssWidth}x${capture.page.cssHeight}` : 'n/a'}`);
      lines.push(`- Bitmap: ${capture.output ? `${capture.output.bitmapWidth}x${capture.output.bitmapHeight}` : 'n/a'}`);
      lines.push(`- DPR: ${capture.output?.dpr || capture.page?.dpr || 'n/a'}`);
      lines.push(`- Strategy: ${capture.output?.strategy || 'n/a'}`);
      lines.push(`- Tile count: ${capture.output?.tileCount || 'n/a'}`);
      lines.push(`- Scroll target: ${capture.scrollTarget?.type || 'n/a'}`);
      const capturePolicy = capture.page?.capturePolicy || capture.scrollTarget?.capturePolicy || capture.scrollTarget?.diagnostics?.capturePolicy;
      if (capturePolicy) {
        lines.push(`- Capture policy: mode=${capturePolicy.mode || 'n/a'}, reasons=${(capturePolicy.reasons || []).join(', ') || 'none'}`);
        lines.push(`- Capture policy after frame 0: normalizeFixedSticky=${capturePolicy.afterFirstFrame?.normalizeFixedSticky ? 'yes' : 'no'}, suppressVisibleNavOverlay=${capturePolicy.afterFirstFrame?.suppressVisibleNavOverlay ? 'yes' : 'no'}, suppressRepeatedOverlays=${capturePolicy.afterFirstFrame?.suppressRepeatedOverlays ? 'yes' : 'no'}, preserveDimmedBackdrop=${capturePolicy.afterFirstFrame?.preserveDimmedBackdrop ? 'yes' : 'no'}`);
        lines.push(`- Capture policy skips warmup before frame 0: ${capturePolicy.skipLazyWarmupBeforeFirstFrame ? 'yes' : 'no'}`);
      }
      if (capture.scrollTarget?.diagnostics) {
        lines.push(`- Risk flags: ${(capture.scrollTarget.diagnostics.riskFlags || []).join(', ') || 'none'}`);
        lines.push(`- Fixed/sticky probe candidates: ${capture.scrollTarget.diagnostics.fixedStickyCandidateCount || 0}`);
        lines.push(`- Visible overlay probe candidates: ${capture.scrollTarget.diagnostics.visibleOverlayCandidateCount || 0}`);
        lines.push(`- Internal scroll candidates: ${capture.scrollTarget.diagnostics.internalScrollCandidateCount || 0}`);
        lines.push(`- Window scrollHeight delta: ${capture.scrollTarget.diagnostics.windowScrollHeight ?? 'n/a'}`);
        const blockingModal = capture.scrollTarget.diagnostics.blockingModal;
        if (blockingModal) {
          const decision = blockingModal.modalDecision || {};
          const sources = (blockingModal.scrollLockSources || decision.scrollLockSources || []).join(', ') || 'none';
          lines.push(`- Blocking modal decision: action=${blockingModal.captureAction || 'n/a'}, reason=${blockingModal.reason || 'n/a'}, atTop=${decision.atPageTop ? 'yes' : 'no'}, scrollY=${decision.scrollY ?? 'n/a'}, windowScrollableY=${decision.windowScrollableY ?? 'n/a'}, scrollLockSources=${sources}`);
          for (const candidate of blockingModal.modalCandidates || []) {
            const rect = candidate.rect || {};
            lines.push(`  - modal candidate: ${candidate.descriptor || candidate.tag || 'n/a'} role=${candidate.role || 'n/a'} ariaModal=${candidate.ariaModal || 'n/a'} position=${candidate.position || 'n/a'} covers=${candidate.coversViewport ? 'yes' : 'no'} entryGate=${candidate.entryGate ? 'yes' : 'no'} area=${candidate.areaRatio ?? 'n/a'} rect=${rect.left || 0},${rect.top || 0},${rect.width || 0}x${rect.height || 0}`);
          }
        }
        const splitSummary = capture.scrollTarget.diagnostics.splitExclusionSummary;
        if (splitSummary) {
          const byReason = Object.entries(splitSummary.byReason || {})
            .map(([reason, count]) => `${reason}:${count}`)
            .join(', ') || 'none';
          lines.push(`- Split exclusion ranges: count=${splitSummary.count || 0}, maxHeight=${splitSummary.maxHeight || 0}, byReason=${byReason}`);
        }
        const geometryAvoidRanges = capture.scrollTarget.diagnostics.geometryAvoidRangeDiagnostics;
        if (geometryAvoidRanges) {
          lines.push(`- Geometry avoid ranges: scanned=${geometryAvoidRanges.scanned || 0}, cardAdded=${geometryAvoidRanges.cardAdded || 0}, gridRowAdded=${geometryAvoidRanges.gridRowAdded || 0}, elapsedMs=${geometryAvoidRanges.elapsedMs ?? 'n/a'}`);
        }
        if (capture.scrollTarget.diagnostics.splitLayoutRisk) {
          lines.push(`- Split layout risk: yes, reason=${capture.scrollTarget.diagnostics.splitLayoutRiskReason || 'n/a'}, shortColumn=${capture.scrollTarget.diagnostics.shortColumnSide || 'n/a'}, heightRatio=${capture.scrollTarget.diagnostics.heightRatio || capture.scrollTarget.diagnostics.tallColumnRatio || 'n/a'}, stickyLike=${capture.scrollTarget.diagnostics.stickyLikeDetected ? 'yes' : 'no'}`);
        }
        const selectedScrollCandidate = capture.scrollTarget.diagnostics.selectedScrollCandidate;
        if (selectedScrollCandidate) {
          const rect = selectedScrollCandidate.rect || {};
          lines.push(`- Selected scroll candidate: ${selectedScrollCandidate.descriptor || 'n/a'} position=${selectedScrollCandidate.position || 'n/a'} fixedAncestor=${selectedScrollCandidate.hasFixedAncestor ? 'yes' : 'no'} stickyAncestor=${selectedScrollCandidate.hasStickyAncestor ? 'yes' : 'no'} rect=${rect.left || 0},${rect.top || 0},${rect.width || 0}x${rect.height || 0} scroll=${selectedScrollCandidate.clientHeight || 0}/${selectedScrollCandidate.scrollHeight || 0}`);
        }
      }
      const stickyNormalization = result.captureDiagnostics.diagnostics?.stickyNormalization?.active ||
        result.captureDiagnostics.diagnostics?.stickyNormalization?.afterWarmup ||
        result.captureDiagnostics.diagnostics?.stickyNormalization?.beforeWarmup;
      if (stickyNormalization) {
        lines.push(`- Sticky normalization: applied=${stickyNormalization.applied ? 'yes' : 'no'}, normalized=${stickyNormalization.normalized || 0}, frames=${stickyNormalization.framesWithNormalizedSticky || 0}/${stickyNormalization.frameCount || 0}, shadowRoots=${stickyNormalization.shadowRootCount || 0}, reasons=${(stickyNormalization.reasons || [stickyNormalization.reason]).filter(Boolean).join(', ') || 'none'}`);
      }
      const repeatedChrome = capture.repeatedChromeSummary ||
        result.captureDiagnostics.diagnostics?.stepper?.repeatedChrome;
      if (repeatedChrome) {
        lines.push(`- Repeated chrome: candidates=${repeatedChrome.candidateCount || 0}, repeated=${repeatedChrome.repeatedCount || 0}, reasons=${(repeatedChrome.reasons || []).join(', ') || 'none'}`);
      }
      const cleanup = result.captureDiagnostics.diagnostics?.cleanup?.content;
      if (cleanup) {
        lines.push(`- Cleanup sticky markers: before=${cleanup.beforeRestore?.stickyMarkers || 0}, after=${cleanup.afterRestore?.stickyMarkers || 0}`);
        lines.push(`- Cleanup sticky rules: before=${cleanup.beforeRestore?.stickyNormalizationRules || 0}, after=${cleanup.afterRestore?.stickyNormalizationRules || 0}`);
      }
      lines.push(`- Single-file decision: ${capture.singleFileExportAttempt?.decision || 'n/a'}`);
      lines.push(`- Export status: ${capture.export?.status || 'n/a'}`);
      lines.push(`- Export files: ${capture.export?.files?.length || 0}`);
      if (capture.export?.files?.length) {
        for (const file of capture.export.files) {
          const lifecycle = file.lifecycle || {};
          lines.push(`  - part ${file.part || '?'}: downloadId=${file.downloadId || 'n/a'}, wait=${lifecycle.waitStatus || 'n/a'}, started=${lifecycle.startedAt || 'n/a'}, completed=${lifecycle.completedAt || 'n/a'}, filename=${file.filename || 'n/a'}`);
        }
      }
      if (capture.export?.errors?.length) {
        lines.push(`- Export errors: ${capture.export.errors.join('; ')}`);
      }
      if (capture.timing) {
        lines.push(`- Total elapsed: ${formatTimingMs(capture.timing.totalMs)}`);
      }
      lines.push('');
    }

    const captureTiming = result.captureDiagnostics.capture?.timing;
    const stepperTiming = result.captureDiagnostics.diagnostics?.stepper?.timing;
    if (captureTiming || stepperTiming) {
      lines.push('## Timing Diagnostics', '');
      if (captureTiming) {
        lines.push(`- Capture total: ${formatTimingMs(captureTiming.totalMs)}`);
        const phases = formatTimingPhases(captureTiming.phases);
        if (phases.length) {
          lines.push('- Slowest capture phases:');
          for (const phase of phases.slice(0, 12)) {
            const extras = Object.entries(phase.value || {})
              .filter(([key]) => key !== 'elapsedMs')
              .map(([key, value]) => `${key}=${value}`)
              .join(', ');
            lines.push(`  - ${phase.name}: ${formatTimingMs(phase.elapsedMs)}${extras ? ` (${extras})` : ''}`);
          }
        }
      }
      if (stepperTiming) {
        lines.push(`- Stepper total: ${formatTimingMs(stepperTiming.totalMs)} across ${stepperTiming.frameCount || 0} frame(s)`);
        const totals = Object.entries(stepperTiming.totals || {})
          .sort(([, a], [, b]) => (Number(b) || 0) - (Number(a) || 0));
        if (totals.length) {
          lines.push('- Stepper phase totals:');
          for (const [name, value] of totals.slice(0, 12)) {
            lines.push(`  - ${name}: ${formatTimingMs(value)}`);
          }
        }
      }
      lines.push('');
    }

    const lazyWarmup = result.captureDiagnostics.diagnostics?.lazyWarmup;
    if (lazyWarmup) {
      lines.push('## Lazy Warmup', '');
      lines.push(`- Skipped: ${lazyWarmup.skipped ? 'yes' : 'no'}`);
      lines.push(`- Reason: ${lazyWarmup.reason || 'n/a'}`);
      lines.push(`- Visited positions: ${lazyWarmup.visited ?? 'n/a'}`);
      lines.push(`- Elapsed: ${lazyWarmup.elapsedMs ?? 'n/a'}ms`);
      lines.push(`- Timed out: ${lazyWarmup.timedOut ? 'yes' : 'no'}`);
      lines.push('');
    }

    const imageReadiness = result.captureDiagnostics.diagnostics?.imageReadiness || {};
    lines.push('## Image Readiness Diagnostics', '');
    lines.push(`- Before warmup: ${formatReadiness(imageReadiness.beforeWarmup)}`);
    lines.push(`- After warmup: ${formatReadiness(imageReadiness.afterWarmup)}`);

    const frames = summarizeFrameReadiness(result.captureDiagnostics);
  if (frames.length) {
    lines.push('- Worst frames:');
    for (const frame of frames) {
        lines.push(`  - frame ${frame.frameIndex}: ${formatReadiness(frame.imageReadiness)}${frame.readinessRetries ? `, retries=${frame.readinessRetries}, spent=${frame.readinessRetrySpentMs || 0}ms` : ''}`);
      }
    }
    lines.push('');
  }

  if (result.error) {
    lines.push('## Error', '', result.error, '');
  }

  await fs.writeFile(path.join(caseDir, 'report.md'), lines.join('\n'), 'utf8');
};

const writeSummaryReport = async results => {
  const lines = [
    '# Real-Site QA',
    '',
    `Generated: ${new Date().toISOString()}`,
    'Operational runbook: `project/tests/qa-runbook.md`',
    `Full artifacts: \`Screenshots-for-Review/runs/latest/\``,
    `Review artifacts: \`${reviewLatestDir}\``,
    '',
    '| Site | Type | Status | PNG | Report |',
    '| --- | --- | --- | --- | --- |',
    ...results.map(result => {
      const png = result.pngs ?
        result.pngs.map(png => `${png.width}x${png.height}`).join(', ') :
        (result.png ? `${result.png.width}x${result.png.height}` : 'n/a');
      return `| ${result.name} | ${result.type || 'n/a'} | ${result.status} | ${png} | ${result.reportPath || 'n/a'} |`;
    }),
    ''
  ];

  const review = results.filter(result => [
    'FAIL',
    'SAMPLE REVIEW',
    'BLOCKED LOGIN',
    'BLOCKED ACCESS',
    'UNSTABLE SITE'
  ].includes(result.status));
  if (review.length) {
    lines.push('## Needs Review', '');
    for (const result of review) {
      lines.push(`- ${result.status}: ${result.name} - ${result.reason || 'review artifact'}`);
    }
    lines.push('');
  }

  const summary = lines.join('\n');
  await fs.mkdir(reportsRoot, {recursive: true});
  await fs.writeFile(path.join(latestDir, 'summary.md'), summary, 'utf8');
  await fs.writeFile(path.join(reportsRoot, 'latest.md'), summary, 'utf8');
  await fs.writeFile(qaReportPath, summary, 'utf8');
};

const lookFirstResults = results => results.filter(result =>
  result.status === 'FAIL' ||
  result.status === 'UNSTABLE SITE'
);

const lookFirstMarkdownLinks = results => lookFirstResults(results)
  .map(result => `- [${result.name}](${result.url})`);

const copyReviewArtifacts = async results => {
  const reviewStatuses = new Set([
    'FAIL',
    'SAMPLE REVIEW',
    'BLOCKED LOGIN',
    'BLOCKED ACCESS',
    'UNSTABLE SITE'
  ]);
  const reviewBucket = result => {
    if (result.status === 'FAIL' || result.status === 'UNSTABLE SITE') {
      return '01-LOOK-FIRST-engine-risk';
    }

    if (result.status === 'BLOCKED LOGIN' || result.status === 'BLOCKED ACCESS') {
      return '03-BLOCKED-pages';
    }

    return '02-Samples';
  };
  const requiredReviewResults = results.filter(result =>
    result.status === 'FAIL' ||
    result.status === 'BLOCKED LOGIN' ||
    result.status === 'BLOCKED ACCESS' ||
    result.status === 'UNSTABLE SITE'
  );
  const sampleReviewResults = results.filter(result => result.status === 'SAMPLE REVIEW');
  const optionalReviewResults = sampleReviewResults
    .slice(0, Number.isFinite(optionalSampleReviewLimit) ? Math.max(0, optionalSampleReviewLimit) : sampleReviewResults.length);
  const skippedOptionalReviewCount = Math.max(
    0,
    sampleReviewResults.length - optionalReviewResults.length
  );
  const reviewResults = [...requiredReviewResults, ...optionalReviewResults]
    .filter(result => reviewStatuses.has(result.status));
  const lines = [
    '# Screenshots for Dima',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    'This folder contains prioritized cases for human review. Full run archives stay inside the project.',
    '',
    skippedOptionalReviewCount ?
      `Optional samples are capped at ${optionalReviewResults.length}; ${skippedOptionalReviewCount} additional SAMPLE REVIEW cases remain only in the full artifacts.` :
      'All SAMPLE REVIEW cases are included in this folder.',
    '',
    '| Site | Status | Reason |',
    '| --- | --- | --- |'
  ];

  for (const result of reviewResults) {
    const bucket = reviewBucket(result);
    const caseDir = path.join(reviewLatestDir, bucket, slug(result.name));
    await fs.mkdir(caseDir, {recursive: true});
    await copyIfPresent(result.reportPath, caseDir);
    await copyIfPresent(result.viewportPng, caseDir);
    await copyIfPresent(result.extensionPng, caseDir);

    for (const file of result.extensionPngs || []) {
      await copyIfPresent(file, caseDir);
    }

    const captureFiles = result.extensionPngs?.length ?
      result.extensionPngs.map((file, index) => {
        const dimensions = result.pngs?.[index] ? ` - ${result.pngs[index].width}x${result.pngs[index].height}` : '';
        return `- ${path.basename(file)}${dimensions}`;
      }) :
      (result.extensionPng ? [`- ${path.basename(result.extensionPng)}${result.png ? ` - ${result.png.width}x${result.png.height}` : ''}`] : []);
    await fs.writeFile(path.join(caseDir, 'README-FIRST.md'), [
      `# ${result.name}`,
      '',
      `Status: ${result.status}`,
      `Reason: ${result.reason || 'n/a'}`,
      '',
      'Open first:',
      '',
      result.reportPath ? '- `report.md` for status, viewport, DPR, and diagnostics.' : '- `report.md` if present.',
      '- `viewport-before-capture.png` to compare the first visible screen.',
      '',
      'Capture files:',
      '',
      ...captureFiles,
      '',
      result.extensionPngs?.length ?
        'This capture is intentionally saved as multiple parts because the full bitmap is too large for one reliable browser canvas.' :
        'This capture is saved as one PNG.',
      ''
    ].join('\n'), 'utf8');

    lines.push(`| ${result.name} | ${result.status} | ${bucket}/${slug(result.name)} - ${result.reason || 'n/a'} |`);
  }

  if (!reviewResults.length) {
    lines.push('| n/a | PASS | No disputed cases in this run. |');
  }

  await fs.writeFile(path.join(reviewLatestDir, 'index.md'), lines.join('\n'), 'utf8');
  await fs.writeFile(path.join(reviewLatestDir, 'README-FIRST.md'), [
    '# What to Review First',
    '',
    'Required chat handoff after every run:',
    '',
    '- Paste the Markdown URLs from `01-LOOK-FIRST-engine-risk` into the thread before ending the turn.',
    '- Use the original site URLs, not only folder names.',
    '',
    'Open folders in this order:',
    '',
    '1. `01-LOOK-FIRST-engine-risk` - likely capture issues or unstable image readiness.',
    skippedOptionalReviewCount ?
      `2. \`02-Samples\` - capped sample of complex captures that passed auto checks. Current cap: ${optionalReviewResults.length}.` :
      `2. \`02-Samples\` - all ${optionalReviewResults.length} SAMPLE REVIEW captures from this run.`,
    '3. `03-BLOCKED-pages` - login, bot, consent, or access-blocked pages.',
    '',
    skippedOptionalReviewCount ?
      `${skippedOptionalReviewCount} additional SAMPLE REVIEW cases were not copied here. They remain in the full artifact archive.` :
      'No SAMPLE REVIEW cases were skipped.',
    '',
    'Look-first Markdown URLs:',
    '',
    ...(lookFirstMarkdownLinks(results).length ? lookFirstMarkdownLinks(results) : ['- n/a']),
    '',
    'Full artifacts stay in `Screenshots-for-Review/runs/latest/` inside the project.'
  ].join('\n'), 'utf8');
};

const runSite = async ({site, viewport}) => {
  const name = site.name || site.url;
  const caseDir = path.join(latestDir, slug(name));
  const downloadsDir = path.join(caseDir, 'downloads');
  const userDataDir = path.join(caseDir, 'profile');
  const result = {
    name,
    type: site.type,
    url: site.url,
    scenario: site.scenario,
    verify: site.verify,
    status: 'FAIL',
    reportPath: path.join(caseDir, 'report.md')
  };
  let context;
  let tempExtension;

  await ensureCleanDir(caseDir);
  await fs.mkdir(downloadsDir, {recursive: true});
  await prepareChromePrefs({userDataDir, downloadsDir});

  try {
    tempExtension = await copyExtensionToTempDir();
    context = await launchBrowser({
      extensionRoot: tempExtension.extensionRoot,
      userDataDir,
      downloadsDir,
      viewport
    });
    const extensionId = await readExtensionId({
      userDataDir,
      extensionRoot: tempExtension.extensionRoot,
      context
    });
    const page = await context.newPage();

    const navigation = await gotoWithRetry({page, site});
    result.navigationAttempts = navigation.attempts;
    await page.waitForTimeout(site.settleMs || 1200);
    if (preScrollY > 0) {
      await page.evaluate(y => window.scrollTo(0, y), preScrollY);
      await page.waitForTimeout(300);
      result.preScrollY = preScrollY;
    }
    const appShellReadiness = await waitForAppShellLoadedState({page, site});
    const actualViewport = await readActualViewport(page);
    const pageState = await inspectPreCapturePageState(page);

    const viewportPng = path.join(caseDir, 'viewport-before-capture.png');
    const preCaptureVisibleScreenshot = await page.screenshot({
      path: viewportPng,
      animations: 'disabled'
    }).catch(() => null);

    const extensionPage = await context.newPage();
    await extensionPage.goto(`chrome-extension://${extensionId}/data/options/index.html`);
    await page.bringToFront();

    await extensionPage.evaluate(mask => chrome.storage.local.set({
      saveAs: false,
      mask
    }), `real-site-${slug(name)}-${Date.now()}`);

    const response = await extensionPage.evaluate(async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true
      });

      return chrome.runtime.sendMessage({
        method: 'capture-active-tab',
        tabId: tab?.id
      });
    });

    if (!response?.ok) {
      throw new Error(response?.error || 'Capture flow trigger failed.');
    }

    const {lastCaptureDiagnostics: captureDiagnostics} = await extensionPage.evaluate(() => {
      return chrome.storage.local.get('lastCaptureDiagnostics');
    });
    const pngs = await waitForDownloadedPngs({downloadsDir});
    const extensionPngs = [];

    for (const [index, item] of pngs.entries()) {
      const extensionPng = path.join(caseDir, downloadedArtifactName({
        downloadedFile: item.file,
        captureDiagnostics,
        index
      }));
      await fs.copyFile(item.file, extensionPng);
      extensionPngs.push(extensionPng);
    }

    const primaryPng = pngs[0].png;
    const aggregatePng = pngs.length > 1 ? {
      width: Math.max(...pngs.map(item => item.png.width)),
      height: pngs.reduce((total, item) => total + item.png.height, 0)
    } : primaryPng;
    const evaluation = await evaluateResult({
      site,
      page,
      png: aggregatePng,
      pngs,
      viewport: actualViewport,
      captureDiagnostics,
      pageState,
      appShellReadiness,
      preCaptureVisibleScreenshot
    });
    Object.assign(result, evaluation, {
      png: {
        width: aggregatePng.width,
        height: aggregatePng.height
      },
      pngs: pngs.length > 1 ? pngs.map(item => ({
        width: item.png.width,
        height: item.png.height
      })) : undefined,
      extensionPng: extensionPngs[0],
      extensionPngs: pngs.length > 1 ? extensionPngs : undefined,
      viewportPng,
      viewport: actualViewport,
      pageState,
      appShellReadiness,
      captureDiagnostics
    });
  }
  catch (error) {
    result.error = error.stack || error.message;
    result.reason = error.message;
    result.status = result.reason && /login|sign in|войти/i.test(result.reason) ? 'BLOCKED LOGIN' : 'FAIL';
  }
  finally {
    if (context) {
      await context.close().catch(() => {});
    }
    if (tempExtension) {
      await fs.rm(tempExtension.tempRoot, {recursive: true, force: true}).catch(() => {});
    }
    await writeCaseReport({caseDir, result});
  }

  return result;
};

const main = async () => {
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  const viewport = config.viewport || {width: 1365, height: 900};
  const filters = (process.env.REAL_SITE_FILTER || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  const sites = filters.length ?
    (config.sites || []).filter(site => {
      const name = (site.name || site.url || '').toLowerCase();
      const siteSlug = slug(site.name || site.url);
      return filters.some(filter => name.includes(filter) || siteSlug.includes(filter));
    }) :
    (config.sites || []);

  await ensureCleanDir(latestDir);
  await ensureCleanReviewDir(reviewLatestDir);
  await fs.mkdir(reportsRoot, {recursive: true});

  if (!sites.length) {
    await writeSummaryReport([]);
    console.log(`No real sites configured. Edit ${configPath}`);
    console.log(`Artifacts: ${latestDir}`);
    return;
  }

  const results = [];

  for (const site of sites) {
    const result = await runSite({site, viewport});
    results.push(result);
    console.log(`${result.status} ${result.name}`);
    if (result.png) {
      console.log(`PNG ${result.png.width}x${result.png.height}`);
    }
    if (result.reason) {
      console.log(result.reason);
    }
  }

  await copyReviewArtifacts(results);
  await writeSummaryReport(results);
  console.log(`Report: ${qaReportPath}`);
  console.log(`Full artifacts: ${latestDir}`);
  console.log(`Review artifacts: ${reviewLatestDir}`);
  console.log('LOOK-FIRST Markdown URLs for thread:');
  const lookFirstLinks = lookFirstMarkdownLinks(results);
  if (lookFirstLinks.length) {
    for (const line of lookFirstLinks) {
      console.log(line);
    }
  }
  else {
    console.log('- n/a');
  }

  if (results.some(result => result.status === 'FAIL')) {
    process.exitCode = 1;
  }
};

main();
