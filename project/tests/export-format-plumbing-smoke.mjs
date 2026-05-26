import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRoot = path.resolve(projectRoot, '..');

const workerSource = fs.readFileSync(path.join(repoRoot, 'code/worker.js'), 'utf8');
const captureControllerSource = fs.readFileSync(path.join(repoRoot, 'code/capture/CaptureController.js'), 'utf8');
const pdfExporterSource = fs.readFileSync(path.join(repoRoot, 'code/capture/PdfExporter.js'), 'utf8');

const createChromeStub = () => ({
  runtime: {
    onConnect: {addListener() {}},
    onInstalled: {addListener() {}},
    onStartup: {addListener() {}},
    onMessage: {addListener(listener) { this.listener = listener; }},
    lastError: null
  },
  contextMenus: {
    create() {},
    onClicked: {addListener() {}}
  },
  commands: {onCommand: {addListener() {}}},
  tabs: {
    query(_query, callback) { callback([{id: 7, url: 'https://example.com/', title: 'Example'}]); },
    get(_tabId, callback) { callback({id: 7, url: 'https://example.com/', title: 'Example'}); },
    MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND: 2
  },
  action: {setBadgeText() {}},
  storage: {local: {get: async () => ({}), set: async () => {}}},
  downloads: {download() {}, onChanged: {addListener() {}, removeListener() {}}},
  scripting: {executeScript: async () => []}
});

const loadWorkerHarness = () => {
  const chrome = createChromeStub();
  const commandCalls = [];

  const context = vm.createContext({
    chrome,
    self: {
      NotificationService: class { constructor() {} error() {} },
      CaptureController: class {
        constructor() {}
        runCommand(cmd, tab, options) {
          commandCalls.push({cmd, tab, options});
          return Promise.resolve();
        }
      }
    },
    importScripts() {},
    console,
    setTimeout,
    clearTimeout
  });

  vm.runInContext(workerSource, context, {filename: 'worker.js'});

  return {chrome, commandCalls};
};

const sendWorkerMessage = async ({harness, request}) => new Promise(resolve => {
  const listener = harness.chrome.runtime.onMessage.listener;
  const returned = listener(request, {}, response => resolve({returned, response}));
  if (returned === false) {
    resolve({returned, response: undefined});
  }
});

const plainJson = value => JSON.parse(JSON.stringify(value));

const loadCaptureControllerClass = () => {
  const context = vm.createContext({self: {}, console, setTimeout, clearTimeout});
  vm.runInContext(`${captureControllerSource}\nthis.__CaptureController = self.CaptureController;`, context, {
    filename: 'CaptureController.js'
  });
  return context.__CaptureController;
};

const loadPdfExporterClass = () => {
  const context = vm.createContext({self: {}, Blob, TextEncoder, Uint8Array, console});
  vm.runInContext(`${pdfExporterSource}\nthis.__PdfExporter = self.PdfExporter;`, context, {
    filename: 'PdfExporter.js'
  });
  return context.__PdfExporter;
};

const createDiagnosticsStub = () => ({
  recordTiming() {},
  attachExportStatus() {},
  markFailure() {},
  markSuccess() {}
});

const createControllerHarness = result => {
  const CaptureController = loadCaptureControllerClass();
  const controller = Object.create(CaptureController.prototype);
  const saveCalls = [];
  const captureCalls = [];
  const pdfExportCalls = [];
  const pdfBlob = {type: 'application/pdf', id: 'pdf-blob'};

  controller.captureEntire = async () => {
    captureCalls.push({result});
    return result;
  };
  controller.store = {
    async save(blob, tab) {
      saveCalls.push({kind: 'save', blob, tab});
      return {status: 'saved', files: [], errors: []};
    },
    async saveMultiple(files, tab) {
      saveCalls.push({kind: 'saveMultiple', files, tab});
      return {status: 'saved', files: [{filename: 'part-1.png'}], errors: []};
    }
  };
  controller.captureDiagnostics = createDiagnosticsStub();
  controller.notifyImageReadinessRisk = async () => {};
  controller.storeCaptureDiagnostics = async () => {};
  controller.chrome = {action: {setBadgeText() {}}};
  controller.pdfExporter = {
    async export({result: exportResult}) {
      pdfExportCalls.push({result: exportResult});
      return {
        blob: pdfBlob,
        summary: {
          pageCount: exportResult.mode === 'tiled-output' ? exportResult.files.length : 1,
          source: exportResult.mode === 'tiled-output' ? 'tiles' : 'single-bitmap',
          pageMode: exportResult.mode === 'tiled-output' ? 'multi-page' : 'single-page'
        }
      };
    }
  };

  return {controller, saveCalls, captureCalls, pdfExportCalls, pdfBlob};
};

{
  const harness = loadWorkerHarness();
  const {response} = await sendWorkerMessage({
    harness,
    request: {method: 'capture-active-tab', tabId: 7, exportFormat: 'pdf'}
  });

  assert.deepEqual(plainJson(response), {ok: true});
  assert.equal(harness.commandCalls.length, 1);
  assert.equal(harness.commandCalls[0].options.exportFormat, 'pdf');
}

