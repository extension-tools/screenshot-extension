import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {PNG} from 'pngjs';
import pixelmatch from 'pixelmatch';
import {chromium} from 'playwright';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const updateBaseline = args.has('--update-baseline');
const configPath = path.join(projectRoot, 'tests', 'visual-sites.json');
const baselineDir = path.join(projectRoot, 'tests', 'visual-baseline');
const resultsDir = path.join(projectRoot, 'tests', 'visual-results');
const latestDir = path.join(resultsDir, 'latest');

const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const readPng = async file => PNG.sync.read(await fs.readFile(file));

const writeReport = async report => {
  const lines = [
    '# Visual Regression Report',
    '',
    `Mode: ${updateBaseline ? 'baseline update' : 'test'}`,
    `Generated: ${new Date().toISOString()}`,
    ''
  ];

  for (const item of report) {
    lines.push(`## ${item.name}`);
    lines.push('');
    lines.push(`- URL: ${item.url}`);
    lines.push(`- Status: ${item.status}`);
    if (item.diffPixels !== undefined) {
      lines.push(`- Diff pixels: ${item.diffPixels}`);
      lines.push(`- Diff ratio: ${(item.diffRatio * 100).toFixed(3)}%`);
    }
    if (item.reason) {
      lines.push(`- Reason: ${item.reason}`);
    }
    lines.push('');
  }

  await fs.writeFile(path.join(latestDir, 'report.md'), lines.join('\n'), 'utf8');
};

const ensureCleanResultsDir = async () => {
  await fs.rm(latestDir, {recursive: true, force: true});
  await fs.mkdir(latestDir, {recursive: true});
  await fs.mkdir(baselineDir, {recursive: true});
};

const screenshotSite = async (page, site, viewport) => {
  await page.setViewportSize({
    width: viewport.width,
    height: viewport.height
  });

  await page.goto(site.url, {
    waitUntil: site.waitUntil || 'load',
    timeout: site.timeoutMs || 45000
  });

  if (site.hideSelectors?.length) {
    await page.addStyleTag({
      content: site.hideSelectors.map(selector => `${selector}{visibility:hidden!important}`).join('\n')
    });
  }

  // Freeze common sources of visual noise before taking the snapshot.
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-duration: 0s !important;
        animation-delay: 0s !important;
        transition-duration: 0s !important;
        transition-delay: 0s !important;
        caret-color: transparent !important;
      }
    `
  });

  await page.waitForTimeout(site.settleMs || 500);

  return page.screenshot({
    fullPage: site.fullPage !== false,
    animations: 'disabled'
  });
};

const launchBrowser = async () => {
  const headless = process.env.VISUAL_HEADLESS !== '0';

  if (process.env.VISUAL_BROWSER_PATH) {
    return chromium.launch({
      headless,
      executablePath: process.env.VISUAL_BROWSER_PATH
    });
  }

  try {
    return await chromium.launch({
      headless,
      channel: process.env.VISUAL_BROWSER_CHANNEL || 'chrome'
    });
  }
  catch (error) {
    if (process.env.VISUAL_BROWSER_CHANNEL) {
      throw error;
    }
    return chromium.launch({headless});
  }
};

const compare = async (baselineFile, actualFile, diffFile) => {
  const baseline = await readPng(baselineFile);
  const actual = await readPng(actualFile);

  if (baseline.width !== actual.width || baseline.height !== actual.height) {
    return {
      diffPixels: Number.POSITIVE_INFINITY,
      diffRatio: 1,
      reason: `size changed from ${baseline.width}x${baseline.height} to ${actual.width}x${actual.height}`
    };
  }

  const diff = new PNG({width: baseline.width, height: baseline.height});
  const diffPixels = pixelmatch(
    baseline.data,
    actual.data,
    diff.data,
    baseline.width,
    baseline.height,
    {threshold: 0.1}
  );

  await fs.writeFile(diffFile, PNG.sync.write(diff));

  return {
    diffPixels,
    diffRatio: diffPixels / (baseline.width * baseline.height)
  };
};

const main = async () => {
  const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
  await ensureCleanResultsDir();

  const browser = await launchBrowser();
  const context = await browser.newContext({
    viewport: {
      width: config.viewport.width,
      height: config.viewport.height
    },
    deviceScaleFactor: config.viewport.deviceScaleFactor || 1,
    ignoreHTTPSErrors: true
  });

  const report = [];

  try {
    for (const site of config.sites) {
      const name = slug(site.name);
      const baselineFile = path.join(baselineDir, `${name}.png`);
      const actualFile = path.join(latestDir, `${name}.png`);
      const diffFile = path.join(latestDir, `${name}.diff.png`);
      const page = await context.newPage();

      try {
        const screenshot = await screenshotSite(page, site, config.viewport);

        if (updateBaseline) {
          await fs.writeFile(baselineFile, screenshot);
          await fs.writeFile(actualFile, screenshot);
          report.push({name: site.name, url: site.url, status: 'baseline updated'});
          continue;
        }

        await fs.writeFile(actualFile, screenshot);

        try {
          await fs.access(baselineFile);
        }
        catch {
          report.push({
            name: site.name,
            url: site.url,
            status: 'failed',
            reason: `missing baseline: run npm run visual:baseline`
          });
          continue;
        }

        const result = await compare(baselineFile, actualFile, diffFile);
        const maxDiffPixels = site.maxDiffPixels ?? config.threshold.maxDiffPixels;
        const maxDiffRatio = site.maxDiffRatio ?? config.threshold.maxDiffRatio;
        const passed = result.diffPixels <= maxDiffPixels && result.diffRatio <= maxDiffRatio;

        report.push({
          name: site.name,
          url: site.url,
          status: passed ? 'passed' : 'failed',
          diffPixels: result.diffPixels,
          diffRatio: result.diffRatio,
          reason: result.reason
        });
      }
      catch (error) {
        report.push({
          name: site.name,
          url: site.url,
          status: 'failed',
          reason: error.message
        });
      }
      finally {
        await page.close().catch(() => {});
      }
    }
  }
  finally {
    await browser.close();
  }

  await writeReport(report);

  const failed = report.filter(item => item.status === 'failed');
  for (const item of report) {
    const suffix = item.diffPixels === undefined ? '' : ` (${item.diffPixels} px, ${(item.diffRatio * 100).toFixed(3)}%)`;
    console.log(`${item.status.toUpperCase()} ${item.name}${suffix}`);
    if (item.reason) {
      console.log(`  ${item.reason}`);
    }
  }
  console.log(`Report: ${path.join(latestDir, 'report.md')}`);

  if (failed.length) {
    process.exitCode = 1;
  }
};

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
