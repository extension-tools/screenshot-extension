import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PNG} from 'pngjs';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(projectRoot, '..');
const defaultArtifactRoot = path.join(repoRoot, 'Screenshots-for-Review', 'runs', 'latest');
const realSitesPath = path.join(projectRoot, 'tests', 'real-sites.json');
const artifactRoot = process.env.PNG_QA_ARTIFACT_ROOT ?
  path.resolve(process.env.PNG_QA_ARTIFACT_ROOT) :
  defaultArtifactRoot;
const reportPath = process.env.PNG_QA_REPORT_PATH ?
  path.resolve(process.env.PNG_QA_REPORT_PATH) :
  path.join(projectRoot, 'tests', 'offline-png-qa.md');
const maxDecodedPixels = Number.parseInt(process.env.PNG_QA_MAX_DECODED_PIXELS || '60000000', 10);
const discoveryMode = process.env.PNG_QA_DISCOVERY === '1';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const slug = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site';

const readPngHeader = async file => {
  const handle = await fs.open(file, 'r');
  try {
    const buffer = Buffer.alloc(24);
    await handle.read(buffer, 0, buffer.length, 0);
    const signature = buffer.subarray(0, 8).toString('hex');
    if (signature !== '89504e470d0a1a0a') {
      return null;
    }

    return {
      width: buffer.readUInt32BE(16),
      height: buffer.readUInt32BE(20)
    };
  }
  finally {
    await handle.close();
  }
};

const safeReadPng = async file => {
  const dimensions = await readPngHeader(file);
  if (!dimensions) {
    return {
      dimensions: null,
      png: null,
      skipped: 'not a PNG'
    };
  }

  const pixels = dimensions.width * dimensions.height;
  if (pixels > maxDecodedPixels) {
    return {
      dimensions,
      png: null,
      skipped: `too large to decode safely: ${dimensions.width}x${dimensions.height}`
    };
  }

  return {
    dimensions,
    png: PNG.sync.read(await fs.readFile(file)),
    skipped: null
  };
};

const sampleRegion = (png, region = {}, samplesX = 32, samplesY = 32) => {
  const left = clamp(Math.floor((region.leftRatio ?? 0) * png.width), 0, png.width - 1);
  const right = clamp(Math.ceil((region.rightRatio ?? 1) * png.width), left + 1, png.width);
  const top = clamp(Math.floor((region.topRatio ?? 0) * png.height), 0, png.height - 1);
  const bottom = clamp(Math.ceil((region.bottomRatio ?? 1) * png.height), top + 1, png.height);
  const buckets = new Set();
  let count = 0;
  let sum = 0;
  let sumSq = 0;
  let chroma = 0;
  let dark = 0;
  let white = 0;
  let gray = 0;

  for (let yi = 0; yi < samplesY; yi += 1) {
    const y = clamp(Math.round(top + ((bottom - top - 1) * yi) / Math.max(1, samplesY - 1)), top, bottom - 1);
    for (let xi = 0; xi < samplesX; xi += 1) {
      const x = clamp(Math.round(left + ((right - left - 1) * xi) / Math.max(1, samplesX - 1)), left, right - 1);
      const index = (y * png.width + x) * 4;
      const r = png.data[index];
      const g = png.data[index + 1];
      const b = png.data[index + 2];
      const brightness = (r + g + b) / 3;
      const localChroma = Math.max(r, g, b) - Math.min(r, g, b);

      count += 1;
      sum += brightness;
      sumSq += brightness * brightness;
      chroma += localChroma;
      if (brightness < 24) {
        dark += 1;
      }
      if (brightness > 245) {
        white += 1;
      }
      if (localChroma < 8 && brightness >= 80 && brightness <= 235) {
        gray += 1;
      }
      buckets.add(`${Math.round(r / 24)}:${Math.round(g / 24)}:${Math.round(b / 24)}`);
    }
  }

  const mean = sum / Math.max(1, count);
  const variance = Math.max(0, (sumSq / Math.max(1, count)) - mean * mean);
  const stddev = Math.sqrt(variance);

  return {
    mean,
    stddev,
    chroma: chroma / Math.max(1, count),
    buckets: buckets.size,
    darkRatio: dark / Math.max(1, count),
    whiteRatio: white / Math.max(1, count),
    grayRatio: gray / Math.max(1, count),
    blankLike: buckets.size <= 4 && (stddev < 9 || white / Math.max(1, count) > 0.85 || dark / Math.max(1, count) > 0.85)
  };
};

