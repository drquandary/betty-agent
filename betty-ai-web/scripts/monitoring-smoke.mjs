#!/usr/bin/env node
// Wave 3F final smoke harness for the Datadog-style Monitoring tab.
//
// What this does
// --------------
// We DO NOT spin up a Next.js server or re-implement the cards' rendering
// logic. Instead, we reuse the already-green vitest suites as the source of
// truth for "the monitoring tab is wired correctly":
//
//   * 6 card tests in src/components/monitoring/*.test.tsx
//   * 4 chart-primitive tests in src/components/charts/*.test.tsx
//   * 5 route tests in src/app/api/cluster/{sdiag,sprio,sacct-summary,
//     pending-reasons,nodes}/route.test.ts (plus their parse.test.ts twins)
//
// The harness shells out to the local vitest binary, scoped to those three
// directories, captures the exit code, and pretty-prints a single summary
// line plus the bullet-by-bullet count of which files passed.
//
// Why this is the right call
// --------------------------
// Re-implementing renderToString + a fake fetcher + an act loop would
// duplicate logic that the existing test files already exercise far more
// thoroughly. Anchoring on vitest means the smoke check keeps working as
// individual cards evolve.
//
// Exit codes
// ----------
//   0  every targeted vitest suite green
//   1  any failure (failing files listed in stderr)
//   2  vitest binary not found / scripting error
//
// Usage: npm run monitoring:smoke (from betty-ai-web/)

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(here, '..');

const VITEST_BIN = resolve(webRoot, 'node_modules/.bin/vitest');

if (!existsSync(VITEST_BIN)) {
  console.error(
    `monitoring-smoke: ERROR vitest binary not found at ${VITEST_BIN}.\n` +
      `Run npm install first; this script will not install anything.`,
  );
  process.exit(2);
}

// The three buckets we treat as the monitoring tab's contract surface.
const BUCKETS = [
  {
    label: 'cards',
    dir: 'src/components/monitoring',
    // Cards each ship one .test.tsx peer; MonitoringView.tsx itself has no
    // test file but is exercised through AppShell.test.tsx.
    expected: 6,
  },
  {
    label: 'chart primitives',
    dir: 'src/components/charts',
    expected: 4,
  },
  {
    label: 'cluster API routes',
    // We want the five Wave 2D endpoints. Pass each explicitly so the new
    // endpoints (cost, jobs, overview, quota) are not dragged in.
    files: [
      'src/app/api/cluster/sdiag',
      'src/app/api/cluster/sprio',
      'src/app/api/cluster/sacct-summary',
      'src/app/api/cluster/pending-reasons',
      'src/app/api/cluster/nodes',
    ],
    expected: 5,
    // The summary line is endpoint-oriented (5 routes), not file-oriented
    // (10 test files). countBy='endpoint' groups by parent directory.
    countBy: 'endpoint',
  },
];

function runVitestOnce(args) {
  // vitest run with --reporter=json so we can count files programmatically.
  const fullArgs = ['run', '--reporter=json', ...args];
  const result = spawnSync(VITEST_BIN, fullArgs, {
    cwd: webRoot,
    encoding: 'utf8',
    env: { ...process.env, CI: '1' },
    // Some test files emit large stdouts; bump the buffer.
    maxBuffer: 64 * 1024 * 1024,
  });
  return result;
}

function parseVitestJson(stdout) {
  // Vitest's JSON reporter writes a single JSON object to stdout. Strip any
  // leading non-JSON lines (some setup files log) just in case.
  const trimmed = stdout.trim();
  const jsonStart = trimmed.indexOf('{');
  if (jsonStart < 0) return null;
  try {
    return JSON.parse(trimmed.slice(jsonStart));
  } catch {
    return null;
  }
}

function summarizeBucket(bucket) {
  const targets = bucket.files ?? [bucket.dir];
  const result = runVitestOnce(targets);
  if (result.error) {
    return {
      label: bucket.label,
      ok: false,
      passed: 0,
      total: bucket.expected,
      failures: [`spawn error: ${result.error.message}`],
    };
  }
  const report = parseVitestJson(result.stdout);
  if (!report) {
    return {
      label: bucket.label,
      ok: false,
      passed: 0,
      total: bucket.expected,
      failures: [
        'could not parse vitest JSON output',
        result.stderr.split('\n').slice(-10).join('\n'),
      ],
    };
  }
  const testResults = Array.isArray(report.testResults) ? report.testResults : [];
  const failures = testResults
    .filter((f) => f.status !== 'passed')
    .map((f) => f.name ?? '(unknown file)');

  // Default: count one test file = one unit.
  let passedCount = testResults.length - failures.length;
  let totalCount = testResults.length || bucket.expected;
  let failureLabels = failures;

  // 'endpoint' mode collapses test files by their parent directory so a
  // (parse.test.ts, route.test.ts) pair counts as a single endpoint.
  if (bucket.countBy === 'endpoint') {
    const endpointStatus = new Map();
    for (const f of testResults) {
      const name = f.name ?? '';
      // Take the last path segment's parent — i.e. the endpoint dir name.
      const parts = name.split('/');
      const key = parts.length >= 2 ? parts[parts.length - 2] : name;
      const prev = endpointStatus.get(key);
      const pass = f.status === 'passed';
      // An endpoint is green only if ALL its files passed.
      endpointStatus.set(key, prev === undefined ? pass : prev && pass);
    }
    const endpointResults = Array.from(endpointStatus.entries());
    totalCount = endpointResults.length || bucket.expected;
    passedCount = endpointResults.filter(([, ok]) => ok).length;
    failureLabels = endpointResults.filter(([, ok]) => !ok).map(([k]) => k);
  }

  return {
    label: bucket.label,
    ok: result.status === 0 && failureLabels.length === 0,
    passed: passedCount,
    total: totalCount,
    failures: failureLabels,
  };
}

console.log('monitoring-smoke: running vitest against the monitoring contract surface...');

const results = BUCKETS.map(summarizeBucket);

let allGreen = true;
for (const r of results) {
  if (r.ok) {
    console.log(`  PASS  ${r.label}: ${r.passed}/${r.total} files green`);
  } else {
    allGreen = false;
    console.log(`  FAIL  ${r.label}: ${r.passed}/${r.total} files green`);
    for (const f of r.failures) {
      console.log(`        - ${f}`);
    }
  }
}

const cards = results[0];
const charts = results[1];
const routes = results[2];

const summary =
  `monitoring smoke: ${cards.passed}/${cards.total} cards green, ` +
  `${routes.passed}/${routes.total} routes green, ` +
  `${charts.passed}/${charts.total} chart primitives green`;

console.log('');
console.log(summary);

if (!allGreen) {
  console.error('monitoring-smoke: at least one bucket failed; see above.');
  process.exit(1);
}

process.exit(0);
