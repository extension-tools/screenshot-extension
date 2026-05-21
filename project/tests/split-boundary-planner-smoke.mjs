import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const codeRoot = path.join(repoRoot, 'code');
const plainJson = value => JSON.parse(JSON.stringify(value));

const loadSelfClass = (sources, className) => {
  const context = {self: {}};
  vm.createContext(context);
  vm.runInContext(`${sources}\nthis.result = self.${className};`, context, {
    filename: `${className}.bundle.js`
  });
  return context.result;
};

const splitBoundaryPlannerSource = fs.readFileSync(
  path.join(codeRoot, 'capture/SplitBoundaryPlanner.js'),
  'utf8'
);
const positionPlannerSource = fs.readFileSync(
  path.join(codeRoot, 'capture/PositionPlanner.js'),
  'utf8'
);
const canvasStitcherSource = fs.readFileSync(
  path.join(codeRoot, 'capture/CanvasStitcher.js'),
  'utf8'
);
const canvasTilerSource = fs.readFileSync(
  path.join(codeRoot, 'capture/CanvasTiler.js'),
  'utf8'
);
const canvasSizeGuardSource = fs.readFileSync(
  path.join(codeRoot, 'capture/CanvasSizeGuard.js'),
  'utf8'
);

const SplitBoundaryPlanner = loadSelfClass(splitBoundaryPlannerSource, 'SplitBoundaryPlanner');
const PositionPlanner = loadSelfClass(
  `${splitBoundaryPlannerSource}\n${positionPlannerSource}`,
  'PositionPlanner'
);
const CanvasStitcher = loadSelfClass(
  `${splitBoundaryPlannerSource}\n${canvasStitcherSource}`,
  'CanvasStitcher'
);
const CanvasTiler = loadSelfClass(
  `${splitBoundaryPlannerSource}\n${canvasTilerSource}`,
  'CanvasTiler'
);
const CanvasSizeGuard = loadSelfClass(
  `${splitBoundaryPlannerSource}\n${canvasSizeGuardSource}`,
  'CanvasSizeGuard'
);

const createCanvasBoundaryHarness = Class => {
  const instance = Object.create(Class.prototype);
  instance.page = {
    splitCandidates: [],
    capturePlan: {
      avoidRanges: [{
        yStartCssPx: 460,
        yEndCssPx: 540,
        reason: 'grid-row'
      }]
    },
    splitExclusionRanges: [{
      top: 700,
      bottom: 820,
      reason: 'legacy'
    }]
  };
  return instance;
};

{
  const chosen = SplitBoundaryPlanner.chooseSafeSplitBoundary({
    targetY: 500,
    minY: 225,
    maxY: 500,
    ranges: [{
      top: 460,
      bottom: 540,
      reason: 'grid-row'
    }]
  });

  assert.equal(chosen.severity, 'safe');
  assert.ok(chosen.actualY < 460, 'boundary should move before the protected row');
  assert.ok(chosen.confidence >= 0.9, 'safe moved boundary should stay high confidence');
}

{
  const normalized = SplitBoundaryPlanner.normalizeCapturePlanRanges({
    capturePlan: {
      avoidRanges: [{
        yStartCssPx: 100,
        yEndCssPx: 220,
        reason: 'card'
      }]
    },
    splitExclusionRanges: [{
      top: 400,
      bottom: 520,
      reason: 'legacy'
    }]
  }, 1000);

  assert.deepEqual(plainJson(normalized), [{
    top: 100,
    bottom: 220,
    reason: 'card'
  }], 'capturePlan.avoidRanges should win over legacy splitExclusionRanges');
}

{
  const normalized = SplitBoundaryPlanner.normalizeCapturePlanRanges({
    capturePlan: {
      avoidRanges: []
    },
    splitExclusionRanges: [{
      top: 400,
      bottom: 520,
      reason: 'legacy'
    }]
  }, 1000);

  assert.deepEqual(plainJson(normalized), [{
    top: 400,
    bottom: 520,
    reason: 'legacy'
  }], 'legacy splitExclusionRanges should remain the fallback');
}

for (const Class of [CanvasStitcher, CanvasTiler]) {
  const harness = createCanvasBoundaryHarness(Class);
  const boundary = harness.chooseVerticalSeamBoundary({
    current: 300,
    defaultBoundary: 500
  });

  assert.ok(
    boundary < 460,
    `${Class.name} should shift the seam before a capturePlan avoid range`
  );
}

for (const Class of [CanvasStitcher, CanvasTiler]) {
  const harness = createCanvasBoundaryHarness(Class);
  harness.page.capturePlan.avoidRanges = [];
  harness.page.splitExclusionRanges = [{
    top: 460,
    bottom: 540,
    reason: 'legacy'
  }];

  const boundary = harness.chooseVerticalSeamBoundary({
    current: 300,
    defaultBoundary: 500
  });

  assert.ok(
    boundary < 460,
    `${Class.name} should keep legacy splitExclusionRanges as the fallback`
  );
}

{
  const guard = new CanvasSizeGuard({
    maxDimension: 2000,
    maxArea: 2000000
  });
  const strategy = guard.createStrategy({
    width: 1000,
    height: 4000,
    ratio: 1,
    splitCandidates: [],
    capturePlan: {
      avoidRanges: [{
        yStartCssPx: 1900,
        yEndCssPx: 2100,
        reason: 'grid-row'
      }]
    },
    splitExclusionRanges: [{
      top: 2500,
      bottom: 2700,
      reason: 'legacy'
    }]
  });

  assert.equal(strategy.mode, 'tiled-output');
  assert.ok(
    strategy.tiles[0].height < 1900,
    'CanvasSizeGuard should move a tile boundary before a capturePlan avoid range'
  );
}

{
  const planner = new PositionPlanner({offset: 50});
  const baseline = planner.createYAxisPositions(2000, 500, {});
  const protectedPlan = planner.createYAxisPlan(2000, 500, {
    capturePlan: {
      avoidRanges: [{
        yStartCssPx: 460,
        yEndCssPx: 540,
        reason: 'grid-row'
      }]
    }
  });

  assert.equal(baseline[1], 450, 'test setup should have a default first scroll step');
  assert.ok(
    protectedPlan.positions[1] < baseline[1],
    'PositionPlanner should shift the next frame when the viewport seam cuts an avoid range'
  );
  assert.equal(protectedPlan.splitBoundaryDiagnostics[0].severity, 'safe');
  assert.ok(
    protectedPlan.splitBoundaryDiagnostics[0].shiftPx < 0,
    'diagnostics should explain that the seam moved upward'
  );
}

console.log('split-boundary-planner-smoke: ok');