const regionSignature = (png, region = {}, samplesX = 8, samplesY = 8) => {
  const left = clamp(Math.floor((region.leftRatio ?? 0) * png.width), 0, png.width - 1);
  const right = clamp(Math.ceil((region.rightRatio ?? 1) * png.width), left + 1, png.width);
  const top = clamp(Math.floor((region.topRatio ?? 0) * png.height), 0, png.height - 1);
  const bottom = clamp(Math.ceil((region.bottomRatio ?? 1) * png.height), top + 1, png.height);
  const values = [];

  for (let yi = 0; yi < samplesY; yi += 1) {
    const y = clamp(Math.round(top + ((bottom - top - 1) * yi) / Math.max(1, samplesY - 1)), top, bottom - 1);
    for (let xi = 0; xi < samplesX; xi += 1) {
      const x = clamp(Math.round(left + ((right - left - 1) * xi) / Math.max(1, samplesX - 1)), left, right - 1);
      const index = (y * png.width + x) * 4;
      values.push(
        Math.round((png.data[index] + png.data[index + 1] + png.data[index + 2]) / 3),
        Math.round((Math.max(png.data[index], png.data[index + 1], png.data[index + 2]) -
          Math.min(png.data[index], png.data[index + 1], png.data[index + 2])) / 2)
      );
    }
  }

  return values;
};

const signatureDistance = (a, b) => {
  const length = Math.min(a.length, b.length);
  if (!length) {
    return Number.POSITIVE_INFINITY;
  }

  let total = 0;
  for (let index = 0; index < length; index += 1) {
    total += Math.abs(a[index] - b[index]);
  }

  return total / length;
};

const formatPercent = value => `${Math.round(value * 100)}%`;
const formatStats = stats => `mean=${Math.round(stats.mean)}, std=${Math.round(stats.stddev)}, buckets=${stats.buckets}, white=${formatPercent(stats.whiteRatio)}, gray=${formatPercent(stats.grayRatio)}, dark=${formatPercent(stats.darkRatio)}`;

const detectHorizontalBand = png => {
  const rowStep = Math.max(3, Math.floor(png.height / 900));
  const sampleStep = Math.max(8, Math.floor(png.width / 120));
  let current = null;
  const bands = [];

  for (let y = 0; y < png.height; y += rowStep) {
    const values = [];
    for (let x = 0; x < png.width; x += sampleStep) {
      const index = (y * png.width + x) * 4;
      const r = png.data[index];
      const g = png.data[index + 1];
      const b = png.data[index + 2];
      values.push((r + g + b) / 3);
    }

    const mean = values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
    const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / Math.max(1, values.length);
    const stddev = Math.sqrt(variance);
    const likelyBand = stddev < 7 && mean > 35 && mean < 238;

    if (likelyBand) {
      if (!current) {
        current = {
          start: y,
          end: y,
          mean
        };
      }
      current.end = y;
      current.mean = (current.mean + mean) / 2;
    }
    else if (current) {
      bands.push(current);
      current = null;
    }
  }

  if (current) {
    bands.push(current);
  }

  return bands
    .map(band => ({
      ...band,
      height: band.end - band.start + rowStep
    }))
    .filter(band => band.height >= 18 && band.height <= 140);
};

const hasAnyTag = (tags, values) => values.some(value => tags.has(value));

const regionFromPixels = (png, {left = 0, right = png.width, top = 0, bottom = png.height}) => ({
  leftRatio: clamp(left / Math.max(1, png.width), 0, 1),
  rightRatio: clamp(right / Math.max(1, png.width), 0, 1),
  topRatio: clamp(top / Math.max(1, png.height), 0, 1),
  bottomRatio: clamp(bottom / Math.max(1, png.height), 0, 1)
});

