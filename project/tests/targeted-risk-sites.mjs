import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const configPath = path.join(repoRoot, 'project/tests/real-sites.json');
const minRiskSites = Number(process.env.TARGETED_RISK_MIN || 15);

const slug = value =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'site';

const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
const riskSites = (config.sites || []).filter(site => site.deepQa?.riskTags?.length);

if (riskSites.length < minRiskSites) {
  console.error(
    `Targeted risk set has ${riskSites.length} sites, but the beta gate requires at least ${minRiskSites}.`
  );
  process.exitCode = 1;
}

const filter = riskSites.map(site => slug(site.name || site.url)).join(',');

console.log(`Targeted risk sites: ${riskSites.length}`);
console.log(`Minimum required for beta gate: ${minRiskSites}`);
console.log('');
console.log('Run command:');
console.log(`REAL_SITE_FILTER="${filter}" npm run real:qa`);
console.log('');
console.log('Markdown URLs:');
for (const site of riskSites) {
  console.log(`- [${site.name}](${site.url}) — ${site.deepQa.riskTags.join(', ')}`);
}
