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

const SplitBoundaryPlanner = loadSelfClass(splitBoundaryPlannerSource, 'SplitBoundaryPlanner');
const PositionPlanner = loadSelfClass(
  `${splitBoundaryPlannerSource}\n${positionPlannerSource}`,
  'PositionPlanner'
);

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