const detectRepeatedHorizontalChromeInImage = png => {
  if (png.height < 1400 || png.width < 500) {
    return [];
  }

  const stripHeight = clamp(Math.round(png.width * 0.05), 42, 96);
  const sourceLimit = Math.min(Math.round(png.height * 0.28), 900);
  const sourceStep = Math.max(24, Math.round(stripHeight / 2));
  const targetStep = Math.max(64, Math.round(stripHeight * 0.9));
  const repeated = [];

  for (let sourceY = 0; sourceY < sourceLimit - stripHeight; sourceY += sourceStep) {
    const sourceRegion = regionFromPixels(png, {
      left: png.width * 0.03,
      right: png.width * 0.97,
      top: sourceY,
      bottom: sourceY + stripHeight
    });
    const sourceStats = sampleRegion(png, sourceRegion, 40, 6);
    const chromeLikeSource = sourceStats.darkRatio > 0.48 ||
      (sourceStats.mean < 95 && sourceStats.stddev < 42 && sourceStats.buckets <= 22);
    if (!chromeLikeSource) {
      continue;
    }

    const sourceSignature = regionSignature(png, sourceRegion, 16, 4);
    const matches = [];
    const firstTargetY = sourceY + Math.max(420, stripHeight * 5);
    for (let targetY = firstTargetY; targetY < png.height - stripHeight; targetY += targetStep) {
      const targetRegion = regionFromPixels(png, {
        left: png.width * 0.03,
        right: png.width * 0.97,
        top: targetY,
        bottom: targetY + stripHeight
      });
      const targetStats = sampleRegion(png, targetRegion, 40, 6);
      const chromeLikeTarget = targetStats.darkRatio > 0.48 ||
        (targetStats.mean < 95 && targetStats.stddev < 42 && targetStats.buckets <= 22);
      if (!chromeLikeTarget) {
        continue;
      }

      const distance = signatureDistance(sourceSignature, regionSignature(png, targetRegion, 16, 4));
      if (distance < 9) {
        matches.push({
          y: targetY,
          distance: Math.round(distance * 10) / 10
        });
      }
    }

    if (matches.length) {
      repeated.push({
        sourceY,
        stripHeight,
        matches: matches.slice(0, 6),
        stats: sourceStats
      });
    }
  }

  return repeated.slice(0, 4);
};

const detectRepeatedSideChromeInImage = png => {
  if (png.height < 1600 || png.width < 700) {
    return [];
  }

  const chunkHeight = clamp(Math.round(png.width * 0.7), 520, 980);
  const sourceTop = Math.min(Math.round(png.height * 0.08), 180);
  const sides = [
    {
      side: 'left',
      left: 0,
      right: Math.round(png.width * 0.26)
    },
    {
      side: 'right',
      left: Math.round(png.width * 0.74),
      right: png.width
    }
  ];
  const repeated = [];

  for (const side of sides) {
    const sourceRegion = regionFromPixels(png, {
      left: side.left,
      right: side.right,
      top: sourceTop,
      bottom: Math.min(png.height, sourceTop + chunkHeight)
    });
    const sourceStats = sampleRegion(png, sourceRegion, 16, 32);
    if (sourceStats.blankLike || sourceStats.buckets < 7) {
      continue;
    }

    const sourceSignature = regionSignature(png, sourceRegion, 8, 18);
    const matches = [];
    for (
      let targetTop = sourceTop + Math.max(chunkHeight, 700);
      targetTop < png.height - Math.min(320, chunkHeight * 0.5);
      targetTop += Math.max(300, Math.round(chunkHeight * 0.55))
    ) {
      const targetRegion = regionFromPixels(png, {
        left: side.left,
        right: side.right,
        top: targetTop,
        bottom: Math.min(png.height, targetTop + chunkHeight)
      });
      const targetStats = sampleRegion(png, targetRegion, 16, 32);
      if (targetStats.blankLike || targetStats.buckets < 7) {
        continue;
      }

      const distance = signatureDistance(sourceSignature, regionSignature(png, targetRegion, 8, 18));
      if (distance < 11) {
        matches.push({
          y: targetTop,
          distance: Math.round(distance * 10) / 10
        });
      }
    }

    if (matches.length) {
      repeated.push({
        side: side.side,
        sourceY: sourceTop,
        chunkHeight,
        matches: matches.slice(0, 6),
        stats: sourceStats
      });
    }
  }

  return repeated;
};

