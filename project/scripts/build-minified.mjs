import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(projectRoot, '..');
const sourceRoot = path.join(repoRoot, 'code');
const outputRoot = path.join(repoRoot, 'minified-code');
const cacheRoot = path.join(projectRoot, '.cache');
const terserPath = path.join(cacheRoot, 'terser.bundle.min.js');
const terserUrl = 'https://cdn.jsdelivr.net/npm/terser@5.31.6/dist/bundle.min.js';

const ensureTerser = async () => {
  await fs.mkdir(cacheRoot, {recursive: true});

  try {
    await fs.access(terserPath);
    return;
  }
  catch {}

  execFileSync('/usr/bin/curl', ['-fsSL', terserUrl, '-o', terserPath], {
    stdio: 'inherit'
  });
};

const loadTerser = async () => {
  await ensureTerser();

  const context = {};
  vm.createContext(context);
  vm.runInContext(await fs.readFile(terserPath, 'utf8'), context);

  if (!context.Terser?.minify) {
    throw new Error('Could not load Terser standalone bundle.');
  }

  return context.Terser;
};

const minifyCss = source => {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,>+~])\s*/g, '$1')
    .replace(/;}/g, '}')
    .trim();
};

const minifyJson = source => JSON.stringify(JSON.parse(source));

const minifyHtml = source => {
  return source
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const copyOrMinifyFile = async ({sourceFile, outputFile, terser}) => {
  await fs.mkdir(path.dirname(outputFile), {recursive: true});

  if (sourceFile.endsWith('.js')) {
    const result = await terser.minify(await fs.readFile(sourceFile, 'utf8'), {
      compress: {
        passes: 2
      },
      mangle: true,
      format: {
        comments: false
      }
    });

    if (result.error) {
      throw result.error;
    }

    await fs.writeFile(outputFile, `${result.code}\n`, 'utf8');
    return;
  }

  if (sourceFile.endsWith('.css')) {
    await fs.writeFile(outputFile, `${minifyCss(await fs.readFile(sourceFile, 'utf8'))}\n`, 'utf8');
    return;
  }

  if (sourceFile.endsWith('.json')) {
    await fs.writeFile(outputFile, `${minifyJson(await fs.readFile(sourceFile, 'utf8'))}\n`, 'utf8');
    return;
  }

  if (sourceFile.endsWith('.html')) {
    await fs.writeFile(outputFile, `${minifyHtml(await fs.readFile(sourceFile, 'utf8'))}\n`, 'utf8');
    return;
  }

  await fs.copyFile(sourceFile, outputFile);
};

const walk = async dir => {
  const entries = await fs.readdir(dir, {withFileTypes: true});
  const files = [];

  for (const entry of entries) {
    const file = path.join(dir, entry.name);

    if (entry.name === '.DS_Store') {
      continue;
    }

    if (entry.isDirectory()) {
      files.push(...await walk(file));
      continue;
    }

    if (entry.isFile()) {
      files.push(file);
    }
  }

  return files;
};

const validateOutput = async () => {
  JSON.parse(await fs.readFile(path.join(outputRoot, 'manifest.json'), 'utf8'));

  for (const file of await walk(outputRoot)) {
    if (file.endsWith('.json')) {
      JSON.parse(await fs.readFile(file, 'utf8'));
    }

    if (file.endsWith('.js')) {
      execFileSync(process.execPath, ['--check', file], {
        stdio: 'inherit'
      });
    }
  }
};

const build = async () => {
  const terser = await loadTerser();
  await fs.rm(outputRoot, {recursive: true, force: true});
  await fs.mkdir(outputRoot, {recursive: true});

  const files = await walk(sourceRoot);
  for (const sourceFile of files) {
    const relativePath = path.relative(sourceRoot, sourceFile);
    await copyOrMinifyFile({
      sourceFile,
      outputFile: path.join(outputRoot, relativePath),
      terser
    });
  }

  await validateOutput();

  console.log(`Minified extension written to ${outputRoot}`);
};

build().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