{
  const harness = loadWorkerHarness();
  const {response} = await sendWorkerMessage({
    harness,
    request: {method: 'capture-active-tab', tabId: 7, exportFormat: 'zip'}
  });

  assert.deepEqual(plainJson(response), {ok: true});
  assert.equal(harness.commandCalls.length, 1);
  assert.equal(harness.commandCalls[0].options.exportFormat, 'png');
}

{
  const result = {
    mode: 'single-canvas',
    blob: {id: 'blob'},
    strategy: {mode: 'single-canvas'},
    diagnostics: {},
    diagnosticsV2: {}
  };

  const pngHarness = createControllerHarness(result);
  assert.equal(typeof pngHarness.controller.saveCaptureResult, 'function');
  assert.equal(typeof pngHarness.controller.savePngResult, 'function');
  await pngHarness.controller.runCommand('capture-entire', {id: 7}, {exportFormat: 'png'});

  const pdfHarness = createControllerHarness(result);
  await pdfHarness.controller.runCommand('capture-entire', {id: 7}, {exportFormat: 'pdf'});

  assert.equal(pngHarness.captureCalls.length, 1);
  assert.equal(pdfHarness.captureCalls.length, 1);
  assert.equal(pdfHarness.pdfExportCalls.length, 1);
  assert.equal(pdfHarness.pdfExportCalls[0].result, result);
  assert.equal(pdfHarness.saveCalls.length, 1);
  assert.equal(pdfHarness.saveCalls[0].kind, 'save');
  assert.equal(pdfHarness.saveCalls[0].blob, pdfHarness.pdfBlob);
  assert.equal(pngHarness.saveCalls[0].kind, 'save');
}

{
  const result = {
    mode: 'tiled-output',
    files: [{blob: {id: 'part-1'}, index: 0}, {blob: {id: 'part-2'}, index: 1}],
    strategy: {mode: 'tiled-output'},
    diagnostics: {},
    diagnosticsV2: {}
  };

  const pngHarness = createControllerHarness(result);
  await pngHarness.controller.runCommand('capture-entire', {id: 7}, {exportFormat: 'png'});

  const pdfHarness = createControllerHarness(result);
  await pdfHarness.controller.runCommand('capture-entire', {id: 7}, {exportFormat: 'pdf'});

  assert.equal(pngHarness.captureCalls.length, 1);
  assert.equal(pdfHarness.captureCalls.length, 1);
  assert.equal(pngHarness.saveCalls[0].kind, 'saveMultiple');
  assert.equal(pdfHarness.pdfExportCalls.length, 1);
  assert.equal(pdfHarness.pdfExportCalls[0].result, result);
  assert.equal(pdfHarness.saveCalls.length, 1);
  assert.equal(pdfHarness.saveCalls[0].kind, 'save');
  assert.equal(pdfHarness.saveCalls[0].blob, pdfHarness.pdfBlob);
}

{
  const PdfExporter = loadPdfExporterClass();

  class FakePdfExporter extends PdfExporter {
    async toPdfPageImage(source) {
      return {width: source.width, height: source.height, bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9])};
    }
  }

  const exporter = new FakePdfExporter();
  const singleResult = await exporter.export({result: {mode: 'single-canvas', blob: {width: 120, height: 240}}});
  const tiledResult = await exporter.export({
    result: {
      mode: 'tiled-output',
      files: [{blob: {width: 100, height: 150}, index: 1}, {blob: {width: 90, height: 110}, index: 0}]
    }
  });
  const singlePdfText = Buffer.from(await singleResult.blob.arrayBuffer()).toString('latin1');
  const tiledPdfText = Buffer.from(await tiledResult.blob.arrayBuffer()).toString('latin1');

  assert.equal(singleResult.blob.type, 'application/pdf');
  assert.equal(singleResult.summary.pageCount, 1);
  assert.equal(singleResult.summary.source, 'single-bitmap');
  assert.equal(singleResult.summary.pageMode, 'single-page');
  assert.ok(singlePdfText.startsWith('%PDF-1.4'));
  assert.match(singlePdfText, /\/Count 1\b/);

  assert.equal(tiledResult.blob.type, 'application/pdf');
  assert.equal(tiledResult.summary.pageCount, 2);
  assert.equal(tiledResult.summary.source, 'tiles');
  assert.equal(tiledResult.summary.pageMode, 'multi-page');
  assert.ok(tiledPdfText.startsWith('%PDF-1.4'));
  assert.match(tiledPdfText, /\/Count 2\b/);
}

{
  const PdfExporter = loadPdfExporterClass();

  class FakePdfExporter extends PdfExporter {
    async toPdfPageImage(source) {
      return {width: source.width, height: source.height, bytes: new Uint8Array([0xff, 0xd8, 0xff, 0xd9])};
    }
  }

  const exporter = new FakePdfExporter();

  await assert.rejects(
    exporter.export({result: {mode: 'vector-preview'}}),
    /Unsupported capture result mode for PDF export/
  );

  await assert.rejects(
    exporter.export({result: {mode: 'single-canvas'}}),
    /Single-canvas capture result is missing blob/
  );

  await assert.rejects(
    exporter.export({result: {mode: 'tiled-output'}}),
    /Tiled capture result is missing files/
  );
}

console.log('PASS export-format-plumbing-smoke');