const analyzeDecodedPng = ({png, filename, riskTags}) => {
  const issues = [];
  const tags = new Set(riskTags || []);
  const full = sampleRegion(png);
  const center = sampleRegion(png, {
    leftRatio: 0.24,
    rightRatio: 0.76,
    topRatio: 0.08,
    bottomRatio: 0.92
  });
  const right = sampleRegion(png, {
    leftRatio: 0.91,
    rightRatio: 1,
    topRatio: 0.08,
    bottomRatio: 0.92
  });
  const left = sampleRegion(png, {
    leftRatio: 0,
    rightRatio: 0.06,
    topRatio: 0.08,
    bottomRatio: 0.92
  });

  if (full.blankLike && png.height > 900) {
    issues.push({
      type: 'blank-or-low-entropy',
      detail: `full image looks blank-like (${formatStats(full)})`
    });
  }

  if (
    (discoveryMode || tags.has('right-blank-strip') || tags.has('wide-output')) &&
    right.blankLike &&
    !center.blankLike &&
    Math.abs(right.mean - center.mean) > 25
  ) {
    issues.push({
      type: 'right-side-blank-strip',
      detail: `right strip differs from center (${formatStats(right)} vs center ${formatStats(center)})`
    });
  }

  if (
    (discoveryMode || tags.has('right-blank-strip') || tags.has('wide-output') || tags.has('black-strip')) &&
    right.grayRatio > 0.88 &&
    right.stddev < 12 &&
    !center.blankLike
  ) {
    issues.push({
      type: 'right-side-gray-strip',
      detail: `right strip is gray and low-detail (${formatStats(right)})`
    });
  }

  if ((left.darkRatio > 0.85 && left.stddev < 12) || (right.darkRatio > 0.85 && right.stddev < 12)) {
    issues.push({
      type: 'vertical-black-strip',
      detail: `edge strip is mostly black (left ${formatStats(left)}, right ${formatStats(right)})`
    });
  }

  const repeatedHorizontalChrome = (
    discoveryMode ||
    hasAnyTag(tags, ['repeated-overlay', 'product-sticky', 'product-sticky-anti-regression', 'black-strip'])
  ) ? detectRepeatedHorizontalChromeInImage(png) : [];
  if (repeatedHorizontalChrome.length) {
    issues.push({
      type: 'repeated-horizontal-chrome-in-image',
      detail: `${repeatedHorizontalChrome.length} repeated horizontal chrome candidate(s); first source y=${repeatedHorizontalChrome[0].sourceY}, matches=${repeatedHorizontalChrome[0].matches.map(match => match.y).join(', ')}`
    });
  }

  const repeatedSideChrome = (
    discoveryMode ||
    hasAnyTag(tags, ['repeated-sidebar', 'docs-sidebar-main-scroll', 'product-filter-panel'])
  ) ? detectRepeatedSideChromeInImage(png) : [];
  for (const candidate of repeatedSideChrome) {
    issues.push({
      type: `repeated-${candidate.side}-chrome-in-image`,
      detail: `${candidate.side} chrome region repeats from y=${candidate.sourceY}; matches=${candidate.matches.map(match => `${match.y} (d=${match.distance})`).join(', ')}`
    });
  }

  const bands = (discoveryMode || tags.has('seam-band')) ? detectHorizontalBand(png) : [];
  if (bands.length >= 2) {
    issues.push({
      type: 'horizontal-seam-band',
      detail: `${bands.length} narrow low-detail horizontal bands detected; first at y=${bands[0].start}, height=${bands[0].height}`
    });
  }

  return {
    filename,
    width: png.width,
    height: png.height,
    full,
    issues
  };
};

const analyzePartSequence = (decodedItems, riskTags = []) => {
  const issues = [];
  const tags = new Set(riskTags);
  const decoded = decodedItems.filter(item => item.png);

  if (decoded.length < 2) {
    return issues;
  }

  const leftSignatures = decoded.map(item => ({
    filename: item.filename,
    stats: sampleRegion(item.png, {
      leftRatio: 0,
      rightRatio: 0.24,
      topRatio: 0.14,
      bottomRatio: 0.86
    }),
    signature: regionSignature(item.png, {
      leftRatio: 0,
      rightRatio: 0.24,
      topRatio: 0.14,
      bottomRatio: 0.86
    })
  }));
  let repeatedLeft = 0;
  for (let index = 1; index < leftSignatures.length; index += 1) {
    const distance = signatureDistance(leftSignatures[0].signature, leftSignatures[index].signature);
    if (distance < 13 && leftSignatures[index].stats.buckets < 18) {
      repeatedLeft += 1;
    }
  }
  if (
    repeatedLeft >= 1 &&
    (
      discoveryMode ||
      tags.has('repeated-sidebar') ||
      tags.has('docs-sidebar-main-scroll') ||
      tags.has('repeated-overlay') ||
      tags.has('product-filter-panel')
    )
  ) {
    issues.push({
      type: 'repeated-left-sidebar-or-panel',
      detail: `${repeatedLeft} later part(s) have a left-region signature close to part 1`
    });
  }

  const sourceBottom = regionSignature(decoded[0].png, {
    leftRatio: 0,
    rightRatio: 1,
    topRatio: 0.88,
    bottomRatio: 1
  }, 10, 4);
  let repeatedHorizontal = 0;
  for (let index = 1; index < decoded.length; index += 1) {
    const topDistance = signatureDistance(sourceBottom, regionSignature(decoded[index].png, {
      leftRatio: 0,
      rightRatio: 1,
      topRatio: 0,
      bottomRatio: 0.12
    }, 10, 4));
    const bottomDistance = signatureDistance(sourceBottom, regionSignature(decoded[index].png, {
      leftRatio: 0,
      rightRatio: 1,
      topRatio: 0.88,
      bottomRatio: 1
    }, 10, 4));
    if (Math.min(topDistance, bottomDistance) < 10) {
      repeatedHorizontal += 1;
    }
  }
  if (
    repeatedHorizontal >= 1 &&
    (
      discoveryMode ||
      tags.has('repeated-overlay') ||
      tags.has('blocking-popup') ||
      tags.has('split-boundary-text')
    )
  ) {
    issues.push({
      type: 'repeated-horizontal-overlay-or-strip',
      detail: `${repeatedHorizontal} later part(s) resemble the first part bottom strip`
    });
  }

  return issues;
};

const parseReport = async caseDir => {
  const report = await fs.readFile(path.join(caseDir, 'report.md'), 'utf8').catch(() => '');
  const status = report.match(/^Status:\s*(.+)$/m)?.[1]?.trim() || 'n/a';
  const url = report.match(/^- URL:\s*(.+)$/m)?.[1]?.trim() || 'n/a';
  const reason = report.match(/^- Reason:\s*(.+)$/m)?.[1]?.trim() || 'n/a';

  return {
    status,
    url,
    reason
  };
};

const loadRiskTags = async () => {
  const config = JSON.parse(await fs.readFile(realSitesPath, 'utf8'));
  const byUrl = new Map();
  const bySlug = new Map();

  for (const site of config.sites || []) {
    const tags = site.deepQa?.riskTags || [];
    if (!tags.length) {
      continue;
    }

    if (site.url) {
      byUrl.set(site.url, tags);
    }
    bySlug.set(slug(site.name || site.url), tags);
  }

  return {
    byUrl,
    bySlug
  };
};

const findCaseDirs = async root => {
  const entries = await fs.readdir(root, {withFileTypes: true});
  return entries
    .filter(entry => entry.isDirectory())
    .map(entry => path.join(root, entry.name))
    .sort();
};

const findPngs = async dir => {
  const entries = await fs.readdir(dir, {withFileTypes: true}).catch(() => []);
  return entries
    .filter(entry => entry.isFile() && entry.name.endsWith('.png') && entry.name !== 'viewport-before-capture.png')
    .map(entry => path.join(dir, entry.name))
    .sort();
};

const analyzeCase = async (caseDir, riskLookup) => {
  const name = path.basename(caseDir);
  const report = await parseReport(caseDir);
  const riskTags = riskLookup.byUrl.get(report.url) || riskLookup.bySlug.get(name) || [];
  const files = await findPngs(caseDir);
  const decodedItems = [];
  const issues = [];
  const pngSummaries = [];

  for (const file of files) {
    const filename = path.basename(file);
    const decoded = await safeReadPng(file);
    if (decoded.skipped) {
      pngSummaries.push(`${filename}: ${decoded.dimensions ? `${decoded.dimensions.width}x${decoded.dimensions.height}` : 'n/a'} (${decoded.skipped})`);
      if (decoded.dimensions && decoded.dimensions.width > 0 && decoded.dimensions.height > 0) {
        const aspectHeight = decoded.dimensions.height / Math.max(1, decoded.dimensions.width);
        if (aspectHeight > 26) {
          issues.push({
            type: 'very-tall-output-not-decoded',
            detail: `${filename} is ${decoded.dimensions.width}x${decoded.dimensions.height}; skipped heavy decode`
          });
        }
      }
      continue;
    }

    const item = {
      filename,
      png: decoded.png
    };
    decodedItems.push(item);
    pngSummaries.push(`${filename}: ${decoded.png.width}x${decoded.png.height}`);
    issues.push(...analyzeDecodedPng({
      ...item,
      riskTags
    }).issues);
  }

  issues.push(...analyzePartSequence(decodedItems, riskTags));

  return {
    name,
    ...report,
    riskTags,
    files: pngSummaries,
    issues
  };
};

const writeReport = async results => {
  const issueResults = results.filter(result => result.issues.length);
  const issueCounts = new Map();
  for (const result of issueResults) {
    for (const issue of result.issues) {
      issueCounts.set(issue.type, (issueCounts.get(issue.type) || 0) + 1);
    }
  }

  const lines = [
    '# Offline PNG QA',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Artifacts: ${artifactRoot}`,
    '',
    'This report analyzes existing PNG artifacts only. It does not open Chrome and does not recapture pages.',
    '',
    '## Summary',
    '',
    `- Cases scanned: ${results.length}`,
    `- Cases with offline visual signals: ${issueResults.length}`,
    `- Mode: ${discoveryMode ? 'discovery' : 'risk-aware'}`,
    `- Max decoded pixels per PNG: ${maxDecodedPixels}`,
    ''
  ];

  if (issueCounts.size) {
    lines.push('## Issue Counts', '');
    for (const [type, count] of [...issueCounts.entries()].sort((a, b) => b[1] - a[1])) {
      lines.push(`- ${type}: ${count}`);
    }
    lines.push('');
  }

  lines.push('## Cases With Signals', '');
  if (!issueResults.length) {
    lines.push('No offline visual signals detected.', '');
  }
  else {
    for (const result of issueResults) {
      lines.push(`### ${result.name}`, '');
      lines.push(`- Status: ${result.status}`);
      lines.push(`- URL: ${result.url}`);
      lines.push(`- Risk tags: ${result.riskTags.length ? result.riskTags.join(', ') : 'none'}`);
      lines.push(`- Runner reason: ${result.reason}`);
      lines.push(`- PNGs: ${result.files.join('; ') || 'none'}`);
      for (const issue of result.issues) {
        lines.push(`- ${issue.type}: ${issue.detail}`);
      }
      lines.push('');
    }
  }

  await fs.writeFile(reportPath, lines.join('\n'), 'utf8');
};

const run = async () => {
  const caseDirs = await findCaseDirs(artifactRoot);
  const riskLookup = await loadRiskTags();
  const results = [];

  for (const caseDir of caseDirs) {
    results.push(await analyzeCase(caseDir, riskLookup));
  }

  await writeReport(results);
  console.log(`Offline PNG QA report: ${reportPath}`);

  if (process.env.PNG_QA_FAIL_ON_ISSUES === '1' && results.some(result => result.issues.length)) {
    process.exitCode = 1;
  }
};

run().catch(error => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
